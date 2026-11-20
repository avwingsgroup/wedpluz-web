import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import UiSearchBar from '@/components/ui/UiSearchBar.vue'
import { distanceKm, formatCoords, isCoords, parseCoords } from '@/utils/geo'

vi.mock('@/services/api/events.api', () => ({
  eventsApi: {
    suggestions: vi.fn(async (q: string) =>
      q
        ? [
            { type: 'event', label: 'Movie in the park', value: 'movie-in-the-park', meta: 'Port Harcourt' },
            { type: 'category', label: 'Music', value: 'music' },
          ]
        : [
            { type: 'trending', label: 'Detty December', value: 'Detty December' },
            { type: 'recent', label: 'server recent', value: 'server recent' },
          ],
    ),
    locationSuggest: vi.fn(async (q: string) => [{ label: `${q}gos`, value: 'Lagos' }]),
  },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/events', name: 'events', component: { template: '<div />' } },
    { path: '/events/:slug', name: 'event', component: { template: '<div />' } },
    { path: '/vendors/:slug', name: 'vendor', component: { template: '<div />' } },
  ],
})

async function setup(props: Record<string, unknown> = {}) {
  const wrapper = mount(UiSearchBar, { props, attachTo: document.body, global: { plugins: [router] } })
  const [query, where] = wrapper.findAll('input[role="combobox"]')
  return { wrapper, query: query!, where: where! }
}
const settle = async () => {
  await new Promise((r) => setTimeout(r, 200)) // suggestion debounce
  await flushPromises()
}

describe('UiSearchBar', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('wp.recent_searches', JSON.stringify(['Weddings in nigeria', 'Cultural fest']))
    localStorage.setItem('wp.recent_locations', JSON.stringify(['Rivers state']))
    document.body.innerHTML = ''
  })

  it('shows local recent searches and server trending searches on focus, ignoring server recents', async () => {
    const { wrapper, query } = await setup()
    await query.trigger('focus')
    await settle()
    const text = wrapper.find('[role="listbox"]').text()
    expect(text).toContain('Recent searches')
    expect(text).toContain('Weddings in nigeria')
    expect(text).toContain('Trending searches')
    expect(text).toContain('Detty December')
    expect(text).not.toContain('server recent')
    expect(query.attributes('aria-expanded')).toBe('true')
  })

  it('navigates options with the keyboard and removes a recent search with Delete', async () => {
    const { wrapper, query } = await setup()
    await query.trigger('focus')
    await settle()
    await query.trigger('keydown', { key: 'ArrowDown' })
    expect(query.attributes('aria-activedescendant')).toMatch(/-option-0$/)
    await query.trigger('keydown', { key: 'Delete' })
    expect(JSON.parse(localStorage.getItem('wp.recent_searches')!)).toEqual(['Cultural fest'])
    expect(wrapper.find('[role="listbox"]').text()).not.toContain('Weddings in nigeria')
  })

  it('clears all recent searches', async () => {
    const { wrapper, query } = await setup()
    await query.trigger('focus')
    await settle()
    await wrapper.findAll('button').find((b) => b.text() === 'Clear all')!.trigger('click')
    expect(JSON.parse(localStorage.getItem('wp.recent_searches')!)).toEqual([])
  })

  it('offers "Search for" first and highlights matches while typing', async () => {
    const { wrapper, query } = await setup()
    await query.trigger('focus')
    await query.setValue('mov')
    await settle()
    const options = wrapper.findAll('[role="option"]')
    expect(options[0]!.text()).toContain('Search for “mov”')
    expect(options[1]!.find('mark').text()).toBe('Mov')
  })

  it('submits query and location with Enter and remembers both', async () => {
    const { wrapper, query, where } = await setup()
    await query.setValue('gala')
    await where.setValue('Abuja')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('search')?.at(-1)).toEqual(['gala', 'Abuja'])
    expect(JSON.parse(localStorage.getItem('wp.recent_searches')!)[0]).toBe('gala')
    expect(JSON.parse(localStorage.getItem('wp.recent_locations')!)[0]).toBe('Abuja')
  })

  it('opens an event suggestion directly instead of running a search', async () => {
    const push = vi.spyOn(router, 'push')
    const { wrapper, query } = await setup()
    await query.trigger('focus')
    await query.setValue('mov')
    await settle()
    await query.trigger('keydown', { key: 'ArrowDown' })
    await query.trigger('keydown', { key: 'ArrowDown' })
    await query.trigger('keydown', { key: 'Enter' })
    expect(push).toHaveBeenCalledWith({ name: 'event', params: { slug: 'movie-in-the-park' } })
    expect(wrapper.emitted('search')).toBeUndefined()
  })

  it('closes the panel on Escape without clearing the text', async () => {
    const { query } = await setup()
    await query.trigger('focus')
    await query.setValue('mov')
    await settle()
    await query.trigger('keydown', { key: 'Escape' })
    expect(query.attributes('aria-expanded')).toBe('false')
    expect((query.element as HTMLInputElement).value).toBe('mov')
  })

  it('shows "Current location" for coordinate locations and emits the coordinates', async () => {
    const { wrapper, where } = await setup({ location: '4.8156,7.0498' })
    expect((where.element as HTMLInputElement).value).toBe('Current location')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('search')?.at(-1)).toEqual(['', '4.8156,7.0498'])
  })
})

describe('geo helpers', () => {
  it('parses and formats lat,lng values', () => {
    expect(isCoords('4.8156,7.0498')).toBe(true)
    expect(isCoords('Lagos')).toBe(false)
    expect(parseCoords(' 6.5244 , 3.3792 ')).toEqual({ lat: 6.5244, lng: 3.3792 })
    expect(parseCoords('95,10')).toBeNull()
    expect(formatCoords(4.815612, 7.049891)).toBe('4.8156,7.0499')
  })

  it('computes great-circle distance', () => {
    const lagosToAbuja = distanceKm({ lat: 6.5244, lng: 3.3792 }, { lat: 9.0765, lng: 7.3986 })
    expect(lagosToAbuja).toBeGreaterThan(520)
    expect(lagosToAbuja).toBeLessThan(540)
  })
})
