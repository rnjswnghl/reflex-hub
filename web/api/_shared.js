// API 공용 함수. 파일명이 '_'로 시작하므로 Vercel이 엔드포인트로 노출하지 않는다.
import { list } from '@vercel/blob';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const KST_MS = 9 * 3600 * 1000;
export const kstDay = (d) => new Date(new Date(d).getTime() + KST_MS).toISOString().slice(0, 10);

export function readBody(req) {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

export function validNick(n) {
  return Array.isArray(n) && n.length === 2 && n.every((x) => Number.isInteger(x) && x >= 0 && x < 16);
}

// 순위표용 정보를 파일 이름에 넣는다 → 목록 조회 한 번으로 점수를 모을 수 있다 (파일을 하나씩 열지 않음)
// 형식: <id>__s<점수|x>__p<플레이어 앞 8자>__n<형용사>-<동물>.json
export function entryName(id, score, playerId, nick) {
  const s = score == null ? 'x' : String(Math.round(score));
  return `${id}__s${s}__p${playerId.slice(0, 8).toLowerCase()}__n${nick[0]}-${nick[1]}.json`;
}
const ENTRY = /([0-9a-f-]{36})__s(\d+|x)__p([0-9a-f]{8})__n(\d+)-(\d+)\.json$/i;
export function parseEntry(pathname) {
  const m = pathname.match(ENTRY);
  if (!m) return null;
  return { id: m[1], score: m[2] === 'x' ? null : Number(m[2]), pid: m[3], nick: [Number(m[4]), Number(m[5])] };
}

export async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

// 반응속도 판 점수 — web/src/games/reaction/config.js의 roundScore와 같은 식 (서버가 다시 계산해 조작을 막는다)
export function reactionScore(trials, { penaltyMs = 100, minValid = 6 } = {}) {
  const main = trials.filter((t) => t.block === 'main');
  const valid = main.filter((t) => !t.is_catch && t.status === 'ok' && t.rt_ms >= 100 && t.rt_ms <= 1500 && !t.hidden_during_trial);
  const misses = main.filter((t) => t.status === 'anticipation' || t.status === 'catch_fa' || t.status === 'timeout').length;
  if (valid.length < minValid) return null;
  return Math.round(valid.reduce((s, t) => s + t.rt_ms, 0) / valid.length + penaltyMs * misses);
}

export const TIMING_TARGETS = [1, 3, 5, 10];
export const GAME_PREFIX = {
  reaction: 'sessions/',
  stroop: 'scores/stroop/',
  schulte: 'scores/schulte/',
  ...Object.fromEntries(TIMING_TARGETS.map((t) => [`timing-${t}`, `scores/timing-${t}/`])),
};
export const PREPOST_GAMES = new Set(['green', 'breath', 'warmup']);
