import { z } from 'zod'
import { amountSchema, pinSchema } from './common'

export const topUpSchema = z.object({
  amount: amountSchema.min(10000, 'Minimum top up is ₦100'),
  method: z.enum(['card', 'paystack', 'monnify', 'bank_transfer']),
})

export const withdrawSchema = z.object({
  amount: amountSchema.min(100000, 'Minimum withdrawal is ₦1,000'),
  bankAccountId: z.string().min(1, 'Choose a withdrawal bank'),
  pin: pinSchema,
})

export const bankAccountSchema = z.object({
  bankCode: z.string().min(1, 'Select your bank'),
  accountNumber: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
  accountName: z.string().min(1),
})

export const setPinSchema = z
  .object({ pin: pinSchema, pinConfirmation: z.string() })
  .refine((v) => v.pin === v.pinConfirmation, { message: 'PINs do not match', path: ['pinConfirmation'] })
