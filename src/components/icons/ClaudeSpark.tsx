type Props = {
  size?: number;
  className?: string;
};

const CENTER = 12;
const INNER_RADIUS = 2.25;
const STEP = 360 / 12;
const RAY_LENGTHS = [10.8, 7.9, 10.1, 7.6, 10.6, 8.2, 10.7, 7.8, 10.2, 8.5, 10.4, 7.7] as const;
const ANGLE_OFFSETS = [0, -1.5, 1, 0, -1, 1.5, 0, -1, 0.5, 0, -1, 1] as const;

/** Claude-inspired starburst built from local, parametrically positioned vector rays. */
export default function ClaudeSpark({ size = 44, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-mark="claude-spark"
      className={className}
    >
      {RAY_LENGTHS.map((length, index) => {
        const angle = ((index * STEP + ANGLE_OFFSETS[index]) * Math.PI) / 180;
        const x1 = CENTER + Math.cos(angle) * INNER_RADIUS;
        const y1 = CENTER + Math.sin(angle) * INNER_RADIUS;
        const x2 = CENTER + Math.cos(angle) * length;
        const y2 = CENTER + Math.sin(angle) * length;

        return (
          <line
            key={index}
            x1={x1.toFixed(2)}
            y1={y1.toFixed(2)}
            x2={x2.toFixed(2)}
            y2={y2.toFixed(2)}
            stroke="currentColor"
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
