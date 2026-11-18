<script setup lang="ts">
import { Sparkles, Users, Palette, Dumbbell, Bus, Briefcase, Cpu, Music, GraduationCap, Heart, UtensilsCrossed, Star } from 'lucide-vue-next'
import type { EventCategory } from '@/types'
import { cn } from '@/utils/cn'

defineProps<{ categories: EventCategory[]; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [slug: string] }>()
const icons: Record<string, unknown> = { party: Sparkles, users: Users, palette: Palette, dumbbell: Dumbbell, bus: Bus, briefcase: Briefcase, cpu: Cpu, music: Music, graduation: GraduationCap, rings: Heart, utensils: UtensilsCrossed, sparkles: Star }
</script>

<template>
  <div class="relative -mx-4 border-b border-ink-200 px-4 sm:mx-0 sm:px-0">
    <div class="flex gap-2 overflow-x-auto scrollbar-none" role="tablist">
      <button type="button" role="tab" :aria-selected="modelValue === 'all'" :class="cn('flex min-w-[96px] flex-col items-center gap-2 border-b-2 px-4 pb-3 pt-2 text-sm whitespace-nowrap', modelValue === 'all' ? 'border-brand-600 text-ink-900 font-medium' : 'border-transparent text-ink-500 hover:text-ink-900')" @click="emit('update:modelValue', 'all')">
        <Sparkles class="h-5 w-5" />All events
      </button>
      <button v-for="c in categories" :key="c.id" type="button" role="tab" :aria-selected="modelValue === c.slug" :class="cn('flex min-w-[110px] flex-col items-center gap-2 border-b-2 px-4 pb-3 pt-2 text-sm whitespace-nowrap', modelValue === c.slug ? 'border-brand-600 text-ink-900 font-medium' : 'border-transparent text-ink-500 hover:text-ink-900')" @click="emit('update:modelValue', c.slug)">
        <component :is="icons[c.icon] ?? Star" class="h-5 w-5" />{{ c.name }}
      </button>
    </div>
  </div>
</template>
