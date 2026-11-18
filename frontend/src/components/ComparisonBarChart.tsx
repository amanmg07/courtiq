import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ChartTooltip from './ChartTooltip'
import type { ComparisonEntry } from '../types/api'

const SERIES_COLORS = [
  'var(--color-series-1)', 'var(--color-series-2)', 'var(--color-series-3)',
  'var(--color-series-4)', 'var(--color-series-5)', 'var(--color-series-6)',
]

const METRICS: { key: keyof ComparisonEntry['stats']; label: string }[] = [
  { key: 'avg_pts', label: 'PTS' },
  { key: 'avg_reb', label: 'REB' },
  { key: 'avg_ast', label: 'AST' },
]

export default function ComparisonBarChart({ players }: { players: ComparisonEntry[] }) {
  const data = METRICS.map((m) => {
    const row: Record<string, string | number> = { metric: m.label }
    players.forEach((p) => {
      row[p.player.full_name] = Number(p.stats[m.key])
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid stroke="var(--color-grid)" vertical={false} />
        <XAxis
          dataKey="metric"
          stroke="var(--color-baseline)"
          tick={{ fill: 'var(--color-ink-muted)', fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-baseline)' }}
        />
        <YAxis
          stroke="var(--color-baseline)"
          tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-ink-secondary)' }} />
        {players.map((p, i) => (
          <Bar
            key={p.player.player_id}
            dataKey={p.player.full_name}
            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
