<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { cn } from '@/utils/cn'

export interface DropdownItem {
  key?: string
  label: string
  icon?: unknown
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
  onClick?: () => void
  divider?: boolean
  description?: string
}

withDefaults(defineProps<{ items?: DropdownItem[]; align?: 'left' | 'right'; width?: string }>(), { items: () => [], align: 'right', width: 'w-56' })
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function onDocClick(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
function pick(item: DropdownItem) {
  if (item.disabled) return
  item.onClick?.()
  open.value = false
}
defineExpose({ close: () => (open.value = false) })
</script>

<template>
  <div ref="root" class="relative inline-block">
    <div @click="open = !open"><slot name="trigger" :open="open" /></div>
    <Transition enter-active-class="transition duration-100" enter-from-class="opacity-0 scale-95" leave-active-class="transition duration-75" leave-to-class="opacity-0 scale-95">
      <div v-if="open" role="menu" :class="cn('absolute z-50 mt-2 origin-top rounded-2xl border border-ink-100 bg-white p-2 shadow-float', align === 'right' ? 'right-0' : 'left-0', width)">
        <slot :close="() => (open = false)">
          <template v-for="(item, i) in items.filter((x) => !x.hidden)" :key="item.key ?? i">
            <div v-if="item.divider" class="my-1 border-t border-ink-100" />
            <button
              v-else
              type="button"
              role="menuitem"
              :disabled="item.disabled"
              :class="cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50', item.danger ? 'text-danger-500 hover:bg-danger-50' : 'text-ink-700 hover:bg-ink-50')"
              @click="pick(item)"
            >
              <component :is="item.icon" v-if="item.icon" class="h-4 w-4 shrink-0" />
              <span class="min-w-0 flex-1">
                <span class="block">{{ item.label }}</span>
                <span v-if="item.description" class="block text-xs text-ink-500">{{ item.description }}</span>
              </span>
            </button>
          </template>
        </slot>
      </div>
    </Transition>
  </div>
</template>
