import { useEffect, useRef, useState } from 'react';
import { fetchPrePost, submitPrePost } from '../../lib/api.js';
import { getPlayer, isPilot, savePlayer, uuid } from '../../lib/player.js';
import { createRunner } from '../reaction/runner.js';
import { Intervention, VARIANTS } from './interventions.jsx';

// 전후 비교 실험실: [반응 테스트] → [개입 또는 비교군] → [반응 테스트]
// 같은 테스트를 두 번 하면 두 번째는 연습 덕분에 누구나 조금 빨라진다.
// 그래서 판마다 절반 확률로 비교군(같은 시간 동안 회색 화면)을 배정하고, 두 집단의 변화를 나란히 보여 준다.
// 이 게임의 기록은 논문 분석에 쓰지 않는다(사전 등록 밖).

const TEST = { targets: 8, catches: 1, preMin: 800, preMax: 2000 };
const coin = () => (crypto.getRandomValues(new Uint8Array(1))[0] & 1 ? 'i' : 'c');
const rnd = (lo, hi) => Math.round(lo + (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (hi - lo));

function buildTest(phase) {
  const t = [
    ...Array.from({ length: TEST.targets }, () => ({ isCatch: false })),
    ...Array.from({ length: TEST.catches }, () => ({ isCatch: true })),
  ];
  for (let i = t.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t.map((x, i) => ({ ...x, block: phase, condition: 'nocue', preCueMs: rnd(TEST.preMin, TEST.preMax), trialIndex: i }));
}

function summarize(rows) {
  const v = rows.filter((r) => !r.is_catch && r.status === 'ok' && r.rt_ms >= 100 && r.rt_ms <= 1500 && !r.hidden_during_trial).map((r) => r.rt_ms);
  if (v.length < 5) return { n: v.length, median: null, sd: null };
  const s = v.slice().sort((a, b) => a - b);
  const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return { n: v.length, median: Math.round(m), sd: Math.round(sd) };
}

export default function PrePostGame({ game, onHome }) {
  const variant = VARIANTS[game.id];
  const [phase, setPhase] = useState('intro'); // intro | pre | mid | post | result
  const [arm, setArm] = useState(null);
  const [progress, setProgress] = useState('');
  const [out, setOut] = useState(null);
  const [community, setCommunity] = useState(null);
  const rows = useRef({ pre: [], post: [] });
  const stageRef = useRef(null);
  const cueRef = useRef(null);
  const targetRef = useRef(null);
  const feedbackRef = useRef(null);

  function begin() {
    rows.current = { pre: [], post: [] };
    setArm(coin());
    setOut(null);
    setCommunity(null);
    setPhase('pre');
  }

  // 반응 테스트 (번개 반사와 같은 엔진, 테두리 신호는 쓰지 않음)
  useEffect(() => {
    if (phase !== 'pre' && phase !== 'post') return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const runner = createRunner({ stage: stageRef.current, cueFrame: cueRef.current, target: targetRef.current, feedback: feedbackRef.current });
      const seq = buildTest(phase);
      try {
        for (let i = 0; i < seq.length && !cancelled; i++) {
          setProgress(`${phase === 'pre' ? '전' : '후'} 테스트 · ${i + 1} / ${seq.length}`);
          rows.current[phase].push(await runner.runTrial(seq[i]));
        }
      } finally {
        runner.dispose();
      }
      if (cancelled) return;
      if (phase === 'pre') setPhase('mid');
      else finish();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function finish() {
    const before = summarize(rows.current.pre);
    const after = summarize(rows.current.post);
    const diff = before.median != null && after.median != null ? after.median - before.median : null;
    setOut({ before, after, diff });
    setPhase('result');
    const p = getPlayer();
    if (diff != null) {
      savePlayer({ last: { ...(p.last ?? {}), [game.id]: diff } });
      await submitPrePost({
        id: uuid(),
        game: game.id,
        arm,
        before: before.median,
        after: after.median,
        sd_before: before.sd,
        sd_after: after.sd,
        player_id: p.id,
        nick: p.nick,
        pilot: isPilot(),
        trials: { pre: rows.current.pre, post: rows.current.post },
      }).catch(() => {});
    }
    fetchPrePost(game.id)
      .then(setCommunity)
      .catch(() => setCommunity({ ok: false }));
  }

  if (phase === 'intro')
    return (
      <main className={`intro hue-${game.hue}`}>
        <button className="back" onClick={onHome}>
          ← 게임 목록
        </button>
        <p className="eyebrow">전후 비교 · 약 {game.seconds}초</p>
        <h1>
          {game.title} <span className="sub">{game.subtitle}</span>
        </h1>
        <ol className="flow">
          <li>
            <b>전 테스트</b> 노란 원이 뜨면 터치 (9번)
          </li>
          <li>
            <b>{variant.label}</b> {variant.howto}
          </li>
          <li>
            <b>후 테스트</b> 같은 테스트 한 번 더
          </li>
        </ol>
        <p className="lead">{variant.why}</p>
        <p className="fine">
          공정하게 비교하려고, 판마다 절반은 같은 시간 동안 <b>회색 화면</b>(비교군)이 나와요. 두 번째 테스트는 연습 덕분에 누구나
          조금 빨라지기 때문에, 진짜 효과는 두 집단의 차이로 봐야 하거든요.
        </p>
        <button className="btn primary big" onClick={begin}>
          시작
        </button>
      </main>
    );

  if (phase === 'pre' || phase === 'post')
    return (
      <div className="stage" ref={stageRef} data-fix="off" role="application" aria-label="반응 영역">
        <div className="cue-frame" ref={cueRef} data-on="false" aria-hidden="true" />
        <span className="block-label">{progress}</span>
        <div className="fixation" aria-hidden="true">
          +
        </div>
        <div className="target" ref={targetRef} data-on="false" />
        <div className="feedback" ref={feedbackRef} aria-live="polite" />
      </div>
    );

  if (phase === 'mid') return <Intervention variant={variant} arm={arm} onDone={() => setPhase('post')} />;

  // 결과
  const { before, after, diff } = out;
  const armName = arm === 'i' ? variant.label : '회색 화면(비교군)';
  return (
    <main className={`result hue-${game.hue}`}>
      <p className="eyebrow">
        {game.title} · {game.subtitle}
      </p>
      {diff != null ? (
        <>
          <div className="big-score">
            {diff > 0 ? '+' : diff < 0 ? '−' : '±'}
            {Math.abs(diff)} ms
          </div>
          <p className="detail">
            이번 판은 <b>{armName}</b>이었어요. 전 {before.median}ms → 후 {after.median}ms,{' '}
            {diff < 0 ? `${-diff}ms 빨라졌어요.` : diff > 0 ? `${diff}ms 느려졌어요.` : '똑같았어요.'}
          </p>
          <div className="prepost-bars">
            <Bar label="전" value={before.median} max={Math.max(before.median, after.median)} sd={before.sd} />
            <Bar label="후" value={after.median} max={Math.max(before.median, after.median)} sd={after.sd} />
          </div>
          <p className="fine">
            반응의 들쭉날쭉함(표준편차): 전 {before.sd}ms → 후 {after.sd}ms {after.sd < before.sd ? '· 더 일정해졌어요' : ''}
          </p>
        </>
      ) : (
        <>
          <div className="big-score muted">측정 실패</div>
          <p className="detail">정상 반응이 테스트마다 5번 이상 필요해요. 너무 빨리 누르거나 함정에 걸린 횟수가 많았어요.</p>
        </>
      )}

      <section className="insight">
        <Community community={community} variant={variant} />
      </section>
      {variant.ref && <p className="fine">{variant.ref}</p>}

      <div className="actions">
        <button className="btn primary" onClick={begin}>
          한 판 더
        </button>
        <button className="btn ghost" onClick={onHome}>
          다른 게임
        </button>
      </div>
    </main>
  );
}

function Bar({ label, value, max, sd }) {
  return (
    <div className="pp-row">
      <span className="pp-label">{label}</span>
      <div className="pp-track">
        <div className="pp-fill" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="pp-val">
        {value}ms <small>±{sd}</small>
      </span>
    </div>
  );
}

function Community({ community, variant }) {
  if (!community) return <p>다른 사람들의 결과를 불러오는 중…</p>;
  if (!community.ok) return <p>다른 사람들의 결과를 불러오지 못했어요.</p>;
  const i = community.arms.i;
  const c = community.arms.c;
  const f = (x) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(Math.round(x))}ms`;
  if (i.players < 3 || c.players < 3)
    return (
      <p>
        아직 비교할 사람이 적어요 ({variant.label} {i.players}명 · 회색 화면 {c.players}명). 각각 3명 이상 모이면 두 집단을 견줘 드릴게요.
      </p>
    );
  const net = i.mean_diff - c.mean_diff;
  return (
    <>
      <p>
        <b>{variant.label}</b>를 본 {i.players}명은 평균 <b>{f(i.mean_diff)}</b>, <b>회색 화면</b>을 본 {c.players}명은 평균{' '}
        <b>{f(c.mean_diff)}</b> 변했어요.
      </p>
      <p>
        연습 효과를 빼면 {variant.short} 효과는 약 <b>{f(net)}</b>
        {Math.abs(net) < 5 ? ' — 거의 차이가 없어요.' : net < 0 ? ' — 조금 더 빨라지는 쪽이에요.' : ' — 오히려 느려지는 쪽이에요.'}
      </p>
      <p className="muted">사람이 더 모이면 바뀔 수 있는 값이에요.</p>
    </>
  );
}
