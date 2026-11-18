import type {
  TeamOut, PlayerListResponse, PlayerOut, PlayerDetail, GameLogResponse,
  SeasonAveragesResponse, TrendsResponse, MatchupResponse, ComparisonResponse,
  LeadersResponse,
} from '../types/api'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

export class ApiRequestError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
  }
}

async function request<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
    }
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiRequestError(res.status, body.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const responseBody = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiRequestError(res.status, responseBody.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export const api = {
  teams: () => request<TeamOut[]>('/teams'),

  players: (limit = 50, offset = 0) =>
    request<PlayerListResponse>('/players', { limit, offset }),

  searchPlayers: (q: string, limit = 20) =>
    request<PlayerOut[]>('/players/search', { q, limit }),

  playerDetail: (playerId: number) =>
    request<PlayerDetail>(`/players/${playerId}`),

  gameLog: (playerId: number, opts?: { season?: string; opponent?: string; limit?: number; offset?: number }) =>
    request<GameLogResponse>(`/players/${playerId}/gamelog`, { ...opts }),

  seasonAverages: (playerId: number) =>
    request<SeasonAveragesResponse>(`/players/${playerId}/season-averages`),

  trends: (playerId: number, opts?: { season?: string; last_n?: number }) =>
    request<TrendsResponse>(`/players/${playerId}/trends`, { ...opts }),

  matchup: (playerId: number, opponent: string, season?: string) =>
    request<MatchupResponse>(`/players/${playerId}/matchup/${opponent}`, { season }),

  compare: (playerIds: number[], season?: string) =>
    request<ComparisonResponse>('/compare', { player_ids: playerIds.join(','), season }),

  leaders: (stat: string, opts?: { season?: string; limit?: number }) =>
    request<LeadersResponse>('/leaders', { stat, ...opts }),

  predict: (playerId: number, opponentAbbr: string, isHome: boolean) =>
    post<unknown>('/predict', { player_id: playerId, opponent_abbr: opponentAbbr, is_home: isHome }),
}
