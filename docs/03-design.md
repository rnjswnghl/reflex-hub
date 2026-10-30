# 3단계 — 실험 설계와 실행

> 과제 안내 3/5 대응: T10-C21 ~ C30

## 설계 표 (C21, C22)

### 바꾼 조건 (독립변수)

| 조건 | 내용 | 본 시행 수 |
|---|---|---|
| 신호 있음 (`cue`) | 목표 자극 500ms 전, 화면 안쪽 테두리 10px가 100ms 동안 밝아짐 | 1인당 20회 |
| 신호 없음 (`nocue`) | 같은 시점에 화면 변화 없음 | 1인당 20회 |

### 고정한 조건 (통제변수)

| 항목 | 값 | 고정한 이유 |
|---|---|---|
| 경고(가상 경고) 시점 → 목표 | 두 조건 모두 500ms | 조건 차이를 "신호의 유무" 하나로 만들기 위해 |
| 시행 시작 → 경고 시점 | 1000–2500ms 균등분포, 두 조건 같은 분포 | 리듬을 외워 미리 누르는 것을 막고, 두 조건의 평균 대기시간을 같게 |
| 목표 자극 | 화면 중앙 흰 원, 지름 120px | 모든 시행 동일 |
| 응답 | 화면 아무 곳 터치·클릭, 또는 Space/Enter | 목표 위치로 손을 옮기는 시간이 반응시간에 섞이지 않도록 |
| 반응 창 | 목표 후 1500ms | 넘으면 놓침(timeout) |
| 시행 순서 | 참가자마다 무작위 (암호학적 난수) | 순서·학습·피로 효과가 한 조건에 몰리지 않도록 |
| 연습 | 조건별 3회, 분석 제외 | 과제 이해 확인 |
| 측정 시각 | 자극: `requestAnimationFrame` 안에서 그린 직후 `performance.now()` / 응답: `pointerdown`·`keydown`의 `event.timeStamp` | `click`은 손을 뗄 때 발생해 불필요한 지연이 섞임 |
| 실험 파라미터 | `web/src/experiment/config.js`, 앱 버전 1.0.0 | 수집 중 변경 금지 |

## 반복 횟수와 표본 수 (C23)

- 반복: 1인당 연습 6회 + 본 시행 40회(조건별 20회) = **46행**
- 표본: 목표 20명 이상. 20명이면 단측 대응 t검정 기준 검정력 .80으로 dz ≈ 0.58 이상의 효과를 잡아낼 수 있다(`analysis/run_analysis.py`의 민감도 계산). 표본 수는 검정력 분석이 아니라 수집 가능 범위(지인·커뮤니티, 1주)로 정했고, 이 사실을 논문 한계에 적는다.

## 측정값 (C24)

시행마다 기록하는 값(원자료 열): `session_id, trial_index, block, condition, precue_planned_ms, cue_target_planned_ms, cue_target_actual_ms, status(ok/anticipation/timeout), rt_ms, input_type(touch/mouse/pen/keyboard), time_source, hidden_during_trial, trial_started_at`

세션마다 기록하는 값: 앱 버전, 재참여 여부, 연령대(선택), 브라우저 정보, 포인터 종류, 화면 크기, 화면 배율, 추정 프레임 간격, 시작·종료 시각.

이름·연락처 등 개인을 식별하는 정보는 받지 않는다.

## 원자료 (C25, C26)

- 서버 저장: 참가자 1명 = JSON 파일 1개 (Vercel Blob, `sessions/<날짜>/<session_id>-*.json`)
- 제출용 원자료: `data/raw/sessions/*.json`(원본 그대로), `data/raw/trials.csv`, `data/raw/sessions.csv`
- 건수 검증: `trials.csv`의 행 수 = 46 × 완료 세션 수. `scripts/check_submission.py`가 자동 확인한다.

## 실행 절차·스크립트 (C28)

| 단계 | 명령 |
|---|---|
| 실험 페이지 | `web/` (React + Vite), 수집 API `web/api/submit.js` |
| 원자료 내려받기 | `node scripts/pull_data.mjs` (Vercel Blob 토큰 필요) |
| 원자료 정리 | `python3 analysis/build_dataset.py` |
| 분석 | `python3 analysis/run_analysis.py` |
| 논문 빌드 | `bash scripts/build_paper.sh` |
| 제출 점검·묶기 | `python3 scripts/check_submission.py`, `bash scripts/package.sh` |

## 짧은 확인 방법 (C29)

1. **측정 도구 점검** — `cd web && npm run build && python3 e2e/system_check.py`
   브라우저 안의 로봇 참가자가 목표가 뜨면 정확히 250ms 뒤에 누른다. 2026-10-30 실행 결과(`docs/evidence/system-check.json`, 데스크톱 Chromium):
   - 행 수 46(연습 6 + 본 40), 조기 반응 1건이 RT 없이 기록됨
   - 경고→목표 실제 간격 499.4–500.3ms (설계 500ms)
   - 기록된 RT 250.2–250.5ms (실제 250ms) → 소프트웨어 측정 오차 1ms 미만
   - 한계: 로봇은 이벤트를 소프트웨어로 발생시키므로 **터치스크린·키보드 하드웨어 지연은 이 점검에 포함되지 않는다**.
2. **분석 점검** — `python3 analysis/tests/test_pipeline.py`
   가상 데이터(효과를 심은 경우·없는 경우)로 판정 규칙이 결과에 맞춰 움직이는지, 가상 데이터가 실제 분석에서 거부되는지 확인한다. 가상 데이터는 제출물에 포함하지 않는다.
3. **실험 파라미터 단위 시험** — `cd web && npm test` (시행 수, 조건 균형, 대기시간 분포)

## 공개 데이터 사용 여부 (C27)

사용하지 않음. 모든 데이터는 이 연구의 실험 페이지에서 직접 수집한다.

## 설계 변경 기록 (C30)

변경이 생기면 바꾸기 전 데이터를 지우지 말고 아래에 날짜·내용·이유를 적는다.

| 날짜 | 변경 | 이유 | 영향받는 데이터 |
|---|---|---|---|
| 2026-10-30 | (설계 확정, 앱 1.0.0) | — | — |
