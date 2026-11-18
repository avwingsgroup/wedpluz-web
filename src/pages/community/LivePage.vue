<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Mic, MicOff, PhoneOff, Users, Video, VideoOff, Hand, Check, X } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiInput from '@/components/ui/UiInput.vue'
import { communityApi } from '@/services/api/community.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import type { Community, LiveRequest, LiveSession } from '@/types'
import { cn } from '@/utils/cn'

/**
 * Community live sessions. Media transport is delegated to a WebRTC SFU provider chosen by
 * the backend (e.g. LiveKit / Agora / Daily); the API returns a short-lived joinToken. Here we
 * capture local media for the host preview and wire the session lifecycle and requests.
 * See docs/backend-handoff/integrations.md §Live streaming (provider decision pending).
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const communityId = computed(() => String(route.params.id))
const community = ref<Community | null>(null)
const session = ref<LiveSession | null>(null)
const loading = ref(true)
const title = ref('')
const audioOn = ref(true)
const videoOn = ref(true)
const videoEl = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const requests = ref<LiveRequest[]>([])
const requestsOpen = ref(false)
const requested = ref(false)
const isHost = computed(() => !!session.value && session.value.host.id === auth.user?.id)
const canHost = computed(() => !!community.value && (community.value.myRole !== 'member' || community.value.permissions.membersCanGoLive))

onMounted(async () => {
  try {
    ;[community.value, session.value] = await Promise.all([communityApi.get(communityId.value), communityApi.live(communityId.value)])
    if (session.value && session.value.host.id !== auth.user?.id) await communityApi.joinLive(session.value.id)
    else if (canHost.value) await startPreview()
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
})
async function startPreview() {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    if (videoEl.value) videoEl.value.srcObject = stream.value
  } catch {
    videoOn.value = false
    ui.warning('Camera unavailable', 'You can still go live with audio only.')
  }
}
async function goLive() {
  try {
    session.value = await communityApi.startLive(communityId.value, { title: title.value || undefined, audioEnabled: audioOn.value, videoEnabled: videoOn.value })
    if (videoEl.value && stream.value) videoEl.value.srcObject = stream.value
    requests.value = await communityApi.liveRequests(session.value.id)
  } catch (e) {
    ui.error((e as Error).message)
  }
}
async function toggle(kind: 'audio' | 'video') {
  if (kind === 'audio') audioOn.value = !audioOn.value
  else videoOn.value = !videoOn.value
  stream.value?.getAudioTracks().forEach((t) => (t.enabled = audioOn.value))
  stream.value?.getVideoTracks().forEach((t) => (t.enabled = videoOn.value))
  if (session.value && isHost.value) session.value = await communityApi.updateLive(session.value.id, { audioEnabled: audioOn.value, videoEnabled: videoOn.value })
}
async function end() {
  if (session.value && isHost.value) {
    if (!(await ui.confirm({ title: 'End live session?', confirmLabel: 'End live', variant: 'danger' }))) return
    await communityApi.endLive(session.value.id)
  }
  leave()
}
function leave() {
  stream.value?.getTracks().forEach((t) => t.stop())
  router.push({ name: 'messages', params: { id: `cv_${communityId.value}` } })
}
async function requestToJoin() {
  if (!session.value) return
  await communityApi.requestToJoinLive(session.value.id)
  requested.value = true
  ui.success('Request sent to the host')
}
async function decide(r: LiveRequest, status: 'accepted' | 'declined') {
  if (!session.value) return
  const updated = await communityApi.decideLiveRequest(session.value.id, r.id, status)
  requests.value = requests.value.map((x) => (x.id === r.id ? updated : x))
}
onBeforeUnmount(() => stream.value?.getTracks().forEach((t) => t.stop()))
</script>

<template>
  <div class="container-app py-6">
    <UiSpinner v-if="loading" page />
    <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div class="relative aspect-video overflow-hidden rounded-3xl bg-brand-950">
        <video v-show="(isHost || !session) && videoOn" ref="videoEl" autoplay muted playsinline class="h-full w-full -scale-x-100 object-cover" />
        <div v-if="!videoOn || (session && !isHost)" class="absolute inset-0 flex flex-col items-center justify-center text-white">
          <UiAvatar :src="session?.host.avatarUrl ?? auth.user?.avatarUrl" :name="session?.host.displayName ?? auth.displayName" size="2xl" />
          <p class="mt-3 font-medium">{{ session?.host.displayName ?? auth.displayName }}</p>
          <p v-if="session && !isHost" class="mt-1 text-sm text-white/70">Connecting to live stream… (media provider pending integration)</p>
          <p v-if="session && !session.videoEnabled" class="mt-1 flex items-center gap-1 text-sm text-white/70"><VideoOff class="h-4 w-4" />Video off</p>
        </div>
        <div class="absolute left-4 top-4 flex items-center gap-2">
          <span v-if="session?.status === 'live'" class="rounded-md bg-danger-500 px-2 py-1 text-xs font-bold text-white">LIVE</span>
          <span v-if="session" class="flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-xs text-white"><Users class="h-3.5 w-3.5" />{{ session.viewersCount }}</span>
        </div>
        <div class="absolute inset-x-0 bottom-4 flex justify-center gap-3">
          <template v-if="isHost || (!session && canHost)">
            <button type="button" :class="cn('flex h-12 w-12 items-center justify-center rounded-full', audioOn ? 'bg-white/20 text-white' : 'bg-white text-ink-900')" :aria-label="audioOn ? 'Mute' : 'Unmute'" @click="toggle('audio')"><Mic v-if="audioOn" class="h-5 w-5" /><MicOff v-else class="h-5 w-5" /></button>
            <button type="button" :class="cn('flex h-12 w-12 items-center justify-center rounded-full', videoOn ? 'bg-white/20 text-white' : 'bg-white text-ink-900')" :aria-label="videoOn ? 'Turn video off' : 'Turn video on'" @click="toggle('video')"><Video v-if="videoOn" class="h-5 w-5" /><VideoOff v-else class="h-5 w-5" /></button>
          </template>
          <button type="button" class="flex h-12 w-12 items-center justify-center rounded-full bg-danger-500 text-white" :aria-label="isHost ? 'End live' : 'Leave'" @click="end"><PhoneOff class="h-5 w-5" /></button>
        </div>
      </div>
      <aside class="space-y-4">
        <div class="card p-5">
          <h1 class="text-lg font-semibold">{{ community?.name }}</h1>
          <p class="text-sm text-ink-500">{{ session ? (session.title ?? 'Live now') : 'Start a live session for your community' }}</p>
          <template v-if="!session && canHost"><UiInput v-model="title" class="mt-4" label="Title (optional)" placeholder="Rehearsal walkthrough" /><UiButton block size="lg" class="mt-4" @click="goLive">Start live</UiButton></template>
          <p v-else-if="!session" class="mt-4 text-sm text-ink-500">There’s no live session right now.</p>
          <UiButton v-else-if="!isHost" block class="mt-4" variant="soft" :disabled="requested" @click="requestToJoin"><Hand class="h-4 w-4" />{{ requested ? 'Request sent' : 'Request to join live' }}</UiButton>
          <UiButton v-else block class="mt-4" variant="outline" @click="requestsOpen = true">Live requests ({{ requests.filter((r) => r.status === 'pending').length }})</UiButton>
        </div>
      </aside>
    </div>
    <UiDrawer v-model:open="requestsOpen" title="Live requests" size="sm">
      <ul class="divide-y divide-ink-100"><li v-for="r in requests" :key="r.id" class="flex items-center gap-3 py-3"><UiAvatar :src="r.user.avatarUrl" :name="r.user.displayName" /><span class="flex-1">{{ r.user.displayName }}</span><template v-if="r.status === 'pending'"><button type="button" class="flex h-9 w-9 items-center justify-center rounded-full bg-success-50 text-success-600" aria-label="Accept" @click="decide(r, 'accepted')"><Check class="h-4 w-4" /></button><button type="button" class="flex h-9 w-9 items-center justify-center rounded-full bg-danger-50 text-danger-500" aria-label="Decline" @click="decide(r, 'declined')"><X class="h-4 w-4" /></button></template><span v-else class="text-xs capitalize text-ink-500">{{ r.status }}</span></li></ul>
    </UiDrawer>
  </div>
</template>
