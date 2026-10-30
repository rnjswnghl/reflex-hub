"""세션 JSON 파일들 → 분석용 원자료 CSV 2개.

입력: data/raw/sessions/ 아래의 *.json (서버 저장분, 참가자가 '파일로 받기'로 보낸 백업 모두 같은 형식)
출력: data/raw/trials.csv   (시행 1개 = 1행, 연습 포함 전부)
      data/raw/sessions.csv (참가자 세션 1개 = 1행)

같은 session_id가 여러 번 들어오면(재전송 등) 서버가 가장 먼저 받은 것(received_at) 하나만 남기고 그 사실을 기록한다.
원본 JSON은 절대 수정하지 않는다.
"""
import argparse
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

META_COLS = [
    'session_id', 'app_version', 'pilot', 'repeat_participation', 'prior_start', 'saw_cue', 'resent',
    'age_band', 'user_agent', 'platform',
    'pointer_coarse', 'max_touch_points', 'viewport_w', 'viewport_h', 'dpr', 'est_frame_ms',
    'started_at', 'finished_at', 'received_at', 'server_commit', 'source_file',
]


def load(paths):
    recs = []
    for p in paths:
        rec = json.loads(Path(p).read_text(encoding='utf-8'))
        received = rec.get('received_at') or rec['meta'].get('finished_at') or ''
        recs.append((received, str(p), rec))
    recs.sort(key=lambda r: (r[0], r[1]))  # 서버 수신 시각 순 → 같은 세션이면 먼저 받은 것을 남긴다

    sessions, trials, dupes = [], [], []
    seen = {}
    for received, p, rec in recs:
        meta, rows = rec['meta'], rec['trials']
        sid = meta['session_id']
        if sid in seen:
            dupes.append({'session_id': sid, 'kept': seen[sid], 'dropped': p})
            continue
        seen[sid] = p
        m = {k: meta.get(k) for k in META_COLS}
        m['received_at'] = received
        m['server_commit'] = rec.get('server_commit')
        m['source_file'] = str(Path(p).relative_to(ROOT)) if Path(p).is_relative_to(ROOT) else p
        sessions.append(m)
        for r in rows:
            trials.append({'session_id': sid, **r})
    return pd.DataFrame(sessions, columns=META_COLS), pd.DataFrame(trials), dupes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', default=str(ROOT / 'data/raw/sessions'))
    ap.add_argument('--out', default=str(ROOT / 'data/raw'))
    a = ap.parse_args()

    paths = list(Path(a.src).rglob('*.json'))
    if not paths:
        raise SystemExit(f'세션 파일이 없습니다: {a.src}')
    s, t, dupes = load(paths)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    s.sort_values('started_at').to_csv(out / 'sessions.csv', index=False)
    t.sort_values(['session_id', 'trial_index']).to_csv(out / 'trials.csv', index=False)
    print(f'sessions={len(s)} trials={len(t)} duplicates_dropped={len(dupes)}')
    for d in dupes:
        print('  duplicate:', d)


if __name__ == '__main__':
    main()
