<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Heart, Images, Mail, MapPin, Phone, Plus, Share2, Video, Globe, Trash2 } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import ReviewsPanel from './ReviewsPanel.vue'
import { vendorsApi } from '@/services/api/vendors.api'
import { useInfiniteList } from '@/composables/useInfiniteList'
import { useShare } from '@/composables/useClipboardShare'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Vendor } from '@/types'

/** Shared by the public vendor profile and the owner's "My business" page. */
const props = defineProps<{ vendor: Vendor; owner?: boolean }>()
// Promos removed in this view are hidden locally instead of mutating the parent's prop.
const removedPromoIds = ref<Set<string>>(new Set())
const promos = computed(() => props.vendor.promos.filter((p) => !removedPromoIds.value.has(p.id)))
const emit = defineEmits<{ edit: []; addPromo: [] }>()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const { share } = useShare()
const tab = ref<'works' | 'about' | 'reviews' | 'promos'>('works')
const saved = ref(props.vendor.isSaved)
const contacting = ref(false)
const works = useInfiniteList((page) => vendorsApi.works(props.vendor.id, page))

async function toggleSave() {
  if (!auth.isAuthenticated) return router.push({ name: 'auth.login', query: { redirect: `/vendors/${props.vendor.slug}` } })
  saved.value = !saved.value
  try {
    if (saved.value) await vendorsApi.save(props.vendor.id)
    else await vendorsApi.unsave(props.vendor.id)
  } catch {
    saved.value = !saved.value
  }
}
async function contact() {
  if (!auth.isAuthenticated) return router.push({ name: 'auth.login', query: { redirect: `/vendors/${props.vendor.slug}` } })
  contacting.value = true
  try {
    const { conversationId } = await vendorsApi.contact(props.vendor.id)
    router.push({ name: 'messages', params: { id: conversationId } })
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    contacting.value = false
  }
}
async function deletePromo(id: string) {
  if (!(await ui.confirm({ title: 'Delete this promo?', variant: 'danger', confirmLabel: 'Delete' }))) return
  await vendorsApi.deletePromo(id)
  removedPromoIds.value = new Set([...removedPromoIds.value, id])
}
</script>

<template>
  <div>
    <div class="relative h-56 overflow-hidden bg-brand-600 md:h-72">
      <img v-if="vendor.coverUrl" :src="vendor.coverUrl" alt="" class="h-full w-full object-cover grayscale-[30%]" />
      <div v-else class="brand-pattern h-full w-full" />
      <div class="absolute inset-0 bg-black/20" />
      <h1 class="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-3xl font-bold text-white drop-shadow md:text-4xl">{{ vendor.businessName }}</h1>
    </div>
    <div class="relative -mt-12 flex flex-col items-center border-b border-ink-200 pb-8 text-center">
      <UiAvatar :src="vendor.avatarUrl" :name="vendor.businessName" size="2xl" class="ring-4 ring-white rounded-full" />
      <h2 class="mt-3 text-2xl font-semibold">{{ vendor.businessName }}</h2>
      <p class="text-ink-500">{{ vendor.category.name }}</p>
      <p class="mt-2 text-sm text-ink-500">{{ vendor.rating > 0 ? vendor.rating.toFixed(1) : 'No ratings yet' }} ⭐ · {{ vendor.likesCount.toLocaleString() }} Likes</p>
      <div class="mt-4 flex items-center gap-2">
        <template v-if="owner">
          <UiButton @click="emit('edit')">Edit Profile</UiButton>
        </template>
        <template v-else>
          <UiButton :loading="contacting" @click="contact">Get in Touch</UiButton>
          <button type="button" :class="cn('flex h-10 w-10 items-center justify-center rounded-full border border-ink-200', saved && 'text-pink-500')" :aria-label="saved ? 'Unsave' : 'Save vendor'" @click="toggleSave"><Heart :class="cn('h-5 w-5', saved && 'fill-current')" /></button>
        </template>
        <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200" aria-label="Share profile" @click="share(`/vendors/${vendor.slug}`, vendor.businessName)"><Share2 class="h-5 w-5" /></button>
      </div>
    </div>

    <div class="container-app py-8">
      <div class="flex items-center justify-between gap-4">
        <UiTabs v-model="tab" variant="segment" :tabs="[{ key: 'works', label: 'Works' }, { key: 'about', label: 'About' }, { key: 'reviews', label: 'Reviews' }, { key: 'promos', label: 'Promos' }]" class="!bg-transparent" />
        <UiButton v-if="owner && tab === 'works'" icon-only size="lg" aria-label="Add work" :to="{ name: 'business.work.new' }"><Plus class="h-5 w-5" /></UiButton>
        <UiButton v-if="owner && tab === 'promos'" icon-only size="lg" aria-label="Add promo" @click="emit('addPromo')"><Plus class="h-5 w-5" /></UiButton>
      </div>

      <div class="mt-6">
        <div v-if="tab === 'works'">
          <div v-if="works.loading.value" class="grid grid-cols-2 gap-4 md:grid-cols-4"><UiSkeleton v-for="i in 8" :key="i" class="aspect-[1.1] rounded-xl" /></div>
          <UiEmptyState v-else-if="works.isEmpty.value" :title="owner ? 'Add Your works' : 'No works yet'" :description="owner ? 'Publish your first work' : 'This vendor hasn’t published any work yet.'" illustration="generic">
            <UiButton v-if="owner" :to="{ name: 'business.work.new' }">Add work</UiButton>
          </UiEmptyState>
          <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-4">
            <RouterLink v-for="w in works.items.value" :key="w.id" :to="owner ? { name: 'business.work.edit', params: { id: w.id } } : { name: 'work', params: { id: w.id } }" class="group relative aspect-[1.1] overflow-hidden rounded-xl bg-ink-100">
              <img :src="w.media[0]?.thumbnailUrl ?? w.media[0]?.url" :alt="w.title" loading="lazy" class="h-full w-full object-cover transition-transform group-hover:scale-105" />
              <span class="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[11px] text-white"><Video v-if="w.media[0]?.type === 'video'" class="h-3 w-3" /><Images v-else class="h-3 w-3" />{{ w.media.length > 1 ? w.media.length : '' }}</span>
            </RouterLink>
          </div>
          <div v-if="works.hasMore.value" class="mt-6 text-center"><UiButton variant="secondary" :loading="works.loadingMore.value" @click="works.loadMore()">Load more</UiButton></div>
        </div>

        <div v-else-if="tab === 'about'" class="grid gap-6 md:grid-cols-[1fr_320px]">
          <div><h3 class="font-semibold">About {{ vendor.businessName }}</h3><p class="mt-2 whitespace-pre-line text-ink-700">{{ vendor.description }}</p><p class="mt-4 text-sm text-ink-500">On Wedpluz since {{ formatDate(vendor.joinedAt) }}</p></div>
          <div class="card space-y-3 p-5 text-sm">
            <p class="flex items-center gap-2"><MapPin class="h-4 w-4 text-ink-500" />{{ vendor.location }}</p>
            <p v-if="vendor.contactEmail" class="flex items-center gap-2"><Mail class="h-4 w-4 text-ink-500" />{{ vendor.contactEmail }}</p>
            <p v-if="vendor.contactPhone" class="flex items-center gap-2"><Phone class="h-4 w-4 text-ink-500" />{{ vendor.contactPhone }}</p>
            <a v-if="vendor.website" :href="vendor.website" target="_blank" rel="noopener noreferrer nofollow" class="flex items-center gap-2 text-brand-600 hover:underline"><Globe class="h-4 w-4" />{{ vendor.website }}</a>
            <p class="flex items-center gap-2 capitalize"><span :class="cn('h-2 w-2 rounded-full', vendor.availability === 'available' ? 'bg-success-500' : 'bg-warning-500')" />{{ vendor.availability }}</p>
          </div>
        </div>

        <ReviewsPanel v-else-if="tab === 'reviews'" :vendor-id="vendor.id" :is-mine="!!owner" />

        <div v-else>
          <UiEmptyState v-if="!promos.length" title="No promos" :description="owner ? 'Run a limited-time offer to attract more clients.' : 'This vendor has no active promos.'" compact />
          <div v-else class="grid gap-4 md:grid-cols-2">
            <div v-for="p in promos" :key="p.id" class="card overflow-hidden">
              <img v-if="p.coverUrl" :src="p.coverUrl" alt="" class="h-36 w-full object-cover" loading="lazy" />
              <div class="p-4">
                <div class="flex items-start justify-between gap-2"><h3 class="font-semibold">{{ p.title }}</h3><span v-if="p.discountPercent" class="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-600">-{{ p.discountPercent }}%</span></div>
                <p class="mt-1 text-sm text-ink-500">{{ p.description }}</p>
                <div class="mt-3 flex items-center justify-between text-xs text-ink-500"><span v-if="p.validUntil">Valid until {{ formatDate(p.validUntil) }}</span><button v-if="owner" type="button" class="inline-flex items-center gap-1 text-danger-500 hover:underline" @click="deletePromo(p.id)"><Trash2 class="h-3.5 w-3.5" />Delete</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
