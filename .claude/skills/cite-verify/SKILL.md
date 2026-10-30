---
name: cite-verify
description: Use before adding, changing, or summarizing any reference in paper/refs.bib or docs/02-literature.md — verifies the paper exists and says what we claim, so no hallucinated citation reaches the paper.
---

# 문헌 확인 (환각 인용 차단)

AI가 기억으로 떠올린 문헌은 **검증 전 자료**다. 아래 절차를 통과한 것만 `refs.bib`에 넣는다.
설계 출처: academic-research-skills의 citation check, alphaxiv 스킬의 "논문 한 편을 원문 기준으로 읽기" 방식.

## 절차

1. **찾기** — `WebSearch`로 `저자 연도 "제목 일부" 학술지` 검색. 셸의 Crossref·arXiv API는 이 환경에서 차단되어 있으므로 시도하지 않는다.
2. **서지 대조** — 출판사·PMC·PubMed·기관 저장소·DOAJ 중 하나를 `WebFetch`로 열어 다음을 원문과 대조한다.
   저자(순서 포함), 연도, 제목, 학술지, 권(호), 쪽 또는 논문 번호, DOI.
   하나라도 다르면 원문 값으로 고친다. 확인 못 한 필드(예: DOI)는 **비워 두고** `02-literature.md`에 "미확인"이라고 적는다. 추측해서 채우지 않는다.
3. **주장 대조** — 이 문헌을 근거로 쓰려는 문장을 원문 초록이나 본문의 실제 문장과 대조한다.
   - 원문 문장을 짧게 인용해 `02-literature.md`의 연결 열에 남긴다.
   - 초록에 없고 기억에만 있는 내용이면 근거로 쓰지 않는다. (실제 사례: Petersen & Posner 2012 초록에는 경고 신호의 반응 단축 언급이 없어 근거를 Weinbach & Henik 2012로 옮겼다.)
   - 숫자(효과 크기, ms, 인원)는 원문에서 직접 본 것만 쓴다.
   - 영어 논문은 AI 번역·요약을 써도 되지만, 숫자와 결론은 원문 문장으로 확인한다.
4. **기록** — `docs/02-literature.md` 표에 한 행 추가:
   `# | 서지 | 확인한 페이지(도메인) | 실험·데이터 연구인가 | 가설의 어느 부분을 뒷받침하나(한 줄)`
5. **탈락 기록** — 존재하지 않거나, 내용이 다르거나, 확인하지 못한 문헌은 지우고 "목록에서 뺀 항목" 표에 이유와 함께 남긴다(C15).
6. **본문 반영** — `\citet{key}` / `\citep{key}`로만 인용한다. 그다음 `python3 scripts/check_submission.py`로 본문 인용과 참고문헌 목록이 양방향으로 맞는지 확인한다.

## 판정 기준

| 상황 | 처리 |
|---|---|
| 검색 결과는 있는데 열 수 있는 페이지가 모두 캡차·로그인 | 다른 저장소(PMC, 대학 리포지토리, DOAJ, 다른 논문의 참고문헌 목록)에서 대조. 그래도 안 되면 탈락 |
| 서지는 맞는데 주장이 원문에 없음 | 문헌은 남기되 연결 문장을 원문에 맞게 고치거나, 그 주장의 근거를 다른 문헌으로 옮김 |
| 프리프린트·수락 원고 | 쓸 수 있지만 표에 "게재본 아님"을 명시 |
| 2차 인용(A가 B를 인용한 것을 보고 B를 인용) | B의 서지만 대조된 상태. "B 원문 직접 확인 못 함"을 명시 |

## 이 레포의 현재 목록
10편, 2026-10-30에 두 번 검증(`docs/02-literature.md` §2차 재검증). 같은 날 다시 검증할 필요는 없고, **새로 추가하거나 연결 문장을 바꿀 때** 이 절차를 쓴다.
