<script setup lang="ts">
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { ChevronLeft } from 'lucide-vue-next'
const props = defineProps<{ to?: RouteLocationRaw; label?: string }>()
const router = useRouter()
function go() {
  if (props.to) router.push(props.to)
  else if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<template>
  <button type="button" class="inline-flex h-9 items-center gap-1 rounded-xl border border-ink-200 bg-white px-2 text-ink-700 hover:bg-ink-50" :aria-label="label ?? 'Go back'" @click="go">
    <ChevronLeft class="h-4 w-4" /><span v-if="label" class="pr-1 text-sm">{{ label }}</span>
  </button>
</template>
