<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import VendorProfileView from '@/modules/vendors/VendorProfileView.vue'
import { vendorsApi } from '@/services/api/vendors.api'
import { useAsync } from '@/composables/useAsync'
import { useSeo } from '@/composables/useSeo'
import { env } from '@/config/env'

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const { data: vendor, loading, error, refresh } = useAsync(() => vendorsApi.bySlug(slug.value), { watch: slug })
useSeo(() => (vendor.value ? { title: `${vendor.value.businessName} · ${vendor.value.category.name}`, description: vendor.value.description.slice(0, 155), image: vendor.value.avatarUrl ?? undefined, url: `${env.webOrigin}/vendors/${vendor.value.slug}` } : { title: 'Vendor' }))
</script>

<template>
  <ErrorState v-if="error" :error="error" class="container-app" @retry="refresh" />
  <UiSpinner v-else-if="loading || !vendor" page />
  <VendorProfileView v-else :key="vendor.id" :vendor="vendor" :owner="vendor.isMine" @edit="$router.push({ name: 'business.create', query: { edit: '1' } })" />
</template>
