---
name: paper-review
description: Use when the reflex-hub paper draft (or its results/discussion) needs an independent critique before submission — runs a parallel panel of reviewer subagents (methods, statistics, devil's advocate, assignment-criteria auditor) and merges their findings into docs/review/.
---

# 병렬 검토단

원고를 쓴 에이전트가 자기 원고를 채점하지 않도록, **원고를 쓰는 과정을 보지 않은 서브에이전트들**이 동시에 검토한다.
설계 출처: academic-research-skills의 academic-paper-reviewer(편집장 + 검토자 + 반론자, 반론자의 양보 기준).
병렬 실행은 Claude Code의 Agent 도구로 한 메시지에 여러 개를 띄우는 방식을 쓴다.

## 언제 쓰나
- 원고 초안이 처음 빌드되었을 때 (방법·서론 검토)
- 데이터 분석 후 결과·논의를 쓴 직후 (해석 검토) ← 가장 중요
- 사용자가 "검토해 줘"라고 할 때

## 실행

1. `bash scripts/build_paper.sh`로 최신 PDF를 만든다.
2. **한 메시지에서** 아래 검토자 4명을 `Agent`(subagent_type: general-purpose)로 동시에 띄운다. 각 프롬프트에는 다음을 넣는다.
   - 레포 경로 `/home/claude/reflex-hub`
   - 읽을 파일: `paper/sections/*.tex`, `paper/generated/results.tex`(있으면), `docs/01~04`, `analysis/run_analysis.py`, `web/src/experiment/*.js`
   - 역할 설명과 출력 형식
   - "파일을 수정하지 말고 보고서만 돌려줄 것"

| 검토자 | 보는 것 |
|---|---|
| **R1 방법론** | 설계가 가설을 실제로 검증하는가. 혼입 변수(조건 간 차이가 신호 하나뿐인가), 측정 코드가 문서와 일치하는가(`runner.js` vs 논문 2절), 재현 가능성 |
| **R2 통계** | 사전 등록과 `run_analysis.py`가 일치하는가, 검정 선택과 가정, 단측 검정의 정당성, 다중 비교, 효과크기·신뢰구간 보고, 결과 문장이 숫자 이상을 주장하지 않는가 |
| **R3 반론자** | 결론을 무너뜨리는 가장 강한 대안 설명 3개, 과장된 문장, 원자료에 없는 주장(C40), 숨겨진 연구자 자유도 |
| **R4 과제 기준 감사** | `docs/CHECKLIST.md`의 C01–C51을 실제 파일과 하나씩 대조. 표시만 ✅이고 실제로 없는 항목을 찾는다 |

출력 형식(각 검토자 공통):
```
## 판정: 수용 / 경미 수정 / 대폭 수정 / 거절 (점수 0–100)
## 반드시 고칠 것 (근거: 파일:줄 또는 원문 인용)
## 고치면 좋은 것
## 이미 잘 된 것 (1–3개)
```

3. **편집장 역할은 메인 에이전트가 맡는다.** 네 보고서를 합쳐 `docs/review/YYYY-MM-DD-review.md`를 쓴다:
   - 지적마다 ID(R1-1 …), 심각도, 근거, 제안 처리(수용/거절/사용자 결정)
   - 검토자 간 의견이 갈리면 둘 다 적는다
4. **반론자 양보 규칙**: R3의 지적을 거절하려면 반박 근거를 적고 1–5점으로 스스로 채점한다. 4점 미만이면 거절하지 않고 원고에 한계로 반영한다. (지적에 무조건 굴복하는 것도, 무조건 버티는 것도 막기 위한 장치)
5. **사람 확인 지점**: 수용/거절 목록을 사용자에게 보여 주고 결정을 받는다. 결과는 `docs/06-ai-and-me.md` 3줄의 3번째 줄 재료가 된다.
6. 수용한 항목만 고친다. 고친 뒤 `scripts/check_submission.py`를 다시 돌린다.

## 하지 말 것
- 검토자에게 결과를 "더 좋게" 만드는 방향의 분석 변경을 요청하지 않는다(G2 사전 등록 잠금).
- 검토자 보고서의 문장을 원고에 그대로 붙이지 않는다.
