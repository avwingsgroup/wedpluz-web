import { onMounted, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useRoute } from 'vue-router'
import { applySeo, type SeoMeta } from '@/utils/seo'

/**
 * Page-level SEO. The router resets the head to route defaults on every navigation; this
 * refines it once page data is known and re-applies when the data or the query string changes
 * (filters, pagination), so the canonical URL and robots directive stay correct.
 */
export function useSeo(meta: MaybeRefOrGetter<SeoMeta>) {
  const route = useRoute()
  const apply = () => applySeo(toValue(meta))
  onMounted(apply)
  watch([() => toValue(meta), () => route.fullPath], apply, { deep: true, flush: 'post' })
}
