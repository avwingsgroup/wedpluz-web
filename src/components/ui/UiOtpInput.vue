<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { OTP_LENGTH } from '@/config/app'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{ modelValue: string; length?: number; error?: string; disabled?: boolean; autofocus?: boolean }>(), { length: OTP_LENGTH, autofocus: true })
const emit = defineEmits<{ 'update:modelValue': [value: string]; complete: [value: string] }>()
const inputs = ref<HTMLInputElement[]>([])
const digits = computed(() => Array.from({ length: props.length }, (_, i) => props.modelValue[i] ?? ''))

function setDigit(i: number, v: string) {
  const clean = v.replace(/\D/g, '')
  const arr = digits.value.slice()
  if (clean.length > 1) {
    // Paste support
    clean.split('').slice(0, props.length - i).forEach((c, j) => (arr[i + j] = c))
    update(arr)
    inputs.value[Math.min(i + clean.length, props.length - 1)]?.focus()
    return
  }
  arr[i] = clean
  update(arr)
  if (clean && i < props.length - 1) inputs.value[i + 1]?.focus()
}
function update(arr: string[]) {
  const value = arr.join('')
  emit('update:modelValue', value)
  if (value.length === props.length && !arr.includes('')) emit('complete', value)
}
function onKey(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !digits.value[i] && i > 0) inputs.value[i - 1]?.focus()
  if (e.key === 'ArrowLeft' && i > 0) inputs.value[i - 1]?.focus()
  if (e.key === 'ArrowRight' && i < props.length - 1) inputs.value[i + 1]?.focus()
}
watch(
  () => props.autofocus,
  (v) => v && setTimeout(() => inputs.value[0]?.focus(), 50),
  { immediate: true },
)
</script>

<template>
  <div>
    <div class="flex justify-center gap-3" role="group" aria-label="Verification code">
      <input
        v-for="(d, i) in digits"
        :key="i"
        :ref="(el) => { if (el) inputs[i] = el as HTMLInputElement }"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="4"
        :value="d"
        :disabled="disabled"
        :aria-label="`Digit ${i + 1}`"
        :class="cn('h-16 w-16 rounded-xl border border-ink-200 text-center text-2xl font-semibold text-ink-900 focus:border-brand-600 focus:ring-0', error && 'border-danger-500')"
        @input="setDigit(i, ($event.target as HTMLInputElement).value)"
        @keydown="onKey(i, $event)"
        @focus="($event.target as HTMLInputElement).select()"
      />
    </div>
    <p v-if="error" class="mt-3 text-center text-sm text-danger-500" role="alert">{{ error }}</p>
  </div>
</template>
