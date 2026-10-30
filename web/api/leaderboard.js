import { GAME_PREFIX, listAll, parseEntry } from './_shared.js';

// 게임별 순위표: 플레이어마다 최고 점수(가장 낮은 값) 하나. 개인 기록 내용은 내보내지 않는다.
// 목록 조회는 한도가 있는 작업이므로 CDN에 20초 캐시한다.
export default async function handler(req, res) {
  const game = String(req.query?.game ?? '');
  const prefix = GAME_PREFIX[game];
  if (!prefix) return res.status(400).json({ ok: false, error: 'game' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ ok: false, error: 'storage_not_configured' });
  try {
    const best = new Map();
    for (const b of await listAll(prefix)) {
      const e = parseEntry(b.pathname);
      if (!e || e.score == null) continue;
      const cur = best.get(e.pid);
      if (!cur || e.score < cur[1]) best.set(e.pid, [e.pid, e.score, e.nick]);
    }
    const all = [...best.values()].sort((a, b) => a[1] - b[1]).slice(0, 2000);
    res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=40');
    return res.status(200).json({ ok: true, game, players: best.size, all });
  } catch (err) {
    console.error('leaderboard failed', err);
    return res.status(502).json({ ok: false, error: 'storage_failed' });
  }
}
