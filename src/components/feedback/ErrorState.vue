<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { MailCheck, RefreshCw, TriangleAlert, WifiOff, Lock, SearchX } from 'lucide-vue-next'
import type { ApiError } from '@/services/http'
import UiButton from '@/components/ui/UiButton.vue'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{ error: ApiError | null; compact?: boolean; retryLabel?: string }>(), { compact: false, retryLabel: 'Try again' })
// The API gates checkout, event creation and the wallet behind email verification (403). It sends
// FORBIDDEN with a "Verify your email" message today; EMAIL_UNVERIFIED is the proposed dedicated code.
const needsEmailVerification = computed(() => !!props.error && (props.error.code === 'EMAIL_UNVERIFIED' || (props.error.isForbidden && /verify your email/i.test(props.error.message))))
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="error" :class="cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-16')" role="alert">
    <span class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-500">
      <WifiOff v-if="error.isNetwork" class="h-6 w-6" />
      <MailCheck v-else-if="needsEmailVerification" class="h-6 w-6" />
      <Lock v-else-if="error.isForbidden || error.isUnauthenticated" class="h-6 w-6" />
      <SearchX v-else-if="error.isNotFound" class="h-6 w-6" />
      <TriangleAlert v-else class="h-6 w-6" />
    </span>
    <h3 class="text-lg font-bold text-ink-900">
      {{ error.isNetwork ? 'You’re offline' : error.isNotFound ? 'Not found' : needsEmailVerification ? 'Verify your email' : error.isForbidden ? 'Access denied' : 'Something went wrong' }}
    </h3>
    <p class="mt-1 max-w-sm text-sm text-ink-500">{{ error.message }}</p>
    <p v-if="error.correlationId" class="mt-1 text-xs text-ink-400">Ref: {{ error.correlationId }}</p>
    <UiButton v-if="!error.isNotFound && !error.isForbidden" variant="outline" size="sm" class="mt-5" @click="emit('retry')"><RefreshCw class="h-4 w-4" />{{ retryLabel }}</UiButton>
    <RouterLink v-if="needsEmailVerification" :to="{ name: 'auth.verify-email' }" class="mt-5 inline-flex h-9 items-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><MailCheck class="h-4 w-4" />Verify email</RouterLink>
    <slot />
  </div>
</template>
