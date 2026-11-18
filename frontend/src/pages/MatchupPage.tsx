import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/StatusStates'
import PlayerAutocomplete from '../components/PlayerAutocomplete'
import TeamSelect from '../components/TeamSelect'
import StatCard from '../components/StatCard'
import ChartTooltip from '../components/ChartTooltip'
import type { PlayerOut } from '../types/api'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function MatchupPage() {
  const [player, setPlayer] = useState<PlayerOut | null>(null)
  const [opponent, setOpponent] = useState('')

  const { data, loading, error } = useFetch(
    () => (player && opponent ? api.matchup(player.player_id, opponent) : null),
    [player?.player_id, opponent],
  )

  const chartData = data
    ? [...data.recent_games].reverse().map((g) => ({
        date: formatDate(g.game_date),
        pts: g.pts,
        isHome: g.is_home,
      }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">Matchup Analysis</h1>
        <p className="mt-1 text-sm text-ink-secondary">See how a player has historically performed against one opponent.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Player</label>
          {player ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2 text-sm">
              <span>{player.full_name}</span>
              <button onClick={() => setPlayer(null)} className="text-ink-muted hover:text-critical">
                ×
              </button>
            </div>
          ) : (
            <PlayerAutocomplete onSelect={setPlayer} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Opponent</label>
          <TeamSelect value={opponent} onChange={setOpponent} excludeAbbr={player?.current_team ?? undefined} />
        </div>
      </div>

      {!player || !opponent ? (
        <EmptyState message="Select a player and an opponent to see their matchup history." />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : data && data.games_played === 0 ? (
        <EmptyState message={`${player.full_name} hasn't played against ${opponent} in the loaded seasons.`} />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={`PPG vs ${opponent}`} value={data.avg_pts?.toFixed(1) ?? '—'} sublabel={`${data.games_played} games`} accent="series-1" />
            <StatCard label="RPG" value={data.avg_reb?.toFixed(1) ?? '—'} accent="series-2" />
            <StatCard label="APG" value={data.avg_ast?.toFixed(1) ?? '—'} accent="series-3" />
            <StatCard label="FG%" value={data.fg_pct ? `${(data.fg_pct * 100).toFixed(1)}%` : '—'} accent="series-4" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
            <StatCard label="Home PPG" value={data.home_avg_pts?.toFixed(1) ?? '—'} />
            <StatCard label="Away PPG" value={data.away_avg_pts?.toFixed(1) ?? '—'} />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink-primary">Points, Last {chartData.length} Meetings</h2>
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-grid)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--color-baseline)" tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--color-baseline)' }} />
                  <YAxis stroke="var(--color-baseline)" tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="pts" name="Points" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.isHome ? 'var(--color-series-1)' : 'var(--color-series-7)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex gap-4 text-xs text-ink-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-series-1)' }} /> Home
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-series-7)' }} /> Away
                </span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink-primary">Game Log</h2>
            <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Season</th>
                    <th className="px-4 py-3">Loc</th>
                    <th className="px-4 py-3 text-right">MIN</th>
                    <th className="px-4 py-3 text-right">PTS</th>
                    <th className="px-4 py-3 text-right">REB</th>
                    <th className="px-4 py-3 text-right">AST</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_games.map((g) => (
                    <tr key={g.game_id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 text-ink-secondary">{formatDate(g.game_date)}</td>
                      <td className="px-4 py-2.5 text-ink-secondary">{g.season}</td>
                      <td className="px-4 py-2.5 text-ink-secondary">{g.is_home ? 'Home' : 'Away'}</td>
                      <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{g.minutes.toFixed(1)}</td>
                      <td className="tabular px-4 py-2.5 text-right text-ink-primary">{g.pts}</td>
                      <td className="tabular px-4 py-2.5 text-right text-ink-primary">{g.reb}</td>
                      <td className="tabular px-4 py-2.5 text-right text-ink-primary">{g.ast}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
