<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { organizerApi } from '@/services/api/organizer.api'
import type { EventManager, EventVendorAssignment } from '@/types'

const route = useRoute()
const router = useRouter()
const id = String(route.params.id)
const managers = ref<EventManager[]>([])
const vendors = ref<EventVendorAssignment[]>([])
const loading = ref(true)
onMounted(async () => {
  try {
    ;[managers.value, vendors.value] = await Promise.all([organizerApi.managers(id), organizerApi.vendors(id)])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container-app max-w-3xl pb-10 pt-10">
    <UiBackButton :to="{ name: 'manage.overview', params: { id } }" />
    <h1 class="mt-6 text-3xl">Collaborators</h1>
    <p class="mt-1 text-sm text-ink-500">Everyone helping run this event. Declined invites stay here so you can re-invite.</p>
    <div v-if="loading" class="mt-6 space-y-3"><UiSkeleton v-for="i in 4" :key="i" class="h-16 rounded-2xl" /></div>
    <template v-else>
      <UiEmptyState v-if="!managers.length && !vendors.length" title="No collaborators yet" description="Invite managers and vendors from the Manage Event tabs." compact><div class="flex gap-2"><UiButton :to="{ name: 'manage.managers', params: { id } }">Add managers</UiButton><UiButton variant="outline" :to="{ name: 'manage.vendors', params: { id } }">Add vendors</UiButton></div></UiEmptyState>
      <h2 v-if="managers.length" class="mt-8 font-medium">Managers</h2>
      <div class="mt-3 space-y-2"><div v-for="m in managers" :key="m.id" class="card flex items-center gap-3 p-3"><UiAvatar :src="m.user.avatarUrl" :name="m.user.displayName" /><div class="flex-1"><p>{{ m.user.displayName }}</p><p class="text-xs text-ink-500">{{ m.access === 'full' ? 'Full access' : 'Partial access' }}</p></div><UiBadge :status="m.status" size="sm" /></div></div>
      <h2 v-if="vendors.length" class="mt-8 font-medium">Vendors</h2>
      <div class="mt-3 space-y-2"><div v-for="v in vendors" :key="v.id" class="card flex items-center gap-3 p-3"><UiAvatar :src="v.vendor.avatarUrl" :name="v.vendor.businessName" /><div class="flex-1"><p>{{ v.vendor.businessName }}</p><p class="text-xs text-ink-500">{{ v.role ?? v.vendor.category }}</p></div><UiBadge :status="v.status" size="sm" /><UiButton v-if="v.status === 'declined'" size="xs" variant="soft" @click="router.push({ name: 'manage.vendors', params: { id } })">Re-invite</UiButton></div></div>
    </template>
  </div>
</template>
