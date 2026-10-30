import { APP_VERSION, CONFIG } from './config.js';

const DONE_KEY = 'reflexhub.completed.v1';
const STARTED_KEY = 'reflexhub.started.v1';
const PENDING_KEY = 'reflexhub.pending.v1';

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
    /* 저장 불가 환경(시크릿 모드 등)에서는 재참여 여부·미전송 기록을 남기지 못한다 */
  }
}
function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 무시 */
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
export function markStarted(sessionId) {
  if (!isPilot()) safeSet(STARTED_KEY, sessionId);
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
    repeat_participation: Boolean(previousCompletion()), // 같은 브라우저에서 이미 '완료'한 적 있음 → 분석 제외
    prior_start: Boolean(safeGet(STARTED_KEY)),          // 시작만 하고 그만둔 적 있음 → 기록만 (제외 아님)
    age_band: ageBand || null,
    saw_cue: null, // 종료 후 조작 점검 문항: yes / no / unsure
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

// 참가자에게 보여주는 개인 결과. 조건별 비교는 보여주지 않는다:
// 지인 표본에서 결과 화면·공유 문구가 가설을 알려 주면 뒤에 참여하는 사람의 반응이 오염된다.
export function personalSummary(trials) {
  const rts = trials
    .filter((t) => t.block === 'main' && !t.is_catch && t.status === 'ok' && t.rt_ms >= 100)
    .map((t) => t.rt_ms);
  return { median: median(rts), best: rts.length ? Math.min(...rts) : null, n: rts.length };
}

export function downloadBackup(meta, trials) {
  const blob = new Blob([JSON.stringify({ meta, trials }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reflexhub-${meta.session_id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 전송 전에 먼저 브라우저에 보관한다. 전송 중 창을 닫아도 다음 방문 때 다시 보낸다.
export function savePending(meta, trials) {
  safeSet(PENDING_KEY, JSON.stringify({ meta, trials }));
}

export async function submit(meta, trials) {
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meta, trials }),
    keepalive: true, // 페이지를 떠나도 요청을 끝까지 보낸다 (본문 64KB 이하)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  safeRemove(PENDING_KEY);
  return res.json();
}

// 앞선 방문에서 보내지 못한 기록이 있으면 조용히 다시 보낸다.
export async function flushPending() {
  const raw = safeGet(PENDING_KEY);
  if (!raw) return;
  try {
    const { meta, trials } = JSON.parse(raw);
    meta.resent = true;
    await submit(meta, trials);
  } catch {
    /* 다음 방문에 다시 시도 */
  }
}
