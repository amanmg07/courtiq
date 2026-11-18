import { useMemo, useState } from 'react'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/StatusStates'
import PlayerAutocomplete from '../components/PlayerAutocomplete'
import ComparisonBarChart from '../components/ComparisonBarChart'
import PlayerAvatar from '../components/PlayerAvatar'
import TeamBadge from '../components/TeamBadge'
import type { PlayerOut } from '../types/api'

const SERIES_COLORS = [
  'var(--color-series-1)', 'var(--color-series-2)', 'var(--color-series-3)',
  'var(--color-series-4)', 'var(--color-series-5)', 'var(--color-series-6)',
]

function pct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}

export default function ComparePage() {
  const [selected, setSelected] = useState<PlayerOut[]>([])
  const [season, setSeason] = useState<string>('')

  // memoized: a fresh array every render would flow into PlayerAutocomplete's
  // excludeIds prop and needlessly retrigger its search effect (see the fix
  // and comment in PlayerAutocomplete.tsx for the sharper version of this bug)
  const ids = useMemo(() => selected.map((p) => p.player_id), [selected])
  const { data, loading, error } = useFetch(
    () => (ids.length >= 2 ? api.compare(ids, season || undefined) : null),
    [ids.join(','), season],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">Compare Players</h1>
        <p className="mt-1 text-sm text-ink-secondary">Pick 2–6 players to compare side-by-side.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <PlayerAutocomplete
            placeholder="Add a player…"
            excludeIds={ids}
            onSelect={(p) => {
              if (selected.length < 6) setSelected((s) => [...s, p])
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Season</label>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-ink-secondary"
          >
            <option value="">Career</option>
            {['2021-22', '2022-23', '2023-24', '2024-25', '2025-26', '2026-27'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((p, i) => (
            <span
              key={p.player_id}
              className="flex items-center gap-2 rounded-full border-2 bg-surface-1 py-1 pl-1 pr-3 text-sm"
              style={{ borderColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
            >
              <PlayerAvatar src={p.headshot_url} name={p.full_name} size="sm" />
              {p.full_name}
              <TeamBadge abbreviation={p.current_team} />
              <button
                onClick={() => setSelected((s) => s.filter((x) => x.player_id !== p.player_id))}
                className="text-ink-muted hover:text-critical"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {selected.length < 2 && <EmptyState message="Add at least 2 players to see a comparison." />}
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {data && data.players.length >= 2 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <ComparisonBarChart players={data.players} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3 text-right">GP</th>
                  <th className="px-4 py-3 text-right">MIN</th>
                  <th className="px-4 py-3 text-right">PTS</th>
                  <th className="px-4 py-3 text-right">REB</th>
                  <th className="px-4 py-3 text-right">AST</th>
                  <th className="px-4 py-3 text-right">STL</th>
                  <th className="px-4 py-3 text-right">BLK</th>
                  <th className="px-4 py-3 text-right">FG%</th>
                  <th className="px-4 py-3 text-right">3P%</th>
                  <th className="px-4 py-3 text-right">FT%</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((entry, i) => (
                  <tr key={entry.player.player_id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink-primary">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                        <PlayerAvatar src={entry.player.headshot_url} name={entry.player.full_name} size="sm" />
                        <span>{entry.player.full_name}</span>
                        <TeamBadge abbreviation={entry.player.current_team} />
                      </div>
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{entry.stats.games_played}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{entry.stats.avg_minutes.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-primary">{entry.stats.avg_pts.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-primary">{entry.stats.avg_reb.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-primary">{entry.stats.avg_ast.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{entry.stats.avg_stl.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{entry.stats.avg_blk.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{pct(entry.stats.fg_pct)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{pct(entry.stats.fg3_pct)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{pct(entry.stats.ft_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
