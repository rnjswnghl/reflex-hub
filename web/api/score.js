import { put } from '@vercel/blob';
import { UUID, entryName, kstDay, readBody, validNick } from './_shared.js';

// 연구와 무관한 미니게임(컬러 함정, 1→16, 딱 1초)의 점수. 순위표에만 쓴다.
// 점수 범위가 말이 안 되는 값은 거른다(낮을수록 좋음, ms).
const RANGE = { stroop: [2500, 300_000], schulte: [2500, 300_000], timing: [0, 5_000] };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ ok: false, error: 'storage_not_configured' });
  let b;
  try {
    b = readBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'json' });
  }
  const range = RANGE[b?.game];
  if (!range) return res.status(400).json({ ok: false, error: 'game' });
  if (!Number.isFinite(b.score) || b.score < range[0] || b.score > range[1]) return res.status(400).json({ ok: false, error: 'score' });
  if (!UUID.test(b.player_id ?? '')) return res.status(400).json({ ok: false, error: 'player_id' });
  if (!validNick(b.nick)) return res.status(400).json({ ok: false, error: 'nick' });

  const id = globalThis.crypto.randomUUID();
  const at = new Date().toISOString();
  const prefix = b.pilot === true ? 'pilot/scores' : 'scores';
  const path = `${prefix}/${b.game}/${kstDay(at)}/${entryName(id, b.score, b.player_id, b.nick)}`;
  const detail = JSON.stringify(b.detail ?? null).length < 2000 ? b.detail ?? null : null;
  try {
    await put(path, JSON.stringify({ game: b.game, score: Math.round(b.score), at, detail }), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
  } catch (err) {
    console.error('score put failed', err);
    return res.status(502).json({ ok: false, error: 'storage_failed' });
  }
  return res.status(200).json({ ok: true });
}
