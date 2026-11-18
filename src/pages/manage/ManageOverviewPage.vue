<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, ClipboardList, Clock, Eye, MessagesSquare, ScanLine, Sparkles, Star, Ticket, Users } from 'lucide-vue-next'
import RequestsDrawer from '@/modules/organizer/RequestsDrawer.vue'
import ScanTicketsDrawer from '@/modules/organizer/ScanTicketsDrawer.vue'
import PromotionDrawer from '@/modules/organizer/PromotionDrawer.vue'
import CommunitySettingsModal from '@/modules/organizer/CommunitySettingsModal.vue'
import { useManagedEvent } from '@/modules/organizer/useManagedEvent'

const router = useRouter()
const { event, refresh, isOrganizer } = useManagedEvent()
const drawer = ref<'requests' | 'scan' | 'promo' | 'community' | null>(null)
const pending = computed(() => event.value?.stats.pendingRequests ?? 0)
const tiles = computed(() => {
  const id = event.value?.id ?? ''
  return [
    { label: 'Tickets', icon: Ticket, onClick: () => router.push({ name: 'manage.tickets', params: { id } }) },
    { label: 'Scan tickets', icon: ScanLine, onClick: () => (drawer.value = 'scan') },
    { label: 'View Event page', icon: Eye, onClick: () => router.push({ name: 'event', params: { slug: event.value?.slug } }) },
    { label: 'Checklist', icon: ClipboardList, onClick: () => router.push({ name: 'manage.checklist', params: { id } }) },
    { label: 'Promotions', icon: Star, sub: event.value?.isPromoted ? `${event.value.promotion.commissionPercent}% commission` : undefined, onClick: () => (drawer.value = 'promo'), hidden: !isOrganizer.value },
    { label: 'Event Assets', icon: Sparkles, onClick: () => router.push({ name: 'manage.assets', params: { id } }) },
    { label: 'Collaborators', icon: Users, sub: String(event.value?.manage.collaboratorsCount ?? 0), onClick: () => router.push({ name: 'manage.collaborators', params: { id } }) },
    { label: 'Community', icon: MessagesSquare, sub: 'Group chat settings', onClick: () => (drawer.value = 'community') },
  ].filter((t) => !t.hidden)
})
</script>

<template>
  <div v-if="event">
    <button v-if="event.approvalRequired" type="button" class="card flex w-full items-center gap-3 p-4 text-left hover:shadow-card" @click="drawer = 'requests'">
      <Clock class="h-5 w-5 text-ink-500" /><span class="text-ink-500">Pending · Awaiting approval</span>
      <span class="rounded-full bg-pink-50 px-2.5 py-0.5 text-sm font-semibold text-brand-600">{{ pending }}</span>
      <ChevronRight class="ml-auto h-4 w-4" />
    </button>
    <div class="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
      <button v-for="t in tiles" :key="t.label" type="button" class="card flex flex-col items-start gap-3 p-5 text-left transition hover:border-brand-300 hover:shadow-card" @click="t.onClick">
        <component :is="t.icon" class="h-4 w-4 text-ink-700" /><span>{{ t.label }}<span v-if="t.sub" class="mt-1 block text-xs text-ink-500">{{ t.sub }}</span></span>
      </button>
    </div>
    <RequestsDrawer :open="drawer === 'requests'" :event-id="event.id" @update:open="drawer = null" @changed="refresh" />
    <ScanTicketsDrawer :open="drawer === 'scan'" :event-id="event.id" @update:open="drawer = null" @checked-in="refresh" />
    <PromotionDrawer :open="drawer === 'promo'" :event-id="event.id" @update:open="drawer = null" @saved="refresh" />
    <CommunitySettingsModal :open="drawer === 'community'" :event-id="event.id" @update:open="drawer = null" @changed="refresh" />
  </div>
</template>
