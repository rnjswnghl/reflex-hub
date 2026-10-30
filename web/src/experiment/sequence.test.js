import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSequence } from './sequence.js';
import { CONFIG } from './config.js';

test('시행 수와 조건 균형이 설계와 일치한다', () => {
  for (let k = 0; k < 50; k++) {
    const seq = buildSequence();
    const main = seq.filter((t) => t.block === 'main');
    const practice = seq.filter((t) => t.block === 'practice');
    assert.equal(main.length, CONFIG.mainPerCondition * 2);
    assert.equal(practice.length, CONFIG.practicePerCondition * 2);
    assert.equal(main.filter((t) => t.condition === 'cue').length, CONFIG.mainPerCondition);
    assert.equal(seq.at(-1).trialIndex, seq.length - 1);
  }
});

test('대기시간은 범위 안이고 두 조건이 같은 분포에서 뽑힌다', () => {
  const pre = { cue: [], nocue: [] };
  for (let k = 0; k < 400; k++) {
    for (const t of buildSequence()) {
      assert.ok(t.preCueMs >= CONFIG.preCueMinMs && t.preCueMs <= CONFIG.preCueMaxMs);
      pre[t.condition].push(t.preCueMs);
    }
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  assert.ok(Math.abs(mean(pre.cue) - mean(pre.nocue)) < 30);
});

test('조건 순서가 참가자마다 달라진다', () => {
  const key = (s) => s.map((t) => t.condition[0]).join('');
  assert.notEqual(key(buildSequence()), key(buildSequence()));
});
