import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush,
} from 'recharts'
import ChartTooltip from './ChartTooltip'
import type { TrendPoint } from '../types/api'

interface Props {
  points: TrendPoint[]
  statKey: 'pts' | 'reb' | 'ast'
  label: string
}

const SERIES_COLOR = 'var(--color-series-1)'
const L5_COLOR = 'var(--color-series-2)'
const L10_COLOR = 'var(--color-series-3)'

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TrendChart({ points, statKey, label }: Props) {
  // A plain formatted-string x-axis is a CATEGORY axis in Recharts: every
  // point gets equal pixel spacing regardless of the real gap between games
  // -- a 9-day in-season gap and a ~190-day off-season gap would render
  // identically. Using the real timestamp with a numeric axis instead makes
  // spacing proportional to actual elapsed time, so gaps (rest days, the
  // off-season) are visible rather than silently flattened away.
  const data = points.map((p) => ({
    date: new Date(p.game_date).getTime(),
    opponent: p.opponent_abbr,
    actual: p[statKey],
    l5: p[`${statKey}_l5_avg` as const],
    l10: p[`${statKey}_l10_avg` as const],
  }))

  // Below ~15 points a brush adds clutter without adding anything to zoom
  // into; it earns its space once there's a real range to narrow down.
  const showBrush = data.length > 15

  return (
    <ResponsiveContainer width="100%" height={showBrush ? 320 : 280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-grid)" vertical={false} />
        <XAxis
          dataKey="date"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(ts: number) => formatDate(new Date(ts).toISOString())}
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
          width={32}
        />
        <Tooltip content={<ChartTooltip dateAxis />} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-ink-secondary)' }} />
        <Line type="monotone" dataKey="actual" name={label} stroke={SERIES_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="l5" name="Last 5 avg" stroke={L5_COLOR} strokeWidth={2} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
        <Line type="monotone" dataKey="l10" name="Last 10 avg" stroke={L10_COLOR} strokeWidth={2} dot={false} strokeDasharray="1 3" isAnimationActive={false} />
        {showBrush && (
          <Brush
            dataKey="date"
            height={28}
            travellerWidth={10}
            tickFormatter={(ts: number) => formatDate(new Date(ts).toISOString())}
            stroke="var(--color-series-1)"
            fill="var(--color-surface-1)"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
