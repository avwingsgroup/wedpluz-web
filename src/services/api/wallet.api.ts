import { request } from '@/services/http'
import type { Bank, BankAccount, Plan, SetPinPayload, Subscription, SubscriptionPayment, TopUpPayload, Wallet, WalletTransaction, WithdrawPayload } from '@/types'

export const walletApi = {
  get: () => request.get<Wallet>('/wallet'),
  activate: (otpCode: string) => request.post<Wallet>('/wallet/activate', { otpCode }),
  setPin: (payload: Partial<SetPinPayload> & { currentPin?: string }) => request.post<{ pinSet: boolean }>('/wallet/pin', payload),
  transactions: (params: { type?: string; page?: number } = {}) => request.getPaginated<WalletTransaction>('/wallet/transactions', params),
  transaction: (id: string) => request.get<WalletTransaction>(`/wallet/transactions/${id}`),
  banks: () => request.get<Bank[]>('/banks'),
  bankAccounts: () => request.get<BankAccount[]>('/wallet/bank-accounts'),
  resolveAccount: (payload: { bankCode: string; accountNumber: string }) => request.post<{ accountName: string; bankName: string }>('/wallet/bank-accounts/resolve', payload),
  addBankAccount: (payload: { bankCode: string; accountNumber: string; accountName: string }) => request.post<BankAccount>('/wallet/bank-accounts', payload),
  removeBankAccount: (id: string) => request.del(`/wallet/bank-accounts/${id}`),
  topUp: (payload: TopUpPayload) => request.post<{ transaction: WalletTransaction; authorizationUrl: string | null }, TopUpPayload>('/wallet/top-ups', payload, { headers: { 'Idempotency-Key': payload.idempotencyKey } }),
  verifyTopUp: (id: string) => request.post<WalletTransaction>(`/wallet/top-ups/${id}/verify`),
  withdraw: (payload: WithdrawPayload) => request.post<WalletTransaction, WithdrawPayload>('/wallet/withdrawals', payload, { headers: { 'Idempotency-Key': payload.idempotencyKey } }),
  plans: () => request.get<Plan[]>('/plans', undefined, { skipAuth: true }),
  subscription: () => request.get<Subscription>('/me/subscription'),
  subscriptionPayments: () => request.get<SubscriptionPayment[]>('/me/subscription/payments'),
  subscribe: (payload: { planId: string; interval: 'monthly' | 'yearly'; paymentMethod: string; idempotencyKey: string }) => request.post<{ subscription: Subscription; authorizationUrl: string | null }>('/me/subscription', payload, { headers: { 'Idempotency-Key': payload.idempotencyKey } }),
  cancelSubscription: () => request.del<Subscription>('/me/subscription'),
}
