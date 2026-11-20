<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { BadgeCheck, Heart, MapPin, Star } from 'lucide-vue-next'
import type { VendorSummary } from '@/types'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { vendorsApi } from '@/services/api/vendors.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{ vendor: VendorSummary; variant?: 'row' | 'tile' }>(), { variant: 'row' })
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const saved = ref(props.vendor.isSaved)
const contacting = ref(false)

async function toggleSave() {
  if (!auth.isAuthenticated) return router.push({ name: 'auth.login', query: { redirect: `/vendors/${props.vendor.slug}` } })
  const next = !saved.value
  saved.value = next
  try {
    if (next) await vendorsApi.save(props.vendor.id)
    else await vendorsApi.unsave(props.vendor.id)
  } catch {
    saved.value = !next
    ui.error('Could not update saved vendors')
  }
}
async function contact() {
  if (!auth.isAuthenticated) return router.push({ name: 'auth.login', query: { redirect: `/vendors/${props.vendor.slug}` } })
  contacting.value = true
  try {
    const { conversationId } = await vendorsApi.contact(props.vendor.id)
    router.push({ name: 'messages', params: { id: conversationId } })
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    contacting.value = false
  }
}
</script>

<template>
  <!-- Row variant measured from the design (Hire Vendors, 1440px): 8px radius, 16px padding, 64px avatar, 48px CTA, 5:3 works strip with 4px gaps. -->
  <article :class="cn('card p-3 md:p-4', variant === 'row' && 'rounded-lg border-[#ecedee]')">
    <div :class="cn('flex gap-3', variant === 'row' ? 'items-center gap-4' : 'items-start')">
      <RouterLink :to="`/vendors/${vendor.slug}`" class="relative shrink-0">
        <UiAvatar :src="vendor.avatarUrl" :name="vendor.businessName" size="lg" :class="variant === 'row' && 'md:h-16! md:w-16!'" />
        <BadgeCheck v-if="vendor.isVerified" class="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white fill-success-500 text-white" />
      </RouterLink>
      <div class="min-w-0 flex-1">
        <RouterLink :to="`/vendors/${vendor.slug}`" class="block truncate font-medium text-[#333740] hover:text-brand-600">{{ vendor.businessName }}</RouterLink>
        <p class="mt-0.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[#5b5f6a]">
          <span>{{ vendor.category.name }}</span>
          <span class="inline-flex items-center gap-1"><Star class="h-3.5 w-3.5 fill-warning-500 text-warning-500" />{{ vendor.rating > 0 ? vendor.rating.toFixed(1) : 'New' }}</span>
          <span class="inline-flex items-center gap-1"><MapPin class="h-3.5 w-3.5" />{{ vendor.location }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" :class="cn('flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 text-ink-700 hover:bg-ink-50', variant === 'row' && 'md:h-[42px] md:w-[42px]', saved && 'text-pink-500 border-pink-100')" :aria-pressed="saved" :aria-label="saved ? 'Remove from saved' : 'Save vendor'" @click="toggleSave"><Heart :class="cn('h-5 w-5', saved && 'fill-current')" /></button>
        <UiButton v-if="variant === 'row'" size="sm" class="hidden sm:inline-flex md:ml-2 md:h-12! md:px-6! md:text-base!" :loading="contacting" @click="contact">Get in Touch</UiButton>
      </div>
    </div>
    <RouterLink :to="`/vendors/${vendor.slug}`" :class="cn('mt-3 grid grid-cols-4 overflow-hidden', variant === 'row' ? 'gap-1 rounded-sm' : 'gap-1.5 rounded-xl')">
      <div v-for="(m, i) in vendor.featuredWorks.slice(0, 4)" :key="m.id" :class="cn('bg-ink-100', variant === 'row' ? 'aspect-[5/3]' : 'aspect-square', i > 1 && variant === 'tile' && 'hidden sm:block')">
        <img :src="m.thumbnailUrl ?? m.url" :alt="`${vendor.businessName} work ${i + 1}`" loading="lazy" class="h-full w-full object-cover" />
      </div>
      <div v-for="i in Math.max(0, 4 - vendor.featuredWorks.length)" :key="`ph-${i}`" :class="cn('bg-ink-100', variant === 'row' ? 'aspect-[5/3]' : 'aspect-square')" />
    </RouterLink>
    <UiButton v-if="variant === 'row'" size="sm" block class="mt-3 sm:hidden" :loading="contacting" @click="contact">Get in Touch</UiButton>
  </article>
</template>
