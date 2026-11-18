<script setup lang="ts">
import { ref, watch } from 'vue'
import { Save } from 'lucide-vue-next'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useAdminStore } from '@/stores/admin.store'
import { useUiStore } from '@/stores/ui.store'
import type { PlatformSettings } from '@/types'

const admin = useAdminStore()
const ui = useUiStore()
const { data, loading } = useAsync(() => adminApi.settings.get())
const s = ref<PlatformSettings | null>(null)
watch(data, (d) => (s.value = d ? structuredClone(d) : null))
const tab = ref<'general' | 'payments' | 'features' | 'app' | 'legal'>('general')
const saving = ref(false)
const canEdit = admin.can('settings.manage')
const featureLabels: Record<string, string> = { communities: 'Communities & group chat', liveStreams: 'Live sessions', pluzPlanner: 'Pluz planner', aiDesigns: 'AI cake & branding designs', eventPromotion: 'Event promotion (earn)', wallet: 'Wallet', subEvents: 'Sub-events', seatSelection: 'Seat selection', vendorPromos: 'Vendor promos', identityVerification: 'Identity verification' }

async function save(section: keyof PlatformSettings) {
  if (!s.value) return
  const sensitive = section === 'payments' || (section === 'general' && s.value.general.maintenanceMode !== data.value?.general.maintenanceMode)
  if (sensitive && !(await ui.confirm({ title: 'Apply changes to all clients?', description: 'Payment and maintenance changes take effect immediately for web, Android and iOS users.', confirmLabel: 'Apply' }))) return
  saving.value = true
  try {
    data.value = await adminApi.settings.update({ [section]: s.value[section] } as Partial<PlatformSettings>)
    ui.success('Settings saved')
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AdminPageHeader title="Platform settings" description="Configuration served to all clients via GET /config.">
      <UiButton variant="outline" size="sm" rounded="xl" :to="{ name: 'admin.banners' }">Banners</UiButton>
      <UiButton variant="outline" size="sm" rounded="xl" :to="{ name: 'admin.content' }">Content pages</UiButton>
    </AdminPageHeader>
    <UiSpinner v-if="loading || !s" page />
    <template v-else>
      <UiTabs v-model="tab" class="mb-6" :tabs="[{ key: 'general', label: 'General' }, { key: 'payments', label: 'Payments' }, { key: 'features', label: 'Features' }, { key: 'app', label: 'Mobile apps' }, { key: 'legal', label: 'Legal' }]" />
      <fieldset :disabled="!canEdit" class="max-w-3xl">
        <div v-if="tab === 'general'" class="card space-y-4 p-6">
          <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="s.general.platformName" label="Platform name" /><UiSelect v-model="s.general.defaultCurrency" label="Default currency" :options="['NGN', 'USD', 'GBP', 'EUR'].map((c) => ({ label: c, value: c }))" /></div>
          <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="s.general.supportEmail" type="email" label="Support email" /><UiInput v-model="s.general.supportPhone" label="Support phone" /></div>
          <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="s.general.supportWhatsapp" label="Support WhatsApp" /><UiInput v-model="s.general.timezone" label="Timezone" /></div>
          <div class="rounded-2xl border border-danger-500/30 bg-danger-50/50 p-4"><UiToggle v-model="s.general.maintenanceMode" label="Maintenance mode" description="Blocks purchases and logins on all clients and shows a maintenance banner. Admin console stays available." /></div>
          <div class="flex justify-end"><UiButton :loading="saving" @click="save('general')"><Save class="h-4 w-4" />Save</UiButton></div>
        </div>
        <div v-else-if="tab === 'payments'" class="card space-y-5 p-6">
          <div><p class="label">Enabled providers</p><div class="grid gap-2 sm:grid-cols-3"><UiCheckbox v-for="p in (['paystack', 'stripe', 'paypal', 'monnify', 'wallet'] as const)" :key="p" :model-value="s.payments.enabledProviders.includes(p)" :label="p[0]!.toUpperCase() + p.slice(1)" @update:model-value="(v) => s && (s.payments.enabledProviders = v ? [...s.payments.enabledProviders, p] : s.payments.enabledProviders.filter((x) => x !== p))" /></div><p class="mt-2 text-xs text-ink-500">API keys and webhook secrets are configured in the backend environment, never here.</p></div>
          <UiSelect v-model="s.payments.defaultProvider" label="Default card provider" :options="s.payments.enabledProviders.filter((p) => p !== 'wallet').map((p) => ({ label: p, value: p }))" />
          <div class="grid gap-4 sm:grid-cols-2"><UiInput :model-value="s.payments.serviceFeePercent" type="number" step="0.1" label="Buyer service fee %" @update:model-value="s.payments.serviceFeePercent = Number($event)" /><UiMoneyInput v-model="s.payments.serviceFeeFixed" label="Fixed service fee" /></div>
          <UiToggle v-model="s.payments.passFeesToBuyer" label="Pass gateway fees to buyer" />
          <div class="grid gap-4 sm:grid-cols-2"><UiInput :model-value="s.payments.refundWindowHours" type="number" label="Refund window (hours before event)" @update:model-value="s.payments.refundWindowHours = Number($event)" /><UiInput :model-value="s.payments.settlementDelayDays" type="number" label="Settlement delay (days after event)" @update:model-value="s.payments.settlementDelayDays = Number($event)" /></div>
          <div class="grid gap-4 sm:grid-cols-2"><UiMoneyInput v-model="s.payments.minWithdrawal" label="Min wallet withdrawal" /><UiMoneyInput v-model="s.payments.maxWithdrawal" label="Max wallet withdrawal / day" /></div>
          <p class="text-xs text-ink-500">Commission rates are managed in Finance → Commissions.</p>
          <div class="flex justify-end"><UiButton :loading="saving" @click="save('payments')"><Save class="h-4 w-4" />Save</UiButton></div>
        </div>
        <div v-else-if="tab === 'features'" class="card divide-y divide-ink-100">
          <div v-for="(label, key) in featureLabels" :key="key" class="p-5"><UiToggle :model-value="!!s.features[key]" :label="label" @update:model-value="s.features[key] = $event" /></div>
          <div class="flex justify-end p-5"><UiButton :loading="saving" @click="save('features')"><Save class="h-4 w-4" />Save</UiButton></div>
        </div>
        <div v-else-if="tab === 'app'" class="card space-y-4 p-6">
          <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="s.app.minAndroidVersion" label="Minimum Android version" /><UiInput v-model="s.app.minIosVersion" label="Minimum iOS version" /></div>
          <UiToggle v-model="s.app.forceUpdate" label="Force update below minimum version" description="Users on older app versions are blocked until they update." />
          <UiInput v-model="s.app.androidStoreUrl" label="Google Play URL" />
          <UiInput v-model="s.app.iosStoreUrl" label="App Store URL" />
          <div class="flex justify-end"><UiButton :loading="saving" @click="save('app')"><Save class="h-4 w-4" />Save</UiButton></div>
        </div>
        <div v-else class="card space-y-4 p-6">
          <UiInput v-model="s.legal.termsUrl" label="Terms URL" />
          <UiInput v-model="s.legal.privacyUrl" label="Privacy policy URL" />
          <p class="text-sm text-ink-500">Edit the text itself under <RouterLink :to="{ name: 'admin.content' }" class="text-brand-600 underline">Content pages</RouterLink>. Publishing new terms updates the “last updated” date shown to users.</p>
          <div class="flex justify-end"><UiButton :loading="saving" @click="save('legal')"><Save class="h-4 w-4" />Save</UiButton></div>
        </div>
      </fieldset>
      <p v-if="!canEdit" class="mt-3 text-sm text-ink-500">You have read-only access to settings.</p>
    </template>
  </div>
</template>
