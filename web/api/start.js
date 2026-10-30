import { put } from '@vercel/blob';
import { UUID, readBody } from './_shared.js';

// '번개 반사' 한 판을 시작한 순간을 판당 한 번 기록한다.
// 목적: 시작 대비 완료 비율(세션 단위 완료율)을 보고하고, '지금 플레이 중'을 근사하기 위해. 반응 기록은 담지 않는다.

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
  if (!UUID.test(b?.round_id ?? '') || !UUID.test(b?.player_id ?? '')) return res.status(400).json({ ok: false, error: 'id' });
  if (typeof b.app_version !== 'string' || b.app_version.length > 20) return res.status(400).json({ ok: false, error: 'app_version' });

  const prefix = b.pilot === true ? 'pilot/start' : 'funnel/start';
  const record = {
    round_id: b.round_id,
    player_id: b.player_id,
    app_version: b.app_version,
    started_at: new Date().toISOString(),
    server_commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  };
  try {
    await put(`${prefix}/${b.round_id}__p${b.player_id.slice(0, 8).toLowerCase()}.json`, JSON.stringify(record), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
  } catch (err) {
    if (!/already exists/i.test(String(err?.message))) {
      console.error('start put failed', err);
      return res.status(502).json({ ok: false, error: 'storage_failed' });
    }
  }
  return res.status(200).json({ ok: true });
}
