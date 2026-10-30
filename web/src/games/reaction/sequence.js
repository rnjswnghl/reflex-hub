import { CONFIG, CONDITIONS } from './config.js';

// 암호학적 난수로 [0,1) 생성.
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

// 한 블록. 대기시간은 '짝맞춤': 같은 대기시간 집합을 두 조건에 똑같이 배정한다.
// 캐치 시행(isCatch)은 경고 시점까지는 같지만 목표가 나오지 않는다.
function makeBlock(block, nTarget, nCatch, rng) {
  const trials = [];
  for (const isCatch of [false, true]) {
    const n = isCatch ? nCatch : nTarget;
    const pre = Array.from({ length: n }, () => preCue(rng));
    for (const condition of [CONDITIONS.CUE, CONDITIONS.NOCUE]) {
      for (const preCueMs of pre) trials.push({ block, condition, isCatch, preCueMs });
    }
  }
  return shuffle(trials, rng);
}

// 한 판. 첫 판(tutorial=true)이면 앞에 연습 4회.
export function buildRound({ tutorial = false } = {}, rng = rand) {
  const practice = tutorial
    ? makeBlock('practice', CONFIG.tutorialTargetPerCondition, CONFIG.tutorialCatchPerCondition, rng)
    : [];
  const main = makeBlock('main', CONFIG.roundTargetPerCondition, CONFIG.roundCatchPerCondition, rng);
  return [...practice, ...main].map((t, i) => ({ ...t, trialIndex: i }));
}
