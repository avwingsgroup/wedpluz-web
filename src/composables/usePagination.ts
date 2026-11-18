import { computed, ref, shallowRef, watch, type WatchSource } from 'vue'
import { normalizeError, type ApiError } from '@/services/http'
import type { PaginatedResponse, PaginationMeta } from '@/types'

/** Classic page-based table pagination used by the admin dashboard. */
export function usePaginatedTable<T>(fetcher: (signal: AbortSignal) => Promise<PaginatedResponse<T>>, options: { watch?: WatchSource | WatchSource[]; immediate?: boolean } = {}) {
  const rows = shallowRef<T[]>([])
  const meta = ref<PaginationMeta>({ page: 1, perPage: 25, total: 0, lastPage: 1 })
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  let controller: AbortController | null = null

  async function load() {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    loading.value = true
    error.value = null
    try {
      const res = await fetcher(signal)
      if (signal.aborted) return
      rows.value = res.data
      meta.value = res.meta
    } catch (e) {
      if (signal.aborted) return
      const err = normalizeError(e)
      if (!err.isCancelled) error.value = err
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  const isEmpty = computed(() => !loading.value && rows.value.length === 0)
  const rangeLabel = computed(() => {
    if (!meta.value.total) return '0 results'
    const start = (meta.value.page - 1) * meta.value.perPage + 1
    const end = Math.min(meta.value.total, meta.value.page * meta.value.perPage)
    return `${start}–${end} of ${meta.value.total.toLocaleString()}`
  })

  function replace(predicate: (row: T) => boolean, next: T) {
    rows.value = rows.value.map((r) => (predicate(r) ? next : r))
  }

  if (options.watch) watch(options.watch, () => void load(), { deep: true })
  if (options.immediate !== false) void load()

  return { rows, meta, loading, error, isEmpty, rangeLabel, load, refresh: load, replace }
}
