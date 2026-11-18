<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import { downloadCsv } from '@/utils/files'
import { useUiStore } from '@/stores/ui.store'

/**
 * Exports the currently loaded rows to CSV client-side. Large/complete exports (xlsx/pdf,
 * all pages) go through the async export job endpoint on the Reports page.
 */
const props = defineProps<{ rows: Record<string, unknown>[]; filename: string; map?: (row: Record<string, unknown>) => Record<string, unknown> }>()
const ui = useUiStore()
function exportCsv() {
  if (!props.rows.length) return ui.info('Nothing to export')
  downloadCsv(props.rows.map((r) => (props.map ? props.map(r) : r)), `${props.filename}-${new Date().toISOString().slice(0, 10)}.csv`)
}
</script>

<template>
  <UiDropdown :items="[{ label: 'Export current page (CSV)', onClick: exportCsv }, { label: 'Full export (XLSX / PDF)', description: 'From Reports & analytics', onClick: () => $router.push({ name: 'admin.reports' }) }]" width="w-64">
    <template #trigger><UiButton variant="outline" size="sm" rounded="xl"><Download class="h-4 w-4" />Export</UiButton></template>
  </UiDropdown>
</template>
