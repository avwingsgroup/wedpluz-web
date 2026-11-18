import { z } from 'zod'

export const emailSchema = z.string().trim().min(1, 'Email is required').email('Enter a valid email address')
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number')
export const nameSchema = z.string().trim().min(2, 'Enter at least 2 characters').max(60, 'Too long')
export const phoneSchema = z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Enter a valid phone number')
export const otpSchema = z.string().regex(/^\d{4}$/, 'Enter the 4-digit code')
export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits')
export const urlSchema = z.string().trim().url('Enter a valid link')
export const amountSchema = z.number().int('Enter a whole amount').positive('Enter an amount greater than zero')

export const dateOfBirthSchema = z
  .string()
  .min(1, 'Date of birth is required')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')
  .refine((v) => {
    const dob = new Date(v)
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)
    return age >= 13
  }, 'You must be at least 13 years old')

export type FieldErrors<T> = Partial<Record<keyof T & string, string>>

/** Flattens zod issues into a field → first message map. Nested paths are joined with dots. */
export function flattenIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!(key in out)) out[key] = issue.message
  }
  return out
}
