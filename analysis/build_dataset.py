"""'번개 반사' 판 JSON 파일들 → 분석용 원자료 CSV.

입력: data/raw/sessions/ 아래의 *.json — 판 1개 = 파일 1개 (서버 저장분 그대로)
      data/raw/funnel/ 아래의 *.json   — 판 시작 기록 (완료율 계산용)
출력: data/raw/trials.csv  (시행 1개 = 1행, 연습 포함 전부. round_id·player_id로 연결)
      data/raw/rounds.csv  (판 1개 = 1행)
      data/raw/funnel.csv  (시작 기록 1개 = 1행)

같은 round_id가 여러 번 들어오면(재전송 등) 서버가 가장 먼저 받은 것(received_at) 하나만 남기고 그 사실을 기록한다.
원본 JSON은 절대 수정하지 않는다.
"""
import argparse
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

META_COLS = [
    'round_id', 'player_id', 'round_index', 'tutorial', 'app_version', 'pilot', 'saw_cue', 'resent',
    'user_agent', 'platform', 'pointer_coarse', 'max_touch_points', 'viewport_w', 'viewport_h', 'dpr', 'est_frame_ms',
    'started_at', 'finished_at', 'received_at', 'server_commit', 'server_score', 'source_file',
]


def load(paths):
    recs = []
    for p in paths:
        rec = json.loads(Path(p).read_text(encoding='utf-8'))
        received = rec.get('received_at') or rec['meta'].get('finished_at') or ''
        recs.append((received, str(p), rec))
    recs.sort(key=lambda r: (r[0], r[1]))  # 서버 수신 시각 순 → 같은 판이면 먼저 받은 것을 남긴다

    rounds, trials, dupes = [], [], []
    seen = {}
    for received, p, rec in recs:
        meta, rows = rec['meta'], rec['trials']
        rid = meta['round_id']
        if rid in seen:
            dupes.append({'round_id': rid, 'kept': seen[rid], 'dropped': p})
            continue
        seen[rid] = p
        m = {k: meta.get(k) for k in META_COLS}
        m['received_at'] = received
        m['server_commit'] = rec.get('server_commit')
        m['server_score'] = rec.get('server_score')
        m['source_file'] = str(Path(p).relative_to(ROOT)) if Path(p).is_relative_to(ROOT) else p
        rounds.append(m)
        for r in rows:
            trials.append({'round_id': rid, 'player_id': meta['player_id'], **r})
    return pd.DataFrame(rounds, columns=META_COLS), pd.DataFrame(trials), dupes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', default=str(ROOT / 'data/raw/sessions'))
    ap.add_argument('--out', default=str(ROOT / 'data/raw'))
    ap.add_argument('--funnel', default=str(ROOT / 'data/raw/funnel'))
    a = ap.parse_args()

    paths = list(Path(a.src).rglob('*.json'))
    if not paths:
        raise SystemExit(f'판 파일이 없습니다: {a.src}')
    r, t, dupes = load(paths)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    r.sort_values(['player_id', 'started_at']).to_csv(out / 'rounds.csv', index=False)
    t.sort_values(['player_id', 'round_id', 'trial_index']).to_csv(out / 'trials.csv', index=False)
    starts = [json.loads(p.read_text(encoding='utf-8')) for p in sorted(Path(a.funnel).rglob('*.json'))] if Path(a.funnel).exists() else []
    f = pd.DataFrame(starts, columns=['round_id', 'player_id', 'app_version', 'started_at', 'server_commit'])
    f.drop_duplicates('round_id').sort_values('started_at').to_csv(out / 'funnel.csv', index=False)
    print(f'rounds={len(r)} players={r["player_id"].nunique()} trials={len(t)} starts={len(f)} duplicates_dropped={len(dupes)}')
    for d in dupes:
        print('  duplicate:', d)


if __name__ == '__main__':
    main()
