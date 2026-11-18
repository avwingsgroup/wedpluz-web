/**
 * Marketing imagery used by public pages. In production these should be replaced by
 * the brand photography from the design handoff (exported from Figma and served via
 * Cloudinary/S3). They are referenced centrally so swapping them is a one-line change.
 */
const seed = (name: string, w: number, h: number) => `https://picsum.photos/seed/wedpluz-${name}/${w}/${h}`

export const ILLUSTRATIONS = {
  onboarding: [
    { title: 'Show Your Work', image: seed('onboard-photographer', 900, 1200) },
    { title: 'Discover Events Near You', image: seed('onboard-events', 900, 1200) },
    { title: 'Plan Unforgettable Moments', image: seed('onboard-planner', 900, 1200) },
  ],
  homeTickets: seed('home-tickets', 900, 600),
  homePhone: seed('home-phone', 700, 900),
  vendorsPhone: seed('vendors-phone', 700, 900),
  professionals: [
    { label: 'Bridal wear rentals', handle: '@bea-you-wed', image: seed('pro-bridal', 600, 800) },
    { label: 'Caterer', handle: '@bestchefz', image: seed('pro-caterer', 600, 800) },
    { label: 'Photographer', handle: '@shot-it-moi', image: seed('pro-photo', 600, 800) },
    { label: 'Event Planner', handle: '@yournextevent', image: seed('pro-planner', 600, 800) },
    { label: 'Rental provider', handle: '@eventrentals', image: seed('pro-rentals', 600, 800) },
  ],
  businessCard: seed('business-card', 600, 500),
  planner: {
    menu: seed('menu', 400, 400),
    hall: seed('hall', 400, 400),
    cake: seed('cake', 400, 400),
    brand: seed('brand', 400, 400),
  },
} as const
