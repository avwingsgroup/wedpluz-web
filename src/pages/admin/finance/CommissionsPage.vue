<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Pencil, Plus } from 'lucide-vue-next'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDate, formatMoney } from '@/utils/format'
import type { CommissionRule } from '@/types'

const ui = useUiStore()
const { data, loading, refresh } = useAsync(() => adminApi.finance.commissions())
const { data: categories } = useAsync(() => adminApi.events.categories())
const editing = ref<CommissionRule | null>(null)
const creating = ref(false)
const form = reactive({ percent: '', fixedFee: 0 as number | null, scope: 'category' as 'category' | 'organizer', scopeId: '' })

function startCreate() {
  Object.assign(form, { percent: '', fixedFee: 0, scope: 'category', scopeId: '' })
  creating.value = true
}
function edit(r: CommissionRule) {
  editing.value = r
  Object.assign(form, { percent: String(r.percent), fixedFee: r.fixedFee })
}
async function save() {
  const percent = Number(form.percent)
  if (Number.isNaN(percent) || percent < 0 || percent > 30) return ui.error('Commission must be between 0% and 30%')
  if (!(await ui.confirm({ title: 'Change commission?', description: 'New rates apply to tickets sold after saving. Existing settlements are not recalculated. This change is audit-logged.', confirmLabel: 'Save rate' }))) return
  try {
    if (editing.value) await adminApi.finance.updateCommission(editing.value.id, { percent, fixedFee: form.fixedFee ?? 0 })
    else {
      const cat = categories.value?.find((c) => c.id === form.scopeId)
      await adminApi.finance.createCommission({ scope: form.scope, scopeId: form.scopeId, scopeLabel: cat?.name ?? form.scopeId, percent, fixedFee: form.fixedFee ?? 0 })
    }
    editing.value = null
    creating.value = false
    ui.success('Commission saved')
    void refresh()
  } catch (e) {
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div>
    <AdminPageHeader title="Commission rules" description="Resolution order: organizer override → category → platform default." :back="{ name: 'admin.finance' }"><Can perm="finance.commission.manage"><UiButton size="sm" @click="startCreate"><Plus class="h-4 w-4" />Category rule</UiButton></Can></AdminPageHeader>
    <UiDataTable :columns="[{ key: 'scopeLabel', label: 'Applies to' }, { key: 'scope', label: 'Scope' }, { key: 'percent', label: 'Commission', align: 'right' }, { key: 'fixedFee', label: 'Fixed fee / ticket', align: 'right' }, { key: 'updated', label: 'Last change', hideBelow: 'md' }, { key: 'actions', label: '', align: 'right' }]" :rows="data ?? []" :loading="loading">
      <template #cell-scope="{ row }"><UiBadge :tone="row.scope === 'platform' ? 'plum' : row.scope === 'category' ? 'brand' : 'info'" size="sm">{{ row.scope }}</UiBadge></template>
      <template #cell-percent="{ row }"><span class="font-semibold">{{ row.percent }}%</span></template>
      <template #cell-fixedFee="{ row }">{{ formatMoney(row.fixedFee) }}</template>
      <template #cell-updated="{ row }"><span class="text-xs text-ink-500">{{ formatDate(row.updatedAt) }} · {{ row.updatedBy ? `${row.updatedBy.firstName} ${row.updatedBy.lastName}` : 'System' }}</span></template>
      <template #cell-actions="{ row }"><Can perm="finance.commission.manage"><button type="button" class="p-2" aria-label="Edit rule" @click="edit(row)"><Pencil class="h-4 w-4" /></button></Can></template>
    </UiDataTable>
    <p class="mt-3 text-xs text-ink-500">Organizer-specific rates are set from the organizer’s profile.</p>
    <UiModal :open="!!editing || creating" :title="editing ? `Edit: ${editing.scopeLabel}` : 'New category rule'" size="sm" @update:open="editing = null; creating = false">
      <div class="space-y-4">
        <UiSelect v-if="creating" v-model="form.scopeId" label="Category" placeholder="Choose category" :options="(categories ?? []).map((c) => ({ label: c.name, value: c.id }))" />
        <UiInput v-model="form.percent" label="Commission %" inputmode="decimal" />
        <UiMoneyInput v-model="form.fixedFee" label="Fixed fee per paid ticket" />
      </div>
      <template #footer><UiButton block @click="save">Save</UiButton></template>
    </UiModal>
  </div>
</template>
