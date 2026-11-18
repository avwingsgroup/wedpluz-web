<script setup lang="ts">
import { reactive, watch } from 'vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiRadioGroup from '@/components/ui/UiRadioGroup.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import type { EventFilters } from '@/types'

const props = defineProps<{ open: boolean; filters: EventFilters }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; apply: [filters: Partial<EventFilters>] }>()

const local = reactive<Required<Pick<EventFilters, 'dateFrom' | 'dateTo' | 'timeOfDay' | 'attendanceMode' | 'distanceKm' | 'freeOnly'>>>({ dateFrom: '', dateTo: '', timeOfDay: 'any', attendanceMode: 'any', distanceKm: 150, freeOnly: false })
watch(
  () => props.open,
  (o) => {
    if (o) Object.assign(local, { dateFrom: props.filters.dateFrom ?? '', dateTo: props.filters.dateTo ?? '', timeOfDay: props.filters.timeOfDay ?? 'any', attendanceMode: props.filters.attendanceMode ?? 'any', distanceKm: props.filters.distanceKm ?? 150, freeOnly: props.filters.freeOnly ?? false })
  },
)
function reset() {
  Object.assign(local, { dateFrom: '', dateTo: '', timeOfDay: 'any', attendanceMode: 'any', distanceKm: 150, freeOnly: false })
}
function apply() {
  emit('apply', { ...local })
  emit('update:open', false)
}
</script>

<template>
  <UiDrawer :open="open" title="Filter" size="sm" @update:open="emit('update:open', $event)">
    <div class="space-y-6">
      <section>
        <h3 class="mb-3 font-semibold">Date</h3>
        <div class="grid grid-cols-2 gap-3">
          <UiInput v-model="local.dateFrom" type="date" label="Start date" />
          <UiInput v-model="local.dateTo" type="date" label="End date" :min="local.dateFrom || undefined" />
        </div>
      </section>
      <section>
        <h3 class="mb-1 font-semibold">Time of Day</h3>
        <UiRadioGroup v-model="local.timeOfDay as string" :options="[{ label: 'Any Time', value: 'any' }, { label: 'Morning', value: 'morning', description: 'Starts before 12:00' }, { label: 'Afternoon', value: 'afternoon', description: 'Starts after 12:00' }, { label: 'Evening', value: 'evening', description: 'Starts after 17:00' }]" @update:model-value="local.timeOfDay = $event as typeof local.timeOfDay" />
      </section>
      <section>
        <h3 class="mb-1 font-semibold">Venue</h3>
        <UiRadioGroup :model-value="local.attendanceMode as string" :options="[{ label: 'Any Venue', value: 'any' }, { label: 'In Person', value: 'physical' }, { label: 'Online', value: 'online' }]" @update:model-value="local.attendanceMode = $event as typeof local.attendanceMode" />
      </section>
      <section>
        <h3 class="mb-3 font-semibold">Distance</h3>
        <div class="flex justify-between text-sm text-ink-500"><span>5km</span><span>{{ local.distanceKm }}km</span></div>
        <input v-model.number="local.distanceKm" type="range" min="5" max="150" step="5" class="mt-2 w-full accent-brand-600" aria-label="Distance in kilometres" />
      </section>
      <section>
        <h3 class="mb-3 font-semibold">Ticket Price</h3>
        <UiToggle v-model="local.freeOnly" label="Show only free events" />
      </section>
    </div>
    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <UiButton variant="link" class="text-ink-500" @click="reset">Reset</UiButton>
        <UiButton size="lg" class="min-w-[220px]" @click="apply">Apply Filters</UiButton>
      </div>
    </template>
  </UiDrawer>
</template>
