<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import { accountApi } from '@/services/api/account.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { MAX_INTERESTS } from '@/config/app'
import { cn } from '@/utils/cn'

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const options = ref<Array<{ label: string; slug: string }>>([])
const selected = ref<string[]>([...(auth.user?.interests ?? [])])
const loading = ref(true)
const saving = ref(false)

onMounted(async () => {
  try {
    options.value = await accountApi.interests()
  } finally {
    loading.value = false
  }
})
function toggle(slug: string) {
  if (selected.value.includes(slug)) selected.value = selected.value.filter((s) => s !== slug)
  else if (selected.value.length < MAX_INTERESTS) selected.value = [...selected.value, slug]
}
async function save() {
  saving.value = true
  try {
    const user = await accountApi.updateInterests(selected.value)
    auth.setUser(user)
    auth.pendingStep = null
    router.push(auth.redirectAfterLogin || { name: 'home' })
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="rounded-3xl bg-white p-6 shadow-[0_20px_60px_-30px_rgba(39,4,39,0.25)] sm:p-8">
    <div class="text-center"><h1 class="text-2xl">What are you interested in?</h1><p class="mt-1 text-sm text-ink-500">Pick up to {{ MAX_INTERESTS }} things you’re interested in. Let’s personalize your home feed.</p></div>
    <div class="mt-6 flex flex-wrap gap-3">
      <template v-if="loading"><UiSkeleton v-for="i in 12" :key="i" class="h-11 w-28 rounded-full" /></template>
      <button v-for="o in options" v-else :key="o.slug" type="button" :aria-pressed="selected.includes(o.slug)" :class="cn('rounded-full border px-4 py-2.5 font-chip text-sm transition-colors', selected.includes(o.slug) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-700 hover:border-ink-300', !selected.includes(o.slug) && selected.length >= MAX_INTERESTS && 'opacity-50')" @click="toggle(o.slug)">{{ o.label }}</button>
    </div>
    <UiButton size="lg" block class="mt-10" :variant="selected.length ? 'primary' : 'secondary'" :disabled="!selected.length" :loading="saving" @click="save">Continue ({{ selected.length }}/{{ MAX_INTERESTS }})</UiButton>
  </div>
</template>
