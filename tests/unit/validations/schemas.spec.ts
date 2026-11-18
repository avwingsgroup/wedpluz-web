import { describe, expect, it } from 'vitest'
import { flattenIssues } from '@/validations/common'
import { loginSchema, profileSetupSchema, registerSchema, resetPasswordSchema } from '@/validations/auth.schema'
import { bankAccountSchema, setPinSchema, withdrawSchema } from '@/validations/wallet.schema'
import { scheduleSchema } from '@/validations/event.schema'

const errorsOf = (result: { success: boolean; error?: unknown }) =>
  result.success ? {} : flattenIssues(result.error as Parameters<typeof flattenIssues>[0])

describe('auth schemas', () => {
  const validRegistration = {
    firstName: 'John',
    lastName: 'Brown',
    email: 'john@example.com',
    dateOfBirth: '1995-05-20',
    password: 'secret123',
    passwordConfirmation: 'secret123',
  }

  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true)
  })

  it('requires a letter and a number in the password', () => {
    expect(errorsOf(registerSchema.safeParse({ ...validRegistration, password: 'abcdefgh', passwordConfirmation: 'abcdefgh' })).password).toBe('Include at least one number')
    expect(errorsOf(registerSchema.safeParse({ ...validRegistration, password: '12345678', passwordConfirmation: '12345678' })).password).toBe('Include at least one letter')
  })

  it('reports mismatched confirmation on the confirmation field', () => {
    expect(errorsOf(registerSchema.safeParse({ ...validRegistration, passwordConfirmation: 'other123' })).passwordConfirmation).toBe('Passwords do not match')
  })

  it('rejects users younger than 13', () => {
    const recent = new Date(Date.now() - 5 * 365 * 86400000).toISOString().slice(0, 10)
    expect(errorsOf(registerSchema.safeParse({ ...validRegistration, dateOfBirth: recent })).dateOfBirth).toBe('You must be at least 13 years old')
  })

  it('validates login email format', () => {
    expect(errorsOf(loginSchema.safeParse({ email: 'nope', password: 'x' })).email).toBe('Enter a valid email address')
  })

  it('restricts usernames to letters, numbers, dots and underscores', () => {
    expect(profileSetupSchema.safeParse({ username: 'john.brown_1' }).success).toBe(true)
    expect(errorsOf(profileSetupSchema.safeParse({ username: 'john brown' })).username).toBe('Letters, numbers, dots and underscores only')
  })

  it('checks reset password confirmation', () => {
    expect(resetPasswordSchema.safeParse({ password: 'secret123', passwordConfirmation: 'secret123' }).success).toBe(true)
    expect(resetPasswordSchema.safeParse({ password: 'secret123', passwordConfirmation: 'secret124' }).success).toBe(false)
  })
})

describe('wallet schemas', () => {
  it('enforces the ₦1,000 minimum withdrawal in kobo and a 4-digit PIN', () => {
    expect(withdrawSchema.safeParse({ amount: 100000, bankAccountId: 'ba_1', pin: '1234' }).success).toBe(true)
    const errs = errorsOf(withdrawSchema.safeParse({ amount: 99999, bankAccountId: '', pin: '12a4' }))
    expect(errs.amount).toBe('Minimum withdrawal is ₦1,000')
    expect(errs.bankAccountId).toBe('Choose a withdrawal bank')
    expect(errs.pin).toBe('PIN must be 4 digits')
  })

  it('rejects fractional kobo amounts', () => {
    expect(errorsOf(withdrawSchema.safeParse({ amount: 100000.5, bankAccountId: 'ba_1', pin: '1234' })).amount).toBe('Enter a whole amount')
  })

  it('requires NUBAN 10-digit account numbers', () => {
    expect(bankAccountSchema.safeParse({ bankCode: '058', accountNumber: '0123456789', accountName: 'John Brown' }).success).toBe(true)
    expect(bankAccountSchema.safeParse({ bankCode: '058', accountNumber: '12345', accountName: 'John Brown' }).success).toBe(false)
  })

  it('requires matching PIN confirmation', () => {
    expect(errorsOf(setPinSchema.safeParse({ pin: '1234', pinConfirmation: '4321' })).pinConfirmation).toBe('PINs do not match')
  })
})

describe('event schedule schema', () => {
  const base = { date: '2026-12-07', startTime: '16:00', endTime: '18:00', label: null, venue: null, online: null }

  it('requires a venue for physical events', () => {
    expect(errorsOf(scheduleSchema.safeParse({ ...base, attendanceMode: 'physical' })).venue).toBe('Add the venue details')
  })

  it('requires both venue and online details for hybrid events', () => {
    const errs = errorsOf(scheduleSchema.safeParse({ ...base, attendanceMode: 'hybrid' }))
    expect(errs.venue).toBeDefined()
    expect(errs.online).toBeDefined()
  })

  it('rejects end times before start times on single-day schedules', () => {
    const online = { platform: 'zoom', link: 'https://zoom.us/j/123' }
    expect(errorsOf(scheduleSchema.safeParse({ ...base, endTime: '15:00', attendanceMode: 'online', online })).endTime).toBe('End time must be after start time')
  })
})
