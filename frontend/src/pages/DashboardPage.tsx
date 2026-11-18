import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState } from '../components/StatusStates'
import PlayerAutocomplete from '../components/PlayerAutocomplete'
import type { LeaderEntry } from '../types/api'

const LEADER_STATS: { key: 'pts' | 'reb' | 'ast'; label: string; accent: string; suffix: string }[] = [
  { key: 'pts', label: 'Points', accent: 'var(--color-series-1)', suffix: 'PPG' },
  { key: 'reb', label: 'Rebounds', accent: 'var(--color-series-2)', suffix: 'RPG' },
  { key: 'ast', label: 'Assists', accent: 'var(--color-series-3)', suffix: 'APG' },
]

function LeaderBoard({ title, accent, leaders, suffix }: { title: string; accent: string; leaders: LeaderEntry[]; suffix: string }) {
  const navigate = useNavigate()
  const max = leaders[0]?.avg_value ?? 1
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink-primary">{title}</h3>
      <ol className="space-y-2">
        {leaders.map((entry, i) => (
          <li key={entry.player.player_id}>
            <button
              onClick={() => navigate(`/players/${entry.player.player_id}`)}
              className="group flex w-full items-center gap-3 text-left"
            >
              <span className="w-4 shrink-0 text-xs font-medium text-ink-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-ink-primary group-hover:underline">
                    {entry.player.full_name}
                  </span>
                  <span className="tabular shrink-0 text-sm font-semibold text-ink-primary">
                    {entry.avg_value.toFixed(1)} <span className="text-xs text-ink-muted">{suffix}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(entry.avg_value / max) * 100}%`, backgroundColor: accent }}
                  />
                </div>
              </div>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [boards] = useState(LEADER_STATS)

  const { data, loading, error } = useFetch(
    () => Promise.all(boards.map((b) => api.leaders(b.key, { limit: 5 }))),
    [],
  )

  const season = data?.[0]?.season

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-surface-1 p-6">
        <p className="text-sm font-medium uppercase tracking-wide text-series-1">NBA Analytics</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-primary">
          Explore players. Compare matchups. Spot trends.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
          CourtIQ tracks {season ? `the ${season} season` : 'every loaded season'} across 1,000+ players and
          130K+ game logs. Search for a player to see their full history, or jump into a head-to-head comparison.
        </p>
        <div className="mt-4 max-w-md">
          <PlayerAutocomplete
            placeholder="Search for a player…"
            onSelect={(p) => navigate(`/players/${p.player_id}`)}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink-primary">League Leaders</h2>
          {season && <span className="text-sm text-ink-muted">{season} season · min. 15 games</span>}
        </div>
        {loading && <LoadingState label="Loading league leaders…" />}
        {error && <ErrorState message={error} />}
        {data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b, i) => (
              <LeaderBoard key={b.key} title={`${b.label} per Game`} accent={b.accent} leaders={data[i].leaders} suffix={b.suffix} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
