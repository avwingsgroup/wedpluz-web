<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pause, Pin, Play, Star, Calendar } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import type { Message } from '@/types'
import { formatDate, formatMoney, formatRelative } from '@/utils/format'
import { cn } from '@/utils/cn'

const props = defineProps<{ message: Message; showSender: boolean }>()
const emit = defineEmits<{ contextmenu: [e: MouseEvent, m: Message]; react: [emoji: string]; reply: [] }>()

const audio = ref<HTMLAudioElement | null>(null)
const playing = ref(false)
const progress = ref(0)
const deleted = computed(() => props.message.deletedBy !== 'none')
const att = computed(() => props.message.attachments)

function togglePlay() {
  if (!audio.value) return
  if (playing.value) audio.value.pause()
  else void audio.value.play()
}
function fmt(s: number | null) {
  const v = Math.round(s ?? 0)
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}
</script>

<template>
  <div :class="cn('group flex gap-2', message.isMine ? 'flex-row-reverse' : '')" @contextmenu.prevent="emit('contextmenu', $event, message)">
    <UiAvatar :src="message.sender.avatarUrl" :name="message.sender.displayName" size="sm" :class="!showSender && 'invisible'" />
    <div :class="cn('relative max-w-[78%] rounded-2xl px-3 py-2 sm:max-w-[65%]', message.isMine ? 'bg-ink-100' : 'bg-white shadow-sm', message.status === 'failed' && 'ring-1 ring-danger-500')">
      <p v-if="showSender" class="mb-1 text-xs font-medium text-brand-600">{{ message.sender.displayName }}</p>

      <p v-if="deleted" class="text-sm italic text-ink-500">{{ message.deletedBy === 'admin' ? 'Deleted by Admin' : 'This message was deleted' }}</p>
      <template v-else>
        <div v-if="message.replyTo" class="mb-2 rounded-lg border-l-4 border-brand-600 bg-ink-50 px-2 py-1.5 text-xs">
          <p class="font-medium text-brand-600">{{ message.replyTo.sender.displayName }}</p>
          <p class="line-clamp-2 text-ink-600">{{ message.replyTo.body ?? (message.replyTo.type === 'audio' ? '🎤 Audio' : message.replyTo.type === 'image' ? '📷 Photo' : 'Attachment') }}</p>
        </div>

        <!-- audio -->
        <div v-if="message.type === 'audio' && att[0]" class="flex min-w-[220px] items-center gap-2 rounded-full bg-brand-600 py-1.5 pl-1.5 pr-4 text-white">
          <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-600" :aria-label="playing ? 'Pause' : 'Play'" @click="togglePlay"><Pause v-if="playing" class="h-4 w-4" /><Play v-else class="h-4 w-4" /></button>
          <span class="text-xs tabular-nums">{{ fmt(att[0].durationSeconds) }}</span>
          <div class="flex h-6 flex-1 items-center gap-[2px]" aria-hidden="true"><span v-for="(w, i) in att[0].waveform ?? []" :key="i" class="w-[2px] rounded-full" :class="i / (att[0].waveform?.length ?? 1) < progress ? 'bg-white' : 'bg-white/50'" :style="{ height: `${w}%` }" /></div>
          <audio ref="audio" :src="att[0].url" preload="none" @play="playing = true" @pause="playing = false" @ended="playing = false; progress = 0" @timeupdate="progress = audio ? audio.currentTime / (audio.duration || 1) : 0" />
        </div>

        <!-- images -->
        <div v-else-if="att.length && att[0]?.type === 'image'" :class="cn('mb-1 grid gap-1', att.length > 1 ? 'grid-cols-2' : 'grid-cols-1')">
          <a v-for="a in att" :key="a.id" :href="a.url" target="_blank" rel="noopener noreferrer" class="block overflow-hidden rounded-lg"><img :src="a.thumbnailUrl ?? a.url" alt="Shared image" loading="lazy" class="h-28 w-full object-cover sm:h-32" /></a>
        </div>

        <!-- event share -->
        <RouterLink v-if="message.type === 'event_promo' && message.event" :to="`/events/${message.event.slug}`" class="block w-64 overflow-hidden rounded-xl border border-ink-100 bg-white">
          <img :src="message.event.coverUrl" alt="" class="h-32 w-full object-cover" loading="lazy" />
          <div class="p-3"><p class="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Promoted event</p><p class="font-medium">{{ message.event.title }}</p><p class="mt-1 flex items-center gap-1 text-xs text-ink-500"><Calendar class="h-3 w-3" />{{ formatDate(message.event.startsAt) }} · {{ message.event.isFree ? 'Free' : formatMoney(message.event.minPrice, message.event.currency) }}</p></div>
        </RouterLink>

        <p v-if="message.body" class="whitespace-pre-wrap break-words text-[15px] text-ink-900">{{ message.body }}</p>
      </template>

      <div class="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-ink-400">
        <Star v-if="message.isStarred" class="h-3 w-3 fill-ink-400" /><Pin v-if="message.isPinned" class="h-3 w-3" />
        <span>{{ message.status === 'sending' ? 'Sending…' : message.status === 'failed' ? 'Failed · tap to retry' : formatRelative(message.createdAt) }}</span>
      </div>
      <div v-if="message.reactions.length" :class="cn('absolute -bottom-3 flex gap-1', message.isMine ? 'right-2' : 'left-2')">
        <button v-for="r in message.reactions" :key="r.emoji" type="button" :class="cn('rounded-full border bg-white px-1.5 text-xs shadow-sm', r.reactedByMe ? 'border-brand-300' : 'border-ink-100')" @click="emit('react', r.emoji)">{{ r.emoji }}<span v-if="r.count > 1" class="ml-0.5 text-ink-500">{{ r.count }}</span></button>
      </div>
    </div>
  </div>
</template>
