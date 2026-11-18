<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Heart, Trash2, X, Eye } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import { communityApi } from '@/services/api/community.api'
import { useAuthStore } from '@/stores/auth.store'
import { formatRelative } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { StatusPost } from '@/types'

const props = defineProps<{ statuses: StatusPost[]; startIndex: number | null }>()
const emit = defineEmits<{ close: []; deleted: [id: string] }>()
const auth = useAuthStore()
const index = ref(0)
const progress = ref(0)
let timer: number | null = null
const current = computed(() => (props.startIndex === null ? null : props.statuses[index.value]))

function start() {
  stop()
  progress.value = 0
  timer = window.setInterval(() => {
    progress.value += 2
    if (progress.value >= 100) next()
  }, 100)
}
function stop() {
  if (timer) window.clearInterval(timer)
  timer = null
}
function next() {
  if (index.value < props.statuses.length - 1) index.value++
  else emit('close')
}
function prev() {
  if (index.value > 0) index.value--
}
watch(() => props.startIndex, (i) => {
  if (i === null) return stop()
  index.value = i
})
watch(current, (s) => {
  if (!s) return
  start()
  if (!s.viewedByMe) void communityApi.viewStatus(s.id).then(() => (s.viewedByMe = true)).catch(() => undefined)
})
async function like() {
  if (!current.value) return
  const r = await communityApi.likeStatus(current.value.id)
  current.value.isLiked = r.liked
  current.value.likesCount = r.likesCount
}
async function remove() {
  if (!current.value) return
  const id = current.value.id
  await communityApi.deleteStatus(id)
  emit('deleted', id)
  emit('close')
}
onBeforeUnmount(stop)
</script>

<template>
  <Teleport to="body">
    <div v-if="current" class="fixed inset-0 z-[90] flex items-center justify-center bg-black/90" role="dialog" aria-modal="true" aria-label="Status">
      <div class="relative h-full max-h-[860px] w-full max-w-[480px] overflow-hidden bg-black sm:rounded-3xl" @mousedown="stop" @mouseup="start" @touchstart="stop" @touchend="start">
        <img :src="current.mediaUrl" alt="" class="h-full w-full object-cover" />
        <div class="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 p-4">
          <div class="flex gap-1"><span v-for="(s, i) in statuses" :key="s.id" class="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"><span class="block h-full bg-white" :style="{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }" /></span></div>
          <div class="mt-3 flex items-center gap-2 text-white"><UiAvatar :src="current.author.avatarUrl" :name="current.author.displayName" size="sm" /><span class="font-medium">{{ current.author.displayName }}</span><span class="text-xs text-white/70">{{ formatRelative(current.createdAt) }}</span><button type="button" class="ml-auto" aria-label="Close" @click="emit('close')"><X class="h-6 w-6" /></button></div>
        </div>
        <p v-if="current.caption" class="absolute inset-x-0 bottom-20 px-6 text-center text-white drop-shadow">{{ current.caption }}</p>
        <div class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 p-4 text-white">
          <span v-if="current.author.id === auth.user?.id" class="flex items-center gap-1 text-sm"><Eye class="h-4 w-4" />{{ current.viewsCount }} views · {{ current.likesCount }} likes</span>
          <span v-else />
          <div class="flex gap-3">
            <button v-if="current.author.id === auth.user?.id" type="button" aria-label="Delete status" @click="remove"><Trash2 class="h-6 w-6" /></button>
            <button v-else type="button" :aria-pressed="current.isLiked" aria-label="Like status" @click="like"><Heart :class="cn('h-7 w-7', current.isLiked && 'fill-pink-500 text-pink-500')" /></button>
          </div>
        </div>
        <button type="button" class="absolute inset-y-0 left-0 w-1/3" aria-label="Previous status" @click="prev"><ChevronLeft class="ml-2 h-6 w-6 text-white/0 hover:text-white/80" /></button>
        <button type="button" class="absolute inset-y-0 right-0 w-1/3" aria-label="Next status" @click="next"><ChevronRight class="ml-auto mr-2 h-6 w-6 text-white/0 hover:text-white/80" /></button>
      </div>
    </div>
  </Teleport>
</template>
