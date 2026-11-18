<script setup lang="ts">
import { computed, ref } from 'vue'
import { BadgeCheck, ChevronRight, Pencil, Trash2 } from 'lucide-vue-next'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiRadioGroup from '@/components/ui/UiRadioGroup.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import OtpStep from '@/modules/auth/OtpStep.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { useForm } from '@/composables/useForm'
import { useAsync } from '@/composables/useAsync'
import { useInterests } from '@/composables/useReferenceData'
import { accountApi } from '@/services/api/account.api'
import { changePasswordSchema, deleteAccountSchema, nameSchema } from '@/validations'
import { MAX_INTERESTS } from '@/config/app'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import { z } from 'zod'

const auth = useAuthStore()
const ui = useUiStore()
const modal = ref<'name' | 'password' | 'email' | 'interests' | 'delete' | null>(null)
const { data: interestOptions } = useInterests()
const { data: deletion, refresh: refreshDeletion } = useAsync(() => accountApi.deletionRequest())
const selectedInterests = ref<string[]>([])
const savingInterests = ref(false)
const interestLabels = computed(() => (auth.user?.interests ?? []).map((s) => interestOptions.value?.find((o) => o.slug === s)?.label ?? s))

const nameForm = useForm({
  initialValues: { firstName: auth.user?.firstName ?? '', lastName: auth.user?.lastName ?? '' },
  schema: z.object({ firstName: nameSchema, lastName: nameSchema }),
  onSubmit: (v) => accountApi.update(v),
  onSuccess: (u) => {
    auth.setUser(u)
    modal.value = null
    ui.success('Name updated')
  },
})
const passwordForm = useForm({
  initialValues: { currentPassword: '', password: '', passwordConfirmation: '' },
  schema: changePasswordSchema,
  onSubmit: (v) => accountApi.changePassword(v),
  onSuccess: () => {
    modal.value = null
    ui.success('Password updated', 'Other devices will need to log in again.')
  },
})
const deleteForm = useForm({
  initialValues: { reason: '', password: '', acknowledge: false as boolean },
  schema: deleteAccountSchema,
  onSubmit: (v) => accountApi.requestDeletion({ reason: v.reason, password: v.password }),
  onSuccess: async () => {
    modal.value = null
    ui.success('Deletion scheduled', 'Your account will be deleted in 30 days. Log in before then to cancel.')
    await refreshDeletion()
  },
})

function open(m: NonNullable<typeof modal.value>) {
  if (m === 'name') nameForm.reset({ firstName: auth.user?.firstName ?? '', lastName: auth.user?.lastName ?? '' })
  if (m === 'password') passwordForm.reset()
  if (m === 'delete') deleteForm.reset()
  if (m === 'interests') selectedInterests.value = [...(auth.user?.interests ?? [])]
  modal.value = m
}
function toggleInterest(slug: string) {
  if (selectedInterests.value.includes(slug)) selectedInterests.value = selectedInterests.value.filter((s) => s !== slug)
  else if (selectedInterests.value.length < MAX_INTERESTS) selectedInterests.value.push(slug)
}
async function saveInterests() {
  savingInterests.value = true
  try {
    auth.setUser(await accountApi.updateInterests(selectedInterests.value))
    modal.value = null
    ui.success('Interests updated')
  } finally {
    savingInterests.value = false
  }
}
async function cancelDeletion() {
  await accountApi.cancelDeletion()
  await auth.refreshUser()
  await refreshDeletion()
  ui.success('Account deletion cancelled')
}
const deleteReasons = [
  { label: 'I no longer use Wedpluz', value: 'not_using' },
  { label: 'I have another account', value: 'duplicate' },
  { label: 'Privacy concerns', value: 'privacy' },
  { label: 'Too many notifications', value: 'notifications' },
  { label: 'Something else', value: 'other' },
]
</script>

<template>
  <div v-if="auth.user">
    <h2 class="text-3xl">Account</h2>
    <div class="mt-6 divide-y divide-ink-100">
      <button type="button" class="flex w-full items-center justify-between px-3 py-4 text-left hover:bg-ink-50" @click="open('name')"><span>Account name</span><span class="flex items-center gap-2 text-ink-500">{{ auth.displayName }}<ChevronRight class="h-4 w-4" /></span></button>
      <button type="button" class="flex w-full items-center justify-between px-3 py-4 text-left hover:bg-ink-50" @click="open('email')"><span>Email</span><span class="flex items-center gap-2 text-ink-500">{{ auth.user.email }}<BadgeCheck v-if="auth.user.emailVerifiedAt" class="h-5 w-5 text-ink-700" aria-label="Verified" /><UiBadge v-else tone="warning" size="sm">Verify</UiBadge></span></button>
      <button type="button" class="flex w-full items-center justify-between px-3 py-4 text-left hover:bg-ink-50" @click="open('password')"><span>Password</span><ChevronRight class="h-4 w-4" /></button>
    </div>

    <h3 class="mt-10 text-sm text-ink-500">Account Management</h3>
    <div v-if="deletion && deletion.status === 'pending'" class="mt-3 rounded-2xl border border-danger-500/40 bg-danger-50 p-4 text-sm">
      <p class="font-medium text-danger-600">Account scheduled for deletion on {{ formatDate(deletion.scheduledFor) }}</p>
      <UiButton size="sm" variant="outline" class="mt-3" @click="cancelDeletion">Cancel deletion</UiButton>
    </div>
    <button v-else type="button" class="mt-2 flex w-full items-center justify-between px-3 py-4 text-left text-danger-500 hover:bg-danger-50" @click="open('delete')"><span class="flex items-center gap-2"><Trash2 class="h-5 w-5" />Delete Account</span><ChevronRight class="h-4 w-4 text-ink-700" /></button>

    <div class="mt-8 flex items-center justify-between"><h3 class="text-sm text-ink-500">Interests</h3><button type="button" class="inline-flex items-center gap-1 text-sm" @click="open('interests')"><Pencil class="h-4 w-4" />Edit</button></div>
    <div class="mt-3 flex flex-wrap gap-3"><span v-for="i in interestLabels" :key="i" class="rounded-full border border-brand-600 bg-brand-50 px-4 py-2.5 font-chip text-sm text-ink-700">{{ i }}</span><span v-if="!interestLabels.length" class="text-sm text-ink-500">No interests yet</span></div>

    <UiModal :open="modal === 'name'" title="Account name" @update:open="modal = null">
      <form class="space-y-4" @submit.prevent="nameForm.submit()"><div class="grid grid-cols-2 gap-3"><UiInput v-model="nameForm.values.firstName" label="First name" :error="nameForm.fieldError('firstName')" /><UiInput v-model="nameForm.values.lastName" label="Last name" :error="nameForm.fieldError('lastName')" /></div><UiButton type="submit" block size="lg" :loading="nameForm.submitting.value">Save</UiButton></form>
    </UiModal>
    <UiModal :open="modal === 'password'" title="Update password" @update:open="modal = null">
      <form class="space-y-4" @submit.prevent="passwordForm.submit()">
        <UiInput v-model="passwordForm.values.currentPassword" type="password" label="Current password" autocomplete="current-password" :error="passwordForm.fieldError('currentPassword')" />
        <UiInput v-model="passwordForm.values.password" type="password" label="New password" autocomplete="new-password" :error="passwordForm.fieldError('password')" />
        <UiInput v-model="passwordForm.values.passwordConfirmation" type="password" label="Confirm new password" autocomplete="new-password" :error="passwordForm.fieldError('passwordConfirmation')" />
        <UiButton type="submit" block size="lg" :loading="passwordForm.submitting.value">Update password</UiButton>
      </form>
    </UiModal>
    <UiModal :open="modal === 'email'" size="sm" @update:open="modal = null">
      <OtpStep v-if="modal === 'email' && !auth.user.emailVerifiedAt" :email="auth.user.email" purpose="email_verification" @verified="auth.refreshUser(); modal = null" />
      <div v-else class="text-center"><BadgeCheck class="mx-auto h-10 w-10 text-success-500" /><p class="mt-3 font-medium">{{ auth.user.email }} is verified</p><p class="mt-1 text-sm text-ink-500">To change your email, contact support so we can protect your account.</p><UiButton class="mt-4" variant="outline" :to="{ name: 'settings.help' }">Contact support</UiButton></div>
    </UiModal>
    <UiModal :open="modal === 'interests'" title="Edit interests" @update:open="modal = null">
      <p class="text-sm text-ink-500">Pick up to {{ MAX_INTERESTS }}.</p>
      <div class="mt-4 flex flex-wrap gap-2"><button v-for="o in interestOptions ?? []" :key="o.slug" type="button" :class="cn('rounded-full border px-4 py-2 font-chip text-sm', selectedInterests.includes(o.slug) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200')" @click="toggleInterest(o.slug)">{{ o.label }}</button></div>
      <template #footer><UiButton block size="lg" :disabled="!selectedInterests.length" :loading="savingInterests" @click="saveInterests">Save ({{ selectedInterests.length }}/{{ MAX_INTERESTS }})</UiButton></template>
    </UiModal>
    <UiModal :open="modal === 'delete'" title="Delete account" @update:open="modal = null">
      <form class="space-y-4" @submit.prevent="deleteForm.submit()">
        <p class="text-sm text-ink-500">We’re sorry to see you go. Deleting your account removes your profile, tickets history, messages and business page after a 30-day grace period. Active tickets and pending payouts must be resolved first.</p>
        <UiRadioGroup :model-value="deleteForm.values.reason" :options="deleteReasons" label="Why are you leaving?" :error="deleteForm.fieldError('reason')" @update:model-value="deleteForm.values.reason = $event" />
        <UiInput v-model="deleteForm.values.password" type="password" label="Enter your password to confirm" :error="deleteForm.fieldError('password')" />
        <UiCheckbox v-model="deleteForm.values.acknowledge" label="I understand this cannot be undone after 30 days" :error="deleteForm.fieldError('acknowledge')" />
        <UiButton type="submit" variant="danger" block size="lg" :loading="deleteForm.submitting.value">Delete my account</UiButton>
      </form>
    </UiModal>
  </div>
</template>
