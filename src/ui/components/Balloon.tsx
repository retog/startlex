interface BalloonProps {
  /** 0..1 relative position inside the game area. */
  x: number;
  y: number;
  color: string;
  popping: boolean;
  /** Tap handler; undefined disables interaction (non-interactive balloon). */
  onPop?: () => void;
  label: string;
}

export function Balloon({ x, y, color, popping, onPop, label }: BalloonProps) {
  return (
    <button
      type="button"
      className={`balloon${popping ? ' popping' : ''}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      onClick={onPop}
      disabled={!onPop || popping}
      aria-label={label}
    >
      <svg viewBox="0 0 96 118" aria-hidden="true">
        {popping ? (
          <g stroke={color} strokeWidth="5" strokeLinecap="round">
            <line x1="48" y1="48" x2="48" y2="12" />
            <line x1="48" y1="48" x2="84" y2="30" />
            <line x1="48" y1="48" x2="88" y2="60" />
            <line x1="48" y1="48" x2="76" y2="90" />
            <line x1="48" y1="48" x2="48" y2="96" />
            <line x1="48" y1="48" x2="20" y2="90" />
            <line x1="48" y1="48" x2="8" y2="60" />
            <line x1="48" y1="48" x2="12" y2="30" />
          </g>
        ) : (
          <>
            <ellipse cx="48" cy="44" rx="38" ry="44" fill={color} />
            <ellipse cx="34" cy="28" rx="10" ry="14" fill="#ffffff" opacity="0.35" />
            <polygon points="48,86 42,96 54,96" fill={color} />
            <path d="M48 96 Q 40 106 48 116" stroke={color} strokeWidth="2" fill="none" />
          </>
        )}
      </svg>
    </button>
  );
}

export const BALLOON_COLORS = ['#ff8fa3', '#7aa7ff', '#7fd8a5', '#ffd280', '#c9a2ff'];
