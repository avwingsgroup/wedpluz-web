<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthCard from '@/modules/auth/AuthCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiImageUploader from '@/components/ui/UiImageUploader.vue'
import UiPhoneInput from '@/components/ui/UiPhoneInput.vue'
import { usePublicConfig } from '@/composables/useReferenceData'
import { detectCountry } from '@/utils/phone'
import { useForm } from '@/composables/useForm'
import { accountApi } from '@/services/api/account.api'
import { useAuthStore } from '@/stores/auth.store'
import { profileSetupSchema } from '@/validations'

const router = useRouter()
const auth = useAuthStore()
const avatarUploadId = ref<string | undefined>()
const avatarUrl = ref<string | null>(auth.user?.avatarUrl ?? null)
// Phone country: the saved country, else the backend's IP hint (if it sends one), else time zone / locale (utils/phone).
const { data: config } = usePublicConfig()
const defaultCountry = computed(() => auth.user?.countryCode ?? config.value?.geo?.countryCode ?? null)
const phoneCountry = ref('')

const form = useForm({
  initialValues: { username: auth.user?.username ?? '', phone: auth.user?.phone ?? '', city: auth.user?.city ?? '' },
  schema: profileSetupSchema,
  onSubmit: (v) =>
    accountApi.profileSetup({
      username: v.username,
      phone: v.phone || undefined,
      city: v.city || undefined,
      // The user's country: the phone selector's choice, which starts at their current country.
      countryCode: phoneCountry.value || detectCountry([defaultCountry.value]),
      avatarUploadId: avatarUploadId.value,
    }),
  onSuccess: (user) => {
    auth.setUser(user)
    auth.pendingStep = user.interests.length ? null : 'interests'
    router.push(auth.pendingStep ? { name: 'auth.interests' } : { name: 'home' })
  },
})
</script>

<template>
  <AuthCard title="Set up your profile" subtitle="Tell people a little about you. You can change this anytime.">
    <form class="space-y-4" novalidate @submit.prevent="form.submit()">
      <div class="flex items-center gap-4">
        <UiImageUploader v-model="avatarUrl" purpose="avatar" shape="circle" aspect="square" @uploaded="(ids) => (avatarUploadId = ids[0])" />
        <div><p class="font-medium">Profile Picture</p><p class="text-xs text-ink-500">Max size 5MB</p></div>
      </div>
      <UiInput v-model="form.values.username" label="Username" placeholder="johnbrown" prefix="@" autocomplete="username" :error="form.fieldError('username')" @blur="form.touch('username')" />
      <UiPhoneInput v-model="form.values.phone" v-model:country="phoneCountry" label="Phone number (optional)" :default-country="defaultCountry" :error="form.fieldError('phone')" @blur="form.touch('phone')" />
      <UiInput v-model="form.values.city" label="City (optional)" placeholder="Port Harcourt" autocomplete="address-level2" :error="form.fieldError('city')" />
      <UiButton type="submit" size="lg" block :loading="form.submitting.value" class="!mt-8">Continue</UiButton>
    </form>
  </AuthCard>
</template>
