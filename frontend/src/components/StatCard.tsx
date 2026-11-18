interface StatCardProps {
  label: string
  value: string
  sublabel?: string
  accent?: 'series-1' | 'series-2' | 'series-3' | 'series-4'
}

const ACCENT_BORDER: Record<string, string> = {
  'series-1': 'before:bg-series-1',
  'series-2': 'before:bg-series-2',
  'series-3': 'before:bg-series-3',
  'series-4': 'before:bg-series-4',
}

export default function StatCard({ label, value, sublabel, accent = 'series-1' }: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-border bg-surface-1 p-4 before:absolute before:inset-y-0 before:left-0 before:w-1 ${ACCENT_BORDER[accent]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold text-ink-primary">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-ink-secondary">{sublabel}</p>}
    </div>
  )
}
