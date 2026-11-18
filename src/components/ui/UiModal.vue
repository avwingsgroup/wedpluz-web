<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{ open: boolean; title?: string; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; closable?: boolean; padded?: boolean }>(), { size: 'md', closable: true, padded: true })
const emit = defineEmits<{ 'update:open': [value: boolean]; close: [] }>()

function close() {
  if (!props.closable) return
  emit('update:open', false)
  emit('close')
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-[1100px]' }
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
      <div v-if="open" class="fixed inset-0 z-[80] flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-6" @click.self="close">
        <Transition appear enter-active-class="transition duration-200" enter-from-class="translate-y-6 sm:translate-y-0 sm:scale-95 opacity-0">
          <div
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            :class="cn('flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-dialog sm:rounded-3xl', sizes[size])"
          >
            <header v-if="title || closable || $slots.header" class="flex items-start justify-between gap-4 px-6 pt-6" :class="!padded && 'pb-4'">
              <slot name="header"><h2 class="text-xl font-bold text-ink-900">{{ title }}</h2></slot>
              <div class="flex items-center gap-2">
                <slot name="actions" />
                <button v-if="closable" type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 text-ink-700 hover:bg-ink-50" aria-label="Close" @click="close">
                  <X class="h-4 w-4" />
                </button>
              </div>
            </header>
            <div :class="cn('min-h-0 flex-1 overflow-y-auto', padded && 'px-6 py-5')"><slot /></div>
            <footer v-if="$slots.footer" class="flex flex-col-reverse gap-3 border-t border-ink-100 px-6 py-4 sm:flex-row sm:justify-end safe-bottom"><slot name="footer" /></footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
