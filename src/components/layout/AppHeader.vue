<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Bell, LogOut, Menu, MessageCircle, Settings, User, X } from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import NotificationsDrawer from '@/modules/notifications/NotificationsDrawer.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { useBadgeStore } from '@/stores/notifications.store'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{ overlay?: boolean }>(), { overlay: false })
const auth = useAuthStore()
const ui = useUiStore()
const badges = useBadgeStore()
const route = useRoute()
const router = useRouter()
const notifOpen = ref(false)
// Design: a 104px borderless bar; once the page scrolls it condenses to 76px and gains a hairline so content reads under it.
const scrolled = ref(false)
const onScroll = () => (scrolled.value = window.scrollY > 8)
onMounted(() => { onScroll(); window.addEventListener('scroll', onScroll, { passive: true }) })
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

const navLinks = computed(() => {
  if (!auth.isAuthenticated) {
    return [
      { label: 'Hire Vendors', to: { name: 'vendors' } },
      { label: 'About us', to: { name: 'about' } },
      { label: 'Contact', to: { name: 'help' } },
    ]
  }
  return auth.audience === 'businesses'
    ? [
        { label: 'Hire Vendors', to: { name: 'vendors' } },
        { label: 'My Events', to: { name: 'manage.events' } },
        { label: 'Pluz planner', to: { name: 'planner' } },
        { label: 'Pricing', to: { name: 'pricing' } },
      ]
    : [
        { label: 'Hire Vendors', to: { name: 'vendors' } },
        { label: 'Manage Event', to: { name: 'manage.events' } },
        { label: 'Pluz planner', to: { name: 'planner' } },
        { label: 'Pricing', to: { name: 'pricing' } },
      ]
})

function isActive(to: { name: string }) {
  const name = String(route.name ?? '')
  if (to.name === 'manage.events') return name.startsWith('manage.')
  if (to.name === 'planner') return name.startsWith('planner')
  if (to.name === 'vendors') return name === 'vendors' || name === 'vendor'
  return name === to.name
}

const menuItems = computed(() => [
  { label: 'My Profile', icon: User, onClick: () => router.push({ name: 'profile' }) },
  { label: 'My Tickets', icon: User, onClick: () => router.push({ name: 'tickets' }) },
  { label: 'My Wallet', icon: User, onClick: () => router.push({ name: 'wallet' }) },
  { label: 'Saved', icon: User, onClick: () => router.push({ name: 'saved' }) },
  { label: 'Earn with Wedpluz', icon: User, onClick: () => router.push({ name: 'earn' }) },
  { label: 'Premium', icon: User, onClick: () => router.push({ name: 'premium' }) },
  { label: 'Settings', icon: Settings, onClick: () => router.push({ name: 'settings' }) },
  { divider: true, label: '' },
  { label: 'Logout', icon: LogOut, danger: true, onClick: () => void auth.logout().then(() => router.push({ name: 'home' })) },
])

function setAudience(a: 'individuals' | 'businesses') {
  auth.setAudience(a)
  if (a === 'businesses' && auth.isAuthenticated && !auth.isVendor) router.push({ name: 'business.create' })
}
</script>

<template>
  <header :class="cn('z-40 w-full transition-[background-color,box-shadow] duration-200', props.overlay ? 'absolute inset-x-0 top-0' : 'sticky top-0', !props.overlay && (scrolled || ui.mobileNavOpen ? 'bg-white/95 shadow-[0_1px_0_rgb(16_24_40/0.06)] backdrop-blur' : 'bg-white'))">
    <div :class="cn('container-app flex items-center gap-4 transition-[height] duration-200', props.overlay ? 'mt-4 h-16 max-w-[1296px] rounded-full border border-white/50 bg-white/65 shadow-[0_8px_32px_rgb(16_24_40/0.08)] backdrop-blur-md lg:h-[72px] lg:px-6!' : scrolled ? 'h-[76px]' : 'h-[72px] lg:h-[104px]')">
      <RouterLink :to="{ name: 'home' }" class="shrink-0" aria-label="Wedpluz home"><BrandLogo class="lg:[&_img]:h-[37px]" /></RouterLink>

      <!-- audience switch -->
      <div class="ml-2 hidden h-12 items-center rounded-full bg-[#f6f6f6] p-1 md:flex xl:ml-[19px]" role="tablist" aria-label="Audience">
        <button v-for="a in (['individuals', 'businesses'] as const)" :key="a" type="button" role="tab" :aria-selected="auth.audience === a" :class="cn('h-10 rounded-full px-[18px] text-sm transition-colors xl:w-[132px] xl:px-0', auth.audience === a ? 'bg-white text-[#333740] shadow-[0_1px_2px_rgb(16_24_40/0.06)]' : 'text-[#5b5f6a] hover:text-ink-900')" @click="setAudience(a)">
          {{ a === 'individuals' ? 'For Individuals' : 'For Businesses' }}
        </button>
      </div>

      <nav class="hidden items-center gap-6 lg:ml-8 lg:flex xl:ml-[41px]" aria-label="Primary">
        <RouterLink v-for="l in navLinks" :key="l.label" :to="l.to" :class="cn('text-base transition-colors hover:text-brand-600', isActive(l.to) ? 'font-medium text-brand-600' : 'text-[#5b5f6a]')">{{ l.label }}</RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <template v-if="auth.isAuthenticated">
          <RouterLink :to="{ name: 'messages' }" class="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100" aria-label="Messages">
            <MessageCircle class="h-5 w-5" />
            <span v-if="badges.unreadMessages" class="absolute right-2 top-2 h-2 w-2 rounded-full bg-pink-500 ring-2 ring-white" />
          </RouterLink>
          <button type="button" class="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100" aria-label="Notifications" @click="notifOpen = true">
            <Bell class="h-5 w-5" />
            <span v-if="badges.unreadNotifications" class="absolute right-2 top-2 h-2 w-2 rounded-full bg-pink-500 ring-2 ring-white" />
          </button>
          <UiDropdown :items="menuItems" width="w-56">
            <template #trigger>
              <button type="button" class="ml-1 flex items-center rounded-full ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand-600" aria-label="Account menu">
                <UiAvatar :src="auth.user?.avatarUrl" :name="auth.displayName" size="md" :online="true" />
              </button>
            </template>
          </UiDropdown>
        </template>
        <template v-else>
          <RouterLink :to="{ name: 'auth.login' }" class="hidden h-12 items-center rounded-full px-4 text-base font-medium text-brand-600 hover:text-brand-700 sm:inline-flex xl:mr-[17px]">Login</RouterLink>
          <UiButton :to="{ name: 'auth.signup' }" class="h-10! px-4! text-sm! font-medium! sm:h-12! sm:w-[105px] sm:px-0! sm:text-base!">Sign up</UiButton>
        </template>
        <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100 lg:hidden" :aria-expanded="ui.mobileNavOpen" aria-label="Menu" @click="ui.mobileNavOpen = !ui.mobileNavOpen">
          <X v-if="ui.mobileNavOpen" class="h-5 w-5" /><Menu v-else class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- mobile nav -->
    <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 -translate-y-2" leave-active-class="transition duration-100" leave-to-class="opacity-0">
      <div v-if="ui.mobileNavOpen" class="border-t border-ink-100 bg-white lg:hidden">
        <div class="container-app flex flex-col gap-1 py-3">
          <div class="mb-2 flex rounded-full bg-ink-100 p-1 md:hidden">
            <button v-for="a in (['individuals', 'businesses'] as const)" :key="a" type="button" :class="cn('flex-1 rounded-full px-4 py-1.5 text-sm', auth.audience === a ? 'bg-white font-medium text-ink-900 shadow-sm' : 'text-ink-500')" @click="setAudience(a)">{{ a === 'individuals' ? 'For Individuals' : 'For Businesses' }}</button>
          </div>
          <RouterLink v-for="l in navLinks" :key="l.label" :to="l.to" class="rounded-xl px-3 py-2.5 text-[15px] text-ink-700 hover:bg-ink-50" :class="isActive(l.to) && 'text-brand-600 font-medium'">{{ l.label }}</RouterLink>
          <template v-if="auth.isAuthenticated">
            <RouterLink :to="{ name: 'tickets' }" class="rounded-xl px-3 py-2.5 text-[15px] text-ink-700 hover:bg-ink-50">My Tickets</RouterLink>
            <RouterLink :to="{ name: 'wallet' }" class="rounded-xl px-3 py-2.5 text-[15px] text-ink-700 hover:bg-ink-50">My Wallet</RouterLink>
            <RouterLink :to="{ name: 'earn' }" class="rounded-xl px-3 py-2.5 text-[15px] text-ink-700 hover:bg-ink-50">Earn with Wedpluz</RouterLink>
          </template>
          <RouterLink v-else :to="{ name: 'auth.login' }" class="rounded-xl px-3 py-2.5 text-[15px] text-brand-600 hover:bg-ink-50">Login</RouterLink>
        </div>
      </div>
    </Transition>
    <NotificationsDrawer v-if="auth.isAuthenticated" v-model:open="notifOpen" />
  </header>
</template>
