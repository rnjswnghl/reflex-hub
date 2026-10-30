"""파이프라인 점검용 가상 데이터 생성기. 실제 참가자 데이터가 아니다.

session_id가 모두 'SIM'으로 시작하므로 run_analysis.py는 --allow-simulated 없이는 분석을 거부하고,
허용해도 그림과 논문 수치에 SIMULATED 표시가 붙는다. 제출 ZIP에는 들어가지 않는다.
효과 크기 등 모든 값은 임의로 정한 점검용 숫자이며 예측이나 근거가 아니다.
행 구성은 앱 1.1.0과 같다: 연습 8(목표 6 + 캐치 2) + 본 46(목표 40 + 캐치 6).
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np


def block(rng, name, n_target, n_catch):
    rows = [(c, False) for c in ('cue', 'nocue') for _ in range(n_target)]
    rows += [(c, True) for c in ('cue', 'nocue') for _ in range(n_catch)]
    return [(name, *rows[i]) for i in rng.permutation(len(rows))]


def make(n=24, effect_ms=-20.0, seed=7):
    rng = np.random.default_rng(seed)
    sessions = []
    t0 = datetime(2026, 11, 2, 1, tzinfo=timezone.utc)
    for i in range(n):
        sid = f'SIM{i:05d}-0000-4000-8000-{i:012d}'
        base = rng.normal(310, 45)
        my_effect = rng.normal(effect_ms, 18)
        input_type = str(rng.choice(['touch', 'mouse', 'keyboard'], p=[0.6, 0.3, 0.1]))
        seq = block(rng, 'practice', 3, 1) + block(rng, 'main', 20, 3)
        trials = []
        for k, (blk, c, is_catch) in enumerate(seq):
            u = rng.random()
            rt = None
            if is_catch:
                status = 'catch_fa' if u < 0.08 else 'catch_ok'
            elif u < 0.03:
                status = 'anticipation'
            elif u < 0.04:
                status = 'timeout'
            else:
                status = 'ok'
                rt = max(60.0, base + (my_effect if c == 'cue' else 0) + rng.exponential(60) - 40 + rng.normal(0, 25))
            trials.append({
                'trial_index': k, 'block': blk, 'condition': c, 'is_catch': is_catch,
                'precue_planned_ms': int(rng.integers(1000, 2500)), 'cue_target_planned_ms': 500,
                'cue_target_actual_ms': None if status == 'anticipation' else 500.0,
                'cue_on_actual_ms': 100.0 if c == 'cue' and status != 'anticipation' else None,
                'status': status, 'rt_ms': None if rt is None else round(rt, 2),
                'input_type': input_type if status in ('ok', 'anticipation', 'catch_fa') else None,
                'time_source': 'event', 'hidden_during_trial': False,
                'trial_started_at': (t0 + timedelta(hours=i * 5, seconds=k * 4)).isoformat(),
            })
        meta = {
            'session_id': sid, 'app_version': '1.1.0', 'pilot': False, 'repeat_participation': i == n - 1,
            'prior_start': False, 'saw_cue': str(rng.choice(['yes', 'no', 'unsure'], p=[0.8, 0.1, 0.1])),
            'age_band': None, 'user_agent': 'simulated', 'platform': 'simulated', 'pointer_coarse': input_type == 'touch',
            'max_touch_points': 5, 'viewport_w': 390, 'viewport_h': 844, 'dpr': 3, 'est_frame_ms': 16.7,
            'started_at': (t0 + timedelta(hours=i * 5)).isoformat(),
            'finished_at': (t0 + timedelta(hours=i * 5, minutes=4)).isoformat(),
        }
        sessions.append({'received_at': meta['finished_at'], 'server_commit': 'simulated', 'meta': meta, 'trials': trials})
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
