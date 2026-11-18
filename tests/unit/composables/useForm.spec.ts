import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { z } from 'zod'
import { useForm } from '@/composables/useForm'
import { ApiError } from '@/services/http/errors'
import { useUiStore } from '@/stores/ui.store'

const schema = z.object({ email: z.string().email('Enter a valid email address'), name: z.string().trim().min(2, 'Too short') })

describe('useForm', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('does not submit when validation fails and exposes field errors after submit', async () => {
    const onSubmit = vi.fn()
    const form = useForm({ initialValues: { email: 'bad', name: 'J' }, schema, onSubmit })
    expect(form.fieldError('email')).toBeUndefined()
    await form.submit()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(form.fieldError('email')).toBe('Enter a valid email address')
    expect(form.fieldError('name')).toBe('Too short')
  })

  it('applies schema transforms (trim) before submitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue('ok')
    const form = useForm({ initialValues: { email: 'a@b.co', name: '  John  ' }, schema, onSubmit })
    const result = await form.submit()
    expect(result).toBe('ok')
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co', name: 'John' })
  })

  it('maps Laravel 422 field errors onto the form', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError({ message: 'Please check the highlighted fields.', status: 422, code: 'VALIDATION_ERROR', errors: { email: ['The email has already been taken.'] } }),
    )
    const form = useForm({ initialValues: { email: 'taken@b.co', name: 'John' }, schema, onSubmit })
    await form.submit()
    expect(form.errors.value.email).toBe('The email has already been taken.')
    expect(form.formError.value).toBe('Please check the highlighted fields.')
  })

  it('shows non-field API errors as a toast', async () => {
    const ui = useUiStore()
    const spy = vi.spyOn(ui, 'error')
    const onSubmit = vi.fn().mockRejectedValue(new ApiError({ message: 'Your account has been suspended.', status: 403, code: 'ACCOUNT_SUSPENDED' }))
    const form = useForm({ initialValues: { email: 'a@b.co', name: 'John' }, schema, onSubmit })
    await form.submit()
    expect(spy).toHaveBeenCalledWith('Your account has been suspended.')
    expect(form.formError.value).toBe('Your account has been suspended.')
  })

  it('guards against duplicate submissions while a request is pending', async () => {
    let resolve!: (v: string) => void
    const onSubmit = vi.fn().mockImplementation(() => new Promise<string>((r) => (resolve = r)))
    const form = useForm({ initialValues: { email: 'a@b.co', name: 'John' }, schema, onSubmit })
    const first = form.submit()
    const second = await form.submit()
    expect(second).toBeUndefined()
    expect(form.submitting.value).toBe(true)
    resolve('done')
    await first
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(form.submitting.value).toBe(false)
  })

  it('resets values and errors', async () => {
    const form = useForm({ initialValues: { email: '', name: '' }, schema, onSubmit: vi.fn() })
    form.values.email = 'x'
    await form.submit()
    form.reset()
    expect(form.values.email).toBe('')
    expect(form.errors.value).toEqual({})
    expect(form.submitted.value).toBe(false)
  })
})
