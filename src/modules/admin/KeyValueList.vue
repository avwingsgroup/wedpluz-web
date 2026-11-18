<script setup lang="ts">
defineProps<{ items: Array<{ label: string; value: string | number | null | undefined; mono?: boolean }>; title?: string }>()
</script>

<template>
  <div class="card">
    <h3 v-if="title" class="border-b border-ink-100 px-5 py-3 font-semibold">{{ title }}</h3>
    <dl class="divide-y divide-ink-100 px-5 text-sm">
      <div v-for="i in items" :key="i.label" class="flex items-start justify-between gap-4 py-3"><dt class="shrink-0 text-ink-500">{{ i.label }}</dt><dd :class="['text-right text-ink-900', i.mono && 'font-mono text-xs']">{{ i.value ?? '—' }}</dd></div>
      <slot />
    </dl>
  </div>
</template>
