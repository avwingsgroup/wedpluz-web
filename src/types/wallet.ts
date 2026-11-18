import type { Currency, Id, ISODateString } from './api'

export type WalletTransactionType =
  | 'top_up'
  | 'withdrawal'
  | 'ticket_payment'
  | 'refund'
  | 'payout'
  | 'promotion_earning'
  | 'subscription'
  | 'reversal'

export type TransactionStatus = 'pending' | 'processing' | 'successful' | 'failed' | 'reversed'

export interface Wallet {
  id: Id
  balance: number
  pendingBalance: number
  currency: Currency
  isActive: boolean
  pinSet: boolean
  bankAccount: BankAccount | null
  dailyWithdrawalLimit: number
}

export interface BankAccount {
  id: Id
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
  isDefault: boolean
}

export interface Bank {
  code: string
  name: string
}

export interface WalletTransaction {
  id: Id
  reference: string
  type: WalletTransactionType
  direction: 'credit' | 'debit'
  amount: number
  fee: number
  currency: Currency
  status: TransactionStatus
  description: string
  counterparty: string | null
  provider: string | null
  createdAt: ISODateString
  completedAt: ISODateString | null
  metadata: Record<string, string>
}

export interface TopUpPayload {
  amount: number
  method: 'card' | 'paystack' | 'monnify' | 'bank_transfer'
  idempotencyKey: string
  returnUrl: string
}

export interface WithdrawPayload {
  amount: number
  bankAccountId: Id
  pin: string
  idempotencyKey: string
}

export interface SetPinPayload {
  pin: string
  pinConfirmation: string
  otpCode: string
}

export interface Plan {
  id: Id
  tier: 'free' | 'basic' | 'premium' | 'premium_plus'
  name: string
  tagline: string
  priceMonthly: number
  priceYearly: number
  currency: Currency
  features: string[]
  inheritsFrom: string | null
  isPopular: boolean
}

export interface Subscription {
  id: Id
  plan: Plan
  interval: 'monthly' | 'yearly'
  status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  startedAt: ISODateString
  renewsAt: ISODateString | null
  cancelledAt: ISODateString | null
}

export interface SubscriptionPayment {
  id: Id
  reference: string
  plan: Pick<Plan, 'id' | 'name' | 'tier'>
  amount: number
  currency: Currency
  status: TransactionStatus
  paidAt: ISODateString
  receiptUrl: string | null
}
