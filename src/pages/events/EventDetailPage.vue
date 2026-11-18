<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, ChevronRight, Heart, MapPin, Navigation, Share2, ShieldCheck, Users, Video, Clock } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiSectionHeader from '@/components/ui/UiSectionHeader.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import EventGrid from '@/modules/events/EventGrid.vue'
import { eventsApi } from '@/services/api/events.api'
import { organizerApi } from '@/services/api/organizer.api'
import { useAsync } from '@/composables/useAsync'
import { useForm } from '@/composables/useForm'
import { useSeo } from '@/composables/useSeo'
import { useShare } from '@/composables/useClipboardShare'
import { useAuthStore } from '@/stores/auth.store'
import { useCheckoutStore } from '@/stores/checkout.store'
import { useUiStore } from '@/stores/ui.store'
import { isApiError } from '@/services/http'
import { requestToAttendSchema } from '@/validations'
import { sanitizeRichText, plainTextToHtml } from '@/utils/sanitize'
import { formatDate, formatDateWithDay, formatMoney, formatTimeRange, formatPriceLabel } from '@/utils/format'
import { env } from '@/config/env'
import { cn } from '@/utils/cn'
import type { EventSummary } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const checkout = useCheckoutStore()
const ui = useUiStore()
const { share } = useShare()

const slug = computed(() => String(route.params.slug))
const { data: event, loading, error, refresh } = useAsync((signal) => eventsApi.bySlug(slug.value, signal), { watch: slug })
const related = ref<EventSummary[]>([])
const saved = ref(false)
const expanded = ref(false)
const requestOpen = ref(false)
const joining = ref(false)

watch(event, async (e) => {
  if (!e) return
  saved.value = e.isSaved
  // Promoter share links (?ref=CODE) are attributed at checkout; the backend validates the code.
  checkout.rememberReferral(e.id, route.query.ref)
  related.value = await eventsApi.related(e.id).catch(() => [])
})

useSeo(() => (event.value ? {
  title: event.value.title,
  description: event.value.description.slice(0, 155),
  image: event.value.coverUrl,
  url: `${env.webOrigin}/events/${event.value.slug}`,
  type: 'event',
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.value.title,
    startDate: event.value.startsAt,
    endDate: event.value.endsAt ?? undefined,
    eventAttendanceMode: { physical: 'https://schema.org/OfflineEventAttendanceMode', online: 'https://schema.org/OnlineEventAttendanceMode', hybrid: 'https://schema.org/MixedEventAttendanceMode' }[event.value.attendanceMode],
    image: [event.value.coverUrl],
    organizer: { '@type': 'Organization', name: event.value.organizer.displayName },
    location: event.value.schedules[0]?.venue ? { '@type': 'Place', name: event.value.schedules[0].venue.name, address: event.value.schedules[0].venue.address } : { '@type': 'VirtualLocation', url: `${env.webOrigin}/events/${event.value.slug}` },
    offers: event.value.ticketTypes.map((t) => ({ '@type': 'Offer', name: t.name, price: t.price / 100, priceCurrency: t.currency, availability: t.quantity > t.sold ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut' })),
  },
} : { title: 'Event' }))

const descriptionHtml = computed(() => {
  const d = event.value?.description ?? ''
  return /<[a-z][\s\S]*>/i.test(d) ? sanitizeRichText(d) : plainTextToHtml(d)
})
const firstSchedule = computed(() => event.value?.schedules[0])
const isOrganizer = computed(() => !!event.value && auth.user?.id === event.value.organizer.id)
const soldOut = computed(() => !!event.value && event.value.ticketTypes.every((t) => t.sold >= t.quantity))
const isPast = computed(() => !!event.value && new Date(event.value.endsAt ?? event.value.startsAt) < new Date())
const ctaLabel = computed(() => {
  if (!event.value) return ''
  if (event.value.myTicketId) return 'View ticket'
  if (event.value.status === 'cancelled') return 'Event cancelled'
  if (isPast.value) return 'Event ended'
  if (soldOut.value) return 'Sold out'
  if (event.value.approvalRequired && event.value.myRequestStatus === 'pending') return 'Request pending'
  if (event.value.approvalRequired && event.value.myRequestStatus !== 'approved') return 'Request to attend'
  return 'Attend Event'
})
const ctaDisabled = computed(() => ['Event cancelled', 'Event ended', 'Sold out', 'Request pending'].includes(ctaLabel.value))

function requireLogin(): boolean {
  if (auth.isAuthenticated) return true
  router.push({ name: 'auth.login', query: { redirect: route.fullPath } })
  return false
}
function attend() {
  if (!event.value || !requireLogin()) return
  if (event.value.myTicketId) return router.push({ name: 'ticket', params: { id: event.value.myTicketId } })
  if (event.value.approvalRequired && event.value.myRequestStatus !== 'approved') {
    requestForm.reset({ firstName: auth.user?.firstName ?? '', lastName: auth.user?.lastName ?? '' })
    requestOpen.value = true
    return
  }
  checkout.begin(event.value)
}
async function toggleSave() {
  if (!event.value || !requireLogin()) return
  const next = !saved.value
  saved.value = next
  try {
    if (next) await eventsApi.save(event.value.id)
    else await eventsApi.unsave(event.value.id)
    ui.success(next ? 'Saved to your events' : 'Removed from saved')
  } catch {
    saved.value = !next
  }
}
const requestForm = useForm({
  initialValues: { firstName: '', lastName: '' },
  schema: requestToAttendSchema,
  onSubmit: (v) => eventsApi.requestToAttend(event.value!.id, v),
  onSuccess: () => {
    requestOpen.value = false
    if (event.value) event.value.myRequestStatus = 'pending'
    ui.success('Request sent', 'The host will review your request. We’ll notify you once approved.')
  },
})
async function promote() {
  if (!event.value || !requireLogin()) return
  joining.value = true
  try {
    const p = await organizerApi.joinPromotion(event.value.id)
    ui.success('You’re promoting this event', 'Share your link to start earning.')
    router.push({ name: 'earn.detail', params: { id: p.id } })
  } catch (e) {
    if (isApiError(e) && e.status === 402) {
      ui.toast({ variant: 'info', title: 'Premium feature', description: e.message, action: { label: 'See plans', onClick: () => router.push({ name: 'pricing' }) } })
    } else ui.error((e as Error).message)
  } finally {
    joining.value = false
  }
}
const mapUrl = computed(() => {
  const v = firstSchedule.value?.venue
  if (!v) return null
  const q = encodeURIComponent(`${v.name}, ${v.address}, ${v.city}`)
  return env.googleMapsApiKey ? `https://www.google.com/maps/embed/v1/place?key=${env.googleMapsApiKey}&q=${q}` : `https://maps.google.com/maps?q=${q}&output=embed`
})
const directionsUrl = computed(() => {
  const v = firstSchedule.value?.venue
  return v ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${v.name}, ${v.address}`)}` : null
})
</script>

<template>
  <div class="container-app pb-10 pt-8">
    <ErrorState v-if="error" :error="error" @retry="refresh">
      <UiButton class="mt-4" variant="outline" :to="{ name: 'events' }">Browse events</UiButton>
    </ErrorState>

    <div v-else-if="loading || !event" class="space-y-6">
      <UiSkeleton class="h-6 w-32 rounded-full" /><UiSkeleton class="h-12 w-3/4" /><UiSkeleton class="aspect-[16/6] w-full rounded-2xl" />
      <div class="grid gap-4 md:grid-cols-3"><UiSkeleton v-for="i in 3" :key="i" class="h-20 rounded-2xl" /></div>
    </div>

    <article v-else>
      <div class="flex flex-wrap items-center gap-2">
        <span class="chip">{{ event.category.name }}</span>
        <UiBadge v-if="event.status !== 'live'" :status="event.status" />
        <UiBadge v-if="event.isPromoted" tone="brand">✦ Promoted</UiBadge>
      </div>
      <h1 class="mt-3 text-3xl leading-tight md:text-5xl">{{ event.title }}</h1>
      <RouterLink :to="{ name: 'user', params: { id: event.organizer.id } }" class="mt-3 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900">
        <UiAvatar :src="event.organizer.avatarUrl" :name="event.organizer.displayName" size="xs" /> Hosted by <span class="font-medium text-ink-900">{{ event.organizer.displayName }}</span>
      </RouterLink>

      <div class="mt-5 overflow-hidden rounded-2xl border-2 border-brand-300 bg-ink-100">
        <img :src="event.coverUrl" :alt="event.title" class="aspect-[16/7] w-full object-cover" fetchpriority="high" />
      </div>

      <div class="mt-5 grid gap-3 md:grid-cols-3">
        <div v-if="event.guestLimit" class="flex items-start gap-3 rounded-2xl bg-ink-50 p-4"><Users class="mt-0.5 h-5 w-5 text-ink-500" /><div><p class="font-medium">Guest limit</p><p class="text-sm text-ink-500">Max {{ event.guestLimit.toLocaleString() }} Guests</p></div></div>
        <div v-if="event.approvalRequired" class="flex items-start gap-3 rounded-2xl bg-ink-50 p-4"><ShieldCheck class="mt-0.5 h-5 w-5 text-ink-500" /><div><p class="font-medium">Approval required</p><p class="text-sm text-ink-500">You’ll need to request permission from the host to attend</p></div></div>
        <div v-if="event.isAdultOnly" class="flex items-start gap-3 rounded-2xl bg-ink-50 p-4"><span class="mt-0.5 flex h-5 w-5 items-center justify-center rounded border border-ink-500 text-[10px] font-bold text-ink-500">18</span><div><p class="font-medium">Adult event</p><p class="text-sm text-ink-500">This event is rated 18+</p></div></div>
      </div>

      <div class="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div class="min-w-0 space-y-10">
          <section>
            <h2 class="text-xl">About the Event</h2>
            <!-- eslint-disable-next-line vue/no-v-html -- descriptionHtml is sanitizeRichText()/plainTextToHtml() output -->
            <div :class="cn('prose-sm mt-2 text-ink-700 [&_p]:mb-3', !expanded && 'line-clamp-4')" v-html="descriptionHtml" />
            <button v-if="event.description.length > 280" type="button" class="text-sm font-medium text-brand-600 hover:underline" @click="expanded = !expanded">{{ expanded ? 'Show less' : 'Read more' }}</button>
          </section>

          <button v-if="event.isPromoted && !isOrganizer" type="button" class="card flex w-full max-w-md items-center justify-between p-4 text-left hover:shadow-card" :disabled="joining" @click="promote">
            <div><p class="text-sm font-medium">Promote this event</p><p class="mt-2 text-xs text-ink-500">Earn Reward</p><p class="font-semibold text-brand-600">{{ event.promotion.commissionPercent }}%</p></div>
            <div class="flex flex-col items-end justify-between self-stretch"><ChevronRight class="h-4 w-4" /><span class="flex items-center gap-1 text-xs text-ink-500"><Users class="h-3.5 w-3.5" />{{ event.promotion.promotersCount }} promoting</span></div>
          </button>

          <section>
            <h2 class="text-xl">Date &amp; Location</h2>
            <div class="mt-3 max-w-md space-y-3">
              <div v-for="s in event.schedules" :key="s.id" class="card divide-y divide-ink-100">
                <div class="p-4">
                  <p v-if="s.label" class="text-xs font-semibold uppercase tracking-wide text-brand-600">{{ s.label }}</p>
                  <p class="font-medium">{{ formatDateWithDay(s.startsAt) }}</p>
                  <p class="text-sm text-ink-500">{{ formatTimeRange(s.startsAt, s.endsAt) }}</p>
                  <span class="chip mt-2 capitalize"><MapPin class="h-3 w-3 text-success-500" />{{ s.attendanceMode }}</span>
                </div>
                <div v-if="s.venue" class="flex items-start gap-2 p-4 text-sm"><MapPin class="mt-0.5 h-4 w-4 shrink-0 text-success-500" /><div><p>{{ s.venue.address }}</p><p class="text-ink-500">{{ s.venue.state }}, Nigeria</p></div></div>
                <div v-if="s.online" class="flex items-start gap-2 p-4 text-sm"><Video class="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><div><p>{{ event.myTicketId ? s.online.link : 'Link shared with ticket holders' }}</p><p class="capitalize text-ink-500">{{ s.online.platform.replace(/_/g, ' ') }}</p></div></div>
              </div>
            </div>
          </section>

          <section v-if="firstSchedule?.venue">
            <h2 class="text-xl">Location</h2>
            <p class="mt-2 font-medium">{{ firstSchedule.venue.name }}</p>
            <p class="text-sm text-ink-500">{{ firstSchedule.venue.address }}</p>
            <UiButton v-if="directionsUrl" size="xs" class="mt-2" :href="directionsUrl"><Navigation class="h-3.5 w-3.5" />Get directions</UiButton>
            <iframe v-if="mapUrl" :src="mapUrl" class="mt-3 h-56 w-full max-w-md rounded-2xl border-0" loading="lazy" referrerpolicy="no-referrer-when-downgrade" :title="`Map of ${firstSchedule.venue.name}`" />
          </section>

          <section v-if="event.subEvents.length">
            <h2 class="text-xl">Sub events</h2>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div v-for="s in event.subEvents" :key="s.id" class="card flex gap-3 p-3">
                <img v-if="s.coverUrl" :src="s.coverUrl" alt="" loading="lazy" class="h-16 w-16 rounded-lg object-cover" />
                <div class="min-w-0"><p class="font-medium">{{ s.title }}</p><p class="flex items-center gap-1 text-xs text-ink-500"><Clock class="h-3 w-3" />{{ formatDate(s.startsAt) }} · {{ formatTimeRange(s.startsAt, s.endsAt, '') }}</p><p class="mt-1 text-xs text-ink-500">{{ s.isIncludedInBundle ? 'Included with your ticket' : s.requiresApproval ? 'Requires host approval' : 'Separate entry' }}</p></div>
              </div>
            </div>
          </section>

          <section>
            <h2 class="text-xl">Meet the Organiser</h2>
            <RouterLink :to="{ name: 'user', params: { id: event.organizer.id } }" class="card mt-3 flex max-w-md items-center gap-3 border-brand-200 bg-ink-50 p-4 hover:shadow-card">
              <UiAvatar :src="event.organizer.avatarUrl" :name="event.organizer.displayName" />
              <div><p class="font-medium">{{ event.organizer.displayName }}</p><p class="text-sm text-ink-500">{{ event.organizer.bio }}</p></div>
            </RouterLink>
            <RouterLink :to="{ name: 'user', params: { id: event.organizer.id } }" class="card mt-3 flex max-w-md items-center justify-between p-4 text-sm hover:shadow-card"><span class="text-brand-600">See more events organised by <span class="font-medium text-ink-900">{{ event.organizer.displayName }}</span></span><ArrowRight class="h-4 w-4" /></RouterLink>
          </section>

          <section v-if="event.ticketTypes.length">
            <h2 class="text-xl">Tickets</h2>
            <div class="card mt-3 max-w-md divide-y divide-ink-100">
              <div v-for="t in event.ticketTypes" :key="t.id" class="flex items-start justify-between gap-4 p-4">
                <div><p class="font-medium">{{ t.name }}</p><p class="text-xs text-ink-500">Sales end: {{ t.salesEndAt ? formatDate(t.salesEndAt) : 'At event start' }} - {{ Math.max(0, t.quantity - t.sold).toLocaleString() }} slots</p></div>
                <span class="font-medium">{{ t.price === 0 ? 'Free' : formatMoney(t.price, t.currency) }}</span>
              </div>
            </div>
          </section>
        </div>

        <!-- sticky purchase box (desktop) -->
        <aside class="hidden lg:block">
          <div class="sticky top-24 card space-y-4 p-6 shadow-card">
            <p class="text-sm text-ink-500">{{ formatDateWithDay(event.startsAt) }} · {{ formatTimeRange(event.startsAt, event.endsAt) }}</p>
            <p class="text-2xl font-bold">{{ formatPriceLabel(event.minPrice, event.currency, event.ticketTypes.length > 1 && !event.isFree) }}</p>
            <UiButton v-if="isOrganizer" block size="lg" :to="{ name: 'manage.overview', params: { id: event.id } }">Manage event</UiButton>
            <UiButton v-else block size="lg" :disabled="ctaDisabled" @click="attend">{{ ctaLabel }}</UiButton>
            <div class="flex gap-2">
              <UiButton variant="outline" block :aria-pressed="saved" @click="toggleSave"><Heart :class="cn('h-4 w-4', saved && 'fill-pink-500 text-pink-500')" />{{ saved ? 'Saved' : 'Save' }}</UiButton>
              <UiButton variant="outline" block @click="share(`/events/${event.slug}`, event.title)"><Share2 class="h-4 w-4" />Share</UiButton>
            </div>
          </div>
        </aside>
      </div>

      <!-- sticky bar (mobile & tablet, matches design pill) -->
      <div class="sticky bottom-4 z-20 mt-10 lg:hidden">
        <div class="flex items-center gap-3 rounded-full border border-brand-300 bg-white p-2 pl-5 shadow-float">
          <div class="min-w-0 flex-1"><p class="truncate text-xs text-ink-500">{{ formatDateWithDay(event.startsAt) }}</p><p class="font-semibold">{{ formatPriceLabel(event.minPrice, event.currency) }}</p></div>
          <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-brand-300 text-brand-600" :aria-label="saved ? 'Unsave' : 'Save'" @click="toggleSave"><Heart :class="cn('h-4 w-4', saved && 'fill-current')" /></button>
          <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-brand-300 text-brand-600" aria-label="Share" @click="share(`/events/${event.slug}`, event.title)"><Share2 class="h-4 w-4" /></button>
          <UiButton v-if="isOrganizer" :to="{ name: 'manage.overview', params: { id: event.id } }">Manage</UiButton>
          <UiButton v-else :disabled="ctaDisabled" @click="attend">{{ ctaLabel }}</UiButton>
        </div>
      </div>

      <section v-if="related.length" class="mt-16 border-t border-ink-100 pt-10">
        <UiSectionHeader title="Other Events You May Like" size="lg" :to="{ name: 'events' }" link-label="See all events" />
        <EventGrid :events="related" variant="compact" />
      </section>
    </article>

    <UiModal v-model:open="requestOpen" title="Request to attend" size="md">
      <div v-if="event" class="card mb-5 flex items-center gap-3 p-3">
        <img :src="event.coverUrl" alt="" class="h-14 w-14 rounded-lg object-cover" />
        <div><p class="font-medium">{{ event.title }}</p><p class="text-xs text-ink-500">{{ formatDate(event.startsAt) }}</p><p class="text-xs font-medium">{{ formatPriceLabel(event.minPrice) }}</p></div>
      </div>
      <form class="grid grid-cols-2 gap-4" novalidate @submit.prevent="requestForm.submit()">
        <UiInput v-model="requestForm.values.firstName" label="First Name" required :error="requestForm.fieldError('firstName')" />
        <UiInput v-model="requestForm.values.lastName" label="Last Name" required :error="requestForm.fieldError('lastName')" />
        <UiButton type="submit" size="lg" block class="col-span-2 mt-4" :loading="requestForm.submitting.value">Request to attend</UiButton>
      </form>
    </UiModal>
  </div>
</template>
