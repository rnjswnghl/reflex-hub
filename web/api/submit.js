import { put } from '@vercel/blob';
import { UUID, entryName, kstDay, reactionScore, readBody, validNick } from './_shared.js';

// '번개 반사' 한 판(메타 + 시행 기록 전체)을 Vercel Blob에 JSON 파일 1개로 저장한다. 연구 원자료이자 순위표 기록.
// 판마다 파일을 따로 쓰므로 동시 제출이 서로 덮어쓰지 않고, 같은 판을 다시 보내면 첫 기록만 남는다.

const MAX_BYTES = 120_000;
const STATUSES = new Set(['ok', 'anticipation', 'timeout', 'catch_ok', 'catch_fa']);
const CONDITIONS = new Set(['cue', 'nocue']);
const BLOCKS = new Set(['practice', 'main']);

function validate(body) {
  if (!body || typeof body !== 'object') return 'body';
  const { meta, trials } = body;
  if (!meta || !UUID.test(meta.round_id ?? '')) return 'round_id';
  if (!UUID.test(meta.player_id ?? '')) return 'player_id';
  if (!validNick(meta.nick)) return 'nick';
  if (typeof meta.app_version !== 'string') return 'app_version';
  if (!Array.isArray(trials) || trials.length < 1 || trials.length > 40) return 'trials';
  for (const t of trials) {
    if (!Number.isInteger(t.trial_index)) return 'trial_index';
    if (!BLOCKS.has(t.block) || !CONDITIONS.has(t.condition) || !STATUSES.has(t.status)) return 'enum';
    if (typeof t.is_catch !== 'boolean') return 'is_catch';
    if (t.rt_ms !== null && (typeof t.rt_ms !== 'number' || !Number.isFinite(t.rt_ms))) return 'rt_ms';
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ ok: false, error: 'storage_not_configured' });

  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null);
  if (raw.length > MAX_BYTES) return res.status(413).json({ ok: false, error: 'too_large' });
  let body;
  try {
    body = readBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'json' });
  }
  const bad = validate(body);
  if (bad) return res.status(400).json({ ok: false, error: `invalid_${bad}` });

  const { meta, trials } = body;
  const score = reactionScore(trials);
  const record = {
    received_at: new Date().toISOString(),
    server_commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null, // 어떤 코드로 수집했는지
    server_score: score,
    meta,
    trials,
  };
  // 연구자 파일럿(?pilot=1)은 별도 경로 → 분석·순위표 제외
  const prefix = meta.pilot === true ? 'pilot/sessions' : 'sessions';
  const path = `${prefix}/${kstDay(record.received_at)}/${entryName(meta.round_id, score, meta.player_id, meta.nick)}`;
  try {
    await put(path, JSON.stringify(record), { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
  } catch (err) {
    if (!/already exists/i.test(String(err?.message))) {
      console.error('blob put failed', err);
      return res.status(502).json({ ok: false, error: 'storage_failed' });
    }
  }
  return res.status(200).json({ ok: true, score });
}
