export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-muted">
      <span className="h-2 w-2 animate-pulse rounded-full bg-series-1" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 px-4 py-6 text-center">
      <p className="text-sm font-medium text-critical">Couldn't load this data</p>
      <p className="mt-1 text-sm text-ink-muted">{message}</p>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  )
}
