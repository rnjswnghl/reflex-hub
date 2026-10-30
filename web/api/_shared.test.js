import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryName, parseEntry, reactionScore } from './_shared.js';
import { roundScore } from '../src/games/reaction/config.js';

test('순위표 파일 이름: 쓰고 다시 읽으면 같은 값', () => {
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const pid = 'ABCDEF12-0000-4000-8000-000000000000';
  const name = entryName(id, 312.4, pid, [3, 15]);
  assert.equal(name, `${id}__s312__pabcdef12__n3-15.json`);
  assert.deepEqual(parseEntry(`sessions/2026-11-01/${name}`), { id, score: 312, pid: 'abcdef12', nick: [3, 15] });
  assert.equal(parseEntry(`sessions/x/${entryName(id, null, pid, [0, 0])}`).score, null);
  assert.equal(parseEntry('sessions/2026-11-01/garbage.json'), null);
});

test('서버 점수 = 클라이언트 점수 (같은 식)', () => {
  const rnd = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const statuses = ['ok', 'ok', 'ok', 'ok', 'anticipation', 'timeout', 'catch_ok', 'catch_fa'];
  for (let k = 0; k < 200; k++) {
    const trials = Array.from({ length: 14 }, () => {
      const status = statuses[rnd(statuses.length)];
      return { block: rnd(5) ? 'main' : 'practice', is_catch: status.startsWith('catch'), status,
        rt_ms: status === 'ok' ? 50 + rnd(1600) + rnd(100) / 100 : null, hidden_during_trial: !rnd(20) };
    });
    assert.equal(reactionScore(trials), roundScore(trials).score);
  }
});
