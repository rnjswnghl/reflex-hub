// 미니게임 목록. 점수는 모두 ms 단위, 낮을수록 좋다 (순위표 공통 규칙).

const sec = (ms) => `${(ms / 1000).toFixed(2)}초`;

export const GAMES = [
  {
    id: 'reaction',
    title: '번개 반사',
    tagline: '노란 원이 뜨는 순간, 터치!',
    seconds: 40,
    hue: 'amber',
    format: (ms) => `${ms} ms`,
    scoreNote: '평균 반응시간 + 실수 1번당 100ms',
  },
  {
    id: 'stroop',
    title: '컬러 함정',
    tagline: '글자 말고, 글자 색을 골라라',
    seconds: 20,
    hue: 'rose',
    format: sec,
    scoreNote: '12문제 걸린 시간 + 오답 1개당 1초',
  },
  {
    id: 'schulte',
    title: '1 → 16',
    tagline: '숫자를 순서대로 빠르게 터치',
    seconds: 20,
    hue: 'teal',
    format: sec,
    scoreNote: '걸린 시간 + 잘못 누름 1번당 0.5초',
  },
  {
    id: 'timing',
    title: '딱 1초',
    tagline: '눈 감고도 1초를 맞힐 수 있을까',
    seconds: 15,
    hue: 'violet',
    format: (ms) => `±${ms} ms`,
    scoreNote: '3번 시도의 평균 오차',
  },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);
