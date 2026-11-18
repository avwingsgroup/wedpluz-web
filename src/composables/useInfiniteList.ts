import { computed, ref, shallowRef, watch, type WatchSource } from 'vue'
import { normalizeError, type ApiError } from '@/services/http'
import type { PaginatedResponse } from '@/types'

/** "Load more" pagination helper over the standard paginated envelope. */
export function useInfiniteList<T>(fetcher: (page: number, signal: AbortSignal) => Promise<PaginatedResponse<T>>, options: { watch?: WatchSource | WatchSource[]; immediate?: boolean } = {}) {
  const items = shallowRef<T[]>([])
  const page = ref(0)
  const lastPage = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<ApiError | null>(null)
  let controller: AbortController | null = null

  const hasMore = computed(() => page.value < lastPage.value)
  const isEmpty = computed(() => !loading.value && items.value.length === 0)

  async function load(reset = true) {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    if (reset) {
      loading.value = true
      page.value = 0
    } else loadingMore.value = true
    error.value = null
    try {
      const res = await fetcher(page.value + 1, signal)
      if (signal.aborted) return
      items.value = reset ? res.data : [...items.value, ...res.data]
      page.value = res.meta.page
      lastPage.value = res.meta.lastPage
      total.value = res.meta.total
    } catch (e) {
      if (signal.aborted) return
      const err = normalizeError(e)
      if (!err.isCancelled) error.value = err
    } finally {
      if (!signal.aborted) {
        loading.value = false
        loadingMore.value = false
      }
    }
  }

  const loadMore = () => (hasMore.value && !loadingMore.value ? load(false) : Promise.resolve())
  const refresh = () => load(true)

  function replace(predicate: (item: T) => boolean, updater: (item: T) => T) {
    items.value = items.value.map((i) => (predicate(i) ? updater(i) : i))
  }
  function remove(predicate: (item: T) => boolean) {
    items.value = items.value.filter((i) => !predicate(i))
    total.value = Math.max(0, total.value - 1)
  }
  function prepend(item: T) {
    items.value = [item, ...items.value]
    total.value += 1
  }

  if (options.watch) watch(options.watch, () => void load(true), { deep: true })
  if (options.immediate !== false) void load(true)

  return { items, page, lastPage, total, loading, loadingMore, error, hasMore, isEmpty, load, loadMore, refresh, replace, remove, prepend }
}
