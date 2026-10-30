"""사전 등록한 분석(docs/04-preregistration.md)을 그대로 실행한다.

입력:  data/raw/trials.csv, data/raw/rounds.csv, data/raw/funnel.csv  (build_dataset.py가 만든 원자료)
       analysis/collection_window.json            (링크 공유일 D0에 기록하는 수집 기간)
출력:  analysis/output/results.json        모든 수치
       analysis/output/participants.csv    참가자(브라우저)별 조건 중앙값과 차이
       analysis/output/exclusions.csv      판·참가자 제외 사유 기록
       paper/generated/results.tex         논문 본문이 \\input 하는 수치 매크로
       paper/generated/table_desc.tex      기술통계 표
       paper/figures/fig_paired.pdf, fig_diff.pdf

이 파일의 PREREG 상수, is_valid(), apply_exclusions(), confirmatory()는 데이터 수집 전에 고정했다.
고쳐야 하면 고친 날짜·이유를 docs/03-design.md '설계 변경 기록'에 남기고, 고치기 전 결과도 함께 보고한다.
버전 이력: v1(커밋 5e0c825) → v2(커밋 8af2879, 독립 검토 반영) → v3(2026-10-30, 수집 전, 미니게임 허브:
          약 40초짜리 판을 여러 번 할 수 있으므로 분석 단위를 '판'이 아니라 '참가자(브라우저)'로, 판을 합쳐 쓴다)
"""
import argparse
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]

# ---- 사전 등록 상수: 수집 전에 고정 ------------------------------------------------
PREREG = {
    'version': 3,
    'main_rows_per_round': 14,           # 한 판 본 블록: 목표 12(조건별 6) + 캐치 2(조건별 1)
    'main_target_per_condition_per_round': 6,
    'rt_min_ms': 100,                    # 이보다 빠른 반응은 자극을 보고 낸 반응으로 보기 어려움
    'rt_max_ms': 1500,                   # 반응 창
    'min_valid_total': 10,               # 참가자의 모든 판을 합쳐 유효 목표 시행이 10회 미만이면 제외
    'min_valid_per_condition': 5,        # 어느 한 조건이라도 5회 미만이면 제외 (→ 깨끗한 한 판이면 포함 가능)
    'sensitivity_min_per_condition': 10, # 민감도 분석: 조건별 10회 이상(대개 2판 이상) 참가자만
    'alpha': 0.05,
    'sensitivity_rt_min_ms': 150,        # 민감도 분석: 하한을 올려 '시간 맞춰 누르기'를 더 걸러도 결론이 같은가
    'sensitivity_trim': 0.10,            # 민감도 분석: 참가자별 10% 절사평균
    'fast_band_ms': [100, 150],          # 전략 점검: 이 구간 반응 비율을 조건별로 비교
    'wilcoxon': {'zero_method': 'wilcox', 'method': 'auto', 'correction': False},
}


# ---- 0. 수집 기간 -------------------------------------------------------------------
def load_window(path: Path, required: bool):
    if not path.exists():
        if required:
            raise SystemExit(f'수집 기간 파일이 없습니다: {path}\n'
                             '링크를 처음 공유한 날 D0에 {"start_kst": "YYYY-MM-DD", "end_kst": "YYYY-MM-DD(D0+6)"} 로 만드세요.')
        return None
    w = json.loads(path.read_text())
    start = pd.Timestamp(w['start_kst'] + ' 00:00:00', tz='Asia/Seoul')
    end = pd.Timestamp(w['end_kst'] + ' 23:59:59', tz='Asia/Seoul')
    return {'start': start, 'end': end, 'raw': w}


# ---- 1. 제외 ------------------------------------------------------------------------
def truthy(x):
    return str(x).strip().lower() == 'true'


def is_valid(main: pd.DataFrame, rt_min: float) -> pd.Series:
    """유효 시행의 정의(사전 등록 §3): 목표 시행 & status=='ok' & RT 있음 & rt_min ≤ RT ≤ 1500 & 탭·포커스 이탈 없음."""
    rt = pd.to_numeric(main['rt_ms'], errors='coerce')
    return (
        ~main['is_catch'].map(truthy)
        & (main['status'] == 'ok')
        & rt.notna()
        & (rt >= rt_min)
        & (rt <= PREREG['rt_max_ms'])
        & ~main['hidden_during_trial'].map(truthy)
    )


def trial_reason(main: pd.DataFrame, rt_min: float) -> pd.Series:
    """제외된 목표 시행의 사유(보고용). 판정 자체는 is_valid()가 한다."""
    rt = pd.to_numeric(main['rt_ms'], errors='coerce')
    hidden = main['hidden_during_trial'].map(truthy)
    reason = np.select(
        [main['is_catch'].map(truthy), hidden, main['status'] == 'anticipation', main['status'] == 'timeout',
         main['status'] != 'ok', rt.isna(), rt < rt_min, rt > PREREG['rt_max_ms']],
        ['catch', 'hidden_or_blur', 'anticipation', 'timeout', 'other_status', 'missing_rt', 'rt_below_min', 'rt_above_max'],
        default='valid',
    )
    return pd.Series(reason, index=main.index)


def apply_exclusions(trials: pd.DataFrame, rounds: pd.DataFrame, window, rt_min=None, min_per_cond=None,
                     first_round_only=False):
    """판 단위 제외(파일럿 → 수집 기간 밖 → 미완료) 뒤, 참가자(브라우저) 단위로 판을 합쳐 유효 시행 수를 본다."""
    P = PREREG
    rt_min = P['rt_min_ms'] if rt_min is None else rt_min
    min_per_cond = P['min_valid_per_condition'] if min_per_cond is None else min_per_cond
    log = []
    main = trials[trials['block'] == 'main'].copy()

    keep = []
    for _, r in rounds.iterrows():
        rid = r['round_id']
        n_main = int((main['round_id'] == rid).sum())
        fin = pd.to_datetime(r.get('finished_at'), utc=True, errors='coerce')
        if truthy(r.get('pilot')):
            log.append({'unit': 'round', 'id': rid, 'reason': 'pilot', 'detail': ''})
        elif window and (pd.isna(fin) or not (window['start'] <= fin <= window['end'])):
            log.append({'unit': 'round', 'id': rid, 'reason': 'outside_window', 'detail': str(fin)})
        elif n_main != P['main_rows_per_round']:
            log.append({'unit': 'round', 'id': rid, 'reason': 'incomplete', 'detail': f'main_rows={n_main}'})
        else:
            keep.append(rid)
    if first_round_only:  # 민감도 분석: 참가자마다 남은 판 중 가장 먼저 시작한 판 하나
        kept = rounds[rounds['round_id'].isin(keep)].sort_values('started_at')
        keep = kept.groupby('player_id').head(1)['round_id'].tolist()
    main = main[main['round_id'].isin(keep)].copy()
    main['rt_ms'] = pd.to_numeric(main['rt_ms'], errors='coerce')
    main['valid'] = is_valid(main, rt_min)
    main['exclusion'] = trial_reason(main, rt_min)

    analyzed = []
    for pid, g in main.groupby('player_id'):
        v = g[g['valid']]
        per = v['condition'].value_counts()
        if len(v) < P['min_valid_total'] or min(per.get('cue', 0), per.get('nocue', 0)) < min_per_cond:
            log.append({'unit': 'player', 'id': pid, 'reason': 'too_few_valid_trials',
                        'detail': f"rounds={g['round_id'].nunique()} valid={len(v)} cue={per.get('cue', 0)} nocue={per.get('nocue', 0)}"})
        else:
            analyzed.append(pid)
    return main, analyzed, pd.DataFrame(log, columns=['unit', 'id', 'reason', 'detail'])


# ---- 2. 참가자별 요약 ---------------------------------------------------------------
def main_input(g: pd.DataFrame) -> str:
    """주 입력 방식: 응답 행의 최빈값. 동률이면 'mixed' (임의로 고르지 않는다)."""
    vc = g['input_type'].dropna().value_counts()
    if vc.empty:
        return 'none'
    top = vc[vc == vc.max()]
    return top.index[0] if len(top) == 1 else 'mixed'


def per_participant(main: pd.DataFrame, analyzed, stat='median'):
    v = main[main['valid'] & main['player_id'].isin(analyzed)]
    agg = (lambda x: x.median()) if stat == 'median' else (lambda x: stats.trim_mean(x, PREREG['sensitivity_trim']))
    rows = []
    for pid, g in v.groupby('player_id'):
        cue = g.loc[g['condition'] == 'cue', 'rt_ms']
        noc = g.loc[g['condition'] == 'nocue', 'rt_ms']
        allp = main[main['player_id'] == pid]
        rows.append({
            'player_id': pid,
            'n_rounds': allp['round_id'].nunique(),
            'median_cue': agg(cue),
            'median_nocue': agg(noc),
            'diff': agg(cue) - agg(noc),   # 음수 = 경고 신호가 있을 때 더 빠름
            'n_valid_cue': len(cue),
            'n_valid_nocue': len(noc),
            'input_type': main_input(allp),
            'mixed_input': allp['input_type'].dropna().nunique() > 1,
        })
    return pd.DataFrame(rows)


# ---- 3. 확증 분석 (사전 등록) -------------------------------------------------------
def signed_rank_null(n: int) -> np.ndarray:
    """귀무가설에서 W+ (양수 순위합)의 정확한 분포. P[k] = Pr(W+ = k)."""
    counts = np.zeros(n * (n + 1) // 2 + 1)
    counts[0] = 1
    for r in range(1, n + 1):  # 순위 r을 양수 쪽에 넣거나 넣지 않거나
        nxt = counts.copy()
        nxt[r:] += counts[:-r]
        counts = nxt
    return counts / 2 ** n


def hodges_lehmann(d: np.ndarray, alpha=0.05):
    """Hodges–Lehmann 추정치(Walsh 평균의 중앙값)와 Wilcoxon 부호순위 검정에 대응하는 정확한 신뢰구간.
    0인 차이는 제외한다(zero_method='wilcox'와 일관)."""
    d = d[d != 0]
    n = len(d)
    i, j = np.triu_indices(n)
    walsh = np.sort((d[i] + d[j]) / 2)
    M = len(walsh)
    cdf = np.cumsum(signed_rank_null(n))

    def crit(a):  # 가장 큰 C: Pr(W+ ≤ C−1) ≤ a
        c = int(np.searchsorted(cdf, a, side='right'))  # cdf[c-1] ≤ a < cdf[c]
        return max(c, 1)

    c2, c1 = crit(alpha / 2), crit(alpha)
    return {
        'hl': float(np.median(walsh)),
        'ci95': [float(walsh[c2 - 1]), float(walsh[M - c2])],
        'upper95_one_sided': float(walsh[M - c1]),
        'n_nonzero': n,
    }


def confirmatory(pp: pd.DataFrame):
    P = PREREG
    d = pp['diff'].to_numpy(dtype=float)
    n = len(d)
    out = {'n': n}
    if n < 2:
        out['error'] = '분석 가능한 참가자가 2명 미만'
        out['supported'] = False
        return out

    w = stats.wilcoxon(d, alternative='less', **P['wilcoxon'])
    hl = hodges_lehmann(d, P['alpha'])
    t = stats.ttest_1samp(d, 0.0, alternative='less')
    se = stats.sem(d)
    ci = stats.t.interval(0.95, n - 1, loc=d.mean(), scale=se)
    upper = d.mean() + stats.t.ppf(0.95, n - 1) * se
    k_faster = int((d < 0).sum())
    n_nonzero = int((d != 0).sum())
    sign = stats.binomtest(k_faster, n_nonzero, 0.5, alternative='greater') if n_nonzero else None

    out.update({
        'hl_estimate': hl['hl'],
        'hl_ci95': hl['ci95'],
        'hl_upper95_one_sided': hl['upper95_one_sided'],
        'wilcoxon_Wplus': float(w.statistic),
        'wilcoxon_p_one_sided': float(w.pvalue),
        'diff_median': float(np.median(d)),
        'diff_mean': float(d.mean()),
        'diff_sd': float(d.std(ddof=1)),
        'diff_mean_ci95': [float(ci[0]), float(ci[1])],
        'diff_mean_upper95_one_sided': float(upper),
        't': float(t.statistic),
        't_df': n - 1,
        't_p_one_sided': float(t.pvalue),
        'dz': float(d.mean() / d.std(ddof=1)) if d.std(ddof=1) > 0 else None,
        'k_faster_with_cue': k_faster,
        'k_slower_with_cue': int((d > 0).sum()),
        'n_nonzero': n_nonzero,
        'sign_p_one_sided': float(sign.pvalue) if sign else None,
        'group_median_cue': float(pp['median_cue'].median()),
        'group_median_nocue': float(pp['median_nocue'].median()),
        'valid_trial_imbalance_mean_abs': float((pp['n_valid_cue'] - pp['n_valid_nocue']).abs().mean()),
    })
    # 판정 규칙(사전 등록 v2~v3): 단측 Wilcoxon p < α 이고 Hodges–Lehmann 추정치 < 0 → 지지
    out['supported'] = bool(out['wilcoxon_p_one_sided'] < P['alpha'] and out['hl_estimate'] < 0)
    return out


def min_detectable_dz(n, alpha=0.05, power=0.80):
    """단측 대응표본 t검정에서 검정력 power로 잡아낼 수 있는 최소 효과크기 dz (민감도 분석)."""
    if n < 3:
        return None
    df = n - 1
    tcrit = stats.t.ppf(1 - alpha, df)
    lo, hi = 0.01, 5.0
    for _ in range(80):
        mid = (lo + hi) / 2
        pw = 1 - stats.nct.cdf(tcrit, df, mid * np.sqrt(n))
        lo, hi = (lo, mid) if pw >= power else (mid, hi)
    return hi


# ---- 4. 사전 등록한 보조 점검과 민감도 분석 ------------------------------------------
def sensitivity(trials, rounds, window):
    out = {}
    pick = ('n', 'hl_estimate', 'wilcoxon_p_one_sided', 'supported')
    variants = {
        'rt_floor_150': dict(rt_min=PREREG['sensitivity_rt_min_ms']),
        'trimmed_mean_10': dict(),
        'first_round_only': dict(first_round_only=True),
        'min10_per_condition': dict(min_per_cond=PREREG['sensitivity_min_per_condition']),
    }
    for name, kw in variants.items():
        m, a, _ = apply_exclusions(trials, rounds, window, **kw)
        pp = per_participant(m, a, stat='trim' if name == 'trimmed_mean_10' else 'median')
        c = confirmatory(pp) if len(pp) >= 2 else {'n': len(pp)}
        out[name] = {k: c.get(k) for k in pick}
    return out


def strategy_checks(main: pd.DataFrame, analyzed, rounds):
    """신호 조건에서 '원 대신 신호에 시간 맞춰 누르기'가 있었는지 보는 점검(사전 등록 §6)."""
    m = main[main['player_id'].isin(analyzed)]
    catch = m[m['is_catch'].map(truthy)]
    target = m[~m['is_catch'].map(truthy)]
    lo, hi = PREREG['fast_band_ms']
    res = {}
    for c in ('cue', 'nocue'):
        ct = catch[catch['condition'] == c]
        tg = target[target['condition'] == c]
        ok = tg[(tg['status'] == 'ok') & tg['rt_ms'].notna()]
        res[c] = {
            'catch_trials': int(len(ct)),
            'catch_false_alarms': int((ct['status'] == 'catch_fa').sum()),
            'catch_fa_rate': float((ct['status'] == 'catch_fa').mean()) if len(ct) else None,
            'anticipations': int((tg['status'] == 'anticipation').sum()),
            'fast_band_prop': float(((ok['rt_ms'] >= lo) & (ok['rt_ms'] < hi)).mean()) if len(ok) else None,
        }
    # 참가자별 오반응 수의 조건 차이 (신호 − 없음), 부호순위 검정 (양측)
    fa = catch.assign(fa=catch['status'] == 'catch_fa').groupby(['player_id', 'condition'])['fa'].sum().unstack(fill_value=0)
    if len(fa) >= 2 and {'cue', 'nocue'} <= set(fa.columns):
        dfa = (fa['cue'] - fa['nocue']).to_numpy()
        res['catch_fa_diff_wilcoxon_p_two_sided'] = (
            float(stats.wilcoxon(dfa, zero_method='wilcox').pvalue) if (dfa != 0).sum() >= 1 else None)
    res['saw_cue'] = saw_by_player(rounds).reindex(analyzed).fillna('none').value_counts().to_dict()
    lag = m.loc[m['cue_target_actual_ms'].notna(), 'cue_target_actual_ms']
    res['cue_target_actual_ms'] = {'min': float(lag.min()), 'median': float(lag.median()), 'max': float(lag.max())} if len(lag) else {}
    on = m.loc[m['cue_on_actual_ms'].notna(), 'cue_on_actual_ms'] if 'cue_on_actual_ms' in m else pd.Series(dtype=float)
    res['cue_on_actual_ms'] = {'min': float(on.min()), 'median': float(on.median()), 'max': float(on.max())} if len(on) else {}
    return res


def completion(data: Path, rounds: pd.DataFrame, window):
    """완료율(사전 등록 §6, 기술통계): 수집 기간에 시작한 세션 중 완료 세션이 서버에 도착한 비율.
    시작 기록은 앱 1.2.0부터 있다. 제외 규칙 적용 전 건수다."""
    path = data / 'funnel.csv'
    if not path.exists():
        return {'n_started': None, 'n_completed_of_started': None, 'rate': None}
    f = pd.read_csv(path)
    if f.empty:
        return {'n_started': 0, 'n_completed_of_started': 0, 'rate': None}
    t = pd.to_datetime(f['started_at'], utc=True, errors='coerce')
    if window:
        f = f[(t >= window['start']) & (t <= window['end'])]
    done = set(rounds.loc[~rounds['pilot'].map(truthy), 'round_id'])
    k = int(f['round_id'].isin(done).sum())
    return {'n_started': int(len(f)), 'n_completed_of_started': k, 'rate': (k / len(f)) if len(f) else None}


# ---- 5. 탐색 분석 (사전 등록한 확증 분석이 아님, 논문에 '탐색'으로 표시) -----------
def saw_by_player(rounds: pd.DataFrame) -> pd.Series:
    """조작 점검 응답: 참가자의 첫 판에서만 묻는다 → 참가자별로 비어 있지 않은 첫 답."""
    r = rounds.sort_values('started_at')
    return r.dropna(subset=['saw_cue']).groupby('player_id')['saw_cue'].first()


def exploratory(pp: pd.DataFrame, rounds):
    by_input = pp.groupby('input_type')['diff'].agg(['count', 'median']).reset_index().to_dict(orient='records')
    pp2 = pp.assign(saw=pp['player_id'].map(saw_by_player(rounds)).fillna('none'))
    by_saw = pp2.groupby('saw')['diff'].agg(['count', 'median']).reset_index().to_dict(orient='records')
    by_rounds = pp.assign(k=np.minimum(pp['n_rounds'], 3)).groupby('k')['diff'].agg(['count', 'median']).reset_index().to_dict(orient='records')
    return {'diff_by_input_type': by_input, 'diff_by_saw_cue': by_saw, 'diff_by_rounds_played_capped3': by_rounds,
            'mixed_input_participants': int(pp['mixed_input'].sum())}


# ---- 6. 출력 ------------------------------------------------------------------------
def fmt(x, nd=1):
    return '--' if x is None or (isinstance(x, float) and np.isnan(x)) else f'{x:.{nd}f}'


def fmt_p(p):
    """p < .001은 부등호, .04–.06은 넷째 자리까지(판정 경계에서 반올림이 오해를 낳지 않게), 나머지는 셋째 자리."""
    if p is None:
        return '--'
    if p < 0.001:
        return '< .001'
    nd = 4 if 0.04 <= p < 0.06 else 3
    return '= ' + f'{p:.{nd}f}'.lstrip('0')


def fmt_pct(x):
    return '--' if x is None else f'{100 * x:.1f}'


def write_tex(res, path: Path, simulated: bool):
    c, f, s, sc = res['confirmatory'], res['flow'], res['sensitivity'], res['strategy']
    ex = f['excluded_by_reason']
    mac = {
        'ResSimulated': '1' if simulated else '0',
        'NplayersAll': f['players_all'], 'NRoundsAll': f['rounds_all'],
        'Nrecruited': f['recruited'], 'Nexcluded': f['recruited'] - f['analyzed'],
        'NexclPilot': ex.get('pilot', 0), 'NexclWindow': ex.get('outside_window', 0),
        'NexclIncomplete': ex.get('incomplete', 0),
        'NexclFewValid': ex.get('too_few_valid_trials', 0), 'Nanalyzed': f['analyzed'],
        'NRoundsKept': f['rounds_of_analyzed'], 'RoundsMedian': fmt(f['rounds_per_player_median']),
        'RoundsMax': f['rounds_per_player_max'], 'NOneRound': f['players_one_round'],
        'TrialsAnalyzed': f['target_trials_of_analyzed'], 'TrialsExcluded': f['target_trials_excluded'],
        'TrialsExcludedPct': fmt(f['target_trials_excluded_pct']),
        'CollectStart': f['collection_start'], 'CollectEnd': f['collection_end'],
        'NinputTouch': f['input_types'].get('touch', 0), 'NinputMouse': f['input_types'].get('mouse', 0),
        'NinputKey': f['input_types'].get('keyboard', 0), 'NinputMixed': f['input_types'].get('mixed', 0),
        'MedCue': fmt(c.get('group_median_cue')), 'MedNocue': fmt(c.get('group_median_nocue')),
        'HL': fmt(c.get('hl_estimate')), 'HLCIlo': fmt((c.get('hl_ci95') or [None])[0]),
        'HLCIhi': fmt((c.get('hl_ci95') or [None, None])[1]), 'HLupper': fmt(c.get('hl_upper95_one_sided')),
        'Wplus': fmt(c.get('wilcoxon_Wplus')), 'Wp': fmt_p(c.get('wilcoxon_p_one_sided')),
        'DiffMedian': fmt(c.get('diff_median')), 'DiffMean': fmt(c.get('diff_mean')), 'DiffSD': fmt(c.get('diff_sd')),
        'DiffCIlo': fmt((c.get('diff_mean_ci95') or [None])[0]), 'DiffCIhi': fmt((c.get('diff_mean_ci95') or [None, None])[1]),
        'DiffUpper': fmt(c.get('diff_mean_upper95_one_sided')),
        'Tstat': fmt(c.get('t'), 2), 'Tdf': c.get('t_df', '--'), 'Tp': fmt_p(c.get('t_p_one_sided')),
        'Dz': fmt(c.get('dz'), 2), 'Kfaster': c.get('k_faster_with_cue', '--'), 'Kslower': c.get('k_slower_with_cue', '--'),
        'Nnonzero': c.get('n_nonzero', '--'), 'SignP': fmt_p(c.get('sign_p_one_sided')),
        'Imbalance': fmt(c.get('valid_trial_imbalance_mean_abs')),
        'MDEdz': fmt(res['sensitivity_power']['min_detectable_dz'], 2),
        'SensFloorHL': fmt(s['rt_floor_150'].get('hl_estimate')), 'SensFloorP': fmt_p(s['rt_floor_150'].get('wilcoxon_p_one_sided')),
        'SensFloorN': s['rt_floor_150'].get('n', '--'),
        'SensTrimHL': fmt(s['trimmed_mean_10'].get('hl_estimate')), 'SensTrimP': fmt_p(s['trimmed_mean_10'].get('wilcoxon_p_one_sided')),
        'SensFirstHL': fmt(s['first_round_only'].get('hl_estimate')), 'SensFirstP': fmt_p(s['first_round_only'].get('wilcoxon_p_one_sided')),
        'SensFirstN': s['first_round_only'].get('n', '--'),
        'SensTenHL': fmt(s['min10_per_condition'].get('hl_estimate')), 'SensTenP': fmt_p(s['min10_per_condition'].get('wilcoxon_p_one_sided')),
        'SensTenN': s['min10_per_condition'].get('n', '--'),
        'FAcue': sc['cue']['catch_false_alarms'], 'FAnocue': sc['nocue']['catch_false_alarms'],
        'FAcuePct': fmt_pct(sc['cue']['catch_fa_rate']), 'FAnocuePct': fmt_pct(sc['nocue']['catch_fa_rate']),
        'CatchPerCond': sc['cue']['catch_trials'],
        'FAdiffP': fmt_p(sc.get('catch_fa_diff_wilcoxon_p_two_sided')),
        'AntCue': sc['cue']['anticipations'], 'AntNocue': sc['nocue']['anticipations'],
        'FastCuePct': fmt_pct(sc['cue']['fast_band_prop']), 'FastNocuePct': fmt_pct(sc['nocue']['fast_band_prop']),
        'SawYes': sc['saw_cue'].get('yes', 0), 'SawNo': sc['saw_cue'].get('no', 0), 'SawUnsure': sc['saw_cue'].get('unsure', 0),
        'LagMin': fmt(sc['cue_target_actual_ms'].get('min')), 'LagMax': fmt(sc['cue_target_actual_ms'].get('max')),
        'CueOnMin': fmt(sc['cue_on_actual_ms'].get('min')), 'CueOnMax': fmt(sc['cue_on_actual_ms'].get('max')),
        'TrialsPerCond': f['target_trials_per_condition'],
        'NStarted': '--' if res['completion']['n_started'] is None else res['completion']['n_started'],
        'NCompletedOfStarted': '--' if res['completion']['n_completed_of_started'] is None else res['completion']['n_completed_of_started'],
        'CompletionPct': fmt_pct(res['completion']['rate']),
        'ResVerdict': '지지되었다' if c.get('supported') else '지지되지 않았다',
        'ResSupported': '1' if c.get('supported') else '0',
    }
    lines = ['% 자동 생성 파일: analysis/run_analysis.py. 손으로 고치지 말 것.',
             f'% 생성 시각 {res["generated_at"]}, 입력 {res["input"]}, 사전 등록 v{PREREG["version"]}']
    lines += [r'\newcommand{\%s}{%s}' % (k, v) for k, v in mac.items()]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def write_table(pp: pd.DataFrame, path: Path):
    def row(name, s):
        q1, q3 = s.quantile([0.25, 0.75])
        return f'{name} & {s.median():.1f} & {s.mean():.1f} & {s.std(ddof=1):.1f} & {q1:.1f}--{q3:.1f} \\\\'

    body = [
        r'\begin{tabular}{lrrrr}', r'\toprule',
        r'조건 & 중앙값 & 평균 & 표준편차 & 사분위 범위 \\', r'\midrule',
        row('경고 신호 없음', pp['median_nocue']), row('경고 신호 있음', pp['median_cue']), r'\midrule',
        row('차이(있음 $-$ 없음)', pp['diff']), r'\bottomrule', r'\end{tabular}',
    ]
    path.write_text('\n'.join(body) + '\n', encoding='utf-8')


def plot(pp: pd.DataFrame, res, fig_dir: Path, simulated: bool):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    for fam in ['Noto Sans CJK KR', 'Apple SD Gothic Neo', 'AppleGothic', 'Malgun Gothic', 'NanumGothic']:
        if any(fam == f.name for f in font_manager.fontManager.ttflist):
            plt.rcParams['font.family'] = fam
            break
    plt.rcParams.update({
        'axes.unicode_minus': False, 'font.size': 9, 'axes.spines.top': False, 'axes.spines.right': False,
        'axes.edgecolor': '#52514e', 'axes.labelcolor': '#0b0b0b', 'xtick.color': '#52514e',
        'ytick.color': '#52514e', 'pdf.fonttype': 42,
    })
    CUE, NOCUE, INK, MUTED, GRID = '#2a78d6', '#eb6834', '#0b0b0b', '#8a8984', '#e6e5e1'
    fig_dir.mkdir(parents=True, exist_ok=True)

    def mark(ax):
        if simulated:
            ax.text(0.5, 0.5, 'SIMULATED — NOT REAL DATA', transform=ax.transAxes, ha='center', va='center',
                    fontsize=14, color='#e34948', alpha=0.35, rotation=20)

    # 그림 1: 참가자별 대응 비교
    fig, ax = plt.subplots(figsize=(3.4, 3.2))
    for _, r in pp.iterrows():
        ax.plot([0, 1], [r['median_nocue'], r['median_cue']], color=MUTED, lw=0.8, alpha=0.6, zorder=1)
    ax.scatter(np.zeros(len(pp)), pp['median_nocue'], s=18, color=NOCUE, edgecolor='white', lw=0.8, zorder=2)
    ax.scatter(np.ones(len(pp)), pp['median_cue'], s=18, color=CUE, edgecolor='white', lw=0.8, zorder=2)
    gm = [pp['median_nocue'].median(), pp['median_cue'].median()]
    ax.plot([0, 1], gm, color=INK, lw=2, zorder=3)
    for x, y in zip([0, 1], gm):
        ax.text(x + (-0.08 if x == 0 else 0.08), y, f'{y:.0f}', ha='right' if x == 0 else 'left', va='center',
                color=INK, fontsize=8)
    ax.set_xticks([0, 1], ['경고 신호 없음', '경고 신호 있음'])
    ax.set_xlim(-0.45, 1.45)
    ax.set_ylabel('참가자별 반응시간 중앙값 (ms)')
    ax.yaxis.grid(True, color=GRID, lw=0.6)
    ax.set_axisbelow(True)
    mark(ax)
    fig.tight_layout()
    fig.savefig(fig_dir / 'fig_paired.pdf')
    fig.savefig(fig_dir / 'fig_paired.png', dpi=200)
    plt.close(fig)

    # 그림 2: 참가자별 차이 분포 + Hodges–Lehmann 추정치와 95% CI
    c = res['confirmatory']
    d = np.sort(pp['diff'].to_numpy())
    fig, ax = plt.subplots(figsize=(3.4, 2.6))
    y = np.arange(len(d))
    ax.axvline(0, color=MUTED, lw=1, ls=(0, (3, 2)))
    lo, hi = c['hl_ci95']
    ax.axvspan(lo, hi, color=CUE, alpha=0.12, lw=0)
    ax.axvline(c['hl_estimate'], color=CUE, lw=2)
    ax.scatter(d, y, s=16, color=INK, zorder=3)
    ax.set_yticks([])
    ax.spines['left'].set_visible(False)
    ax.set_xlabel('차이: 신호 있음 − 신호 없음 (ms)\n음수일수록 경고 신호가 있을 때 빠름')
    ax.annotate(f"HL 추정치 {c['hl_estimate']:.1f}\n(음영: 95% CI)", xy=(hi, len(d) - 1), xytext=(4, 0),
                textcoords='offset points', color=INK, fontsize=7.5, va='top', ha='left')
    mark(ax)
    fig.tight_layout()
    fig.savefig(fig_dir / 'fig_diff.pdf')
    fig.savefig(fig_dir / 'fig_diff.png', dpi=200)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=str(ROOT / 'data/raw'))
    ap.add_argument('--out', default=str(ROOT / 'analysis/output'))
    ap.add_argument('--paper', default=str(ROOT / 'paper'))
    ap.add_argument('--window', default=str(ROOT / 'analysis/collection_window.json'))
    ap.add_argument('--allow-simulated', action='store_true', help='파이프라인 점검용. 결과물에 SIMULATED 표시가 붙는다.')
    a = ap.parse_args()

    data = Path(a.data)
    trials = pd.read_csv(data / 'trials.csv')
    rounds = pd.read_csv(data / 'rounds.csv')
    simulated = rounds['player_id'].astype(str).str.startswith('SIM').any()
    if simulated and not a.allow_simulated:
        raise SystemExit('가상(SIM) 데이터가 섞여 있습니다. 실제 분석에는 쓸 수 없습니다.')
    window = load_window(Path(a.window), required=not simulated)

    main_df, analyzed, excl = apply_exclusions(trials, rounds, window)
    pp = per_participant(main_df, analyzed)
    tgt = main_df[main_df['player_id'].isin(analyzed) & ~main_df['is_catch'].map(truthy)]
    real = rounds[~rounds['pilot'].map(truthy)]
    fin = pd.to_datetime(rounds.loc[rounds['player_id'].isin(analyzed), 'finished_at'], utc=True)
    kst = fin.dt.tz_convert('Asia/Seoul') if len(fin) else fin
    excl_counts = {**excl[excl['unit'] == 'round']['reason'].value_counts().to_dict(),
                   **excl[excl['unit'] == 'player']['reason'].value_counts().to_dict()}

    res = {
        'generated_at': datetime.now().astimezone().isoformat(timespec='seconds'),
        'input': str(data.relative_to(ROOT)) if data.is_relative_to(ROOT) else str(data),
        'simulated': bool(simulated),
        'prereg': PREREG,
        'collection_window': window['raw'] if window else None,
        'flow': {
            'rounds_all': int(len(real)),
            'players_all': int(real['player_id'].nunique()),
            'recruited': int(main_df['player_id'].nunique()),   # 판 단위 제외 뒤 판이 하나라도 남은 참가자
            'analyzed': len(analyzed),
            'excluded_by_reason': excl_counts,
            'rounds_of_analyzed': int(main_df.loc[main_df['player_id'].isin(analyzed), 'round_id'].nunique()),
            'rounds_per_player_median': float(pp['n_rounds'].median()) if len(pp) else None,
            'rounds_per_player_max': int(pp['n_rounds'].max()) if len(pp) else 0,
            'players_one_round': int((pp['n_rounds'] == 1).sum()) if len(pp) else 0,
            'target_trials_of_analyzed': int(len(tgt)),
            'target_trials_per_condition': int((tgt['condition'] == 'cue').sum()),
            'target_trials_excluded': int((~tgt['valid']).sum()),
            'target_trials_excluded_pct': float((~tgt['valid']).mean() * 100) if len(tgt) else None,
            'trial_exclusions_by_reason': tgt['exclusion'].value_counts().to_dict(),
            'collection_start': (window['raw']['start_kst'] if window else (kst.min().strftime('%Y-%m-%d') if len(kst) else '--')),
            'collection_end': (window['raw']['end_kst'] if window else (kst.max().strftime('%Y-%m-%d') if len(kst) else '--')),
            'input_types': pp['input_type'].value_counts().to_dict() if len(pp) else {},
        },
        'confirmatory': confirmatory(pp) if len(pp) else {'n': 0, 'error': 'no participants', 'supported': False},
        'sensitivity_power': {'min_detectable_dz': min_detectable_dz(len(pp)),
                              'note': 'one-sided paired t, alpha .05, power .80 (주 검정인 Wilcoxon 기준이 아님)'},
        'sensitivity': sensitivity(trials, rounds, window) if len(pp) >= 2 else
        {k: {} for k in ('rt_floor_150', 'trimmed_mean_10', 'first_round_only', 'min10_per_condition')},
        'strategy': strategy_checks(main_df, analyzed, rounds),
        'completion': completion(data, rounds, window),
        'exploratory': exploratory(pp, rounds) if len(pp) else {},
    }

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'results.json').write_text(json.dumps(res, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    pp.to_csv(out / 'participants.csv', index=False)
    excl.to_csv(out / 'exclusions.csv', index=False)

    paper = Path(a.paper)
    if len(pp) >= 2:
        write_tex(res, paper / 'generated/results.tex', simulated)
        write_table(pp, paper / 'generated/table_desc.tex')
        plot(pp, res, paper / 'figures', simulated)
    else:
        print('분석 가능 인원이 2명 미만이라 논문 수치·그림을 만들지 않았습니다. 사전 등록 §2에 따라 기술통계만 보고합니다.')

    print(json.dumps({'flow': res['flow'], 'confirmatory': res['confirmatory'], 'sensitivity': res['sensitivity'],
                      'strategy': res['strategy']}, ensure_ascii=False, indent=2, default=str))


if __name__ == '__main__':
    main()
