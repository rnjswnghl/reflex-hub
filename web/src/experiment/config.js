// 실험 파라미터. 데이터 수집 시작 후에는 바꾸지 않는다 (docs/04-preregistration.md 참고).
// 바꿔야 한다면 APP_VERSION을 올리고, 바꾼 이유와 시점을 docs/03-design.md "설계 변경 기록"에 남긴다.
// 1.1.0 (2026-10-30, 수집 전): 독립 검토 반영 — 캐치 시행, 대기시간 조건 간 짝맞춤, 테두리 소등 프레임 예약 등
export const APP_VERSION = '1.1.0';

export const CONFIG = {
  practicePerCondition: 3,      // 연습 목표 시행: 조건별 3회 (분석 제외)
  practiceCatchPerCondition: 1, // 연습 캐치 시행: 조건별 1회 — "원이 안 나오면 누르지 않는다"를 익히기 위해
  mainPerCondition: 20,         // 본 목표 시행: 조건별 20회
  mainCatchPerCondition: 3,     // 본 캐치 시행: 조건별 3회 (원이 나오지 않음, 약 13%)
  preCueMinMs: 1000,            // 시행 시작 ~ (가상)경고 시점: 1000~2500ms 균등분포
  preCueMaxMs: 2500,
  cueToTargetMs: 500,           // 경고 시점 → 목표 자극: 두 조건 모두 500ms
  cueDurationMs: 100,           // 경고 신호(테두리 점등) 지속 시간. 소등도 프레임에 맞춰 예약하고 실제 값을 기록
  responseWindowMs: 1500,       // 목표(캐치는 목표가 나왔을 시점) 후 이 시간 안에 반응 없으면 timeout / catch_ok
  feedbackMs: 600,
  itiMs: 500,
};

export const CONDITIONS = { CUE: 'cue', NOCUE: 'nocue' };

// 1인당 기록 행 수: 연습 2×(3+1) + 본 2×(20+3)
export const ROWS_PER_SESSION =
  2 * (CONFIG.practicePerCondition + CONFIG.practiceCatchPerCondition) +
  2 * (CONFIG.mainPerCondition + CONFIG.mainCatchPerCondition);
