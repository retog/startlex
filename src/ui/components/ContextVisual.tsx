import type { StimulusCategory } from '../../core/types';
import { Balloon } from './Balloon';

export type VisualState = 'idle' | 'waiting' | 'burst';

interface ContextVisualProps {
  category: StimulusCategory;
  state: VisualState;
  /** 0..1 relative position of the event inside the game area. */
  x: number;
  y: number;
  color: string;
  /** Tap handler for user-initiated modes; undefined disables interaction. */
  onTrigger?: () => void;
  label: string;
}

/**
 * Renders the visual event matching the sound category:
 * balloons, a launching firework, or an abstract impulse orb
 * (door closing / dropped object — friendly abstract shapes by design).
 */
export function ContextVisual(props: ContextVisualProps) {
  switch (props.category) {
    case 'distant-firework':
      return <Firework {...props} />;
    case 'balloon-pop':
      return (
        <Balloon
          x={props.x}
          y={props.y}
          color={props.color}
          popping={props.state === 'burst'}
          onPop={props.onTrigger}
          label={props.label}
        />
      );
    default:
      return <ImpulseOrb {...props} />;
  }
}

function Firework({ state, x, y, color, onTrigger, label }: ContextVisualProps) {
  if (state === 'burst') {
    return (
      <div
        className="firework-burst"
        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 120 120">
          <g stroke={color} strokeWidth="4" strokeLinecap="round">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i * Math.PI) / 6;
              return (
                <line
                  key={i}
                  x1={60 + Math.cos(a) * 14}
                  y1={60 + Math.sin(a) * 14}
                  x2={60 + Math.cos(a) * 54}
                  y2={60 + Math.sin(a) * 54}
                />
              );
            })}
          </g>
          <circle cx="60" cy="60" r="8" fill="#fff" opacity="0.8" />
        </svg>
      </div>
    );
  }
  if (state === 'waiting') {
    return (
      <div
        className="firework-rocket rising"
        style={{ left: `${x * 100}%`, ['--target-top' as string]: `${y * 100}%` }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 48">
          <rect x="9" y="4" width="6" height="24" rx="3" fill={color} />
          <polygon points="12,0 8,8 16,8" fill={color} />
          <polygon points="12,28 7,40 12,34 17,40" fill="#ffd280" />
        </svg>
      </div>
    );
  }
  // idle: launch pad at the bottom of the night sky
  return (
    <button
      type="button"
      className="firework-pad"
      onClick={onTrigger}
      disabled={!onTrigger}
      aria-label={label}
    >
      <svg viewBox="0 0 48 56" aria-hidden="true">
        <rect x="21" y="8" width="6" height="26" rx="3" fill="#ff8fa3" />
        <polygon points="24,2 19,12 29,12" fill="#ff8fa3" />
        <rect x="12" y="40" width="24" height="6" rx="2" fill="#454e7d" />
        <rect x="22" y="34" width="4" height="8" fill="#454e7d" />
      </svg>
    </button>
  );
}

function ImpulseOrb({ state, x, y, color, onTrigger, label }: ContextVisualProps) {
  return (
    <button
      type="button"
      className={`impulse-orb${state === 'burst' ? ' bursting' : ''}${
        state === 'waiting' ? ' waiting' : ''
      }`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      onClick={onTrigger}
      disabled={!onTrigger || state !== 'idle'}
      aria-label={label}
    >
      <svg viewBox="0 0 96 96" aria-hidden="true">
        {state === 'burst' ? (
          <g stroke={color} strokeWidth="5" strokeLinecap="round">
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <line
                  key={i}
                  x1={48 + Math.cos(a) * 12}
                  y1={48 + Math.sin(a) * 12}
                  x2={48 + Math.cos(a) * 42}
                  y2={48 + Math.sin(a) * 42}
                />
              );
            })}
          </g>
        ) : (
          <>
            <circle cx="48" cy="48" r="34" fill={color} />
            <circle cx="48" cy="48" r="34" fill="none" stroke="#fff" strokeWidth="2" opacity="0.25" />
            <circle cx="38" cy="36" r="9" fill="#fff" opacity="0.3" />
          </>
        )}
      </svg>
    </button>
  );
}
