<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { z } from 'zod'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import VendorProfileView from '@/modules/vendors/VendorProfileView.vue'
import { vendorsApi } from '@/services/api/vendors.api'
import { useAsync } from '@/composables/useAsync'
import { useForm } from '@/composables/useForm'
import { useUiStore } from '@/stores/ui.store'

const router = useRouter()
const ui = useUiStore()
const { data: vendor, loading, refresh } = useAsync(() => vendorsApi.myProfile())
const promoOpen = ref(false)
const promoForm = useForm({
  initialValues: { title: '', description: '', discountPercent: '', validUntil: '' },
  schema: z.object({ title: z.string().trim().min(3, 'Give your promo a title'), description: z.string().trim().min(10, 'Describe the offer'), discountPercent: z.string().regex(/^(\d{1,2})?$/, 'Enter 1–99').optional(), validUntil: z.string().optional() }),
  onSubmit: (v) => vendorsApi.addPromo({ title: v.title, description: v.description, discountPercent: v.discountPercent ? Number(v.discountPercent) : undefined, validUntil: v.validUntil || undefined }),
  onSuccess: () => {
    promoOpen.value = false
    ui.success('Promo published')
    void refresh()
  },
})
</script>

<template>
  <UiSpinner v-if="loading" page />
  <div v-else-if="!vendor" class="container-app py-16"><UiEmptyState title="No business account yet" description="Create a business profile to showcase your work and get hired."><UiButton :to="{ name: 'business.create' }">Become a Vendor</UiButton></UiEmptyState></div>
  <div v-else>
    <VendorProfileView :key="vendor.id + vendor.promos.length" :vendor="vendor" owner @edit="router.push({ name: 'business.create', query: { edit: '1' } })" @add-promo="promoForm.reset(); promoOpen = true" />
    <UiModal v-model:open="promoOpen" title="New promo">
      <form class="space-y-4" @submit.prevent="promoForm.submit()">
        <UiInput v-model="promoForm.values.title" label="Title" placeholder="December weddings 15% off" :error="promoForm.fieldError('title')" />
        <UiTextarea v-model="promoForm.values.description" label="Description" :rows="3" :error="promoForm.fieldError('description')" />
        <div class="grid grid-cols-2 gap-3"><UiInput v-model="promoForm.values.discountPercent" label="Discount %" inputmode="numeric" :error="promoForm.fieldError('discountPercent')" /><UiInput v-model="promoForm.values.validUntil" type="date" label="Valid until" /></div>
        <UiButton type="submit" block size="lg" :loading="promoForm.submitting.value">Publish promo</UiButton>
      </form>
    </UiModal>
  </div>
</template>
