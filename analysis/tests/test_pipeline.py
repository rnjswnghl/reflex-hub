"""분석 파이프라인 점검 (가상 데이터, 임시 폴더에서만 실행).

확인하는 것:
1. 가상 데이터는 --allow-simulated 없이 분석이 거부된다.
2. 효과를 심은 데이터 → '지지', 효과 0인 데이터 → 대체로 '지지 안 됨'. 판정 규칙이 결과에 맞춰 움직이지 않음을 보인다.
3. 제외 규칙: 재참여 1명이 정확히 제외된다.
4. 논문 매크로 파일이 생기고 SIMULATED 표시가 켜진다.

실행: python3 analysis/tests/test_pipeline.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PY = sys.executable


def run(*args, check=True):
    return subprocess.run([PY, *args], cwd=ROOT, capture_output=True, text=True, check=check)


def scenario(tmp: Path, effect: float):
    sess, raw, out, paper = tmp / 's', tmp / 'raw', tmp / 'out', tmp / 'paper'
    run('analysis/tests/make_simulated.py', str(sess), '--effect', str(effect))
    run('analysis/build_dataset.py', '--in', str(sess), '--out', str(raw))
    refused = run('analysis/run_analysis.py', '--data', str(raw), '--out', str(out), '--paper', str(paper), check=False)
    assert refused.returncode != 0, 'simulated data must be refused by default'
    run('analysis/run_analysis.py', '--data', str(raw), '--out', str(out), '--paper', str(paper), '--allow-simulated')
    res = json.loads((out / 'results.json').read_text())
    tex = (paper / 'generated/results.tex').read_text()
    return res, tex


def main():
    with tempfile.TemporaryDirectory() as d:
        res, tex = scenario(Path(d) / 'a', -20)
        assert res['confirmatory']['supported'] is True
        assert res['flow']['excluded_by_reason'].get('repeat_participation') == 1
        assert r'\newcommand{\ResSimulated}{1}' in tex
        print('effect -20ms  → supported:', res['confirmatory']['supported'], 'p =', round(res['confirmatory']['wilcoxon_p_one_sided'], 4))

        res0, _ = scenario(Path(d) / 'b', 0)
        print('effect   0ms  → supported:', res0['confirmatory']['supported'], 'p =', round(res0['confirmatory']['wilcoxon_p_one_sided'], 4))
        assert res0['confirmatory']['supported'] is False
    print('pipeline checks passed')


if __name__ == '__main__':
    main()
