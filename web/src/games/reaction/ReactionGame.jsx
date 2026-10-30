import { useEffect, useRef, useState } from 'react';
import LiveBoard from '../../components/LiveBoard.jsx';
import Result from '../../components/Result.jsx';
import { reportStart, submitReactionRound } from '../../lib/api.js';
import { getPlayer, isPilot, recordRound, savePlayer, uuid } from '../../lib/player.js';
import { APP_VERSION, CONFIG, roundScore } from './config.js';
import { createRunner, estimateFrameMs } from './runner.js';
import { buildRound } from './sequence.js';

const SAW_CUE = [
  ['yes', '봤어요'],
  ['no', '못 봤어요'],
  ['unsure', '잘 모르겠어요'],
];

function deviceMeta(estFrameMs) {
  return {
    user_agent: navigator.userAgent,
    platform: navigator.userAgentData?.platform ?? navigator.platform ?? null,
    pointer_coarse: window.matchMedia?.('(pointer: coarse)').matches ?? null,
    max_touch_points: navigator.maxTouchPoints ?? null,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dpr: window.devicePixelRatio,
    est_frame_ms: estFrameMs,
  };
}

export default function ReactionGame({ game, onHome }) {
  const [phase, setPhase] = useState('intro'); // intro | play | check | result
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [outcome, setOutcome] = useState(null);
  const [saving, setSaving] = useState(false);
  const run = useRef(null);
  const stageRef = useRef(null);
  const cueRef = useRef(null);
  const targetRef = useRef(null);
  const feedbackRef = useRef(null);
  const firstEver = (getPlayer().rounds.reaction ?? 0) === 0;

  async function start() {
    const player = getPlayer();
    const tutorial = (player.rounds.reaction ?? 0) === 0;
    const meta = {
      round_id: uuid(),
      player_id: player.id,
      nick: player.nick,
      app_version: APP_VERSION,
      pilot: isPilot(),
      round_index: (player.rounds.reaction ?? 0) + 1, // 이 브라우저에서 몇 번째 판인지
      tutorial,
      config: CONFIG,
      saw_cue: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      ...deviceMeta(await estimateFrameMs()),
    };
    run.current = { meta, trials: [], seq: buildRound({ tutorial }) };
    reportStart(meta);
    setProgress({ done: 0, total: run.current.seq.length });
    setPhase('play');
  }

  // 시행 진행: 화면이 'play'로 바뀐 뒤 시작
  useEffect(() => {
    if (phase !== 'play') return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const runner = createRunner({
        stage: stageRef.current,
        cueFrame: cueRef.current,
        target: targetRef.current,
        feedback: feedbackRef.current,
      });
      try {
        const { seq, trials } = run.current;
        for (let i = 0; i < seq.length && !cancelled; i++) {
          trials.push(await runner.runTrial(seq[i]));
          setProgress({ done: i + 1, total: seq.length });
        }
      } finally {
        runner.dispose();
      }
      if (cancelled) return;
      run.current.meta.finished_at = new Date().toISOString();
      // 조작 점검: 이 브라우저에서 처음 끝낸 판에만 한 번 묻는다
      if (!getPlayer().sawCueAsked) setPhase('check');
      else finish();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function answer(v) {
    run.current.meta.saw_cue = v;
    savePlayer({ sawCueAsked: true });
    finish();
  }

  async function finish() {
    const { meta, trials } = run.current;
    const s = roundScore(trials);
    recordRound('reaction', s.score);
    setOutcome(s);
    setSaving(true);
    setPhase('result');
    try {
      await submitReactionRound(meta, trials); // 순위표 반영 전에 먼저 저장
    } catch {
      /* 브라우저에 보관됨 → 다음 방문 때 재전송 */
    }
    setSaving(false);
  }

  if (phase === 'intro') {
    return (
      <main className={`intro hue-${game.hue}`}>
        <button className="back" onClick={onHome}>
          ← 게임 목록
        </button>
        <p className="eyebrow">약 {game.seconds}초</p>
        <h1>{game.title}</h1>
        <div className="howto">
          <div className="howto-step">
            <span className="demo-cross" aria-hidden="true">+</span>
            <span>
              <b>+</b> 가 보이면 기다리기
            </span>
          </div>
          <div className="howto-step">
            <span className="demo-target" aria-hidden="true" />
            <span>
              <b>노란 원</b>이 뜨면 화면 아무 곳이나 터치
              <small>키보드는 Space</small>
            </span>
          </div>
          <div className="howto-step">
            <span className="demo-trap" aria-hidden="true" />
            <span>
              가끔 원이 <b>안 나오는 함정</b>이 있어요. 참으세요
              <small>테두리가 번쩍여도 원이 뜰 때만 누르기</small>
            </span>
          </div>
        </div>
        <p className="fine">
          {firstEver ? '첫 판은 연습 4번을 먼저 합니다. ' : ''}
          미리 누르거나 함정에 걸리면 +{CONFIG.penaltyMs}ms
        </p>
        <button className="btn primary big" onClick={start}>
          시작
        </button>
        <LiveBoard game={game} limit={3} title="지금 TOP 3" compact />
      </main>
    );
  }

  if (phase === 'play') {
    const tutorialLeft = run.current.seq.filter((t) => t.block === 'practice').length - progress.done;
    return (
      <div className="stage" ref={stageRef} data-fix="off" role="application" aria-label="반응 영역">
        <div className="cue-frame" ref={cueRef} data-on="false" aria-hidden="true" />
        <div className="progress" aria-hidden="true">
          <div style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
        </div>
        <span className="block-label">{tutorialLeft > 0 ? `연습 · ${tutorialLeft}번 남음` : `${progress.done} / ${progress.total}`}</span>
        <div className="fixation" aria-hidden="true">
          +
        </div>
        <div className="target" ref={targetRef} data-on="false" />
        <div className="feedback" ref={feedbackRef} aria-live="polite" />
      </div>
    );
  }

  if (phase === 'check') {
    return (
      <main className={`intro hue-${game.hue}`}>
        <p className="eyebrow">하나만 물어볼게요</p>
        <h1 className="q">게임 중에 화면 테두리가 잠깐 번쩍이는 걸 봤나요?</h1>
        <div className="choices">
          {SAW_CUE.map(([v, label]) => (
            <button key={v} className="btn ghost" onClick={() => answer(v)}>
              {label}
            </button>
          ))}
        </div>
      </main>
    );
  }

  const detail =
    outcome &&
    (outcome.score != null
      ? `평균 ${outcome.mean} ms · 실수 ${outcome.misses}번`
      : `정상 반응이 ${outcome.valid}번뿐이라 순위에 올리지 않았어요`);
  return (
    <Result
      game={game}
      score={outcome?.score ?? null}
      detail={detail}
      saving={saving}
      onAgain={() => {
        setOutcome(null);
        setPhase('intro');
      }}
      onHome={onHome}
    />
  );
}
