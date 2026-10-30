// '번개 반사' 게임 = 연구용 반응속도 실험. 데이터 수집 시작 후에는 바꾸지 않는다 (docs/04-preregistration.md).
// 바꿔야 한다면 APP_VERSION을 올리고, 바꾼 이유와 시점을 docs/03-design.md "설계 변경 기록"에 남긴다.
// 1.1.0 (2026-10-30, 수집 전): 독립 검토 반영 — 캐치 시행, 대기시간 조건 간 짝맞춤, 테두리 소등 프레임 예약 등
// 1.2.0 (2026-10-30, 수집 전): 시작 기록과 방문 통계
// 2.0.0 (2026-10-30, 수집 전): 미니게임 허브로 재구성. 4분 1세션 → 약 40초 1판, 여러 판을 사람(브라우저) 단위로 합쳐 분석.
//        대기 표시를 회색 점 → '+'로, 목표를 노란 원으로 바꿔 둘을 혼동하지 않게 함. 순위표용 점수.
export const APP_VERSION = '2.0.0';

export const CONFIG = {
  tutorialTargetPerCondition: 1, // 첫 판에만: 조건별 목표 1회 + 캐치 1회 (분석 제외)
  tutorialCatchPerCondition: 1,
  roundTargetPerCondition: 6,    // 한 판: 조건별 목표 6회
  roundCatchPerCondition: 1,     // 한 판: 조건별 캐치 1회 (원이 나오지 않음, 약 14%)
  preCueMinMs: 800,              // 시행 시작 ~ (가상)경고 시점: 800~2000ms 균등분포
  preCueMaxMs: 2000,
  cueToTargetMs: 500,            // 경고 시점 → 목표 자극: 두 조건 모두 500ms
  cueDurationMs: 100,            // 경고 신호(테두리 점등) 지속 시간
  responseWindowMs: 1500,        // 목표(캐치는 목표가 나왔을 시점) 후 이 시간 안에 반응 없으면 timeout / catch_ok
  feedbackMs: 450,
  itiMs: 350,
  penaltyMs: 100,                // 점수: 미리 누름·캐치 오반응·놓침 1회당 +100ms
  minValidForScore: 6,           // 유효 반응이 이보다 적으면 그 판은 순위에 올리지 않음
};

export const CONDITIONS = { CUE: 'cue', NOCUE: 'nocue' };

export const ROWS_PER_ROUND = 2 * (CONFIG.roundTargetPerCondition + CONFIG.roundCatchPerCondition); // 14
export const ROWS_TUTORIAL = 2 * (CONFIG.tutorialTargetPerCondition + CONFIG.tutorialCatchPerCondition); // 4

// 판 점수(낮을수록 좋음): 유효 반응시간 평균 + 벌점. 서버(api/submit.js)도 같은 식으로 다시 계산한다.
export function roundScore(trials) {
  const main = trials.filter((t) => t.block === 'main');
  const valid = main.filter((t) => !t.is_catch && t.status === 'ok' && t.rt_ms >= 100 && t.rt_ms <= 1500 && !t.hidden_during_trial);
  const misses = main.filter((t) => t.status === 'anticipation' || t.status === 'catch_fa' || t.status === 'timeout').length;
  if (valid.length < CONFIG.minValidForScore) return { score: null, valid: valid.length, misses };
  const mean = valid.reduce((s, t) => s + t.rt_ms, 0) / valid.length;
  return { score: Math.round(mean + CONFIG.penaltyMs * misses), mean: Math.round(mean), valid: valid.length, misses };
}
