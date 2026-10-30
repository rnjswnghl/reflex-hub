# Reflex Hub — 미리 주는 화면 신호는 반응을 빠르게 하는가

ALEPH 과제 10 "AI와 함께 쓰는 첫 논문"의 저장소입니다. 웹 반응속도 실험 페이지, 사전 등록한 분석 코드, 논문 원고, 재현 패키지가 한곳에 있습니다.

> **가설** — 목표 자극이 나타나기 500 ms 전에 화면 테두리가 100 ms 동안 밝아지는 시각 경고 신호가 있으면, 신호가 없을 때보다 같은 참가자의 단순 반응시간이 짧아진다.

## 실험 참여

- 미니게임: https://reflex-hub.vercel.app (로그인 없음)
  - 기록 도전: 번개 반사·컬러 함정·1→16·딱 N초(1·3·5·10초)
  - 전후 비교 실험실: 번개 반사 2 초록 쉼표·3 숨 고르기·4 손가락 예열 (무작위 비교군과 견줌)
  - 연구 데이터는 '번개 반사'에서만 나온다. 나머지 게임 기록은 순위표·비교 화면에만 쓴다.
- 수집 현황: https://reflex-hub.vercel.app/stats.html (오늘 시작·완료, 지금 진행 중, 완료율 — 숫자만, 30초 갱신)

## 진행 상황

| 단계 | 상태 | 문서 |
|---|---|---|
| 1. 질문을 가설로 | 완료 | [docs/01-hypothesis.md](docs/01-hypothesis.md) |
| 2. 논거 세우기 | 완료 (문헌 10편, 2회 검증) | [docs/02-literature.md](docs/02-literature.md) |
| 3. 실험 설계와 실행 | 설계·점검·독립 검토 완료(앱 2.0.0, 사전 등록 v3), **데이터 수집 대기** | [docs/03-design.md](docs/03-design.md), [사전 등록](docs/04-preregistration.md), [검토](docs/review/2026-10-30-review.md) |
| 4. 결과 해석 | 수집 후 | [docs/05-results-notes.md](docs/05-results-notes.md) |
| 5. 논문으로 묶기 | 원고 초안 완료, 결과 절 대기 | [paper/](paper/), [CHECKLIST](docs/CHECKLIST.md) |

## 구조

```
web/        미니게임 허브 (React + Vite) + API: 판 저장·점수·순위표·현황 (Vercel Blob)
analysis/   원자료 정리·사전 등록 분석·그림 생성 (Python)
paper/      논문 (XeLaTeX). 수치는 분석 스크립트가 만든 매크로로만 들어감
docs/       단계별 기록, 문헌 검증, 사전 등록, AI와 나의 판단, 통과 기준 대응표
scripts/    데이터 내려받기, 논문 빌드, 제출 점검, ZIP 묶기
.claude/    논문 작업용 Claude 스킬 (pipeline, cite-verify, review, style)
```

재현 방법은 [REPRODUCE.md](REPRODUCE.md)에 있습니다.
