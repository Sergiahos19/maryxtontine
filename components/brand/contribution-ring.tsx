export type RingDayState = "paid" | "partial" | "unpaid" | "today" | "none";

type ContributionRingProps = {
  days: { state: RingDayState; label?: string }[];
  children?: React.ReactNode;
  className?: string;
  /** Décalage (ms) entre l’apparition de deux segments ; 0 pour aucune animation. */
  stagger?: number;
  title: string;
  /** Épaisseur des segments, sur une grille de 200. */
  thickness?: number;
};

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 86;
const STROKE = 13;

const stateStroke: Record<RingDayState, string> = {
  paid: "var(--ring-paid)",
  partial: "var(--ring-paid)",
  unpaid: "var(--bad)",
  today: "var(--ring-today)",
  none: "var(--ring-empty)",
};

function point(angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [CENTER + RADIUS * Math.cos(radians), CENTER + RADIUS * Math.sin(radians)];
}

function arc(start: number, end: number) {
  const [x1, y1] = point(start);
  const [x2, y2] = point(end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Le cercle de la tontine : un segment par jour, rempli quand la cotisation est réglée. */
export function ContributionRing({ days, children, className = "", stagger = 0, title, thickness = STROKE }: ContributionRingProps) {
  const step = 360 / days.length;
  const gap = Math.min(4, step * 0.28);

  return (
    <div className={`relative aspect-square ${className}`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label={title}>
        <title>{title}</title>
        {days.map((day, index) => {
          const start = index * step + gap / 2;
          const end = (index + 1) * step - gap / 2;
          return (
            <path
              key={index}
              d={arc(start, end)}
              fill="none"
              stroke={stateStroke[day.state]}
              strokeWidth={thickness}
              strokeOpacity={day.state === "partial" ? 0.45 : 1}
              strokeDasharray={day.state === "today" ? "4 3" : undefined}
              className={stagger ? "ring-segment" : undefined}
              style={stagger ? { animationDelay: `${index * stagger}ms` } : undefined}
            >
              {day.label ? <title>{day.label}</title> : null}
            </path>
          );
        })}
      </svg>
      {children ? <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div> : null}
    </div>
  );
}
