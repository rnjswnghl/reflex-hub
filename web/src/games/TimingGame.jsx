import { useEffect, useRef, useState } from 'react';
import Result from '../components/Result.jsx';
import LiveBoard from '../components/LiveBoard.jsx';
import { submitScore } from '../lib/api.js';
import { getPlayer, isPilot, recordRound } from '../lib/player.js';
import { TIMING_TARGETS, boardId } from './index.js';

// 딱 N초: [시작]을 누르면 시간이 흐르고, N초라고 느낄 때 [멈춤]. 한 판 = 한 번, 점수 = 목표와의 차이(ms).
// 시계는 처음 잠깐만 보이고 사라진다(끝까지 보이면 게임이 되지 않으므로). 멈추면 실제 시간이 드러난다.
const revealMs = (target) => Math.min(1000, target * 300); // 1초 → 0.3초, 3초 이상 → 1초

export default function TimingGame({ game, onHome }) {
  const [target, setTarget] = useState(() => {
    try {
      return Number(localStorage.getItem('reflexhub.timing.target')) || 1;
    } catch {
      return 1;
    }
  });
  const [phase, setPhase] = useState('intro'); // intro | ready | running | stopped | result
  const [shown, setShown] = useState(0);
  const [elapsed, setElapsed] = useState(null);
  const [score, setScore] = useState(null);
  const [saving, setSaving] = useState(false);
  const t0 = useRef(0);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function pick(t) {
    setTarget(t);
    try {
      localStorage.setItem('reflexhub.timing.target', String(t));
    } catch {
      /* 무시 */
    }
  }

  function start(e) {
    t0.current = e?.timeStamp || performance.now();
    setElapsed(null);
    setPhase('running');
    const hideAt = revealMs(target);
    const tick = () => {
      const t = performance.now() - t0.current;
      setShown(t < hideAt ? t : -1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  async function stop(e) {
    cancelAnimationFrame(raf.current);
    const t = Math.round((e?.timeStamp || performance.now()) - t0.current);
    const s = Math.abs(t - target * 1000);
    setElapsed(t);
    setShown(t);
    setScore(s);
    setPhase('stopped');
    recordRound(boardId('timing', target), s);
    setSaving(true);
    const p = getPlayer();
    await submitScore({ game: boardId('timing', target), score: s, playerId: p.id, nick: p.nick, pilot: isPilot(), detail: { target_s: target, elapsed_ms: t } }).catch(() => {});
    setSaving(false);
  }

  if (phase === 'intro')
    return (
      <main className={`intro hue-${game.hue}`}>
        <button className="back" onClick={onHome}>
          ← 게임 목록
        </button>
        <p className="eyebrow">한 판 = 한 번</p>
        <h1>{game.title.replace('N', String(target))}</h1>
        <p className="lead">
          [시작]을 누르면 시간이 흐릅니다. 시계는 처음 잠깐만 보이고 사라져요. <b>딱 {target}초</b>라고 느낄 때 [멈춤]!
        </p>
        <div className="seg" role="radiogroup" aria-label="목표 시간">
          {TIMING_TARGETS.map((t) => (
            <button key={t} role="radio" aria-checked={t === target} className={t === target ? 'on' : ''} onClick={() => pick(t)}>
              {t}초
            </button>
          ))}
        </div>
        <p className="fine">목표 시간마다 순위표가 따로 있어요.</p>
        <button className="btn primary big" onClick={() => setPhase('ready')}>
          {target}초 도전
        </button>
        <LiveBoard key={target} game={{ ...game, title: `딱 ${target}초` }} boardKey={boardId('timing', target)} limit={3} title={`딱 ${target}초 TOP 3`} compact />
      </main>
    );

  if (phase === 'ready' || phase === 'running' || phase === 'stopped') {
    const running = phase === 'running';
    const diff = elapsed != null ? elapsed - target * 1000 : null;
    return (
      <main className={`play-panel hue-${game.hue}`}>
        <div className="play-top">
          <span>목표 {target}.000초</span>
          <span>{running ? (shown < 0 ? '이제부터 감으로!' : '') : ''}</span>
        </div>
        <div className={`timer${phase === 'stopped' ? ' done' : ''}`}>
          {phase === 'ready' ? '0.000' : shown < 0 ? '?.???' : (shown / 1000).toFixed(3)}
          {phase === 'stopped' && (
            <span className="timer-diff">
              {diff === 0 ? '완벽!' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} ms ${diff > 0 ? '늦었어요' : '빨랐어요'}`}
            </span>
          )}
        </div>
        {phase === 'stopped' ? (
          <div className="actions">
            <button className="btn primary" onClick={() => setPhase('result')}>
              순위 보기
            </button>
            <button className="btn ghost" onClick={() => setPhase('ready')}>
              바로 다시
            </button>
          </div>
        ) : (
          <button
            className={`hold${running ? ' on' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              running ? stop(e) : start(e);
            }}
          >
            {running ? '멈춤' : '시작'}
          </button>
        )}
      </main>
    );
  }

  return (
    <Result
      game={{ ...game, title: `딱 ${target}초` }}
      board={boardId('timing', target)}
      score={score}
      detail={`${(elapsed / 1000).toFixed(3)}초에 멈춤 (목표 ${target}초)`}
      saving={saving}
      onAgain={() => setPhase('ready')}
      onHome={onHome}
    />
  );
}
