import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { TeamOut } from '../types/api'

// Teams are 30 static rows -- fetch once, share across every component that
// needs a team's colors/name, instead of each one issuing its own request.
let cache: TeamOut[] | null = null
let inflight: Promise<TeamOut[]> | null = null

function loadTeams(): Promise<TeamOut[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = api.teams().then((teams) => {
      cache = teams
      return teams
    })
  }
  return inflight
}

export function useTeams(): TeamOut[] {
  const [teams, setTeams] = useState<TeamOut[]>(cache ?? [])
  useEffect(() => {
    if (!cache) loadTeams().then(setTeams)
  }, [])
  return teams
}

export function useTeam(abbreviation: string | null | undefined): TeamOut | undefined {
  const teams = useTeams()
  return teams.find((t) => t.abbreviation === abbreviation)
}
