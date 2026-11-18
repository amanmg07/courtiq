import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import ChartTooltip from './ChartTooltip'
import ChartPanBar from './ChartPanBar'
import { useWheelZoom } from '../hooks/useWheelZoom'
import type { TrendPoint } from '../types/api'

interface Props {
  points: TrendPoint[]
  statKey: 'pts' | 'reb' | 'ast'
  label: string
}

const SERIES_COLOR = 'var(--color-series-1)'
const L5_COLOR = 'var(--color-series-2)'
const L10_COLOR = 'var(--color-series-3)'
const Y_AXIS_WIDTH = 32
const MARGIN = { top: 8, right: 16, left: 0, bottom: 0 }

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TrendChart({ points, statKey, label }: Props) {
  // A plain formatted-string x-axis is a CATEGORY axis in Recharts: every
  // point gets equal pixel spacing regardless of the real gap between games
  // -- a 9-day in-season gap and a ~190-day off-season gap would render
  // identically. Using the real timestamp with a numeric axis instead makes
  // spacing proportional to actual elapsed time, so gaps (rest days, the
  // off-season) are visible rather than silently flattened away.
  const data = useMemo(
    () =>
      points.map((p) => ({
        date: new Date(p.game_date).getTime(),
        opponent: p.opponent_abbr,
        actual: p[statKey],
        l5: p[`${statKey}_l5_avg` as const],
        l10: p[`${statKey}_l10_avg` as const],
      })),
    [points, statKey],
  )

  const dates = useMemo(() => data.map((d) => d.date), [data])

  // minVisiblePoints=2: the line is drawn with dot={false}, so a window
  // that shrinks to a single point would render nothing at all -- the
  // chart going fully blank, not just tight.
  const { containerRef, zoom, setZoom, panBy, fullDomain } = useWheelZoom(
    dates,
    points,
    { yAxisWidth: Y_AXIS_WIDTH, marginLeft: MARGIN.left, marginRight: MARGIN.right },
    2,
  )

  const visibleData = zoom ? data.filter((d) => d.date >= zoom[0] && d.date <= zoom[1]) : data

  return (
    <div ref={containerRef}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={visibleData} margin={MARGIN}>
          <CartesianGrid stroke="var(--color-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            // The axis domain is the zoom window's own fixed bounds, not
            // the min/max of whichever points happen to fall inside it --
            // otherwise, as you pan across sparse/unevenly-spaced games,
            // the included point set shifts and the apparent scale would
            // visibly stretch and shrink even though the window's span
            // (the actual zoom level) never changes.
            domain={zoom ?? ['dataMin', 'dataMax']}
            allowDataOverflow
            tickFormatter={(ts: number) => formatDate(ts)}
            stroke="var(--color-baseline)"
            tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-baseline)' }}
            minTickGap={32}
          />
          <YAxis
            stroke="var(--color-baseline)"
            tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={Y_AXIS_WIDTH}
          />
          <Tooltip content={<ChartTooltip dateAxis />} />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-ink-secondary)' }} />
          <Line type="monotone" dataKey="actual" name={label} stroke={SERIES_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="l5" name="Last 5 avg" stroke={L5_COLOR} strokeWidth={2} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
          <Line type="monotone" dataKey="l10" name="Last 10 avg" stroke={L10_COLOR} strokeWidth={2} dot={false} strokeDasharray="1 3" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <ChartPanBar zoom={zoom} fullDomain={fullDomain} onPan={panBy} />
      <div className="mt-1 flex items-center justify-between text-[11px] text-ink-muted">
        <span>Scroll or pinch to zoom · drag the bar below to pan</span>
        {zoom && (
          <button onClick={() => setZoom(null)} className="font-medium text-series-1 hover:underline">
            Reset zoom
          </button>
        )}
      </div>
    </div>
  )
}
