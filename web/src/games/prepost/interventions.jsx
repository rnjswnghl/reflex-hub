import { useEffect, useRef, useState } from 'react';

// 전후 비교 게임의 '가운데' 단계. arm='i'면 개입, 'c'면 같은 시간 동안 회색 화면(비교군).
export const VARIANTS = {
  green: {
    label: '초록 풍경',
    short: '초록 풍경',
    seconds: 40,
    howto: '40초 동안 초록 들판을 바라보기',
    why: '도시 건물 사이 초록 지붕을 40초 바라본 사람이 그 뒤 주의력 과제에서 실수가 줄고 반응이 더 일정했다는 연구가 있어요. 그런데 반응 속도는 초록·회색 모두 똑같이 빨라졌대요. 여러분도 그럴까요?',
    ref: '참고: Lee, Williams, Sargent, Williams & Johnson (2015). 40-second green roof views sustain attention. Journal of Environmental Psychology, 42, 182–189.',
  },
  breath: {
    label: '심호흡',
    short: '심호흡',
    seconds: 32,
    howto: '원을 따라 4초 들이쉬고 4초 내쉬기, 네 번',
    why: '긴장될 때 숨을 고르라는 말, 반응속도에도 통할까요? 확실한 연구 결론이 있는 건 아니라서 다 같이 확인해 보는 중이에요.',
  },
  warmup: {
    label: '손가락 예열',
    short: '예열',
    seconds: 10,
    howto: '10초 동안 버튼을 최대한 빨리 연타',
    why: '운동 전에 몸을 풀듯, 손가락을 먼저 풀면 반응이 빨라질까요? 아니면 지쳐서 느려질까요?',
  },
};

function useCountdown(seconds, onDone) {
  const [left, setLeft] = useState(seconds);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const l = Math.max(0, seconds - Math.floor((performance.now() - start) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(id);
        done.current();
      }
    }, 200);
    return () => clearInterval(id);
  }, [seconds]);
  return left;
}

export function Intervention({ variant, arm, onDone }) {
  const left = useCountdown(variant.seconds, onDone);
  if (arm === 'c')
    return (
      <div className="mid control">
        <p className="mid-title">비교군 · 회색 화면</p>
        <p className="mid-sub">화면을 편하게 바라보며 기다려 주세요</p>
        <span className="mid-left">{left}</span>
      </div>
    );
  if (variant === VARIANTS.green)
    return (
      <div className="mid meadow" aria-label="초록 들판">
        <div className="hill h1" />
        <div className="hill h2" />
        <div className="hill h3" />
        <div className="flowers" />
        <span className="mid-left light">{left}</span>
      </div>
    );
  if (variant === VARIANTS.breath) return <Breath left={left} />;
  return <Warmup left={left} />;
}

function Breath({ left }) {
  const phase = Math.floor((32 - left) / 4) % 2 === 0 ? 'in' : 'out';
  return (
    <div className="mid breath">
      <div className={`breath-ring ${phase}`} />
      <p className="mid-title">{phase === 'in' ? '들이쉬기' : '내쉬기'}</p>
      <span className="mid-left">{left}</span>
    </div>
  );
}

function Warmup({ left }) {
  const [n, setN] = useState(0);
  return (
    <div className="mid warm">
      <p className="mid-title">{n}번</p>
      <button
        className="tap-pad"
        onPointerDown={(e) => {
          e.preventDefault();
          setN((x) => x + 1);
        }}
      >
        연타!
      </button>
      <span className="mid-left">{left}</span>
    </div>
  );
}
