<script setup lang="ts">
import { computed, ref } from 'vue'
import { BadgeCheck, ChevronRight, Clock, Pencil, UserRound, CircleX } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiPhoneInput from '@/components/ui/UiPhoneInput.vue'
import UiImageUploader from '@/components/ui/UiImageUploader.vue'
import IdentityVerificationModal from '@/modules/account/IdentityVerificationModal.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { useForm } from '@/composables/useForm'
import { accountApi } from '@/services/api/account.api'
import { editProfileSchema } from '@/validations'
import { ILLUSTRATIONS } from '@/assets/illustrations'

const auth = useAuthStore()
const ui = useUiStore()
const idOpen = ref(false)
const editOpen = ref(false)
const avatarUrl = ref<string | null>(auth.user?.avatarUrl ?? null)
const status = computed(() => auth.user?.identityStatus ?? 'unverified')

const form = useForm({
  initialValues: { firstName: auth.user?.firstName ?? '', lastName: auth.user?.lastName ?? '', phone: auth.user?.phone ?? '', city: auth.user?.city ?? '', dateOfBirth: auth.user?.dateOfBirth ?? '' },
  schema: editProfileSchema,
  onSubmit: (v) => accountApi.update({ firstName: v.firstName, lastName: v.lastName, phone: v.phone || null, city: v.city || null, dateOfBirth: v.dateOfBirth || null, avatarUrl: avatarUrl.value }),
  onSuccess: (u) => {
    auth.setUser(u)
    editOpen.value = false
    ui.success('Profile updated')
  },
})
function openEdit() {
  form.reset({ firstName: auth.user?.firstName ?? '', lastName: auth.user?.lastName ?? '', phone: auth.user?.phone ?? '', city: auth.user?.city ?? '', dateOfBirth: auth.user?.dateOfBirth ?? '' })
  avatarUrl.value = auth.user?.avatarUrl ?? null
  editOpen.value = true
}
</script>

<template>
  <div v-if="auth.user">
    <div class="brand-pattern h-56 md:h-72" />
    <div class="relative -mt-12 flex flex-col items-center border-b border-ink-200 pb-8 text-center">
      <UiAvatar :src="auth.user.avatarUrl" :name="auth.displayName" size="2xl" class="rounded-full ring-4 ring-white" />
      <h1 class="mt-3 flex items-center gap-1.5 text-xl font-semibold">{{ auth.displayName }}<BadgeCheck v-if="auth.isIdentityVerified" class="h-5 w-5 fill-success-500 text-white" /></h1>
      <p class="text-sm text-ink-500">{{ auth.user.email }}</p>
      <UiButton variant="outline" size="sm" class="mt-3" @click="openEdit"><Pencil class="h-3.5 w-3.5" />Edit profile</UiButton>
    </div>

    <div class="container-app max-w-2xl space-y-6 py-10">
      <button v-if="status === 'unverified'" type="button" class="flex w-full items-start gap-3 rounded-xl border border-brand-600 bg-pink-50 p-4 text-left" @click="idOpen = true">
        <span class="flex h-6 w-6 items-center justify-center rounded bg-brand-100 text-brand-600"><UserRound class="h-4 w-4" /></span>
        <span class="flex-1"><span class="block font-medium">Complete your profile</span><span class="mt-1 block text-xs text-ink-700">Verify your identity to build trust, collaborate on events, and connect with organizers.</span></span>
        <ChevronRight class="h-5 w-5 text-brand-600" />
      </button>
      <div v-else-if="status === 'pending'" class="flex items-start gap-3 rounded-xl border border-warning-500/50 bg-warning-50 p-4"><Clock class="h-5 w-5 text-amber-600" /><div><p class="font-medium">Verification in progress</p><p class="text-xs text-ink-700">We’re reviewing your documents. This usually takes a few minutes.</p></div></div>
      <button v-else-if="status === 'failed'" type="button" class="flex w-full items-start gap-3 rounded-xl border border-danger-500/50 bg-danger-50 p-4 text-left" @click="idOpen = true"><CircleX class="h-5 w-5 text-danger-500" /><span class="flex-1"><span class="block font-medium">Verification failed</span><span class="block text-xs text-ink-700">Tap to try again with a clearer selfie or a different ID.</span></span><ChevronRight class="h-5 w-5" /></button>

      <div v-if="!auth.isVendor" class="rounded-2xl bg-white p-8 text-center shadow-card">
        <img :src="ILLUSTRATIONS.businessCard" alt="" class="mx-auto h-40 w-56 rounded-2xl object-cover" loading="lazy" />
        <h2 class="mt-6 text-2xl">Create a Business Account</h2>
        <p class="mx-auto mt-2 max-w-sm text-sm text-ink-500">Whether you’re an event planner, photographer, decorator, chef, DJ, etc. Let the right people find you.</p>
        <UiButton size="lg" block class="mt-6" :to="{ name: 'business.create' }">Become a Vendor</UiButton>
      </div>
      <div v-else class="card flex items-center justify-between p-5"><div><p class="font-medium">Your business profile</p><p class="text-sm text-ink-500">Manage works, promos and reviews</p></div><UiButton :to="{ name: 'business' }">Open</UiButton></div>

      <div class="grid gap-3 sm:grid-cols-3">
        <RouterLink v-for="l in [{ to: 'tickets', label: 'My Tickets' }, { to: 'saved', label: 'Saved' }, { to: 'wallet', label: 'Wallet' }]" :key="l.to" :to="{ name: l.to }" class="card flex items-center justify-between p-4 hover:shadow-card"><span class="font-medium">{{ l.label }}</span><ChevronRight class="h-4 w-4" /></RouterLink>
      </div>
    </div>

    <IdentityVerificationModal v-model:open="idOpen" />
    <UiModal v-model:open="editOpen" title="Edit profile">
      <form class="space-y-4" novalidate @submit.prevent="form.submit()">
        <div class="flex items-center gap-4"><UiImageUploader v-model="avatarUrl" purpose="avatar" shape="circle" aspect="square" /><div><p class="font-medium">Profile Picture</p><p class="text-xs text-ink-500">Max size 5MB</p></div></div>
        <div class="grid grid-cols-2 gap-3"><UiInput v-model="form.values.firstName" label="First name" :error="form.fieldError('firstName')" /><UiInput v-model="form.values.lastName" label="Last name" :error="form.fieldError('lastName')" /></div>
        <UiPhoneInput v-model="form.values.phone" label="Phone" :default-country="auth.user?.countryCode" :error="form.fieldError('phone')" />
        <UiInput v-model="form.values.city" label="City" />
        <UiInput v-model="form.values.dateOfBirth" type="date" label="Date of birth" :error="form.fieldError('dateOfBirth')" />
        <UiButton type="submit" block size="lg" :loading="form.submitting.value">Save changes</UiButton>
      </form>
    </UiModal>
  </div>
</template>
