import { useState } from 'react'

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-24 w-24 text-2xl',
  xl: 'h-36 w-36 text-4xl',
} as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

interface Props {
  src: string
  name: string
  size?: keyof typeof SIZE_CLASSES
  ringColor?: string // team primary color, drawn as a subtle ring around the photo
  className?: string
}

/** NBA.com's CDN already serves a generic silhouette for ids it doesn't
 * recognize (verified directly), but onError still covers network failures
 * and historical/obscure ids -- falls back to a colored initials circle
 * rather than a broken-image icon. */
export default function PlayerAvatar({ src, name, size = 'md', ringColor, className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const sizeClass = SIZE_CLASSES[size]

  if (failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-ink-secondary ${sizeClass} ${className}`}
        style={ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : undefined}
        title={name}
      >
        {initials(name)}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-surface-2 object-cover ${sizeClass} ${className}`}
      style={ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : undefined}
    />
  )
}
