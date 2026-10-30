import { useRef, useState } from 'react';
import Result from '../components/Result.jsx';
import { submitScore } from '../lib/api.js';
import { getPlayer, isPilot, recordRound } from '../lib/player.js';

// 1 → 16: 4×4에 섞인 숫자를 순서대로 누른다. 잘못 누름 1번당 +0.5초.
const N = 16;
const PENALTY = 500;

function shuffled() {
  const a = Array.from({ length: N }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SchulteGame({ game, onHome }) {
  const [phase, setPhase] = useState('intro');
  const [grid, setGrid] = useState([]);
  const [next, setNext] = useState(1);
  const [errors, setErrors] = useState(0);
  const [wrongCell, setWrongCell] = useState(null);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const t0 = useRef(0);

  function start() {
    setGrid(shuffled());
    setNext(1);
    setErrors(0);
    setPhase('play');
    t0.current = performance.now();
  }

  async function tap(n, idx) {
    if (n < next) return;
    if (n !== next) {
      setErrors((e) => e + 1);
      setWrongCell(idx);
      setTimeout(() => setWrongCell(null), 200);
      return;
    }
    if (n < N) {
      setNext(n + 1);
      return;
    }
    const elapsed = performance.now() - t0.current;
    const score = Math.round(elapsed + PENALTY * errors);
    recordRound('schulte', score);
    setResult({ score, elapsed, errors });
    setPhase('result');
    setSaving(true);
    const p = getPlayer();
    await submitScore({ game: 'schulte', score, playerId: p.id, nick: p.nick, pilot: isPilot(), detail: { errors, elapsed_ms: Math.round(elapsed) } }).catch(() => {});
    setSaving(false);
  }

  if (phase === 'intro')
    return (
      <main className={`intro hue-${game.hue}`}>
        <button className="back" onClick={onHome}>
          ← 게임 목록
        </button>
        <p className="eyebrow">약 {game.seconds}초</p>
        <h1>{game.title}</h1>
        <p className="lead">섞여 있는 1부터 16까지를 순서대로 최대한 빨리 누르세요. 잘못 누르면 +0.5초.</p>
        <button className="btn primary big" onClick={start}>
          시작
        </button>
      </main>
    );

  if (phase === 'play')
    return (
      <main className={`play-panel hue-${game.hue}`}>
        <div className="play-top">
          <span>다음: {next}</span>
          <span>실수 {errors}</span>
        </div>
        <div className="schulte-grid">
          {grid.map((n, idx) => (
            <button
              key={n}
              className={`schulte-cell${n < next ? ' done' : ''}${wrongCell === idx ? ' wrong' : ''}`}
              onPointerDown={() => tap(n, idx)}
            >
              {n}
            </button>
          ))}
        </div>
      </main>
    );

  return (
    <Result
      game={game}
      score={result.score}
      detail={`${(result.elapsed / 1000).toFixed(2)}초 · 실수 ${result.errors}번`}
      saving={saving}
      onAgain={() => setPhase('intro')}
      onHome={onHome}
    />
  );
}
