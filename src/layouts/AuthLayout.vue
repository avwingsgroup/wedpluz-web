<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { ILLUSTRATIONS } from '@/assets/illustrations'

const route = useRoute()
const slides = ILLUSTRATIONS.onboarding
const active = ref(0)
let timer: number | null = null
onMounted(() => {
  timer = window.setInterval(() => (active.value = (active.value + 1) % slides.length), 5000)
})
onUnmounted(() => timer && window.clearInterval(timer))
</script>

<template>
  <div class="min-h-screen bg-white lg:grid lg:grid-cols-2">
    <div class="relative flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <RouterLink :to="{ name: 'home' }" class="absolute left-6 top-6 lg:hidden"><BrandLogo size="sm" /></RouterLink>
      <div class="w-full max-w-md">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in"><div :key="String(route.name)"><component :is="Component" /></div></Transition>
        </RouterView>
      </div>
    </div>
    <aside class="relative hidden overflow-hidden lg:block" aria-hidden="true">
      <Transition v-for="(s, i) in slides" :key="s.title" enter-active-class="transition duration-700" enter-from-class="opacity-0" leave-active-class="transition duration-700" leave-to-class="opacity-0">
        <div v-if="i === active" class="absolute inset-0">
          <img :src="s.image" alt="" class="h-full w-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-transparent to-brand-950/20" />
        </div>
      </Transition>
      <div class="absolute inset-x-0 top-10 flex justify-center"><BrandLogo variant="light" /></div>
      <div class="absolute inset-x-0 bottom-20 flex flex-col items-center gap-5 text-white">
        <h2 class="text-4xl font-bold">{{ slides[active]?.title }}</h2>
        <div class="flex gap-2">
          <button v-for="(s, i) in slides" :key="s.title" type="button" :aria-label="`Slide ${i + 1}`" class="h-2.5 rounded-full transition-all" :class="i === active ? 'w-8 bg-brand-400' : 'w-2.5 bg-white/60'" @click="active = i" />
        </div>
      </div>
    </aside>
  </div>
</template>
