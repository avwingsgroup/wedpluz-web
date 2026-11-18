<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { Armchair, Cake, MessageSquare, Palette, PanelLeftClose, Plus, Sparkles, Trash2, UtensilsCrossed } from 'lucide-vue-next'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import { cn } from '@/utils/cn'
import type { PlannerChat } from '@/types'

defineProps<{ chats: Array<Pick<PlannerChat, 'id' | 'title' | 'updatedAt'>>; loading?: boolean }>()
const emit = defineEmits<{ newChat: []; deleteChat: [id: string]; collapse: [] }>()
const route = useRoute()
const router = useRouter()
const tools = [
  { label: 'Menu', icon: UtensilsCrossed, to: { name: 'planner.menu' } },
  { label: 'Hall layout', icon: Armchair, to: { name: 'planner.hall' } },
  { label: 'Cake design', icon: Cake, to: { name: 'planner.design', params: { type: 'cake' } } },
  { label: 'Event branding', icon: Palette, to: { name: 'planner.design', params: { type: 'branding' } } },
]
</script>

<template>
  <aside class="flex h-full flex-col rounded-3xl bg-ink-50 p-4">
    <div class="flex items-center justify-between"><h2 class="font-semibold">Pluz planner</h2><button type="button" class="rounded-lg p-1.5 hover:bg-white" aria-label="Collapse sidebar" @click="emit('collapse')"><PanelLeftClose class="h-5 w-5" /></button></div>
    <div class="mt-5 rounded-2xl bg-white p-1">
      <button type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-ink-50" @click="emit('newChat')"><Plus class="h-5 w-5" />New chat</button>
      <RouterLink :to="{ name: 'planner.assets' }" :class="cn('flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-ink-50', route.name === 'planner.assets' && 'bg-brand-50 text-brand-700')"><Sparkles class="h-5 w-5" />Assets</RouterLink>
    </div>
    <p class="mt-6 font-medium">Create</p>
    <div class="mt-2 rounded-2xl bg-white p-1"><RouterLink v-for="t in tools" :key="t.label" :to="t.to" class="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-ink-50"><span class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><component :is="t.icon" class="h-5 w-5" /></span>{{ t.label }}</RouterLink></div>
    <p class="mt-6 font-medium">Recent chats</p>
    <div class="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
      <template v-if="loading"><UiSkeleton v-for="i in 3" :key="i" class="h-9 rounded-xl" /></template>
      <p v-else-if="!chats.length" class="px-2 text-xs text-ink-500">No chats yet</p>
      <div v-for="c in chats" v-else :key="c.id" :class="cn('group flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white', route.params.id === c.id && 'bg-white')">
        <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="router.push({ name: 'planner.chat', params: { id: c.id } })"><MessageSquare class="h-4 w-4 shrink-0 text-ink-400" /><span class="truncate">{{ c.title }}</span></button>
        <button type="button" class="text-ink-400 opacity-0 hover:text-danger-500 group-hover:opacity-100" aria-label="Delete chat" @click="emit('deleteChat', c.id)"><Trash2 class="h-4 w-4" /></button>
      </div>
    </div>
  </aside>
</template>
