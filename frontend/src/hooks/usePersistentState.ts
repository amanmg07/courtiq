import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Same shape as useState, but backed by sessionStorage under `key` -- so the
 * value survives a page's component unmounting (e.g. navigating to another
 * tab and back, which React Router does on every route change) and an
 * accidental refresh within the same browser tab/session. Clears when the
 * tab is closed, unlike localStorage, which seemed like the right default
 * for "don't lose my filters when I click away" without the state becoming
 * permanently sticky across unrelated future visits.
 *
 * Wrapped in try/catch throughout: sessionStorage can throw (private
 * browsing, storage disabled, a quota error) -- on any failure this just
 * behaves like a plain useState instead of crashing the page.
 */
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state))
    } catch {
      // ignore -- storage unavailable/full; the page still works, just without persistence
    }
  }, [key, state])

  return [state, setState]
}
