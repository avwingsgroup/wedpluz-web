<script setup lang="ts">
import { RefreshCw, TriangleAlert, WifiOff, Lock, SearchX } from 'lucide-vue-next'
import type { ApiError } from '@/services/http'
import UiButton from '@/components/ui/UiButton.vue'
import { cn } from '@/utils/cn'

withDefaults(defineProps<{ error: ApiError | null; compact?: boolean; retryLabel?: string }>(), { compact: false, retryLabel: 'Try again' })
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="error" :class="cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-16')" role="alert">
    <span class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-500">
      <WifiOff v-if="error.isNetwork" class="h-6 w-6" />
      <Lock v-else-if="error.isForbidden || error.isUnauthenticated" class="h-6 w-6" />
      <SearchX v-else-if="error.isNotFound" class="h-6 w-6" />
      <TriangleAlert v-else class="h-6 w-6" />
    </span>
    <h3 class="text-lg font-bold text-ink-900">
      {{ error.isNetwork ? 'You’re offline' : error.isNotFound ? 'Not found' : error.isForbidden ? 'Access denied' : 'Something went wrong' }}
    </h3>
    <p class="mt-1 max-w-sm text-sm text-ink-500">{{ error.message }}</p>
    <p v-if="error.correlationId" class="mt-1 text-xs text-ink-400">Ref: {{ error.correlationId }}</p>
    <UiButton v-if="!error.isNotFound && !error.isForbidden" variant="outline" size="sm" class="mt-5" @click="emit('retry')"><RefreshCw class="h-4 w-4" />{{ retryLabel }}</UiButton>
    <slot />
  </div>
</template>
