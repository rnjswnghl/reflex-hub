// 이 브라우저의 플레이어 정보. 이름·연락처는 받지 않는다. 닉네임은 무작위 조합(형용사+동물)이고 번호로만 저장한다.

const KEY = 'reflexhub.player.v2';

export const ADJ = ['번개', '날쌘', '침착한', '용감한', '졸린', '반짝', '엉뚱한', '느긋한', '재빠른', '조용한', '씩씩한', '배고픈', '수줍은', '단단한', '말랑한', '푸른'];
export const ANIMAL = ['수달', '치타', '고양이', '부엉이', '다람쥐', '여우', '펭귄', '판다', '토끼', '고래', '참새', '거북', '사슴', '두더지', '해달', '너구리'];

export function nickName(nick) {
  if (!Array.isArray(nick)) return '익명';
  const [a, b] = nick;
  return `${ADJ[a] ?? '?'} ${ANIMAL[b] ?? '?'}`;
}

export function uuid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    })
  );
}

const rint = (n) => crypto.getRandomValues(new Uint8Array(1))[0] % n;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}
function write(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 저장 불가 환경(시크릿 모드 등)에서는 이번 방문 동안만 유지 */
  }
}

let memo = null;
export function getPlayer() {
  if (memo) return memo;
  memo = read() ?? {
    id: uuid(),
    nick: [rint(ADJ.length), rint(ANIMAL.length)],
    consent: false,
    rounds: {},   // 게임별 완료 판 수
    best: {},     // 게임별 최고 점수(ms, 낮을수록 좋음)
    sawCueAsked: false,
  };
  return memo;
}
export function savePlayer(patch) {
  memo = { ...getPlayer(), ...patch };
  write(memo);
  return memo;
}
export function rerollNick() {
  return savePlayer({ nick: [rint(ADJ.length), rint(ANIMAL.length)] });
}
export function recordRound(game, score) {
  const p = getPlayer();
  const rounds = { ...p.rounds, [game]: (p.rounds[game] ?? 0) + 1 };
  const best = { ...p.best };
  if (score != null && (best[game] == null || score < best[game])) best[game] = score;
  return savePlayer({ rounds, best });
}

// 연구자 점검용: 주소에 ?pilot=1 → 서버가 pilot/ 경로에 따로 저장, 순위표·분석 제외
export function isPilot() {
  try {
    return new URLSearchParams(window.location.search).get('pilot') === '1';
  } catch {
    return false;
  }
}
