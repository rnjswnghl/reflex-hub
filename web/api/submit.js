import { put } from '@vercel/blob';

// 참가자 1명의 세션(메타 + 시행 기록)을 Vercel Blob에 JSON 파일 1개로 저장한다.
// 세션마다 파일을 따로 쓰므로 동시 제출이 서로 덮어쓰지 않는다.

const MAX_BYTES = 200_000;
const STATUSES = new Set(['ok', 'anticipation', 'timeout']);
const CONDITIONS = new Set(['cue', 'nocue']);
const BLOCKS = new Set(['practice', 'main']);

function validate(body) {
  if (!body || typeof body !== 'object') return 'body';
  const { meta, trials } = body;
  if (!meta || typeof meta.session_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(meta.session_id)) return 'session_id';
  if (typeof meta.app_version !== 'string') return 'app_version';
  if (!Array.isArray(trials) || trials.length < 1 || trials.length > 100) return 'trials';
  for (const t of trials) {
    if (!Number.isInteger(t.trial_index)) return 'trial_index';
    if (!BLOCKS.has(t.block) || !CONDITIONS.has(t.condition) || !STATUSES.has(t.status)) return 'enum';
    if (t.rt_ms !== null && (typeof t.rt_ms !== 'number' || !Number.isFinite(t.rt_ms))) return 'rt_ms';
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ ok: false, error: 'storage_not_configured' });
  }

  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null);
  if (raw.length > MAX_BYTES) return res.status(413).json({ ok: false, error: 'too_large' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'json' });
  }
  const bad = validate(body);
  if (bad) return res.status(400).json({ ok: false, error: `invalid_${bad}` });

  const record = {
    received_at: new Date().toISOString(),
    meta: body.meta,
    trials: body.trials,
  };
  const day = record.received_at.slice(0, 10);

  try {
    await put(`sessions/${day}/${body.meta.session_id}.json`, JSON.stringify(record), {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/json',
    });
  } catch (err) {
    console.error('blob put failed', err);
    return res.status(502).json({ ok: false, error: 'storage_failed' });
  }
  return res.status(200).json({ ok: true, session_id: body.meta.session_id });
}
