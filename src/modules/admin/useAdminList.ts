import { computed } from 'vue'
import { useQueryParams } from '@/composables/useQueryParams'
import { usePaginatedTable } from '@/composables/usePagination'
import type { PaginatedResponse } from '@/types'

type Primitive = string | number | boolean
type Defaults = Record<string, Primitive> & { page: number; search: string }

/**
 * URL-synced admin table state: filters, search, sort, page → fetch with cancellation.
 * Every admin list page uses this so filters are shareable links and survive refresh.
 */
export function useAdminList<T, D extends Defaults>(defaults: D, fetcher: (query: Record<string, unknown>, signal: AbortSignal) => Promise<PaginatedResponse<T>>, perPage = 25) {
  const params = useQueryParams(defaults)
  const query = computed(() => ({ ...params.value, perPage }))
  const table = usePaginatedTable<T>((signal) => fetcher(query.value, signal), { watch: query })

  function set(patch: Partial<Record<keyof D, Primitive>>) {
    params.value = { ...params.value, ...patch, page: 'page' in patch ? (patch.page as number) : 1 } as typeof params.value
  }
  function reset() {
    params.value = { ...defaults } as typeof params.value
  }
  const activeCount = computed(() => Object.entries(params.value).filter(([k, v]) => !['page', 'search', 'sort', 'order'].includes(k) && v !== (defaults as Record<string, unknown>)[k]).length)
  function sortBy(sort: string, order: 'asc' | 'desc') {
    set({ sort, order } as Partial<Record<keyof D, Primitive>>)
  }
  return { params, set, reset, activeCount, sortBy, ...table }
}
