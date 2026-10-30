import { put } from '@vercel/blob';
import { PREPOST_GAMES, UUID, kstDay, listAll, readBody, validNick } from './_shared.js';

// 전후 비교 실험실(번개 반사 2·3·4). 논문 분석에는 쓰지 않는다.
// POST: 한 판 저장. 파일 이름에 집단(i=개입, c=비교군)과 전·후 중앙값을 넣어 목록 한 번으로 집계한다.
// GET ?game=: 집단별 변화(후 − 전). 한 사람이 여러 판을 하면 그 사람의 평균을 먼저 낸 뒤 사람들끼리 평균한다.
const NAME = /([0-9a-f-]{36})__a([ic])__b(\d+)__f(\d+)__p([0-9a-f]{8})__n(\d+)-(\d+)\.json$/i;
const okMs = (x) => Number.isInteger(x) && x >= 100 && x <= 1500;

function armStats(entries) {
  const byPlayer = new Map();
  for (const e of entries) {
    const d = byPlayer.get(e.pid) ?? [];
    d.push(e.after - e.before);
    byPlayer.set(e.pid, d);
  }
  const means = [...byPlayer.values()].map((d) => d.reduce((a, b) => a + b, 0) / d.length);
  const sorted = means.slice().sort((a, b) => a - b);
  return {
    players: means.length,
    rounds: entries.length,
    mean_diff: means.length ? means.reduce((a, b) => a + b, 0) / means.length : null,
    median_diff: sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null,
  };
}

export default async function handler(req, res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ ok: false, error: 'storage_not_configured' });

  if (req.method === 'GET') {
    const game = String(req.query?.game ?? '');
    if (!PREPOST_GAMES.has(game)) return res.status(400).json({ ok: false, error: 'game' });
    try {
      const entries = (await listAll(`prepost/${game}/`))
        .map((b) => b.pathname.match(NAME))
        .filter(Boolean)
        .map((m) => ({ arm: m[2], before: Number(m[3]), after: Number(m[4]), pid: m[5] }));
      res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=40');
      return res.status(200).json({
        ok: true,
        game,
        arms: { i: armStats(entries.filter((e) => e.arm === 'i')), c: armStats(entries.filter((e) => e.arm === 'c')) },
      });
    } catch (err) {
      console.error('prepost list failed', err);
      return res.status(502).json({ ok: false, error: 'storage_failed' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  let b;
  try {
    b = readBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'json' });
  }
  if (!PREPOST_GAMES.has(b?.game)) return res.status(400).json({ ok: false, error: 'game' });
  if (b.arm !== 'i' && b.arm !== 'c') return res.status(400).json({ ok: false, error: 'arm' });
  if (!okMs(b.before) || !okMs(b.after)) return res.status(400).json({ ok: false, error: 'rt' });
  if (!UUID.test(b.id ?? '') || !UUID.test(b.player_id ?? '')) return res.status(400).json({ ok: false, error: 'id' });
  if (!validNick(b.nick)) return res.status(400).json({ ok: false, error: 'nick' });
  const raw = JSON.stringify(b);
  if (raw.length > 60_000) return res.status(413).json({ ok: false, error: 'too_large' });

  const at = new Date().toISOString();
  const prefix = b.pilot === true ? 'pilot/prepost' : 'prepost';
  const name = `${b.id}__a${b.arm}__b${b.before}__f${b.after}__p${b.player_id.slice(0, 8).toLowerCase()}__n${b.nick[0]}-${b.nick[1]}.json`;
  try {
    await put(`${prefix}/${b.game}/${kstDay(at)}/${name}`, JSON.stringify({ received_at: at, ...b }), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
  } catch (err) {
    if (!/already exists/i.test(String(err?.message))) {
      console.error('prepost put failed', err);
      return res.status(502).json({ ok: false, error: 'storage_failed' });
    }
  }
  return res.status(200).json({ ok: true });
}
