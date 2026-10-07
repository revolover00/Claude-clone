type Props = {
  size?: number;
  className?: string;
};

/** Claude's hand-drawn starburst mark — thin rays of varying length. */
const RAYS: Array<[angle: number, length: number]> = [
  [0, 10.2],
  [28, 7.6],
  [58, 10.4],
  [90, 7.2],
  [118, 10.0],
  [150, 8.4],
  [180, 10.2],
  [212, 7.4],
  [240, 10.0],
  [268, 8.6],
  [298, 9.4],
  [330, 7.8],
];

const INNER = 2.4;
const C = 12;

export default function ClaudeSpark({ size = 44, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {RAYS.map(([deg, len], i) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = C + Math.cos(rad) * INNER;
        const y1 = C + Math.sin(rad) * INNER;
        const x2 = C + Math.cos(rad) * len;
        const y2 = C + Math.sin(rad) * len;
        return (
          <line
            key={i}
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
