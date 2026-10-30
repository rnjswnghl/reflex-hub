import { useRef, useState } from 'react';
import Result from '../components/Result.jsx';
import { submitScore } from '../lib/api.js';
import { getPlayer, isPilot, recordRound } from '../lib/player.js';

// 딱 1초: 누르고 있다가 1초라고 생각되면 손을 뗀다. 0.3초 뒤부터 시계가 가려진다. 3번 시도의 평균 오차.
const TARGET = 1000;
const TRIES = 3;
const HIDE_AFTER = 300;

export default function TimingGame({ game, onHome }) {
  const [phase, setPhase] = useState('intro');
  const [tries, setTries] = useState([]);
  const [holding, setHolding] = useState(false);
  const [shown, setShown] = useState(0);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const t0 = useRef(0);
  const raf = useRef(0);

  function down(e) {
    e.preventDefault();
    if (holding) return;
    t0.current = e.timeStamp || performance.now();
    setHolding(true);
    const tick = () => {
      const t = performance.now() - t0.current;
      setShown(t < HIDE_AFTER ? t : -1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  async function up(e) {
    if (!holding) return;
    cancelAnimationFrame(raf.current);
    setHolding(false);
    const t = (e.timeStamp || performance.now()) - t0.current;
    setShown(t);
    const next = [...tries, Math.round(t)];
    setTries(next);
    if (next.length < TRIES) return;
    const score = Math.round(next.reduce((s, x) => s + Math.abs(x - TARGET), 0) / TRIES);
    recordRound('timing', score);
    setResult({ score, tries: next });
    setTimeout(() => setPhase('result'), 700);
    setSaving(true);
    const p = getPlayer();
    await submitScore({ game: 'timing', score, playerId: p.id, nick: p.nick, pilot: isPilot(), detail: { tries: next } }).catch(() => {});
    setSaving(false);
  }

  if (phase === 'intro')
    return (
      <main className={`intro hue-${game.hue}`}>
        <button className="back" onClick={onHome}>
          ← 게임 목록
        </button>
        <p className="eyebrow">약 {game.seconds}초 · {TRIES}번</p>
        <h1>{game.title}</h1>
        <p className="lead">버튼을 누르고 있다가, 딱 1초라고 느낄 때 손을 떼세요. 시계는 0.3초 뒤에 사라집니다.</p>
        <button
          className="btn primary big"
          onClick={() => {
            setTries([]);
            setShown(0);
            setPhase('play');
          }}
        >
          시작
        </button>
      </main>
    );

  if (phase === 'play')
    return (
      <main className={`play-panel hue-${game.hue}`}>
        <div className="play-top">
          <span>
            {Math.min(tries.length + 1, TRIES)} / {TRIES}
          </span>
          <span>{tries.map((t) => `${(t / 1000).toFixed(3)}`).join(' · ')}</span>
        </div>
        <div className="timer">{shown < 0 ? '?.???' : (shown / 1000).toFixed(3)}</div>
        <button
          className={`hold${holding ? ' on' : ''}`}
          onPointerDown={down}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          onContextMenu={(e) => e.preventDefault()}
        >
          {holding ? '1초에 손 떼기' : '누르고 있기'}
        </button>
      </main>
    );

  return (
    <Result
      game={game}
      score={result.score}
      detail={result.tries.map((t) => `${(t / 1000).toFixed(3)}초`).join(' · ')}
      saving={saving}
      onAgain={() => setPhase('intro')}
      onHome={onHome}
    />
  );
}
