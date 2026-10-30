"""제출 전 자동 점검. 기계로 확인할 수 있는 통과 기준만 본다(나머지는 docs/CHECKLIST.md에서 사람이 확인).

실행: python3 scripts/check_submission.py
종료 코드 0 = 묶어도 됨, 1 = 고칠 것이 있음.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'paper'
ROWS_MAIN, ROWS_TUTORIAL = 14, 4  # 한 판 본 블록 14행, 첫 판에만 연습 4행 (web/src/games/reaction/config.js)
PLACEHOLDER = re.compile(r'\\TODO\{|\[대기\]|TODO:|TBD|XXX|lorem', re.I)
problems, notes = [], []


def need(cond, msg):
    (notes if cond else problems).append(('OK  ' if cond else 'FAIL') + '  ' + msg)


def strip_comments(text):
    return '\n'.join(re.sub(r'(?<!\\)%.*$', '', l) for l in text.splitlines())


# --- 원자료 (C25, C26, C47) ---------------------------------------------------------
sessions_dir = ROOT / 'data/raw/sessions'
jsons = sorted(sessions_dir.rglob('*.json')) if sessions_dir.exists() else []
need(len(jsons) > 0, f'원자료 판 파일 존재 ({len(jsons)}개)')
sim_files, pilot_files = [], []
for j in jsons:
    meta = json.loads(j.read_text(encoding='utf-8')).get('meta', {})
    if str(meta.get('player_id', '')).startswith('SIM'):
        sim_files.append(j.name)
    if meta.get('pilot') is True:
        pilot_files.append(j.name)
need(not sim_files, '원자료 폴더에 가상(SIM) 판 파일 없음' + (f' → {sim_files[:3]}' if sim_files else ''))
need(not pilot_files, '원자료 폴더에 연구자 파일럿 판 없음' + (f' → {pilot_files[:3]}' if pilot_files else ''))

trials_csv, rounds_csv = ROOT / 'data/raw/trials.csv', ROOT / 'data/raw/rounds.csv'
need(trials_csv.exists() and rounds_csv.exists(), 'data/raw/trials.csv, rounds.csv 존재')
if trials_csv.exists() and rounds_csv.exists():
    t, r = pd.read_csv(trials_csv), pd.read_csv(rounds_csv)
    need(not r['player_id'].astype(str).str.startswith('SIM').any(), 'rounds.csv에 가상(SIM) 데이터 없음')
    per = t.groupby('round_id').size()
    need(len(per) == len(r), f'판 수 일치: trials.csv {len(per)} / rounds.csv {len(r)}')
    expect = r.set_index('round_id')['tutorial'].astype(str).str.lower().eq('true').map({True: ROWS_MAIN + ROWS_TUTORIAL, False: ROWS_MAIN})
    bad = (per - expect.reindex(per.index)).ne(0)
    need(not bad.any(), f'모든 판이 설계대로 {ROWS_MAIN}행(첫 판 +{ROWS_TUTORIAL}) (원자료 건수 = 설계, C26)'
         + (f' → 어긋난 판 {int(bad.sum())}개' if bad.any() else ''))
    notes.append(f'INFO  판 {len(r)}개, 참가자 {r["player_id"].nunique()}명')

# --- 분석 결과와 논문 수치 (C31, C40) ----------------------------------------------
res_path = ROOT / 'analysis/output/results.json'
need(res_path.exists(), 'analysis/output/results.json 존재')
if res_path.exists():
    need(not json.loads(res_path.read_text()).get('simulated'), 'results.json이 실제 데이터로 생성됨')
gen = P / 'generated/results.tex'
table = P / 'generated/table_desc.tex'
figs = [P / 'figures/fig_paired.pdf', P / 'figures/fig_diff.pdf']
need(gen.exists(), 'paper/generated/results.tex 존재 (결과 대기 상태 아님)')
if gen.exists():
    need(r'\newcommand{\ResSimulated}{0}' in gen.read_text(), '논문 수치가 가상 데이터에서 오지 않음')
need(table.exists(), 'paper/generated/table_desc.tex(표 2) 존재')
for f in figs:
    need(f.exists(), f'그림 {f.name} 존재')

# --- 미완성 표시: 원고 소스 (C50) ----------------------------------------------------
tex_files = [P / 'main.tex', P / 'meta.tex', *sorted((P / 'sections').glob('*.tex'))]
for f in tex_files:
    body = strip_comments(f.read_text())
    if f.name == 'main.tex':
        # 표시를 '정의'하는 줄과, 대기·가상 상태일 때만 켜지는 경고 상자는 검사 대상이 아니다
        body = '\n'.join(l for l in body.splitlines()
                         if not re.search(r'\\(new|provide)command\{\\(TODO|Pend)\}', l))
        body = re.sub(r'\\ifnum\\Res(Pending|Simulated)=1.*?\\fi', '', body, flags=re.S)
    hits = PLACEHOLDER.findall(body)
    need(not hits, f'미완성 표시 없음: {f.relative_to(ROOT)}' + (f' → {len(hits)}곳' if hits else ''))

# --- 미완성 표시: 빌드된 PDF (C50) — 소스 검사를 빠져나간 것까지 최종 산출물에서 확인
pdf = P / 'build/main.pdf'
need(pdf.exists(), 'paper/build/main.pdf 빌드됨')
if pdf.exists():
    deps = tex_files + [P / 'refs.bib'] + [x for x in [gen, table, *figs] if x.exists()]
    need(pdf.stat().st_mtime >= max(f.stat().st_mtime for f in deps), 'PDF가 최신 원고·참고문헌·그림으로 빌드됨')
    if shutil.which('pdftotext'):
        text = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], capture_output=True, text=True).stdout
        hits = PLACEHOLDER.findall(text) + re.findall(r'SIMULATED|\?\?', text)
        need(not hits, 'PDF 본문에 미완성 표시·가상 표시·깨진 참조(??) 없음' + (f' → {len(hits)}곳' if hits else ''))
    else:
        problems.append('FAIL  pdftotext가 없어 PDF 본문을 검사하지 못함 (poppler-utils 설치)')

# --- 기록 문서의 빈 칸 (C32–C37, C49, C50) ------------------------------------------
def empty_parts(md: str):
    """빈 표 행, 내용 없는 표, 본문 없는 절, '항목:' 뒤가 빈 줄, (결정 대기)를 찾는다."""
    found = []
    found += re.findall(r'^\|(\s*\|)+\s*$', md, flags=re.M)
    found += re.findall(r'^- [^:\n]+:\s*$', md, flags=re.M)
    found += re.findall(r'\(결정 대기', md)
    sections = re.split(r'^#{2,3} ', md, flags=re.M)[1:]
    for sec in sections:
        title, _, body = sec.partition('\n')
        lines = [l for l in body.splitlines() if l.strip() and not re.match(r'^\|[\s\-:|]+\|$', l.strip())]
        table_rows = [l for l in lines if l.lstrip().startswith('|')]
        prose = [l for l in lines if not l.lstrip().startswith('|')]
        if not prose and len(table_rows) <= 1:  # 제목만 있거나, 표 머리글만 있는 절
            found.append(f'빈 절: {title.strip()}')
    return found


for rel in ['docs/05-results-notes.md', 'docs/06-ai-and-me.md']:
    f = ROOT / rel
    if f.exists():
        hits = empty_parts(f.read_text())
        need(not hits, f'빈 칸·결정 대기 없음: {rel}' + (f' → {len(hits)}곳 (예: {hits[0]})' if hits else ''))

# --- 참고문헌 일관성 (C12, C13, C18, C19) --------------------------------------------
bib = (P / 'refs.bib').read_text()
entries = [e for e in re.split(r'\n(?=@)', bib) if e.lstrip().startswith('@')]
bib_keys = set()
for entry in entries:
    key = entry.split('{', 1)[1].split(',', 1)[0].strip()
    bib_keys.add(key)
    need(all(re.search(rf'\b{k}\s*=', entry) for k in ('author', 'title', 'year')), f'참고문헌 {key}: 저자·제목·연도')
    need(any(re.search(rf'\b{k}\s*=', entry) for k in ('doi', 'url', 'journal', 'publisher')),
         f'참고문헌 {key}: 출처(학술지/기관/DOI/URL)')
cited = set()
for f in tex_files:
    for m in re.findall(r'\\cite[tp]?\*?(?:\[[^\]]*\])*\{([^}]+)\}', strip_comments(f.read_text())):
        cited.update(k.strip() for k in m.split(','))
need(cited <= bib_keys, '본문 인용이 모두 참고문헌에 있음' + (f' — 누락: {sorted(cited - bib_keys)}' if cited - bib_keys else ''))
need(bib_keys <= cited, '참고문헌 항목이 모두 본문에서 인용됨' + (f' — 미인용: {sorted(bib_keys - cited)}' if bib_keys - cited else ''))

# --- 수집 기간과 매크로 목록 동기화 ---------------------------------------------------
need((ROOT / 'analysis/collection_window.json').exists(), 'analysis/collection_window.json (수집 기간) 존재')
pend_keys = set(re.findall(r'\\newcommand\{\\(\w+)\}', (P / 'pending.tex').read_text())) - {'Pend'}
if gen.exists():
    gen_keys = set(re.findall(r'\\newcommand\{\\(\w+)\}', gen.read_text()))
    need(pend_keys == gen_keys, 'pending.tex와 분석 매크로 목록 일치'
         + (f' — 차이: {sorted(pend_keys ^ gen_keys)}' if pend_keys != gen_keys else ''))

# --- 필수 문서 (C21, C28, C46, C49) -----------------------------------------------
for rel in ['docs/01-hypothesis.md', 'docs/02-literature.md', 'docs/03-design.md', 'docs/04-preregistration.md',
            'docs/05-results-notes.md', 'docs/06-ai-and-me.md', 'docs/CHECKLIST.md', 'docs/evidence/preregistration-commit.md', 'docs/review/2026-10-30-review.md',
            'REPRODUCE.md', 'analysis/run_analysis.py', 'analysis/build_dataset.py', 'web/src/games/reaction/runner.js']:
    need((ROOT / rel).exists(), f'{rel} 존재')

print('\n'.join(notes + problems))
print(f'\n{"제출 가능" if not problems else f"고칠 것 {len(problems)}개"}')
sys.exit(1 if problems else 0)
