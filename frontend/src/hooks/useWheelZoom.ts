import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface PlotInsets {
  /** Rendered width of the YAxis, in px -- the plot area starts after it. */
  yAxisWidth: number
  marginLeft: number
  marginRight: number
}

/**
 * Scroll-wheel / trackpad-pinch zoom for a time-scale chart, centered on
 * the cursor -- a trackpad pinch dispatches as a ctrl+wheel event in every
 * major browser, so no separate gesture handling is needed; a plain
 * vertical scroll zooms the same way. Panning is NOT driven by a swipe
 * gesture here -- a horizontal two-finger swipe is too easily read as part
 * of the zoom motion instead (there's no reliable way to tell "pan" from
 * "an imprecise pinch" from deltaX/deltaY alone), so panning is exposed as
 * `panBy`/`fullDomain` for a caller to drive from an explicit control (a
 * draggable scrollbar, e.g. ChartPanBar) instead.
 *
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

  const countInRange = useCallback(
    (min: number, max: number) => points.reduce((n, t) => (t >= min && t <= max ? n + 1 : n), 0),
    [points],
  )

  const panBy = useCallback(
    (deltaTime: number) => {
      if (fullMax <= fullMin) return
      setZoom((prev) => {
        const [curMin, curMax] = prev ?? [fullMin, fullMax]
        let newMin = curMin + deltaTime
        let newMax = curMax + deltaTime
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
      })
    },
    [fullMin, fullMax, countInRange],
  )

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
      const plotWidth = Math.max(plotRight - plotLeft, 1)

      setZoom((prev) => {
        const [curMin, curMax] = prev ?? [fullMin, fullMax]
        const span = curMax - curMin

        const frac = Math.min(1, Math.max(0, (e.clientX - plotLeft) / plotWidth))
        const cursorValue = curMin + frac * span
        const zoomingIn = e.deltaY < 0
        // Scale the step by how big this particular wheel tick was rather
        // than a fixed jump per event -- a trackpad pinch/scroll reports
        // many small deltas per gesture, so a fixed step feels choppy
        // (every tick, however small, snapping the view by the same large
        // amount). Clamped so one unusually large delta can't jump too far.
        const factor = Math.min(1.5, Math.max(0.67, Math.exp(e.deltaY * 0.0025)))
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
  }, [fullMin, fullMax, countInRange, insets.marginLeft, insets.marginRight, insets.yAxisWidth])

  return { containerRef, zoom, setZoom, panBy, fullDomain }
}
