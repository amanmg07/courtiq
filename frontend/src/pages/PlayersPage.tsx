import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useFetch } from '../hooks/useFetch'
import { LoadingState, ErrorState, EmptyState } from '../components/StatusStates'
import PlayerAvatar from '../components/PlayerAvatar'
import TeamBadge from '../components/TeamBadge'
import type { PlayerOut } from '../types/api'

const PAGE_SIZE = 25

export default function PlayersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const browseResult = useFetch(
    () => (search.trim() ? null : api.players(PAGE_SIZE, page * PAGE_SIZE)),
    [search, page],
  )
  const searchResult = useFetch(
    () => (search.trim() ? api.searchPlayers(search.trim(), 50) : null),
    [search],
  )

  const isSearching = search.trim().length > 0
  const players: PlayerOut[] = isSearching ? searchResult.data ?? [] : browseResult.data?.players ?? []
  const loading = isSearching ? searchResult.loading : browseResult.loading
  const error = isSearching ? searchResult.error : browseResult.error
  const total = browseResult.data?.total ?? 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink-primary">Players</h1>
        <p className="mt-1 text-sm text-ink-secondary">Browse the full database or search by name.</p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(0)
        }}
        placeholder="Search by name…"
        className="w-full max-w-md rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-series-1"
      />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && players.length === 0 && <EmptyState message="No players match your search." />}

      {!loading && !error && players.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">First Season</th>
                <th className="px-4 py-3">Last Season</th>
                <th className="px-4 py-3 text-right">Games</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr
                  key={p.player_id}
                  onClick={() => navigate(`/players/${p.player_id}`)}
                  className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar src={p.headshot_url} name={p.full_name} size="sm" />
                      <span className="font-medium text-ink-primary">{p.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <TeamBadge abbreviation={p.current_team} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary">{p.first_season ?? '—'}</td>
                  <td className="px-4 py-2.5 text-ink-secondary">{p.last_season ?? '—'}</td>
                  <td className="tabular px-4 py-2.5 text-right text-ink-secondary">{p.games_played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isSearching && total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-ink-secondary">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
