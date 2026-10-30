import { kstDay, listAll, parseEntry } from './_shared.js';

// 허브의 '지금 N명 플레이 중 · 오늘 N판'과 연구자 현황판(/stats.html)용 집계. 숫자만 내보낸다.
// 목록 조회는 한도가 있는 작업이므로 CDN에 30초 캐시한다 → 누가 몇 번 열어도 원 조회는 30초에 1번 이하.
//
// '지금 플레이 중' = 최근 5분 안에 어떤 게임이든 한 판을 끝낸 플레이어 ∪ 최근 3분 안에 반응속도 판을 시작하고 아직 안 끝낸 플레이어.
// 실시간 접속자를 정확히 세려면 몇 초마다 신호를 보내야 해서, 저장소 한도를 연구 기록 저장과 나눠 쓰게 된다. 그래서 근사한다.

const ACTIVE_DONE_MIN = 5;
const ACTIVE_START_MIN = 3;
const startPid = (p) => (p.match(/__p([0-9a-f]{8})\.json$/i) || [])[1];
const startRound = (p) => p.split('/').pop().slice(0, 36);

const pidOf = (p) => (p.match(/__p([0-9a-f]{8})__/i) || [])[1];

function summarize({ rounds, scores, starts, prepost = [] }, now) {
  const today = kstDay(now);
  const t = now.getTime();
  const plays = [
    ...[...rounds, ...scores].map((b) => ({ ...parseEntry(b.pathname), at: new Date(b.uploadedAt).getTime() })).filter((e) => e.id),
    ...prepost.map((b) => ({ id: b.pathname, pid: pidOf(b.pathname), at: new Date(b.uploadedAt).getTime() })),
  ];
  const roundIds = new Set(rounds.map((b) => parseEntry(b.pathname)?.id).filter(Boolean));

  const active = new Set(plays.filter((e) => t - e.at <= ACTIVE_DONE_MIN * 60e3).map((e) => e.pid));
  for (const b of starts) {
    if (t - new Date(b.uploadedAt).getTime() <= ACTIVE_START_MIN * 60e3 && !roundIds.has(startRound(b.pathname))) active.add(startPid(b.pathname));
  }

  const todays = plays.filter((e) => kstDay(e.at) === today);
  const days = {};
  for (const b of rounds) {
    const d = kstDay(b.uploadedAt);
    days[d] ??= { day: d, reaction_rounds: 0, reaction_players: new Set(), started: 0 };
    days[d].reaction_rounds++;
    days[d].reaction_players.add(parseEntry(b.pathname)?.pid);
  }
  for (const b of starts) {
    const d = kstDay(b.uploadedAt);
    days[d] ??= { day: d, reaction_rounds: 0, reaction_players: new Set(), started: 0 };
    days[d].started++;
  }
  const startIds = new Set(starts.map((b) => startRound(b.pathname)));
  const completedOfStarted = [...startIds].filter((id) => roundIds.has(id)).length;

  return {
    active_now: active.size,
    today_plays: todays.length,
    today_players: new Set(todays.map((e) => e.pid)).size,
    reaction: {
      rounds: rounds.length,
      players: new Set(rounds.map((b) => parseEntry(b.pathname)?.pid)).size,
      started: startIds.size,
      completed_of_started: completedOfStarted,
      completion_rate: startIds.size ? completedOfStarted / startIds.size : null,
    },
    by_day: Object.values(days)
      .map((d) => ({ day: d.day, started: d.started, reaction_rounds: d.reaction_rounds, reaction_players: d.reaction_players.size }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ ok: false, error: 'storage_not_configured' });
  try {
    const now = new Date();
    const [rounds, scores, starts, prepost, pilot] = await Promise.all([
      listAll('sessions/'),
      listAll('scores/'),
      listAll('funnel/start/'),
      listAll('prepost/'),
      listAll('pilot/'),
    ]);
    const pil = (p) => pilot.filter((b) => b.pathname.startsWith(p));
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=30');
    return res.status(200).json({
      ok: true,
      generated_at: now.toISOString(),
      today_kst: kstDay(now),
      ...summarize({ rounds, scores, starts, prepost }, now),
      pilot: summarize({ rounds: pil('pilot/sessions/'), scores: pil('pilot/scores/'), starts: pil('pilot/start/'), prepost: pil('pilot/prepost/') }, now),
    });
  } catch (err) {
    console.error('stats failed', err);
    return res.status(502).json({ ok: false, error: 'storage_failed' });
  }
}
