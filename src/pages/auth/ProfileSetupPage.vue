<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthCard from '@/modules/auth/AuthCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiImageUploader from '@/components/ui/UiImageUploader.vue'
import { useForm } from '@/composables/useForm'
import { accountApi } from '@/services/api/account.api'
import { useAuthStore } from '@/stores/auth.store'
import { profileSetupSchema } from '@/validations'

const router = useRouter()
const auth = useAuthStore()
const avatarUploadId = ref<string | undefined>()
const avatarUrl = ref<string | null>(auth.user?.avatarUrl ?? null)

const form = useForm({
  initialValues: { username: auth.user?.username ?? '', phone: auth.user?.phone ?? '', city: auth.user?.city ?? '' },
  schema: profileSetupSchema,
  onSubmit: (v) => accountApi.profileSetup({ username: v.username, phone: v.phone || undefined, city: v.city || undefined, avatarUploadId: avatarUploadId.value }),
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
      <UiInput v-model="form.values.phone" type="tel" label="Phone number (optional)" placeholder="+2348012345678" autocomplete="tel" :error="form.fieldError('phone')" @blur="form.touch('phone')" />
      <UiInput v-model="form.values.city" label="City (optional)" placeholder="Port Harcourt" autocomplete="address-level2" :error="form.fieldError('city')" />
      <UiButton type="submit" size="lg" block :loading="form.submitting.value" class="!mt-8">Continue</UiButton>
    </form>
  </AuthCard>
</template>
