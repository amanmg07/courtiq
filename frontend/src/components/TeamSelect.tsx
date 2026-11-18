import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { TeamOut } from '../types/api'

interface Props {
  value: string
  onChange: (abbr: string) => void
  excludeAbbr?: string
}

export default function TeamSelect({ value, onChange, excludeAbbr }: Props) {
  const [teams, setTeams] = useState<TeamOut[]>([])

  useEffect(() => {
    api.teams().then(setTeams).catch(() => setTeams([]))
  }, [])

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-series-1"
    >
      <option value="">Select opponent…</option>
      {teams
        .filter((t) => t.abbreviation !== excludeAbbr)
        .map((t) => (
          <option key={t.abbreviation} value={t.abbreviation}>
            {t.name}
          </option>
        ))}
    </select>
  )
}
