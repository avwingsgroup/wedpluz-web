import { z } from 'zod'
import { dateOfBirthSchema, emailSchema, intlPhoneSchema, nameSchema, otpSchema, passwordSchema } from './common'

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})
export type LoginForm = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    dateOfBirth: dateOfBirthSchema,
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.passwordConfirmation, { message: 'Passwords do not match', path: ['passwordConfirmation'] })
export type RegisterForm = z.infer<typeof registerSchema>

export const otpFormSchema = z.object({ code: otpSchema })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.passwordConfirmation, { message: 'Passwords do not match', path: ['passwordConfirmation'] })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: passwordSchema,
    passwordConfirmation: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.password === v.passwordConfirmation, { message: 'Passwords do not match', path: ['passwordConfirmation'] })

export const profileSetupSchema = z.object({
  username: z.string().trim().min(3, 'At least 3 characters').max(30, 'At most 30 characters').regex(/^[a-z0-9_.]+$/i, 'Letters, numbers, dots and underscores only'),
  phone: intlPhoneSchema.optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
})

export const editProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: intlPhoneSchema.optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  dateOfBirth: dateOfBirthSchema.optional().or(z.literal('')),
})

export const identitySchema = z.object({
  idType: z.enum(['nin', 'passport', 'drivers_license', 'resident_card']),
  idNumber: z.string().trim().min(8, 'Enter a valid ID number').max(20, 'Too long'),
})

export const deleteAccountSchema = z.object({
  reason: z.string().min(1, 'Choose a reason'),
  password: z.string().min(1, 'Enter your password to confirm'),
  acknowledge: z.literal(true, { message: 'Please acknowledge the consequences' }),
})
