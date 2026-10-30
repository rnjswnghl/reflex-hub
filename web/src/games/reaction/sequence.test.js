import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRound } from './sequence.js';
import { CONFIG, ROWS_PER_ROUND, ROWS_TUTORIAL, roundScore } from './config.js';

test('한 판의 시행 수와 조건·캐치 균형이 설계와 일치한다', () => {
  for (const tutorial of [false, true]) {
    for (let k = 0; k < 50; k++) {
      const seq = buildRound({ tutorial });
      assert.equal(seq.length, ROWS_PER_ROUND + (tutorial ? ROWS_TUTORIAL : 0));
      const main = seq.filter((t) => t.block === 'main');
      for (const c of ['cue', 'nocue']) {
        assert.equal(main.filter((t) => t.condition === c && !t.isCatch).length, CONFIG.roundTargetPerCondition);
        assert.equal(main.filter((t) => t.condition === c && t.isCatch).length, CONFIG.roundCatchPerCondition);
      }
      assert.ok(seq.slice(0, seq.length - main.length).every((t) => t.block === 'practice'));
      assert.equal(seq.at(-1).trialIndex, seq.length - 1);
    }
  }
});

test('대기시간은 범위 안이고 두 조건에 같은 값 집합이 배정된다 (짝맞춤)', () => {
  for (let k = 0; k < 50; k++) {
    const seq = buildRound({ tutorial: true });
    for (const t of seq) assert.ok(t.preCueMs >= CONFIG.preCueMinMs && t.preCueMs <= CONFIG.preCueMaxMs);
    for (const block of ['practice', 'main']) {
      for (const isCatch of [false, true]) {
        const pick = (c) =>
          seq.filter((t) => t.block === block && t.isCatch === isCatch && t.condition === c).map((t) => t.preCueMs).sort((a, b) => a - b);
        assert.deepEqual(pick('cue'), pick('nocue'));
      }
    }
  }
});

test('판 점수: 유효 평균 + 벌점, 유효가 적으면 순위 제외', () => {
  const ok = (rt) => ({ block: 'main', is_catch: false, status: 'ok', rt_ms: rt, hidden_during_trial: false });
  const trials = [...Array(10)].map(() => ok(300)).concat([{ block: 'main', is_catch: true, status: 'catch_fa' }, { block: 'practice', status: 'anticipation' }]);
  assert.deepEqual(roundScore(trials), { score: 400, mean: 300, valid: 10, misses: 1 });
  assert.equal(roundScore([ok(300), ok(300)]).score, null);
});
