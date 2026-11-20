# Deployment

One repository produces two static single-page apps that both call the Laravel API.

| Deployable | Build | Output | Domain | API |
|---|---|---|---|---|
| Public web app | `npm run build` | `dist/` | `https://wedpluz.com` (and `www.` redirecting to the apex) | `https://api.wedpluz.com/api/v1` |
| Admin console | `npm run build:admin` | `dist-admin/` | `https://admin.wedpluz.com` | same API, `/admin/*` routes |
| Staging | `npm run build:staging`, `npm run build:admin:staging` | same folders | `https://staging.wedpluz.com`, `https://admin-staging.wedpluz.com` | `https://api-staging.wedpluz.com/api/v1` |

The target is chosen at build time with `VITE_APP_TARGET`. The routes of the other app are tree-shaken out, so **the public bundle contains no admin console code**, and the admin bundle contains no public pages. The development server mounts the admin console at `/admin` for convenience; production builds do not.

## 1. Requirements

- Node.js 20.19+ or 22.12+ (see `engines` in `package.json`), npm 10+.
- Any static host or CDN that supports SPA fallback and custom headers, for example Cloudflare Pages, Netlify, Vercel, S3 + CloudFront, or Nginx.

## 2. Environment variables

All variables are **build-time** and **public**. Vite inlines them into the JavaScript bundle. Never put secrets here. Provider secrets belong to the backend (see [backend-handoff/integrations.md](backend-handoff/integrations.md#1-key-ownership)).

| Variable | Required | Example (production) | Notes |
|---|---|---|---|
| `VITE_APP_TARGET` | yes | `web` or `admin` | The admin build scripts set it via `cross-env`. |
| `VITE_API_BASE_URL` | yes | `https://api.wedpluz.com/api/v1` | Versioned REST base. |
| `VITE_API_MODE` | yes | `live` | `mock` is for local development only. Production and staging builds fail unless it is `live`. |
| `VITE_WEB_ORIGIN` | yes | `https://wedpluz.com` | Canonical URLs, share links, QR codes. |
| `VITE_ADMIN_ORIGIN` | yes | `https://admin.wedpluz.com` | Cross-app links. |
| `VITE_SENTRY_DSN` | recommended | `https://…@o0.ingest.sentry.io/…` | Public DSN. Empty disables Sentry; the SDK is loaded lazily. |
| `VITE_SENTRY_ENVIRONMENT` | recommended | `production` | |
| `VITE_GOOGLE_CLIENT_ID` | for Google sign-in | `…apps.googleusercontent.com` | Public OAuth client ID. Authorise both web origins in Google Cloud. |
| `VITE_GOOGLE_MAPS_API_KEY` | optional | | Restrict to HTTP referrers and the Maps Embed API. Without it, a keyless embed is used. |
| `VITE_REALTIME_URL`, `VITE_REALTIME_KEY` | optional | `wss://ws.wedpluz.com/app/<key>` | Reverb or Pusher public app key. Empty means badge counts are polled instead. |
| `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_PAYPAL_CLIENT_ID` | optional | | Reserved for inline payment SDKs. Today checkout uses hosted redirects only. |
| `VITE_FIREBASE_CONFIG_JSON` | optional | | Public Firebase web config, for future web push. |
| `VITE_SITEMAP_EXTRA` | optional | `https://api.wedpluz.com/sitemaps/events.xml,https://api.wedpluz.com/sitemaps/vendors.xml` | Extra sitemaps listed in the generated `robots.txt` (backend event and vendor sitemaps, see [seo.md](seo.md#31-dynamic-sitemaps)). |

Files: `.env.example` (documented template), `.env.development` (mock mode), `.env.staging` and `.env.production` (live). For local overrides use `.env.*.local`, which is git-ignored. In CI, set values as environment variables of the build step; they override the files.

## 3. Build

```bash
npm ci
npm run lint && npm test          # quality gate
npm run build                     # typecheck + public app → dist/
npm run build:admin               # admin console → dist-admin/
# staging
npm run build:staging
npm run build:admin:staging
```

Output is fully static: `index.html` plus hashed assets in `assets/`. Heavy libraries are split into long-cacheable chunks (`vue`, `data`, `charts`, `sentry`). ECharts loads only on admin and organiser analytics pages.

Builds fail fast when:

- TypeScript errors exist (`build` and `build:staging` run `vue-tsc`).
- `VITE_API_MODE` is not `live` for production or staging. `ALLOW_MOCK_BUILD=1` overrides this for throwaway demo deployments only, and those builds still show the "Mock data" badge.

## 4. Hosting requirements

### 4.1 SPA fallback

Both apps use HTML5 history routing. Every unknown path must serve `/index.html` with status 200, while existing files under `/assets/` are served as-is.

Nginx (one server block per domain):

```nginx
server {
  listen 443 ssl http2;
  server_name wedpluz.com;
  root /var/www/wedpluz-web/dist;

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }
  location = /index.html {
    add_header Cache-Control "no-cache";
  }
  location / {
    try_files $uri $uri/index.html /index.html;   # serves pre-rendered page heads (dist/about/index.html) without a trailing-slash redirect
  }
  include /etc/nginx/snippets/wedpluz-security-headers.conf;
}

server {
  listen 443 ssl http2;
  server_name admin.wedpluz.com;
  root /var/www/wedpluz-web/dist-admin;
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }
  location = /index.html { add_header Cache-Control "no-cache"; }
  location = /robots.txt { return 200 "User-agent: *\nDisallow: /\n"; }
  location / { try_files $uri /index.html; }
  add_header X-Robots-Tag "noindex, nofollow" always;
  include /etc/nginx/snippets/wedpluz-security-headers.conf;
}

server { listen 80; server_name wedpluz.com www.wedpluz.com admin.wedpluz.com; return 301 https://$host$request_uri; }
server { listen 443 ssl http2; server_name www.wedpluz.com; return 301 https://wedpluz.com$request_uri; }
```

Netlify or Cloudflare Pages `_redirects`:

```
/*   /index.html   200
```

### 4.2 Caching

| Path | Cache-Control |
|---|---|
| `/assets/*` (hashed) | `public, max-age=31536000, immutable` |
| `/index.html` and SPA fallbacks | `no-cache` (always revalidate, so new deploys are picked up) |
| `/favicon.svg`, `/icons/*`, `/og/*`, `/site.webmanifest` | `public, max-age=86400` |
| `/robots.txt`, `/sitemap.xml` | `public, max-age=3600` (generated per build; staging and admin builds disallow all crawling) |

After a deploy, users holding an old `index.html` may request chunks that no longer exist. The router catches chunk-load failures and reloads the page once. Keeping the previous deploy's `/assets` available for a day avoids even that reload.

### 4.3 HTTPS and security headers

Serve both domains over HTTPS only, with HSTS. Recommended headers:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(self), geolocation=(self), payment=()
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin-allow-popups
```

`camera` and `microphone` are used by the organiser QR scanner, identity selfie capture, voice notes and live sessions. `same-origin-allow-popups` keeps Google Sign-In popups working.

**Content-Security-Policy.** Start in `Content-Security-Policy-Report-Only` mode and tighten as needed:

```
default-src 'self';
script-src 'self' https://accounts.google.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https://res.cloudinary.com https://*.amazonaws.com https://lh3.googleusercontent.com https://picsum.photos https://i.pravatar.cc;
media-src 'self' blob: https://res.cloudinary.com https://*.amazonaws.com;
connect-src 'self' https://api.wedpluz.com wss://ws.wedpluz.com https://api.cloudinary.com https://*.amazonaws.com https://*.ingest.sentry.io https://accounts.google.com;
frame-src https://accounts.google.com https://www.google.com https://maps.google.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self' https://checkout.paystack.com https://checkout.stripe.com https://www.paypal.com https://sandbox.monnify.com https://checkout.monnify.com;
object-src 'none';
```

Notes:

- `'unsafe-inline'` for styles is needed by Vue transition styles and Google Identity Services. Scripts need no inline allowance.
- `picsum.photos` and `i.pravatar.cc` are **placeholder imagery** (see [frontend-architecture.md](frontend-architecture.md#assumptions-and-design-gaps)). Remove them from the CSP once brand photography is served from Cloudinary.
- Use `api-staging.wedpluz.com` and the staging websocket host on staging.

### 4.4 API, CORS and domains

The API must allow CORS from both web origins (and staging, plus `localhost:5173` and `5174` outside production). It must accept the headers `Authorization`, `Content-Type`, `X-Correlation-Id`, `X-Client-Platform`, `X-Client-Version` and `Idempotency-Key`, and expose `X-Correlation-Id` and `Retry-After`. Tokens are sent as bearer headers, so no cookies or `credentials` are needed. See [backend-handoff/api-contracts.md](backend-handoff/api-contracts.md#111-cors).

Payment providers redirect buyers back to `https://wedpluz.com/checkout/return`. Register that URL, plus the staging equivalent, as the allowed callback or return URL in each provider dashboard.

Google Sign-In: add `https://wedpluz.com` and `https://staging.wedpluz.com` as authorised JavaScript origins.

## 5. CI/CD outline

```yaml
# .github/workflows/web.yml (outline)
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run openapi:validate
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
  deploy:
    needs: verify
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    env:
      VITE_SENTRY_DSN: ${{ secrets.SENTRY_DSN_WEB }}   # public DSN, stored as a secret only for convenience
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build && npm run build:admin
      # upload dist/ to wedpluz.com and dist-admin/ to admin.wedpluz.com with your host's CLI
```

Optionally upload source maps to Sentry in CI (`sentry-cli sourcemaps upload`) with an auth token stored as a CI secret. Production builds do not emit source maps; enable `build.sourcemap: 'hidden'` if you upload them.

## 6. Post-deploy checks

1. `https://wedpluz.com/` loads with no "Mock data" badge, and the network tab shows calls going to `api.wedpluz.com`.
2. A deep link such as `https://wedpluz.com/events/<slug>` loads directly (SPA fallback works).
3. `https://admin.wedpluz.com/` shows the admin login; the response carries `X-Robots-Tag: noindex`.
4. `https://wedpluz.com/admin` shows the public 404 page (no admin code shipped).
5. Login, the checkout redirect round trip and admin 2FA work against staging before promoting to production.
