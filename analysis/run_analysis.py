"""사전 등록한 분석(docs/04-preregistration.md)을 그대로 실행한다.

입력:  data/raw/trials.csv, data/raw/sessions.csv  (build_dataset.py가 만든 원자료)
출력:  analysis/output/results.json        모든 수치
       analysis/output/participants.csv    참가자별 조건 중앙값과 차이
       analysis/output/exclusions.csv      참가자 제외 사유 기록
       paper/generated/results.tex         논문 본문이 \\input 하는 수치 매크로
       paper/generated/table_desc.tex      기술통계 표
       paper/figures/fig_paired.pdf, fig_diff.pdf

이 파일의 '확증 분석' 부분(PREREG 상수와 confirmatory())은 데이터 수집 전에 고정했다.
고쳐야 하면 고친 날짜·이유를 docs/03-design.md '설계 변경 기록'에 남기고, 고치기 전 결과도 함께 보고한다.
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
    'main_trials_per_participant': 40,
    'rt_min_ms': 100,          # 이보다 빠른 반응은 자극을 보고 낸 반응으로 보기 어려움(예측 반응)
    'rt_max_ms': 1500,         # 반응 창. 넘으면 주의 이탈(timeout)
    'min_valid_total': 30,     # 본 시행 40회 중 유효 30회 미만(제외율 25% 초과)이면 참가자 제외
    'min_valid_per_condition': 10,
    'alpha': 0.05,
    'bootstrap_resamples': 10_000,
    'seed': 20261030,
}


# ---- 1. 제외 ------------------------------------------------------------------------
def apply_exclusions(trials: pd.DataFrame, sessions: pd.DataFrame):
    P = PREREG
    log = []
    main = trials[trials['block'] == 'main'].copy()

    # 참가자 단위 1차: 재참여, 미완료
    keep = []
    for _, s in sessions.iterrows():
        sid = s['session_id']
        n_main = int((main['session_id'] == sid).sum())
        if str(s.get('repeat_participation')).strip().lower() == 'true':
            log.append({'session_id': sid, 'reason': 'repeat_participation', 'detail': ''})
        elif n_main != P['main_trials_per_participant']:
            log.append({'session_id': sid, 'reason': 'incomplete', 'detail': f'main_rows={n_main}'})
        else:
            keep.append(sid)
    main = main[main['session_id'].isin(keep)].copy()

    # 시행 단위
    hidden = main['hidden_during_trial'].astype(str).str.lower() == 'true'
    rt = pd.to_numeric(main['rt_ms'], errors='coerce')
    reason = np.select(
        [
            main['status'] == 'anticipation',
            main['status'] == 'timeout',
            hidden,
            rt < P['rt_min_ms'],
            rt > P['rt_max_ms'],
        ],
        ['anticipation', 'timeout', 'hidden_tab', 'rt_below_min', 'rt_above_max'],
        default='valid',
    )
    main['exclusion'] = reason
    main['rt_ms'] = rt

    # 참가자 단위 2차: 유효 시행 부족
    analyzed = []
    for sid, g in main.groupby('session_id'):
        v = g[g['exclusion'] == 'valid']
        per = v['condition'].value_counts()
        if len(v) < P['min_valid_total'] or min(per.get('cue', 0), per.get('nocue', 0)) < P['min_valid_per_condition']:
            log.append({'session_id': sid, 'reason': 'too_few_valid_trials',
                        'detail': f"valid={len(v)} cue={per.get('cue', 0)} nocue={per.get('nocue', 0)}"})
        else:
            analyzed.append(sid)
    return main, analyzed, pd.DataFrame(log, columns=['session_id', 'reason', 'detail'])


# ---- 2. 참가자별 요약 ---------------------------------------------------------------
def per_participant(main: pd.DataFrame, analyzed):
    v = main[(main['exclusion'] == 'valid') & main['session_id'].isin(analyzed)]
    rows = []
    for sid, g in v.groupby('session_id'):
        cue = g.loc[g['condition'] == 'cue', 'rt_ms']
        noc = g.loc[g['condition'] == 'nocue', 'rt_ms']
        rows.append({
            'session_id': sid,
            'median_cue': cue.median(),
            'median_nocue': noc.median(),
            'diff': cue.median() - noc.median(),   # 음수 = 경고 신호가 있을 때 더 빠름
            'n_valid_cue': len(cue),
            'n_valid_nocue': len(noc),
            'input_type': g['input_type'].mode().iat[0],
            'mixed_input': g['input_type'].nunique() > 1,
        })
    return pd.DataFrame(rows)


# ---- 3. 확증 분석 (사전 등록) -------------------------------------------------------
def confirmatory(pp: pd.DataFrame):
    P = PREREG
    d = pp['diff'].to_numpy()
    n = len(d)
    out = {'n': n}
    if n < 2:
        out['error'] = '분석 가능한 참가자가 2명 미만'
        return out

    w = stats.wilcoxon(d, alternative='less')
    t = stats.ttest_1samp(d, 0.0, alternative='less')
    ci = stats.t.interval(0.95, n - 1, loc=d.mean(), scale=stats.sem(d))
    rng = np.random.default_rng(P['seed'])
    boot = np.median(rng.choice(d, size=(P['bootstrap_resamples'], n), replace=True), axis=1)
    k_faster = int((d < 0).sum())
    n_nonzero = int((d != 0).sum())
    sign = stats.binomtest(k_faster, n_nonzero, 0.5, alternative='greater') if n_nonzero else None

    out.update({
        'diff_median': float(np.median(d)),
        'diff_mean': float(d.mean()),
        'diff_sd': float(d.std(ddof=1)),
        'diff_mean_ci95': [float(ci[0]), float(ci[1])],
        'diff_median_boot_ci95': [float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))],
        'wilcoxon_W': float(w.statistic),
        'wilcoxon_p_one_sided': float(w.pvalue),
        't': float(t.statistic),
        't_df': n - 1,
        't_p_one_sided': float(t.pvalue),
        'dz': float(d.mean() / d.std(ddof=1)) if d.std(ddof=1) > 0 else None,
        'k_faster_with_cue': k_faster,
        'n_nonzero': n_nonzero,
        'sign_p_one_sided': float(sign.pvalue) if sign else None,
        'group_median_cue': float(pp['median_cue'].median()),
        'group_median_nocue': float(pp['median_nocue'].median()),
    })
    # 판정 규칙(사전 등록): Wilcoxon 단측 p < α 이고 차이 중앙값 < 0 → 지지
    out['supported'] = bool(out['wilcoxon_p_one_sided'] < P['alpha'] and out['diff_median'] < 0)
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


# ---- 4. 탐색 분석 (사전 등록 아님, 논문에 '탐색'으로 표시) --------------------------
def exploratory(main: pd.DataFrame, analyzed, pp: pd.DataFrame):
    m = main[main['session_id'].isin(analyzed)]
    ant = m[m['exclusion'] == 'anticipation'].groupby('condition').size().reindex(['cue', 'nocue'], fill_value=0)
    by_input = (
        pp.groupby('input_type')['diff']
        .agg(['count', 'median'])
        .reset_index()
        .to_dict(orient='records')
    )
    return {
        'anticipations_by_condition': {k: int(v) for k, v in ant.items()},
        'trials_per_condition': int(PREREG['main_trials_per_participant'] / 2 * len(analyzed)),
        'diff_by_input_type': by_input,
        'mixed_input_participants': int(pp['mixed_input'].sum()),
    }


# ---- 5. 출력 ------------------------------------------------------------------------
def fmt(x, nd=1):
    return '--' if x is None or (isinstance(x, float) and np.isnan(x)) else f'{x:.{nd}f}'


def fmt_p(p):
    if p is None:
        return '--'
    return '< .001' if p < 0.001 else '= ' + f'{p:.3f}'.lstrip('0')


def write_tex(res, path: Path, simulated: bool):
    c, f = res['confirmatory'], res['flow']
    e = res['exploratory']
    lines = [
        '% 자동 생성 파일: analysis/run_analysis.py. 손으로 고치지 말 것.',
        f'% 생성 시각 {res["generated_at"]}, 입력 {res["input"]}',
        r'\newcommand{\ResSimulated}{' + ('1' if simulated else '0') + '}',
        r'\newcommand{\Nrecruited}{' + str(f['recruited']) + '}',
        r'\newcommand{\Nexcluded}{' + str(f['recruited'] - f['analyzed']) + '}',
        r'\newcommand{\NexclRepeat}{' + str(f['excluded_by_reason'].get('repeat_participation', 0)) + '}',
        r'\newcommand{\NexclIncomplete}{' + str(f['excluded_by_reason'].get('incomplete', 0)) + '}',
        r'\newcommand{\NexclFewValid}{' + str(f['excluded_by_reason'].get('too_few_valid_trials', 0)) + '}',
        r'\newcommand{\Nanalyzed}{' + str(f['analyzed']) + '}',
        r'\newcommand{\TrialsAnalyzed}{' + str(f['main_trials_of_analyzed']) + '}',
        r'\newcommand{\TrialsExcluded}{' + str(f['trials_excluded']) + '}',
        r'\newcommand{\TrialsExcludedPct}{' + fmt(f['trials_excluded_pct']) + '}',
        r'\newcommand{\CollectStart}{' + str(f['collection_start']) + '}',
        r'\newcommand{\CollectEnd}{' + str(f['collection_end']) + '}',
        r'\newcommand{\NinputTouch}{' + str(f['input_types'].get('touch', 0)) + '}',
        r'\newcommand{\NinputMouse}{' + str(f['input_types'].get('mouse', 0)) + '}',
        r'\newcommand{\NinputKey}{' + str(f['input_types'].get('keyboard', 0)) + '}',
        r'\newcommand{\MedCue}{' + fmt(c.get('group_median_cue')) + '}',
        r'\newcommand{\MedNocue}{' + fmt(c.get('group_median_nocue')) + '}',
        r'\newcommand{\DiffMedian}{' + fmt(c.get('diff_median')) + '}',
        r'\newcommand{\DiffMean}{' + fmt(c.get('diff_mean')) + '}',
        r'\newcommand{\DiffSD}{' + fmt(c.get('diff_sd')) + '}',
        r'\newcommand{\DiffCIlo}{' + fmt((c.get('diff_mean_ci95') or [None])[0]) + '}',
        r'\newcommand{\DiffCIhi}{' + fmt((c.get('diff_mean_ci95') or [None, None])[1]) + '}',
        r'\newcommand{\BootCIlo}{' + fmt((c.get('diff_median_boot_ci95') or [None])[0]) + '}',
        r'\newcommand{\BootCIhi}{' + fmt((c.get('diff_median_boot_ci95') or [None, None])[1]) + '}',
        r'\newcommand{\Wstat}{' + fmt(c.get('wilcoxon_W')) + '}',
        r'\newcommand{\Wp}{' + fmt_p(c.get('wilcoxon_p_one_sided')) + '}',
        r'\newcommand{\Tstat}{' + fmt(c.get('t'), 2) + '}',
        r'\newcommand{\Tdf}{' + str(c.get('t_df', '--')) + '}',
        r'\newcommand{\Tp}{' + fmt_p(c.get('t_p_one_sided')) + '}',
        r'\newcommand{\Dz}{' + fmt(c.get('dz'), 2) + '}',
        r'\newcommand{\Kfaster}{' + str(c.get('k_faster_with_cue', '--')) + '}',
        r'\newcommand{\Nnonzero}{' + str(c.get('n_nonzero', '--')) + '}',
        r'\newcommand{\SignP}{' + fmt_p(c.get('sign_p_one_sided')) + '}',
        r'\newcommand{\MDEdz}{' + fmt(res['sensitivity']['min_detectable_dz'], 2) + '}',
        r'\newcommand{\AntCue}{' + str(e['anticipations_by_condition']['cue']) + '}',
        r'\newcommand{\AntNocue}{' + str(e['anticipations_by_condition']['nocue']) + '}',
        r'\newcommand{\TrialsPerCond}{' + str(e['trials_per_condition']) + '}',
        r'\newcommand{\ResVerdict}{' + ('지지되었다' if c.get('supported') else '지지되지 않았다') + '}',
        r'\newcommand{\ResSupported}{' + ('1' if c.get('supported') else '0') + '}',
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def write_table(pp: pd.DataFrame, path: Path):
    def row(name, s):
        q1, q3 = s.quantile([0.25, 0.75])
        return f'{name} & {s.median():.1f} & {s.mean():.1f} & {s.std(ddof=1):.1f} & {q1:.1f}--{q3:.1f} \\\\'

    body = [
        r'\begin{tabular}{lrrrr}',
        r'\toprule',
        r'조건 & 중앙값 & 평균 & 표준편차 & 사분위 범위 \\',
        r'\midrule',
        row('경고 신호 없음', pp['median_nocue']),
        row('경고 신호 있음', pp['median_cue']),
        r'\midrule',
        row('차이(있음 $-$ 없음)', pp['diff']),
        r'\bottomrule',
        r'\end{tabular}',
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

    # 그림 2: 참가자별 차이 분포
    c = res['confirmatory']
    d = np.sort(pp['diff'].to_numpy())
    fig, ax = plt.subplots(figsize=(3.4, 2.6))
    y = np.arange(len(d))
    ax.axvline(0, color=MUTED, lw=1, ls=(0, (3, 2)))
    lo, hi = c['diff_median_boot_ci95']
    ax.axvspan(lo, hi, color=CUE, alpha=0.12, lw=0)
    ax.axvline(c['diff_median'], color=CUE, lw=2)
    ax.scatter(d, y, s=16, color=INK, zorder=3)
    ax.set_yticks([])
    ax.spines['left'].set_visible(False)
    ax.set_xlabel('차이: 신호 있음 − 신호 없음 (ms)\n음수일수록 경고 신호가 있을 때 빠름')
    ax.annotate(f"중앙값 {c['diff_median']:.1f}\n(음영: 95% CI)", xy=(hi, len(d) - 1), xytext=(4, 0),
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
    ap.add_argument('--allow-simulated', action='store_true', help='파이프라인 점검용. 결과물에 SIMULATED 표시가 붙는다.')
    a = ap.parse_args()

    data = Path(a.data)
    trials = pd.read_csv(data / 'trials.csv')
    sessions = pd.read_csv(data / 'sessions.csv')
    simulated = sessions['session_id'].astype(str).str.startswith('SIM').any()
    if simulated and not a.allow_simulated:
        raise SystemExit('가상(SIM) 데이터가 섞여 있습니다. 실제 분석에는 쓸 수 없습니다.')

    main_df, analyzed, excl = apply_exclusions(trials, sessions)
    pp = per_participant(main_df, analyzed)
    m_an = main_df[main_df['session_id'].isin(analyzed)]
    started = pd.to_datetime(sessions.loc[sessions['session_id'].isin(analyzed), 'started_at'], utc=True)
    kst = started.dt.tz_convert('Asia/Seoul') if len(started) else started

    res = {
        'generated_at': datetime.now().astimezone().isoformat(timespec='seconds'),
        'input': str(data.relative_to(ROOT)) if data.is_relative_to(ROOT) else str(data),
        'simulated': bool(simulated),
        'prereg': PREREG,
        'flow': {
            'recruited': int(len(sessions)),
            'analyzed': len(analyzed),
            'excluded_by_reason': excl['reason'].value_counts().to_dict(),
            'main_trials_of_analyzed': int(len(m_an)),
            'trials_excluded': int((m_an['exclusion'] != 'valid').sum()),
            'trials_excluded_pct': float((m_an['exclusion'] != 'valid').mean() * 100) if len(m_an) else None,
            'trial_exclusions_by_reason': m_an['exclusion'].value_counts().to_dict(),
            'collection_start': kst.min().strftime('%Y-%m-%d') if len(kst) else '--',
            'collection_end': kst.max().strftime('%Y-%m-%d') if len(kst) else '--',
            'input_types': pp['input_type'].value_counts().to_dict() if len(pp) else {},
        },
        'confirmatory': confirmatory(pp) if len(pp) else {'n': 0, 'error': 'no participants'},
        'sensitivity': {'min_detectable_dz': min_detectable_dz(len(pp)),
                        'note': 'one-sided paired t, alpha .05, power .80'},
        'exploratory': exploratory(main_df, analyzed, pp) if len(pp) else {},
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

    c = res['confirmatory']
    print(json.dumps({'flow': res['flow'], 'confirmatory': c}, ensure_ascii=False, indent=2, default=str))


if __name__ == '__main__':
    main()
