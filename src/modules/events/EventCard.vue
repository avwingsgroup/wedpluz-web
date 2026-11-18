<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, Heart, MapPin, Share2, Ticket, Users } from 'lucide-vue-next'
import type { EventSummary, ManageEventSummary } from '@/types'
import { formatDateRange, formatMoney, formatPriceLabel } from '@/utils/format'
import { eventsApi } from '@/services/api/events.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { useShare } from '@/composables/useClipboardShare'
import { cn } from '@/utils/cn'
import UiBadge from '@/components/ui/UiBadge.vue'

const props = withDefaults(defineProps<{ event: EventSummary | ManageEventSummary; variant?: 'grid' | 'compact' | 'promote' | 'manage' | 'earn'; to?: string }>(), { variant: 'grid' })
const emit = defineEmits<{ saved: [saved: boolean] }>()

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const { share } = useShare()
const saved = ref(props.event.isSaved)
const saving = ref(false)

const link = computed(() => props.to ?? (props.variant === 'manage' ? `/manage/events/${props.event.id}` : `/events/${props.event.slug}`))
const modeLabel = computed(() => ({ physical: 'Physical', online: 'Online', hybrid: 'Hybrid' })[props.event.attendanceMode])
const dateLabel = computed(() => formatDateRange(props.event.startsAt, props.event.endsAt))
const priceLabel = computed(() => formatPriceLabel(props.event.minPrice, props.event.currency, !props.event.isFree && (props.event as EventSummary).ticketsSold !== undefined))

async function toggleSave(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  if (!auth.isAuthenticated) {
    router.push({ name: 'auth.login', query: { redirect: link.value } })
    return
  }
  if (saving.value) return
  saving.value = true
  const next = !saved.value
  saved.value = next
  try {
    if (next) await eventsApi.save(props.event.id)
    else await eventsApi.unsave(props.event.id)
    emit('saved', next)
  } catch {
    saved.value = !next
    ui.error('Could not update saved events')
  } finally {
    saving.value = false
  }
}
function onShare(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  void share(`/events/${props.event.slug}`, props.event.title)
}
</script>

<template>
  <!-- Compact: homepage (guest) layout -->
  <RouterLink v-if="variant === 'compact'" :to="link" class="group block">
    <div class="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-100">
      <img :src="event.coverUrl" :alt="event.title" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <span class="chip absolute left-3 top-3 border-0 bg-white/90">{{ modeLabel }}</span>
    </div>
    <span class="chip mt-3">{{ event.category.name }}</span>
    <h3 class="mt-2 line-clamp-2 text-[15px] font-semibold text-ink-900 group-hover:text-brand-600">{{ event.title }}</h3>
    <p class="mt-1 text-sm text-ink-500">{{ dateLabel }}</p>
  </RouterLink>

  <!-- Promote: "Promote Events" cards with commission -->
  <RouterLink v-else-if="variant === 'promote'" :to="link" class="card card-hover group block overflow-hidden">
    <div class="relative aspect-[3/2] overflow-hidden bg-ink-100">
      <img :src="event.coverUrl" :alt="event.title" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <span class="chip absolute left-3 top-3 border-0 bg-white/90"><MapPin class="h-3 w-3" />{{ event.city }}</span>
    </div>
    <div class="p-4">
      <h3 class="line-clamp-1 font-semibold text-ink-900">{{ event.title }}</h3>
      <p class="mt-1 flex items-center gap-1.5 text-sm text-ink-500"><Calendar class="h-3.5 w-3.5" />{{ dateLabel }}</p>
      <div class="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
        <span class="flex items-center gap-1.5 text-ink-500"><Users class="h-4 w-4" />{{ event.promotion?.promotersCount ?? 0 }} promoting</span>
        <span class="text-right text-xs text-ink-500">Commission<br /><span class="text-base font-semibold text-brand-600">{{ event.promotion?.commissionPercent ?? 0 }}%</span></span>
      </div>
    </div>
  </RouterLink>

  <!-- Manage: organizer "My Events" cards -->
  <RouterLink v-else-if="variant === 'manage'" :to="link" class="card card-hover group block overflow-hidden bg-ink-50/40">
    <div class="relative aspect-[3/1.1] overflow-hidden bg-ink-100">
      <img :src="event.coverUrl" :alt="event.title" loading="lazy" class="h-full w-full object-cover" />
      <UiBadge :status="event.status" class="absolute left-3 top-3 shadow-sm" />
    </div>
    <div class="p-4">
      <h3 class="line-clamp-2 font-semibold text-ink-900">{{ event.title }}</h3>
      <p class="mt-2 flex items-center gap-1.5 text-sm text-ink-500"><Calendar class="h-3.5 w-3.5" />{{ dateLabel }}</p>
      <p class="mt-1 flex items-center gap-1.5 text-sm text-ink-500"><Ticket class="h-3.5 w-3.5" />{{ priceLabel }}<template v-if="event.ticketsSold"> - {{ event.ticketsSold }} Tickets Sold</template></p>
    </div>
  </RouterLink>

  <!-- Earn: promoting list -->
  <RouterLink v-else-if="variant === 'earn'" :to="link" class="card card-hover group block overflow-hidden">
    <div class="aspect-[4/3] overflow-hidden bg-ink-100"><img :src="event.coverUrl" :alt="event.title" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /></div>
    <div class="p-4">
      <h3 class="line-clamp-1 font-semibold text-ink-900">{{ event.title }}</h3>
      <p class="mt-1 text-sm text-ink-500">{{ dateLabel }}</p>
      <p class="mt-1 text-sm font-medium text-ink-900">{{ priceLabel }}</p>
    </div>
  </RouterLink>

  <!-- Grid (default): logged-in home / events list -->
  <RouterLink v-else :to="link" class="card card-hover group block overflow-hidden">
    <div class="relative aspect-[4/3] overflow-hidden bg-ink-100">
      <img :src="event.coverUrl" :alt="event.title" loading="lazy" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <span class="chip absolute left-3 top-3 border-0 bg-white/90">{{ event.category.name }}</span>
      <UiBadge v-if="event.isPromoted" tone="brand" size="sm" class="absolute right-3 top-3 shadow-sm">✦ Promoted</UiBadge>
    </div>
    <div class="p-4">
      <div class="flex items-center justify-between gap-2">
        <span class="chip"><MapPin class="h-3 w-3" />{{ event.city ?? modeLabel }}</span>
        <div class="flex items-center gap-1">
          <button type="button" :class="cn('flex h-9 w-9 items-center justify-center rounded-full text-ink-700 transition hover:bg-ink-100', saved && 'text-pink-500')" :aria-pressed="saved" :aria-label="saved ? 'Remove from saved' : 'Save event'" @click="toggleSave">
            <Heart :class="cn('h-5 w-5', saved && 'fill-current')" />
          </button>
          <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full text-ink-700 transition hover:bg-ink-100" aria-label="Share event" @click="onShare"><Share2 class="h-5 w-5" /></button>
        </div>
      </div>
      <h3 class="mt-2 line-clamp-2 text-[15px] font-semibold text-ink-900 group-hover:text-brand-600">{{ event.title }}</h3>
      <p class="mt-1 text-sm text-ink-500">{{ dateLabel }}</p>
      <p class="mt-1 text-sm font-medium text-ink-900">{{ event.isFree ? 'Free' : formatMoney(event.minPrice, event.currency) }}</p>
    </div>
  </RouterLink>
</template>
