---
name: paper-pipeline
description: Use when moving the reflex-hub T10 paper forward — deciding what stage it is in, running data → analysis → paper → package, or finishing the results/discussion after data collection. Enforces the integrity gates (no fabricated data, preregistration locked, no hand-typed numbers).
---

# 논문 파이프라인 (reflex-hub · 과제 10)

가설 → 근거 → 실험 → 해석 → 묶기의 5단계를 순서대로 진행하고, 각 단계 사이에 **넘으면 안 되는 관문**을 둔다.
설계 출처: academic-research-skills(Imbad0202)의 "생략 불가 무결성 관문 + 사람 확인 지점" 구조를 이 과제 규모로 줄였다.

## 0. 지금 어느 단계인가 — 먼저 확인

```bash
git log --oneline | head -5
ls data/raw/sessions 2>/dev/null | head; test -f paper/generated/results.tex && echo RESULTS || echo PENDING
python3 scripts/check_submission.py | tail -15
```

| 상태 | 다음 할 일 |
|---|---|
| 세션 파일 없음 | 수집 중. **분석하지 않는다.** 건수만 센다 |
| 세션 파일 있음 + PENDING | 수집 종료일(D0+6일)이 지났는지 사용자에게 확인 → 3단계 |
| RESULTS + `\TODO` 남음 | 4단계(해석 작성) |
| check_submission 통과 | 5단계(묶기) |

## 1. 무결성 관문 (어떤 이유로도 생략하지 않는다)

**G1 — 데이터 날조 금지.** 참가자 데이터를 만들거나, 고치거나, 지우지 않는다. 가상 데이터(`SIM` 접두사)는 파이프라인 점검용이며 `--allow-simulated` 없이는 분석이 거부된다. 제출물에 넣지 않는다.

**G2 — 사전 등록 잠금.** `docs/04-preregistration.md`와 `analysis/run_analysis.py`의 `PREREG`·`confirmatory()`는 수집 전에 고정되었다. 결과를 본 뒤 제외 기준, 검정, 판정 규칙을 바꾸지 않는다. 꼭 바꿔야 하면:
1. 바꾸기 전 결과를 그대로 보존하고
2. `docs/03-design.md` 설계 변경 기록에 날짜·이유를 적고
3. 논문에 두 결과를 모두 보고하고 "사전 계획에 없던 분석"으로 표시한다.

**G3 — 손으로 적은 숫자 금지.** 논문의 모든 수치는 `paper/generated/results.tex` 매크로(`\DiffMedian` 등)로만 넣는다. 새 수치가 필요하면 `run_analysis.py`의 `write_tex()`에 매크로를 추가한다.

**G4 — 확인하지 않은 문헌 금지.** 새 문헌은 `cite-verify` 스킬 절차를 통과해야 `refs.bib`에 들어간다.

**G5 — 원자료 불변.** `data/raw/sessions/*.json`은 수정하지 않는다. `pull_data.mjs`는 덮어쓰지 않는다.

## 2. 단계별 실행

### 수집 (사람이 운영)
- 링크 공유일 = D0. 사용자에게 날짜를 받아 `docs/03-design.md` 설계 변경 기록과 `docs/05-results-notes.md` 수집 현황에 적는다.
- 건수 확인만: `node scripts/pull_data.mjs && find data/raw/sessions -name '*.json' | wc -l`

### 분석 (수집 종료 후 한 번)
```bash
node scripts/pull_data.mjs                 # BLOB_READ_WRITE_TOKEN 필요
python3 analysis/build_dataset.py
python3 analysis/run_analysis.py           # 확증 판정이 여기서 결정된다
bash scripts/build_paper.sh
```
판정(`supported`)이 어느 쪽이든 그대로 쓴다. "지지되지 않음"도 완성된 결론이다.

### 해석 작성 — 사람 확인 지점 ★
`paper/sections/03-results.tex`, `04-discussion.tex`의 `\TODO`를 채운다. 순서:
1. 그림 2개와 `participants.csv`를 먼저 본다. 반대 방향 참가자 수와 크기를 센다.
2. `docs/05-results-notes.md`에 가설대로/다르게 나온 부분을 나눠 적는다.
3. 다르게 나온 이유는 논의 4.2에 미리 적어 둔 후보 4개부터, 원자료로 확인 가능한 것만 확인한다. 확인하지 못한 것은 "확인하지 못함"이라고 쓴다.
4. 결론 문단 초안을 쓰고 **사용자에게 보여 준다.** 해석과 결론은 사용자의 판단이다(C49). 사용자가 승인하기 전에는 `\TODO`를 지우지 않는다.
5. `paper-review` 스킬로 검토단을 돌리고, 지적 사항의 수용/거절을 사용자와 정한다.

### 묶기
```bash
python3 scripts/check_submission.py        # 모두 OK여야 함
bash scripts/package.sh                    # submission/reflex-hub-T10.zip
```
`docs/06-ai-and-me.md`의 `(결정 대기)`는 사용자가 자기 말로 채운다. AI가 대신 쓰지 않는다.

## 3. 커밋 규칙
- 작성자는 사용자 본인: `git -c user.name=rnjswnghl -c user.email=rnjswnghl@gmail.com commit ...`
- 사전 등록 파일을 건드린 커밋은 메시지에 `[prereg-change]`를 붙인다.
- 원자료는 내려받은 날 그대로 별도 커밋한다(`data: pull YYYY-MM-DD, N sessions`).
