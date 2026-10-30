import { useEffect, useState } from 'react';
import { fetchBoard } from '../lib/api.js';
import { getPlayer, nickName } from '../lib/player.js';

// 기록 게임 한 판이 끝난 뒤: 이번 점수, 지금 판의 통계를 문장으로(평균·내 위치), 순위표는 상위 10등까지만
export default function Result({ game, board: boardKey, label, score, detail, saving, onAgain, onHome }) {
  const key = boardKey ?? game.id;
  const player = getPlayer();
  const myBest = player.best[key] ?? null;
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (saving) return;
    let alive = true;
    fetchBoard(key)
      .then((b) => alive && setBoard(b))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [key, saving]);

  // 서버 목록 + (CDN 캐시 때문에 아직 반영 전일 수 있는) 내 최고 기록을 합쳐서 계산
  const me = player.id.slice(0, 8);
  const entries = board
    ? [...board.all.filter(([pid]) => pid !== me), ...(myBest != null ? [[me, myBest, player.nick]] : [])].sort((a, b) => a[1] - b[1])
    : [];
  const top = entries.slice(0, 10);
  const newBest = score != null && score === myBest;

  return (
    <main className={`result hue-${game.hue}`}>
      <p className="eyebrow">
        {game.title}
        {label ? ` · ${label}` : ''}
      </p>
      {score != null ? (
        <>
          <div className="big-score">{game.format(score)}</div>
          {newBest && <span className="badge">최고 기록!</span>}
        </>
      ) : (
        <div className="big-score muted">기록 없음</div>
      )}
      {detail && <p className="detail">{detail}</p>}

      <section className="insight">
        {saving ? <p>기록 저장 중…</p> : err ? <p>순위 정보를 불러오지 못했어요.</p> : board ? <Insight game={game} entries={entries} me={me} myBest={myBest} /> : <p>…</p>}
      </section>

      <section className="board">
        <h2>순위표 · 상위 10</h2>
        {top.length ? (
          <ol>
            {top.map(([pid, s, nick], i) => (
              <li key={pid} className={pid === me ? 'me' : ''}>
                <span className="pos">{i + 1}</span>
                <span className="who">
                  {nickName(nick)}
                  {pid === me ? ' (나)' : ''}
                </span>
                <span className="pts">{game.format(s)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">{saving ? '' : '첫 기록의 주인공이 되어 보세요'}</p>
        )}
        <p className="fine">{game.scoreNote} · 낮을수록 좋아요 · 한 사람당 최고 기록 하나</p>
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

// 통계를 숫자 칸 대신 문장으로
function Insight({ game, entries, me, myBest }) {
  const n = entries.length;
  if (!n || myBest == null) return <p>아직 순위에 오른 기록이 없어요.</p>;
  const avg = entries.reduce((s, [, v]) => s + v, 0) / n;
  const rank = entries.findIndex(([pid]) => pid === me) + 1;
  const pct = Math.max(1, Math.ceil((rank / n) * 100));
  const gap = avg - myBest; // 양수 = 평균보다 좋음
  const noun = game.noun;

  return (
    <>
      <p>
        지금까지 <b>{n}명</b>이 도전했고, 모두의 최고 {noun} 평균은 <b>{game.format(Math.round(avg))}</b>예요.
      </p>
      <p>
        내 최고 {noun}{noun === '오차' ? '는' : '은'} <b>{game.format(myBest)}</b>로, <b>{n}명 중 {rank}등</b>
        {n >= 5 ? (
          <>
            , <b>상위 {pct}%</b>
          </>
        ) : null}
        {n === 1 ? '이에요. 아직 혼자라 1등이에요!' : '이에요.'}
      </p>
      {n > 1 && Math.abs(gap) >= 1 && (
        <p>
          평균보다 {noun === '오차' ? '오차가 ' : ''}
          <b>{game.delta(Math.abs(gap))}</b> {gap > 0 ? (noun === '오차' ? '작아요.' : '빨라요.') : noun === '오차' ? '커요.' : '느려요.'}
          {rank === 1 ? ' 지금 1위예요!' : rank <= 10 ? ' 상위 10위 안이에요.' : ` 10위까지 ${game.delta(myBest - entries[9][1])} 남았어요.`}
        </p>
      )}
      {n < 5 && n > 1 && <p className="muted">아직 도전자가 적어서 순위가 금방 바뀔 수 있어요.</p>}
    </>
  );
}
