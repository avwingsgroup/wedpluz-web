<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import VendorProfileView from '@/modules/vendors/VendorProfileView.vue'
import { vendorsApi } from '@/services/api/vendors.api'
import { useAsync } from '@/composables/useAsync'
import { useSeo } from '@/composables/useSeo'
import { breadcrumbLd, vendorLd } from '@/utils/structuredData'
import { toDescription } from '@/config/seo'

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const { data: vendor, loading, error, refresh } = useAsync(() => vendorsApi.bySlug(slug.value), { watch: slug })
useSeo(() => {
  const v = vendor.value
  if (!v) return { title: 'Vendor' }
  const rating = v.ratingsCount > 0 ? ` Rated ${v.rating.toFixed(1)}/5 from ${v.ratingsCount} review${v.ratingsCount === 1 ? '' : 's'}.` : ''
  return {
    title: `${v.businessName} – ${v.category.name} in ${v.location}`,
    description: toDescription(`${v.category.name} in ${v.location}.${rating} ${toDescription(v.description, 300)}`),
    image: v.coverUrl ?? v.avatarUrl ?? v.featuredWorks[0]?.url ?? null,
    imageAlt: v.businessName,
    canonical: `/vendors/${v.slug}`,
    type: 'profile',
    noIndex: v.status !== 'active',
    jsonLd: [
      vendorLd(v),
      breadcrumbLd([
        { name: 'Home', path: '/' },
        { name: 'Vendors', path: '/vendors' },
        { name: v.category.name, path: `/vendors?categorySlug=${v.category.slug}` },
        { name: v.businessName, path: `/vendors/${v.slug}` },
      ]),
    ],
  }
})
</script>

<template>
  <ErrorState v-if="error" :error="error" class="container-app pt-28" @retry="refresh" />
  <UiSpinner v-else-if="loading || !vendor" page />
  <VendorProfileView v-else :key="vendor.id" :vendor="vendor" :owner="vendor.isMine" @edit="$router.push({ name: 'business.create', query: { edit: '1' } })" />
</template>
