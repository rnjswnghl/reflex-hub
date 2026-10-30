import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSequence } from './sequence.js';
import { CONFIG, ROWS_PER_SESSION } from './config.js';

test('시행 수와 조건·캐치 균형이 설계와 일치한다', () => {
  for (let k = 0; k < 50; k++) {
    const seq = buildSequence();
    assert.equal(seq.length, ROWS_PER_SESSION);
    const main = seq.filter((t) => t.block === 'main');
    for (const c of ['cue', 'nocue']) {
      assert.equal(main.filter((t) => t.condition === c && !t.isCatch).length, CONFIG.mainPerCondition);
      assert.equal(main.filter((t) => t.condition === c && t.isCatch).length, CONFIG.mainCatchPerCondition);
    }
    assert.ok(seq.slice(0, ROWS_PER_SESSION - main.length).every((t) => t.block === 'practice'));
    assert.equal(seq.at(-1).trialIndex, seq.length - 1);
  }
});

test('대기시간은 범위 안이고 두 조건에 같은 값 집합이 배정된다 (짝맞춤)', () => {
  for (let k = 0; k < 50; k++) {
    const seq = buildSequence();
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

test('조건 순서가 참가자마다 달라진다', () => {
  const key = (s) => s.map((t) => t.condition[0] + (t.isCatch ? 'x' : '')).join('');
  assert.notEqual(key(buildSequence()), key(buildSequence()));
});
