// 서버 통신. 반응속도 판은 연구 기록(시행 전체)과 함께, 나머지 게임은 점수만 보낸다.

const PENDING_KEY = 'reflexhub.pending.v2';

function safeGet(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 무시 */
  }
}
function safeDel(k) {
  try {
    localStorage.removeItem(k);
  } catch {
    /* 무시 */
  }
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true, // 페이지를 떠나도 요청을 끝까지 보낸다 (본문 64KB 이하)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 반응속도 판: 보내기 전에 브라우저에 먼저 보관 → 실패하거나 창을 닫아도 다음 방문 때 다시 보낸다
export async function submitReactionRound(meta, trials) {
  safeSet(PENDING_KEY, JSON.stringify({ meta, trials }));
  const r = await post('/api/submit', { meta, trials });
  safeDel(PENDING_KEY);
  return r;
}
export async function flushPending() {
  const raw = safeGet(PENDING_KEY);
  if (!raw) return;
  try {
    const { meta, trials } = JSON.parse(raw);
    meta.resent = true;
    await post('/api/submit', { meta, trials });
    safeDel(PENDING_KEY);
  } catch {
    /* 다음 방문에 다시 */
  }
}

export function reportStart(meta) {
  post('/api/start', {
    round_id: meta.round_id,
    player_id: meta.player_id,
    app_version: meta.app_version,
    pilot: meta.pilot,
  }).catch(() => {});
}

export function submitScore({ game, score, playerId, nick, pilot, detail }) {
  return post('/api/score', { game, score, player_id: playerId, nick, pilot, detail });
}

export async function fetchBoard(game) {
  const res = await fetch(`/api/leaderboard?game=${encodeURIComponent(game)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchStats() {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 순위: 다른 플레이어들의 최고 점수 중 내 최고 점수보다 좋은(낮은) 것의 수 + 1
export function myRank(board, playerId, myBest) {
  if (myBest == null || !board) return null;
  const me = playerId.slice(0, 8);
  const others = board.all.filter(([pid]) => pid !== me).map(([, s]) => s);
  const better = others.filter((s) => s < myBest).length;
  const total = others.length + 1;
  // '상위 %'는 5명 이상일 때만 (혼자일 때 '상위 100%' 같은 이상한 표시 방지)
  return { rank: better + 1, total, topPct: total >= 5 ? Math.max(1, Math.ceil(((better + 1) / total) * 100)) : null };
}
