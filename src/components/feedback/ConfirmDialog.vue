<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TriangleAlert } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui.store'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'

const ui = useUiStore()
const typed = ref('')
watch(() => ui.confirmState, () => (typed.value = ''))
const open = computed(() => !!ui.confirmState)
const canConfirm = computed(() => !ui.confirmState?.requireText || typed.value.trim() === ui.confirmState.requireText)
</script>

<template>
  <UiModal :open="open" size="sm" :closable="true" @update:open="ui.resolveConfirm(false)">
    <div v-if="ui.confirmState" class="text-center">
      <div v-if="ui.confirmState.variant === 'danger'" class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-500"><TriangleAlert class="h-6 w-6" /></div>
      <h2 class="text-xl font-bold text-ink-900">{{ ui.confirmState.title }}</h2>
      <p v-if="ui.confirmState.description" class="mt-2 text-sm text-ink-500">{{ ui.confirmState.description }}</p>
      <div v-if="ui.confirmState.requireText" class="mt-4 text-left">
        <UiInput v-model="typed" :label="`Type “${ui.confirmState.requireText}” to confirm`" :placeholder="ui.confirmState.requireText" />
      </div>
      <div class="mt-6 grid grid-cols-2 gap-3">
        <UiButton variant="secondary" @click="ui.resolveConfirm(false)">{{ ui.confirmState.cancelLabel ?? 'Cancel' }}</UiButton>
        <UiButton :variant="ui.confirmState.variant === 'danger' ? 'danger' : 'primary'" :disabled="!canConfirm" @click="ui.resolveConfirm(true)">{{ ui.confirmState.confirmLabel ?? 'Confirm' }}</UiButton>
      </div>
    </div>
  </UiModal>
</template>
