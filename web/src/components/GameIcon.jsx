// 게임 카드 아이콘 (인라인 SVG, currentColor)
export default function GameIcon({ id }) {
  const common = { width: 44, height: 44, viewBox: '0 0 44 44', 'aria-hidden': true, className: 'card-icon' };
  if (id === 'reaction')
    return (
      <svg {...common}>
        <circle cx="22" cy="22" r="17" fill="currentColor" opacity="0.18" />
        <path d="M24 6 12 25h9l-2 13 12-19h-9z" fill="currentColor" />
      </svg>
    );
  if (id === 'stroop')
    return (
      <svg {...common}>
        <rect x="5" y="9" width="16" height="12" rx="3" fill="currentColor" />
        <rect x="23" y="9" width="16" height="12" rx="3" fill="currentColor" opacity="0.45" />
        <rect x="5" y="23" width="16" height="12" rx="3" fill="currentColor" opacity="0.45" />
        <rect x="23" y="23" width="16" height="12" rx="3" fill="currentColor" opacity="0.2" />
      </svg>
    );
  if (id === 'schulte')
    return (
      <svg {...common}>
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <rect key={`${r}${c}`} x={6 + c * 11} y={6 + r * 11} width="9" height="9" rx="2" fill="currentColor" opacity={r === 0 && c === 0 ? 1 : 0.3} />
          )),
        )}
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="22" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M22 24V15M18 5h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
