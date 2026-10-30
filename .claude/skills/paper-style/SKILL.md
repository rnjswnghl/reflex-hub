---
name: paper-style
description: Use when writing or editing Korean prose in paper/sections/*.tex or making figures in analysis/run_analysis.py — house style for sentences, claims, LaTeX conventions, and figure rules for the reflex-hub paper.
---

# 문체와 그림 규칙

설계 출처: nature-skills(Yuan1z0825)의 nature-polishing(짧은 문장, 절제된 학술 어조)과 nature-figure(그림 규칙)를 한국어 학부 과제 논문에 맞게 줄였다.

## 문장
- 한 문장에 주장 하나. 한국어 기준 대략 60자 안팎에서 끊는다. LaTeX 소스는 **한 문장 = 한 줄**로 써서 diff를 읽기 쉽게 한다.
- 문장은 평서형(`~다`)으로 쓴다. 번역투 피동(`~되어진다`, `~에 의해`)과 군더더기(`~하는 것이다`, `다양한`, `매우`)를 빼고, 주어를 분명히 한다.
- 인과는 설계가 허락하는 만큼만 말한다. 무작위 배정한 경고 신호 → 반응시간까지 인과로 쓸 수 있다. 각성이냐 시간 예측이냐 같은 메커니즘은 "말할 수 없다"고 쓴다.
- "유의미하게", "증명했다", "확실히"는 쓰지 않는다. 판정은 사전 규칙의 말("지지되었다 / 지지되지 않았다")로만 한다.
- p ≥ .05를 "효과가 없다"로 쓰지 않는다. "이 표본으로 확인하지 못했다" + 최소 검출 효과크기를 쓴다.
- 기존 문헌의 사실과 이 연구의 주장을 문장 단위로 구분한다. 문헌 사실에는 인용을 달고, 이 연구의 주장에는 "이 연구는" 같은 주어를 쓴다.
- 영어 용어는 처음 한 번만 괄호로 병기한다. 예: 각성(alerting).

## LaTeX
- 수치는 매크로로만 쓴다(`\DiffMedian`, `\Wp` …). 단위는 `\,ms`로 붙인다.
- 인용은 natbib: 문장 주어면 `\citet{}`, 괄호면 `\citep{}`.
- 아직 쓸 수 없는 문단은 `\TODO{무엇을, 어떤 기준으로}`로 남긴다. 제출 점검이 이 표시를 잡는다. `[대기]`나 빈 칸을 몰래 남기지 않는다.
- 새 절은 `paper/sections/`에 파일로 추가하고 `main.tex`에서 `\input`한다.

## 그림 (`analysis/run_analysis.py`의 `plot()`)
- 개별 참가자를 항상 보여 준다(점·선). 평균 막대 하나만 있는 그림은 반대 방향 참가자를 숨긴다(C35).
- 패널 두 개가 같은 질문에 답하지 않게 한다. 지금 구성: ① 조건별 값(대응 연결) ② 차이 분포와 CI.
- 색은 조건 두 개에만 쓴다(신호 있음 = 파랑 `#2a78d6`, 없음 = 주황 `#eb6834`). 나머지는 회색과 검정만 쓴다.
- 글꼴은 Noto Sans CJK KR, 9 pt, `pdf.fonttype=42`. 위·오른쪽 축선은 없앤다.
- PDF(논문용)와 200 dpi PNG(미리보기)를 함께 저장한다.
- 그림 캡션만 읽어도 무엇을 보는지, 어느 쪽이 가설 방향인지 알 수 있게 쓴다.
- 가상 데이터로 그린 그림에는 `SIMULATED` 워터마크가 자동으로 붙는다. 지우지 않는다.
