import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { usePersistentState } from '../hooks/usePersistentState'
import { useTeam } from '../hooks/useTeams'
import { useWheelZoom } from '../hooks/useWheelZoom'
import { LoadingState, ErrorState, EmptyState } from '../components/StatusStates'
import PlayerAutocomplete from '../components/PlayerAutocomplete'
import TeamSelect from '../components/TeamSelect'
import StatCard from '../components/StatCard'
import ChartTooltip from '../components/ChartTooltip'
import ChartPanBar from '../components/ChartPanBar'
import PlayerAvatar from '../components/PlayerAvatar'
import TeamLogo from '../components/TeamLogo'
import type { PlayerOut } from '../types/api'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function MatchupPage() {
  const [player, setPlayer] = usePersistentState<PlayerOut | null>('courtiq:matchup:player', null)
  const [opponent, setOpponent] = usePersistentState('courtiq:matchup:opponent', '')
  const opponentTeam = useTeam(opponent)
  const playerTeam = useTeam(player?.current_team)

  const { data, loading, error } = useFetch(
    () => (player && opponent ? api.matchup(player.player_id, opponent) : null),
    [player?.player_id, opponent],
  )

  // Numeric timestamp, not a formatted string: a string x-axis is a CATEGORY
  // axis in Recharts, giving every meeting equal pixel spacing regardless of
  // the real gap between them -- misleading here specifically, since meetings
  // against one opponent are naturally clustered (teams play 2-4x/season)
  // with irregular gaps between clusters, including the off-season.
  const chartData = useMemo(
    () =>
      data
        ? [...data.recent_games].reverse().map((g) => ({
            date: new Date(g.game_date).getTime(),
            pts: g.pts,
            isHome: g.is_home,
          }))
        : [],
    [data],
  )

  const chartDates = useMemo(() => chartData.map((d) => d.date), [chartData])

  const {
    containerRef: chartRef,
    zoom: chartZoom,
    setZoom: setChartZoom,
    panBy: panChartBy,
    fullDomain: chartFullDomain,
  } = useWheelZoom(chartDates, data, { yAxisWidth: 28, marginLeft: 0, marginRight: 16 })

  const visibleChartData = chartZoom
    ? chartData.filter((d) => d.date >= chartZoom[0] && d.date <= chartZoom[1])
    : chartData

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">Matchup Analysis</h1>
        <p className="mt-1 text-sm text-ink-secondary">See how a player has historically performed against one opponent.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: pick + display the player */}
        <div className="flex min-h-[280px] flex-col rounded-xl border border-border bg-surface-1 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">Player</p>
          {!player ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="h-16 w-16 rounded-full border-2 border-dashed border-border" />
              <div className="w-full max-w-xs">
                <PlayerAutocomplete onSelect={setPlayer} />
              </div>
              <p className="text-xs text-ink-muted">Search for a player to analyze.</p>
            </div>
          ) : (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg p-4 text-center"
              style={{
                background: playerTeam
                  ? `linear-gradient(160deg, ${playerTeam.primary_color}26 0%, transparent 70%)`
                  : undefined,
              }}
            >
              <PlayerAvatar src={player.headshot_url} name={player.full_name} size="xl" ringColor={playerTeam?.primary_color} />
              <div>
                <h2 className="text-2xl font-bold text-ink-primary">{player.full_name}</h2>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink-secondary">
                  {player.current_team && <TeamLogo abbreviation={player.current_team} size="sm" />}
                  {playerTeam?.name ?? player.current_team}
                </p>
                <p className="text-xs text-ink-muted">
                  {player.first_season}–{player.last_season} · {player.games_played} games
                </p>
              </div>
              <button
                onClick={() => setPlayer(null)}
                className="text-xs font-medium text-series-1 hover:underline"
              >
                Change player
              </button>
            </div>
          )}
        </div>

        {/* Right: pick + display the opponent team */}
        <div className="flex min-h-[280px] flex-col rounded-xl border border-border bg-surface-1 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-muted">Opponent</p>
          {!opponent ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="h-16 w-16 rounded-full border-2 border-dashed border-border" />
              <div className="w-full max-w-xs">
                <TeamSelect value={opponent} onChange={setOpponent} excludeAbbr={player?.current_team ?? undefined} />
              </div>
              <p className="text-xs text-ink-muted">Pick the opponent team.</p>
            </div>
          ) : (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg p-4 text-center"
              style={{
                background: opponentTeam
                  ? `linear-gradient(160deg, ${opponentTeam.primary_color}26 0%, transparent 70%)`
                  : undefined,
              }}
            >
              <TeamLogo abbreviation={opponent} size="lg" />
              <div>
                <h2 className="text-2xl font-bold text-ink-primary">{opponentTeam?.name ?? opponent}</h2>
                {opponentTeam && (
                  <p className="mt-1 text-sm text-ink-secondary">
                    {opponentTeam.conference}ern Conference · {opponentTeam.division} Division
                  </p>
                )}
              </div>
              <button
                onClick={() => setOpponent('')}
                className="text-xs font-medium text-series-1 hover:underline"
              >
                Change opponent
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: the analysis, once both are picked */}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label={`PPG vs ${opponent}`} value={data.avg_pts?.toFixed(1) ?? '—'} sublabel={`${data.games_played} games`} accent="series-1" />
            <StatCard label="RPG" value={data.avg_reb?.toFixed(1) ?? '—'} accent="series-2" />
            <StatCard label="APG" value={data.avg_ast?.toFixed(1) ?? '—'} accent="series-3" />
            <StatCard label="SPG" value={data.avg_stl?.toFixed(1) ?? '—'} accent="series-4" />
            <StatCard label="BPG" value={data.avg_blk?.toFixed(1) ?? '—'} accent="series-5" />
            <StatCard label="FG%" value={data.fg_pct ? `${(data.fg_pct * 100).toFixed(1)}%` : '—'} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
            <StatCard label="Home PPG" value={data.home_avg_pts?.toFixed(1) ?? '—'} />
            <StatCard label="Away PPG" value={data.away_avg_pts?.toFixed(1) ?? '—'} />
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink-primary">Points, Last {chartData.length} Meetings</h2>
            <div className="rounded-lg border border-border bg-surface-1 p-4">
              <div ref={chartRef}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={visibleChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-grid)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      type="number"
                      scale="time"
                      // Fixed to the zoom window's own bounds, not the
                      // min/max of whichever meetings fall inside it --
                      // otherwise panning across sparse/unevenly-spaced
                      // meetings would visibly change the scale even
                      // though the zoom level itself never changes.
                      domain={chartZoom ?? ['dataMin', 'dataMax']}
                      allowDataOverflow
                      tickFormatter={(ts: number) => formatDate(new Date(ts).toISOString())}
                      stroke="var(--color-baseline)"
                      tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-baseline)' }}
                    />
                    <YAxis stroke="var(--color-baseline)" tick={{ fill: 'var(--color-ink-muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip content={<ChartTooltip dateAxis />} />
                    <Bar dataKey="pts" name="Points" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {visibleChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.isHome ? 'var(--color-series-1)' : 'var(--color-series-7)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartPanBar zoom={chartZoom} fullDomain={chartFullDomain} onPan={panChartBy} />
              <div className="mt-2 flex items-center justify-between text-xs text-ink-secondary">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-series-1)' }} /> Home
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--color-series-7)' }} /> Away
                  </span>
                </div>
                <div className="flex items-center gap-3 text-ink-muted">
                  <span className="text-[11px]">Scroll or pinch to zoom · drag the bar below to pan</span>
                  {chartZoom && (
                    <button onClick={() => setChartZoom(null)} className="text-[11px] font-medium text-series-1 hover:underline">
                      Reset zoom
                    </button>
                  )}
                </div>
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
                    <th className="px-4 py-3 text-right">STL</th>
                    <th className="px-4 py-3 text-right">BLK</th>
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
                      <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{g.stl}</td>
                      <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{g.blk}</td>
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
