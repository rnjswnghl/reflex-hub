import { APP_VERSION, CONFIG } from './config.js';

const DONE_KEY = 'reflexhub.completed.v1';

export function uuid() {
  return globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >>> 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장 불가 환경(시크릿 모드 등)에서는 재참여 여부를 표시하지 못한다 */
  }
}

// 연구자 점검용: 주소에 ?pilot=1 이 있으면 파일럿 세션. 서버는 pilot/ 경로에 따로 저장하고 분석에서 빠진다.
export function isPilot() {
  try {
    return new URLSearchParams(window.location.search).get('pilot') === '1';
  } catch {
    return false;
  }
}

export function previousCompletion() {
  return safeGet(DONE_KEY);
}
export function markCompleted(sessionId) {
  // 파일럿 참여는 재참여 판정에 영향을 주지 않는다 (연구자 기기에서 본 참여를 따로 할 수 있도록)
  if (!isPilot()) safeSet(DONE_KEY, sessionId);
}

// 기기 정보는 분석(입력 방식별 차이)과 품질 점검에만 쓴다. 이름·연락처 등 식별 정보는 받지 않는다.
export function collectMeta({ ageBand, estFrameMs }) {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? null;
  return {
    session_id: uuid(),
    app_version: APP_VERSION,
    pilot: isPilot(),
    config: CONFIG,
    repeat_participation: Boolean(previousCompletion()),
    age_band: ageBand || null,
    user_agent: navigator.userAgent,
    platform: navigator.userAgentData?.platform ?? navigator.platform ?? null,
    pointer_coarse: coarse,
    max_touch_points: navigator.maxTouchPoints ?? null,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dpr: window.devicePixelRatio,
    est_frame_ms: estFrameMs,
    started_at: new Date().toISOString(),
    finished_at: null,
  };
}

export function median(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// 참가자에게 보여주는 개인 결과. 분석용 제외 기준과 동일하게 100~1500ms 정상 반응만 쓴다.
export function personalSummary(trials) {
  const ok = (c) =>
    trials
      .filter((t) => t.block === 'main' && t.condition === c && t.status === 'ok' && t.rt_ms >= 100)
      .map((t) => t.rt_ms);
  const cue = median(ok('cue'));
  const nocue = median(ok('nocue'));
  return { cue, nocue, diff: cue != null && nocue != null ? cue - nocue : null };
}

const COLS = [
  'session_id', 'trial_index', 'block', 'condition', 'precue_planned_ms', 'cue_target_planned_ms',
  'cue_target_actual_ms', 'status', 'rt_ms', 'input_type', 'time_source', 'hidden_during_trial',
  'trial_started_at',
];

export function toCsv(meta, trials) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [COLS.join(',')];
  for (const t of trials) lines.push(COLS.map((c) => esc(c === 'session_id' ? meta.session_id : t[c])).join(','));
  return lines.join('\n');
}

export function downloadBackup(meta, trials) {
  const blob = new Blob([JSON.stringify({ meta, trials }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reflexhub-${meta.session_id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function submit(meta, trials) {
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meta, trials }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
