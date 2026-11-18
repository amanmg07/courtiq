import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState } from '../components/StatusStates'
import StatCard from '../components/StatCard'
import TrendChart from '../components/TrendChart'

const STAT_TABS: { key: 'pts' | 'reb' | 'ast'; label: string }[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
]

function pct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}

export default function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const playerId = Number(id)
  const [statTab, setStatTab] = useState<'pts' | 'reb' | 'ast'>('pts')
  const [lastN, setLastN] = useState(30)

  const detail = useFetch(() => api.playerDetail(playerId), [playerId])
  const seasons = useFetch(() => api.seasonAverages(playerId), [playerId])
  const trends = useFetch(() => api.trends(playerId, { last_n: lastN }), [playerId, lastN])

  if (detail.loading) return <LoadingState label="Loading player…" />
  if (detail.error) return <ErrorState message={detail.error} />
  if (!detail.data) return null

  const p = detail.data

  return (
    <div className="space-y-6">
      <div>
        <Link to="/players" className="text-sm text-ink-muted hover:text-ink-primary">
          ← All players
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold text-ink-primary">{p.full_name}</h1>
          <div className="flex items-center gap-2 text-sm text-ink-secondary">
            <span className="rounded-full border border-border bg-surface-1 px-2.5 py-1 font-medium">
              {p.current_team ?? '—'}
            </span>
            <span>
              {p.first_season}–{p.last_season} · {p.games_played} games
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="PPG (career)" value={p.career_avg_pts?.toFixed(1) ?? '—'} accent="series-1" />
        <StatCard label="RPG (career)" value={p.career_avg_reb?.toFixed(1) ?? '—'} accent="series-2" />
        <StatCard label="APG (career)" value={p.career_avg_ast?.toFixed(1) ?? '—'} accent="series-3" />
        <StatCard label="MPG (career)" value={p.career_avg_minutes?.toFixed(1) ?? '—'} accent="series-4" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="FG%" value={pct(p.career_fg_pct)} />
        <StatCard label="3P%" value={pct(p.career_fg3_pct)} />
        <StatCard label="FT%" value={pct(p.career_ft_pct)} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Performance Trend</h2>
        <div className="rounded-lg border border-border bg-surface-1 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1">
              {STAT_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setStatTab(t.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    statTab === t.key ? 'bg-surface-2 text-ink-primary' : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <select
              value={lastN}
              onChange={(e) => setLastN(Number(e.target.value))}
              className="rounded-md border border-border bg-surface-1 px-2 py-1 text-sm text-ink-secondary"
            >
              <option value={15}>Last 15 games</option>
              <option value={30}>Last 30 games</option>
              <option value={60}>Last 60 games</option>
              <option value={100}>Last 100 games</option>
            </select>
          </div>
          {trends.loading && <LoadingState />}
          {trends.error && <ErrorState message={trends.error} />}
          {trends.data && trends.data.points.length > 0 && (
            <TrendChart points={trends.data.points} statKey={statTab} label={STAT_TABS.find((t) => t.key === statTab)!.label} />
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Season-by-Season</h2>
        {seasons.loading && <LoadingState />}
        {seasons.error && <ErrorState message={seasons.error} />}
        {seasons.data && (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3">Season</th>
                  <th className="px-4 py-3 text-right">GP</th>
                  <th className="px-4 py-3 text-right">MIN</th>
                  <th className="px-4 py-3 text-right">PTS</th>
                  <th className="px-4 py-3 text-right">REB</th>
                  <th className="px-4 py-3 text-right">AST</th>
                  <th className="px-4 py-3 text-right">FG%</th>
                  <th className="px-4 py-3 text-right">3P%</th>
                  <th className="px-4 py-3 text-right">FT%</th>
                </tr>
              </thead>
              <tbody>
                {[...seasons.data.by_season].reverse().map((s) => (
                  <tr key={s.season} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-ink-primary">{s.season}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{s.games_played}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{s.avg_minutes.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-primary">{s.avg_pts.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-primary">{s.avg_reb.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-primary">{s.avg_ast.toFixed(1)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{pct(s.fg_pct)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{pct(s.fg3_pct)}</td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{pct(s.ft_pct)}</td>
                  </tr>
                ))}
                <tr className="bg-surface-2/50 font-medium">
                  <td className="px-4 py-2.5 text-ink-primary">Career</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{seasons.data.career.games_played}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{seasons.data.career.avg_minutes.toFixed(1)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-primary">{seasons.data.career.avg_pts.toFixed(1)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-primary">{seasons.data.career.avg_reb.toFixed(1)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-primary">{seasons.data.career.avg_ast.toFixed(1)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{pct(seasons.data.career.fg_pct)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{pct(seasons.data.career.fg3_pct)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{pct(seasons.data.career.ft_pct)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
