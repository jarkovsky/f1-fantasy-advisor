/**
 * Decorative cumulative-points sparkline.
 *
 * Pure presentational inline SVG — no client hooks, no wall clock, no fetch. It
 * draws the recomputed cumulative-points series (history.ts) scaled to its own
 * min/max so the *shape* of each asset's trajectory is comparable at a glance;
 * the absolute scale is intentionally not shared across rows (a single shared
 * axis would flatten every low scorer into a baseline). A flat series renders a
 * midline; a single scored race renders just the end dot; an empty series
 * renders nothing.
 *
 * aria-hidden: the Season-pts column already carries this number as accessible
 * text, so the chart is redundant decoration — exposing a wall of unlabeled SVG
 * points to a screen reader would be noise, not information.
 */

const WIDTH = 110
const HEIGHT = 24
const PAD = 2

export function Sparkline({ series }: { series: number[] }) {
  if (series.length === 0) return null

  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min

  const innerW = WIDTH - PAD * 2
  const innerH = HEIGHT - PAD * 2

  // x: evenly spaced across the inner width; a single point sits at the right
  // edge (it is the latest value). y: inverted (SVG y grows downward); a flat
  // series (span 0) pins every point to the vertical midline.
  const points = series.map((value, i) => {
    const x = series.length === 1 ? WIDTH - PAD : PAD + (i / (series.length - 1)) * innerW
    const y = span === 0 ? PAD + innerH / 2 : PAD + (1 - (value - min) / span) * innerH
    return { x, y }
  })

  const last = points[points.length - 1]

  return (
    <svg
      aria-hidden="true"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="text-muted-foreground"
    >
      {points.length > 1 && (
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {last && <circle className="text-pos" cx={last.x} cy={last.y} r={2} fill="currentColor" />}
    </svg>
  )
}
