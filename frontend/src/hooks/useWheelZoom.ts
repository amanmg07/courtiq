import { useEffect, useRef, useState } from 'react'

interface PlotInsets {
  /** Rendered width of the YAxis, in px -- the plot area starts after it. */
  yAxisWidth: number
  marginLeft: number
  marginRight: number
}

/**
 * Scroll-wheel / trackpad-pinch zoom for a time-scale chart, centered on the
 * cursor (a two-finger pinch dispatches as a ctrl+wheel event in every major
 * browser, so no separate gesture handling is needed). Returns a domain to
 * feed straight into Recharts' XAxis `domain` prop, plus the ref to attach to
 * the chart's wrapping div.
 *
 * A native (non-passive) listener is required to preventDefault to stop the
 * browser's own page-zoom/scroll -- React's onWheel prop is passive and can't
 * do that.
 */
export function useWheelZoom(
  fullDomain: [number, number],
  resetKey: unknown,
  insets: PlotInsets,
) {
  const [zoom, setZoom] = useState<[number, number] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setZoom(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const [fullMin, fullMax] = fullDomain
  useEffect(() => {
    const el = containerRef.current
    if (!el || fullMax <= fullMin) return
    const fullSpan = fullMax - fullMin
    const minSpan = Math.max(fullSpan * 0.03, 24 * 60 * 60 * 1000)

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const plotLeft = rect.left + insets.marginLeft + insets.yAxisWidth
      const plotRight = rect.right - insets.marginRight
      const frac = Math.min(1, Math.max(0, (e.clientX - plotLeft) / (plotRight - plotLeft || 1)))

      setZoom((prev) => {
        const [curMin, curMax] = prev ?? [fullMin, fullMax]
        const cursorValue = curMin + frac * (curMax - curMin)
        const zoomingIn = e.deltaY < 0
        const factor = zoomingIn ? 0.82 : 1.22
        let newMin = cursorValue - (cursorValue - curMin) * factor
        let newMax = cursorValue + (curMax - cursorValue) * factor
        newMin = Math.max(fullMin, newMin)
        newMax = Math.min(fullMax, newMax)
        if (newMax - newMin < minSpan) {
          const center = (newMin + newMax) / 2
          newMin = center - minSpan / 2
          newMax = center + minSpan / 2
        }
        if (newMin <= fullMin && newMax >= fullMax) return null
        return [newMin, newMax]
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [fullMin, fullMax, insets.marginLeft, insets.marginRight, insets.yAxisWidth])

  return { containerRef, zoom, setZoom }
}
