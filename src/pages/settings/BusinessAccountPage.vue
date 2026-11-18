<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ChevronRight, Trash2 } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import { vendorsApi } from '@/services/api/vendors.api'
import { useAsync } from '@/composables/useAsync'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { ILLUSTRATIONS } from '@/assets/illustrations'

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const { data: vendor, loading, refresh } = useAsync(() => vendorsApi.myProfile())

async function remove() {
  if (!vendor.value) return
  const ok = await ui.confirm({ title: 'Delete business account?', description: 'Your works, promos and reviews will be removed and clients will no longer find you.', variant: 'danger', confirmLabel: 'Delete business', requireText: vendor.value.businessName })
  if (!ok) return
  await vendorsApi.deleteProfile()
  await auth.refreshUser()
  ui.success('Business account deleted')
  void refresh()
}
</script>

<template>
  <div>
    <h2 class="text-3xl">Business Account</h2>
    <UiSkeleton v-if="loading" class="mt-6 h-40 rounded-2xl" />
    <div v-else-if="!vendor" class="mx-auto mt-12 max-w-lg text-center">
      <img :src="ILLUSTRATIONS.businessCard" alt="" class="mx-auto h-44 w-60 rounded-2xl object-cover" loading="lazy" />
      <h3 class="mt-6 text-xl font-semibold">Create a Business Account</h3>
      <p class="mt-2 text-sm text-ink-500">Whether you’re a photographer, decorator, chef, DJ, etc. Let the right people find you.</p>
      <UiButton size="lg" block class="mt-6" :to="{ name: 'business.create' }">Become a Vendor</UiButton>
    </div>
    <div v-else class="mt-6 space-y-3">
      <div class="card flex items-center gap-4 p-4"><UiAvatar :src="vendor.avatarUrl" :name="vendor.businessName" size="lg" /><div class="flex-1"><p class="font-semibold">{{ vendor.businessName }}</p><p class="text-sm text-ink-500">{{ vendor.category.name }} · {{ vendor.location }}</p></div><UiButton size="sm" :to="{ name: 'business' }">View</UiButton></div>
      <div class="divide-y divide-ink-100">
        <button type="button" class="flex w-full items-center justify-between px-3 py-4 hover:bg-ink-50" @click="router.push({ name: 'business.create', query: { edit: '1' } })"><span>Business account info</span><ChevronRight class="h-4 w-4" /></button>
        <button type="button" class="flex w-full items-center justify-between px-3 py-4 hover:bg-ink-50" @click="router.push({ name: 'business.work.new' })"><span>Add work</span><ChevronRight class="h-4 w-4" /></button>
        <button type="button" class="flex w-full items-center justify-between px-3 py-4 hover:bg-ink-50" @click="router.push({ name: 'premium' })"><span>Promote your business</span><ChevronRight class="h-4 w-4" /></button>
        <button type="button" class="flex w-full items-center justify-between px-3 py-4 text-danger-500 hover:bg-danger-50" @click="remove"><span class="flex items-center gap-2"><Trash2 class="h-5 w-5" />Delete business account</span><ChevronRight class="h-4 w-4 text-ink-700" /></button>
      </div>
    </div>
  </div>
</template>
