<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  Activity, Banknote, Bell, Building2, CalendarDays, ChartColumn, ChevronDown, ChevronsLeft, CircleHelp, Flag, LayoutDashboard, LogOut, Menu, Search, Settings, Shield, Ticket, Users, X,
} from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import { useAdminStore } from '@/stores/admin.store'
import { cn } from '@/utils/cn'
import type { PermissionKey } from '@/types'

const admin = useAdminStore()
const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const isBlank = computed(() => route.meta.layout === 'blank')

interface NavItem { label: string; to: string; icon?: unknown; perm?: PermissionKey; children?: NavItem[] }
const nav = computed<NavItem[]>(() =>
  (
    [
      { label: 'Dashboard', to: 'admin.dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
      { label: 'Users', to: 'admin.users', icon: Users, perm: 'users.view', children: [{ label: 'All users', to: 'admin.users' }, { label: 'Deletion requests', to: 'admin.users.deletions' }] },
      { label: 'Events', to: 'admin.events', icon: CalendarDays, perm: 'events.view', children: [{ label: 'All events', to: 'admin.events' }, { label: 'Categories & tags', to: 'admin.categories' }] },
      { label: 'Organizers & Vendors', to: 'admin.organizers', icon: Building2, perm: 'organizers.view' },
      { label: 'Bookings', to: 'admin.bookings', icon: Ticket, perm: 'bookings.view', children: [{ label: 'Bookings', to: 'admin.bookings' }, { label: 'Disputes', to: 'admin.disputes' }, { label: 'QR validations', to: 'admin.checkins' }, { label: 'Ticket inventory', to: 'admin.inventory' }] },
      { label: 'Finance', to: 'admin.finance', icon: Banknote, perm: 'finance.view', children: [{ label: 'Overview', to: 'admin.finance' }, { label: 'Transactions', to: 'admin.transactions' }, { label: 'Settlements', to: 'admin.settlements', perm: 'finance.settlements' }, { label: 'Payouts', to: 'admin.payouts' }, { label: 'Refunds', to: 'admin.refunds', perm: 'refunds.view' }, { label: 'Commissions', to: 'admin.commissions' }, { label: 'Gateways', to: 'admin.gateways' }] },
      { label: 'Moderation', to: 'admin.moderation', icon: Flag, perm: 'moderation.view', children: [{ label: 'Reports', to: 'admin.moderation' }, { label: 'Communities', to: 'admin.communities' }] },
      { label: 'Notifications', to: 'admin.campaigns', icon: Bell, perm: 'notifications.view', children: [{ label: 'Campaigns', to: 'admin.campaigns' }, { label: 'Templates', to: 'admin.templates' }] },
      { label: 'Reports', to: 'admin.reports', icon: ChartColumn, perm: 'reports.view' },
      { label: 'Support', to: 'admin.support', icon: CircleHelp, perm: 'support.view' },
      { label: 'Settings', to: 'admin.settings', icon: Settings, perm: 'settings.view', children: [{ label: 'Platform', to: 'admin.settings' }, { label: 'Banners', to: 'admin.banners' }, { label: 'Content pages', to: 'admin.content' }] },
      { label: 'Access & audit', to: 'admin.roles', icon: Shield, perm: 'audit.view', children: [{ label: 'Roles & permissions', to: 'admin.roles', perm: 'roles.manage' }, { label: 'Administrators', to: 'admin.admins', perm: 'roles.manage' }, { label: 'Audit logs', to: 'admin.audit' }, { label: 'Security logs', to: 'admin.security' }] },
    ] as NavItem[]
  )
    .filter((i) => !i.perm || admin.can(i.perm) || (i.children?.some((c) => c.perm && admin.can(c.perm)) ?? false))
    .map((i) => ({ ...i, children: i.children?.filter((c) => !c.perm || admin.can(c.perm)) })),
)

const expanded = ref<Record<string, boolean>>({})
function groupActive(item: NavItem) {
  const name = String(route.name ?? '')
  return name === item.to || (item.children?.some((c) => c.to === name) ?? false) || name.startsWith(item.to.replace(/s$/, ''))
}
function toggle(item: NavItem) {
  expanded.value[item.to] = !(expanded.value[item.to] ?? groupActive(item))
}
const sectionTitle = computed(() => route.meta.title ?? 'Admin')
const menuItems = computed(() => [
  { label: 'Security logs', icon: Activity, onClick: () => router.push({ name: 'admin.security' }) },
  { label: 'Sign out', icon: LogOut, danger: true, onClick: () => void admin.logout().then(() => router.push({ name: 'admin.login' })) },
])
const globalSearch = ref('')
function onSearch() {
  const q = globalSearch.value.trim()
  if (!q) return
  if (/^WP-ORD|^WP-TX|^WP-RF/i.test(q)) router.push({ name: 'admin.bookings', query: { search: q } })
  else if (q.includes('@')) router.push({ name: 'admin.users', query: { search: q } })
  else router.push({ name: 'admin.events', query: { search: q } })
  globalSearch.value = ''
}
</script>

<template>
  <RouterView v-if="isBlank" />
  <div v-else class="flex min-h-screen bg-ink-50">
    <!-- sidebar -->
    <aside :class="cn('fixed inset-y-0 left-0 z-50 flex flex-col bg-brand-950 text-white transition-all duration-200 lg:static', admin.sidebarCollapsed ? 'w-[72px]' : 'w-64', mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')">
      <div class="flex h-16 items-center justify-between px-4">
        <RouterLink :to="{ name: 'admin.dashboard' }" class="flex items-center gap-2"><BrandLogo variant="light" :icon-only="admin.sidebarCollapsed" /><span v-if="!admin.sidebarCollapsed" class="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Admin</span></RouterLink>
        <button type="button" class="rounded-lg p-1.5 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Close menu" @click="mobileOpen = false"><X class="h-5 w-5" /></button>
      </div>
      <nav class="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 scrollbar-none" aria-label="Admin">
        <template v-for="item in nav" :key="item.to">
          <RouterLink v-if="!item.children?.length" :to="{ name: item.to }" :class="cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors', groupActive(item) ? 'bg-white/15 font-medium text-white' : 'text-white/75 hover:bg-white/10 hover:text-white')" :title="item.label">
            <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" /><span v-if="!admin.sidebarCollapsed" class="truncate">{{ item.label }}</span>
          </RouterLink>
          <div v-else>
            <button type="button" :class="cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors', groupActive(item) ? 'text-white font-medium' : 'text-white/75 hover:bg-white/10 hover:text-white')" :title="item.label" @click="admin.sidebarCollapsed ? router.push({ name: item.to }) : toggle(item)">
              <component :is="item.icon" class="h-[18px] w-[18px] shrink-0" />
              <span v-if="!admin.sidebarCollapsed" class="flex-1 truncate text-left">{{ item.label }}</span>
              <ChevronDown v-if="!admin.sidebarCollapsed" :class="cn('h-4 w-4 transition-transform', (expanded[item.to] ?? groupActive(item)) && 'rotate-180')" />
            </button>
            <div v-if="!admin.sidebarCollapsed && (expanded[item.to] ?? groupActive(item))" class="ml-5 mt-0.5 space-y-0.5 border-l border-white/10 pl-4">
              <RouterLink v-for="c in item.children" :key="c.to" :to="{ name: c.to }" :class="cn('block rounded-lg px-3 py-2 text-[13px] transition-colors', route.name === c.to ? 'bg-white/15 text-white font-medium' : 'text-white/65 hover:text-white hover:bg-white/10')">{{ c.label }}</RouterLink>
            </div>
          </div>
        </template>
      </nav>
      <button type="button" class="hidden items-center gap-3 border-t border-white/10 px-5 py-3 text-xs text-white/60 hover:text-white lg:flex" @click="admin.sidebarCollapsed = !admin.sidebarCollapsed">
        <ChevronsLeft :class="cn('h-4 w-4 transition-transform', admin.sidebarCollapsed && 'rotate-180')" /><span v-if="!admin.sidebarCollapsed">Collapse</span>
      </button>
    </aside>
    <div v-if="mobileOpen" class="fixed inset-0 z-40 bg-ink-900/50 lg:hidden" @click="mobileOpen = false" />

    <!-- main -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/90 px-4 backdrop-blur md:px-6">
        <button type="button" class="rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden" aria-label="Open menu" @click="mobileOpen = true"><Menu class="h-5 w-5" /></button>
        <h1 class="truncate text-lg font-bold text-ink-900">{{ sectionTitle }}</h1>
        <form class="ml-auto hidden w-full max-w-sm md:block" role="search" @submit.prevent="onSearch">
          <label class="relative block">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input v-model="globalSearch" type="search" placeholder="Search users, events, references…" class="field h-10 rounded-full py-0 pl-9 text-sm" />
          </label>
        </form>
        <UiDropdown :items="menuItems">
          <template #trigger>
            <button type="button" class="ml-2 flex items-center gap-3 rounded-full py-1 pl-1 pr-3 hover:bg-ink-100" aria-label="Admin menu">
              <UiAvatar :src="admin.admin?.avatarUrl" :name="`${admin.admin?.firstName} ${admin.admin?.lastName}`" size="sm" />
              <span class="hidden text-left sm:block"><span class="block text-sm font-medium leading-tight text-ink-900">{{ admin.admin?.firstName }} {{ admin.admin?.lastName }}</span><span class="block text-[11px] text-ink-500">{{ admin.admin?.roles.map((r) => r.name).join(', ') }}</span></span>
            </button>
          </template>
        </UiDropdown>
      </header>
      <main class="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
        <RouterView v-slot="{ Component }"><Transition name="page" mode="out-in"><div :key="route.path"><component :is="Component" /></div></Transition></RouterView>
      </main>
    </div>
  </div>
</template>
