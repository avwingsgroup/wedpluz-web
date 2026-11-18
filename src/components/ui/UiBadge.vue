<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/utils/cn'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'plum'

const props = withDefaults(defineProps<{ tone?: BadgeTone; size?: 'sm' | 'md'; dot?: boolean; status?: string }>(), { tone: 'neutral', size: 'md', dot: false })

/** Maps common domain statuses to tones so pages don't repeat the mapping. */
const STATUS_TONES: Record<string, BadgeTone> = {
  live: 'success', active: 'success', paid: 'success', successful: 'success', verified: 'success', approved: 'success', checked_in: 'success', completed: 'brand', done: 'success', matched: 'success', operational: 'success', sent: 'success', accepted: 'success', ready: 'info', resolved: 'success', resolved_refund: 'success',
  pending: 'warning', pending_review: 'warning', pending_verification: 'warning', processing: 'warning', awaiting_payment: 'warning', refund_processing: 'warning', in_progress: 'warning', on_hold: 'warning', requested: 'warning', scheduled: 'info', sending: 'info', reviewing: 'info', open: 'warning', investigating: 'info', unmatched: 'warning', degraded: 'warning', invited: 'info', trialing: 'info', draft: 'neutral', queued: 'neutral', pending_deletion: 'warning', unverified: 'neutral', todo: 'neutral',
  cancelled: 'danger', failed: 'danger', rejected: 'danger', suspended: 'danger', declined: 'danger', refunded: 'danger', expired: 'neutral', deactivated: 'neutral', mismatch: 'danger', down: 'danger', reversed: 'danger', removed: 'danger', dismissed: 'neutral', actioned: 'success', closed: 'neutral', not_checked_in: 'neutral', valid: 'info', transferred: 'info', archived: 'neutral', resolved_rejected: 'neutral', past_due: 'danger',
}
const tone = computed<BadgeTone>(() => (props.status ? STATUS_TONES[props.status] ?? 'neutral' : props.tone))
const label = computed(() => props.status?.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()))
</script>

<template>
  <span
    :class="cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium capitalize whitespace-nowrap',
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
      {
        neutral: 'bg-ink-100 text-ink-700',
        brand: 'bg-brand-100 text-brand-700',
        success: 'bg-success-50 text-success-600',
        warning: 'bg-warning-50 text-amber-700',
        danger: 'bg-danger-50 text-danger-600',
        info: 'bg-info-50 text-info-500',
        plum: 'bg-brand-950 text-white',
      }[tone],
    )"
  >
    <span v-if="dot" class="h-1.5 w-1.5 rounded-full bg-current" />
    <slot>{{ label }}</slot>
  </span>
</template>
