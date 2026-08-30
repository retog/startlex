interface RatingScaleProps {
  label: string;
  lowAnchor: string;
  highAnchor: string;
  value: number | null;
  onChange(value: number): void;
}

/** 0–10 rating input as large tappable buttons (touch/mouse/keyboard). */
export function RatingScale({ label, lowAnchor, highAnchor, value, onChange }: RatingScaleProps) {
  return (
    <div role="group" aria-label={label}>
      <p>{label}</p>
      <div className="rating-scale">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={value === i}
            onClick={() => onChange(i)}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="rating-anchors dim small">
        <span>{lowAnchor}</span>
        <span>{highAnchor}</span>
      </div>
    </div>
  );
}
