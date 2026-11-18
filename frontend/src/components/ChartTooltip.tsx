interface ChartTooltipProps {
  active?: boolean
  payload?: { dataKey?: string | number; name?: string | number; value?: string | number; color?: string }[]
  label?: string | number
}

/** Shared dark-surface tooltip for every Recharts chart in the app. All props
 * optional: Recharts injects them via cloneElement at runtime, which TS can't
 * see from a bare `<ChartTooltip />` passed as the `content` prop. */
export default function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      {label && <p className="mb-1 font-medium text-ink-primary">{label}</p>}
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
