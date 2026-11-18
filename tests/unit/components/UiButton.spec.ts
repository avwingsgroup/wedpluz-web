import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import UiButton from '@/components/ui/UiButton.vue'
import UiOtpInput from '@/components/ui/UiOtpInput.vue'

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }, { path: '/events', component: { template: '<div />' } }] })

describe('UiButton', () => {
  it('renders a native button with the requested type', () => {
    const w = mount(UiButton, { props: { type: 'submit' }, slots: { default: 'Pay now' } })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('type')).toBe('submit')
    expect(w.text()).toBe('Pay now')
  })

  it('disables itself and reports busy while loading (prevents double submit)', () => {
    const w = mount(UiButton, { props: { loading: true }, slots: { default: 'Saving' } })
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.attributes('aria-busy')).toBe('true')
  })

  it('renders a RouterLink when given a route', async () => {
    const w = mount(UiButton, { props: { to: '/events' }, slots: { default: 'Browse' }, global: { plugins: [router] } })
    await router.isReady()
    expect(w.element.tagName).toBe('A')
    expect(w.attributes('href')).toBe('/events')
  })

  it('opens external links safely', () => {
    const w = mount(UiButton, { props: { href: 'https://wedpluz.com' }, slots: { default: 'Site' } })
    expect(w.attributes('target')).toBe('_blank')
    expect(w.attributes('rel')).toBe('noopener noreferrer')
  })

  it('falls back to a disabled button when a link is disabled', () => {
    const w = mount(UiButton, { props: { href: 'https://wedpluz.com', disabled: true }, slots: { default: 'Site' } })
    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('disabled')).toBeDefined()
  })
})

describe('UiOtpInput', () => {
  it('accepts digits only and emits complete when all boxes are filled', async () => {
    const w = mount(UiOtpInput, { props: { modelValue: '', length: 4, autofocus: false } })
    const inputs = w.findAll('input')
    expect(inputs).toHaveLength(4)
    await inputs[0]!.setValue('a')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([''])
    await w.setProps({ modelValue: '123' })
    await inputs[3]!.setValue('4')
    expect(w.emitted('complete')?.at(-1)).toEqual(['1234'])
  })

  it('supports pasting a full code into the first box', async () => {
    const w = mount(UiOtpInput, { props: { modelValue: '', length: 4, autofocus: false } })
    await w.findAll('input')[0]!.setValue('9876')
    expect(w.emitted('complete')?.at(-1)).toEqual(['9876'])
  })
})
