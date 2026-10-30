import { useEffect, useState } from 'react';
import Hub from './components/Hub.jsx';
import { gameById } from './games/index.js';
import ReactionGame from './games/reaction/ReactionGame.jsx';
import SchulteGame from './games/SchulteGame.jsx';
import StroopGame from './games/StroopGame.jsx';
import TimingGame from './games/TimingGame.jsx';
import PrePostGame from './games/prepost/PrePostGame.jsx';
import { flushPending } from './lib/api.js';
import { getPlayer, isPilot, savePlayer } from './lib/player.js';

const COMPONENTS = {
  reaction: ReactionGame,
  stroop: StroopGame,
  schulte: SchulteGame,
  timing: TimingGame,
  green: PrePostGame,
  breath: PrePostGame,
  warmup: PrePostGame,
};

// 해시 라우팅: #/ = 허브, #/play/<게임> (새로고침·뒤로가기·공유 링크가 그대로 동작)
function readRoute() {
  const m = window.location.hash.match(/^#\/play\/(\w+)/);
  return m && COMPONENTS[m[1]] ? m[1] : null;
}

export default function App() {
  const [route, setRoute] = useState(readRoute());
  const [consent, setConsent] = useState(getPlayer().consent);

  useEffect(() => {
    flushPending();
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = (id) => {
    window.location.hash = id ? `#/play/${id}` : '#/';
    window.scrollTo(0, 0);
  };

  const Game = route && COMPONENTS[route];

  return (
    <div className="app">
      {isPilot() && <div className="pilot-bar">파일럿 모드 · 기록은 순위표와 분석에서 빠집니다</div>}
      {Game ? <Game key={route} game={gameById(route)} onHome={() => go(null)} /> : <Hub onPlay={go} />}

      {!consent && (
        <div className="sheet-backdrop">
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="consent-title">
            <h2 id="consent-title">시작하기 전에</h2>
            <p>
              점수와 반응시간, 기기 종류(터치·마우스, 화면 크기, 브라우저)가 <b>이름 없이</b> 저장되어 순위표와 반응속도
              연구 분석에 쓰여요. 이름·연락처는 받지 않아요.
            </p>
            <button
              className="btn primary big"
              onClick={() => {
                savePlayer({ consent: true, consentAt: new Date().toISOString() });
                setConsent(true);
              }}
            >
              좋아요, 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
