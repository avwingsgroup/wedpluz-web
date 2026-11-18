import { onMounted, watch, type MaybeRefOrGetter, toValue } from 'vue'
import { applySeo, type SeoMeta } from '@/utils/seo'

export function useSeo(meta: MaybeRefOrGetter<SeoMeta>) {
  const apply = () => applySeo(toValue(meta))
  onMounted(apply)
  watch(() => toValue(meta), apply, { deep: true })
}
