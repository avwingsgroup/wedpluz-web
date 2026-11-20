<script setup lang="ts">
import BrandLogo from '@/components/brand/BrandLogo.vue'

// Frame for the admin sign-in screens (login, accept invitation): the plum background with the footer's white
// specks and brand glows, and a white card with the logo and an "Admin" badge.
</script>

<template>
  <div class="plum-stars-glow flex min-h-screen items-center justify-center px-4 py-10">
    <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-dialog sm:p-8">
      <div class="flex items-center justify-between">
        <BrandLogo />
        <span class="rounded-md bg-brand-950 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Admin</span>
      </div>
      <slot />
    </div>
  </div>
</template>
