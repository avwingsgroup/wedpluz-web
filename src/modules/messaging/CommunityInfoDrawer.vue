<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Archive, BellOff, Copy, FileText, Image as ImageIcon, LogOut, Pencil, RefreshCw, Shield, UserMinus, UserPlus, Video } from 'lucide-vue-next'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiImageUploader from '@/components/ui/UiImageUploader.vue'
import { communityApi, type CommunityMediaItem } from '@/services/api/community.api'
import { useShare } from '@/composables/useClipboardShare'
import { useUiStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'
import type { Community, CommunityMember, CommunityPermissions } from '@/types'

const props = defineProps<{ open: boolean; community: Community }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; updated: [c: Community]; left: [] }>()
const router = useRouter()
const ui = useUiStore()
const { copy } = useShare()
const tab = ref<'about' | 'members' | 'media' | 'settings'>('about')
const members = ref<CommunityMember[]>([])
const media = ref<CommunityMediaItem[]>([])
const mediaType = ref<'media' | 'docs'>('media')
const loading = ref(false)
const editing = ref(false)
const name = ref('')
const description = ref('')
const avatarUploadId = ref<string | undefined>()
const avatarUrl = ref<string | null>(null)
const inviteOpen = ref(false)
const inviteEmails = ref('')
const isAdmin = computed(() => props.community.myRole === 'owner' || props.community.myRole === 'co_admin')

watch(() => [props.open, tab.value, mediaType.value], async () => {
  if (!props.open) return
  loading.value = true
  try {
    if (tab.value === 'members') members.value = (await communityApi.members(props.community.id)).data
    if (tab.value === 'media') media.value = (await communityApi.media(props.community.id, { type: mediaType.value })).data
  } finally {
    loading.value = false
  }
})

function startEdit() {
  name.value = props.community.name
  description.value = props.community.description ?? ''
  avatarUrl.value = props.community.avatarUrl
  editing.value = true
}
async function saveInfo() {
  const c = await communityApi.update(props.community.id, { name: name.value, description: description.value || null, avatarUploadId: avatarUploadId.value })
  emit('updated', c)
  editing.value = false
  ui.success('Community updated')
}
async function setPermission(key: keyof CommunityPermissions, value: boolean) {
  const c = await communityApi.update(props.community.id, { permissions: { [key]: value } })
  emit('updated', c)
}
async function setRole(m: CommunityMember, role: 'co_admin' | 'member') {
  const updated = await communityApi.setRole(props.community.id, m.user.id, role)
  members.value = members.value.map((x) => (x.id === m.id ? updated : x))
  ui.success(role === 'co_admin' ? `${m.user.displayName} is now a co-admin` : 'Co-admin removed')
}
async function removeMember(m: CommunityMember) {
  if (!(await ui.confirm({ title: `Remove ${m.user.displayName}?`, variant: 'danger', confirmLabel: 'Remove' }))) return
  await communityApi.removeMember(props.community.id, m.user.id)
  members.value = members.value.filter((x) => x.id !== m.id)
}
async function regenerate() {
  const r = await communityApi.regenerateInvite(props.community.id)
  emit('updated', { ...props.community, inviteLink: r.inviteLink })
  ui.success('New invite link created', 'The old link no longer works.')
}
async function sendInvites() {
  const emails = inviteEmails.value.split(/[\s,;]+/).filter((e) => e.includes('@'))
  if (!emails.length) return ui.error('Enter at least one email')
  await communityApi.invite(props.community.id, { emails })
  inviteOpen.value = false
  inviteEmails.value = ''
  ui.success(`Invited ${emails.length} people`)
}
async function toggleFlag(flag: 'isMuted' | 'isArchived') {
  const c = await communityApi.setFlags(props.community.id, { [flag]: !props.community[flag] })
  emit('updated', c)
}
async function leave() {
  if (!(await ui.confirm({ title: `Leave ${props.community.name}?`, variant: 'danger', confirmLabel: 'Leave' }))) return
  try {
    await communityApi.leave(props.community.id)
    emit('left')
  } catch (e) {
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <UiDrawer :open="open" size="sm" :title="community.name" :subtitle="`${community.membersCount} members`" @update:open="emit('update:open', $event)">
    <UiTabs v-model="tab" variant="pill" size="sm" :tabs="[{ key: 'about', label: 'About' }, { key: 'members', label: 'Members' }, { key: 'media', label: 'Media' }, ...(isAdmin ? [{ key: 'settings', label: 'Permissions' }] : [])]" />

    <div v-if="tab === 'about'" class="mt-5 space-y-5">
      <template v-if="!editing">
        <div class="flex flex-col items-center text-center"><UiAvatar :src="community.avatarUrl" :name="community.name" size="xl" /><h3 class="mt-3 text-lg font-semibold">{{ community.name }}</h3><p class="mt-1 text-sm text-ink-500">{{ community.description || 'No description yet' }}</p><UiButton v-if="isAdmin" variant="link" size="sm" class="mt-2" @click="startEdit"><Pencil class="h-3.5 w-3.5" />Edit community info</UiButton></div>
        <RouterLink v-if="community.event" :to="`/events/${community.event.slug}`" class="card flex items-center gap-3 p-3"><img :src="community.event.coverUrl" alt="" class="h-12 w-12 rounded-lg object-cover" /><div class="min-w-0"><p class="truncate font-medium">{{ community.event.title }}</p><p class="text-xs text-ink-500">{{ formatDate(community.event.startsAt) }} <UiBadge v-if="community.event.isPromoted" tone="brand" size="sm">Promoted</UiBadge></p></div></RouterLink>
        <div class="card p-4"><p class="text-sm font-medium">Invite link</p><div class="mt-2 flex items-center gap-2 rounded-xl bg-ink-50 p-2.5 text-sm"><span class="min-w-0 flex-1 truncate">{{ community.inviteLink }}</span><button type="button" aria-label="Copy invite link" @click="copy(community.inviteLink, 'Invite link copied')"><Copy class="h-4 w-4 text-brand-600" /></button></div>
          <div class="mt-3 flex gap-2"><UiButton v-if="isAdmin || community.permissions.membersCanInvite" size="sm" variant="soft" @click="inviteOpen = !inviteOpen"><UserPlus class="h-4 w-4" />Invite members</UiButton><UiButton v-if="isAdmin" size="sm" variant="ghost" @click="regenerate"><RefreshCw class="h-4 w-4" />Reset link</UiButton></div>
          <div v-if="inviteOpen" class="mt-3 space-y-2"><UiTextarea v-model="inviteEmails" :rows="2" placeholder="Emails separated by commas" /><UiButton size="sm" @click="sendInvites">Send invites</UiButton></div>
        </div>
        <div class="space-y-1">
          <button type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-ink-50" @click="toggleFlag('isMuted')"><BellOff class="h-5 w-5" />{{ community.isMuted ? 'Unmute' : 'Mute' }} notifications</button>
          <button type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-ink-50" @click="toggleFlag('isArchived')"><Archive class="h-5 w-5" />{{ community.isArchived ? 'Unarchive' : 'Archive' }} community</button>
          <button v-if="community.myRole !== 'owner'" type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-danger-500 hover:bg-danger-50" @click="leave"><LogOut class="h-5 w-5" />Leave community</button>
        </div>
      </template>
      <form v-else class="space-y-4" @submit.prevent="saveInfo">
        <UiImageUploader v-model="avatarUrl" purpose="community_avatar" shape="circle" aspect="square" @uploaded="(ids) => (avatarUploadId = ids[0])" />
        <UiInput v-model="name" label="Community name" />
        <UiTextarea v-model="description" label="Description" :rows="3" :maxlength="500" />
        <div class="flex gap-2"><UiButton type="submit">Save</UiButton><UiButton variant="ghost" @click="editing = false">Cancel</UiButton></div>
      </form>
    </div>

    <div v-else-if="tab === 'members'" class="mt-5">
      <template v-if="loading"><UiSkeleton v-for="i in 5" :key="i" variant="row" /></template>
      <ul v-else class="divide-y divide-ink-100">
        <li v-for="m in members" :key="m.id" class="flex items-center gap-3 py-3">
          <UiAvatar :src="m.user.avatarUrl" :name="m.user.displayName" :online="m.isOnline" />
          <button type="button" class="min-w-0 flex-1 text-left" @click="router.push({ name: 'user', params: { id: m.user.id } })"><p class="truncate font-medium">{{ m.user.displayName }}</p><p class="text-xs text-ink-500">{{ m.isVendor ? 'Vendor' : 'Member' }}</p></button>
          <UiBadge v-if="m.role === 'owner'" tone="plum" size="sm">Organizer</UiBadge>
          <UiBadge v-else-if="m.role === 'co_admin'" tone="brand" size="sm">Co-admin</UiBadge>
          <UiDropdown v-if="isAdmin && m.role !== 'owner'" :items="[{ label: m.role === 'co_admin' ? 'Remove co-admin' : 'Make co-admin', icon: Shield, onClick: () => setRole(m, m.role === 'co_admin' ? 'member' : 'co_admin') }, { label: 'Remove from community', icon: UserMinus, danger: true, onClick: () => removeMember(m) }]">
            <template #trigger><button type="button" class="rounded-full px-2 py-1 text-ink-500 hover:bg-ink-100" aria-label="Member actions">⋮</button></template>
          </UiDropdown>
        </li>
      </ul>
    </div>

    <div v-else-if="tab === 'media'" class="mt-5">
      <UiTabs v-model="mediaType" variant="segment" size="sm" class="w-fit" :tabs="[{ key: 'media', label: 'Media' }, { key: 'docs', label: 'Docs' }]" />
      <div v-if="loading" class="mt-4 grid grid-cols-3 gap-2"><UiSkeleton v-for="i in 9" :key="i" class="aspect-square" /></div>
      <div v-else-if="mediaType === 'media'" class="mt-4 grid grid-cols-3 gap-2"><a v-for="m in media" :key="m.id" :href="m.url" target="_blank" rel="noopener noreferrer" class="relative aspect-square overflow-hidden rounded-lg bg-ink-100"><img :src="m.thumbnailUrl ?? m.url" alt="" class="h-full w-full object-cover" loading="lazy" /><Video v-if="m.type === 'video'" class="absolute bottom-1 right-1 h-4 w-4 text-white" /></a></div>
      <ul v-else class="mt-4 divide-y divide-ink-100"><li v-for="m in media" :key="m.id" class="flex items-center gap-3 py-3"><FileText class="h-8 w-8 text-danger-500" /><div class="min-w-0 flex-1"><p class="truncate text-sm font-medium">{{ m.name }}</p><p class="text-xs text-ink-500">{{ m.sender.displayName }} · {{ formatDate(m.createdAt) }}</p></div></li></ul>
      <p v-if="!loading && !media.length" class="mt-6 flex items-center gap-2 text-sm text-ink-500"><ImageIcon class="h-4 w-4" />Nothing shared yet</p>
    </div>

    <div v-else class="mt-5 card divide-y divide-ink-100">
      <div class="p-4"><UiToggle :model-value="community.permissions.membersCanSendMessages" label="Members can send messages" description="When off, only admins can post (announcement mode)." @update:model-value="setPermission('membersCanSendMessages', $event)" /></div>
      <div class="p-4"><UiToggle :model-value="community.permissions.membersCanPostStatus" label="Members can post status" @update:model-value="setPermission('membersCanPostStatus', $event)" /></div>
      <div class="p-4"><UiToggle :model-value="community.permissions.membersCanInvite" label="Members can invite others" @update:model-value="setPermission('membersCanInvite', $event)" /></div>
      <div class="p-4"><UiToggle :model-value="community.permissions.membersCanGoLive" label="Members can go live" description="Otherwise members must request to join a live session." @update:model-value="setPermission('membersCanGoLive', $event)" /></div>
      <div class="p-4"><UiToggle :model-value="community.permissions.requireApprovalToJoin" label="Approve new members" @update:model-value="setPermission('requireApprovalToJoin', $event)" /></div>
    </div>
  </UiDrawer>
</template>
