"""분석 파이프라인 점검 (가상 데이터, 임시 폴더에서만 실행).

확인하는 것:
1. 가상 데이터는 --allow-simulated 없이 분석이 거부된다.
2. 효과를 심은 데이터 → '지지', 효과 0인 데이터 → '지지 안 됨'. 판정 규칙이 결과에 맞춰 움직이지 않음을 보인다.
3. 제외 규칙: 재참여 1명이 정확히 제외된다.
4. 논문 매크로 파일이 생기고 SIMULATED 표시가 켜진다.
5. 유효 시행 정의의 경계 사례 (검토 R2-5): status ok인데 RT 없음, 탭 이탈, 예상 밖 상태, 캐치 시행, 100 ms 경계
6. 참가자 제외: 파일럿, 수집 기간 밖, 미완료, 조건별 유효 부족
7. 판정 규칙: 표본 중앙값 > 0 이어도 HL < 0 이고 p < .05이면 일관되게 판정 (검토 R2-1 반례)

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
    run('analysis/build_dataset.py', '--in', str(sess), '--out', str(raw))
    refused = run('analysis/run_analysis.py', '--data', str(raw), '--out', str(out), '--paper', str(paper), check=False)
    assert refused.returncode != 0, 'simulated data must be refused by default'
    r = run('analysis/run_analysis.py', '--data', str(raw), '--out', str(out), '--paper', str(paper), '--allow-simulated',
            check=False)
    assert r.returncode == 0, r.stderr
    res = json.loads((out / 'results.json').read_text())
    tex = (paper / 'generated/results.tex').read_text()
    return res, tex


def unit_valid_definition():
    main = pd.DataFrame([
        # (status, rt, hidden, is_catch) → 기대 유효 여부
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


def unit_participant_exclusions():
    def sess(sid, **kw):
        base = dict(session_id=sid, pilot=False, repeat_participation=False,
                    finished_at='2026-11-03T03:00:00Z')
        base.update(kw)
        return base

    def rows(sid, n_main=46, n_valid_cue=20):
        out = []
        k = 0
        for c in ('cue', 'nocue'):
            for i in range(20):
                ok = c == 'nocue' or i < n_valid_cue
                out.append(dict(session_id=sid, block='main', condition=c, is_catch=False, status='ok' if ok else 'timeout',
                                rt_ms=300.0 if ok else np.nan, hidden_during_trial=False, input_type='touch'))
            for _ in range(3):
                out.append(dict(session_id=sid, block='main', condition=c, is_catch=True, status='catch_ok',
                                rt_ms=np.nan, hidden_during_trial=False, input_type=None))
        return out[:n_main]

    sessions = pd.DataFrame([
        sess('A'), sess('P', pilot=True), sess('W', finished_at='2026-12-25T00:00:00Z'),
        sess('R', repeat_participation=True), sess('I'), sess('F'),
    ])
    trials = pd.DataFrame(rows('A') + rows('P') + rows('W') + rows('R') + rows('I', n_main=30) + rows('F', n_valid_cue=9))
    window = {'start': pd.Timestamp('2026-11-02 00:00:00', tz='Asia/Seoul'),
              'end': pd.Timestamp('2026-11-08 23:59:59', tz='Asia/Seoul')}
    _, analyzed, log = ra.apply_exclusions(trials, sessions, window)
    reasons = dict(zip(log['session_id'], log['reason']))
    assert analyzed == ['A'], analyzed
    assert reasons == {'P': 'pilot', 'W': 'outside_window', 'R': 'repeat_participation', 'I': 'incomplete',
                       'F': 'too_few_valid_trials'}, reasons


def unit_verdict_counterexample():
    d = np.array([-100 - i for i in range(10)] + [1 + i for i in range(11)], float)
    pp = pd.DataFrame({'diff': d, 'median_cue': 300 + d, 'median_nocue': 300.0, 'n_valid_cue': 20, 'n_valid_nocue': 20})
    c = ra.confirmatory(pp)
    assert c['diff_median'] > 0 and c['hl_estimate'] < 0 and c['wilcoxon_p_one_sided'] < 0.05
    assert c['supported'] is True


def main():
    unit_valid_definition()
    unit_participant_exclusions()
    unit_verdict_counterexample()
    print('unit checks passed (valid definition, participant exclusions, verdict rule)')
    with tempfile.TemporaryDirectory() as d:
        res, tex = scenario(Path(d) / 'a', -20)
        assert res['confirmatory']['supported'] is True
        assert res['flow']['excluded_by_reason'].get('repeat_participation') == 1
        assert r'\newcommand{\ResSimulated}{1}' in tex
        print('effect -20ms  → supported:', res['confirmatory']['supported'],
              'p =', round(res['confirmatory']['wilcoxon_p_one_sided'], 4), 'HL =', round(res['confirmatory']['hl_estimate'], 1))

        res0, _ = scenario(Path(d) / 'b', 0)
        print('effect   0ms  → supported:', res0['confirmatory']['supported'],
              'p =', round(res0['confirmatory']['wilcoxon_p_one_sided'], 4))
        assert res0['confirmatory']['supported'] is False
    print('pipeline checks passed')


if __name__ == '__main__':
    main()
