<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Mail, RotateCcw } from 'lucide-vue-next'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDateTime, formatMoney } from '@/utils/format'

const route = useRoute()
const ui = useUiStore()
const id = computed(() => String(route.params.id))
const { data: b, loading, error, refresh } = useAsync(() => adminApi.bookings.get(id.value), { watch: id })
const refundOpen = ref(false)
const refundAmount = ref<number | null>(null)
const refundReason = ref('')
const busy = ref(false)

async function resend() {
  const r = await adminApi.bookings.resend(id.value).catch((e: Error) => ui.error(e.message))
  if (r) ui.success('Tickets re-sent', `Sent to ${b.value?.buyer.email}`)
}
function openRefund() {
  refundAmount.value = b.value?.total ?? null
  refundReason.value = ''
  refundOpen.value = true
}
async function refund() {
  if (!refundAmount.value || refundReason.value.trim().length < 5) return ui.error('Enter an amount and reason')
  if (!(await ui.confirm({ title: `Refund ${formatMoney(refundAmount.value)}?`, description: 'The refund is sent to the original payment method via the provider. This cannot be undone.', variant: 'danger', confirmLabel: 'Issue refund' }))) return
  busy.value = true
  try {
    await adminApi.bookings.refund(id.value, { amount: refundAmount.value, reason: refundReason.value })
    refundOpen.value = false
    ui.success('Refund initiated')
    void refresh()
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading || !b" page />
    <template v-else>
      <AdminPageHeader :title="b.reference" :back="{ name: 'admin.bookings' }">
        <template #meta><div class="mt-2 flex flex-wrap items-center gap-2"><UiBadge :status="b.status" /><span class="text-sm text-ink-500">{{ formatDateTime(b.createdAt) }} · {{ b.source.toUpperCase() }}</span></div></template>
        <Can perm="bookings.manage"><UiButton v-if="b.status === 'paid'" variant="outline" size="sm" @click="resend"><Mail class="h-4 w-4" />Resend tickets</UiButton></Can>
        <Can perm="refunds.approve"><UiButton v-if="b.status === 'paid' && b.total > 0" variant="danger" size="sm" @click="openRefund"><RotateCcw class="h-4 w-4" />Refund</UiButton></Can>
      </AdminPageHeader>
      <div v-if="b.dispute" class="mb-4 rounded-2xl border border-danger-500/40 bg-danger-50 p-4 text-sm"><strong class="capitalize">{{ b.dispute.type.replace(/_/g, ' ') }} dispute ({{ b.dispute.status.replace(/_/g, ' ') }}):</strong> {{ b.dispute.description }} <RouterLink :to="{ name: 'admin.disputes' }" class="text-brand-600 underline">Manage disputes</RouterLink></div>
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section class="space-y-6">
          <div class="card flex items-center gap-4 p-4"><img :src="b.event.coverUrl" alt="" class="h-16 w-16 rounded-lg object-cover" /><div class="min-w-0 flex-1"><p class="font-semibold">{{ b.event.title }}</p><p class="text-sm text-ink-500">{{ formatDateTime(b.event.startsAt) }}</p></div><UiButton size="xs" variant="soft" :to="{ name: 'admin.event', params: { id: b.event.id } }">Event</UiButton></div>
          <div class="card"><h3 class="border-b border-ink-100 px-5 py-3 font-semibold">Tickets ({{ b.tickets.length }})</h3><div class="overflow-x-auto"><table class="w-full text-sm"><tbody class="divide-y divide-ink-100"><tr v-for="t in b.tickets" :key="t.id"><td class="px-5 py-3 font-mono text-xs">{{ t.code }}</td><td class="px-5 py-3">{{ t.holderName }}</td><td class="px-5 py-3"><UiBadge :status="t.status" size="sm" /></td><td class="px-5 py-3 text-right text-xs text-ink-500">{{ t.checkedInAt ? formatDateTime(t.checkedInAt) : '' }}</td></tr></tbody></table></div></div>
          <div class="card p-5"><h3 class="font-semibold">Timeline</h3><ol class="mt-4 space-y-4 border-l border-ink-200 pl-5"><li v-for="(e, i) in b.timeline" :key="i" class="relative"><span class="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-brand-600 ring-4 ring-white" /><p class="text-sm">{{ e.label }}</p><p class="text-xs text-ink-500">{{ formatDateTime(e.at) }} · {{ e.by }}</p></li></ol></div>
        </section>
        <aside class="space-y-4">
          <KeyValueList title="Buyer" :items="[{ label: 'Name', value: b.buyer.displayName }, { label: 'Email', value: b.buyer.email }]"><div class="py-3 text-right"><RouterLink :to="{ name: 'admin.user', params: { id: b.buyer.id } }" class="text-sm text-brand-600 hover:underline">Open user</RouterLink></div></KeyValueList>
          <KeyValueList title="Payment" :items="[{ label: 'Subtotal', value: formatMoney(b.total - b.serviceFee) }, { label: 'Service fee', value: formatMoney(b.serviceFee) }, { label: 'Total', value: formatMoney(b.total) }, { label: 'Method', value: b.paymentMethod }, { label: 'Provider', value: b.provider }, { label: 'Provider ref', value: b.providerReference, mono: true }, { label: 'Checked in', value: `${b.checkedInCount} of ${b.ticketsCount}` }]" />
        </aside>
      </div>
      <UiModal v-model:open="refundOpen" title="Issue refund" size="sm">
        <div class="space-y-4"><UiMoneyInput v-model="refundAmount" label="Amount" :hint="`Max ${formatMoney(b.total)}. Partial refunds allowed.`" /><UiTextarea v-model="refundReason" label="Reason (internal & customer)" :rows="3" /></div>
        <template #footer><UiButton variant="danger" block :loading="busy" @click="refund">Continue</UiButton></template>
      </UiModal>
    </template>
  </div>
</template>
