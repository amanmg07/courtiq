import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState } from '../components/StatusStates'
import PlayerAutocomplete from '../components/PlayerAutocomplete'
import PlayerAvatar from '../components/PlayerAvatar'
import TeamBadge from '../components/TeamBadge'
import type { LeaderEntry } from '../types/api'

const LEADER_STATS: { key: 'pts' | 'reb' | 'ast' | 'stl' | 'blk'; label: string; accent: string; suffix: string }[] = [
  { key: 'pts', label: 'Points', accent: 'var(--color-series-1)', suffix: 'PPG' },
  { key: 'reb', label: 'Rebounds', accent: 'var(--color-series-2)', suffix: 'RPG' },
  { key: 'ast', label: 'Assists', accent: 'var(--color-series-3)', suffix: 'APG' },
  { key: 'stl', label: 'Steals', accent: 'var(--color-series-4)', suffix: 'SPG' },
  { key: 'blk', label: 'Blocks', accent: 'var(--color-series-7)', suffix: 'BPG' },
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
              <PlayerAvatar src={entry.player.headshot_url} name={entry.player.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm text-ink-primary group-hover:underline">
                      {entry.player.full_name}
                    </span>
                    <TeamBadge abbreviation={entry.player.current_team} />
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
      {/* Left: every leaderboard, stacked in one scrollable column */}
      <section className="lg:sticky lg:top-20">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink-primary">League Leaders</h2>
          {season && <span className="text-sm text-ink-muted">{season} season</span>}
        </div>
        {loading && <LoadingState label="Loading league leaders…" />}
        {error && <ErrorState message={error} />}
        {data && (
          <div className="space-y-4 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto lg:pr-1">
            {boards.map((b, i) => (
              <LeaderBoard key={b.key} title={`${b.label} per Game`} accent={b.accent} leaders={data[i].leaders} suffix={b.suffix} />
            ))}
          </div>
        )}
      </section>

      {/* Right: one big, prominent player search */}
      <section className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-1 p-10 text-center lg:min-h-[calc(100vh-180px)]">
        <p className="text-sm font-medium uppercase tracking-wide text-series-1">NBA Analytics</p>
        <h1 className="mt-2 max-w-md text-4xl font-bold tracking-tight text-ink-primary">
          Explore players. Compare matchups. Spot trends.
        </h1>
        <p className="mt-3 max-w-md text-sm text-ink-secondary">
          CourtIQ tracks {season ? `the ${season} season` : 'every loaded season'} across 1,000+ players and
          130K+ game logs.
        </p>
        <div className="mt-8 w-full max-w-lg">
          <PlayerAutocomplete
            placeholder="Search for a player…"
            onSelect={(p) => navigate(`/players/${p.player_id}`)}
            inputClassName="px-5 py-4 text-lg"
          />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
          <button
            onClick={() => navigate('/players')}
            className="rounded-full border border-border px-4 py-2 text-ink-secondary transition-colors hover:border-series-1 hover:text-ink-primary"
          >
            Browse all players
          </button>
          <button
            onClick={() => navigate('/compare')}
            className="rounded-full border border-border px-4 py-2 text-ink-secondary transition-colors hover:border-series-1 hover:text-ink-primary"
          >
            Compare players
          </button>
          <button
            onClick={() => navigate('/predict')}
            className="rounded-full border border-border px-4 py-2 text-ink-secondary transition-colors hover:border-series-1 hover:text-ink-primary"
          >
            Generate a prediction
          </button>
        </div>
      </section>
    </div>
  )
}
