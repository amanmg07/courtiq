// Mirrors backend/app/schemas/*.py. Kept hand-in-sync deliberately (no
// codegen step yet) -- if you add/change a backend field, update here too.

export interface TeamOut {
  abbreviation: string
  name: string
  conference: string
  division: string
  primary_color: string
  secondary_color: string
}

export interface PlayerOut {
  player_id: number
  full_name: string
  first_season: string | null
  last_season: string | null
  games_played: number
  current_team: string | null
  headshot_url: string
}

export interface PlayerListResponse {
  total: number
  limit: number
  offset: number
  players: PlayerOut[]
}

export interface PlayerDetail extends PlayerOut {
  career_avg_pts: number | null
  career_avg_reb: number | null
  career_avg_ast: number | null
  career_avg_minutes: number | null
  career_fg_pct: number | null
  career_fg3_pct: number | null
  career_ft_pct: number | null
}

export interface GameLogEntry {
  game_id: string
  game_date: string
  season: string
  team_abbr: string
  opponent_abbr: string
  is_home: boolean
  minutes: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
  plus_minus: number
  fgm: number
  fga: number
  fg_pct: number | null
  fg3m: number
  fg3a: number
  fg3_pct: number | null
  ftm: number
  fta: number
  ft_pct: number | null
}

export interface GameLogResponse {
  player: PlayerOut
  total: number
  limit: number
  offset: number
  games: GameLogEntry[]
}

export interface SeasonAverage {
  season: string
  games_played: number
  avg_minutes: number
  avg_pts: number
  avg_reb: number
  avg_ast: number
  avg_stl: number
  avg_blk: number
  avg_tov: number
  fg_pct: number | null
  fg3_pct: number | null
  ft_pct: number | null
}

export interface SeasonAveragesResponse {
  player: PlayerOut
  career: SeasonAverage
  by_season: SeasonAverage[]
}

export interface TrendPoint {
  game_id: string
  game_date: string
  season: string
  opponent_abbr: string
  is_home: boolean
  minutes: number
  pts: number
  reb: number
  ast: number
  fg_pct: number | null
  fg3_pct: number | null
  ft_pct: number | null
  pts_l5_avg: number | null
  pts_l10_avg: number | null
  reb_l5_avg: number | null
  reb_l10_avg: number | null
  ast_l5_avg: number | null
  ast_l10_avg: number | null
}

export interface TrendsResponse {
  player: PlayerOut
  points: TrendPoint[]
}

export interface MatchupGame {
  game_id: string
  game_date: string
  season: string
  is_home: boolean
  minutes: number
  pts: number
  reb: number
  ast: number
  fg_pct: number | null
}

export interface MatchupResponse {
  player: PlayerOut
  opponent: string
  games_played: number
  avg_pts: number | null
  avg_reb: number | null
  avg_ast: number | null
  avg_minutes: number | null
  fg_pct: number | null
  home_avg_pts: number | null
  away_avg_pts: number | null
  recent_games: MatchupGame[]
}

export interface ComparisonEntry {
  player: PlayerOut
  stats: SeasonAverage
}

export interface ComparisonResponse {
  season: string
  players: ComparisonEntry[]
}

export interface LeaderEntry {
  player: PlayerOut
  avg_value: number
  games_played: number
}

export interface LeadersResponse {
  stat: string
  season: string
  leaders: LeaderEntry[]
}

export interface StatPrediction {
  predicted: number
  recent_avg_l10: number | null
  season_avg: number | null
  mae: number
}

export interface PredictionResponse {
  player_id: number
  opponent_abbr: string
  is_home: boolean
  pts: StatPrediction
  reb: StatPrediction
  ast: StatPrediction
  model_info: string
}

export interface UpcomingGame {
  game_date: string // ISO 8601 UTC
  opponent_abbr: string
  is_home: boolean
}

export interface UpcomingGamesResponse {
  player: PlayerOut
  games: UpcomingGame[]
}

export interface ApiError {
  detail: string
}
