interface ChartTooltipProps {
  active?: boolean
  payload?: { dataKey?: string | number; name?: string | number; value?: string | number; color?: string }[]
  label?: string | number
  /** Set when the chart's x-axis is a numeric timestamp (our time-scale
   * charts use epoch ms, not a pre-formatted string, so the real date stays
   * proportional to elapsed time -- see TrendChart/MatchupPage). Recharts'
   * own `labelFormatter` prop on <Tooltip> only formats the label for its
   * BUILT-IN content renderer; it's never applied when `content` is a custom
   * component like this one (confirmed directly: without this, the tooltip
   * showed the raw epoch number, e.g. "1775952000000", instead of a date). */
  dateAxis?: boolean
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Shared dark-surface tooltip for every Recharts chart in the app. All props
 * optional: Recharts injects them via cloneElement at runtime, which TS can't
 * see from a bare `<ChartTooltip />` passed as the `content` prop. */
export default function ChartTooltip({ active, payload, label, dateAxis }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const displayLabel = dateAxis && label !== undefined ? formatDate(Number(label)) : label
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      {displayLabel && <p className="mb-1 font-medium text-ink-primary">{displayLabel}</p>}
      {payload.map((entry) => (
        <div key={entry.dataKey as string} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-ink-secondary">{entry.name}:</span>
          <span className="tabular font-medium text-ink-primary">
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}
