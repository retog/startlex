import type { TaskShape as Shape } from '../../games/balloons/starTask';

interface TaskShapeProps {
  x: number;
  y: number;
  shape: Shape;
  onTap(): void;
}

/** Tappable shape for the star distraction task. Only stars score. */
export function TaskShapeButton({ x, y, shape, onTap }: TaskShapeProps) {
  return (
    <button
      type="button"
      className="task-shape"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      onClick={onTap}
      aria-label={shape === 'star' ? 'Catch the star' : `A ${shape} — not a star`}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        {shape === 'star' && (
          <polygon
            points="24,3 30,17 45,18 33,28 37,44 24,35 11,44 15,28 3,18 18,17"
            fill="#ffd280"
          />
        )}
        {shape === 'circle' && <circle cx="24" cy="24" r="17" fill="#7aa7ff" />}
        {shape === 'triangle' && (
          <polygon points="24,5 43,41 5,41" fill="#7fd8a5" />
        )}
      </svg>
    </button>
  );
}
