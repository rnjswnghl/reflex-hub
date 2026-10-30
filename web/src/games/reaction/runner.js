import { CONFIG, CONDITIONS } from './config.js';

// 시행 엔진. React 렌더링을 거치지 않고 DOM을 직접 바꾼다.
// React 상태 갱신은 커밋 시점이 프레임과 어긋날 수 있어 자극 제시 시각 기록에 오차를 만든다.
//
// 기록하는 시각의 의미 (과장 금지):
// - 자극 시각 = 화면을 바꾼 requestAnimationFrame 콜백 안의 performance.now(). 실제 화면 표시는 보통 그 다음 프레임이다.
// - 반응 시각 = 입력 이벤트의 event.timeStamp (브라우저가 이벤트를 만든 시각).
// 따라서 RT 절대값에는 화면 표시 지연과 입력 장치 지연이 섞인다. 두 조건에 같은 방식으로 들어가므로 조건 차이에서는 상쇄된다.

const HALF_FRAME_MS = 8; // 60Hz 기준 반 프레임. 목표 시각에 가장 가까운 프레임에서 그리기 위함.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 이벤트 시각. performance.now()와 같은 기준(timeOrigin)이어야 한다.
// 구형 브라우저처럼 epoch 기준 값이 오면 핸들러 실행 시각으로 대체하고 그 사실을 기록한다.
function eventTime(e) {
  const t = e?.timeStamp;
  const now = performance.now();
  if (typeof t === 'number' && t > 0 && t <= now + 5) return { t, source: 'event' };
  return { t: now, source: 'handler' };
}

export function estimateFrameMs(samples = 40) {
  return new Promise((resolve) => {
    const ts = [];
    const step = (t) => {
      ts.push(t);
      if (ts.length > samples) {
        const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
        resolve(Math.round(d[Math.floor(d.length / 2)] * 100) / 100);
      } else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function createRunner({ stage, cueFrame, target, feedback }) {
  const state = { phase: 'idle', response: null, onResponse: null, interrupted: false };

  const handle = (input, e) => {
    if (state.phase === 'idle') return;
    if (state.response) return; // 한 시행에 첫 반응만 기록
    const { t, source } = eventTime(e);
    state.response = { t, input, source, phase: state.phase };
    state.onResponse?.(); // 대기 중이든 반응 창이든 즉시 깨운다
  };
  const onPointer = (e) => {
    e.preventDefault();
    handle(e.pointerType || 'pointer', e);
  };
  const onKey = (e) => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      handle('keyboard', e);
    }
  };
  // 탭 전환, 다른 창 클릭, 알림창·통화 화면 등으로 페이지가 가려지거나 포커스를 잃은 경우
  const onInterrupt = () => {
    if (state.phase !== 'idle') state.interrupted = true;
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') onInterrupt();
  };

  stage.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onInterrupt);
  window.addEventListener('pagehide', onInterrupt);

  // 목표 시각 tAbs에 가장 가까운 프레임에서 apply()를 실행하고 그 시각을 돌려준다.
  // 그 전에 반응이 들어오면 즉시 'early'로 끝난다 (abortable=false면 반응과 무관하게 실행: 테두리 소등용).
  function at(tAbs, apply, { abortable = true } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(v);
      };
      if (abortable) state.onResponse = () => finish({ early: true });
      const loop = () => {
        if (done) return;
        if (abortable && state.response) return finish({ early: true });
        if (performance.now() + HALF_FRAME_MS >= tAbs) {
          apply();
          return finish({ early: false, t: performance.now() });
        }
        requestAnimationFrame(loop);
      };
      const lead = tAbs - performance.now() - 40;
      setTimeout(() => requestAnimationFrame(loop), Math.max(0, lead));
    });
  }

  function setFeedback(text, tone = '') {
    feedback.textContent = text;
    feedback.dataset.tone = tone;
  }
  const cueOn = (on) => {
    cueFrame.dataset.on = on ? 'true' : 'false';
  };

  async function runTrial(trial) {
    state.response = null;
    state.onResponse = null;
    state.interrupted = document.visibilityState === 'hidden';
    target.dataset.on = 'false';
    cueOn(false);
    setFeedback('');
    stage.dataset.fix = 'on';

    const row = {
      trial_index: trial.trialIndex,
      block: trial.block,
      condition: trial.condition,
      is_catch: trial.isCatch,
      precue_planned_ms: trial.preCueMs,
      cue_target_planned_ms: CONFIG.cueToTargetMs,
      cue_target_actual_ms: null,
      cue_on_actual_ms: null,
      status: null,
      rt_ms: null,
      input_type: null,
      time_source: null,
      hidden_during_trial: false,
      trial_started_at: new Date().toISOString(),
    };

    state.phase = 'wait';
    const start = performance.now();

    // 1) 경고 시점: cue 조건이면 테두리 점등, nocue 조건이면 화면 변화 없이 시각만 기록
    const isCue = trial.condition === CONDITIONS.CUE;
    const cue = await at(start + trial.preCueMs, () => {
      if (isCue) cueOn(true);
    });

    let targetOnset = null;
    let cueOff = null;
    if (!cue.early) {
      // 테두리 소등도 프레임에 맞춰 예약하고 실제 점등 시간을 기록한다 (반응과 무관하게 반드시 끈다)
      if (isCue) cueOff = at(cue.t + CONFIG.cueDurationMs, () => cueOn(false), { abortable: false });

      // 2) 목표 시점: 경고 + 500ms. 두 조건 동일. 캐치 시행은 원을 띄우지 않고 고정점도 유지한다
      //    (고정점이 사라지는 것 자체가 '누르라'는 신호가 되지 않도록).
      const tgt = await at(cue.t + CONFIG.cueToTargetMs, () => {
        if (!trial.isCatch) {
          stage.dataset.fix = 'off';
          target.dataset.on = 'true';
        }
      });
      if (!tgt.early) {
        targetOnset = tgt.t;
        row.cue_target_actual_ms = round(tgt.t - cue.t);
        state.phase = 'target';
        // 3) 반응 대기 (캐치 시행은 '누르지 않고 버티는' 창)
        await Promise.race([new Promise((r) => (state.onResponse = r)), sleep(CONFIG.responseWindowMs)]);
        state.onResponse = null;
      }
      if (cueOff) {
        const off = await cueOff;
        row.cue_on_actual_ms = round(off.t - cue.t);
      }
    }

    state.phase = 'idle';
    target.dataset.on = 'false';
    cueOn(false);
    stage.dataset.fix = 'off';
    row.hidden_during_trial = state.interrupted;

    const r = state.response;
    if (r) {
      row.input_type = r.input;
      row.time_source = r.source;
    }
    // 입력 시각이 목표 제시보다 앞서면(대기 중 누름, 또는 제시 직전 누름) 조기 반응
    const early = r && (targetOnset === null || r.phase === 'wait' || r.t < targetOnset);
    if (trial.isCatch) {
      if (r) {
        row.status = early ? 'anticipation' : 'catch_fa';
        setFeedback('함정! 원이 안 나올 때도 있어요', 'warn');
      } else {
        row.status = 'catch_ok';
      }
    } else if (early) {
      row.status = 'anticipation';
      setFeedback('너무 빨라요! 노란 원이 뜨면 누르세요', 'warn');
    } else if (r) {
      row.status = 'ok';
      row.rt_ms = round(r.t - targetOnset);
      setFeedback(`${Math.round(row.rt_ms)} ms`, 'ok');
    } else {
      row.status = 'timeout';
      setFeedback('놓쳤어요', 'warn');
    }

    const warn = row.status === 'anticipation' || row.status === 'catch_fa';
    await sleep(warn ? CONFIG.feedbackMs + 400 : CONFIG.feedbackMs);
    setFeedback('');
    await sleep(CONFIG.itiMs);
    return row;
  }

  function dispose() {
    stage.removeEventListener('pointerdown', onPointer);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onInterrupt);
    window.removeEventListener('pagehide', onInterrupt);
  }

  return { runTrial, dispose };
}

function round(x) {
  return Math.round(x * 100) / 100;
}
