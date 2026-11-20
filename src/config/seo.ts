/**
 * Single source of truth for SEO. Used at runtime (utils/seo.ts, router) and at build time
 * (vite.config.ts → sitemap.xml, robots.txt, per-page HTML), so it must stay free of app
 * imports (`@/…`) and browser APIs.
 */

export const SITE = {
  name: 'Wedpluz',
  /** Home page title (used as-is, without the "| Wedpluz" suffix). */
  homeTitle: 'Wedpluz – Discover Events, Tickets & Vendors in Nigeria',
  titleSuffix: ' | Wedpluz',
  defaultDescription:
    'Discover events near you, buy tickets with QR check-in, and hire trusted photographers, caterers and planners. Plan unforgettable moments with Wedpluz.',
  locale: 'en_NG',
  language: 'en-NG',
  country: 'NG',
  twitterHandle: '@wedpluz',
  themeColor: '#9b119b',
  /** Paths are resolved against the web origin. */
  defaultImage: { path: '/og/wedpluz-default.jpg', width: 1200, height: 630, alt: 'Wedpluz – discover events, buy tickets and hire event vendors' },
  logoPath: '/icons/icon-512.png',
  sameAs: [
    'https://facebook.com/wedpluz',
    'https://instagram.com/wedpluz',
    'https://x.com/wedpluz',
    'https://play.google.com/store/apps/details?id=com.wedpluz.app',
    'https://apps.apple.com/app/wedpluz',
  ],
} as const

export interface StaticPageSeo {
  path: string
  /** Title without the site suffix ("About Wedpluz"); the home page uses SITE.homeTitle. */
  title: string
  description: string
  /** Visible heading + intro used in the pre-rendered <noscript> fallback for non-JS crawlers. */
  heading: string
  intro: string
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority: number
}

/** Public, indexable pages that exist independently of API data. */
export const STATIC_PAGES: StaticPageSeo[] = [
  {
    path: '/',
    title: SITE.homeTitle,
    description: SITE.defaultDescription,
    heading: 'Discover events in your area',
    intro: 'Find, plan, discover vendors, and experience moments that connect you with friends and community.',
    changefreq: 'daily',
    priority: 1,
  },
  {
    path: '/events',
    title: 'Events Near You – Weddings, Parties & Concerts',
    description: 'Browse upcoming weddings, parties, concerts, conferences and festivals near you. Compare dates and prices, then buy tickets securely on Wedpluz.',
    heading: 'Upcoming events near you',
    intro: 'Browse weddings, parties, concerts, conferences and festivals, then book tickets in minutes.',
    changefreq: 'daily',
    priority: 0.9,
  },
  {
    path: '/vendors',
    title: 'Hire Event Vendors: Photographers, Caterers & More',
    description: 'Hire trusted event vendors: photographers, caterers, planners, decorators, DJs and MCs. Compare portfolios and reviews, then message vendors on Wedpluz.',
    heading: 'Hire vendors on Wedpluz',
    intro: 'Find photographers, caterers, planners, decorators, DJs and more, with real portfolios and reviews.',
    changefreq: 'daily',
    priority: 0.9,
  },
  {
    path: '/pricing',
    title: 'Pricing & Plans for Event Organizers and Vendors',
    description: 'Compare Wedpluz plans for event organizers and vendors. Start free, then unlock promotion tools, analytics and the Pluz Planner as your events grow.',
    heading: 'Pricing & plans',
    intro: 'Start free and upgrade when you need more promotion, analytics and planning tools.',
    changefreq: 'monthly',
    priority: 0.7,
  },
  {
    path: '/about',
    title: 'About Wedpluz',
    description: 'Wedpluz helps people discover events, buy tickets and hire event vendors, and helps organizers sell tickets and manage guests in one place.',
    heading: 'About Wedpluz',
    intro: 'Connect with vendors, create events and experience life’s special moments.',
    changefreq: 'monthly',
    priority: 0.6,
  },
  {
    path: '/faqs',
    title: 'Frequently Asked Questions',
    description: 'Answers to common questions about Wedpluz tickets, refunds, payments, payouts, vendor profiles and account settings.',
    heading: 'Frequently asked questions',
    intro: 'Answers about tickets, refunds, payments, payouts and vendor profiles.',
    changefreq: 'monthly',
    priority: 0.6,
  },
  {
    path: '/help',
    title: 'Help Center & Customer Support',
    description: 'Get help with Wedpluz tickets, payments, refunds, events and your account. Contact our support team by email, phone or WhatsApp.',
    heading: 'Help center',
    intro: 'Get help with tickets, payments, refunds, events and your account.',
    changefreq: 'monthly',
    priority: 0.5,
  },
  {
    path: '/terms',
    title: 'Terms and Conditions',
    description: 'The terms that govern your use of Wedpluz, including tickets, payments, refunds, organizer and vendor responsibilities.',
    heading: 'Terms and conditions',
    intro: 'The terms that govern your use of Wedpluz.',
    changefreq: 'yearly',
    priority: 0.3,
  },
  {
    path: '/privacy',
    title: 'Privacy Policy',
    description: 'How Wedpluz collects, uses and protects your personal data, and the choices you have under Nigerian data protection law.',
    heading: 'Privacy policy',
    intro: 'How Wedpluz collects, uses and protects your personal data.',
    changefreq: 'yearly',
    priority: 0.3,
  },
]

/**
 * Areas that must never be indexed: account, checkout, organizer tools and user profiles
 * (people pages are kept out of search for privacy). Mirrored in robots.txt.
 */
export const PRIVATE_PATH_PREFIXES = [
  '/auth', '/tickets', '/checkout', '/saved', '/messages', '/communities', '/wallet', '/premium', '/earn',
  '/profile', '/u/', '/settings', '/business', '/planner', '/manage', '/c/', '/admin',
] as const

/** Query parameters that create distinct, indexable landing pages; everything else is dropped from canonicals. */
export const CANONICAL_QUERY_PARAMS: Record<string, readonly string[]> = {
  '/events': ['categorySlug', 'location', 'page'],
  '/vendors': ['categorySlug', 'location', 'page'],
}

export function isPrivatePath(path: string): boolean {
  // "/auth" matches "/auth" and "/auth/login" but not "/authors"; "/u/" matches "/u/123".
  return PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`))
}

export function staticPageFor(path: string): StaticPageSeo | undefined {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  return STATIC_PAGES.find((p) => p.path === clean)
}

/** "About Wedpluz" → "About Wedpluz | Wedpluz" unless it already names the site or is the home title. */
export function formatTitle(title?: string | null): string {
  if (!title) return SITE.homeTitle
  if (title === SITE.homeTitle || /\bwedpluz\b/i.test(title)) return title
  return `${title}${SITE.titleSuffix}`
}

/** Plain-text description: strips tags, collapses whitespace, cuts at a word boundary (≤ max chars). */
export function toDescription(text: string | null | undefined, max = 158): string {
  const plain = String(text ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, '')}…`
}
