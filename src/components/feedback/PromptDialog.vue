<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'

const ui = useUiStore()
const value = ref('')
watch(() => ui.promptState, () => (value.value = ''))
const state = computed(() => ui.promptState)
const valid = computed(() => value.value.trim().length >= (state.value?.minLength ?? 1))
function submit() {
  if (valid.value) ui.resolvePrompt(value.value.trim())
}
</script>

<template>
  <UiModal :open="!!state" size="sm" :title="state?.title" @update:open="ui.resolvePrompt(null)">
    <form v-if="state" class="space-y-4" @submit.prevent="submit">
      <p v-if="state.description" class="text-sm text-ink-500">{{ state.description }}</p>
      <div v-if="state.presets?.length" class="flex flex-wrap gap-2"><button v-for="p in state.presets" :key="p" type="button" class="chip px-3 py-1.5 hover:border-brand-400" @click="value = p">{{ p }}</button></div>
      <UiTextarea v-if="state.multiline !== false" v-model="value" :label="state.label" :placeholder="state.placeholder" :rows="4" :maxlength="1000" :hint="state.minLength ? `At least ${state.minLength} characters` : undefined" />
      <UiInput v-else v-model="value" :label="state.label" :placeholder="state.placeholder" />
      <div class="grid grid-cols-2 gap-3"><UiButton variant="secondary" @click="ui.resolvePrompt(null)">Cancel</UiButton><UiButton type="submit" :variant="state.variant === 'danger' ? 'danger' : 'primary'" :disabled="!valid">{{ state.confirmLabel ?? 'Confirm' }}</UiButton></div>
    </form>
  </UiModal>
</template>
