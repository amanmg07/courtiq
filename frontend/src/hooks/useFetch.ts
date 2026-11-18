import { useEffect, useState, useCallback } from 'react'
import { ApiRequestError } from '../api/client'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** Runs `fetcher` whenever `deps` change. `fetcher` returning `null` (e.g. no
 * player selected yet) skips the request entirely -- no loading/error flicker. */
export function useFetch<T>(fetcher: () => Promise<T> | null, deps: React.DependencyList): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null })

  const run = useCallback(() => {
    const promise = fetcher()
    if (promise === null) {
      setState({ data: null, loading: false, error: null })
      return
    }
    setState((s) => ({ ...s, loading: true, error: null }))
    promise
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => {
        const message = err instanceof ApiRequestError ? err.message : 'Failed to load data'
        setState({ data: null, loading: false, error: message })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  return state
}
