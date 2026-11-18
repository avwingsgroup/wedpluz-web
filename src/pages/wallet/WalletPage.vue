<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDownLeft, ArrowUpRight, CircleCheck, CirclePlus, Eye, EyeOff, Landmark, Wallet as WalletIcon } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiOtpInput from '@/components/ui/UiOtpInput.vue'
import UiRadioGroup from '@/components/ui/UiRadioGroup.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import OtpStep from '@/modules/auth/OtpStep.vue'
import { walletApi } from '@/services/api/wallet.api'
import { useAsync } from '@/composables/useAsync'
import { useInfiniteList } from '@/composables/useInfiniteList'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { isApiError } from '@/services/http'
import { formatDate, formatDateTime, formatMoney } from '@/utils/format'
import { uuid } from '@/utils/id'
import { env } from '@/config/env'
import type { WalletTransaction } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const { data: wallet, loading, error, refresh } = useAsync(() => walletApi.get())
const txs = useInfiniteList((page) => walletApi.transactions({ page }))
const hidden = ref(false)
const modal = ref<'setup' | 'pin' | 'bank' | 'topup' | 'withdraw' | 'withdrawn' | null>(null)
const detail = ref<WalletTransaction | null>(null)
const { data: banks } = useAsync(() => walletApi.banks(), { immediate: true })
const refreshAll = () => Promise.all([refresh(), txs.refresh()])

/* ---- setup: email OTP → PIN ---- */
const pin = ref('')
const pinConfirm = ref('')
const pinStep = ref<'create' | 'confirm'>('create')
const pinError = ref<string | null>(null)
const otp = ref('1234')
async function onSetupVerified() {
  try {
    await walletApi.activate(otp.value)
    modal.value = 'pin'
    pinStep.value = 'create'
    pin.value = ''
    pinConfirm.value = ''
  } catch (e) {
    ui.error((e as Error).message)
  }
}
async function savePin() {
  if (pinStep.value === 'create') {
    pinStep.value = 'confirm'
    return
  }
  if (pin.value !== pinConfirm.value) {
    pinError.value = 'PINs do not match'
    pinConfirm.value = ''
    return
  }
  try {
    await walletApi.setPin({ pin: pin.value, pinConfirmation: pinConfirm.value, otpCode: otp.value })
    await auth.refreshUser()
    ui.success('Wallet ready', 'Add a withdrawal bank to cash out your earnings.')
    modal.value = 'bank'
    void refresh()
  } catch (e) {
    pinError.value = (e as Error).message
  }
}

/* ---- bank ---- */
const bankCode = ref('')
const accountNumber = ref('')
const resolvedName = ref<string | null>(null)
const resolving = ref(false)
const bankError = ref<string | null>(null)
async function resolveAccount() {
  resolvedName.value = null
  bankError.value = null
  if (!bankCode.value || accountNumber.value.length !== 10) return
  resolving.value = true
  try {
    resolvedName.value = (await walletApi.resolveAccount({ bankCode: bankCode.value, accountNumber: accountNumber.value })).accountName
  } catch (e) {
    bankError.value = isApiError(e) ? e.fieldError('accountNumber') ?? e.message : 'Could not verify account'
  } finally {
    resolving.value = false
  }
}
async function saveBank() {
  if (!resolvedName.value) return
  await walletApi.addBankAccount({ bankCode: bankCode.value, accountNumber: accountNumber.value, accountName: resolvedName.value })
  ui.success('Withdrawal bank saved')
  modal.value = null
  void refresh()
}

/* ---- top up ---- */
const topUpAmount = ref<number | null>(null)
const topUpMethod = ref<'card' | 'monnify'>('card')
const topUpKey = ref(uuid())
const busy = ref(false)
async function topUp() {
  if (!topUpAmount.value || topUpAmount.value < 10000) return ui.error('Minimum top up is ₦100')
  busy.value = true
  try {
    const res = await walletApi.topUp({ amount: topUpAmount.value, method: topUpMethod.value, idempotencyKey: topUpKey.value, returnUrl: `${env.webOrigin}/wallet` })
    topUpKey.value = uuid()
    modal.value = null
    if (res.authorizationUrl?.startsWith('/')) router.push(res.authorizationUrl)
    else if (res.authorizationUrl) window.location.href = res.authorizationUrl
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

/* ---- withdraw ---- */
const withdrawAmount = ref<number | null>(null)
const withdrawPin = ref('')
const withdrawKey = ref(uuid())
const withdrawError = ref<string | null>(null)
const lastWithdrawal = ref<WalletTransaction | null>(null)
const withdrawFee = 5000
const canWithdraw = computed(() => !!wallet.value && !!withdrawAmount.value && withdrawAmount.value + withdrawFee <= wallet.value.balance && withdrawPin.value.length === 4)
async function withdraw() {
  if (!wallet.value?.bankAccount || !withdrawAmount.value) return
  busy.value = true
  withdrawError.value = null
  try {
    lastWithdrawal.value = await walletApi.withdraw({ amount: withdrawAmount.value, bankAccountId: wallet.value.bankAccount.id, pin: withdrawPin.value, idempotencyKey: withdrawKey.value })
    withdrawKey.value = uuid()
    modal.value = 'withdrawn'
    void refreshAll()
  } catch (e) {
    withdrawError.value = (e as Error).message
    withdrawPin.value = ''
  } finally {
    busy.value = false
  }
}
function openWithdraw() {
  if (!wallet.value?.bankAccount) return (modal.value = 'bank')
  withdrawAmount.value = null
  withdrawPin.value = ''
  withdrawError.value = null
  modal.value = 'withdraw'
}
const txLabel: Record<string, string> = { top_up: 'Top up', withdrawal: 'Withdrawal', ticket_payment: 'Ticket payment', refund: 'Refund', payout: 'Payout', promotion_earning: 'Promotion earnings', subscription: 'Subscription', reversal: 'Reversal' }
</script>

<template>
  <div class="container-app pb-10">
    <h1 class="text-3xl md:text-4xl">My Wallet</h1>
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSkeleton v-else-if="loading || !wallet" class="mt-10 h-40 rounded-2xl" />

    <!-- wallet not set up -->
    <div v-else-if="!wallet.isActive || !wallet.pinSet" class="mx-auto mt-10 max-w-md rounded-3xl bg-white p-8 text-center shadow-card">
      <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-600"><WalletIcon class="h-8 w-8" /></span>
      <h2 class="mt-4 text-2xl">Set up your wallet</h2>
      <p class="mt-2 text-sm text-ink-500">Pay for tickets faster, receive refunds instantly and withdraw your promotion earnings.</p>
      <UiButton size="lg" block class="mt-6" @click="modal = 'setup'">Set up wallet</UiButton>
    </div>

    <template v-else>
      <div class="brand-pattern mt-10 flex flex-col gap-6 rounded-2xl p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="flex items-center gap-2 text-sm text-white/85">Wallet balance <button type="button" :aria-label="hidden ? 'Show balance' : 'Hide balance'" @click="hidden = !hidden"><EyeOff v-if="hidden" class="h-4 w-4" /><Eye v-else class="h-4 w-4" /></button></p>
          <p class="mt-2 text-4xl font-bold tracking-tight">{{ hidden ? '₦••••••' : formatMoney(wallet.balance, wallet.currency) }}</p>
          <p v-if="wallet.pendingBalance" class="mt-1 text-xs text-white/80">{{ hidden ? '' : formatMoney(wallet.pendingBalance) }} pending</p>
        </div>
        <div class="flex gap-3">
          <button type="button" class="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/15 px-5 py-2.5 text-sm font-medium backdrop-blur hover:bg-white/25" @click="topUpAmount = null; modal = 'topup'"><CirclePlus class="h-5 w-5" />Add money</button>
          <button type="button" class="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/15 px-5 py-2.5 text-sm font-medium backdrop-blur hover:bg-white/25" @click="openWithdraw"><ArrowUpRight class="h-5 w-5" />Withdraw</button>
        </div>
      </div>
      <button v-if="wallet.bankAccount" type="button" class="mt-3 flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900" @click="modal = 'bank'"><Landmark class="h-4 w-4" />Withdrawals go to {{ wallet.bankAccount.bankName }} ****{{ wallet.bankAccount.accountNumber.slice(-4) }} · Change</button>

      <h2 class="mt-10 font-medium">Recent transactions</h2>
      <div class="card mt-3 overflow-hidden">
        <template v-if="txs.loading.value"><div v-for="i in 4" :key="i" class="px-4"><UiSkeleton variant="row" /></div></template>
        <UiEmptyState v-else-if="txs.isEmpty.value" title="No transactions yet" description="Top ups, ticket payments, refunds and withdrawals will appear here." illustration="wallet" compact />
        <button v-for="t in txs.items.value" v-else :key="t.id" type="button" class="flex w-full items-center gap-3 border-b border-ink-100 px-4 py-3.5 text-left last:border-0 hover:bg-ink-50" @click="detail = t">
          <ArrowDownLeft v-if="t.direction === 'credit'" class="h-5 w-5 text-ink-500" /><ArrowUpRight v-else class="h-5 w-5 text-ink-500" />
          <div class="min-w-0 flex-1"><p class="truncate">{{ txLabel[t.type] ?? t.description }}</p><p class="text-xs text-ink-500">{{ formatDate(t.createdAt) }} <UiBadge v-if="t.status !== 'successful'" :status="t.status" size="sm" class="ml-1" /></p></div>
          <span :class="t.direction === 'credit' ? 'font-medium text-success-600' : 'font-medium text-danger-500'">{{ t.direction === 'debit' ? '- ' : '' }}{{ formatMoney(t.amount, t.currency) }}</span>
        </button>
        <div v-if="txs.hasMore.value" class="p-3"><UiButton variant="secondary" block :loading="txs.loadingMore.value" @click="txs.loadMore()">Load more</UiButton></div>
      </div>
    </template>

    <!-- setup OTP -->
    <UiModal :open="modal === 'setup'" size="sm" @update:open="modal = null">
      <OtpStep v-if="auth.user && modal === 'setup'" :email="auth.user.email" purpose="wallet_setup" title="Verify it’s you" @verified="onSetupVerified" />
    </UiModal>
    <!-- PIN -->
    <UiModal :open="modal === 'pin'" size="sm" @update:open="modal = null">
      <div class="text-center">
        <h2 class="text-2xl">{{ pinStep === 'create' ? 'Create a wallet PIN' : 'Confirm your PIN' }}</h2>
        <p class="mt-1 text-sm text-ink-500">You’ll use this 4-digit PIN to approve withdrawals.</p>
        <UiOtpInput v-if="pinStep === 'create'" v-model="pin" class="mt-6" :autofocus="true" />
        <UiOtpInput v-else v-model="pinConfirm" class="mt-6" :error="pinError ?? undefined" :autofocus="true" />
        <UiButton size="lg" block class="mt-6" :disabled="(pinStep === 'create' ? pin : pinConfirm).length < 4" @click="savePin">Continue</UiButton>
      </div>
    </UiModal>
    <!-- bank -->
    <UiModal :open="modal === 'bank'" title="Set up withdrawal bank" size="sm" @update:open="modal = null">
      <div class="space-y-4">
        <UiSelect v-model="bankCode" label="Bank" placeholder="Select your bank" :options="(banks ?? []).map((b) => ({ label: b.name, value: b.code }))" @change="resolveAccount" />
        <UiInput v-model="accountNumber" label="Account number" inputmode="numeric" :maxlength="10" placeholder="0123456789" :error="bankError ?? undefined" @update:model-value="accountNumber = $event.replace(/\D/g, ''); resolveAccount()" />
        <p v-if="resolving" class="text-sm text-ink-500">Verifying account…</p>
        <p v-else-if="resolvedName" class="flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-sm font-medium text-success-600"><CircleCheck class="h-4 w-4" />{{ resolvedName }}</p>
        <p class="text-xs text-ink-500">The account name must match your verified Wedpluz name.</p>
      </div>
      <template #footer><UiButton size="lg" block :disabled="!resolvedName" @click="saveBank">Save bank</UiButton></template>
    </UiModal>
    <!-- top up -->
    <UiModal :open="modal === 'topup'" title="Top up" size="sm" @update:open="modal = null">
      <div class="space-y-4">
        <UiMoneyInput v-model="topUpAmount" label="Amount" placeholder="5,000" />
        <div class="flex flex-wrap gap-2"><button v-for="a in [500000, 1000000, 2000000, 5000000]" :key="a" type="button" class="chip px-3 py-1.5" @click="topUpAmount = a">{{ formatMoney(a) }}</button></div>
        <UiRadioGroup v-model="topUpMethod as string" variant="cards" :options="[{ label: 'Card', value: 'card', description: 'Instant via Paystack' }, { label: 'Bank transfer', value: 'monnify', description: 'Pay to a dedicated account (Monnify)' }]" @update:model-value="topUpMethod = $event as typeof topUpMethod" />
      </div>
      <template #footer><UiButton size="lg" block :loading="busy" :disabled="!topUpAmount" @click="topUp">Continue</UiButton></template>
    </UiModal>
    <!-- withdraw -->
    <UiModal :open="modal === 'withdraw'" title="Withdraw" size="sm" @update:open="modal = null">
      <div v-if="wallet" class="space-y-4">
        <UiMoneyInput v-model="withdrawAmount" label="Amount" :hint="`Available ${formatMoney(wallet.balance)} · Fee ${formatMoney(withdrawFee)}`" />
        <div v-if="wallet.bankAccount" class="rounded-xl bg-ink-50 p-3 text-sm"><p class="text-ink-500">To</p><p class="font-medium">{{ wallet.bankAccount.accountName }}</p><p class="text-ink-500">{{ wallet.bankAccount.bankName }} · {{ wallet.bankAccount.accountNumber }}</p></div>
        <div><p class="label">Wallet PIN</p><UiOtpInput v-model="withdrawPin" :autofocus="false" :error="withdrawError ?? undefined" /></div>
      </div>
      <template #footer><UiButton size="lg" block :disabled="!canWithdraw" :loading="busy" @click="withdraw">Withdraw {{ withdrawAmount ? formatMoney(withdrawAmount) : '' }}</UiButton></template>
    </UiModal>
    <UiModal :open="modal === 'withdrawn'" size="sm" @update:open="modal = null">
      <div class="py-6 text-center"><CircleCheck class="mx-auto h-14 w-14 text-success-500" /><h2 class="mt-4 text-2xl">Withdrawal successful</h2><p class="mt-1 text-sm text-ink-500">{{ lastWithdrawal ? formatMoney(lastWithdrawal.amount) : '' }} is on its way to your bank. Transfers usually arrive within minutes.</p><UiButton class="mt-6" block size="lg" @click="modal = null">Done</UiButton></div>
    </UiModal>
    <!-- detail -->
    <UiModal :open="!!detail" title="Transaction details" size="sm" @update:open="detail = null">
      <dl v-if="detail" class="divide-y divide-ink-100 text-sm">
        <div class="pb-4 text-center"><p :class="detail.direction === 'credit' ? 'text-3xl font-bold text-success-600' : 'text-3xl font-bold text-danger-500'">{{ detail.direction === 'debit' ? '-' : '+' }}{{ formatMoney(detail.amount) }}</p><UiBadge :status="detail.status" class="mt-2" /></div>
        <div v-for="row in [['Type', txLabel[detail.type] ?? detail.type], ['Description', detail.description], ['Counterparty', detail.counterparty ?? '—'], ['Fee', formatMoney(detail.fee)], ['Reference', detail.reference], ['Provider', detail.provider ?? '—'], ['Date', formatDateTime(detail.createdAt)]]" :key="row[0]" class="flex justify-between gap-4 py-3"><dt class="text-ink-500">{{ row[0] }}</dt><dd class="text-right font-medium">{{ row[1] }}</dd></div>
      </dl>
    </UiModal>
  </div>
</template>
