/* eslint-disable vue/one-component-per-file -- a small set of related render-function icons */
import { defineComponent, h } from 'vue'

// Duo-tone 64px icons from the home page trust row, redrawn from the design handoff as inline SVG so they stay
// crisp at any density. Decorative: the adjacent heading carries the meaning.
const svg = (children: ReturnType<typeof h>[]) =>
  h('svg', { viewBox: '0 0 64 64', fill: 'none', 'aria-hidden': 'true', focusable: 'false' }, children)

export const VerifiedIcon = defineComponent({
  name: 'VerifiedIcon',
  setup: () => () =>
    svg([
      h('circle', { cx: 32, cy: 32, r: 32, fill: '#F0E8F0' }),
      h('g', { transform: 'translate(12.7 12.2) scale(1.65)' }, [
        h('path', {
          d: 'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z',
          fill: '#C878C8',
          stroke: '#A078A0',
          'stroke-width': 0.6,
          'stroke-linejoin': 'round',
        }),
        h('path', { d: 'm9 12 2 2 4-4', stroke: '#fff', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      ]),
    ]),
})

export const SecurePaymentIcon = defineComponent({
  name: 'SecurePaymentIcon',
  setup: () => () =>
    svg([
      h('circle', { cx: 32, cy: 32, r: 32, fill: '#F8D8E8' }),
      h('rect', { x: 15, y: 17, width: 34, height: 28, rx: 7, fill: '#E888C0' }),
      h('rect', { x: 15, y: 25, width: 34, height: 2.2, fill: '#B03078' }),
      h('rect', { x: 35, y: 37, width: 8, height: 2.2, rx: 1.1, fill: '#B03078' }),
    ]),
})

export const InstantConfirmIcon = defineComponent({
  name: 'InstantConfirmIcon',
  setup: () => () =>
    svg([
      h('circle', { cx: 32, cy: 32, r: 32, fill: '#E0F0E0' }),
      h('circle', { cx: 32.5, cy: 21.5, r: 6.5, fill: '#80D080' }),
      h('rect', { x: 19, y: 35, width: 26, height: 14, rx: 7, fill: '#78C070' }),
      h('rect', { x: 34, y: 36, width: 12, height: 13, rx: 2.5, fill: '#48B840', stroke: '#E0F0E0', 'stroke-width': 1.5 }),
      h('path', { d: 'M37 42.5l2.5 2.5 4-4.5', stroke: '#fff', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    ]),
})
