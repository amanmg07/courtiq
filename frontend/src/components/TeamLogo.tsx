import { useState } from 'react'
import { useTeam } from '../hooks/useTeams'

const SIZE_CLASSES = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-24 w-24',
} as const

/** Real team logo (ESPN's public CDN -- verified to load directly in a
 * browser, unlike the NBA headshot CDN, so no proxy needed here). Falls
 * back to a colored circle with the abbreviation if the image fails to
 * load, same spirit as PlayerAvatar's initials fallback. */
export default function TeamLogo({ abbreviation, size = 'md' }: { abbreviation: string; size?: keyof typeof SIZE_CLASSES }) {
  const team = useTeam(abbreviation)
  const [failed, setFailed] = useState(false)
  const sizeClass = SIZE_CLASSES[size]

  if (!team || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${sizeClass}`}
        style={{ backgroundColor: team?.primary_color ?? 'var(--color-surface-2)' }}
      >
        {abbreviation}
      </div>
    )
  }

  return (
    <img
      src={team.logo_url}
      alt={team.name}
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${sizeClass}`}
    />
  )
}
