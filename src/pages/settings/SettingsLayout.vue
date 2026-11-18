<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Bell, Briefcase, ChevronRight, CircleHelp, Globe, Info, Lock, LogOut, MonitorSmartphone, UserRound } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const groups = [
  [{ name: 'settings.account', label: 'Account', icon: UserRound }, { name: 'settings.business', label: 'Business Account', icon: Briefcase }],
  [
    { name: 'settings.privacy', label: 'Privacy settings', icon: Lock },
    { name: 'settings.notifications', label: 'Notifications', icon: Bell },
    { name: 'settings.sessions', label: 'Devices & sessions', icon: MonitorSmartphone },
    { name: 'settings.help', label: 'Get Help', icon: CircleHelp },
    { name: 'settings.language', label: 'Language', icon: Globe, hint: 'ENG' },
    { name: 'settings.about', label: 'About Wedpluz', icon: Info },
  ],
]
const isRoot = computed(() => route.name === 'settings.account' && !route.query.section)
async function logout() {
  if (!(await ui.confirm({ title: 'Log out of Wedpluz?', confirmLabel: 'Log out' }))) return
  await auth.logout()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="container-app grid gap-8 pb-10 lg:grid-cols-[400px_minmax(0,1fr)]">
    <aside :class="cn('rounded-3xl bg-ink-50 p-4', !isRoot && 'hidden lg:block')">
      <h1 class="px-2 py-3 text-3xl">Settings</h1>
      <nav class="space-y-3" aria-label="Settings">
        <div v-for="(g, i) in groups" :key="i" class="rounded-2xl bg-white p-1">
          <RouterLink v-for="item in g" :key="item.name" :to="{ name: item.name }" :class="cn('flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] transition-colors hover:bg-ink-50', route.name === item.name && 'bg-brand-50 text-brand-700')">
            <component :is="item.icon" class="h-5 w-5" /><span class="flex-1">{{ item.label }}</span><span v-if="item.hint" class="text-sm text-ink-500">{{ item.hint }}</span><ChevronRight class="h-4 w-4" />
          </RouterLink>
        </div>
        <div class="rounded-2xl bg-white p-1"><button type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] hover:bg-ink-50" @click="logout"><LogOut class="h-5 w-5" />Log out</button></div>
      </nav>
    </aside>
    <section class="min-w-0">
      <RouterLink v-if="!isRoot" :to="{ name: 'settings.account', query: {} }" class="mb-4 inline-flex text-sm text-brand-600 lg:hidden">← Settings</RouterLink>
      <RouterView />
    </section>
  </div>
</template>
