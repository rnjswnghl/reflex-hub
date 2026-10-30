import { useEffect, useRef, useState } from 'react';
import { fetchBoard } from '../lib/api.js';
import { getPlayer, nickName } from '../lib/player.js';

// 게임 전에도 보는 실시간 순위표. 서버 순위표(CDN 20초 캐시)를 20초마다 다시 읽는다.
// 탭이 숨겨져 있으면 읽지 않는다(저장소 목록 조회 한도 절약).
const POLL_MS = 20_000;
const FRESH_MS = 3_000;

// 서버 목록 + (캐시 때문에 아직 반영 전일 수 있는) 내 최고 기록
export function mergeBoard(board, player, key) {
  const me = player.id.slice(0, 8);
  const myBest = player.best[key] ?? null;
  if (!board) return { entries: [], me, myBest };
  const entries = [...board.all.filter(([pid]) => pid !== me), ...(myBest != null ? [[me, myBest, player.nick]] : [])].sort(
    (a, b) => a[1] - b[1],
  );
  return { entries, me, myBest };
}

export function useLiveBoard(key, { poll = true } = {}) {
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState(false);
  const [fresh, setFresh] = useState(() => new Set()); // 방금 새로 오르거나 기록을 깬 플레이어
  const prev = useRef(null);

  useEffect(() => {
    let alive = true;
    let timer;
    prev.current = null;
    setBoard(null);
    setErr(false);

    async function load() {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const b = await fetchBoard(key);
        if (!alive) return;
        if (prev.current) {
          const old = new Map(prev.current.all.map(([pid, s]) => [pid, s]));
          const moved = b.all.filter(([pid, s]) => !old.has(pid) || s < old.get(pid)).map(([pid]) => pid);
          if (moved.length) {
            setFresh(new Set(moved));
            setTimeout(() => alive && setFresh(new Set()), FRESH_MS);
          }
        }
        prev.current = b;
        setBoard(b);
        setErr(false);
      } catch {
        if (alive && !prev.current) setErr(true);
      }
    }

    load();
    if (poll) timer = setInterval(load, POLL_MS);
    const onVis = () => !document.hidden && load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [key, poll]);

  return { board, err, fresh };
}

export default function LiveBoard({ game, boardKey, limit = 5, title = '실시간 랭킹', compact = false }) {
  const key = boardKey ?? game.id;
  const { board, err, fresh } = useLiveBoard(key);
  const player = getPlayer();
  const { entries, me } = mergeBoard(board, player, key);
  const top = entries.slice(0, limit);
  const myRank = entries.findIndex(([pid]) => pid === me) + 1;

  return (
    <section className={`board live-board hue-${game.hue}${compact ? ' compact' : ''}`} aria-live="polite">
      <div className="lb-head">
        <h2>{title}</h2>
        <span className="lb-live">
          <span className="dot" aria-hidden="true" />
          {board ? `${entries.length}명 도전` : 'LIVE'}
        </span>
      </div>
      {err ? (
        <p className="muted">순위를 불러오지 못했어요.</p>
      ) : !board ? (
        <ol className="skeleton" aria-hidden="true">
          {Array.from({ length: Math.min(limit, 3) }, (_, i) => (
            <li key={i}>
              <span className="pos">{i + 1}</span>
              <span className="who">　</span>
              <span className="pts">　</span>
            </li>
          ))}
        </ol>
      ) : top.length ? (
        <ol>
          {top.map(([pid, s, nick], i) => (
            <li key={pid} className={`${pid === me ? 'me' : ''}${fresh.has(pid) ? ' fresh' : ''}`}>
              <span className="pos">{i + 1}</span>
              <span className="who">
                {nickName(nick)}
                {pid === me ? ' (나)' : ''}
                {fresh.has(pid) && <span className="new-tag">NEW</span>}
              </span>
              <span className="pts">{game.format(s)}</span>
            </li>
          ))}
          {myRank > limit && (
            <li className="me gap">
              <span className="pos">{myRank}</span>
              <span className="who">{nickName(player.nick)} (나)</span>
              <span className="pts">{game.format(entries[myRank - 1][1])}</span>
            </li>
          )}
        </ol>
      ) : (
        <p className="muted">아직 기록이 없어요. 첫 1등이 되어 보세요!</p>
      )}
      {board && top.length > 0 && myRank === 0 && <p className="fine">한 판 하면 내 순위가 여기에 나와요.</p>}
    </section>
  );
}
