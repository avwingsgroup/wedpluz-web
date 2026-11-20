<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { OTP_LENGTH } from '@/config/app'
import { cn } from '@/utils/cn'

/**
 * One-time code boxes. Customer codes are 4 digits (OTP_LENGTH); admin authenticator codes are 6
 * (ADMIN_OTP_LENGTH). The value is always a string of digits, so a code like "042917" keeps its leading zero.
 * A code pasted (or autofilled) into any box — "482 917", "482-917" — is cleaned and spread from the first box.
 */
const props = withDefaults(defineProps<{ modelValue: string; length?: number; error?: string; disabled?: boolean; autofocus?: boolean; label?: string }>(), {
  length: OTP_LENGTH,
  autofocus: true,
  error: undefined,
  label: 'Verification code',
})
const emit = defineEmits<{ 'update:modelValue': [value: string]; complete: [value: string] }>()
const inputs = ref<HTMLInputElement[]>([])
const digits = computed(() => Array.from({ length: props.length }, (_, i) => props.modelValue[i] ?? ''))
const wide = computed(() => props.length > 4)

function fill(start: number, clean: string) {
  const arr = digits.value.slice()
  clean
    .split('')
    .slice(0, props.length - start)
    .forEach((c, j) => (arr[start + j] = c))
  update(arr)
  inputs.value[Math.min(start + clean.length, props.length - 1)]?.focus()
}

function setDigit(i: number, v: string) {
  const clean = v.replace(/\D/g, '')
  if (clean.length > 1) {
    // Autofill or a typed-over box: a whole code fills from the first box, a fragment from this one.
    return fill(clean.length >= props.length ? 0 : i, clean)
  }
  const arr = digits.value.slice()
  arr[i] = clean
  update(arr)
  if (clean && i < props.length - 1) inputs.value[i + 1]?.focus()
  // Keep the box showing only its digit even if a non-digit was typed.
  const el = inputs.value[i]
  if (el && el.value !== clean) el.value = clean
}

function onPaste(i: number, e: ClipboardEvent) {
  const clean = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '')
  if (!clean) return
  e.preventDefault()
  fill(clean.length >= props.length ? 0 : i, clean)
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

/** Empties every box and puts the cursor in the first (after a rejected code). */
function clear() {
  emit('update:modelValue', '')
  setTimeout(() => inputs.value[0]?.focus(), 0)
}
defineExpose({ clear, focus: () => inputs.value[0]?.focus() })
</script>

<template>
  <div>
    <div :class="cn('flex justify-center', wide ? 'gap-2 sm:gap-2.5' : 'gap-3')" role="group" :aria-label="label">
      <input
        v-for="(d, i) in digits"
        :key="i"
        :ref="(el) => { if (el) inputs[i] = el as HTMLInputElement }"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        :autocomplete="i === 0 ? 'one-time-code' : 'off'"
        :maxlength="length * 2"
        :value="d"
        :disabled="disabled"
        :aria-label="`Digit ${i + 1} of ${length}`"
        :class="cn(
          'rounded-xl border border-ink-200 text-center font-semibold tabular-nums text-ink-900 focus:border-brand-600 focus:ring-0 disabled:bg-ink-50',
          wide ? 'h-14 w-11 text-xl sm:w-12' : 'h-16 w-16 text-2xl',
          error && 'border-danger-500',
        )"
        @input="setDigit(i, ($event.target as HTMLInputElement).value)"
        @paste="onPaste(i, $event)"
        @keydown="onKey(i, $event)"
        @focus="($event.target as HTMLInputElement).select()"
      />
    </div>
    <p v-if="error" class="mt-3 text-center text-sm text-danger-500" role="alert">{{ error }}</p>
  </div>
</template>
