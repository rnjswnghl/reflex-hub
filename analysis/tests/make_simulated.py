"""파이프라인 점검용 가상 데이터 생성기. 실제 참가자 데이터가 아니다.

session_id가 모두 'SIM'으로 시작하므로 run_analysis.py는 --allow-simulated 없이는 분석을 거부하고,
허용해도 그림과 논문 수치에 SIMULATED 표시가 붙는다. 제출 ZIP에는 들어가지 않는다.
효과 크기 등 모든 값은 임의로 정한 점검용 숫자이며 예측이나 근거가 아니다.
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np


def make(n=24, effect_ms=-20.0, seed=7):
    rng = np.random.default_rng(seed)
    sessions = []
    t0 = datetime(2026, 11, 2, 10, tzinfo=timezone.utc)
    for i in range(n):
        sid = f'SIM{i:05d}-0000-4000-8000-{i:012d}'
        base = rng.normal(310, 45)
        my_effect = rng.normal(effect_ms, 18)
        input_type = rng.choice(['touch', 'mouse', 'keyboard'], p=[0.6, 0.3, 0.1])
        trials = []
        conds = ['cue'] * 3 + ['nocue'] * 3
        conds = list(rng.permutation(conds)) + list(rng.permutation(['cue'] * 20 + ['nocue'] * 20))
        for k, c in enumerate(conds):
            block = 'practice' if k < 6 else 'main'
            u = rng.random()
            if u < 0.03:
                status, rt = 'anticipation', None
            elif u < 0.04:
                status, rt = 'timeout', None
            else:
                status = 'ok'
                rt = max(60.0, base + (my_effect if c == 'cue' else 0) + rng.exponential(60) - 40 + rng.normal(0, 25))
            trials.append({
                'trial_index': k, 'block': block, 'condition': c, 'precue_planned_ms': int(rng.integers(1000, 2500)),
                'cue_target_planned_ms': 500, 'cue_target_actual_ms': None if status == 'anticipation' else 500.0,
                'status': status, 'rt_ms': None if rt is None else round(rt, 2), 'input_type': input_type,
                'time_source': 'event', 'hidden_during_trial': False,
                'trial_started_at': (t0 + timedelta(hours=i * 5, seconds=k * 4)).isoformat(),
            })
        meta = {
            'session_id': sid, 'app_version': '1.0.0', 'repeat_participation': i == n - 1,
            'age_band': None, 'user_agent': 'simulated', 'platform': 'simulated', 'pointer_coarse': input_type == 'touch',
            'max_touch_points': 5, 'viewport_w': 390, 'viewport_h': 844, 'dpr': 3, 'est_frame_ms': 16.7,
            'started_at': (t0 + timedelta(hours=i * 5)).isoformat(),
            'finished_at': (t0 + timedelta(hours=i * 5, minutes=3)).isoformat(),
        }
        sessions.append({'received_at': meta['finished_at'], 'meta': meta, 'trials': trials})
    return sessions


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--n', type=int, default=24)
    ap.add_argument('--effect', type=float, default=-20.0)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for s in make(a.n, a.effect):
        (out / f"{s['meta']['session_id']}.json").write_text(json.dumps(s), encoding='utf-8')
    print(f'wrote {a.n} simulated sessions to {out}')
