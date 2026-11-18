<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiImageUploader from '@/components/ui/UiImageUploader.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import { useForm } from '@/composables/useForm'
import { vendorsApi } from '@/services/api/vendors.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { vendorProfileSchema } from '@/validations'
import type { VendorCategory } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const isEdit = computed(() => route.query.edit === '1')
const categories = ref<VendorCategory[]>([])
const avatarUrl = ref<string | null>(auth.user?.avatarUrl ?? null)
const avatarUploadId = ref<string | null>(null)
const coverUrl = ref<string | null>(null)
const coverUploadId = ref<string | null>(null)
const loading = ref(true)

const form = useForm({
  initialValues: { businessName: '', location: auth.user?.city ?? '', categoryId: '', description: '' },
  schema: vendorProfileSchema,
  onSubmit: (v) => (isEdit.value ? vendorsApi.updateProfile({ ...v, avatarUploadId: avatarUploadId.value, coverUploadId: coverUploadId.value }) : vendorsApi.createProfile({ ...v, avatarUploadId: avatarUploadId.value })),
  onSuccess: async () => {
    await auth.refreshUser()
    ui.success(isEdit.value ? 'Business profile updated' : 'Your business profile is live!')
    auth.setAudience('businesses')
    router.push({ name: 'business' })
  },
})

onMounted(async () => {
  try {
    categories.value = await vendorsApi.categories()
    if (isEdit.value) {
      const v = await vendorsApi.myProfile()
      if (v) {
        form.setValues({ businessName: v.businessName, location: v.location, categoryId: v.category.id, description: v.description })
        avatarUrl.value = v.avatarUrl
        coverUrl.value = v.coverUrl
      }
    } else if (auth.isVendor) {
      router.replace({ name: 'business' })
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container-app max-w-3xl pb-10">
    <UiBackButton />
    <UiSpinner v-if="loading" page />
    <template v-else>
      <h1 class="mt-8 text-3xl">{{ isEdit ? 'Business account info' : 'Become a Vendor' }}</h1>
      <p class="mt-2 text-sm text-ink-500">Whether you’re a photographer, decorator, chef, DJ, etc. Let the right people find you.</p>
      <form class="mt-8 space-y-5" novalidate @submit.prevent="form.submit()">
        <div class="flex items-center gap-4"><UiImageUploader v-model="avatarUrl" purpose="vendor_avatar" shape="circle" aspect="square" @uploaded="(ids) => (avatarUploadId = ids[0] ?? null)" /><div><p class="font-medium">Profile Picture</p><p class="text-xs text-ink-500">Max size 5MB</p></div></div>
        <UiImageUploader v-if="isEdit" v-model="coverUrl" purpose="vendor_cover" label="Cover image" aspect="banner" @uploaded="(ids) => (coverUploadId = ids[0] ?? null)" />
        <UiInput v-model="form.values.businessName" label="Business Name" placeholder="Chic Demure" :error="form.fieldError('businessName')" @blur="form.touch('businessName')" />
        <UiInput v-model="form.values.location" label="Primary Location" placeholder="Lagos" :error="form.fieldError('location')" @blur="form.touch('location')" />
        <UiSelect v-model="form.values.categoryId" label="Business Category" placeholder="Choose a category" :options="categories.map((c) => ({ label: c.name, value: c.id }))" :error="form.fieldError('categoryId')" />
        <UiTextarea v-model="form.values.description" label="Description" :rows="6" :maxlength="2000" placeholder="Tell clients what makes your work special" :error="form.fieldError('description')" @blur="form.touch('description')" />
        <UiButton type="submit" size="lg" block :loading="form.submitting.value">{{ isEdit ? 'Save changes' : 'Publish Profile' }}</UiButton>
      </form>
    </template>
  </div>
</template>
