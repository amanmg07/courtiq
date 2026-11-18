import { useEffect, useMemo, useRef, useState } from 'react'

interface PlotInsets {
  /** Rendered width of the YAxis, in px -- the plot area starts after it. */
  yAxisWidth: number
  marginLeft: number
  marginRight: number
}

/**
 * Scroll-wheel / trackpad zoom-and-pan for a time-scale chart:
 *  - pinch (or a plain vertical two-finger scroll) zooms in/out centered on
 *    the cursor -- a trackpad pinch dispatches as a ctrl+wheel event in
 *    every major browser, so no separate gesture handling is needed.
 *  - a horizontal two-finger swipe pans the visible window left/right.
 * Returns the current window (null = full range) and the ref to attach to
 * the chart's wrapping div. The window is a math range only -- the caller
 * should still derive the actual rendered axis domain from whichever real
 * data points fall inside it (via XAxis domain={['dataMin','dataMax']} on
 * the filtered array), not from this range directly, so the chart always
 * fills edge-to-edge instead of leaving blank space where the window
 * doesn't line up with an actual point.
 *
 * `points` is every data point's timestamp (unsorted is fine). Meetings
 * against one opponent, or any sparse series, cluster with real gaps
 * between them -- a candidate window that would contain zero points (i.e.
 * it landed entirely inside a gap) is rejected rather than applied, so
 * zooming/panning can't run the chart empty.
 *
 * A native (non-passive) listener is required to preventDefault to stop the
 * browser's own page-zoom/scroll -- React's onWheel prop is passive and
 * can't do that.
 */
export function useWheelZoom(
  points: number[],
  resetKey: unknown,
  insets: PlotInsets,
) {
  const [zoom, setZoom] = useState<[number, number] | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setZoom(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const fullDomain = useMemo<[number, number]>(() => {
    if (points.length === 0) return [0, 1]
    return [Math.min(...points), Math.max(...points)]
  }, [points])
  const [fullMin, fullMax] = fullDomain

  useEffect(() => {
    const el = containerRef.current
    if (!el || fullMax <= fullMin) return
    const fullSpan = fullMax - fullMin
    const minSpan = Math.max(fullSpan * 0.03, 24 * 60 * 60 * 1000)
    const countInRange = (min: number, max: number) => points.reduce((n, t) => (t >= min && t <= max ? n + 1 : n), 0)

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const plotLeft = rect.left + insets.marginLeft + insets.yAxisWidth
      const plotRight = rect.right - insets.marginRight
      const plotWidth = Math.max(plotRight - plotLeft, 1)

      // A horizontal swipe (no ctrl key -- that's reserved for pinch) pans;
      // everything else (pinch, or a plain vertical scroll) zooms.
      const isPan = !e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)

      setZoom((prev) => {
        const [curMin, curMax] = prev ?? [fullMin, fullMax]
        const span = curMax - curMin

        if (isPan) {
          const shift = (e.deltaX / plotWidth) * span
          let newMin = curMin + shift
          let newMax = curMax + shift
          if (newMin < fullMin) {
            newMax += fullMin - newMin
            newMin = fullMin
          }
          if (newMax > fullMax) {
            newMin -= newMax - fullMax
            newMax = fullMax
          }
          newMin = Math.max(fullMin, newMin)
          newMax = Math.min(fullMax, newMax)
          if (countInRange(newMin, newMax) === 0) return prev
          if (newMin <= fullMin && newMax >= fullMax) return null
          return [newMin, newMax]
        }

        const frac = Math.min(1, Math.max(0, (e.clientX - plotLeft) / plotWidth))
        const cursorValue = curMin + frac * span
        const zoomingIn = e.deltaY < 0
        const factor = zoomingIn ? 0.85 : 1.18
        let newMin = cursorValue - (cursorValue - curMin) * factor
        let newMax = cursorValue + (curMax - cursorValue) * factor
        newMin = Math.max(fullMin, newMin)
        newMax = Math.min(fullMax, newMax)
        if (newMax - newMin < minSpan) {
          const center = (newMin + newMax) / 2
          newMin = center - minSpan / 2
          newMax = center + minSpan / 2
          // Recentering can push back out of bounds near an edge (e.g. a
          // cursor close to fullMax) -- slide it back in without changing
          // its width, same as the pan clamp above.
          if (newMin < fullMin) {
            newMax += fullMin - newMin
            newMin = fullMin
          }
          if (newMax > fullMax) {
            newMin -= newMax - fullMax
            newMax = fullMax
          }
        }
        // Zooming in further than the nearest point to the cursor would
        // run the chart empty (sparse series have real gaps between
        // clusters) -- hold at the current window instead of collapsing it.
        if (zoomingIn && countInRange(newMin, newMax) === 0) return prev
        if (newMin <= fullMin && newMax >= fullMax) return null
        return [newMin, newMax]
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [points, fullMin, fullMax, insets.marginLeft, insets.marginRight, insets.yAxisWidth])

  return { containerRef, zoom, setZoom }
}
