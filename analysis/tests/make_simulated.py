"""파이프라인 점검용 가상 데이터 생성기. 실제 참가자 데이터가 아니다.

player_id가 모두 'SIM'으로 시작하므로 run_analysis.py는 --allow-simulated 없이는 분석을 거부하고,
허용해도 그림과 논문 수치에 SIMULATED 표시가 붙는다. 제출 ZIP에는 들어가지 않는다.
효과 크기 등 모든 값은 임의로 정한 점검용 숫자이며 예측이나 근거가 아니다.
판 구성은 앱 2.0.0과 같다: 첫 판 = 연습 4(목표 2 + 캐치 2) + 본 14(목표 12 + 캐치 2), 이후 판 = 본 14.
참가자마다 1~4판, 파일럿 1명, 중도 이탈한 판 3개(시작 기록만 있음)를 넣는다.
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


def rid(i, k):
    return f'SIMR{i:04d}-{k:04d}-4000-8000-{i:012d}'


def pid_of(i):
    return f'SIM{i:05d}-0000-4000-8000-{i:012d}'


def make(n=24, effect_ms=-20.0, seed=7):
    rng = np.random.default_rng(seed)
    rounds = []
    t0 = datetime(2026, 11, 2, 1, tzinfo=timezone.utc)
    for i in range(n):
        pid = pid_of(i)
        base = rng.normal(310, 45)
        my_effect = rng.normal(effect_ms, 18)
        input_type = str(rng.choice(['touch', 'mouse', 'keyboard'], p=[0.6, 0.3, 0.1]))
        n_rounds = int(rng.choice([1, 2, 3, 4], p=[0.35, 0.3, 0.2, 0.15]))
        for k in range(n_rounds):
            tutorial = k == 0
            seq = (block(rng, 'practice', 1, 1) if tutorial else []) + block(rng, 'main', 6, 1)
            start = t0 + timedelta(hours=i * 5, minutes=k * 2)
            trials = []
            for j, (blk, c, is_catch) in enumerate(seq):
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
                    'trial_index': j, 'block': blk, 'condition': c, 'is_catch': is_catch,
                    'precue_planned_ms': int(rng.integers(800, 2000)), 'cue_target_planned_ms': 500,
                    'cue_target_actual_ms': None if status == 'anticipation' else 500.0,
                    'cue_on_actual_ms': 100.0 if c == 'cue' and status != 'anticipation' else None,
                    'status': status, 'rt_ms': None if rt is None else round(rt, 2),
                    'input_type': input_type if status in ('ok', 'anticipation', 'catch_fa') else None,
                    'time_source': 'event', 'hidden_during_trial': False,
                    'trial_started_at': (start + timedelta(seconds=j * 3)).isoformat(),
                })
            meta = {
                'round_id': rid(i, k), 'player_id': pid, 'nick': [i % 16, k], 'app_version': '2.0.0',
                'pilot': i == n - 1,  # 마지막 사람은 연구자 파일럿
                'round_index': k + 1, 'tutorial': tutorial,
                'saw_cue': str(rng.choice(['yes', 'no', 'unsure'], p=[0.8, 0.1, 0.1])) if tutorial else None,
                'user_agent': 'simulated', 'platform': 'simulated', 'pointer_coarse': input_type == 'touch',
                'max_touch_points': 5, 'viewport_w': 390, 'viewport_h': 844, 'dpr': 3, 'est_frame_ms': 16.7,
                'started_at': start.isoformat(), 'finished_at': (start + timedelta(seconds=45)).isoformat(),
            }
            rounds.append({'received_at': meta['finished_at'], 'server_commit': 'simulated', 'server_score': None,
                           'meta': meta, 'trials': trials})
    return rounds


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--n', type=int, default=24)
    ap.add_argument('--effect', type=float, default=-20.0)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    funnel = out.parent / (out.name + '_funnel')
    funnel.mkdir(parents=True, exist_ok=True)
    sims = make(a.n, a.effect)
    for s in sims:
        (out / f"{s['meta']['round_id']}.json").write_text(json.dumps(s), encoding='utf-8')
    # 시작 기록: 서버에 도착한 모든 판 + 중도 이탈 3판 (파일럿은 서버가 다른 경로에 두므로 넣지 않는다)
    started = [(s['meta']['round_id'], s['meta']['player_id'], s['meta']['started_at']) for s in sims if not s['meta']['pilot']]
    started += [(rid(900 + i, 0), pid_of(900 + i), sims[0]['meta']['started_at']) for i in range(3)]
    for r, p, ts in started:
        (funnel / f'{r}.json').write_text(json.dumps({'round_id': r, 'player_id': p, 'app_version': '2.0.0', 'started_at': ts,
                                                       'server_commit': 'simulated'}), encoding='utf-8')
    print(f'wrote {len(sims)} simulated rounds ({a.n} players) to {out}')
