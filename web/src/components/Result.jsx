import { useEffect, useState } from 'react';
import { fetchBoard, myRank } from '../lib/api.js';
import { getPlayer, nickName } from '../lib/player.js';

// 한 판이 끝난 뒤: 이번 점수, 내 최고, 순위(N명 중 M등, 상위 X%), 상위 10명
export default function Result({ game, score, detail, saving, onAgain, onHome }) {
  const player = getPlayer();
  const myBest = player.best[game.id] ?? null;
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (saving) return;
    let alive = true;
    fetchBoard(game.id)
      .then((b) => alive && setBoard(b))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [game.id, saving]);

  const rank = myRank(board, player.id, myBest);
  const newBest = score != null && score === myBest;

  // 상위 10: 서버 목록 + (아직 반영 전일 수 있는) 내 최고 기록을 합쳐 다시 정렬
  const me = player.id.slice(0, 8);
  const top = board
    ? [...board.all.filter(([pid]) => pid !== me), ...(myBest != null ? [[me, myBest, player.nick]] : [])]
        .sort((a, b) => a[1] - b[1])
        .slice(0, 10)
    : [];

  return (
    <main className={`result hue-${game.hue}`}>
      <p className="eyebrow">{game.title}</p>
      {score != null ? (
        <>
          <div className="big-score">{game.format(score)}</div>
          {newBest && <span className="badge">최고 기록!</span>}
        </>
      ) : (
        <div className="big-score muted">기록 없음</div>
      )}
      {detail && <p className="detail">{detail}</p>}

      <div className="rank-row">
        <div>
          <span className="label">내 최고</span>
          <span className="val">{myBest != null ? game.format(myBest) : '–'}</span>
        </div>
        <div>
          <span className="label">순위</span>
          <span className="val">{saving ? '저장 중…' : rank ? `${rank.total}명 중 ${rank.rank}등` : err ? '–' : '…'}</span>
        </div>
        <div>
          <span className="label">상위</span>
          <span className="val">{rank?.topPct != null ? `${rank.topPct}%` : '–'}</span>
        </div>
      </div>

      <section className="board">
        <h2>순위표</h2>
        {top.length ? (
          <ol>
            {top.map(([pid, s, nick], i) => (
              <li key={pid} className={pid === me ? 'me' : ''}>
                <span className="pos">{i + 1}</span>
                <span className="who">{nickName(nick)}{pid === me ? ' (나)' : ''}</span>
                <span className="pts">{game.format(s)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">{err ? '순위표를 불러오지 못했어요' : saving ? '' : '첫 기록의 주인공이 되어 보세요'}</p>
        )}
        <p className="fine">{game.scoreNote} · 낮을수록 좋아요</p>
      </section>

      <div className="actions">
        <button className="btn primary" onClick={onAgain}>
          한 판 더
        </button>
        <button className="btn ghost" onClick={onHome}>
          다른 게임
        </button>
      </div>
    </main>
  );
}
