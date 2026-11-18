import { onScopeDispose, ref, shallowRef, watch, type Ref, type WatchSource } from 'vue'
import { normalizeError, type ApiError } from '@/services/http'

export interface UseAsyncOptions<T> {
  immediate?: boolean
  initialData?: T
  /** Re-run automatically when any of these sources change. */
  watch?: WatchSource | WatchSource[]
  /** Keep previous data while refetching (avoids layout jumps). */
  keepPreviousData?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: ApiError) => void
}

/**
 * Small async-state helper with cancellation for page-level reads that do not need caching.
 * Server-state that benefits from caching/invalidation uses TanStack Query (see useQueries.ts).
 */
export function useAsync<T, A extends unknown[] = []>(fn: (signal: AbortSignal, ...args: A) => Promise<T>, options: UseAsyncOptions<T> = {}) {
  const data = shallowRef<T | undefined>(options.initialData) as Ref<T | undefined>
  const error = ref<ApiError | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  let controller: AbortController | null = null

  async function run(...args: A): Promise<T | undefined> {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    loading.value = true
    error.value = null
    if (!options.keepPreviousData) data.value = options.initialData
    try {
      const result = await fn(signal, ...args)
      if (signal.aborted) return undefined
      data.value = result
      loaded.value = true
      options.onSuccess?.(result)
      return result
    } catch (e) {
      if (signal.aborted) return undefined
      const err = normalizeError(e)
      if (err.isCancelled) return undefined
      error.value = err
      options.onError?.(err)
      return undefined
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  function cancel() {
    controller?.abort()
    loading.value = false
  }

  if (options.watch) watch(options.watch, () => void run(...([] as unknown as A)), { deep: true })
  if (options.immediate !== false) void run(...([] as unknown as A))
  onScopeDispose(cancel)

  return { data, error, loading, loaded, run, refresh: () => run(...([] as unknown as A)), cancel }
}
