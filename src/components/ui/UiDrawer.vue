<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{ open: boolean; title?: string; subtitle?: string; size?: 'sm' | 'md' | 'lg'; closable?: boolean; padded?: boolean }>(), { size: 'md', closable: true, padded: true })
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
const sizes = { sm: 'sm:max-w-md', md: 'sm:max-w-[760px]', lg: 'sm:max-w-[960px]' }
</script>

<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" leave-active-class="transition duration-150" leave-to-class="opacity-0">
      <div v-if="open" class="fixed inset-0 z-[80] bg-ink-900/50" @click.self="close">
        <Transition appear enter-active-class="transition duration-250 ease-out" enter-from-class="translate-x-full" leave-active-class="transition duration-200" leave-to-class="translate-x-full">
          <aside
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            :class="cn('absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-dialog sm:rounded-l-3xl', sizes[size])"
          >
            <header class="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
              <div>
                <h2 v-if="title" class="text-xl font-bold text-ink-900">{{ title }}</h2>
                <p v-if="subtitle" class="mt-0.5 text-sm text-ink-500">{{ subtitle }}</p>
                <slot name="header" />
              </div>
              <button v-if="closable" type="button" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100" aria-label="Close" @click="close">
                <X class="h-5 w-5" />
              </button>
            </header>
            <div :class="cn('min-h-0 flex-1 overflow-y-auto', padded && 'px-6 pb-6')"><slot /></div>
            <footer v-if="$slots.footer" class="border-t border-ink-100 px-6 py-4 safe-bottom"><slot name="footer" /></footer>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
