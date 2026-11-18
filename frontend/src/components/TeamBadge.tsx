import { useTeam } from '../hooks/useTeams'

interface Props {
  abbreviation: string | null | undefined
  size?: 'sm' | 'md'
}

/** A small pill in the team's real brand color -- the "more consistent
 * coloring" pass: team identity now shows up anywhere a team is named,
 * not just as plain gray-bordered text. */
export default function TeamBadge({ abbreviation, size = 'sm' }: Props) {
  const team = useTeam(abbreviation ?? undefined)
  if (!abbreviation) {
    return <span className="text-ink-muted">—</span>
  }
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold text-white ${padding}`}
      style={{ backgroundColor: team?.primary_color ?? 'var(--color-surface-2)' }}
      title={team?.name}
    >
      {abbreviation}
    </span>
  )
}
