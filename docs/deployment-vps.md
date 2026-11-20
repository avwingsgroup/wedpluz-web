# Deploying the web app to the VPS

The public app (`wedpluz.com`) and the admin console (`admin.wedpluz.com`) deploy to the same VPS as the API, with the same process the API uses (`avwingsgroup/wedpluz-api`, `docs/deployment-vps.md`). Every push to the `production` branch is checked, built and deployed with no downtime, and a failed release rolls itself back. Both apps call the API at `https://api.wedpluz.com/api/v1`.

You do steps 1–4 once.

## How a deployment works

```text
push to production ──► GitHub Actions
                         1. tests     lint, types, unit tests, OpenAPI check, production builds, Playwright (mock API)
                         2. build     vite build --mode production → dist/web and dist/admin
                                      version.json (commit + time) in both, REVISION → release.tar.gz
                         3. deploy    ssh as usir → scp to /tmp → deploy.sh
                                         unpack into releases/<time>-<sha>, check both apps
                                         previous -> the old release (its assets stay reachable)
                                         atomic switch of `current`   ◄── site changes here, no reload, no downtime
                                         ask nginx on the server for /version.json on both hosts
                                         wrong revision? ──► switch back automatically
                                         keep the last 5 releases
                         4. public check through DNS/Cloudflare: both hosts serve the new commit
```

Server layout, next to the API in `/var/www/apps/wedpluz/api`:

```text
/var/www/apps/wedpluz/web/
├── current  -> releases/20261120101500-3f2a9c1   nginx: wedpluz.com → current/web, admin.wedpluz.com → current/admin
├── previous -> releases/20261119170000-9b1e0aa   older hashed assets for tabs opened before the deploy
├── releases/                                     last 5 releases (readable by nginx through group www-data)
├── shared/deploy.conf                            the host names (no secrets)
└── deploy.log                                    every deploy and rollback
```

The builds are static files and contain no secrets, so there is no `.env` on the server for the frontend. Its public settings (API URL, origins, Google client ID, sitemaps) are committed in `.env.production`.

| Piece | File | Runs |
|---|---|---|
| Server setup | `deploy/scripts/provision-web.sh` | once, as root |
| Release | `deploy/scripts/deploy.sh` (installed as `wedpluz-web-deploy`) | every deploy, as `usir` |
| Rollback | `deploy/scripts/rollback.sh` (`wedpluz-web-rollback`) | when needed, as `usir` |
| Checks | `.github/workflows/ci.yml` | every push and pull request |
| Automatic deploy | `.github/workflows/deploy.yml` | push to `production`, or run by hand |
| nginx | `deploy/config/*.template` | rendered by `provision-web.sh` |

## Before you start

- **The API is provisioned** on the server (it creates `usir`, nginx and the deploy key). The frontend reuses them.
- **DNS** (Cloudflare): `wedpluz.com`, `www.wedpluz.com` and `admin.wedpluz.com` point at the server. `admin.wedpluz.com` has no record yet (checked 2026-11-20); add it.
- **HTTPS through Cloudflare**: Let's Encrypt's HTTP check can't reach the server while Cloudflare forces HTTPS to an origin that has no certificate yet. For the first certificate, set the three records to **DNS only** (grey cloud), or turn off *Always Use HTTPS*, run step 2 with `--ssl`, then switch the records back to **Proxied** and set *SSL/TLS → Full (strict)*.
- **GitHub**: admin access to `avwingsgroup/wedpluz-web`.

## Step 1 — Copy the deploy folder

From a checkout of this repository:

```bash
scp -r deploy usir@<server-ip>:/home/usir/wedpluz-web-deploy
ssh usir@<server-ip>
```

## Step 2 — Provision

```bash
sudo bash /home/usir/wedpluz-web-deploy/scripts/provision-web.sh \
  --web-domain wedpluz.com --admin-domain admin.wedpluz.com \
  --email ops@wedpluz.com --ssl
```

Leave out `--ssl` until DNS reaches the server (see Cloudflare above), then run it again with `--ssl`. `--help` lists every option (`--api-origin`, `--ssh-user`, `--app-user`, `--app-dir`).

What it does, touching nothing that isn't Wedpluz's:

1. Refuses to continue if another nginx site already serves one of the three host names.
2. Creates `/var/www/apps/wedpluz/web` owned by `usir`, group `www-data` (setgid, mode 2750), and a placeholder page until the first deploy.
3. Installs `wedpluz-web-deploy` and `wedpluz-web-rollback` in `/usr/local/bin`.
4. Writes `/etc/nginx/sites-available/wedpluz-web` plus two snippets (`wedpluz-web-headers.conf`, `wedpluz-web-gzip.conf`). It tests nginx before reloading, and if the test fails it restores the old files and reloads nothing.
5. With `--ssl`: one Let's Encrypt certificate `wedpluz-web` for all three hosts, HTTP → HTTPS redirects, and HSTS.

It is safe to run again. Once Certbot has edited the vhost, a re-run keeps it as is unless you pass `--force-nginx`.

What nginx does for you:

- **SPA routing:** every app route serves `index.html`. Pre-rendered page heads such as `/about` serve their own title and description.
- **Caching:** hashed assets are cached for a year (`immutable`). `index.html` and routes are `no-cache`. `version.json` is `no-store`. Icons are cached for a day and `robots.txt`/`sitemap.xml` for an hour.
- **Tabs opened before a deploy:** asset files missing from the new release are served from `previous`.
- **Link previews:** WhatsApp, Facebook, X, LinkedIn, Telegram and other preview bots on `/events/{slug}` and `/vendors/{slug}` are proxied to `https://api.wedpluz.com/share/...`, so each shared link shows its own title and image. If the API is down, they get the normal page.
- **Headers:** security headers on every response, with CSP in report-only mode first (see [deployment.md §4.3](deployment.md#43-https-and-security-headers)).
- **Admin:** `noindex` headers and a `robots.txt` that blocks all crawling.
- **Redirects:** `www.wedpluz.com` → `wedpluz.com`. Dotfiles are denied.

## Step 3 — Connect GitHub Actions

In `avwingsgroup/wedpluz-web`: **Settings → Environments → New environment → `production`**. Optionally add *Required reviewers*. Then add the **same values the API repository uses**: the same server, user and deploy key. Organization-level secrets also work.

| Type | Name | Value |
|---|---|---|
| Secret | `VPS_HOST` | Server IP or host name |
| Secret | `VPS_USER` | `usir` |
| Secret | `VPS_PORT` | SSH port (omit for 22) |
| Secret | `VPS_SSH_KEY` | The private deploy key (`~/.ssh/wedpluz_deploy`) |
| Secret | `VPS_KNOWN_HOSTS` | Output of `ssh-keyscan -t ed25519 <server-ip>` |
| Variable (optional) | `WEB_URL` / `ADMIN_URL` | Default `https://wedpluz.com` / `https://admin.wedpluz.com` |
| Variable (optional) | `VPS_APP_USER` | Only if provisioned with `--app-user` |
| Variable (optional) | `VITE_SENTRY_DSN`, `VITE_REALTIME_URL`, `VITE_REALTIME_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_PAYSTACK_PUBLIC_KEY` | Public build settings. These end up in public JavaScript, so never put a secret here. |

## Step 4 — First deployment

```bash
git checkout main && git pull
git checkout -b production && git push -u origin production
```

Or go to **Actions → Deploy → Run workflow** and pick a branch or commit. After it finishes:

```bash
curl https://wedpluz.com/version.json          # {"revision":"<commit>","builtAt":"…"}
curl https://admin.wedpluz.com/version.json
sudo tail -n 20 /var/www/apps/wedpluz/web/deploy.log
```

## Day-to-day

| Task | How |
|---|---|
| Deploy | Merge to `production` (or **Run workflow**) |
| See releases | `wedpluz-web-rollback --list` (`*` = live) |
| Roll back | `wedpluz-web-rollback` (previous) or `wedpluz-web-rollback <release>` — instant, no reload |
| What is live | `curl https://wedpluz.com/version.json` |
| Deploy history | `/var/www/apps/wedpluz/web/deploy.log` |
| nginx logs | `/var/log/nginx/wedpluz-web.*.log`, `/var/log/nginx/wedpluz-admin.*.log` |

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Deploy fails at "Verifying", then rolls back | nginx doesn't serve `current/web` or `current/admin` for that host. Check `server_name` and `root` in `/etc/nginx/sites-available/wedpluz-web` and `nginx -t`. |
| Public check fails, server check passed | DNS or Cloudflare. The `admin` record is missing, or the records point elsewhere. |
| Cloudflare error 525/526 | SSL mode is *Full (strict)* but the origin has no valid certificate: run `provision-web.sh --ssl` (DNS only during issuance). |
| `Permission denied (publickey)` in Actions | `VPS_SSH_KEY` doesn't match a key in `usir`'s `authorized_keys`. |
| `Host key verification failed` | `VPS_KNOWN_HOSTS` is missing or stale. Rescan and compare fingerprints. |
| Old page after deploy | A stale `index.html` in a CDN cache. Cloudflare respects `no-cache`; purge `/` once if a page rule overrides it. |
| A shared event shows the generic preview | Check `curl -A WhatsApp https://wedpluz.com/events/<slug>`. If you get the SPA, the API's share endpoint is unreachable from the server. |
