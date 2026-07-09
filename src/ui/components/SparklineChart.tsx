/**
 * Minimal inline-SVG line chart for per-exercise trends (R18).
 *
 * Solution ladder call (CLAUDE.md leaves this open): inline SVG, not
 * Chart.js. This app is single-user with at most a few dozen data points
 * per exercise over 12 weeks — Chart.js (~200KB) buys nothing here that a
 * ~30-line SVG polyline doesn't already cover, and it's a new dependency
 * for a "no new dependency without justification" project. SVG is a
 * browser built-in (PROVEN rung), sufficient for this data volume.
 */
interface Props {
  values: number[];
  width?: number;
  height?: number;
  label: string;
}

export function SparklineChart({ values, width = 260, height = 64, label }: Props) {
  if (values.length === 0) {
    return <p className="no-data">No logged data yet.</p>;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const padding = 6;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const stepX = values.length > 1 ? plotWidth / (values.length - 1) : 0;

  const coords = values.map((v, i) => {
    const x = padding + (values.length > 1 ? i * stepX : plotWidth / 2);
    const y = padding + plotHeight - ((v - min) / range) * plotHeight;
    return { x, y };
  });

  const points = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;
  const lastIdx = coords.length - 1;

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="sparkline"
    >
      {/* Faint fill under the line — makes the trend read as a shape at a
          glance, not just a thin wire. */}
      <polygon points={areaPoints} fill="currentColor" fillOpacity={0.12} stroke="none" />
      <polyline fill="none" stroke="currentColor" strokeWidth={2} points={points} />
      {coords.map((c, i) =>
        i === lastIdx ? (
          // Emphasize the most recent session — the number the lifter
          // actually cares about right now.
          <circle key={i} cx={c.x} cy={c.y} r={4.5} fill="currentColor" />
        ) : (
          <circle key={i} cx={c.x} cy={c.y} r={2.5} fill="currentColor" fillOpacity={0.55} />
        ),
      )}
    </svg>
  );
}
