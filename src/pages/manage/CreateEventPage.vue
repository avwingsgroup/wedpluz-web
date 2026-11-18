<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { CircleHelp, Globe, MapPin, Pencil, Plus, Sparkles, Trash2, Video, Check, ChevronRight, Lock } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiProgressSteps from '@/components/ui/UiProgressSteps.vue'
import UiImageUploader from '@/components/ui/UiImageUploader.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { eventsApi } from '@/services/api/events.api'
import { plannerApi } from '@/services/api/planner.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { isApiError } from '@/services/http'
import { emptyDraft, emptySchedule, emptyTicket, eventToDraft, draftToPayload, NIGERIAN_STATES, PLATFORMS, type EventDraftForm, type SubEventForm, type TicketForm } from '@/modules/organizer/eventDraft'
import { formatDate, formatMoney, formatDateRange } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { EventCategory, HallLayout, PlannerMenu } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const eventId = ref<string | null>(route.params.id ? String(route.params.id) : null)
const loading = ref(!!eventId.value)
const saving = ref(false)
const dirty = ref(false)
const mode = ref<'edit' | 'preview'>('edit')
const step = ref(0)
const errors = ref<Record<string, string>>({})
const categories = ref<EventCategory[]>([])
const layouts = ref<HallLayout[]>([])
const menus = ref<PlannerMenu[]>([])
const draft = reactive<EventDraftForm>(emptyDraft({ displayName: auth.displayName, contactEmail: auth.user?.email ?? '', contactPhone: auth.user?.phone ?? '' }))
const status = ref<string>('draft')

const steps = [
  { key: 'basic', label: 'Basic details' },
  { key: 'schedule', label: 'Schedule & location' },
  { key: 'sub', label: 'Sub-event' },
  { key: 'tickets', label: 'Ticket & pricing' },
  { key: 'assets', label: 'Assets' },
  { key: 'organizer', label: 'Organizer’s Info' },
]

onMounted(async () => {
  try {
    const [cats, ls, ms] = await Promise.all([eventsApi.categories(), plannerApi.hallLayouts().catch(() => []), plannerApi.menus().catch(() => [])])
    categories.value = cats
    layouts.value = ls
    menus.value = ms
    if (eventId.value) {
      const e = await organizerApi.get(eventId.value)
      Object.assign(draft, eventToDraft(e))
      status.value = e.status
    }
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
    // watch for edits after initial hydrate
    setTimeout(() => (dirty.value = false), 0)
  }
})

/* unsaved changes guard */
const markDirty = () => (dirty.value = true)
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) e.preventDefault()
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
onBeforeRouteLeave(async () => (dirty.value ? await ui.confirm({ title: 'Leave without saving?', description: 'Your latest changes on this step will be lost.', confirmLabel: 'Leave', variant: 'danger' }) : true))

/* validation per step */
function validate(i: number): boolean {
  const e: Record<string, string> = {}
  if (i === 0) {
    if (draft.title.trim().length < 3) e.title = 'Give your event a title'
    if (draft.description.trim().length < 20) e.description = 'Describe your event in at least 20 characters'
    if (!draft.coverUrl) e.coverUrl = 'Add a cover image'
    if (!draft.categoryId) e.categoryId = 'Choose a category'
    if (draft.limitGuests && !draft.guestLimit) e.guestLimit = 'Enter the maximum number of guests'
    if (draft.allowGuestInvites && draft.maxAdditionalGuests < 1) e.maxAdditionalGuests = 'Allow at least 1 guest'
  }
  if (i === 1) {
    draft.schedules.forEach((s, idx) => {
      if (!s.date) e[`s${idx}.date`] = 'Pick a date'
      else if (new Date(`${s.date}T${s.startTime || '00:00'}`) < new Date()) e[`s${idx}.date`] = 'Date must be in the future'
      if (!s.startTime) e[`s${idx}.startTime`] = 'Pick a start time'
      if (s.endTime && !s.endDate && s.endTime <= s.startTime) e[`s${idx}.endTime`] = 'End must be after start'
      if (s.attendanceMode !== 'online') {
        if (!s.venue.name.trim()) e[`s${idx}.venue.name`] = 'Enter the venue name'
        if (!s.venue.state) e[`s${idx}.venue.state`] = 'Select a state'
        if (!s.venue.address.trim()) e[`s${idx}.venue.address`] = 'Enter the address'
      }
      if (s.attendanceMode !== 'physical') {
        if (!s.online.platform) e[`s${idx}.online.platform`] = 'Select a platform'
        if (!/^https?:\/\//.test(s.online.link)) e[`s${idx}.online.link`] = 'Paste a valid link'
      }
    })
  }
  if (i === 3 && !draft.isFree && !draft.tickets.length) e.tickets = 'Add at least one ticket type or mark the event as free'
  if (i === 5) {
    if (draft.organizer.displayName.trim().length < 2) e['organizer.displayName'] = 'Enter the organizer name'
    if (!/^\S+@\S+\.\S+$/.test(draft.organizer.contactEmail)) e['organizer.contactEmail'] = 'Enter a valid email'
  }
  errors.value = e
  if (Object.keys(e).length) {
    ui.error('Please fix the highlighted fields')
    return false
  }
  return true
}

async function save(): Promise<boolean> {
  saving.value = true
  try {
    for (const s of draft.schedules) if (s.venue.state && !s.venue.city) s.venue.city = s.venue.state
    const payload = draftToPayload(draft)
    if (!eventId.value) {
      const created = await organizerApi.createDraft(payload)
      eventId.value = created.id
      Object.assign(draft, eventToDraft(created), { coverUrl: draft.coverUrl })
      router.replace({ name: 'manage.edit', params: { id: created.id } })
    } else {
      const updated = await organizerApi.update(eventId.value, payload)
      // keep server-assigned ids for schedules / tickets so later saves update instead of duplicating
      updated.schedules.forEach((s, i) => draft.schedules[i] && (draft.schedules[i]!.id = s.id))
      updated.ticketTypes.forEach((t, i) => draft.tickets[i] && (draft.tickets[i]!.id = t.id))
    }
    dirty.value = false
    return true
  } catch (e) {
    if (isApiError(e) && e.isValidation) {
      errors.value = Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0] ?? 'Invalid']))
    }
    ui.error((e as Error).message)
    return false
  } finally {
    saving.value = false
  }
}
async function next() {
  if (!validate(step.value)) return
  if (!(await save())) return
  if (step.value < steps.length - 1) {
    step.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    mode.value = 'preview'
  }
}
function goToStep(i: number) {
  if (i <= step.value) step.value = i
}
async function publish() {
  for (let i = 0; i < steps.length; i++) {
    if (!validate(i)) {
      step.value = i
      mode.value = 'edit'
      return
    }
  }
  if (!(await save()) || !eventId.value) return
  saving.value = true
  try {
    await organizerApi.publish(eventId.value)
    dirty.value = false
    ui.success('Your event is live! 🎉', 'Share it with your guests to start selling tickets.')
    router.push({ name: 'manage.overview', params: { id: eventId.value } })
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}

/* schedules */
function addDate() {
  const last = draft.schedules[draft.schedules.length - 1]
  draft.schedules.push({ ...emptySchedule(), attendanceMode: last?.attendanceMode ?? 'physical', venue: { ...(last?.venue ?? emptySchedule().venue) }, online: { ...(last?.online ?? { platform: '', link: '' }) } })
  markDirty()
}
function removeDate(i: number) {
  draft.schedules.splice(i, 1)
  markDirty()
}

/* sub-events (premium) */
const canUseSubEvents = computed(() => auth.isPremium)
const subOpen = ref(false)
const subEditIndex = ref<number | null>(null)
const subForm = reactive<SubEventForm>({ title: '', description: '', coverUrl: null, scheduleIndex: 0, startTime: '', endTime: '', requiresApproval: false, isIncludedInBundle: true })
function openSub(i: number | null) {
  subEditIndex.value = i
  Object.assign(subForm, i === null ? { title: '', description: '', coverUrl: null, scheduleIndex: 0, startTime: '', endTime: '', requiresApproval: false, isIncludedInBundle: true, id: undefined } : { ...draft.subEvents[i] })
  subOpen.value = true
}
function saveSub() {
  if (subForm.title.trim().length < 2 || !subForm.startTime) return ui.error('Add a title and start time')
  if (subEditIndex.value === null) draft.subEvents.push({ ...subForm })
  else draft.subEvents[subEditIndex.value] = { ...subForm }
  subOpen.value = false
  markDirty()
}

/* tickets */
const ticketOpen = ref(false)
const ticketEditIndex = ref<number | null>(null)
const ticketForm = reactive<TicketForm>(emptyTicket())
const ticketErrors = ref<Record<string, string>>({})
function openTicket(i: number | null) {
  ticketEditIndex.value = i
  ticketErrors.value = {}
  Object.assign(ticketForm, i === null ? { ...emptyTicket(), id: undefined } : { ...draft.tickets[i] })
  ticketOpen.value = true
}
function saveTicket() {
  const e: Record<string, string> = {}
  if (ticketForm.name.trim().length < 2) e.name = 'Name this ticket'
  if (!draft.isFree && ticketForm.price <= 0) e.price = 'Enter a price (or mark the event as free)'
  if (ticketForm.quantity < 1) e.quantity = 'Enter available slots'
  if (!ticketForm.salesEndAt) e.salesEndAt = 'Set a sales end date'
  ticketErrors.value = e
  if (Object.keys(e).length) return
  if (ticketEditIndex.value === null) draft.tickets.push({ ...ticketForm })
  else draft.tickets[ticketEditIndex.value] = { ...ticketForm }
  ticketOpen.value = false
  markDirty()
}
async function removeTicket(i: number) {
  if (!(await ui.confirm({ title: `Delete ${draft.tickets[i]?.name}?`, variant: 'danger', confirmLabel: 'Delete' }))) return
  draft.tickets.splice(i, 1)
  markDirty()
}
const totalSlots = computed(() => draft.tickets.reduce((a, t) => a + t.quantity, 0))
const categoryName = computed(() => categories.value.find((c) => c.id === draft.categoryId)?.name ?? '')
const hasPhysical = computed(() => draft.schedules.some((s) => s.attendanceMode !== 'online'))
</script>

<template>
  <div class="container-app max-w-[1200px] pb-10 pt-10" @input="markDirty" @change="markDirty">
    <UiBackButton :to="eventId ? { name: 'manage.overview', params: { id: eventId } } : { name: 'manage.events' }" />
    <div class="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 class="text-3xl md:text-4xl">{{ eventId && status !== 'draft' ? 'Edit Event' : 'Create an Event' }}</h1><p class="mt-1 text-sm text-ink-700">Create and manage your own events</p></div>
      <UiTabs v-model="mode" variant="segment" class="w-fit" :tabs="[{ key: 'edit', label: 'Edit' }, { key: 'preview', label: 'Preview' }]" />
    </div>

    <UiSpinner v-if="loading" page />

    <!-- ================= PREVIEW ================= -->
    <div v-else-if="mode === 'preview'" class="mt-8">
      <div class="rounded-2xl border border-dashed border-brand-300 bg-brand-50/30 p-3 text-center text-sm text-brand-700">Attendee view preview. This is how guests will see your event.</div>
      <article class="mt-6">
        <span class="chip">{{ categoryName || 'Category' }}</span>
        <h2 class="mt-3 text-3xl md:text-5xl">{{ draft.title || 'Untitled event' }}</h2>
        <p class="mt-2 text-sm text-ink-500">Hosted by <strong class="text-ink-900">{{ draft.organizer.displayName }}</strong></p>
        <img v-if="draft.coverUrl" :src="draft.coverUrl" alt="" class="mt-5 aspect-[16/7] w-full rounded-2xl border-2 border-brand-300 object-cover" />
        <div class="mt-5 grid gap-3 md:grid-cols-3">
          <div v-if="draft.limitGuests" class="rounded-2xl bg-ink-50 p-4"><p class="font-medium">Guest limit</p><p class="text-sm text-ink-500">Max {{ draft.guestLimit }} Guests</p></div>
          <div v-if="draft.approvalRequired" class="rounded-2xl bg-ink-50 p-4"><p class="font-medium">Approval required</p><p class="text-sm text-ink-500">You’ll need to request permission from the host to attend</p></div>
          <div v-if="draft.isAdultOnly" class="rounded-2xl bg-ink-50 p-4"><p class="font-medium">Adult event</p><p class="text-sm text-ink-500">This event is rated 18+</p></div>
        </div>
        <section class="mt-8 max-w-2xl"><h3 class="text-xl">About the Event</h3><p class="mt-2 whitespace-pre-line text-ink-700">{{ draft.description }}</p></section>
        <section class="mt-8 max-w-md"><h3 class="text-xl">Date &amp; Location</h3>
          <div v-for="(s, i) in draft.schedules" :key="i" class="card mt-3 divide-y divide-ink-100"><div class="p-4"><p class="font-medium">{{ s.date ? formatDateRange(s.date, s.endDate || null) : 'Date not set' }}</p><p class="text-sm text-ink-500">{{ s.startTime }}{{ s.endTime ? ` - ${s.endTime}` : '' }} WAT</p><span class="chip mt-2 capitalize">{{ s.attendanceMode }}</span></div><div v-if="s.attendanceMode !== 'online'" class="p-4 text-sm">{{ s.venue.name }} · {{ s.venue.address }}, {{ s.venue.state }}</div><div v-if="s.attendanceMode !== 'physical'" class="p-4 text-sm">{{ PLATFORMS.find((p) => p.value === s.online.platform)?.label }}</div></div>
        </section>
        <section v-if="draft.subEvents.length" class="mt-8 max-w-md"><h3 class="text-xl">Sub events</h3><div v-for="(s, i) in draft.subEvents" :key="i" class="card mt-3 p-4"><p class="font-medium">{{ s.title }}</p><p class="text-sm text-ink-500">{{ s.startTime }} · {{ s.isIncludedInBundle ? 'Included' : 'Separate entry' }}</p></div></section>
        <section class="mt-8 max-w-md"><h3 class="text-xl">Tickets</h3><div class="card mt-3 divide-y divide-ink-100"><div v-if="draft.isFree && !draft.tickets.length" class="p-4">Free entry</div><div v-for="(t, i) in draft.tickets" :key="i" class="flex justify-between p-4"><div><p class="font-medium">{{ t.name }}</p><p class="text-xs text-ink-500">Sales end: {{ t.salesEndAt ? formatDate(t.salesEndAt) : '—' }} - {{ t.quantity }} slots</p></div><span>{{ draft.isFree ? 'Free' : formatMoney(t.price) }}</span></div></div></section>
      </article>
      <div class="sticky bottom-4 mt-10 flex flex-col gap-3 rounded-full border border-ink-100 bg-white p-3 shadow-float sm:flex-row sm:justify-end">
        <UiButton variant="secondary" size="lg" @click="mode = 'edit'"><Pencil class="h-4 w-4" />Keep editing</UiButton>
        <UiButton v-if="status === 'draft'" size="lg" :loading="saving" @click="publish">Publish event <ChevronRight class="h-4 w-4" /></UiButton>
        <UiButton v-else size="lg" :loading="saving" @click="save().then((ok) => ok && ui.success('Changes saved'))">Save changes</UiButton>
      </div>
    </div>

    <!-- ================= EDIT ================= -->
    <template v-else>
      <UiProgressSteps class="mt-8" :steps="steps" :current="step" clickable @select="goToStep" />

      <!-- Step 1: basic -->
      <div v-if="step === 0" class="mt-6 space-y-4">
        <div class="card overflow-hidden">
          <input v-model="draft.title" type="text" placeholder="Event name" maxlength="120" :class="cn('w-full border-0 border-b border-ink-100 px-4 py-4 text-lg focus:ring-0', errors.title && 'border-danger-500')" aria-label="Event name" />
          <textarea v-model="draft.description" rows="6" placeholder="Describe your event: what guests can expect, dress code, agenda…" maxlength="5000" class="w-full resize-y border-0 px-4 py-4 focus:ring-0" aria-label="Event description" />
        </div>
        <p v-if="errors.title || errors.description" class="text-xs text-danger-500">{{ errors.title ?? errors.description }}</p>
        <UiImageUploader v-model="draft.coverUrl" purpose="event_cover" label="Cover Image" aspect="banner" :error="errors.coverUrl" hint="Recommended 1600×700px" @uploaded="(ids) => (draft.coverUploadId = ids[0] ?? null)" />
        <div class="card p-4"><UiSelect v-model="draft.categoryId" label="Event category" placeholder="Choose a category" :options="categories.map((c) => ({ label: c.name, value: c.id }))" :error="errors.categoryId" /></div>
        <div class="card divide-y divide-ink-100 p-4">
          <div class="flex items-center justify-between gap-4 pb-4"><span class="flex items-center gap-1.5 font-medium">Event type <CircleHelp class="h-4 w-4 text-ink-400" title="Private events are only visible to people with the link" /></span>
            <div class="flex gap-2"><button v-for="v in (['public', 'private'] as const)" :key="v" type="button" :class="cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm capitalize', draft.visibility === v ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500')" @click="draft.visibility = v; markDirty()">{{ v }}<Check v-if="draft.visibility === v" class="h-4 w-4" /></button></div>
          </div>
          <div class="pt-4"><UiToggle v-model="draft.approvalRequired" label="Approval required" description="Review and approve attendee requests before they purchase a ticket." /></div>
        </div>
        <div class="card divide-y divide-ink-100 p-4">
          <div class="pb-4"><UiToggle v-model="draft.limitGuests" label="Limit Guest Capacity" description="Set the maximum number of attendees. Registrations close once the limit is reached." /></div>
          <div v-if="draft.limitGuests" class="flex items-center justify-between gap-4 pt-4"><span>Number of Guest</span><UiInput :model-value="draft.guestLimit" type="number" min="1" class="!w-28" inputmode="numeric" :error="errors.guestLimit" @update:model-value="draft.guestLimit = Number($event) || null" /></div>
        </div>
        <div class="card divide-y divide-ink-100 p-4">
          <div class="pb-4"><UiToggle v-model="draft.allowGuestInvites" label="Guest can invite others" description="Allow guests to bring additional guests" /></div>
          <div v-if="draft.allowGuestInvites" class="flex items-center justify-between gap-4 pt-4"><span>Number of Guest</span><UiInput :model-value="draft.maxAdditionalGuests" type="number" min="1" max="20" class="!w-28" :error="errors.maxAdditionalGuests" @update:model-value="draft.maxAdditionalGuests = Number($event) || 0" /></div>
        </div>
        <div class="card p-4"><p class="mb-3 font-medium">Adult Event</p><UiCheckbox v-model="draft.isAdultOnly" label="This event is rated 18+" /></div>
      </div>

      <!-- Step 2: schedule & location -->
      <div v-else-if="step === 1" class="mt-6">
        <div class="flex items-start justify-between"><div><h2 class="font-medium">Schedule date &amp; location</h2><p class="text-xs text-ink-500">Add a date for each day of a multi-day event. Each day can have its own venue.</p></div><UiButton variant="link" @click="addDate"><Plus class="h-4 w-4" />Add Dates</UiButton></div>
        <div v-for="(s, i) in draft.schedules" :key="i" class="card mt-4 space-y-4 p-4">
          <div v-if="draft.schedules.length > 1" class="flex items-center justify-between"><input v-model="s.label" :placeholder="`Day ${i + 1}`" class="border-0 p-0 font-semibold text-brand-600 focus:ring-0" aria-label="Day label" /><button type="button" class="text-danger-500" aria-label="Remove date" @click="removeDate(i)"><Trash2 class="h-4 w-4" /></button></div>
          <div class="divide-y divide-ink-100 rounded-2xl border border-ink-100 px-4">
            <div class="flex flex-wrap items-center justify-between gap-3 py-3"><span>Date</span><div class="flex gap-2"><UiInput v-model="s.date" type="date" class="!w-44" :min="new Date().toISOString().slice(0, 10)" :error="errors[`s${i}.date`]" /><UiInput v-model="s.endDate" type="date" class="!w-44" :min="s.date || undefined" placeholder="End (optional)" /></div></div>
            <div class="flex flex-wrap items-center justify-between gap-3 py-3"><span>Time</span><div class="flex gap-2"><UiInput v-model="s.startTime" type="time" class="!w-32" :error="errors[`s${i}.startTime`]" /><UiInput v-model="s.endTime" type="time" class="!w-32" :error="errors[`s${i}.endTime`]" /></div></div>
          </div>
          <p class="text-sm text-ink-700">How will people attend?</p>
          <div class="grid grid-cols-3 gap-1 rounded-2xl bg-ink-50 p-1">
            <button v-for="m in ([{ k: 'physical', l: 'Physical', i: MapPin }, { k: 'online', l: 'Online', i: Video }, { k: 'hybrid', l: 'Hybrid', i: Globe }] as const)" :key="m.k" type="button" :class="cn('flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm', s.attendanceMode === m.k ? 'bg-brand-600 text-white' : 'text-ink-500 hover:text-ink-900')" @click="s.attendanceMode = m.k; markDirty()"><component :is="m.i" class="h-4 w-4" />{{ m.l }}</button>
          </div>
          <div v-if="s.attendanceMode !== 'online'" class="overflow-hidden rounded-2xl border border-ink-100">
            <p class="flex items-center gap-2 bg-success-50 px-4 py-2.5 text-sm text-ink-700"><MapPin class="h-4 w-4 text-success-500" />Physical</p>
            <div class="space-y-3 p-4">
              <UiInput v-model="s.venue.name" label="Venue Name" placeholder="Enter venue name" :error="errors[`s${i}.venue.name`]" />
              <div class="grid gap-3 sm:grid-cols-2"><UiSelect v-model="s.venue.state" label="State" placeholder="Select state" :options="NIGERIAN_STATES.map((x) => ({ label: x, value: x }))" :error="errors[`s${i}.venue.state`]" /><UiInput v-model="s.venue.city" label="City" placeholder="Port Harcourt" /></div>
              <UiInput v-model="s.venue.address" label="Address" placeholder="Enter physical address" :error="errors[`s${i}.venue.address`]" hint="Guests get directions from this address" />
            </div>
          </div>
          <div v-if="s.attendanceMode !== 'physical'" class="overflow-hidden rounded-2xl border border-ink-100">
            <p class="flex items-center gap-2 bg-brand-50 px-4 py-2.5 text-sm text-ink-700"><Video class="h-4 w-4 text-brand-600" />Online</p>
            <div class="space-y-3 p-4">
              <UiSelect v-model="s.online.platform" label="Platform" placeholder="Select platform" :options="PLATFORMS.map((p) => ({ label: p.label, value: p.value }))" :error="errors[`s${i}.online.platform`]" />
              <UiInput v-model="s.online.link" type="url" label="Platform link" placeholder="Paste platform link here" :error="errors[`s${i}.online.link`]" hint="Only ticket holders see this link" />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: sub-events -->
      <div v-else-if="step === 2" class="mt-6">
        <div v-if="!canUseSubEvents" class="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-card">
          <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600"><Lock class="h-6 w-6" /></span>
          <h2 class="mt-4 text-xl">Sub-events are a Premium feature</h2>
          <p class="mt-2 text-sm text-ink-500">Add cocktail hours, after-parties or breakout sessions inside your main event, each with its own approval rules.</p>
          <div class="mt-6 flex justify-center gap-3"><UiButton :to="{ name: 'pricing' }"><Sparkles class="h-4 w-4" />Upgrade</UiButton><UiButton variant="outline" @click="next">Skip for now</UiButton></div>
        </div>
        <template v-else>
          <div class="flex items-center justify-between"><div><h2 class="font-medium">Sub-events</h2><p class="text-xs text-ink-500">Optional activities that happen within your event.</p></div><UiButton variant="soft" size="sm" @click="openSub(null)"><Plus class="h-4 w-4" />Add sub-event</UiButton></div>
          <UiEmptyState v-if="!draft.subEvents.length" title="No sub-events" description="Skip this step if your event has a single programme." compact />
          <div v-else class="mt-4 space-y-3"><div v-for="(s, i) in draft.subEvents" :key="i" class="card flex items-center gap-3 p-4"><img v-if="s.coverUrl" :src="s.coverUrl" alt="" class="h-14 w-14 rounded-lg object-cover" /><div class="min-w-0 flex-1"><p class="font-medium">{{ s.title }}</p><p class="text-xs text-ink-500">{{ draft.schedules[s.scheduleIndex]?.label ?? `Day ${s.scheduleIndex + 1}` }} · {{ s.startTime }}{{ s.endTime ? `–${s.endTime}` : '' }} · {{ s.isIncludedInBundle ? 'Included' : 'Separate' }}{{ s.requiresApproval ? ' · Approval required' : '' }}</p></div><button type="button" class="p-2" aria-label="Edit" @click="openSub(i)"><Pencil class="h-4 w-4" /></button><button type="button" class="p-2 text-danger-500" aria-label="Delete" @click="draft.subEvents.splice(i, 1); markDirty()"><Trash2 class="h-4 w-4" /></button></div></div>
        </template>
      </div>

      <!-- Step 4: tickets -->
      <div v-else-if="step === 3" class="mt-6 space-y-4">
        <div class="card p-5"><UiToggle v-model="draft.isFree" label="This is a free event" /></div>
        <div class="flex items-center gap-2"><span>Ticket Type</span><span class="rounded-lg border border-ink-200 px-2 py-0.5 text-sm text-ink-500">₦</span></div>
        <button type="button" class="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-600 py-5 font-medium text-brand-600 hover:bg-brand-50" @click="openTicket(null)"><Plus class="h-5 w-5" />Add Ticket Type</button>
        <p v-if="errors.tickets" class="text-sm text-danger-500">{{ errors.tickets }}</p>
        <template v-if="draft.tickets.length">
          <p>Ticket Type <span class="text-sm text-ink-500">· {{ totalSlots.toLocaleString() }} total slots</span></p>
          <div v-for="(t, i) in draft.tickets" :key="i" class="card flex items-start justify-between gap-4 p-4">
            <div><p>{{ t.name }} <span v-if="t.isEarlyBird" class="ml-1 rounded-full bg-pink-100 px-2 py-0.5 text-[11px] text-pink-600">Early bird</span></p><p class="mt-1">{{ draft.isFree ? 'Free' : formatMoney(t.price) }} - {{ t.quantity.toLocaleString() }}slots</p><p class="text-sm text-ink-500">Sales end: {{ t.salesEndAt ? formatDate(t.salesEndAt) : '—' }}<template v-if="t.seatSelection"> · Seat selection</template><template v-if="t.menuSelection"> · Menu</template></p></div>
            <div class="flex gap-1"><button type="button" class="p-2" aria-label="Edit ticket" @click="openTicket(i)"><Pencil class="h-5 w-5" /></button><button type="button" class="p-2" aria-label="Delete ticket" @click="removeTicket(i)"><Trash2 class="h-5 w-5" /></button></div>
          </div>
        </template>
      </div>

      <!-- Step 5: assets -->
      <div v-else-if="step === 4" class="mt-6 space-y-6">
        <p v-if="!hasPhysical" class="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">Hall layouts and menus apply to physical events. This event is online only, so you can skip this step.</p>
        <section>
          <div class="flex items-center justify-between"><h2 class="font-medium">Hall layout</h2><UiButton variant="link" size="sm" :to="{ name: 'planner.hall' }">Create in Pluz planner</UiButton></div>
          <p class="text-xs text-ink-500">Guests with seat-selection tickets choose seats on this layout.</p>
          <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <button v-for="h in layouts" :key="h.id" type="button" :class="cn('card overflow-hidden text-left', draft.hallLayoutId === h.id && 'ring-2 ring-brand-600')" @click="draft.hallLayoutId = draft.hallLayoutId === h.id ? null : h.id; markDirty()"><img :src="h.thumbnailUrl ?? ''" alt="" class="aspect-[4/3] w-full bg-ink-100 object-cover" /><div class="p-3"><p class="font-medium">{{ h.name }}</p><p class="text-xs text-ink-500">{{ h.totalSeats }} seats</p></div></button>
            <RouterLink v-if="!layouts.length" :to="{ name: 'planner.hall' }" class="card flex aspect-[4/3] flex-col items-center justify-center gap-2 border-dashed text-sm text-ink-500"><Plus class="h-5 w-5" />Add hall layout</RouterLink>
          </div>
        </section>
        <section>
          <div class="flex items-center justify-between"><h2 class="font-medium">Menu</h2><UiButton variant="link" size="sm" :to="{ name: 'planner.menu' }">Create menu</UiButton></div>
          <p class="text-xs text-ink-500">Guests can pre-order food during checkout.</p>
          <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <button v-for="m in menus" :key="m.id" type="button" :class="cn('card p-4 text-left', draft.menuId === m.id && 'ring-2 ring-brand-600')" @click="draft.menuId = draft.menuId === m.id ? null : m.id; markDirty()"><p class="font-medium">{{ m.name }}</p><p class="text-xs text-ink-500">{{ m.sections.reduce((a, s) => a + s.items.length, 0) }} dishes</p></button>
            <RouterLink v-if="!menus.length" :to="{ name: 'planner.menu' }" class="card flex flex-col items-center justify-center gap-2 border-dashed p-6 text-sm text-ink-500"><Plus class="h-5 w-5" />Add menu</RouterLink>
          </div>
        </section>
      </div>

      <!-- Step 6: organizer -->
      <div v-else class="mt-6 max-w-2xl space-y-4">
        <UiInput v-model="draft.organizer.displayName" label="Organizer name" :error="errors['organizer.displayName']" />
        <UiTextarea v-model="draft.organizer.bio" label="About the organizer" :rows="3" :maxlength="500" placeholder="Meet the mastermind behind the event" />
        <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="draft.organizer.contactEmail" type="email" label="Contact email" :error="errors['organizer.contactEmail']" /><UiInput v-model="draft.organizer.contactPhone" type="tel" label="Contact phone" /></div>
        <p class="text-xs text-ink-500">Contact details are shown to ticket holders and used for refund disputes.</p>
      </div>

      <div class="mt-8 flex justify-end rounded-full border border-ink-100 p-3 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.15)]">
        <UiButton v-if="step > 0" variant="ghost" size="lg" class="mr-auto" @click="step--">Back</UiButton>
        <UiButton size="lg" class="min-w-[220px] sm:min-w-[340px]" :loading="saving" @click="next">{{ step === steps.length - 1 ? 'Preview' : 'Continue' }} <ChevronRight class="h-4 w-4" /></UiButton>
      </div>
    </template>

    <!-- ticket modal -->
    <UiModal v-model:open="ticketOpen" :title="ticketEditIndex === null ? 'Add ticket' : 'Edit ticket'">
      <div class="space-y-4">
        <UiInput v-model="ticketForm.name" label="Ticket name" placeholder="Early Birds Ticket" :error="ticketErrors.name" />
        <div class="grid grid-cols-2 gap-3">
          <UiMoneyInput v-if="!draft.isFree" v-model="ticketForm.price" label="Price" :error="ticketErrors.price" />
          <UiInput :model-value="ticketForm.quantity" type="number" min="1" label="Available slots" :error="ticketErrors.quantity" @update:model-value="ticketForm.quantity = Number($event) || 0" />
        </div>
        <div class="grid grid-cols-2 gap-3"><UiInput v-model="ticketForm.salesEndAt" type="date" label="Sales end" :error="ticketErrors.salesEndAt" /><UiInput :model-value="ticketForm.perOrderLimit" type="number" min="1" max="20" label="Max per order" @update:model-value="ticketForm.perOrderLimit = Number($event) || 1" /></div>
        <UiSelect v-if="draft.schedules.length > 1" :model-value="ticketForm.scheduleId ?? ''" label="Valid for" :options="[{ label: 'All days (bundle)', value: '' }, ...draft.schedules.filter((s) => s.id).map((s, i) => ({ label: s.label || `Day ${i + 1}`, value: s.id! }))]" @update:model-value="ticketForm.scheduleId = $event || null" />
        <UiTextarea v-model="ticketForm.description" label="Description (optional)" :rows="2" :maxlength="300" />
        <div class="space-y-3 rounded-2xl bg-ink-50 p-4"><UiToggle v-model="ticketForm.isEarlyBird" label="Early bird" size="sm" /><UiToggle v-model="ticketForm.seatSelection" label="Guests choose seats" description="Requires a hall layout in Assets" size="sm" /><UiToggle v-model="ticketForm.menuSelection" label="Guests pre-order food" description="Requires a menu in Assets" size="sm" /></div>
      </div>
      <template #footer><UiButton size="lg" block @click="saveTicket">{{ ticketEditIndex === null ? 'Add ticket' : 'Save ticket' }}</UiButton></template>
    </UiModal>

    <!-- sub-event modal -->
    <UiModal v-model:open="subOpen" :title="subEditIndex === null ? 'Add sub-event' : 'Edit sub-event'">
      <div class="space-y-4">
        <UiImageUploader v-model="subForm.coverUrl" purpose="sub_event_cover" aspect="video" />
        <UiInput v-model="subForm.title" label="Title" placeholder="Welcome cocktail" />
        <UiTextarea v-model="subForm.description" label="Description" :rows="2" />
        <UiSelect :model-value="String(subForm.scheduleIndex)" label="Day" :options="draft.schedules.map((s, i) => ({ label: s.label || `Day ${i + 1}${s.date ? ' · ' + s.date : ''}`, value: String(i) }))" @update:model-value="subForm.scheduleIndex = Number($event)" />
        <div class="grid grid-cols-2 gap-3"><UiInput v-model="subForm.startTime" type="time" label="Starts" /><UiInput v-model="subForm.endTime" type="time" label="Ends" /></div>
        <UiToggle v-model="subForm.isIncludedInBundle" label="Included with main ticket" size="sm" />
        <UiToggle v-model="subForm.requiresApproval" label="Requires approval" size="sm" />
      </div>
      <template #footer><UiButton size="lg" block @click="saveSub">Save sub-event</UiButton></template>
    </UiModal>
  </div>
</template>
