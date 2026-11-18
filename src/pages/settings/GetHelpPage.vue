<script setup lang="ts">
import { CircleHelp } from 'lucide-vue-next'
import SupportForm from '@/modules/support/SupportForm.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import { accountApi } from '@/services/api/account.api'
import { useAsync } from '@/composables/useAsync'
import { formatDate } from '@/utils/format'
const { data: tickets } = useAsync(() => accountApi.supportTickets())
</script>

<template>
  <div>
    <h2 class="text-3xl">Get Help</h2>
    <RouterLink :to="{ name: 'help' }" class="card mt-6 flex items-center gap-3 p-4 hover:shadow-card"><CircleHelp class="h-5 w-5 text-brand-600" /><div><p class="font-medium">Help center & FAQs</p><p class="text-sm text-ink-500">Quick answers to common questions</p></div></RouterLink>
    <h3 class="mt-8 mb-3 font-semibold">Contact us</h3>
    <SupportForm />
    <template v-if="tickets?.length">
      <h3 class="mt-10 mb-3 font-semibold">Your requests</h3>
      <div class="card divide-y divide-ink-100"><div v-for="t in tickets" :key="t.id" class="flex items-center justify-between p-4"><div><p class="font-medium">{{ t.subject }}</p><p class="text-xs text-ink-500">{{ t.reference }} · {{ formatDate(t.createdAt) }}</p></div><UiBadge :status="t.status" /></div></div>
    </template>
  </div>
</template>
