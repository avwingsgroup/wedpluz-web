<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, Flag, Heart, Share2 } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import ReportDialog from '@/modules/community/ReportDialog.vue'
import { vendorsApi } from '@/services/api/vendors.api'
import { useAsync } from '@/composables/useAsync'
import { useShare } from '@/composables/useClipboardShare'
import { useAuthStore } from '@/stores/auth.store'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { share } = useShare()
const id = computed(() => String(route.params.id))
const { data: work, loading, error, refresh } = useAsync(() => vendorsApi.work(id.value), { watch: id })
const index = ref(0)
const reportOpen = ref(false)
const current = computed(() => work.value?.media[index.value])

async function like() {
  if (!work.value) return
  if (!auth.isAuthenticated) return router.push({ name: 'auth.login', query: { redirect: route.fullPath } })
  const res = await vendorsApi.likeWork(work.value.id)
  work.value.isLiked = res.liked
  work.value.likesCount = res.likesCount
}
</script>

<template>
  <div class="container-app py-8">
    <UiBackButton />
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading || !work" page />
    <div v-else class="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div class="relative overflow-hidden rounded-2xl bg-ink-900">
        <video v-if="current?.type === 'video'" :src="current.url" controls class="aspect-square w-full object-contain" />
        <img v-else :src="current?.url" :alt="work.title" class="aspect-square w-full object-contain" />
        <template v-if="work.media.length > 1">
          <button type="button" class="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 disabled:opacity-40" :disabled="index === 0" aria-label="Previous" @click="index--"><ChevronLeft class="h-5 w-5" /></button>
          <button type="button" class="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 disabled:opacity-40" :disabled="index === work.media.length - 1" aria-label="Next" @click="index++"><ChevronRight class="h-5 w-5" /></button>
          <span class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">{{ index + 1 }} of {{ work.media.length }}</span>
        </template>
      </div>
      <aside class="space-y-5">
        <RouterLink :to="{ name: 'vendor', params: { slug: work.vendor.slug } }" class="flex items-center gap-3"><UiAvatar :src="work.vendor.avatarUrl" :name="work.vendor.businessName" /><div><p class="font-semibold">{{ work.vendor.businessName }}</p><p class="text-sm text-ink-500">{{ work.vendor.category.name }}</p></div></RouterLink>
        <div><h1 class="text-2xl">{{ work.title }}</h1><p class="mt-1 text-sm text-ink-500">{{ formatDate(work.createdAt) }}</p><p class="mt-3 text-ink-700">{{ work.description }}</p></div>
        <div class="flex gap-2">
          <UiButton variant="outline" @click="like"><Heart :class="cn('h-4 w-4', work.isLiked && 'fill-pink-500 text-pink-500')" />{{ work.likesCount }}</UiButton>
          <UiButton variant="outline" @click="share(`/works/${work.id}`, work.title)"><Share2 class="h-4 w-4" />Share</UiButton>
          <UiButton v-if="auth.isAuthenticated" variant="ghost" @click="reportOpen = true"><Flag class="h-4 w-4" />Report</UiButton>
        </div>
        <div v-if="work.media.length > 1" class="grid grid-cols-5 gap-2">
          <button v-for="(m, i) in work.media" :key="m.id" type="button" :class="cn('aspect-square overflow-hidden rounded-lg ring-2', i === index ? 'ring-brand-600' : 'ring-transparent')" @click="index = i"><img :src="m.thumbnailUrl ?? m.url" alt="" class="h-full w-full object-cover" /></button>
        </div>
      </aside>
    </div>
    <ReportDialog v-if="work" v-model:open="reportOpen" target-type="work" :target-id="work.id" />
  </div>
</template>
