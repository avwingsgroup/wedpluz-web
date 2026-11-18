import { addMonths, addYears } from 'date-fns'
import { created, data, fail, noContent, paginate, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser } from './shared'
import type { Subscription, WalletTransaction } from '@/types'

const VALID_OTP = '1234'
let walletPin = '1234'
const idem = new Map<string, WalletTransaction>()

export function registerWalletHandlers() {
  route('GET', '/wallet', (req) => {
    const user = requireUser(req)
    return data({ ...db.wallet, isActive: user.walletEnabled })
  })

  route('POST', '/wallet/activate', (req) => {
    const user = requireUser(req)
    const b = body<{ otpCode: string }>(req)
    requireFields(b, ['otpCode'])
    if (b.otpCode !== VALID_OTP) fail(422, 'OTP_INVALID', 'That code is incorrect.', { otpCode: ['Invalid code'] })
    user.walletEnabled = true
    db.wallet.isActive = true
    return data(db.wallet, 'Wallet activated')
  })

  route('POST', '/wallet/pin', (req) => {
    requireUser(req)
    const b = body<{ pin: string; pinConfirmation: string; otpCode?: string; currentPin?: string }>(req)
    requireFields(b, ['pin', 'pinConfirmation'])
    if (!/^\d{4}$/.test(b.pin)) fail(422, 'VALIDATION_ERROR', 'PIN must be 4 digits.', { pin: ['PIN must be 4 digits.'] })
    if (b.pin !== b.pinConfirmation) fail(422, 'VALIDATION_ERROR', 'PINs do not match.', { pinConfirmation: ['PINs do not match.'] })
    if (db.wallet.pinSet && b.currentPin !== walletPin && b.otpCode !== VALID_OTP) fail(422, 'PIN_INVALID', 'Current PIN is incorrect.')
    walletPin = b.pin
    db.wallet.pinSet = true
    return data({ pinSet: true }, 'Wallet PIN set')
  })

  route('GET', '/wallet/transactions', (req) => {
    requireUser(req)
    const type = req.query.get('type')
    const list = db.walletTransactions.filter((t) => !type || type === 'all' || t.type === type)
    return paginate(list, req.query, 10)
  })
  route('GET', '/wallet/transactions/:id', (req) => {
    requireUser(req)
    const t = db.walletTransactions.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Transaction not found')
    return data(t)
  })

  route('GET', '/banks', () => data(db.banks))
  route('GET', '/wallet/bank-accounts', (req) => {
    requireUser(req)
    return data(db.wallet.bankAccount ? [db.wallet.bankAccount] : [])
  })
  route('POST', '/wallet/bank-accounts/resolve', (req) => {
    requireUser(req)
    const b = body<{ bankCode: string; accountNumber: string }>(req)
    requireFields(b, ['bankCode', 'accountNumber'])
    if (!/^\d{10}$/.test(b.accountNumber)) fail(422, 'VALIDATION_ERROR', 'Account number must be 10 digits.', { accountNumber: ['Account number must be 10 digits.'] })
    if (b.accountNumber === '0000000000') fail(422, 'VALIDATION_ERROR', 'Could not resolve this account.', { accountNumber: ['Could not resolve this account.'] })
    return data({ accountName: 'JOHN BROWN', bankName: db.banks.find((x) => x.code === b.bankCode)?.name ?? 'Bank' })
  })
  route('POST', '/wallet/bank-accounts', (req) => {
    requireUser(req)
    const b = body<{ bankCode: string; accountNumber: string; accountName: string }>(req)
    requireFields(b, ['bankCode', 'accountNumber', 'accountName'])
    db.wallet.bankAccount = { id: db.nextId('ba'), bankCode: b.bankCode, bankName: db.banks.find((x) => x.code === b.bankCode)?.name ?? 'Bank', accountNumber: b.accountNumber, accountName: b.accountName, isDefault: true }
    return created(db.wallet.bankAccount, 'Withdrawal bank saved')
  })
  route('DELETE', '/wallet/bank-accounts/:id', (req) => {
    requireUser(req)
    db.wallet.bankAccount = null
    return noContent()
  })

  route('POST', '/wallet/top-ups', (req) => {
    requireUser(req)
    const b = body<{ amount: number; method: string; idempotencyKey: string }>(req)
    requireFields(b, ['amount', 'method', 'idempotencyKey'])
    if (b.amount < 10000) fail(422, 'VALIDATION_ERROR', 'Minimum top up is ₦100.', { amount: ['Minimum top up is ₦100.'] })
    const existing = idem.get(b.idempotencyKey)
    if (existing) return data({ transaction: existing, authorizationUrl: null })
    const t: WalletTransaction = { id: db.nextId('wt'), reference: `WP-TU-${db.between(1000, 9999)}`, type: 'top_up', direction: 'credit', amount: b.amount, fee: 0, currency: 'NGN', status: 'pending', description: 'Top up', counterparty: b.method === 'card' ? 'Card' : 'Bank transfer', provider: b.method === 'card' ? 'paystack' : 'monnify', createdAt: new Date().toISOString(), completedAt: null, metadata: {} }
    idem.set(b.idempotencyKey, t)
    db.walletTransactions.unshift(t)
    return created({ transaction: t, authorizationUrl: `/checkout/mock-gateway?topup=${t.id}&provider=${t.provider}` })
  })
  route('POST', '/wallet/top-ups/:id/verify', (req) => {
    requireUser(req)
    const t = db.walletTransactions.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Transaction not found')
    if (t.status === 'pending') {
      t.status = 'successful'
      t.completedAt = new Date().toISOString()
      db.wallet.balance += t.amount
    }
    return data(t, 'Top up successful')
  })

  route('POST', '/wallet/withdrawals', (req) => {
    requireUser(req)
    const b = body<{ amount: number; bankAccountId: string; pin: string; idempotencyKey: string }>(req)
    requireFields(b, ['amount', 'bankAccountId', 'pin', 'idempotencyKey'])
    if (b.pin !== walletPin) fail(422, 'PIN_INVALID', 'Incorrect wallet PIN.', { pin: ['Incorrect wallet PIN.'] })
    if (b.amount < db.settings.payments.minWithdrawal) fail(422, 'VALIDATION_ERROR', `Minimum withdrawal is ₦${db.settings.payments.minWithdrawal / 100}.`, { amount: [`Minimum withdrawal is ₦${db.settings.payments.minWithdrawal / 100}.`] })
    if (b.amount > db.wallet.balance) fail(402, 'INSUFFICIENT_FUNDS', 'Insufficient wallet balance.')
    const existing = idem.get(b.idempotencyKey)
    if (existing) return data(existing)
    const fee = 5000
    const t: WalletTransaction = { id: db.nextId('wt'), reference: `WP-WD-${db.between(1000, 9999)}`, type: 'withdrawal', direction: 'debit', amount: b.amount, fee, currency: 'NGN', status: 'processing', description: 'Withdrawal', counterparty: `${db.wallet.bankAccount?.bankName ?? 'Bank'} ****${db.wallet.bankAccount?.accountNumber.slice(-4) ?? ''}`, provider: 'monnify', createdAt: new Date().toISOString(), completedAt: null, metadata: {} }
    idem.set(b.idempotencyKey, t)
    db.walletTransactions.unshift(t)
    db.wallet.balance -= b.amount + fee
    setTimeout(() => {
      t.status = 'successful'
      t.completedAt = new Date().toISOString()
    }, 4000)
    return created(t, 'Withdrawal initiated')
  })

  /* ---- plans & subscription ---- */
  route('GET', '/plans', () => data(db.plans))
  route('GET', '/me/subscription', (req) => {
    requireUser(req)
    return data(db.subscription)
  })
  route('GET', '/me/subscription/payments', (req) => {
    requireUser(req)
    return data(db.subscriptionPayments)
  })
  route('POST', '/me/subscription', (req) => {
    const user = requireUser(req)
    const b = body<{ planId: string; interval: 'monthly' | 'yearly'; paymentMethod: string; idempotencyKey: string }>(req)
    requireFields(b, ['planId', 'interval', 'paymentMethod'])
    const plan = db.plans.find((p) => p.id === b.planId)
    if (!plan) fail(404, 'NOT_FOUND', 'Plan not found')
    const amount = b.interval === 'yearly' ? plan.priceYearly : plan.priceMonthly
    if (b.paymentMethod === 'wallet' && amount > db.wallet.balance) fail(402, 'INSUFFICIENT_FUNDS', 'Wallet balance too low for this plan.')
    if (b.paymentMethod === 'wallet') {
      db.wallet.balance -= amount
      db.walletTransactions.unshift({ id: db.nextId('wt'), reference: `WP-SUB-${db.between(1000, 9999)}`, type: 'subscription', direction: 'debit', amount, fee: 0, currency: 'NGN', status: 'successful', description: `${plan.name} plan (${b.interval})`, counterparty: null, provider: 'wallet', createdAt: new Date().toISOString(), completedAt: new Date().toISOString(), metadata: {} })
    }
    const sub: Subscription = { id: db.nextId('sub'), plan, interval: b.interval, status: 'active', startedAt: new Date().toISOString(), renewsAt: (b.interval === 'yearly' ? addYears(new Date(), 1) : addMonths(new Date(), 1)).toISOString(), cancelledAt: null }
    db.setSubscription(sub)
    user.plan = plan.tier
    if (amount > 0) db.subscriptionPayments.unshift({ id: db.nextId('sp'), reference: `WP-SUB-${db.between(1000, 9999)}`, plan: { id: plan.id, name: plan.name, tier: plan.tier }, amount, currency: 'NGN', status: 'successful', paidAt: new Date().toISOString(), receiptUrl: null })
    return created({ subscription: sub, authorizationUrl: b.paymentMethod === 'wallet' || amount === 0 ? null : `/checkout/mock-gateway?subscription=${sub.id}` }, `Welcome to ${plan.name}!`)
  })
  route('DELETE', '/me/subscription', (req) => {
    const user = requireUser(req)
    db.setSubscription({ ...db.subscription, status: 'cancelled', cancelledAt: new Date().toISOString() })
    user.plan = 'free'
    return data(db.subscription, 'Subscription cancelled. You keep access until the end of the period.')
  })
}
