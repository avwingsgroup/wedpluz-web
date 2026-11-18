import { computed, type WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type Primitive = string | number | boolean | null | undefined
type Widen<T> = { [K in keyof T]: T[K] extends boolean ? boolean : T[K] extends number ? number : T[K] extends string ? string : T[K] }

/**
 * Two-way binding between reactive filter state and the URL query string so list pages
 * are shareable and survive refresh. Defaults are omitted from the URL to keep it clean.
 */
export function useQueryParams<D extends Record<string, Primitive>>(defaults: D): WritableComputedRef<Widen<D>> {
  type T = Widen<D>
  const route = useRoute()
  const router = useRouter()

  return computed<T>({
    get() {
      const out = { ...defaults } as Record<string, Primitive>
      for (const key of Object.keys(defaults)) {
        const raw = route.query[key]
        if (raw === undefined || raw === null) continue
        const value = Array.isArray(raw) ? raw[0] : raw
        const def = defaults[key as keyof D]
        if (typeof def === 'number') out[key] = value === '' ? def : Number(value)
        else if (typeof def === 'boolean') out[key] = value === 'true'
        else out[key] = value
      }
      return out as T
    },
    set(next) {
      const query: Record<string, string> = {}
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === null || value === '' || value === defaults[key as keyof D]) continue
        query[key] = String(value)
      }
      void router.replace({ query })
    },
  })
}
