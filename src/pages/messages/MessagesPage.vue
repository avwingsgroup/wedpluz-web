<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { isSameDay, parseISO } from 'date-fns'
import {
  Archive, ArrowLeft, BellOff, CirclePlus, EllipsisVertical, Flag, Image as ImageIcon, Link2, Mic, Pin, Plus, Radio, Reply, Search, Send, Smile, Star, Trash2, X, Bell, Copy,
} from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import MessageBubble from '@/modules/messaging/MessageBubble.vue'
import StatusViewer from '@/modules/messaging/StatusViewer.vue'
import CommunityInfoDrawer from '@/modules/messaging/CommunityInfoDrawer.vue'
import ReportDialog from '@/modules/community/ReportDialog.vue'
import { useAudioRecorder } from '@/modules/messaging/useAudioRecorder'
import { messagingApi, type ConversationDetail } from '@/services/api/messaging.api'
import { communityApi } from '@/services/api/community.api'
import { accountApi } from '@/services/api/account.api'
import { useRealtimeEvent } from '@/composables/useRealtime'
import { useShare } from '@/composables/useClipboardShare'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { useBadgeStore } from '@/stores/notifications.store'
import { formatDate, formatRelative } from '@/utils/format'
import { uuid } from '@/utils/id'
import { validateUpload } from '@/utils/files'
import { cn } from '@/utils/cn'
import type { Community, Conversation, Message, StatusPost } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const badges = useBadgeStore()
const { copy } = useShare()

/* ---------------- conversation list ---------------- */
const tab = ref<'all' | 'unread' | 'communities' | 'requests'>('all')
const search = ref('')
const conversations = ref<Conversation[]>([])
const requestsCount = ref(0)
const listLoading = ref(true)
const showArchived = ref(false)
const communitiesArchived = ref<Community[]>([])

async function loadList() {
  try {
    const res = await messagingApi.conversations({ tab: tab.value, search: search.value || undefined })
    conversations.value = res.items
    requestsCount.value = res.requestsCount
    if (tab.value === 'communities') communitiesArchived.value = await communityApi.list({ archived: true })
  } finally {
    listLoading.value = false
  }
}
const debouncedList = useDebounceFn(loadList, 250)
watch(tab, () => {
  listLoading.value = true
  void loadList()
})
watch(search, () => debouncedList())
onMounted(loadList)

/* ---------------- active conversation ---------------- */
const activeId = computed(() => (route.params.id ? String(route.params.id) : null))
const active = ref<ConversationDetail | null>(null)
const messages = ref<Message[]>([])
const cursor = ref<string | null>(null)
const threadLoading = ref(false)
const loadingOlder = ref(false)
const scroller = ref<HTMLElement | null>(null)
const statuses = ref<StatusPost[]>([])
const viewerIndex = ref<number | null>(null)
const infoOpen = ref(false)
const reportTarget = ref<{ type: 'message' | 'user' | 'community'; id: string } | null>(null)

async function openConversation(id: string) {
  threadLoading.value = true
  messages.value = []
  statuses.value = []
  try {
    const [detail, page] = await Promise.all([messagingApi.conversation(id), messagingApi.messages(id)])
    active.value = detail
    messages.value = page.data
    cursor.value = page.meta.nextCursor
    if (detail.communityId) statuses.value = await communityApi.statuses(detail.communityId).catch(() => [])
    if (detail.unreadCount) {
      void messagingApi.markRead(id).catch(() => undefined)
      conversations.value = conversations.value.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      void badges.refresh()
    }
    await nextTick()
    scrollToBottom()
  } catch (e) {
    ui.error((e as Error).message)
    router.replace({ name: 'messages' })
  } finally {
    threadLoading.value = false
  }
}
watch(activeId, (id) => (id ? openConversation(id) : (active.value = null)), { immediate: true })

async function loadOlder() {
  if (!active.value || !cursor.value || loadingOlder.value) return
  loadingOlder.value = true
  const el = scroller.value
  const prevHeight = el?.scrollHeight ?? 0
  try {
    const page = await messagingApi.messages(active.value.id, cursor.value)
    messages.value = [...page.data, ...messages.value]
    cursor.value = page.meta.nextCursor
    await nextTick()
    if (el) el.scrollTop = el.scrollHeight - prevHeight
  } finally {
    loadingOlder.value = false
  }
}
function onScroll() {
  if (scroller.value && scroller.value.scrollTop < 80) void loadOlder()
}
function scrollToBottom() {
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}
const grouped = computed(() => messages.value.map((m, i) => {
  const prev = messages.value[i - 1]
  return { m, showDate: !prev || !isSameDay(parseISO(prev.createdAt), parseISO(m.createdAt)), showSender: !m.isMine && (!prev || prev.sender.id !== m.sender.id || !isSameDay(parseISO(prev.createdAt), parseISO(m.createdAt))) || (m.isMine && (!prev || prev.sender.id !== m.sender.id)) }
}))
const community = computed(() => active.value?.community ?? null)
const isAdmin = computed(() => community.value?.myRole === 'owner' || community.value?.myRole === 'co_admin')
const canSend = computed(() => !community.value || isAdmin.value || community.value.permissions.membersCanSendMessages)

/* ---------------- realtime ---------------- */
useRealtimeEvent<Message>('message.created', (m) => {
  if (m.conversationId === active.value?.id && !messages.value.some((x) => x.id === m.id || (m.clientId && x.clientId === m.clientId))) {
    messages.value.push({ ...m, isMine: m.sender.id === auth.user?.id })
    void nextTick(scrollToBottom)
  }
  void loadList()
})

/* ---------------- composer ---------------- */
const draft = ref('')
const replyTo = ref<Message | null>(null)
const sending = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const recorder = useAudioRecorder()
const emojis = ['😀', '😂', '😍', '🥳', '👍', '🙏', '🔥', '❤️', '🎉', '👏', '💯', '😢']

async function send(payload?: { type: Message['type']; attachmentUploadIds?: string[]; body?: string }) {
  if (!active.value) return
  const body = payload?.body ?? draft.value.trim()
  if (!payload && !body) return
  const clientId = uuid()
  const optimistic: Message = {
    id: clientId, clientId, conversationId: active.value.id, sender: { id: auth.user!.id, displayName: auth.displayName, avatarUrl: auth.user!.avatarUrl }, type: payload?.type ?? 'text', body: body || null, attachments: [], replyTo: replyTo.value ? { id: replyTo.value.id, sender: replyTo.value.sender, body: replyTo.value.body, type: replyTo.value.type } : null,
    reactions: [], event: null, isPinned: false, isStarred: false, isMine: true, deletedBy: 'none', status: 'sending', createdAt: new Date().toISOString(),
  }
  messages.value.push(optimistic)
  draft.value = ''
  const reply = replyTo.value
  replyTo.value = null
  await nextTick(scrollToBottom)
  sending.value = true
  try {
    const saved = await messagingApi.send(active.value.id, { clientId, type: optimistic.type, body: body || undefined, attachmentUploadIds: payload?.attachmentUploadIds, replyToId: reply?.id ?? null })
    messages.value = messages.value.map((m) => (m.clientId === clientId ? saved : m))
    void loadList()
  } catch (e) {
    messages.value = messages.value.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m))
    ui.error((e as Error).message)
  } finally {
    sending.value = false
  }
}
async function onFiles(files: FileList | null) {
  if (!files?.length) return
  const ids: string[] = []
  for (const f of Array.from(files).slice(0, 4)) {
    const check = validateUpload(f)
    if (!check.ok) {
      ui.error(check.error ?? 'Invalid file')
      continue
    }
    ids.push((await accountApi.upload(f, 'message_attachment')).id)
  }
  if (ids.length) await send({ type: 'image', attachmentUploadIds: ids, body: draft.value.trim() })
  if (fileInput.value) fileInput.value.value = ''
}
async function toggleRecording() {
  if (!recorder.recording.value) {
    const ok = await recorder.start()
    if (!ok && recorder.error.value) ui.error(recorder.error.value)
    return
  }
  const blob = await recorder.stop()
  if (!blob) return
  const upload = await accountApi.upload(new File([blob], 'voice-note.webm', { type: blob.type }), 'voice_note')
  await send({ type: 'audio', attachmentUploadIds: [upload.id], body: '' })
}

/* ---------------- message actions ---------------- */
const menu = ref<{ x: number; y: number; m: Message } | null>(null)
function openMenu(e: MouseEvent, m: Message) {
  if (m.deletedBy !== 'none') return
  menu.value = { x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 320), m }
}
async function act(action: 'reply' | 'react' | 'star' | 'pin' | 'copy' | 'delete' | 'report', emoji?: string) {
  const m = menu.value?.m
  menu.value = null
  if (!m) return
  if (action === 'reply') replyTo.value = m
  else if (action === 'copy' && m.body) void copy(m.body, 'Message copied')
  else if (action === 'report') reportTarget.value = { type: 'message', id: m.id }
  else {
    try {
      const updated = action === 'react' ? await messagingApi.react(m.id, emoji ?? '👍') : action === 'star' ? await messagingApi.star(m.id) : action === 'pin' ? await messagingApi.pin(m.id) : await messagingApi.deleteMessage(m.id)
      messages.value = messages.value.map((x) => (x.id === m.id ? { ...updated, isMine: x.isMine } : x))
    } catch (e) {
      ui.error((e as Error).message)
    }
  }
}
async function react(m: Message, emoji: string) {
  const updated = await messagingApi.react(m.id, emoji)
  messages.value = messages.value.map((x) => (x.id === m.id ? { ...updated, isMine: x.isMine } : x))
}

/* ---------------- conversation actions ---------------- */
async function setFlag(c: Conversation, flag: 'isPinned' | 'isMuted' | 'isArchived') {
  const updated = await messagingApi.setFlags(c.id, { [flag]: !c[flag] })
  conversations.value = conversations.value.map((x) => (x.id === c.id ? updated : x))
  if (flag === 'isArchived') void loadList()
}
async function removeConversation(c: Conversation) {
  if (!(await ui.confirm({ title: 'Delete this chat?', description: 'Messages will be removed from your inbox.', variant: 'danger', confirmLabel: 'Delete' }))) return
  await messagingApi.remove(c.id)
  conversations.value = conversations.value.filter((x) => x.id !== c.id)
  if (activeId.value === c.id) router.replace({ name: 'messages' })
}
async function respondRequest(action: 'accept' | 'decline') {
  if (!active.value) return
  await messagingApi.respondRequest(active.value.id, action)
  if (action === 'decline') router.replace({ name: 'messages' })
  else active.value = { ...active.value, isRequest: false }
  void loadList()
}
function convoMenu(c: Conversation) {
  return [
    { label: c.isPinned ? 'Unpin' : 'Pin', icon: Pin, onClick: () => setFlag(c, 'isPinned') },
    { label: c.isMuted ? 'Unmute' : 'Mute', icon: c.isMuted ? Bell : BellOff, onClick: () => setFlag(c, 'isMuted') },
    { label: c.isArchived ? 'Unarchive' : 'Archive', icon: Archive, onClick: () => setFlag(c, 'isArchived') },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => removeConversation(c) },
    { label: 'Report', icon: Flag, danger: true, onClick: () => (reportTarget.value = { type: c.type === 'community' ? 'community' : 'user', id: c.communityId ?? c.participants[0]?.id ?? c.id }) },
  ]
}

/* ---------------- new chat / status / live ---------------- */
const newOpen = ref(false)
const newEmail = ref('')
const statusFile = ref<HTMLInputElement | null>(null)
async function postStatus(files: FileList | null) {
  const f = files?.[0]
  if (!f || !community.value) return
  const up = await accountApi.upload(f, 'status')
  statuses.value = [await communityApi.postStatus(community.value.id, { mediaUploadId: up.id, mediaType: f.type.startsWith('video') ? 'video' : 'image' }), ...statuses.value]
  ui.success('Status posted')
}
async function goLive() {
  if (!community.value) return
  router.push({ name: 'community.live', params: { id: community.value.id } })
}
function onCommunityUpdated(c: Community) {
  if (active.value) active.value = { ...active.value, community: c, title: c.name, avatarUrl: c.avatarUrl }
  void loadList()
}
</script>

<template>
  <div class="container-app pb-10">
    <div class="grid h-[calc(100vh-200px)] min-h-[560px] gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
      <!-- list -->
      <aside :class="cn('flex min-h-0 flex-col rounded-3xl bg-ink-50 p-4', activeId && 'hidden lg:flex')">
        <div class="flex items-center justify-between px-2 pt-2"><h1 class="text-2xl">Messages</h1><button type="button" class="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white" aria-label="New message" @click="newOpen = true"><Plus class="h-5 w-5" /></button></div>
        <label class="relative mt-4 block"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search..." class="field rounded-xl bg-white pl-10" aria-label="Search messages" /></label>
        <UiTabs v-model="tab" variant="pill" size="sm" class="mt-4" :tabs="[{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' }, { key: 'communities', label: 'Communities' }, { key: 'requests', label: 'Requests', count: requestsCount || undefined }]" />
        <button v-if="tab === 'communities'" type="button" class="mt-3 flex items-center gap-2 px-2 py-2 text-sm" @click="showArchived = !showArchived"><Archive class="h-4 w-4" />Archived communities ({{ communitiesArchived.length }})</button>
        <div v-if="showArchived && tab === 'communities'" class="mb-2 space-y-1"><RouterLink v-for="c in communitiesArchived" :key="c.id" :to="{ name: 'messages', params: { id: `cv_${c.id}` } }" class="flex items-center gap-3 rounded-xl px-2 py-2 text-sm opacity-70 hover:bg-white"><UiAvatar :src="c.avatarUrl" :name="c.name" size="sm" />{{ c.name }}</RouterLink></div>

        <div class="-mx-4 mt-2 min-h-0 flex-1 overflow-y-auto">
          <template v-if="listLoading"><div v-for="i in 6" :key="i" class="px-4"><UiSkeleton variant="row" /></div></template>
          <UiEmptyState v-else-if="!conversations.length" :title="tab === 'requests' ? 'No message requests' : tab === 'communities' ? 'No communities yet' : 'No messages yet'" :description="tab === 'communities' ? 'Event communities you join will appear here.' : 'Start a conversation with a vendor or organizer.'" illustration="chat" compact />
          <div v-for="c in conversations" v-else :key="c.id" :class="cn('group relative flex items-center gap-3 border-b border-ink-100 px-4 py-3 transition-colors hover:bg-white', activeId === c.id && 'bg-brand-50/60 after:absolute after:inset-y-0 after:right-0 after:w-1 after:bg-brand-600')">
            <RouterLink :to="{ name: 'messages', params: { id: c.id } }" class="flex min-w-0 flex-1 items-center gap-3">
              <UiAvatar :src="c.avatarUrl" :name="c.title" />
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-1.5 truncate"><span class="truncate">{{ c.title }}</span><BellOff v-if="c.isMuted" class="h-3.5 w-3.5 shrink-0 text-ink-400" /></p>
                <p class="truncate text-xs text-ink-500">{{ c.lastMessage?.body || 'No messages yet' }}</p>
              </div>
              <div class="flex flex-col items-end gap-1"><span class="text-xs text-ink-400">{{ c.lastMessage ? formatRelative(c.lastMessage.createdAt) : '' }}</span><span class="flex items-center gap-1"><Pin v-if="c.isPinned" class="h-3.5 w-3.5 text-ink-400" /><span v-if="c.unreadCount" class="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">{{ c.unreadCount }}</span></span></div>
            </RouterLink>
            <UiDropdown :items="convoMenu(c)" width="w-44"><template #trigger><button type="button" class="rounded-full p-1 text-ink-400 opacity-0 hover:bg-ink-100 group-hover:opacity-100 focus:opacity-100" aria-label="Conversation options"><EllipsisVertical class="h-4 w-4" /></button></template></UiDropdown>
          </div>
        </div>
      </aside>

      <!-- thread -->
      <section :class="cn('flex min-h-0 flex-col rounded-3xl bg-ink-50 p-4', !activeId && 'hidden lg:flex')">
        <UiEmptyState v-if="!activeId" title="Your messages" description="Select a conversation or start a new one." illustration="chat" class="m-auto"><UiButton @click="newOpen = true">New message</UiButton></UiEmptyState>
        <div v-else-if="threadLoading || !active" class="space-y-4 p-4"><UiSkeleton variant="row" /><UiSkeleton v-for="i in 5" :key="i" class="h-16 w-2/3 rounded-2xl" :class="i % 2 ? 'ml-auto' : ''" /></div>
        <template v-else>
          <header class="flex items-center gap-3 px-1 pb-3">
            <button type="button" class="rounded-full p-1.5 hover:bg-white lg:hidden" aria-label="Back" @click="router.push({ name: 'messages' })"><ArrowLeft class="h-5 w-5" /></button>
            <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" @click="community ? (infoOpen = true) : router.push({ name: 'user', params: { id: active.participants[0]?.id } })">
              <UiAvatar :src="active.avatarUrl" :name="active.title" /><span class="min-w-0"><span class="block truncate font-medium">{{ active.title }}</span><span v-if="community" class="block text-xs text-ink-500">{{ community.membersCount }} members · {{ community.onlineCount }} online</span></span>
            </button>
            <button v-if="community && (isAdmin || community.permissions.membersCanGoLive)" type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white" aria-label="Go live" @click="goLive"><Radio class="h-4 w-4 text-danger-500" /></button>
            <button v-if="community && (isAdmin || community.permissions.membersCanPostStatus)" type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white" aria-label="Add status" @click="statusFile?.click()"><CirclePlus class="h-4 w-4" /></button>
            <UiDropdown :items="community ? [{ label: 'Community info', onClick: () => (infoOpen = true) }, { label: 'Copy invite link', icon: Link2, onClick: () => copy(community!.inviteLink, 'Invite link copied') }, { label: 'Report community', icon: Flag, danger: true, onClick: () => (reportTarget = { type: 'community', id: community!.id }) }] : convoMenu(active)">
              <template #trigger><button type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white" aria-label="More"><EllipsisVertical class="h-4 w-4" /></button></template>
            </UiDropdown>
            <input ref="statusFile" type="file" accept="image/*,video/*" class="sr-only" @change="postStatus(($event.target as HTMLInputElement).files)" />
          </header>

          <!-- statuses strip -->
          <div v-if="statuses.length" class="flex gap-3 overflow-x-auto px-1 pb-3 scrollbar-none">
            <button v-for="(s, i) in statuses" :key="s.id" type="button" class="shrink-0" :aria-label="`View ${s.author.displayName}'s status`" @click="viewerIndex = i"><span :class="cn('block rounded-full p-0.5', s.viewedByMe ? 'bg-ink-300' : 'bg-gradient-to-tr from-brand-600 to-pink-500')"><UiAvatar :src="s.author.avatarUrl" :name="s.author.displayName" size="md" class="rounded-full ring-2 ring-white" /></span></button>
          </div>
          <!-- pinned -->
          <div v-if="active.pinnedMessages.length" class="mb-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-ink-600"><Pin class="h-3.5 w-3.5 shrink-0" /><span class="truncate">{{ active.pinnedMessages[active.pinnedMessages.length - 1]?.body }}</span></div>

          <div ref="scroller" class="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2" @scroll.passive="onScroll">
            <p v-if="loadingOlder" class="text-center text-xs text-ink-400">Loading earlier messages…</p>
            <div v-if="community && !messages.length" class="mx-auto max-w-xs rounded-2xl bg-white p-6 text-center">
              <h3 class="font-semibold">{{ community.name }}</h3><p class="mt-1 text-sm text-ink-500">Invite people to register for the event and join community</p>
              <button v-if="isAdmin && !community.description" type="button" class="mt-3 text-sm font-medium text-brand-600" @click="infoOpen = true">Add community description</button>
              <UiButton block class="mt-3" @click="copy(community.inviteLink, 'Invite link copied')"><Link2 class="h-4 w-4" />Invite link</UiButton>
            </div>
            <template v-for="g in grouped" :key="g.m.id">
              <p v-if="g.showDate" class="text-center"><span class="rounded-md bg-white px-2 py-1 text-xs text-ink-500">{{ isSameDay(parseISO(g.m.createdAt), new Date()) ? 'Today' : formatDate(g.m.createdAt) }}</span></p>
              <MessageBubble :message="g.m" :show-sender="!!g.showSender" @contextmenu="openMenu" @react="(e) => react(g.m, e)" />
            </template>
          </div>

          <!-- request banner -->
          <div v-if="active.isRequest" class="mt-2 rounded-2xl bg-white p-4 text-center"><p class="text-sm">{{ active.title }} wants to send you a message.</p><div class="mt-3 flex justify-center gap-2"><UiButton size="sm" @click="respondRequest('accept')">Accept</UiButton><UiButton size="sm" variant="outline" @click="respondRequest('decline')">Decline</UiButton><UiButton size="sm" variant="ghost" class="text-danger-500" @click="reportTarget = { type: 'user', id: active.participants[0]?.id ?? '' }">Report</UiButton></div></div>

          <!-- composer -->
          <div v-else-if="canSend" class="mt-2">
            <div v-if="replyTo" class="mb-2 flex items-start gap-2 rounded-xl border-l-4 border-brand-600 bg-white px-3 py-2 text-xs"><div class="min-w-0 flex-1"><p class="font-medium text-brand-600">Replying to {{ replyTo.sender.displayName }}</p><p class="truncate text-ink-600">{{ replyTo.body ?? 'Attachment' }}</p></div><button type="button" aria-label="Cancel reply" @click="replyTo = null"><X class="h-4 w-4" /></button></div>
            <form class="flex items-center gap-2" @submit.prevent="send()">
              <div class="flex flex-1 items-center gap-2 rounded-2xl bg-white px-3 py-2">
                <UiDropdown align="left" width="w-60"><template #trigger><button type="button" class="text-ink-500 hover:text-ink-900" aria-label="Emoji"><Smile class="h-5 w-5" /></button></template><template #default="{ close }"><div class="grid grid-cols-6 gap-1"><button v-for="e in emojis" :key="e" type="button" class="rounded-lg p-1 text-xl hover:bg-ink-50" @click="draft += e; close()">{{ e }}</button></div></template></UiDropdown>
                <div v-if="recorder.recording.value" class="flex flex-1 items-center gap-2 text-sm text-danger-500"><span class="h-2 w-2 animate-pulse rounded-full bg-danger-500" />{{ Math.floor(recorder.seconds.value / 60) }}:{{ String(recorder.seconds.value % 60).padStart(2, '0') }}<div class="flex h-5 flex-1 items-center gap-[2px]"><span v-for="(l, i) in recorder.levels.value" :key="i" class="w-[2px] rounded-full bg-brand-400" :style="{ height: `${l}%` }" /></div><button type="button" class="text-ink-500" aria-label="Cancel recording" @click="recorder.cancel()"><X class="h-4 w-4" /></button></div>
                <input v-else v-model="draft" type="text" placeholder="Type a message" class="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm focus:ring-0" aria-label="Message" maxlength="4000" />
                <button type="button" class="text-ink-500 hover:text-ink-900" aria-label="Attach image" @click="fileInput?.click()"><ImageIcon class="h-5 w-5" /></button>
                <input ref="fileInput" type="file" accept="image/*" multiple class="sr-only" @change="onFiles(($event.target as HTMLInputElement).files)" />
              </div>
              <button v-if="draft.trim() && !recorder.recording.value" type="submit" class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white" aria-label="Send" :disabled="sending"><Send class="h-4 w-4" /></button>
              <button v-else type="button" :class="cn('flex h-10 w-10 items-center justify-center rounded-full text-white', recorder.recording.value ? 'bg-danger-500' : 'bg-brand-600')" :aria-label="recorder.recording.value ? 'Send voice note' : 'Record voice note'" @click="toggleRecording"><Send v-if="recorder.recording.value" class="h-4 w-4" /><Mic v-else class="h-4 w-4" /></button>
            </form>
          </div>
          <p v-else class="mt-2 rounded-xl bg-white px-4 py-3 text-center text-sm text-ink-500">Only admins can send messages in this community.</p>
        </template>
      </section>
    </div>

    <!-- context menu -->
    <Teleport to="body">
      <div v-if="menu" class="fixed inset-0 z-[70]" @click="menu = null" @contextmenu.prevent="menu = null">
        <div class="absolute w-52 rounded-2xl border border-ink-100 bg-white p-2 shadow-float" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" @click.stop>
          <div class="mb-1 flex justify-between border-b border-ink-100 px-1 pb-2"><button v-for="e in ['👍', '❤️', '😂', '😮', '😢', '🙏']" :key="e" type="button" class="rounded-full p-1 text-lg hover:bg-ink-50" @click="act('react', e)">{{ e }}</button></div>
          <button type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" @click="act('reply')"><Reply class="h-4 w-4" />Reply</button>
          <button v-if="menu.m.body" type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" @click="act('copy')"><Copy class="h-4 w-4" />Copy</button>
          <button type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" @click="act('star')"><Star class="h-4 w-4" />{{ menu.m.isStarred ? 'Unstar' : 'Star' }}</button>
          <button v-if="!community || isAdmin" type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" @click="act('pin')"><Pin class="h-4 w-4" />{{ menu.m.isPinned ? 'Unpin' : 'Pin' }}</button>
          <button v-if="menu.m.isMine || isAdmin" type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-danger-500 hover:bg-danger-50" @click="act('delete')"><Trash2 class="h-4 w-4" />Delete</button>
          <button v-if="!menu.m.isMine" type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-danger-500 hover:bg-danger-50" @click="act('report')"><Flag class="h-4 w-4" />Report</button>
        </div>
      </div>
    </Teleport>

    <StatusViewer :statuses="statuses" :start-index="viewerIndex" @close="viewerIndex = null" @deleted="(id) => (statuses = statuses.filter((s) => s.id !== id))" />
    <CommunityInfoDrawer v-if="community" v-model:open="infoOpen" :community="community" @updated="onCommunityUpdated" @left="infoOpen = false; router.replace({ name: 'messages' }); loadList()" />
    <ReportDialog v-if="reportTarget" :open="!!reportTarget" :target-type="reportTarget.type" :target-id="reportTarget.id" allow-block @update:open="(v) => !v && (reportTarget = null)" />
    <UiModal v-model:open="newOpen" title="New message" size="sm">
      <p class="text-sm text-ink-500">Message a vendor from their profile, or an organizer from their event page. You can also start a chat with a person you know:</p>
      <UiInput v-model="newEmail" class="mt-4" label="Their Wedpluz username or profile link" placeholder="@shotitmoi" />
      <div class="mt-4 flex gap-2"><UiButton :to="{ name: 'vendors' }" variant="outline">Browse vendors</UiButton><UiButton :disabled="!newEmail" @click="router.push({ name: 'vendors', query: { search: newEmail.replace('@', '') } }); newOpen = false">Find</UiButton></div>
    </UiModal>
  </div>
</template>
