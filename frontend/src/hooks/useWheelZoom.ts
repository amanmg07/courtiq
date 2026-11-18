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
 * the chart's wrapping div. The window is rendered via the axis's own
 * `domain` -- NOT re-derived from whichever points fall inside it -- so
 * the pixel-per-ms scale stays fixed while panning. The flip side is that
 * zooming/panning must never let the window drift wider than where the
 * data actually is, or the fixed-scale rendering shows mostly blank chart.
 *
 * `points` is every data point's timestamp (unsorted is fine). Meetings
 * against one opponent, or any sparse series, cluster with real gaps
 * between them, so a candidate window is rejected (held at the current
 * one) rather than applied whenever it would contain fewer than
 * `minVisiblePoints`. That's also why there's no fixed-percentage "minimum
 * span" floor here: forcing the window to some arbitrary width (e.g. 3% of
 * the full range) regardless of local density is exactly what used to
 * leave most of a zoomed-in chart blank -- the real floor is "however
 * tight the window can get while still containing enough real points,"
 * which is what the countInRange checks below enforce directly.
 *
 * A native (non-passive) listener is required to preventDefault to stop the
 * browser's own page-zoom/scroll -- React's onWheel prop is passive and
 * can't do that.
 */
export function useWheelZoom(
  points: number[],
  resetKey: unknown,
  insets: PlotInsets,
  // Default 2, not 1: a lone point isolated from its neighbors renders
  // badly either way -- a line chart with dot={false} draws nothing for a
  // single point, and a bar chart's bar width isn't scaled to a numeric
  // axis's domain, so one point zoomed down near the technical floor
  // renders as a tiny sliver in an otherwise-blank plot. Requiring 2 ties
  // the window's minimum width to the real gap between two actual points
  // instead.
  minVisiblePoints = 2,
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
  const effectiveMinVisible = Math.min(minVisiblePoints, points.length || 1)

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
        if (countInRange(newMin, newMax) < effectiveMinVisible) return prev
        if (newMin <= fullMin && newMax >= fullMax) return null
        return [newMin, newMax]
      })
    },
    [fullMin, fullMax, countInRange, effectiveMinVisible],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el || fullMax <= fullMin) return
    // A purely technical floor to guard against a degenerate zero-width
    // window (e.g. floating-point drift), NOT a visual "don't zoom past
    // this" limit -- that job belongs entirely to the point-count check.
    const technicalFloorSpan = 60 * 60 * 1000

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
        if (newMax - newMin < technicalFloorSpan) {
          const center = (newMin + newMax) / 2
          newMin = center - technicalFloorSpan / 2
          newMax = center + technicalFloorSpan / 2
          if (newMin < fullMin) {
            newMax += fullMin - newMin
            newMin = fullMin
          }
          if (newMax > fullMax) {
            newMin -= newMax - fullMax
            newMax = fullMax
          }
        }
        // Zooming in further than the data can support would leave the
        // (fixed-scale) chart mostly blank -- hold at the current window
        // instead of shrinking into near-emptiness.
        if (zoomingIn && countInRange(newMin, newMax) < effectiveMinVisible) return prev
        if (zoomingIn) {
          // The cursor-centered shrink can legitimately produce a window
          // that's still valid (>= minVisiblePoints) but where those points
          // only occupy a small fraction of it -- e.g. the cursor landed
          // near a sparser stretch, so the nearest enough points to satisfy
          // the count are spread out relative to the window. Left alone,
          // that renders as a short line/cluster of bars surrounded by a
          // lot of visibly blank chart, which reads as "part of the chart
          // disappeared." Snap the window in around the actual points
          // whenever they fill less than half of it, with some padding --
          // this only ever tightens what was asked for, never loosens it.
          const inRange = points.filter((t) => t >= newMin && t <= newMax)
          const dataMin = Math.min(...inRange)
          const dataMax = Math.max(...inRange)
          const dataSpan = dataMax - dataMin
          const windowSpan = newMax - newMin
          if (dataSpan > 0 && dataSpan / windowSpan < 0.5) {
            const pad = Math.max(dataSpan * 0.15, technicalFloorSpan / 4)
            newMin = Math.max(fullMin, dataMin - pad)
            newMax = Math.min(fullMax, dataMax + pad)
          }
        }
        if (newMin <= fullMin && newMax >= fullMax) return null
        return [newMin, newMax]
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [points, fullMin, fullMax, countInRange, effectiveMinVisible, insets.marginLeft, insets.marginRight, insets.yAxisWidth])

  return { containerRef, zoom, setZoom, panBy, fullDomain }
}
