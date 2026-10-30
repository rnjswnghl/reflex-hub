"""제출 전 자동 점검. 기계로 확인할 수 있는 통과 기준만 본다(나머지는 docs/CHECKLIST.md에서 사람이 확인).

실행: python3 scripts/check_submission.py
종료 코드 0 = 묶어도 됨, 1 = 고칠 것이 있음.
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'paper'
problems, notes = [], []


def need(cond, msg):
    (notes if cond else problems).append(('OK  ' if cond else 'FAIL') + '  ' + msg)


# --- 원자료 (C25, C26, C47) ---------------------------------------------------------
sessions_dir = ROOT / 'data/raw/sessions'
jsons = list(sessions_dir.rglob('*.json')) if sessions_dir.exists() else []
need(len(jsons) > 0, f'원자료 세션 파일 존재 ({len(jsons)}개)')
trials_csv, sessions_csv = ROOT / 'data/raw/trials.csv', ROOT / 'data/raw/sessions.csv'
need(trials_csv.exists() and sessions_csv.exists(), 'data/raw/trials.csv, sessions.csv 존재')
if trials_csv.exists() and sessions_csv.exists():
    t, s = pd.read_csv(trials_csv), pd.read_csv(sessions_csv)
    sim = s['session_id'].astype(str).str.startswith('SIM').any()
    need(not sim, '가상(SIM) 데이터가 원자료에 섞여 있지 않음')
    per = t.groupby('session_id').size()
    complete = per[per == 46]
    need(len(per) == len(s), f'세션 수 일치: trials.csv {len(per)} / sessions.csv {len(s)}')
    notes.append(f'INFO  완료(46행) 세션 {len(complete)}개, 미완료 {int((per != 46).sum())}개 — 설계상 1인 46행(연습 6 + 본 40)')
    need(len(jsons) >= len(s), f'JSON 파일 수({len(jsons)}) ≥ sessions.csv 행 수({len(s)}) (중복 제거분 차이 허용)')

# --- 분석 결과와 논문 수치 (C31, C40) ----------------------------------------------
res_path = ROOT / 'analysis/output/results.json'
need(res_path.exists(), 'analysis/output/results.json 존재')
if res_path.exists():
    res = json.loads(res_path.read_text())
    need(not res.get('simulated'), 'results.json이 실제 데이터로 생성됨')
gen = P / 'generated/results.tex'
need(gen.exists(), 'paper/generated/results.tex 존재 (결과 대기 상태 아님)')
if gen.exists():
    need(r'\newcommand{\ResSimulated}{0}' in gen.read_text(), '논문 수치가 가상 데이터에서 오지 않음')
for f in ['fig_paired.pdf', 'fig_diff.pdf']:
    need((P / 'figures' / f).exists(), f'그림 {f} 존재')

# --- 미완성 표시 (C50) ---------------------------------------------------------------
tex_files = [P / 'main.tex', P / 'meta.tex', *sorted((P / 'sections').glob('*.tex'))]
for f in tex_files:
    body = '\n'.join(l for l in f.read_text().splitlines() if not l.lstrip().startswith('%'))
    if f.name == 'main.tex':
        body = body.replace(r'\newcommand{\TODO}', '')
        body = re.sub(r'\\ifnum\\ResPending=1.*?\\fi', '', body, flags=re.S)
        body = re.sub(r'\\ifnum\\ResSimulated=1.*?\\fi', '', body, flags=re.S)
    hits = re.findall(r'\\TODO\{|\[대기\]|TBD|XXX|lorem', body)
    need(not hits, f'미완성 표시 없음: {f.relative_to(ROOT)}' + (f' → {len(hits)}곳' if hits else ''))

for rel in ['docs/05-results-notes.md', 'docs/06-ai-and-me.md']:
    f = ROOT / rel
    if f.exists():
        txt = f.read_text()
        empty = re.findall(r'^\|(\s*\|)+\s*$|^- [^:\n]+:\s*$|\(결정 대기', txt, flags=re.M)
        need(not empty, f'빈 칸·결정 대기 없음: {rel}' + (f' → {len(empty)}곳' if empty else ''))

# --- 참고문헌 일관성 (C18, C19) -------------------------------------------------------
bib = (P / 'refs.bib').read_text()
bib_keys = set(re.findall(r'@\w+\{([^,]+),', bib))
cited = set()
for f in tex_files:
    for m in re.findall(r'\\cite[tp]?\*?(?:\[[^\]]*\])*\{([^}]+)\}', f.read_text()):
        cited.update(k.strip() for k in m.split(','))
need(cited <= bib_keys, f'본문 인용이 모두 참고문헌에 있음' + (f' — 누락: {sorted(cited - bib_keys)}' if cited - bib_keys else ''))
need(bib_keys <= cited, f'참고문헌 항목이 모두 본문에서 인용됨' + (f' — 미인용: {sorted(bib_keys - cited)}' if bib_keys - cited else ''))
for entry in re.split(r'\n@', bib):
    if '{' in entry and 'author' in entry:
        key = entry.split('{', 1)[1].split(',', 1)[0]
        need(all(k in entry for k in ('author', 'title', 'year')), f'참고문헌 {key}: 저자·제목·연도')
        need(any(k in entry for k in ('doi', 'url', 'journal')), f'참고문헌 {key}: 출처(학술지/DOI/URL)')

# --- 필수 문서 (C21, C28, C46, C49) -----------------------------------------------
for rel in ['docs/01-hypothesis.md', 'docs/02-literature.md', 'docs/03-design.md', 'docs/04-preregistration.md',
            'docs/05-results-notes.md', 'docs/06-ai-and-me.md', 'docs/CHECKLIST.md', 'REPRODUCE.md',
            'analysis/run_analysis.py', 'analysis/build_dataset.py', 'web/src/experiment/runner.js']:
    need((ROOT / rel).exists(), f'{rel} 존재')
pdf = P / 'build/main.pdf'
need(pdf.exists(), 'paper/build/main.pdf 빌드됨')
if pdf.exists():
    need(pdf.stat().st_mtime >= max(f.stat().st_mtime for f in tex_files + ([gen] if gen.exists() else [])),
         'PDF가 최신 원고로 빌드됨')

print('\n'.join(notes + problems))
print(f'\n{"제출 가능" if not problems else f"고칠 것 {len(problems)}개"}')
sys.exit(1 if problems else 0)
