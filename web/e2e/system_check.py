"""실험 페이지 시스템 점검 (사람 데이터 아님).

브라우저 안에 '로봇 참가자'를 심어 노란 원이 뜨면 정확히 ROBOT_DELAY_MS 뒤에 누르게 하고, 캐치 시행에서는 누르지 않는다.
'번개 반사'를 두 판 한다: 1판(첫 판, 연습 포함, 일부러 한 번 미리 누름) → 조작 점검 답 → 결과 → '한 판 더' → 2판.
기록된 값이 설계와 맞는지 확인한다. 결과는 원자료가 아니라 측정 도구의 점검 기록이다.
--shots 폴더를 주면 허브·소개·대기·목표·결과 화면을 휴대폰 크기로 캡처한다.

실행:  cd web && npm run build && python3 e2e/system_check.py [--out ../docs/evidence/system-check.json] [--shots DIR]
"""
import argparse
import json
import statistics as st
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

from playwright.sync_api import sync_playwright

ROBOT_DELAY_MS = 250
EARLY_TRIAL = 1  # 1판의 이 시행(0부터)에서 일부러 목표 전에 눌러 '조기 반응' 처리를 확인한다
PORT = 4319

ROBOT = """
({ delay, earlyTrial }) => {
  window.__robot = { cueOn: 0, trial: -1, armed: true, obs: [] };
  // 관찰자를 window에 붙잡아 두지 않으면 브라우저가 수거해 콜백이 멈춘다
  const keep = (o) => (window.__robot.obs.push(o), o);
  const press = (s) => s.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
  keep(new MutationObserver(() => {
    const s = document.querySelector('.stage');
    if (!s || s.__watched) return;
    s.__watched = true;
    const target = s.querySelector('.target');
    const frame = s.querySelector('.cue-frame');
    keep(new MutationObserver(() => {
      if (s.dataset.fix === 'on') {
        window.__robot.trial++;
        if (window.__robot.armed && window.__robot.trial === earlyTrial) setTimeout(() => press(s), 300);
      }
    })).observe(s, { attributes: true, attributeFilter: ['data-fix'] });
    keep(new MutationObserver(() => {
      if (frame.dataset.on === 'true') window.__robot.cueOn++;
    })).observe(frame, { attributes: true, attributeFilter: ['data-on'] });
    keep(new MutationObserver(() => {
      if (target.dataset.on === 'true') setTimeout(() => press(s), delay);
    })).observe(target, { attributes: true, attributeFilter: ['data-on'] });
  })).observe(document.body, { childList: true, subtree: true });
}
"""


def reaction_score(trials, penalty=100, min_valid=6):
    main = [t for t in trials if t['block'] == 'main']
    valid = [t for t in main if not t['is_catch'] and t['status'] == 'ok' and t['rt_ms'] is not None
             and 100 <= t['rt_ms'] <= 1500 and not t['hidden_during_trial']]
    misses = sum(t['status'] in ('anticipation', 'catch_fa', 'timeout') for t in main)
    if len(valid) < min_valid:
        return None
    return round(sum(t['rt_ms'] for t in valid) / len(valid) + penalty * misses)


def summarize(trials):
    ok = [t for t in trials if t['status'] == 'ok']
    lag = [t['cue_target_actual_ms'] for t in trials if t['cue_target_actual_ms'] is not None]
    on = [t['cue_on_actual_ms'] for t in trials if t['cue_on_actual_ms'] is not None]
    rng = lambda xs: {'min': min(xs), 'median': st.median(xs), 'max': max(xs)} if xs else {}
    pre = {c: sorted(t['precue_planned_ms'] for t in trials if t['block'] == 'main' and not t['is_catch'] and t['condition'] == c)
           for c in ('cue', 'nocue')}
    return {
        'rows': len(trials),
        'rows_practice': sum(t['block'] == 'practice' for t in trials),
        'rows_main': sum(t['block'] == 'main' for t in trials),
        'catch_rows': sum(t['is_catch'] for t in trials),
        'status_counts': dict(Counter(t['status'] for t in trials)),
        'paired_foreperiods': pre['cue'] == pre['nocue'],
        'cue_target_actual_ms': rng(lag),
        'cue_on_actual_ms': rng(on),
        'recorded_rt_ms': rng([t['rt_ms'] for t in ok]),
        'time_source': sorted({t['time_source'] for t in ok}),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=None)
    ap.add_argument('--shots', default=None)
    args = ap.parse_args()
    shots = Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)

    web = Path(__file__).resolve().parents[1]
    server = subprocess.Popen(['npx', 'vite', 'preview', '--port', str(PORT), '--strictPort'],
                              cwd=web, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    rounds, starts = [], []
    try:
        time.sleep(2.5)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)

            def fulfill(route, body):
                route.fulfill(status=200, content_type='application/json', body=json.dumps(body))

            def on_submit(route):
                rounds.append(json.loads(route.request.post_data))
                fulfill(route, {'ok': True})

            def on_start(route):
                starts.append(json.loads(route.request.post_data))
                fulfill(route, {'ok': True})

            page.route('**/api/submit', on_submit)
            page.route('**/api/start', on_start)
            page.route('**/api/stats', lambda r: fulfill(r, {'ok': True, 'active_now': 3, 'today_plays': 41}))
            page.route('**/api/leaderboard**', lambda r: fulfill(r, {'ok': True, 'players': 3, 'all': [
                ['aaaaaaaa', 268, [8, 1]], ['bbbbbbbb', 291, [0, 9]], ['cccccccc', 344, [5, 2]]]}))

            page.goto(f'http://localhost:{PORT}/')
            if shots:
                page.wait_for_timeout(800)
                page.screenshot(path=str(shots / '0-consent.png'))
            page.click('text=좋아요, 시작')
            if shots:
                page.wait_for_timeout(300)
                page.screenshot(path=str(shots / '1-hub.png'), full_page=True)
            page.evaluate(ROBOT, {'delay': ROBOT_DELAY_MS, 'earlyTrial': EARLY_TRIAL})
            page.click('[data-game="reaction"]')
            if shots:
                page.screenshot(path=str(shots / '2-intro.png'), full_page=True)
            page.click('text=시작')
            if shots:
                page.wait_for_selector('.stage[data-fix="on"]')
                page.screenshot(path=str(shots / '3-wait.png'))
                page.wait_for_selector('.target[data-on="true"]')
                page.screenshot(path=str(shots / '4-target.png'))
            page.click('text=봤어요', timeout=200_000)
            page.wait_for_selector('text=한 판 더', timeout=30_000)
            page.wait_for_timeout(500)
            if shots:
                page.screenshot(path=str(shots / '5-result.png'), full_page=True)
            # 2판: 미리 누르기 끄고, 시행 번호를 다시 센다
            page.evaluate('window.__robot.armed = false')
            page.click('text=한 판 더')
            page.click('text=시작')
            page.wait_for_selector('text=한 판 더', timeout=200_000)
            cue_flashes = page.evaluate('window.__robot.cueOn')
            stored = page.evaluate("JSON.parse(localStorage.getItem('reflexhub.player.v2'))")
            browser.close()
    finally:
        server.terminate()

    r1, r2 = rounds
    report = {
        'what': 'system check with in-browser robot (NOT participant data)',
        'robot_delay_ms': ROBOT_DELAY_MS,
        'app_version': r1['meta']['app_version'],
        'est_frame_ms': r1['meta']['est_frame_ms'],
        'round1': summarize(r1['trials']),
        'round2': summarize(r2['trials']),
        'cue_flashes_observed': cue_flashes,
        'cue_trials': sum(t['condition'] == 'cue' for r in rounds for t in r['trials']),
        'start_calls': len(starts),
        'meta': {k: [r['meta'].get(k) for r in rounds] for k in ('round_index', 'tutorial', 'saw_cue', 'pilot')},
        'scores': {'client_best_saved': stored['best'].get('reaction'),
                   'recomputed': [reaction_score(r['trials']) for r in rounds]},
    }
    a1, a2 = report['round1'], report['round2']
    allr = [x for r in (a1, a2) for x in (r['cue_target_actual_ms'], r['cue_on_actual_ms'], r['recorded_rt_ms'])]
    checks = {
        'round 1 = 4 practice + 14 main (catch 2+2)': a1['rows'] == 18 and a1['rows_practice'] == 4 and a1['catch_rows'] == 4,
        'round 2 = 14 main, no practice (catch 2)': a2['rows'] == 14 and a2['rows_practice'] == 0 and a2['catch_rows'] == 2,
        'one early press in round 1 -> one anticipation without RT': a1['status_counts'].get('anticipation') == 1
        and all(t['rt_ms'] is None for t in r1['trials'] if t['status'] == 'anticipation'),
        'robot never pressed on catch -> catch_ok only': not a1['status_counts'].get('catch_fa') and not a2['status_counts'].get('catch_fa'),
        'paired foreperiods in both rounds': a1['paired_foreperiods'] and a2['paired_foreperiods'],
        'every cue trial flashed (except the early one)': cue_flashes >= report['cue_trials'] - 1,
        'cue->target within 500±20 ms': all(480 <= v <= 520 for r in (a1, a2) for v in (r['cue_target_actual_ms']['min'], r['cue_target_actual_ms']['max'])),
        'cue on-duration within 100 -8..+40 ms': all(92 <= v <= 140 for r in (a1, a2) for v in (r['cue_on_actual_ms']['min'], r['cue_on_actual_ms']['max'])),
        'recorded RT within robot delay +0..40 ms': all(ROBOT_DELAY_MS - 2 <= v <= ROBOT_DELAY_MS + 40 for r in (a1, a2) for v in (r['recorded_rt_ms']['min'], r['recorded_rt_ms']['max'])),
        'start reported once per round, same round ids': len(starts) == 2 and [s['round_id'] for s in starts] == [r['meta']['round_id'] for r in rounds],
        'same player across rounds, round_index 1 -> 2, tutorial only first': r1['meta']['player_id'] == r2['meta']['player_id']
        and report['meta']['round_index'] == [1, 2] and report['meta']['tutorial'] == [True, False],
        'manipulation check asked only after first round': report['meta']['saw_cue'] == ['yes', None],
        'client best score = min of server-formula scores': report['scores']['client_best_saved'] == min(s for s in report['scores']['recomputed'] if s is not None),
    }
    report['checks'] = checks
    del allr
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    sys.exit(0 if all(checks.values()) else 1)


if __name__ == '__main__':
    main()
