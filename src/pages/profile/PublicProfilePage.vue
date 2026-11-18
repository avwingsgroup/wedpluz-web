<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BadgeCheck, Flag, MapPin, MessageCircle } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import EventGrid from '@/modules/events/EventGrid.vue'
import ReportDialog from '@/modules/community/ReportDialog.vue'
import { accountApi } from '@/services/api/account.api'
import { eventsApi } from '@/services/api/events.api'
import { messagingApi } from '@/services/api/messaging.api'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const id = computed(() => String(route.params.id))
const { data: profile, loading, error, refresh } = useAsync(() => accountApi.publicProfile(id.value), { watch: id })
const { data: events, loading: eventsLoading } = useAsync(() => eventsApi.list({ perPage: 8 }).then((r) => r.data.filter((e) => e.organizer.id === id.value)), { watch: id })
const reportOpen = ref(false)
const messaging = ref(false)

async function message() {
  if (!auth.isAuthenticated) return router.push({ name: 'auth.login', query: { redirect: route.fullPath } })
  messaging.value = true
  try {
    const c = await messagingApi.start(id.value)
    router.push({ name: 'messages', params: { id: c.id } })
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    messaging.value = false
  }
}
</script>

<template>
  <ErrorState v-if="error" :error="error" class="container-app" @retry="refresh" />
  <UiSpinner v-else-if="loading || !profile" page />
  <div v-else>
    <div class="brand-pattern h-48" />
    <div class="relative -mt-12 flex flex-col items-center border-b border-ink-200 pb-8 text-center">
      <UiAvatar :src="profile.avatarUrl" :name="profile.displayName" size="2xl" class="rounded-full ring-4 ring-white" />
      <h1 class="mt-3 flex items-center gap-1.5 text-xl font-semibold">{{ profile.displayName }}<BadgeCheck v-if="profile.isVerified" class="h-5 w-5 fill-success-500 text-white" /></h1>
      <p v-if="profile.username" class="text-sm text-ink-500">@{{ profile.username }}</p>
      <p class="mt-1 flex items-center gap-1 text-sm text-ink-500"><MapPin v-if="profile.city" class="h-3.5 w-3.5" />{{ profile.city }} · Joined {{ formatDate(profile.joinedAt) }}</p>
      <div v-if="auth.user?.id !== profile.id" class="mt-4 flex gap-2"><UiButton :loading="messaging" @click="message"><MessageCircle class="h-4 w-4" />Message</UiButton><UiButton v-if="auth.isAuthenticated" variant="outline" @click="reportOpen = true"><Flag class="h-4 w-4" />Report</UiButton></div>
    </div>
    <div class="container-app py-10">
      <h2 class="mb-4 text-xl">Events by {{ profile.displayName }}</h2>
      <EventGrid :events="events ?? []" :loading="eventsLoading" empty-title="No public events yet" />
    </div>
    <ReportDialog v-model:open="reportOpen" target-type="user" :target-id="profile.id" allow-block />
  </div>
</template>
