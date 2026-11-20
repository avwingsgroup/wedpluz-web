# deploy/

Zero-downtime, automatically rolled-back deployments of the Wedpluz web app and admin console to the API's Ubuntu VPS. It uses the same process and conventions as `avwingsgroup/wedpluz-api/deploy`. The step-by-step guide is [docs/deployment-vps.md](../docs/deployment-vps.md).

| Path | Purpose |
|---|---|
| `scripts/provision-web.sh` | One-time setup as root: app directory, placeholder page, nginx vhosts and snippets, commands, optional TLS |
| `scripts/deploy.sh` | Release script, run as `usir` by GitHub Actions (or by hand as `wedpluz-web-deploy`) |
| `scripts/rollback.sh` | Switch back to an earlier release (`wedpluz-web-rollback`) |
| `config/nginx-web.conf.template` | Both server blocks: SPA routing, caching, previous-release assets, link-preview proxy, admin noindex |
| `config/headers.conf.template` | Security headers and a report-only CSP, included in every location |
| `config/gzip.conf.template` | Compression |

Defaults: code in `/var/www/apps/wedpluz/web` (next to the API's `/var/www/apps/wedpluz/api`), with everything running as `usir`.

On the server, as `usir`:

```bash
wedpluz-web-deploy --artifact /tmp/release.tar.gz   # what CI runs
wedpluz-web-rollback --list                          # releases, * = live
wedpluz-web-rollback                                 # previous release
```
