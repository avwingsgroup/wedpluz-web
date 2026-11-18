<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bot, Download, ImagePlus, PanelLeftOpen, Plus, Send } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import PlannerSidebar from '@/modules/planner/PlannerSidebar.vue'
import { plannerApi, type PlannerIntent } from '@/services/api/planner.api'
import { accountApi } from '@/services/api/account.api'
import { useAuthStore } from '@/stores/auth.store'
import { ILLUSTRATIONS } from '@/assets/illustrations'
import { useUiStore } from '@/stores/ui.store'
import { isApiError } from '@/services/http'
import { cn } from '@/utils/cn'
import type { PlannerChat, PlannerChatMessage } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const chats = ref<Array<Pick<PlannerChat, 'id' | 'title' | 'updatedAt'>>>([])
const chatsLoading = ref(true)
const chat = ref<PlannerChat | null>(null)
const chatLoading = ref(false)
const input = ref('')
const intent = ref<PlannerIntent>('chat')
const sending = ref(false)
const collapsed = ref(false)
const scroller = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const attachment = ref<{ id: string; url: string } | null>(null)

const chatId = computed(() => (route.params.id ? String(route.params.id) : null))
const starters = [
  { label: 'Create a Menu', intent: 'menu' as const, image: ILLUSTRATIONS.planner.menu, to: { name: 'planner.menu' } },
  { label: 'Hall layout', intent: 'hall_layout' as const, image: ILLUSTRATIONS.planner.hall, to: { name: 'planner.hall' } },
  { label: 'Create a cake design', intent: 'cake_design' as const, image: ILLUSTRATIONS.planner.cake, to: { name: 'planner.design', params: { type: 'cake' } } },
  { label: 'Event Branding', intent: 'event_branding' as const, image: ILLUSTRATIONS.planner.brand, to: { name: 'planner.design', params: { type: 'branding' } } },
]

async function loadChats() {
  try {
    chats.value = await plannerApi.chats()
  } finally {
    chatsLoading.value = false
  }
}
onMounted(loadChats)
watch(chatId, async (id) => {
  chat.value = null
  if (!id) return
  chatLoading.value = true
  try {
    chat.value = await plannerApi.chat(id)
    await nextTick()
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight })
  } catch {
    router.replace({ name: 'planner' })
  } finally {
    chatLoading.value = false
  }
}, { immediate: true })

async function newChat() {
  router.push({ name: 'planner' })
  input.value = ''
}
async function deleteChat(id: string) {
  if (!(await ui.confirm({ title: 'Delete this chat?', description: 'This will remove the conversation. Saved assets are kept.', variant: 'danger', confirmLabel: 'Delete' }))) return
  await plannerApi.deleteChat(id)
  chats.value = chats.value.filter((c) => c.id !== id)
  if (chatId.value === id) router.push({ name: 'planner' })
}
async function onFile(files: FileList | null) {
  const f = files?.[0]
  if (!f) return
  const up = await accountApi.upload(f, 'planner_reference')
  attachment.value = { id: up.id, url: up.thumbnailUrl ?? up.url }
}
async function send() {
  const content = input.value.trim()
  if (!content || sending.value) return
  sending.value = true
  try {
    let id = chatId.value
    if (!id) {
      const c = await plannerApi.createChat(content.slice(0, 48))
      id = c.id
      chat.value = c
      await router.replace({ name: 'planner.chat', params: { id } })
    }
    const optimistic: PlannerChatMessage = { id: `tmp-${Date.now()}`, role: 'user', content, attachments: attachment.value ? [{ type: 'image', url: attachment.value.url, name: 'reference' }] : [], generation: null, createdAt: new Date().toISOString() }
    chat.value?.messages.push(optimistic)
    input.value = ''
    await nextTick()
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
    const res = await plannerApi.send(id, { content, intent: intent.value, attachmentUploadIds: attachment.value ? [attachment.value.id] : undefined })
    attachment.value = null
    if (chat.value) chat.value.messages = [...chat.value.messages.filter((m) => m.id !== optimistic.id), ...res.messages]
    void loadChats()
    await nextTick()
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
  } catch (e) {
    if (chat.value) chat.value.messages = chat.value.messages.filter((m) => !m.id.startsWith('tmp-'))
    if (isApiError(e) && e.status === 402) ui.toast({ variant: 'info', title: 'Premium feature', description: e.message, action: { label: 'Upgrade', onClick: () => router.push({ name: 'pricing' }) } })
    else ui.error((e as Error).message)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1400px] px-4 pb-10 pt-6 sm:px-6">
    <div :class="cn('grid h-[calc(100vh-180px)] min-h-[600px] gap-6', collapsed ? 'grid-cols-1' : 'lg:grid-cols-[340px_minmax(0,1fr)]')">
      <PlannerSidebar v-if="!collapsed" class="hidden lg:flex" :chats="chats" :loading="chatsLoading" @new-chat="newChat" @delete-chat="deleteChat" @collapse="collapsed = true" />
      <section class="relative flex min-h-0 flex-col rounded-3xl border border-ink-200 bg-white">
        <button v-if="collapsed" type="button" class="absolute left-4 top-4 rounded-lg p-2 hover:bg-ink-100" aria-label="Open sidebar" @click="collapsed = false"><PanelLeftOpen class="h-5 w-5" /></button>

        <!-- welcome -->
        <div v-if="!chatId" class="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h1 class="text-3xl md:text-4xl">Welcome to Pluz Planner</h1>
          <p class="mt-2 text-ink-500">Create visual assets for your events</p>
          <div class="mt-8 w-full max-w-sm"><form class="flex items-center gap-2 rounded-2xl bg-ink-50 p-2" @submit.prevent="send"><button type="button" class="p-1 text-ink-500" aria-label="Attach reference" @click="fileInput?.click()"><Plus class="h-5 w-5" /></button><input v-model="input" placeholder="Chat with pluz planner" class="min-w-0 flex-1 border-0 bg-white p-2 rounded-xl text-sm focus:ring-0" aria-label="Message Pluz planner" /><button type="submit" class="flex h-9 w-9 items-center justify-center rounded-full bg-ink-400 text-white disabled:opacity-50" :class="input && 'bg-brand-600'" :disabled="!input || sending" aria-label="Send"><Send class="h-4 w-4" /></button></form></div>
          <div class="mt-8 grid w-full max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
            <RouterLink v-for="s in starters" :key="s.label" :to="s.to" class="group relative aspect-square overflow-hidden rounded-xl bg-ink-100"><img :src="s.image" :alt="s.label" loading="lazy" class="h-full w-full object-cover transition-transform group-hover:scale-105" /><span class="absolute inset-x-0 bottom-0 bg-black/40 px-3 py-2 text-left text-sm text-white">{{ s.label }}</span></RouterLink>
          </div>
        </div>

        <!-- chat -->
        <template v-else>
          <div ref="scroller" class="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            <template v-if="chatLoading"><UiSkeleton v-for="i in 3" :key="i" class="h-16 w-2/3 rounded-2xl" :class="i % 2 ? 'ml-auto' : ''" /></template>
            <div v-for="m in chat?.messages ?? []" v-else :key="m.id" :class="cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')">
              <UiAvatar v-if="m.role === 'user'" :src="auth.user?.avatarUrl" :name="auth.displayName" size="sm" />
              <span v-else class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><Bot class="h-4 w-4" /></span>
              <div :class="cn('max-w-[75%] rounded-2xl px-4 py-3 text-[15px]', m.role === 'user' ? 'bg-brand-50' : 'bg-ink-50')">
                <img v-for="a in m.attachments" :key="a.url" :src="a.url" alt="" class="mb-2 h-24 rounded-lg object-cover" />
                <p class="whitespace-pre-wrap">{{ m.content }}</p>
                <div v-if="m.generation?.status === 'ready'" class="mt-3 grid grid-cols-3 gap-2">
                  <a v-for="(u, i) in m.generation.resultUrls" :key="u" :href="u" target="_blank" rel="noopener noreferrer" class="group relative aspect-square overflow-hidden rounded-lg"><img :src="u" :alt="`Design option ${i + 1}`" class="h-full w-full object-cover" /><span class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100"><Download class="h-5 w-5 text-white" /></span></a>
                </div>
                <p v-else-if="m.generation" class="mt-2 text-sm text-ink-500">Generating designs…</p>
              </div>
            </div>
            <div v-if="sending" class="flex gap-3"><span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white"><Bot class="h-4 w-4" /></span><div class="flex items-center gap-1 rounded-2xl bg-ink-50 px-4 py-3"><span v-for="i in 3" :key="i" class="h-2 w-2 animate-bounce rounded-full bg-ink-400" :style="{ animationDelay: `${i * 0.15}s` }" /></div></div>
          </div>
          <div class="border-t border-ink-100 p-4">
            <div class="mb-2 flex flex-wrap gap-2"><button v-for="o in [['chat', 'Chat'], ['cake_design', 'Cake design'], ['event_branding', 'Branding'], ['menu', 'Menu'], ['hall_layout', 'Hall layout']]" :key="o[0]" type="button" :class="cn('chip px-3 py-1', intent === o[0] && 'border-brand-600 bg-brand-50 text-brand-700')" @click="intent = o[0] as PlannerIntent">{{ o[1] }}</button></div>
            <div v-if="attachment" class="mb-2 flex items-center gap-2 text-xs"><img :src="attachment.url" alt="" class="h-10 w-10 rounded object-cover" />Reference attached <button type="button" class="text-danger-500" @click="attachment = null">Remove</button></div>
            <form class="flex items-center gap-2" @submit.prevent="send">
              <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200" aria-label="Attach reference image" @click="fileInput?.click()"><ImagePlus class="h-4 w-4" /></button>
              <input v-model="input" placeholder="Describe what you want to create…" class="field flex-1 rounded-full" maxlength="2000" aria-label="Message Pluz planner" />
              <UiButton type="submit" icon-only :loading="sending" :disabled="!input.trim()" aria-label="Send"><Send class="h-4 w-4" /></UiButton>
            </form>
            <p class="mt-2 text-center text-xs text-ink-400">AI-generated designs are suggestions. Review before printing or sharing.</p>
          </div>
        </template>
        <input ref="fileInput" type="file" accept="image/*,application/pdf" class="sr-only" @change="onFile(($event.target as HTMLInputElement).files)" />
      </section>
    </div>
  </div>
</template>
