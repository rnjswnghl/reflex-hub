# reflex-hub

ALEPH 과제 10 "AI와 함께 쓰는 첫 논문" 저장소. 웹 반응속도 실험(시각 경고 신호 유무 → 단순 반응시간)과 그 논문, 재현 패키지가 들어 있다.

## 구조
- `web/` — 미니게임 허브 (React + Vite, Vercel). 연구용 게임은 `src/games/reaction/`(번개 반사): 시간 측정은 `runner.js`가 DOM을 직접 다룬다. 나머지 게임(`src/games/*.jsx`)은 순위표용. API `api/`: submit(판 저장)·start·score·leaderboard·stats → Vercel Blob
- `analysis/` — `build_dataset.py`(JSON→CSV), `run_analysis.py`(사전 등록 분석, 논문 매크로·그림 생성), `tests/`
- `paper/` — XeLaTeX 원고. 수치는 `generated/results.tex` 매크로로만 들어간다
- `docs/` — 과제 단계별 기록(01 가설 … 06 AI와 나), `CHECKLIST.md`(C01–C51 대응표), `evidence/`
- `scripts/` — `pull_data.mjs`, `build_paper.sh`, `check_submission.py`, `package.sh`

## 반드시 지킬 것
- 참가자 데이터를 만들거나 고치지 않는다. 가상 데이터는 `SIM` 접두사, 점검용으로만 쓴다.
- `docs/04-preregistration.md`와 `analysis/run_analysis.py`의 `PREREG`/`confirmatory()`는 수집 전에 고정했다. 바꾸려면 `paper-pipeline` 스킬의 G2 절차를 따른다.
- `web/src/games/reaction/config.js`는 수집 중에 바꾸지 않는다. 바꾸면 `APP_VERSION`을 올리고 `docs/03-design.md`에 기록한다.
- 논문에 숫자를 손으로 적지 않는다.
- 커밋 작성자는 사용자 본인: `rnjswnghl <rnjswnghl@gmail.com>`.

## 스킬 (`.claude/skills/`)
- `paper-pipeline` — 지금 단계 판단, 무결성 관문, 데이터→분석→논문→묶기
- `cite-verify` — 문헌 추가·수정 전 서지·주장 대조
- `paper-review` — 병렬 서브에이전트 검토단
- `paper-style` — 한국어 문체, LaTeX, 그림 규칙

## 자주 쓰는 명령
```bash
cd web && npm test                         # 실험 파라미터
python3 analysis/tests/test_pipeline.py    # 분석 파이프라인
bash scripts/build_paper.sh                # 논문 PDF
python3 scripts/check_submission.py        # 제출 점검
```
