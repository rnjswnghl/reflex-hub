import { CONFIG, CONDITIONS } from './config.js';

// 시행 엔진. React 렌더링을 거치지 않고 DOM을 직접 바꾼다.
// React 상태 갱신은 커밋 시점이 프레임과 어긋날 수 있어 자극 제시 시각 기록에 오차를 만든다.

const HALF_FRAME_MS = 8; // 60Hz 기준 반 프레임. 목표 시각에 가장 가까운 프레임에서 그리기 위함.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 이벤트의 하드웨어 입력 시각. performance.now()와 같은 기준(timeOrigin)이어야 한다.
// 구형 브라우저처럼 epoch 기준 값이 오면 핸들러 실행 시각으로 대체한다.
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

export function createRunner({ stage, target, feedback }) {
  const state = { phase: 'idle', response: null, onResponse: null, hiddenDuringTrial: false };

  const handle = (input, e) => {
    if (state.phase === 'idle') return;
    if (state.response) return; // 한 시행에 첫 반응만 기록
    const { t, source } = eventTime(e);
    state.response = { t, input, source, phase: state.phase };
    state.onResponse?.();
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
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') state.hiddenDuringTrial = true;
  };

  stage.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);

  // 목표 시각 tAbs에 가장 가까운 프레임에서 apply()를 실행하고 그 시각을 돌려준다.
  // 그 전에 반응이 들어오면 'early'로 중단한다.
  function at(tAbs, apply) {
    return new Promise((resolve) => {
      const lead = tAbs - performance.now() - 40;
      const loop = () => {
        if (state.response) return resolve({ early: true });
        if (performance.now() + HALF_FRAME_MS >= tAbs) {
          apply();
          return resolve({ early: false, t: performance.now() });
        }
        requestAnimationFrame(loop);
      };
      setTimeout(() => requestAnimationFrame(loop), Math.max(0, lead));
    });
  }

  function setFeedback(text, tone = '') {
    feedback.textContent = text;
    feedback.dataset.tone = tone;
  }

  async function runTrial(trial) {
    state.response = null;
    state.hiddenDuringTrial = document.visibilityState === 'hidden';
    target.dataset.on = 'false';
    stage.dataset.cue = 'off';
    setFeedback('');
    stage.dataset.fix = 'on';

    const row = {
      trial_index: trial.trialIndex,
      block: trial.block,
      condition: trial.condition,
      precue_planned_ms: trial.preCueMs,
      cue_target_planned_ms: CONFIG.cueToTargetMs,
      cue_target_actual_ms: null,
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
    const cue = await at(start + trial.preCueMs, () => {
      if (trial.condition === CONDITIONS.CUE) stage.dataset.cue = 'on';
    });

    let targetOnset = null;
    if (!cue.early) {
      if (trial.condition === CONDITIONS.CUE) {
        sleep(CONFIG.cueDurationMs).then(() =>
          requestAnimationFrame(() => {
            stage.dataset.cue = 'off';
          }),
        );
      }
      // 2) 목표 자극: 경고 시점 + 500ms. 두 조건 동일.
      const tgt = await at(cue.t + CONFIG.cueToTargetMs, () => {
        stage.dataset.fix = 'off';
        target.dataset.on = 'true';
      });
      if (!tgt.early) {
        targetOnset = tgt.t;
        row.cue_target_actual_ms = round(tgt.t - cue.t);
        state.phase = 'target';
        // 3) 반응 대기
        await Promise.race([
          new Promise((r) => (state.onResponse = r)),
          sleep(CONFIG.responseWindowMs),
        ]);
        state.onResponse = null;
      }
    }

    state.phase = 'idle';
    target.dataset.on = 'false';
    stage.dataset.cue = 'off';
    stage.dataset.fix = 'off';
    row.hidden_during_trial = state.hiddenDuringTrial;

    const r = state.response;
    if (r && (targetOnset === null || r.phase === 'wait')) {
      row.status = 'anticipation';
      row.input_type = r.input;
      row.time_source = r.source;
      setFeedback('너무 일러요 — 원이 나온 뒤에 눌러 주세요', 'warn');
    } else if (r) {
      row.status = 'ok';
      row.rt_ms = round(r.t - targetOnset);
      row.input_type = r.input;
      row.time_source = r.source;
      setFeedback(`${Math.round(row.rt_ms)} ms`, 'ok');
    } else {
      row.status = 'timeout';
      setFeedback('놓쳤어요', 'warn');
    }

    await sleep(row.status === 'anticipation' ? CONFIG.feedbackMs + 400 : CONFIG.feedbackMs);
    setFeedback('');
    await sleep(CONFIG.itiMs);
    return row;
  }

  function dispose() {
    stage.removeEventListener('pointerdown', onPointer);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  return { runTrial, dispose };
}

function round(x) {
  return Math.round(x * 100) / 100;
}
