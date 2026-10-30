import { useRef, useState } from 'react';
import Result from '../components/Result.jsx';
import { submitScore } from '../lib/api.js';
import { getPlayer, isPilot, recordRound } from '../lib/player.js';

// 컬러 함정: 색 이름 글자가 다른 색으로 칠해져 있다. 글자 '색'을 고른다. 12문제, 오답 1개당 +1초.
const COLORS = [
  { key: 'red', name: '빨강', hex: '#ff5d5d' },
  { key: 'blue', name: '파랑', hex: '#4d8dff' },
  { key: 'green', name: '초록', hex: '#3ccf7a' },
  { key: 'yellow', name: '노랑', hex: '#ffd23f' },
];
const N = 12;
const PENALTY = 1000;
const pick = (n) => crypto.getRandomValues(new Uint8Array(1))[0] % n;

function makeItems() {
  // 3/4는 글자와 색이 다른 '함정', 1/4은 같은 문제
  return Array.from({ length: N }, (_, i) => {
    const ink = pick(4);
    const word = i % 4 === 0 ? ink : (ink + 1 + pick(3)) % 4;
    return { ink, word };
  });
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StroopGame({ game, onHome }) {
  const [phase, setPhase] = useState('intro');
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  const [errors, setErrors] = useState(0);
  const [flash, setFlash] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const t0 = useRef(0);

  function start() {
    setItems(shuffle(makeItems()));
    setI(0);
    setErrors(0);
    setPhase('play');
    t0.current = performance.now();
  }

  async function choose(k) {
    if (k !== items[i].ink) {
      setErrors((e) => e + 1);
      setFlash('wrong');
      setTimeout(() => setFlash(''), 250);
      return;
    }
    if (i + 1 < N) {
      setI(i + 1);
      return;
    }
    const elapsed = performance.now() - t0.current;
    const score = Math.round(elapsed + PENALTY * errors);
    recordRound('stroop', score);
    setResult({ score, elapsed, errors });
    setPhase('result');
    setSaving(true);
    const p = getPlayer();
    await submitScore({ game: 'stroop', score, playerId: p.id, nick: p.nick, pilot: isPilot(), detail: { errors, elapsed_ms: Math.round(elapsed) } }).catch(() => {});
    setSaving(false);
  }

  if (phase === 'intro')
    return (
      <main className={`intro hue-${game.hue}`}>
        <button className="back" onClick={onHome}>
          ← 게임 목록
        </button>
        <p className="eyebrow">약 {game.seconds}초 · {N}문제</p>
        <h1>{game.title}</h1>
        <div className="stroop-demo">
          <span style={{ color: COLORS[1].hex }}>빨강</span>
          <span className="arrow">→</span>
          <span className="chip" style={{ background: COLORS[1].hex }}>파랑</span>
        </div>
        <p className="lead">글자를 읽지 말고, 글자가 칠해진 <b>색</b>을 고르세요. 틀리면 +1초.</p>
        <button className="btn primary big" onClick={start}>
          시작
        </button>
      </main>
    );

  if (phase === 'play') {
    const it = items[i];
    return (
      <main className={`play-panel hue-${game.hue}`} data-flash={flash}>
        <div className="play-top">
          <span>
            {i + 1} / {N}
          </span>
          <span>오답 {errors}</span>
        </div>
        <div className="stroop-word" style={{ color: COLORS[it.ink].hex }}>
          {COLORS[it.word].name}
        </div>
        <div className="stroop-grid">
          {COLORS.map((c) => (
            <button key={c.key} className="stroop-btn" style={{ background: c.hex }} onPointerDown={() => choose(COLORS.indexOf(c))}>
              {c.name}
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <Result
      game={game}
      score={result.score}
      detail={`${(result.elapsed / 1000).toFixed(2)}초 · 오답 ${result.errors}개`}
      saving={saving}
      onAgain={() => setPhase('intro')}
      onHome={onHome}
    />
  );
}
