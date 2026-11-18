<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import CheckoutDrawer from '@/modules/checkout/CheckoutDrawer.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useCheckoutStore } from '@/stores/checkout.store'

const route = useRoute()
const auth = useAuthStore()
const checkout = useCheckoutStore()
const hideFooter = computed(() => route.matched.some((r) => r.meta.hideFooter))
const textured = computed(() => route.matched.some((r) => r.meta.textured))
</script>

<template>
  <div class="flex min-h-screen flex-col bg-white">
    <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
    <AppHeader />
    <div v-if="textured" class="texture-band h-24 md:h-32" aria-hidden="true" />
    <main id="main" class="flex-1">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <div :key="route.path"><component :is="Component" /></div>
        </Transition>
      </RouterView>
    </main>
    <AppFooter v-if="!hideFooter" />
    <CheckoutDrawer v-if="auth.isAuthenticated && checkout.event" />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.12s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
