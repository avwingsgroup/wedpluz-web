<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { CircleCheck, Star } from 'lucide-vue-next'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useUiStore } from '@/stores/ui.store'

const props = defineProps<{ open: boolean; eventId: string }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; saved: [] }>()
const ui = useUiStore()
const loading = ref(false)
const saving = ref(false)
const done = ref(false)
const form = reactive({ enabled: false, commissionPercent: 10, useTarget: false, targetSignups: 50, useLimit: false, promoterLimit: 100, promotersCount: 0 })
const error = ref<string | null>(null)

watch(() => props.open, async (o) => {
  if (!o) return
  done.value = false
  loading.value = true
  try {
    const p = await organizerApi.promotion(props.eventId)
    Object.assign(form, { enabled: p.enabled, commissionPercent: p.commissionPercent || 10, useTarget: p.targetSignups !== null, targetSignups: p.targetSignups ?? 50, useLimit: p.promoterLimit !== null, promoterLimit: p.promoterLimit ?? 100, promotersCount: p.promotersCount })
  } finally {
    loading.value = false
  }
})
async function save() {
  error.value = null
  if (form.enabled && (form.commissionPercent < 1 || form.commissionPercent > 50)) {
    error.value = 'Set a commission between 1% and 50%'
    return
  }
  saving.value = true
  try {
    await organizerApi.updatePromotion(props.eventId, { enabled: form.enabled, commissionPercent: form.commissionPercent, targetSignups: form.useTarget ? form.targetSignups : null, promoterLimit: form.useLimit ? form.promoterLimit : null })
    emit('saved')
    if (form.enabled) done.value = true
    else {
      ui.success('Promotion turned off')
      emit('update:open', false)
    }
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer :open="open" title="Event Promotion" @update:open="emit('update:open', $event)">
    <UiSpinner v-if="loading" page />
    <div v-else-if="done" class="flex flex-col items-center py-16 text-center"><CircleCheck class="h-14 w-14 text-success-500" /><h3 class="mt-4 text-xl font-semibold">Promotion published</h3><p class="mt-1 max-w-sm text-sm text-ink-500">Premium members can now promote your event and earn {{ form.commissionPercent }}% on every ticket they sell.</p></div>
    <div v-else class="space-y-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm"><UiToggle v-model="form.enabled"><span class="flex items-center gap-2"><Star class="h-5 w-5" />Event Promotion</span></UiToggle><p class="ml-7 mt-1 text-sm text-ink-500">Allow others to promote this event and have more people sign up.</p></div>
      <template v-if="form.enabled">
        <p class="text-sm font-medium">Set Promotion conditions and publish</p>
        <div class="card flex items-center justify-between gap-4 p-4"><div><p>Commission per ticket sale</p><p class="text-sm text-ink-500">Promoters earn this percentage per sale for each ticket through their link.</p></div><label class="relative"><input v-model.number="form.commissionPercent" type="number" min="1" max="50" class="field w-24 pr-7 text-center" aria-label="Commission percent" /><span class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500">%</span></label></div>
        <p v-if="error" class="text-sm text-danger-500">{{ error }}</p>
        <div class="card space-y-3 p-4"><UiToggle v-model="form.useTarget" label="Target sign ups" description="Set the minimum sign-ups required for promoters to withdraw their earnings." /><input v-if="form.useTarget" v-model.number="form.targetSignups" type="number" min="1" class="field w-32" aria-label="Target sign ups" /></div>
        <div class="card space-y-3 p-4"><UiToggle v-model="form.useLimit" label="Limit promoter capacity" description="Set the maximum number of individuals allowed to promote this event." /><input v-if="form.useLimit" v-model.number="form.promoterLimit" type="number" min="1" class="field w-32" aria-label="Promoter limit" /></div>
        <p v-if="form.promotersCount" class="text-sm text-ink-500">{{ form.promotersCount }} people are promoting this event. Lowering the commission only affects new sales.</p>
      </template>
    </div>
    <template v-if="!loading" #footer>
      <UiButton v-if="done" block size="lg" :to="{ name: 'manage.promoters', params: { id: eventId } }">View promoters board</UiButton>
      <UiButton v-else block size="lg" :loading="saving" @click="save">{{ form.enabled ? 'Publish promotion' : 'Save' }}</UiButton>
    </template>
  </UiDrawer>
</template>
