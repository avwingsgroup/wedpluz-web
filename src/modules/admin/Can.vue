<script setup lang="ts">
import { computed } from 'vue'
import { useAdminStore } from '@/stores/admin.store'
import type { PermissionKey } from '@/types'

/**
 * Permission-aware rendering. Hides controls the admin can't use. This is a usability layer
 * only; every admin endpoint re-checks permissions server-side.
 */
const props = defineProps<{ perm: PermissionKey | PermissionKey[]; any?: boolean }>()
const admin = useAdminStore()
const allowed = computed(() => {
  const list = Array.isArray(props.perm) ? props.perm : [props.perm]
  return props.any ? admin.canAny(...list) : admin.can(...list)
})
</script>

<template>
  <slot v-if="allowed" />
  <slot v-else name="fallback" />
</template>
