<script setup lang="ts">
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'
const ui = useUiStore()
const icons = { success: CircleCheck, error: CircleX, info: Info, warning: TriangleAlert }
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" aria-live="polite">
      <TransitionGroup enter-active-class="transition duration-200" enter-from-class="opacity-0 -translate-y-2" leave-active-class="transition duration-150" leave-to-class="opacity-0 scale-95">
        <div v-for="t in ui.toasts" :key="t.id" role="status" :class="cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-white p-4 shadow-float', { success: 'border-success-500/30', error: 'border-danger-500/30', info: 'border-info-500/30', warning: 'border-warning-500/40' }[t.variant])">
          <component :is="icons[t.variant]" :class="cn('mt-0.5 h-5 w-5 shrink-0', { success: 'text-success-500', error: 'text-danger-500', info: 'text-info-500', warning: 'text-warning-500' }[t.variant])" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-ink-900">{{ t.title }}</p>
            <p v-if="t.description" class="mt-0.5 text-sm text-ink-500">{{ t.description }}</p>
            <button v-if="t.action" type="button" class="mt-2 text-sm font-semibold text-brand-600 hover:underline" @click="t.action.onClick(); ui.dismiss(t.id)">{{ t.action.label }}</button>
          </div>
          <button type="button" class="text-ink-400 hover:text-ink-700" aria-label="Dismiss" @click="ui.dismiss(t.id)"><X class="h-4 w-4" /></button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
