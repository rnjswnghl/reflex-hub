// 미니게임 목록. 기록 게임의 점수는 모두 ms 단위, 낮을수록 좋다 (순위표 공통 규칙).
// kind: 'record' = 점수로 순위표, 'prepost' = 전후 비교 실험실(순위 대신 비교군과 견줌)

const sec = (ms) => `${(ms / 1000).toFixed(2)}초`;
const ms = (x) => `${Math.round(x)}ms`;

export const TIMING_TARGETS = [1, 3, 5, 10];

export const GAMES = [
  {
    id: 'reaction',
    kind: 'record',
    title: '번개 반사',
    tagline: '노란 원이 뜨는 순간, 터치!',
    seconds: 40,
    hue: 'amber',
    format: (x) => `${x} ms`,
    delta: ms,
    noun: '기록',
    scoreNote: '평균 반응시간 + 실수 1번당 100ms',
  },
  {
    id: 'stroop',
    kind: 'record',
    title: '컬러 함정',
    tagline: '글자 말고, 글자 색을 골라라',
    seconds: 20,
    hue: 'rose',
    format: sec,
    delta: sec,
    noun: '기록',
    scoreNote: '12문제 걸린 시간 + 오답 1개당 1초',
  },
  {
    id: 'schulte',
    kind: 'record',
    title: '1 → 16',
    tagline: '숫자를 순서대로 빠르게 터치',
    seconds: 20,
    hue: 'teal',
    format: sec,
    delta: sec,
    noun: '기록',
    scoreNote: '걸린 시간 + 잘못 누름 1번당 0.5초',
  },
  {
    id: 'timing',
    kind: 'record',
    title: '딱 N초',
    tagline: '1·3·5·10초, 감으로 멈춰라',
    seconds: 15,
    hue: 'violet',
    format: (x) => `±${x} ms`,
    delta: ms,
    noun: '오차',
    scoreNote: '목표 시간과의 차이',
  },
  {
    id: 'green',
    kind: 'prepost',
    title: '번개 반사 2',
    subtitle: '초록 쉼표',
    tagline: '40초 초록 풍경, 반응이 달라질까?',
    seconds: 85,
    hue: 'lime',
  },
  {
    id: 'breath',
    kind: 'prepost',
    title: '번개 반사 3',
    subtitle: '숨 고르기',
    tagline: '심호흡 30초 뒤의 나는?',
    seconds: 80,
    hue: 'sky',
  },
  {
    id: 'warmup',
    kind: 'prepost',
    title: '번개 반사 4',
    subtitle: '손가락 예열',
    tagline: '10초 연타하고 나면 더 빠를까?',
    seconds: 60,
    hue: 'orange',
  },
];

export const gameById = (id) => GAMES.find((g) => g.id === id);

// 순위표 이름: '딱 N초'는 목표 시간마다 따로
export const boardId = (gameId, variant) => (variant ? `${gameId}-${variant}` : gameId);
