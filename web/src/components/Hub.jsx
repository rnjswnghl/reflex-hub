import { useEffect, useState } from 'react';
import { GAMES } from '../games/index.js';
import { fetchStats } from '../lib/api.js';
import { getPlayer, nickName, rerollNick } from '../lib/player.js';
import GameIcon from './GameIcon.jsx';

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

      <section className="cards">
        {GAMES.map((g) => (
          <button key={g.id} className={`card hue-${g.hue}`} onClick={() => onPlay(g.id)}>
            <GameIcon id={g.id} />
            <span className="card-title">{g.title}</span>
            <span className="card-tag">{g.tagline}</span>
            <span className="card-meta">
              <span>약 {g.seconds}초</span>
              <span>{player.best[g.id] != null ? `최고 ${g.format(player.best[g.id])}` : '도전 전'}</span>
            </span>
          </button>
        ))}
      </section>

      <footer className="hub-foot">
        플레이 기록(점수·반응시간·기기 종류)은 이름 없이 저장되어 순위표와 반응속도 연구에 쓰여요.
      </footer>
    </main>
  );
}
