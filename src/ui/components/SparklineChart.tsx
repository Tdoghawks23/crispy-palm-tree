import { useId } from 'react';

/**
 * Minimal inline-SVG line chart for per-exercise trends (R18), "Ember" style:
 * an amber gradient area under a 2.5px amber polyline, with a ringed end dot
 * emphasising the most recent session.
 *
 * Solution ladder call (CLAUDE.md leaves this open): inline SVG, not Chart.js.
 * This app is single-user with at most a few dozen data points per exercise
 * over 12 weeks — Chart.js (~200KB) buys nothing a ~40-line SVG doesn't already
 * cover, and it's a new dependency for a "no new dependency" project. SVG is a
 * browser built-in (PROVEN rung), sufficient for this data volume.
 */
interface Props {
  values: number[];
  width?: number;
  height?: number;
  label: string;
  /** Shown instead of the chart when there's only one data point — a lone dot reads as a rendering glitch. */
  singlePointText?: string;
}

// Fixed 300x60 viewBox (drawn with preserveAspectRatio="none" so it stretches
// to the card width); lower y = higher on the chart.
const VB_W = 300;
const VB_H = 60;
const PAD = 6;

export function SparklineChart({
  values,
  height = 52,
  label,
  singlePointText = 'Logged once — a trend line appears after the next session.',
}: Props) {
  // Unique per instance — multiple sparklines share a document, and an area
  // fill referencing the wrong gradient id would pick up another chart's.
  const gradId = useId();

  if (values.length === 0) {
    return <p className="no-data">No logged data yet.</p>;
  }
  if (values.length === 1) {
    return <p className="no-data">{singlePointText}</p>;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const plot = VB_H - PAD * 2;
  const n = values.length;

  const coords = values.map((v, i) => {
    const x = n > 1 ? Math.round((i * VB_W) / (n - 1)) : VB_W / 2;
    const y = Number((PAD + plot - ((v - min) / range) * plot).toFixed(1));
    return { x, y };
  });

  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `M${coords[0].x},${coords[0].y} ${coords
    .slice(1)
    .map((c) => `L${c.x},${c.y}`)
    .join(' ')} L${VB_W},${VB_H} L0,${VB_H} Z`;
  const end = coords[coords.length - 1];

  return (
    <svg
      role="img"
      aria-label={label}
      width="100%"
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      className="sparkline"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9f1c" stopOpacity={0.34} />
          <stop offset="1" stopColor="#ff9f1c" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="#ff9f1c"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={end.x} cy={end.y} r={3.5} fill="#ffb64d" stroke="#17171b" strokeWidth={2} />
    </svg>
  );
}
