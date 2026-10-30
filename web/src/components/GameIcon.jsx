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
  if (id === 'green')
    return (
      <svg {...common}>
        <path d="M2 36c8-10 16-12 24-6s12 4 16 2v10H2z" fill="currentColor" />
        <path d="M2 30c10-12 20-14 30-6" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.45" />
        <circle cx="32" cy="11" r="5" fill="currentColor" opacity="0.6" />
      </svg>
    );
  if (id === 'breath')
    return (
      <svg {...common}>
        <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
        <circle cx="22" cy="22" r="11" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="22" cy="22" r="4" fill="currentColor" />
      </svg>
    );
  if (id === 'warmup')
    return (
      <svg {...common}>
        <rect x="8" y="16" width="28" height="22" rx="7" fill="currentColor" />
        <path d="M14 10l2 4M22 6v6M30 10l-2 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="22" cy="24" r="15" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M22 24V15M18 5h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
