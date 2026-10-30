// 실험 파라미터. 데이터 수집 시작 후에는 바꾸지 않는다 (docs/04-preregistration.md 참고).
// 바꿔야 한다면 APP_VERSION을 올리고, 바꾼 이유와 시점을 docs/03-design.md "설계 변경 기록"에 남긴다.
export const APP_VERSION = '1.0.0';

export const CONFIG = {
  practicePerCondition: 3,      // 연습 시행: 조건별 3회 (분석 제외)
  mainPerCondition: 20,         // 본 시행: 조건별 20회 → 1인당 40시행
  preCueMinMs: 1000,            // 시행 시작 ~ (가상)경고 시점: 1000~2500ms 균등분포
  preCueMaxMs: 2500,
  cueToTargetMs: 500,           // 경고 시점 → 목표 자극: 두 조건 모두 500ms
  cueDurationMs: 100,           // 경고 신호(테두리 점등) 지속 시간
  responseWindowMs: 1500,       // 목표 자극 후 이 시간 안에 반응 없으면 timeout
  feedbackMs: 600,
  itiMs: 500,
};

export const CONDITIONS = { CUE: 'cue', NOCUE: 'nocue' };
