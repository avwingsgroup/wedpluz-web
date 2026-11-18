<script setup lang="ts">
import { computed, ref, useId, useSlots } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null
    label?: string
    placeholder?: string
    type?: string
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    readonly?: boolean
    autocomplete?: string
    name?: string
    min?: string | number
    max?: string | number
    step?: string | number
    maxlength?: number
    inputmode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'search' | 'url'
    size?: 'md' | 'lg'
    prefix?: string
  }>(),
  { type: 'text', size: 'md' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [FocusEvent]; focus: [FocusEvent]; enter: [] }>()

const id = useId()
const slots = useSlots()
const showPassword = ref(false)
const actualType = computed(() => (props.type === 'password' && showPassword.value ? 'text' : props.type))
const hasLeading = computed(() => !!slots.leading || !!props.prefix)
const hasTrailing = computed(() => !!slots.trailing || props.type === 'password')
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="label">
      {{ label }}<span v-if="required" class="text-danger-500">*</span>
    </label>
    <div class="relative">
      <span v-if="hasLeading" class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-ink-400">
        <slot name="leading">{{ prefix }}</slot>
      </span>
      <input
        :id="id"
        :name="name"
        :type="actualType"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        :autocomplete="autocomplete"
        :min="min"
        :max="max"
        :step="step"
        :maxlength="maxlength"
        :inputmode="inputmode"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
        :class="cn('field', size === 'lg' && 'py-3.5 text-base', hasLeading && 'pl-11', hasTrailing && 'pr-11', error && 'field-error')"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @blur="emit('blur', $event)"
        @focus="emit('focus', $event)"
        @keydown.enter="emit('enter')"
      />
      <button
        v-if="type === 'password'"
        type="button"
        class="absolute inset-y-0 right-0 flex items-center pr-4 text-ink-500 hover:text-ink-900"
        :aria-label="showPassword ? 'Hide password' : 'Show password'"
        @click="showPassword = !showPassword"
      >
        <Eye v-if="showPassword" class="h-5 w-5" />
        <EyeOff v-else class="h-5 w-5" />
      </button>
      <span v-else-if="slots.trailing" class="absolute inset-y-0 right-0 flex items-center pr-4 text-ink-400">
        <slot name="trailing" />
      </span>
    </div>
    <p v-if="error" :id="`${id}-error`" class="mt-1.5 text-xs text-danger-500" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1.5 text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
