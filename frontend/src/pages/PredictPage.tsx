import { useState } from 'react'
import { api, ApiRequestError } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/StatusStates'
import PlayerAutocomplete from '../components/PlayerAutocomplete'
import TeamSelect from '../components/TeamSelect'
import StatCard from '../components/StatCard'
import type { PlayerOut, PredictionResponse, StatPrediction } from '../types/api'

type PredictCallState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'unavailable'; message: string }
  | { status: 'result'; data: PredictionResponse }

const STAT_META: { key: 'pts' | 'reb' | 'ast'; label: string; accent: 'series-1' | 'series-2' | 'series-3' }[] = [
  { key: 'pts', label: 'Points', accent: 'series-1' },
  { key: 'reb', label: 'Rebounds', accent: 'series-2' },
  { key: 'ast', label: 'Assists', accent: 'series-3' },
]

function PredictionCard({ label, stat, accent }: { label: string; stat: StatPrediction; accent: 'series-1' | 'series-2' | 'series-3' }) {
  return (
    <StatCard
      label={label}
      value={stat.predicted.toFixed(1)}
      sublabel={`± ${stat.mae.toFixed(1)} MAE (measured)`}
      accent={accent}
    />
  )
}

export default function PredictPage() {
  const [player, setPlayer] = useState<PlayerOut | null>(null)
  const [opponent, setOpponent] = useState('')
  const [isHome, setIsHome] = useState(true)
  const [predictState, setPredictState] = useState<PredictCallState>({ status: 'idle' })

  // Real historical context, shown alongside the prediction (and still useful
  // on its own if the prediction call fails for any reason).
  const seasonAvg = useFetch(() => (player ? api.seasonAverages(player.player_id) : null), [player?.player_id])
  const trend = useFetch(() => (player ? api.trends(player.player_id, { last_n: 10 }) : null), [player?.player_id])
  const matchup = useFetch(
    () => (player && opponent ? api.matchup(player.player_id, opponent) : null),
    [player?.player_id, opponent],
  )

  async function handlePredict() {
    if (!player || !opponent) return
    setPredictState({ status: 'loading' })
    try {
      const data = await api.predict(player.player_id, opponent, isHome)
      setPredictState({ status: 'result', data })
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : 'Prediction service unavailable'
      setPredictState({ status: 'unavailable', message })
    }
  }

  const l10 = trend.data?.points.length ? trend.data.points[trend.data.points.length - 1] : null
  const careerSeason = seasonAvg.data?.by_season[seasonAvg.data.by_season.length - 1]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">Predictions</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Estimate a player's points, rebounds, and assists for an upcoming matchup.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:max-w-2xl">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Player</label>
          {player ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2 text-sm">
              <span>{player.full_name}</span>
              <button
                onClick={() => {
                  setPlayer(null)
                  setPredictState({ status: 'idle' })
                }}
                className="text-ink-muted hover:text-critical"
              >
                ×
              </button>
            </div>
          ) : (
            <PlayerAutocomplete onSelect={setPlayer} />
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Opponent</label>
          <TeamSelect
            value={opponent}
            onChange={(v) => {
              setOpponent(v)
              setPredictState({ status: 'idle' })
            }}
            excludeAbbr={player?.current_team ?? undefined}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Location</label>
          <div className="flex gap-1 rounded-md border border-border bg-surface-1 p-1">
            <button
              onClick={() => setIsHome(true)}
              className={`flex-1 rounded px-2 py-1.5 text-sm ${isHome ? 'bg-surface-2 text-ink-primary' : 'text-ink-secondary'}`}
            >
              Home
            </button>
            <button
              onClick={() => setIsHome(false)}
              className={`flex-1 rounded px-2 py-1.5 text-sm ${!isHome ? 'bg-surface-2 text-ink-primary' : 'text-ink-secondary'}`}
            >
              Away
            </button>
          </div>
        </div>
      </div>

      {!player || !opponent ? (
        <EmptyState message="Select a player and opponent to see predictions and current-form context." />
      ) : (
        <div className="space-y-6">
          <button
            onClick={handlePredict}
            disabled={predictState.status === 'loading'}
            className="rounded-md bg-series-1 px-4 py-2 text-sm font-semibold text-page transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {predictState.status === 'loading' ? 'Generating…' : 'Generate Prediction'}
          </button>

          {predictState.status === 'unavailable' && (
            <div className="rounded-lg border border-warning/40 bg-surface-1 p-4">
              <p className="text-sm font-medium text-warning">Predictions aren't available yet</p>
              <p className="mt-1 text-sm text-ink-secondary">{predictState.message}</p>
            </div>
          )}

          {predictState.status === 'result' && (
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink-primary">
                Predicted vs. {predictState.data.opponent_abbr} ({predictState.data.is_home ? 'Home' : 'Away'})
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {STAT_META.map((m) => (
                  <PredictionCard key={m.key} label={m.label} stat={predictState.data[m.key]} accent={m.accent} />
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                {predictState.data.model_info}. MAE is the model's measured average error on a real, time-based
                held-out test set — not a confidence score, but a concrete "typically off by about this much."
              </p>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink-primary">Current Form — Statistical Context</h2>
            {(seasonAvg.loading || trend.loading) && <LoadingState />}
            {seasonAvg.error && <ErrorState message={seasonAvg.error} />}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">Last 10 Games</p>
                <div className="space-y-2">
                  <StatCard label="PTS" value={l10?.pts_l10_avg?.toFixed(1) ?? '—'} accent="series-1" />
                  <StatCard label="REB" value={l10?.reb_l10_avg?.toFixed(1) ?? '—'} accent="series-2" />
                  <StatCard label="AST" value={l10?.ast_l10_avg?.toFixed(1) ?? '—'} accent="series-3" />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">This Season</p>
                <div className="space-y-2">
                  <StatCard label="PTS" value={careerSeason?.avg_pts.toFixed(1) ?? '—'} accent="series-1" />
                  <StatCard label="REB" value={careerSeason?.avg_reb.toFixed(1) ?? '—'} accent="series-2" />
                  <StatCard label="AST" value={careerSeason?.avg_ast.toFixed(1) ?? '—'} accent="series-3" />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  vs {opponent} {matchup.data && matchup.data.games_played > 0 ? `(${matchup.data.games_played}g)` : ''}
                </p>
                <div className="space-y-2">
                  <StatCard label="PTS" value={matchup.data?.avg_pts?.toFixed(1) ?? '—'} accent="series-1" />
                  <StatCard label="REB" value={matchup.data?.avg_reb?.toFixed(1) ?? '—'} accent="series-2" />
                  <StatCard label="AST" value={matchup.data?.avg_ast?.toFixed(1) ?? '—'} accent="series-3" />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
