import { useRef } from 'react'

interface Props {
  zoom: [number, number] | null
  fullDomain: [number, number]
  onPan: (deltaTime: number) => void
}

/**
 * A thin draggable scrollbar below a zoomed chart, for panning left/right.
 * Deliberately NOT a swipe gesture on the chart itself -- a horizontal
 * two-finger swipe is too easily read as part of the pinch-zoom motion
 * (there's no reliable way to tell "pan" from "an imprecise pinch" from
 * wheel deltas alone), so this gives panning its own unambiguous control.
 */
export default function ChartPanBar({ zoom, fullDomain, onPan }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [fullMin, fullMax] = fullDomain
  const fullSpan = fullMax - fullMin || 1
  const [curMin, curMax] = zoom ?? fullDomain
  const leftPct = ((curMin - fullMin) / fullSpan) * 100
  const widthPct = Math.min(100, Math.max(((curMax - curMin) / fullSpan) * 100, 3))
  const draggable = zoom !== null

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return
    e.preventDefault()
    const track = trackRef.current
    if (!track) return
    const trackWidth = track.getBoundingClientRect().width || 1
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    // Track clientX deltas ourselves rather than relying on ev.movementX --
    // it's unset/unreliable on some synthetic and touch-emulated pointer
    // event sequences.
    let lastX = e.clientX

    const onMove = (ev: PointerEvent) => {
      const deltaTime = ((ev.clientX - lastX) / trackWidth) * fullSpan
      lastX = ev.clientX
      if (deltaTime !== 0) onPan(deltaTime)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div ref={trackRef} className="relative mt-2 h-2 rounded-full bg-surface-2">
      <div
        onPointerDown={onPointerDown}
        className={`absolute top-0 h-2 rounded-full bg-series-1 ${draggable ? 'cursor-grab opacity-70 hover:opacity-100 active:cursor-grabbing active:opacity-100' : 'opacity-30'}`}
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      />
    </div>
  )
}
