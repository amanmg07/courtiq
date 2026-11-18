import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import PlayerAvatar from './PlayerAvatar'
import TeamBadge from './TeamBadge'
import type { PlayerOut } from '../types/api'

interface Props {
  onSelect: (player: PlayerOut) => void
  placeholder?: string
  excludeIds?: number[]
}

// Module-level constant, NOT a `= []` default parameter: a default parameter
// allocates a brand-new array every time this component re-renders (even a
// re-render triggered by its OWN internal setState, independent of the
// parent). That new reference then flows into the effect's dependency array
// below, re-triggering the effect every render -- a self-sustaining infinite
// loop when the caller omits `excludeIds` (caught via a headless Playwright
// console-error check across every page; see frontend/screenshot.mjs).
const NO_EXCLUSIONS: number[] = []

export default function PlayerAutocomplete({ onSelect, placeholder = 'Search players…', excludeIds = NO_EXCLUSIONS }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerOut[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const queryTooShort = query.trim().length < 2

  useEffect(() => {
    // derived at render time instead (see `queryTooShort`/`visibleResults`
    // below) -- avoids a setState call inside the effect for this branch
    if (queryTooShort) return
    const handle = setTimeout(() => {
      api
        .searchPlayers(query.trim(), 8)
        .then((players) => setResults(players.filter((p) => !excludeIds.includes(p.player_id))))
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(handle)
  }, [query, excludeIds, queryTooShort])

  const visibleResults = queryTooShort ? [] : results

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-series-1"
      />
      {open && visibleResults.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface-2 shadow-lg">
          {visibleResults.map((p) => (
            <li key={p.player_id}>
              <button
                onClick={() => {
                  onSelect(p)
                  setQuery('')
                  setResults([])
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-1"
              >
                <PlayerAvatar src={p.headshot_url} name={p.full_name} size="sm" />
                <span className="flex-1 truncate">{p.full_name}</span>
                <TeamBadge abbreviation={p.current_team} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
