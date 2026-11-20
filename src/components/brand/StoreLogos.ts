/* eslint-disable vue/one-component-per-file -- a small set of related render-function icons */
import { defineComponent, h } from 'vue'

// Store marks used on the "Download the app" buttons. Decorative: the button label names the store.
const attrs = { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }

/** Four-colour Google Play triangle. Pass `mono` for a single-colour (currentColor) version. */
export const GooglePlayLogo = defineComponent({
  name: 'GooglePlayLogo',
  props: { mono: { type: Boolean, default: false } },
  setup: (props) => () =>
    h('svg', attrs, [
      h('path', { d: 'M3.61 1.81 13.39 12 3.61 22.19A1.5 1.5 0 0 1 3 21V3c0-.48.22-.91.61-1.19Z', fill: props.mono ? 'currentColor' : '#00C3FF' }),
      h('path', { d: 'M16.81 8.58 13.39 12 3.61 1.81c.37-.27.88-.32 1.33-.07l11.87 6.84Z', fill: props.mono ? 'currentColor' : '#00F076' }),
      h('path', { d: 'M16.81 15.42 4.94 22.26c-.45.25-.96.2-1.33-.07L13.39 12l3.42 3.42Z', fill: props.mono ? 'currentColor' : '#F43249' }),
      h('path', { d: 'M20.4 10.66c.97.56.97 2.12 0 2.68l-3.59 2.08L13.39 12l3.42-3.42 3.59 2.08Z', fill: props.mono ? 'currentColor' : '#FFD400' }),
    ]),
})

export const AppleLogo = defineComponent({
  name: 'AppleLogo',
  setup: () => () =>
    h('svg', { ...attrs, fill: 'currentColor' }, [
      h('path', {
        d: 'M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.2 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.15-1.69 1.63-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.63-2.32-4.39-2.38-2-.16-3.68 1.09-4.62 1.09Zm3.38-3.07c.84-1.01 1.4-2.43 1.25-3.83-1.21.05-2.67.8-3.54 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.72-.69 3.56-1.7Z',
      }),
    ]),
})
