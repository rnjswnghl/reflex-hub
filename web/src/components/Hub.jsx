import { useEffect, useState } from 'react';
import { GAMES, TIMING_TARGETS } from '../games/index.js';
import { fetchStats } from '../lib/api.js';
import { getPlayer, nickName, rerollNick } from '../lib/player.js';
import GameIcon from './GameIcon.jsx';

function cardMeta(g, player) {
  if (g.kind === 'prepost') {
    const d = player.last?.[g.id];
    return d == null ? '도전 전' : `지난번 ${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}ms`;
  }
  if (g.id === 'timing') {
    // 목표 시간별 기록 중 하나라도 있으면, 가장 최근에 고른 목표의 기록을 보여 준다
    const done = TIMING_TARGETS.filter((t) => player.best[`timing-${t}`] != null);
    if (!done.length) return '도전 전';
    let t = done[0];
    try {
      const last = Number(localStorage.getItem('reflexhub.timing.target'));
      if (done.includes(last)) t = last;
    } catch {
      /* 무시 */
    }
    return `${t}초 ${g.format(player.best[`timing-${t}`])}`;
  }
  return player.best[g.id] != null ? `최고 ${g.format(player.best[g.id])}` : '도전 전';
}

function Card({ g, player, onPlay }) {
  return (
    <button className={`card hue-${g.hue}`} data-game={g.id} onClick={() => onPlay(g.id)}>
      <GameIcon id={g.id} />
      <span className="card-title">
        {g.title}
        {g.subtitle && <span className="card-sub">{g.subtitle}</span>}
      </span>
      <span className="card-tag">{g.tagline}</span>
      <span className="card-meta">
        <span>약 {g.seconds}초</span>
        <span>{cardMeta(g, player)}</span>
      </span>
    </button>
  );
}

export default function Hub({ onPlay }) {
  const [player, setPlayer] = useState(getPlayer());
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchStats()
      .then((s) => alive && s.ok && setStats(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="hub">
      <header className="hub-head">
        <div className="logo">
          <span className="bolt" aria-hidden="true" />
          REFLEX<b>HUB</b>
        </div>
        <button className="nick" onClick={() => setPlayer(rerollNick())} title="닉네임 바꾸기">
          {nickName(player.nick)} <span aria-hidden="true">↻</span>
        </button>
      </header>

      <section className="hero">
        <h1>
          손은 빠른데,
          <br />
          머리도 빠를까?
        </h1>
        <p>한 판 15~40초. 기록 깨고 순위 올리기.</p>
        {stats && (
          <p className="live">
            <span className="dot" aria-hidden="true" />
            지금 {stats.active_now}명 플레이 중 · 오늘 {stats.today_plays}판
          </p>
        )}
      </section>

      <h2 className="section-title">기록 도전</h2>
      <section className="cards">
        {GAMES.filter((g) => g.kind === 'record').map((g) => (
          <Card key={g.id} g={g} player={player} onPlay={onPlay} />
        ))}
      </section>

      <h2 className="section-title">
        전후 비교 실험실 <small>무언가를 하기 전과 후, 내 반응은 달라질까?</small>
      </h2>
      <section className="cards">
        {GAMES.filter((g) => g.kind === 'prepost').map((g) => (
          <Card key={g.id} g={g} player={player} onPlay={onPlay} />
        ))}
      </section>

      <footer className="hub-foot">
        플레이 기록(점수·반응시간·기기 종류)은 이름 없이 저장되어 순위표와 반응속도 연구에 쓰여요.
      </footer>
    </main>
  );
}
