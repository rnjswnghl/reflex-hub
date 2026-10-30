import { CONFIG, CONDITIONS } from './config.js';

// 암호학적 난수로 [0,1) 생성. Math.random보다 예측이 어렵고 브라우저 간 품질 차이가 적다.
export function rand() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

export function shuffle(arr, rng = rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function preCue(rng) {
  const { preCueMinMs: lo, preCueMaxMs: hi } = CONFIG;
  return Math.round(lo + rng() * (hi - lo));
}

// 조건 순서는 참가자마다 무작위. 연습은 조건 균형만 맞추고 순서도 무작위.
// 두 조건의 대기시간 분포는 동일하다 → 조건 차이는 '경고 신호 유무'뿐.
export function buildSequence(rng = rand) {
  const make = (block, n) =>
    shuffle(
      [
        ...Array.from({ length: n }, () => CONDITIONS.CUE),
        ...Array.from({ length: n }, () => CONDITIONS.NOCUE),
      ],
      rng,
    ).map((condition) => ({ block, condition, preCueMs: preCue(rng) }));

  const practice = make('practice', CONFIG.practicePerCondition);
  const main = make('main', CONFIG.mainPerCondition);
  return [...practice, ...main].map((t, i) => ({ ...t, trialIndex: i }));
}
