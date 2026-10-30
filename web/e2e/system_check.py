"""실험 페이지 시스템 점검 (사람 데이터 아님).

브라우저 안에 '로봇 참가자'를 심어 목표 자극이 뜨면 정확히 ROBOT_DELAY_MS 뒤에 누르게 하고,
기록된 값이 설계와 맞는지 확인한다. 결과는 원자료가 아니라 측정 도구의 점검 기록이다.

실행:  cd web && npm run build && python3 e2e/system_check.py [--out ../docs/evidence/system-check.json]
"""
import argparse
import json
import statistics as st
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROBOT_DELAY_MS = 250
EARLY_TRIAL = 1  # 이 trial_index에서는 일부러 목표 전에 눌러 '조기 반응' 처리를 확인한다
PORT = 4319

ROBOT = """
({ delay, earlyTrial }) => {
  window.__robot = { cueOn: 0, trial: -1 };
  const stage = () => document.querySelector('.stage');
  const press = () => stage()?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
  new MutationObserver(() => {
    const s = stage();
    if (!s || s.__watched) return;
    s.__watched = true;
    const target = s.querySelector('.target');
    new MutationObserver(() => {
      if (s.dataset.cue === 'on') window.__robot.cueOn++;
      if (s.dataset.fix === 'on') {
        window.__robot.trial++;
        if (window.__robot.trial === earlyTrial) setTimeout(press, 300);
      }
    }).observe(s, { attributes: true, attributeFilter: ['data-cue', 'data-fix'] });
    new MutationObserver(() => {
      if (target.dataset.on === 'true') setTimeout(press, delay);
    }).observe(target, { attributes: true, attributeFilter: ['data-on'] });
  }).observe(document.body, { childList: true, subtree: true });
}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=None)
    args = ap.parse_args()

    web = Path(__file__).resolve().parents[1]
    server = subprocess.Popen(
        ['npx', 'vite', 'preview', '--port', str(PORT), '--strictPort'],
        cwd=web, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    payload = {}
    try:
        time.sleep(2.5)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 1280, 'height': 800})

            def on_submit(route):
                payload.update(json.loads(route.request.post_data))
                route.fulfill(status=200, content_type='application/json', body='{"ok":true}')

            page.route('**/api/submit', on_submit)
            page.goto(f'http://localhost:{PORT}/')
            page.evaluate(ROBOT, {'delay': ROBOT_DELAY_MS, 'earlyTrial': EARLY_TRIAL})
            page.check('.consent input')
            page.click('text=시작하기')
            page.click('text=연습 시작')
            page.click('text=본 실험 시작', timeout=120_000)
            page.wait_for_selector('text=기록이 저장되었습니다', timeout=400_000)
            cue_flashes = page.evaluate('window.__robot.cueOn')
            browser.close()
    finally:
        server.terminate()

    trials = payload['trials']
    ok = [t for t in trials if t['status'] == 'ok']
    rts = [t['rt_ms'] for t in ok]
    lag = [t['cue_target_actual_ms'] for t in trials if t['cue_target_actual_ms'] is not None]
    n_cue = sum(t['condition'] == 'cue' for t in trials)
    report = {
        'what': 'system check with in-browser robot (NOT participant data)',
        'robot_delay_ms': ROBOT_DELAY_MS,
        'app_version': payload['meta']['app_version'],
        'est_frame_ms': payload['meta']['est_frame_ms'],
        'rows': len(trials),
        'rows_main': sum(t['block'] == 'main' for t in trials),
        'status_counts': {s: sum(t['status'] == s for t in trials) for s in ('ok', 'anticipation', 'timeout')},
        'anticipation_rows': [
            {k: t[k] for k in ('trial_index', 'condition', 'rt_ms', 'cue_target_actual_ms')}
            for t in trials if t['status'] == 'anticipation'
        ],
        'cue_trials': n_cue,
        'cue_flashes_observed': cue_flashes,
        'cue_target_actual_ms': {'min': min(lag), 'median': st.median(lag), 'max': max(lag)},
        'recorded_rt_ms': {'min': min(rts), 'median': st.median(rts), 'max': max(rts)},
        'time_source': sorted({t['time_source'] for t in ok}),
    }
    checks = {
        'row count = 6 practice + 40 main': report['rows'] == 46 and report['rows_main'] == 40,
        # 로봇이 한 번 일찍 누름 → 정확히 1건이 조기 반응으로, RT 없이 기록되어야 한다
        'one early press -> one anticipation row without RT': len(report['anticipation_rows']) == 1
        and report['anticipation_rows'][0]['rt_ms'] is None,
        'every cue trial flashed (except the early one)': cue_flashes >= n_cue - 1,
        'cue->target within 500±20 ms': all(480 <= x <= 520 for x in lag),
        'recorded RT within robot delay +0..40 ms': all(ROBOT_DELAY_MS - 2 <= x <= ROBOT_DELAY_MS + 40 for x in rts),
    }
    report['checks'] = checks
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    sys.exit(0 if all(checks.values()) else 1)


if __name__ == '__main__':
    main()
