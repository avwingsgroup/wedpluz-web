<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import UiRating from '@/components/ui/UiRating.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { vendorsApi, type ReviewsResponse } from '@/services/api/vendors.api'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { reviewSchema } from '@/validations'
import { formatDate } from '@/utils/format'
import type { VendorReview } from '@/types'

const props = defineProps<{ vendorId: string; isMine: boolean }>()
const auth = useAuthStore()
const ui = useUiStore()
const data = ref<ReviewsResponse | null>(null)
const loading = ref(true)
const editorOpen = ref(false)
const editing = ref<VendorReview | null>(null)

async function load() {
  loading.value = true
  try {
    data.value = await vendorsApi.reviews(props.vendorId)
  } finally {
    loading.value = false
  }
}
onMounted(load)
const mine = computed(() => data.value?.items.find((r) => r.isMine) ?? null)
const maxCount = computed(() => Math.max(1, ...(data.value?.summary.distribution.map((d) => d.count) ?? [1])))

const form = useForm({
  initialValues: { rating: 0, comment: '' },
  schema: reviewSchema,
  onSubmit: (v) => (editing.value ? vendorsApi.updateReview(props.vendorId, editing.value.id, v) : vendorsApi.addReview(props.vendorId, v)),
  onSuccess: () => {
    ui.success(editing.value ? 'Review updated' : 'Thanks for your review!')
    editorOpen.value = false
    void load()
  },
})
function openEditor(r: VendorReview | null) {
  editing.value = r
  form.reset(r ? { rating: r.rating, comment: r.comment } : { rating: 0, comment: '' })
  editorOpen.value = true
}
async function remove(r: VendorReview) {
  if (!(await ui.confirm({ title: 'Delete your review?', variant: 'danger', confirmLabel: 'Delete' }))) return
  await vendorsApi.deleteReview(props.vendorId, r.id)
  ui.success('Review deleted')
  void load()
}
</script>

<template>
  <div>
    <div v-if="loading" class="space-y-3"><UiSkeleton class="h-32 rounded-2xl" /><UiSkeleton v-for="i in 3" :key="i" variant="row" /></div>
    <template v-else-if="data">
      <div class="card grid gap-6 p-5 md:grid-cols-[200px_1fr]">
        <div class="text-center md:border-r md:border-ink-100">
          <p class="text-5xl font-bold">{{ data.summary.average ? data.summary.average.toFixed(1) : '–' }}</p>
          <UiRating :model-value="data.summary.average" class="mt-2 justify-center" />
          <p class="mt-1 text-sm text-ink-500">{{ data.summary.total }} ratings</p>
        </div>
        <div class="space-y-2">
          <div v-for="d in data.summary.distribution" :key="d.stars" class="flex items-center gap-3 text-sm"><span class="w-4">{{ d.stars }}</span><div class="h-2 flex-1 overflow-hidden rounded-full bg-ink-100"><div class="h-full rounded-full bg-warning-500" :style="{ width: `${(d.count / maxCount) * 100}%` }" /></div><span class="w-8 text-right text-ink-500">{{ d.count }}</span></div>
        </div>
      </div>
      <div v-if="!isMine && auth.isAuthenticated && !mine" class="mt-4"><UiButton variant="soft" @click="openEditor(null)">Write a review</UiButton></div>
      <UiEmptyState v-if="!data.items.length" title="No reviews yet" description="Be the first to share your experience with this vendor." compact illustration="chat" />
      <ul class="mt-4 divide-y divide-ink-100">
        <li v-for="r in data.items" :key="r.id" class="flex gap-3 py-4">
          <UiAvatar :src="r.author.avatarUrl" :name="r.author.displayName" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2"><p class="font-medium">{{ r.author.displayName }}</p><UiRating :model-value="r.rating" editable size="sm" class="pointer-events-none" /><span class="text-xs text-ink-400">{{ formatDate(r.updatedAt ?? r.createdAt) }}<template v-if="r.updatedAt"> · edited</template></span></div>
            <p class="mt-1 text-sm text-ink-700">{{ r.comment }}</p>
          </div>
          <div v-if="r.isMine" class="flex gap-1">
            <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink-100" aria-label="Edit review" @click="openEditor(r)"><Pencil class="h-4 w-4" /></button>
            <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full text-danger-500 hover:bg-danger-50" aria-label="Delete review" @click="remove(r)"><Trash2 class="h-4 w-4" /></button>
          </div>
        </li>
      </ul>
    </template>
    <UiModal v-model:open="editorOpen" :title="editing ? 'Edit your review' : 'Rate this vendor'">
      <form class="space-y-4" @submit.prevent="form.submit()">
        <div class="text-center"><UiRating v-model="form.values.rating" editable size="lg" class="justify-center" /><p v-if="form.fieldError('rating')" class="mt-1 text-xs text-danger-500">{{ form.fieldError('rating') }}</p></div>
        <UiTextarea v-model="form.values.comment" label="Your review" placeholder="What was it like working with this vendor?" :maxlength="1000" :error="form.fieldError('comment')" />
        <UiButton type="submit" block size="lg" :loading="form.submitting.value">{{ editing ? 'Save changes' : 'Submit review' }}</UiButton>
      </form>
    </UiModal>
  </div>
</template>
