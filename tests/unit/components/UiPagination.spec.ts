import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiPagination from '@/components/ui/UiPagination.vue'

describe('UiPagination', () => {
  it('lists every page when there are seven or fewer', () => {
    const w = mount(UiPagination, { props: { page: 1, lastPage: 5 } })
    const labels = w.findAll('button').map((b) => b.text()).filter(Boolean)
    expect(labels).toEqual(['1', '2', '3', '4', '5'])
  })

  it('collapses long ranges with ellipses around the current page', () => {
    const w = mount(UiPagination, { props: { page: 10, lastPage: 25 } })
    expect(w.text()).toContain('…')
    const labels = w.findAll('button').map((b) => b.text()).filter(Boolean)
    expect(labels).toEqual(['1', '9', '10', '11', '25'])
  })

  it('marks the current page for assistive technology', () => {
    const w = mount(UiPagination, { props: { page: 2, lastPage: 3 } })
    expect(w.find('[aria-current="page"]').text()).toBe('2')
  })

  it('emits page changes and disables previous on the first page', async () => {
    const w = mount(UiPagination, { props: { page: 1, lastPage: 3 } })
    expect(w.get('[aria-label="Previous page"]').attributes('disabled')).toBeDefined()
    await w.get('[aria-label="Next page"]').trigger('click')
    await w.findAll('button').find((b) => b.text() === '3')!.trigger('click')
    expect(w.emitted('update:page')).toEqual([[2], [3]])
  })

  it('shows the result range label', () => {
    const w = mount(UiPagination, { props: { page: 2, lastPage: 25, total: 482, perPage: 20 } })
    expect(w.text()).toContain('21–40 of 482')
  })
})
