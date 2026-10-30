# 재현 방법 (T10-C46)

이 패키지의 원자료에서 논문의 모든 수치·표·그림을 다시 만드는 절차입니다. 처음 보는 사람이 그대로 따라 할 수 있게 적었습니다.

## 0. 준비

| 필요한 것 | 버전 | 용도 |
|---|---|---|
| Python | 3.10 이상 | 분석 |
| `pip install -r analysis/requirements.txt` | pandas 3.0.5, numpy 2.5.3, scipy 1.18.1, matplotlib 3.11.2 (고정) | 분석 |
| XeLaTeX + BibTeX (TeX Live) | 2022 이상, Noto CJK KR 글꼴 | 논문 PDF |
| poppler-utils (`pdftotext`), `zip` | 아무 버전 | 제출 점검, ZIP 묶기 |
| Node.js | 20 이상 | 실험 페이지 실행·원자료 내려받기 (선택) |
| `pip install playwright && playwright install chromium` | 1.40 이상 | 측정 도구 점검 (선택) |

## 1. 원자료 → 분석용 CSV

```bash
python3 analysis/build_dataset.py
```
- 입력: `data/raw/sessions/**/*.json` — '번개 반사' 한 판 = 파일 1개, 서버에 저장된 그대로
- 출력: `data/raw/trials.csv` (시행 1개 = 1행), `data/raw/rounds.csv` (판 1개 = 1행, `player_id`로 참가자 구분)
- 확인: 판마다 14행, 브라우저의 첫 판은 연습 포함 18행
- 시작 기록: `data/raw/funnel/*.json` → `data/raw/funnel.csv` (완료율 계산용)

## 2. 사전 등록한 분석

```bash
python3 analysis/run_analysis.py
```
- 규칙: `docs/04-preregistration.md` v3 (데이터 수집 전에 고정, `docs/evidence/preregistration-commit.md`)
- 수집 기간: `analysis/collection_window.json` (없으면 분석이 실행되지 않음)
- 출력: `analysis/output/results.json`(모든 수치), `participants.csv`, `exclusions.csv`,
  `paper/generated/*.tex`(논문 수치 매크로·표), `paper/figures/*.pdf`
- 논문 본문의 숫자는 모두 이 매크로에서 옵니다. 손으로 적은 수치는 없습니다.

## 3. 논문 빌드

```bash
bash scripts/build_paper.sh      # → paper/build/main.pdf
```

## 4. 짧은 확인 (T10-C29)

| 무엇을 | 명령 | 기대 결과 |
|---|---|---|
| 실험·서버 단위 시험 | `cd web && npm install && npm test` | 5개 테스트 통과 |
| 분석 파이프라인 | `python3 analysis/tests/test_pipeline.py` | 단위 시험 통과, 효과를 심은 가상 데이터 → 지지, 효과 0 → 지지 안 됨, 가상 데이터는 기본 거부 |
| 측정 도구 | `cd web && npm run build && python3 e2e/system_check.py` | 두 판(18행·14행), 캐치 통과, 경고→목표 500±20 ms, 점등 100 −8/+40 ms, 로봇 RT 250 ms가 +0~40 ms 안, 점검 13개 통과 |
| 제출 점검 | `python3 scripts/check_submission.py` | "제출 가능" |

## 5. 실험 자체를 다시 돌리려면

```bash
cd web && npm install && npm run dev     # http://localhost:5173
```
로컬에서는 저장 API가 없으므로 종료 화면에서 "파일로 받기"로 JSON을 받아 `data/raw/sessions/`에 넣으면 1번부터 그대로 이어집니다.
배포판은 Vercel + Vercel Blob을 씁니다(`web/api/submit.js`). 서버 저장분은 `node scripts/pull_data.mjs`로 내려받습니다.

## 6. 데이터 출처

외부 공개 데이터는 쓰지 않았습니다(T10-C27). 모든 데이터는 이 연구의 실험 페이지에서 직접 수집했습니다.
