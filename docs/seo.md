# SEO

Wedpluz is a client-rendered Vue app. This document explains how search engines and link-preview bots see it, what is implemented in the frontend, and what the backend and hosting must add for full visibility of event and vendor pages.

## 1. What is implemented

| Area | Implementation | Where |
|---|---|---|
| Titles | Unique per page, brand suffix "\| Wedpluz", 60 characters or fewer. Event pages use "Event – City"; vendor pages use "Business – Category in Location". | `src/config/seo.ts`, page `useSeo` calls |
| Meta descriptions | Curated for marketing pages. Generated for events (date, city, price and summary) and vendors (category, location, rating and summary). Plain text, 158 characters or fewer, cut at a word boundary. | `toDescription()` |
| Canonical URLs | Always absolute and without a trailing slash. Only landing-page parameters are kept (`categorySlug`, `location`, `page` on `/events` and `/vendors`). Tracking parameters (`utm_*`, `ref`) and filters are dropped. | `canonicalFor()` |
| Robots | Public pages get `index, follow, max-image-preview:large`. Filtered and search views get `noindex, follow`. Private areas get `noindex, nofollow`. Every non-production build is `noindex`. | `robotsFor()` |
| Open Graph and Twitter | Full set on every page: site name, locale `en_NG`, title, description, URL, image with alt text and dimensions, and `summary_large_image`. Event and vendor pages use their own cover image. Other pages use the branded 1200×630 image. | `applySeo()` |
| Structured data (JSON-LD) | **Home:** Organization and WebSite with a sitelinks search box. **Event:** Event (dates, status, attendance mode, place or virtual location, offers with price, currency and availability, organizer) and BreadcrumbList. **Vendor:** LocalBusiness (address, rating, reviews) and BreadcrumbList. **Listings:** ItemList and BreadcrumbList. **Vendor work:** CreativeWork. **FAQs and help:** FAQPage. | `src/utils/structuredData.ts` |
| Pre-rendered heads | Each public marketing page (`/`, `/events`, `/vendors`, `/pricing`, `/about`, `/faqs`, `/help`, `/terms`, `/privacy`) is written to its own `index.html` at build time. Each has the right title, description, canonical, Open Graph and Twitter tags, and a `<noscript>` summary with links. Crawlers and preview bots that don't run JavaScript get correct metadata. | `build/seo-plugin.ts` |
| robots.txt | Generated per build. Production allows public pages, disallows private areas and lists sitemaps. Staging and admin builds use `Disallow: /`. | `build/seo-plugin.ts` |
| sitemap.xml | Generated per build, covering all marketing pages. Event and vendor sitemaps come from the backend (§3). | `build/seo-plugin.ts` |
| Icons and manifest | SVG and PNG favicons, Apple touch icon, 192 and 512 icons, maskable icon, `site.webmanifest`, `theme-color`. | `public/`, `scripts/generate-brand-assets.mjs` |
| Performance (Core Web Vitals) | Preconnect to the API and fonts, DNS prefetch for the media CDN, `fetchpriority="high"` on event cover images, lazy-loaded media with explicit dimensions, route-level code splitting, `font-display: swap`. | `index.html`, pages |
| Privacy | User profiles (`/u/*`) are noindex. Online event links never appear in markup. Only vendor contact details already shown on the profile are included. | `config/seo.ts`, `structuredData.ts` |

Never indexed (robots meta and robots.txt): `/auth`, `/tickets`, `/checkout`, `/saved`, `/messages`, `/communities`, `/wallet`, `/premium`, `/earn`, `/profile`, `/u/`, `/settings`, `/business`, `/planner`, `/manage`, `/c/`, `/admin`. The admin console is a separate deployment, and it is always noindex.

### How it works at runtime

1. On every navigation to a new path, the router resets the head to that route's defaults (`router/guards.ts`). Nothing from the previous page survives.
2. Pages call `useSeo()` with data-driven values once their data loads. They re-apply when the data or the query string changes.
3. `applySeo()` writes every tag each time, and removes tags that no longer apply.

Google renders JavaScript, so it indexes the runtime values. The pre-rendered heads cover bots that don't run JavaScript.

## 2. Hosting requirements

- **Serve the pre-rendered page files without redirects.** `/about` must return `dist/about/index.html` with status 200, not a 301 to `/about/`. Nginx:
  ```nginx
  location / { try_files $uri $uri/index.html /index.html; }
  ```
  Netlify, Vercel and Cloudflare Pages serve `about/index.html` for `/about` automatically. Check that no host setting forces trailing slashes, because canonicals have none.
- **Use one host.** Redirect `www.wedpluz.com` and `http://` to `https://wedpluz.com` with a 301.
- **Cache headers.** HTML gets `no-cache`. Hashed assets get `immutable`. `robots.txt` and `sitemap.xml` get `max-age=3600`.
- **Unknown paths.** The SPA fallback returns `index.html` with status 200, and the 404 page sets `noindex`. Soft-404s for removed events are solved by the share endpoint in §3.2, which can return a real 404 or 410.

## 3. Backend work needed for full visibility (proposed)

Marketing pages are fully covered by the frontend. Event and vendor pages are the most valuable search and share content, but their URLs are only known to the API. Two backend additions complete the picture. Both are **proposed** and need backend approval.

### 3.1 Dynamic sitemaps

| Endpoint (outside `/api/v1`) | Content |
|---|---|
| `GET https://api.wedpluz.com/sitemaps/events.xml` | Public events with status `live` or `completed` (completed for 90 days after the event). `<loc>https://wedpluz.com/events/{slug}</loc>`, `<lastmod>` = `updatedAt`, plus `<image:image>` with the cover. |
| `GET https://api.wedpluz.com/sitemaps/vendors.xml` | Active vendor profiles: `https://wedpluz.com/vendors/{slug}`, `<lastmod>`, avatar or cover image. |
| `GET https://api.wedpluz.com/sitemaps/index.xml` | Optional sitemap index. Split files at 50,000 URLs. |

Exclude private, draft, rejected, suspended and cancelled events, and vendors that aren't active. Cache the files for 1 hour, and regenerate on publish or update events.

Then list them in the build so `robots.txt` references them, which Google accepts for cross-host sitemaps:

```bash
VITE_SITEMAP_EXTRA=https://api.wedpluz.com/sitemaps/events.xml,https://api.wedpluz.com/sitemaps/vendors.xml
```

Also submit them in Google Search Console and Bing Webmaster Tools for the `wedpluz.com` property.

### 3.2 Share and pre-render endpoint for link previews

WhatsApp, Facebook, X, LinkedIn, Telegram and Slack don't run JavaScript. Without this endpoint, every shared event shows the generic Wedpluz preview. With it, each shared event shows its own cover, title, date and price.

```
GET https://api.wedpluz.com/share/events/{slug}
GET https://api.wedpluz.com/share/vendors/{slug}
```

These return a small HTML document with:

- `<title>`, meta description, `<link rel="canonical" href="https://wedpluz.com/events/{slug}">`
- `og:type=website`, `og:title`, `og:description`, `og:url`, `og:image` (the cover, ideally a 1200×630 crop from Cloudinary: `c_fill,w_1200,h_630`), `og:image:width/height`, `twitter:card=summary_large_image`
- The same JSON-LD as the SPA (`Event` or `LocalBusiness`)
- A short visible summary and a link to the page
- Status 404, or 410 for deleted content, when the event doesn't exist or isn't public

The web host routes **bot user agents only** to it, and everyone else gets the SPA. Nginx:

```nginx
map $http_user_agent $is_preview_bot {
  default 0;
  ~*(facebookexternalhit|Facebot|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|redditbot|SkypeUriPreview|Applebot) 1;
}
location ~ ^/(events|vendors)/([^/]+)$ {
  if ($is_preview_bot) { rewrite ^/(events|vendors)/(.+)$ /share/$1/$2 break; proxy_pass https://api.wedpluz.com; }
  try_files $uri /index.html;
}
```

Use a Cloudflare Worker or a Netlify Edge Function for the same logic on those hosts. Googlebot doesn't need this, because it renders the SPA. Serving it the same HTML is optional and isn't cloaking, because the content is identical.

### 3.3 Slug stability

When an event or vendor slug changes, the API should keep old slugs and return `301`-style information: either a `redirectTo` slug in the 404 body, or a redirect from the share endpoint. The SPA can then replace the URL, so links and rankings survive renames.

## 4. Launch checklist

1. Deploy production with `VITE_WEB_ORIGIN=https://wedpluz.com`. Confirm the live `robots.txt` doesn't say `Disallow: /` (only staging should).
2. Verify the domain in **Google Search Console** (DNS TXT record) and **Bing Webmaster Tools**. Submit `https://wedpluz.com/sitemap.xml` and the backend sitemaps.
3. Run the [Rich Results Test](https://search.google.com/test/rich-results) on an event page, a vendor page and the home page. Staging pages carry the same JSON-LD and can be tested before launch.
4. Check link previews with the Facebook Sharing Debugger, the LinkedIn Post Inspector and a WhatsApp test message, once the share endpoint exists.
5. Create a **Google Business Profile** for Wedpluz with the same name, logo and website, and link the social profiles listed in `SITE.sameAs`.
6. Monitor Search Console for coverage, Core Web Vitals and enhancements (Events, Breadcrumbs, Sitelinks search box) weekly for the first month.

## 5. Content guidelines for organizers and vendors

These matter more than any markup:

- **Event titles:** descriptive ("Luxury Wedding Gala – Eko Hotel, Lagos"), not "Party!!!".
- **Event descriptions:** at least 150 words, unique, stating who it's for, what happens and what is included. Don't copy them from other sites.
- **Venues:** the full venue name, street address and city, so the Place markup and local search work.
- **Images:** high-quality covers at 1200×630 or larger, without text-heavy flyers where possible. The title becomes the alt text.
- **Vendor profiles:** a specific category, the real service area ("Lagos, Abuja"), a clear description of services, a portfolio, and real reviews.

## 6. Maintaining

- Add a public page by adding it to `STATIC_PAGES` in `src/config/seo.ts`. That gives it a curated title and description, a pre-rendered head and a sitemap entry. A unit test enforces the length limits.
- Add a private area by adding its prefix to `PRIVATE_PATH_PREFIXES`. It is then excluded from robots.txt and set to noindex.
- Regenerate icons and the share image with `node scripts/generate-brand-assets.mjs`.
- Tests:
  - `tests/unit/seo/*`: config, head manager, structured data and build output.
  - `tests/e2e/seo.spec.ts`: live head state per page type, resets between pages, and the static assets.
