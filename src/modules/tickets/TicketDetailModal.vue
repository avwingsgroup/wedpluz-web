<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, MapPin, Share2, ShoppingCart, UserRound, Video } from 'lucide-vue-next'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import TicketQr from './TicketQr.vue'
import CancelTicketFlow from './CancelTicketFlow.vue'
import { ticketingApi, type TicketDetail } from '@/services/api/ticketing.api'
import { useUiStore } from '@/stores/ui.store'
import { useShare } from '@/composables/useClipboardShare'
import { formatDate, formatDateRange, formatMoney, formatTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Ticket } from '@/types'

const props = defineProps<{ ticketId: string | null }>()
const emit = defineEmits<{ close: []; updated: [ticket: Ticket] }>()
const ui = useUiStore()
const { share } = useShare()

const detail = ref<TicketDetail | null>(null)
const loading = ref(false)
const index = ref(0)
const sections = ref<Record<string, boolean>>({ guests: true, menu: true, order: false, location: true, sub: false })
const cancelOpen = ref(false)

watch(
  () => props.ticketId,
  async (id) => {
    detail.value = null
    index.value = 0
    if (!id) return
    loading.value = true
    try {
      detail.value = await ticketingApi.ticket(id)
    } catch (e) {
      ui.error((e as Error).message)
      emit('close')
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
const tickets = computed(() => detail.value?.siblings ?? [])
const current = computed(() => tickets.value[index.value] ?? detail.value)
const checkedIn = computed(() => tickets.value.filter((t) => t.status === 'checked_in').length)
const schedule = computed(() => current.value)
const isCancellable = computed(() => !!current.value && current.value.status === 'valid' && new Date(current.value.event.startsAt) > new Date())

function toggle(k: string) {
  sections.value[k] = !sections.value[k]
}
async function download() {
  if (!current.value) return
  try {
    const { url, filename } = await ticketingApi.download(current.value.id)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  } catch (e) {
    ui.error((e as Error).message)
  }
}
function addToCalendar() {
  if (!current.value) return
  const e = current.value.event
  const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, '')
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedpluz//EN', 'BEGIN:VEVENT', `UID:${current.value.id}@wedpluz.com`, `DTSTART:${fmt(e.startsAt)}`, `DTEND:${fmt(e.endsAt ?? e.startsAt)}`, `SUMMARY:${e.title}`, `URL:${location.origin}/events/${e.slug}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a')
  a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
  a.download = `${e.slug}.ics`
  a.click()
}
function onCancelled(t: Ticket) {
  cancelOpen.value = false
  if (detail.value) {
    detail.value = { ...detail.value, ...t, siblings: detail.value.siblings.map((s) => ({ ...s, status: 'cancelled', refund: t.refund })) }
  }
  emit('updated', t)
}
</script>

<template>
  <UiModal :open="!!ticketId" size="xl" @update:open="emit('close')">
    <template #header><h2 class="text-2xl font-bold">Ticket Details</h2></template>
    <template #actions>
      <UiButton v-if="current" variant="outline" size="sm" icon-only aria-label="Open event" :to="`/events/${current.event.slug}`"><ExternalLink class="h-4 w-4" /></UiButton>
      <UiButton v-if="current" variant="outline" size="sm" icon-only aria-label="Share" @click="share(`/events/${current.event.slug}`, current.event.title)"><Share2 class="h-4 w-4" /></UiButton>
    </template>

    <UiSpinner v-if="loading || !current" page />
    <div v-else class="space-y-4">
      <div class="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <img :src="current.event.coverUrl" alt="" class="h-16 w-16 rounded-lg object-cover" />
        <div class="min-w-0 flex-1"><p class="truncate font-semibold">{{ current.event.title }}</p><p class="text-sm text-ink-500">{{ formatDateRange(current.event.startsAt, current.event.endsAt) }}</p></div>
        <UiButton variant="outline" size="sm" @click="addToCalendar"><CalendarPlus class="h-4 w-4" /> Add to Calendar</UiButton>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <!-- left: QR -->
        <div class="space-y-3">
          <div v-if="tickets.length > 1" class="card flex items-center justify-between p-4"><div><p class="font-semibold">{{ tickets.length }} Tickets</p><p class="text-sm text-ink-500">{{ checkedIn }} of {{ tickets.length }} Checked in</p></div></div>
          <div class="card overflow-hidden">
            <div class="bg-brand-600 px-4 py-2.5 text-sm font-medium text-white">{{ current.orderTotal === 0 ? 'Free Event' : current.ticketTypeName }}</div>
            <div class="relative flex flex-col items-center px-4 py-5 text-center">
              <p v-if="tickets.length > 1" class="text-sm text-ink-500">Ticket {{ index + 1 }} of {{ tickets.length }}</p>
              <div v-if="tickets.length > 1" class="mt-1 flex gap-1"><span v-for="(t, i) in tickets" :key="t.id" :class="cn('h-1.5 w-1.5 rounded-full', i === index ? 'bg-brand-600' : 'bg-ink-200')" /></div>
              <UiBadge v-if="current.status === 'checked_in'" tone="success" class="mt-2">Checked in</UiBadge>
              <UiBadge v-else-if="current.status === 'cancelled'" tone="danger" class="mt-2">Cancelled</UiBadge>
              <p v-else class="mt-2 text-sm text-ink-700">Not checked in</p>
              <TicketQr :value="current.qrPayload" class="mt-3" :class="current.status === 'cancelled' && 'opacity-40'" />
              <p class="mt-3 text-xs text-ink-500">Ticket ID</p>
              <p class="font-semibold tracking-wide">{{ current.code }}</p>
              <p class="mt-1 text-xs text-ink-500">{{ current.holderName }}</p>
              <div v-if="current.seat" class="mt-4 grid w-full grid-cols-2 divide-x divide-ink-200 border-t border-ink-200 pt-3 text-sm">
                <div><p class="text-xs text-ink-500">Table</p><p class="font-semibold text-brand-600">{{ current.seat.tableLabel }}</p></div>
                <div><p class="text-xs text-ink-500">Seat</p><p class="font-semibold">{{ current.seat.seatLabel }}</p></div>
              </div>
              <template v-if="tickets.length > 1">
                <button type="button" class="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-ink-200 bg-white disabled:opacity-40" :disabled="index === 0" aria-label="Previous ticket" @click="index--"><ChevronLeft class="h-4 w-4" /></button>
                <button type="button" class="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-ink-200 bg-white disabled:opacity-40" :disabled="index === tickets.length - 1" aria-label="Next ticket" @click="index++"><ChevronRight class="h-4 w-4" /></button>
              </template>
            </div>
          </div>
          <div v-if="current.refund" class="card border-warning-500/40 bg-warning-50 p-4 text-sm">
            <p class="font-semibold">Refund {{ current.refund.status }}</p>
            <p class="text-ink-700">{{ formatMoney(current.refund.amount, current.refund.currency) }} · requested {{ formatDate(current.refund.requestedAt) }}</p>
            <p v-if="current.refund.status === 'completed'" class="text-success-600">Refund sent to your original payment method.</p>
            <p v-else class="text-ink-500">Refunds take 3–7 business days depending on your bank.</p>
          </div>
        </div>

        <!-- right: details -->
        <div class="space-y-3">
          <section v-if="current.foodLines.length" class="card overflow-hidden">
            <button type="button" class="flex w-full items-center justify-between bg-brand-600 px-4 py-3 text-left text-sm font-medium text-white" @click="toggle('menu')">Menu <ChevronDown :class="cn('h-4 w-4 transition-transform', sections.menu && 'rotate-180')" /></button>
            <ul v-if="sections.menu" class="divide-y divide-ink-100 px-4 text-sm"><li v-for="l in current.foodLines" :key="l.menuItem.id" class="flex justify-between py-2.5"><span>{{ l.menuItem.name }}</span><span class="text-ink-500">x {{ l.quantity }}</span></li></ul>
          </section>
          <section v-if="current.additionalGuests.length" class="card overflow-hidden">
            <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left font-semibold" @click="toggle('guests')">Additional Guests <ChevronDown :class="cn('h-4 w-4 transition-transform', sections.guests && 'rotate-180')" /></button>
            <ul v-if="sections.guests" class="divide-y divide-ink-100 border-t border-ink-100 text-sm"><li class="flex items-center gap-3 px-4 py-3"><span class="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100"><UserRound class="h-4 w-4" /></span>{{ current.holderName }}</li><li v-for="g in current.additionalGuests" :key="g.firstName + g.lastName" class="flex items-center gap-3 px-4 py-3"><span class="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100"><UserRound class="h-4 w-4" /></span>{{ g.firstName }} {{ g.lastName }}</li></ul>
          </section>
          <section v-if="current.orderTotal > 0" class="card overflow-hidden">
            <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left font-semibold" @click="toggle('order')"><span class="flex items-center gap-2"><span class="flex h-7 w-7 items-center justify-center rounded-full bg-pink-100 text-pink-600"><ShoppingCart class="h-4 w-4" /></span>Your Order: {{ formatMoney(current.orderTotal, current.currency) }}</span><ChevronDown :class="cn('h-4 w-4 transition-transform', sections.order && 'rotate-180')" /></button>
            <div v-if="sections.order" class="border-t border-ink-100 px-4 py-3 text-sm text-ink-500">Receipt and invoice are available from your order history. <RouterLink :to="{ name: 'wallet' }" class="text-brand-600 hover:underline">View transactions</RouterLink></div>
          </section>
          <section class="card overflow-hidden">
            <button type="button" class="flex w-full items-center justify-between px-4 py-3 text-left font-semibold" @click="toggle('location')">Date &amp; Location <ChevronDown :class="cn('h-4 w-4 transition-transform', sections.location && 'rotate-180')" /></button>
            <div v-if="sections.location" class="mx-4 mb-4 divide-y divide-ink-100 rounded-xl border border-ink-200 text-sm">
              <div class="p-3"><p class="font-medium">{{ formatDate(schedule!.event.startsAt) }}</p><p class="text-ink-500">{{ formatTime(schedule!.event.startsAt) }}</p></div>
              <div v-if="current.event.attendanceMode !== 'online'" class="flex items-start gap-2 p-3"><MapPin class="mt-0.5 h-4 w-4 text-success-500" /><div><p>{{ current.event.city ?? 'Venue' }}</p><p class="text-ink-500">Address on event page</p></div></div>
              <div v-if="current.event.attendanceMode !== 'physical'" class="flex items-start gap-2 p-3"><Video class="mt-0.5 h-4 w-4 text-brand-600" /><div><p>Online link</p><p class="text-ink-500">Shared with ticket holders before the event</p></div></div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <template v-if="current" #footer>
      <div class="grid w-full gap-3 sm:grid-cols-2">
        <UiButton variant="secondary" size="lg" :disabled="!isCancellable" @click="cancelOpen = true">Cancel Ticket</UiButton>
        <UiButton size="lg" :disabled="current.status === 'cancelled'" @click="download"><Download class="h-4 w-4" /> Download Ticket</UiButton>
      </div>
    </template>
  </UiModal>
  <CancelTicketFlow v-if="current" :open="cancelOpen" :ticket="current" @update:open="cancelOpen = $event" @cancelled="onCancelled" />
</template>
