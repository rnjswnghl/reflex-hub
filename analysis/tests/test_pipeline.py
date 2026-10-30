"""분석 파이프라인 점검 (가상 데이터, 임시 폴더에서만 실행).

확인하는 것:
1. 가상 데이터는 --allow-simulated 없이 분석이 거부된다.
2. 효과를 심은 데이터 → '지지', 효과 0인 데이터 → '지지 안 됨'. 판정 규칙이 결과에 맞춰 움직이지 않음을 보인다.
3. 판 단위 제외: 파일럿 판이 정확히 빠진다. 완료율이 시작 기록과 맞는다.
4. 논문 매크로 파일이 생기고 SIMULATED 표시가 켜진다.
5. 유효 시행 정의의 경계 사례: status ok인데 RT 없음, 탭 이탈, 예상 밖 상태, 캐치 시행, 100 ms 경계
6. 판·참가자 제외: 파일럿 판, 수집 기간 밖 판, 미완료 판, 판을 합쳐도 조건별 유효 부족한 참가자.
   한 사람이 여러 판을 하면 판을 합쳐서 기준을 본다.
7. 판정 규칙: 표본 중앙값 > 0 이어도 HL < 0 이고 p < .05이면 일관되게 판정

실행: python3 analysis/tests/test_pipeline.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'analysis'))
import run_analysis as ra  # noqa: E402

PY = sys.executable


def run(*args, check=True):
    return subprocess.run([PY, *args], cwd=ROOT, capture_output=True, text=True, check=check)


def scenario(tmp: Path, effect: float):
    sess, raw, out, paper = tmp / 's', tmp / 'raw', tmp / 'out', tmp / 'paper'
    run('analysis/tests/make_simulated.py', str(sess), '--effect', str(effect))
    run('analysis/build_dataset.py', '--in', str(sess), '--out', str(raw), '--funnel', str(tmp / 's_funnel'))
    refused = run('analysis/run_analysis.py', '--data', str(raw), '--out', str(out), '--paper', str(paper), check=False)
    assert refused.returncode != 0, 'simulated data must be refused by default'
    r = run('analysis/run_analysis.py', '--data', str(raw), '--out', str(out), '--paper', str(paper), '--allow-simulated',
            check=False)
    assert r.returncode == 0, r.stderr
    res = json.loads((out / 'results.json').read_text())
    tex = (paper / 'generated/results.tex').read_text()
    rounds = pd.read_csv(raw / 'rounds.csv')
    return res, tex, rounds


def unit_valid_definition():
    main = pd.DataFrame([
        dict(status='ok', rt_ms=250.0, hidden_during_trial=False, is_catch=False),     # 유효
        dict(status='ok', rt_ms=np.nan, hidden_during_trial=False, is_catch=False),    # RT 없음
        dict(status='ok', rt_ms=250.0, hidden_during_trial=True, is_catch=False),      # 탭·포커스 이탈
        dict(status='weird', rt_ms=250.0, hidden_during_trial=False, is_catch=False),  # 예상 밖 상태
        dict(status='ok', rt_ms=250.0, hidden_during_trial=False, is_catch=True),      # 캐치
        dict(status='ok', rt_ms=99.9, hidden_during_trial=False, is_catch=False),      # 하한 미만
        dict(status='ok', rt_ms=100.0, hidden_during_trial=False, is_catch=False),     # 하한 경계(포함)
        dict(status='ok', rt_ms=1500.1, hidden_during_trial=False, is_catch=False),    # 상한 초과
    ])
    got = ra.is_valid(main, 100).tolist()
    assert got == [True, False, False, False, False, False, True, False], got


def unit_exclusions():
    def rnd(rid, pid, n_main=14, valid_cue=6, **kw):
        meta = dict(round_id=rid, player_id=pid, pilot=False, finished_at='2026-11-03T03:00:00Z',
                    started_at=f'2026-11-03T02:{len(rid):02d}:00Z', saw_cue=None)
        meta.update(kw)
        rows = []
        for c in ('cue', 'nocue'):
            for i in range(6):
                ok = c == 'nocue' or i < valid_cue
                rows.append(dict(round_id=rid, player_id=pid, block='main', condition=c, is_catch=False,
                                 status='ok' if ok else 'timeout', rt_ms=300.0 if ok else np.nan,
                                 hidden_during_trial=False, input_type='touch'))
            rows.append(dict(round_id=rid, player_id=pid, block='main', condition=c, is_catch=True, status='catch_ok',
                             rt_ms=np.nan, hidden_during_trial=False, input_type=None))
        return meta, rows[:n_main]

    specs = [
        rnd('A1', 'A'),                                          # A: 깨끗한 한 판 → 포함
        rnd('B1', 'B', valid_cue=3), rnd('B2', 'B', valid_cue=3),  # B: 판마다 신호 조건 3개뿐이지만 합치면 6 → 포함
        rnd('C1', 'C', valid_cue=4),                             # C: 한 판, 신호 조건 4개 → 제외 (참가자)
        rnd('P1', 'P', pilot=True),                              # 파일럿 판
        rnd('W1', 'W', finished_at='2026-12-25T00:00:00Z'),      # 기간 밖 판
        rnd('I1', 'I', n_main=9),                                # 미완료 판
    ]
    rounds = pd.DataFrame([m for m, _ in specs])
    trials = pd.DataFrame([r for _, rows in specs for r in rows])
    window = {'start': pd.Timestamp('2026-11-02 00:00:00', tz='Asia/Seoul'),
              'end': pd.Timestamp('2026-11-08 23:59:59', tz='Asia/Seoul')}
    _, analyzed, log = ra.apply_exclusions(trials, rounds, window)
    assert sorted(analyzed) == ['A', 'B'], analyzed
    got = {(u, i): r for u, i, r in zip(log['unit'], log['id'], log['reason'])}
    assert got == {('round', 'P1'): 'pilot', ('round', 'W1'): 'outside_window', ('round', 'I1'): 'incomplete',
                   ('player', 'C'): 'too_few_valid_trials'}, got
    # 민감도: 첫 판만 쓰면 B는 신호 조건 3개 → 제외
    _, a_first, _ = ra.apply_exclusions(trials, rounds, window, first_round_only=True)
    assert sorted(a_first) == ['A'], a_first


def unit_verdict_counterexample():
    d = np.array([-100 - i for i in range(10)] + [1 + i for i in range(11)], float)
    pp = pd.DataFrame({'diff': d, 'median_cue': 300 + d, 'median_nocue': 300.0, 'n_valid_cue': 20, 'n_valid_nocue': 20})
    c = ra.confirmatory(pp)
    assert c['diff_median'] > 0 and c['hl_estimate'] < 0 and c['wilcoxon_p_one_sided'] < 0.05
    assert c['supported'] is True


def main():
    unit_valid_definition()
    unit_exclusions()
    unit_verdict_counterexample()
    print('unit checks passed (valid definition, round/player exclusions, verdict rule)')
    with tempfile.TemporaryDirectory() as d:
        res, tex, rounds = scenario(Path(d) / 'a', -20)
        c, f = res['confirmatory'], res['flow']
        assert c['supported'] is True
        n_pilot_rounds = int(rounds['pilot'].astype(str).str.lower().eq('true').sum())
        assert f['excluded_by_reason'].get('pilot') == n_pilot_rounds > 0
        assert f['players_all'] == rounds.loc[~rounds['pilot'].astype(str).str.lower().eq('true'), 'player_id'].nunique()
        assert r'\newcommand{\ResSimulated}{1}' in tex
        comp = res['completion']
        assert comp['n_started'] == f['rounds_all'] + 3 and comp['n_completed_of_started'] == f['rounds_all'], comp
        print(f"effect -20ms  → supported: {c['supported']}  p = {c['wilcoxon_p_one_sided']:.4f}  HL = {c['hl_estimate']:.1f}  "
              f"players {f['analyzed']}/{f['recruited']}, rounds/player median {f['rounds_per_player_median']}")
        print('   sensitivity:', {k: (v.get('n'), v.get('supported')) for k, v in res['sensitivity'].items()})

        res0, _, _ = scenario(Path(d) / 'b', 0)
        print(f"effect   0ms  → supported: {res0['confirmatory']['supported']}  p = {res0['confirmatory']['wilcoxon_p_one_sided']:.4f}")
        assert res0['confirmatory']['supported'] is False
    print('pipeline checks passed')


if __name__ == '__main__':
    main()
