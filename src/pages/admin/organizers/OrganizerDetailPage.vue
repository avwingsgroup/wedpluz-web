<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Ban, BadgeCheck, Percent, RotateCcw, X } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDate, formatMoney, formatNumber } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const id = computed(() => String(route.params.id))
const { data: o, loading, error, refresh } = useAsync(() => adminApi.organizers.get(id.value), { watch: id })
const tab = ref<'events' | 'settlements' | 'documents'>('events')
const commissionOpen = ref(false)
const commission = ref('')

async function act(action: 'verify' | 'reject' | 'suspend' | 'reactivate') {
  let reason: string | undefined
  if (action === 'reject' || action === 'suspend') {
    const r = await ui.prompt({ title: action === 'reject' ? 'Reject verification' : 'Suspend business', label: 'Reason (sent to the account holder)', variant: 'danger', confirmLabel: action === 'reject' ? 'Reject' : 'Suspend', minLength: 10, presets: action === 'reject' ? ['ID document unreadable', 'Selfie does not match ID', 'Business details could not be verified'] : ['Multiple customer complaints', 'Suspected fraud', 'Terms of service violation'] })
    if (!r) return
    reason = r
  } else if (!(await ui.confirm({ title: action === 'verify' ? 'Verify this business?' : 'Reactivate this business?', confirmLabel: action === 'verify' ? 'Verify' : 'Reactivate' }))) return
  await adminApi.organizers.act(id.value, action, reason)
  ui.success('Updated')
  void refresh()
}
async function saveCommission() {
  const v = commission.value.trim() === '' ? null : Number(commission.value)
  if (v !== null && (Number.isNaN(v) || v < 0 || v > 30)) return ui.error('Enter a value between 0 and 30, or leave blank for the default')
  await adminApi.organizers.setCommission(id.value, v)
  commissionOpen.value = false
  ui.success('Commission updated', 'Applies to new ticket sales only.')
  void refresh()
}
</script>

<template>
  <div>
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading || !o" page />
    <template v-else>
      <AdminPageHeader :title="o.businessName ?? o.user.displayName" :back="{ name: 'admin.organizers' }">
        <template #meta><div class="mt-2 flex flex-wrap gap-2"><UiBadge :status="o.identityStatus" /><UiBadge v-if="o.vendorStatus" :status="o.vendorStatus" /><span class="text-sm capitalize text-ink-500">{{ o.type }} · joined {{ formatDate(o.joinedAt) }}</span></div></template>
        <Can perm="finance.commission.manage"><UiButton variant="outline" size="sm" @click="commission = o.commissionPercent?.toString() ?? ''; commissionOpen = true"><Percent class="h-4 w-4" />Commission</UiButton></Can>
        <Can perm="organizers.verify"><template v-if="o.identityStatus !== 'verified'"><UiButton size="sm" @click="act('verify')"><BadgeCheck class="h-4 w-4" />Verify</UiButton><UiButton size="sm" variant="outline" @click="act('reject')"><X class="h-4 w-4" />Reject</UiButton></template></Can>
        <Can perm="organizers.manage"><UiButton v-if="o.vendorStatus === 'suspended'" size="sm" @click="act('reactivate')"><RotateCcw class="h-4 w-4" />Reactivate</UiButton><UiButton v-else-if="o.vendorStatus" size="sm" variant="danger" @click="act('suspend')"><Ban class="h-4 w-4" />Suspend</UiButton></Can>
      </AdminPageHeader>
      <div class="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside class="space-y-4">
          <div class="card flex items-center gap-3 p-4"><UiAvatar :src="o.user.avatarUrl" :name="o.user.displayName" size="lg" /><div class="min-w-0"><p class="font-semibold">{{ o.user.displayName }}</p><p class="truncate text-sm text-ink-500">{{ o.user.email }}</p><RouterLink :to="{ name: 'admin.user', params: { id: o.user.id } }" class="text-xs text-brand-600 hover:underline">Open user account</RouterLink></div></div>
          <KeyValueList title="Performance" :items="[{ label: 'Events', value: formatNumber(o.eventsCount) }, { label: 'Tickets sold', value: formatNumber(o.ticketsSold) }, { label: 'Gross revenue', value: formatMoney(o.grossRevenue) }, { label: 'Pending settlement', value: formatMoney(o.pendingSettlement) }, { label: 'Total paid out', value: formatMoney(o.totalPaidOut) }, { label: 'Commission', value: o.commissionPercent !== null ? `${o.commissionPercent}% (custom)` : 'Platform default' }, { label: 'Vendor rating', value: o.rating ?? '—' }]" />
          <KeyValueList v-if="o.vendorProfile" title="Vendor profile" :items="[{ label: 'Category', value: o.vendorProfile.category.name }, { label: 'Location', value: o.vendorProfile.location }, { label: 'Works', value: o.vendorProfile.worksCount }, { label: 'Reviews', value: o.vendorProfile.ratingsCount }]" />
        </aside>
        <section>
          <UiTabs v-model="tab" :tabs="[{ key: 'events', label: 'Events', count: o.events.length }, { key: 'settlements', label: 'Settlements', count: o.settlements.length }, { key: 'documents', label: 'Verification documents', count: o.verificationDocuments.length }]" />
          <div class="mt-4">
            <UiDataTable v-if="tab === 'events'" :columns="[{ key: 'title', label: 'Event' }, { key: 'status', label: 'Status' }, { key: 'ticketsSold', label: 'Tickets', align: 'right' }, { key: 'revenue', label: 'Revenue', align: 'right' }]" :rows="o.events" clickable empty-title="No events" @row-click="(r) => router.push({ name: 'admin.event', params: { id: r.id } })">
              <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template><template #cell-revenue="{ row }">{{ formatMoney(row.revenue, 'NGN', { compact: true }) }}</template>
            </UiDataTable>
            <UiDataTable v-else-if="tab === 'settlements'" :columns="[{ key: 'reference', label: 'Reference' }, { key: 'event', label: 'Event' }, { key: 'netPayable', label: 'Net payable', align: 'right' }, { key: 'status', label: 'Status' }]" :rows="o.settlements" empty-title="No settlements">
              <template #cell-event="{ row }">{{ row.event.title }}</template><template #cell-netPayable="{ row }">{{ formatMoney(row.netPayable) }}</template><template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
            </UiDataTable>
            <div v-else class="grid gap-4 sm:grid-cols-2"><p v-if="!o.verificationDocuments.length" class="text-sm text-ink-500">No documents submitted. Identity checks run automatically via the identity provider.</p><a v-for="d in o.verificationDocuments" :key="d.id" :href="d.url" target="_blank" rel="noopener noreferrer" class="card overflow-hidden"><img :src="d.url" alt="" class="aspect-video w-full object-cover" /><div class="flex justify-between p-3 text-sm"><span>{{ d.type }}</span><UiBadge :status="d.status" size="sm" /></div></a></div>
          </div>
        </section>
      </div>
      <UiModal v-model:open="commissionOpen" title="Custom commission" size="sm">
        <UiInput v-model="commission" label="Commission %" inputmode="decimal" placeholder="Leave blank for platform default" hint="Overrides category and platform rules for this organizer. Logged in the audit trail." />
        <template #footer><UiButton block @click="saveCommission">Save</UiButton></template>
      </UiModal>
    </template>
  </div>
</template>
