import { computed, reactive, ref, toRaw } from 'vue'
import type { ZodType } from 'zod'
import { flattenIssues } from '@/validations/common'
import { isApiError } from '@/services/http'
import { useUiStore } from '@/stores/ui.store'

export interface UseFormOptions<TValues extends Record<string, unknown>, TResult> {
  initialValues: TValues
  schema?: ZodType
  onSubmit: (values: TValues) => Promise<TResult> | TResult
  onSuccess?: (result: TResult, values: TValues) => void
  /** Show the API error message as a toast (default true). Field errors are always mapped. */
  toastErrors?: boolean
}

/**
 * Minimal typed form composable backed by zod.
 * - validates on submit (and per-field on blur via `touch`)
 * - maps Laravel 422 `errors` onto fields
 * - guards against double submission
 */
export function useForm<TValues extends Record<string, unknown>, TResult = unknown>(options: UseFormOptions<TValues, TResult>) {
  const ui = useUiStore()
  const values = reactive({ ...options.initialValues }) as TValues
  const errors = ref<Record<string, string>>({})
  const touched = ref<Record<string, boolean>>({})
  const submitting = ref(false)
  const submitted = ref(false)
  const formError = ref<string | null>(null)

  const isValid = computed(() => Object.keys(errors.value).length === 0)

  function validate(): boolean {
    if (!options.schema) return true
    const result = options.schema.safeParse(toRaw(values))
    if (result.success) {
      errors.value = {}
      // Apply coercions/defaults from the schema back onto the form.
      Object.assign(values as Record<string, unknown>, result.data as Record<string, unknown>)
      return true
    }
    errors.value = flattenIssues(result.error)
    return false
  }

  function validateField(field: string) {
    if (!options.schema) return
    const result = options.schema.safeParse(toRaw(values))
    const next = { ...errors.value }
    delete next[field]
    if (!result.success) {
      const issues = flattenIssues(result.error)
      if (issues[field]) next[field] = issues[field]
    }
    errors.value = next
  }

  function touch(field: string) {
    touched.value = { ...touched.value, [field]: true }
    if (submitted.value || touched.value[field]) validateField(field)
  }

  function setError(field: string, message: string) {
    errors.value = { ...errors.value, [field]: message }
  }
  function clearErrors() {
    errors.value = {}
    formError.value = null
  }
  function reset(next?: Partial<TValues>) {
    Object.assign(values as Record<string, unknown>, options.initialValues, next ?? {})
    errors.value = {}
    touched.value = {}
    submitted.value = false
    formError.value = null
  }
  function setValues(next: Partial<TValues>) {
    Object.assign(values as Record<string, unknown>, next)
  }

  async function submit(): Promise<TResult | undefined> {
    if (submitting.value) return undefined
    submitted.value = true
    formError.value = null
    if (!validate()) return undefined
    submitting.value = true
    try {
      const result = await options.onSubmit(toRaw(values) as TValues)
      options.onSuccess?.(result, toRaw(values) as TValues)
      return result
    } catch (error) {
      if (isApiError(error)) {
        if (error.isValidation && Object.keys(error.errors).length) {
          const mapped: Record<string, string> = {}
          for (const [k, v] of Object.entries(error.errors)) mapped[k] = v[0] ?? 'Invalid'
          errors.value = { ...errors.value, ...mapped }
          formError.value = error.message
        } else {
          formError.value = error.message
          if (options.toastErrors !== false) ui.error(error.message)
        }
      } else {
        formError.value = 'Something went wrong. Please try again.'
        if (options.toastErrors !== false) ui.error(formError.value)
        if (import.meta.env.DEV) console.error(error)
      }
      return undefined
    } finally {
      submitting.value = false
    }
  }

  function fieldError(field: string): string | undefined {
    return submitted.value || touched.value[field] ? errors.value[field] : undefined
  }

  return { values, errors, touched, submitting, submitted, formError, isValid, validate, validateField, touch, setError, clearErrors, reset, setValues, submit, fieldError }
}
