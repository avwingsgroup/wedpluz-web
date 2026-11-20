#!/usr/bin/env bash
#
# Wedpluz web + admin — one-time server setup (run as root, safe to re-run).
#
#   sudo bash /home/usir/wedpluz-web-deploy/scripts/provision-web.sh \
#        --web-domain wedpluz.com --admin-domain admin.wedpluz.com --email ops@wedpluz.com --ssl
#
# Sets up the static frontend next to the API on the same VPS, using the same conventions as the
# API's provision.sh: everything runs as `usir` (the API's deploy user and key are reused), code lives
# under /var/www/apps/wedpluz, and only Wedpluz's own nginx files are written. Nothing else is touched.
#
# Options:
#   --web-domain HOST        Public app host (required)           e.g. wedpluz.com (www.HOST redirects to it)
#   --admin-domain HOST      Admin console host                   (default admin.<web-domain>)
#   --api-origin URL         API origin for CSP and link previews (default https://api.wedpluz.com)
#   --ssh-user NAME          Login user for you and CI            (default usir)
#   --app-user NAME          User that owns the files             (default: same as --ssh-user)
#   --app-dir DIR            Application root                     (default /var/www/apps/wedpluz/web)
#   --email ADDRESS          Let's Encrypt account email (required with --ssl)
#   --ssl                    Issue one certificate for all three hosts now (DNS must already point here)
#   --force-nginx            Re-render the vhost even if Certbot already edited it (Certbot changes are lost)
#   -h, --help               Show this help
set -Eeuo pipefail

WEB_DOMAIN=""
ADMIN_DOMAIN=""
API_ORIGIN="https://api.wedpluz.com"
SSH_USER="usir"
APP_USER=""
APP_DIR="/var/www/apps/wedpluz/web"
EMAIL=""
SSL=0
FORCE_NGINX=0

usage() { sed -n '3,23p' "$0" | sed 's/^# \{0,1\}//'; }
while [[ $# -gt 0 ]]; do
    case "$1" in
        --web-domain) WEB_DOMAIN="$2"; shift 2 ;;
        --admin-domain) ADMIN_DOMAIN="$2"; shift 2 ;;
        --api-origin) API_ORIGIN="${2%/}"; shift 2 ;;
        --ssh-user) SSH_USER="$2"; shift 2 ;;
        --app-user) APP_USER="$2"; shift 2 ;;
        --app-dir) APP_DIR="${2%/}"; shift 2 ;;
        --email) EMAIL="$2"; shift 2 ;;
        --ssl) SSL=1; shift ;;
        --force-nginx) FORCE_NGINX=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    esac
done

BOLD=$'\e[1m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; RESET=$'\e[0m'
step() { echo "${BOLD}==> $*${RESET}"; }
ok() { echo "${GREEN}    ✓ $*${RESET}"; }
warn() { echo "${YELLOW}    ! $*${RESET}"; }
die() { echo "${RED}    ✗ $*${RESET}" >&2; exit 1; }

DEPLOY_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ $EUID -eq 0 ]] || die "Run as root (sudo bash $0 ...)."
[[ -n "$WEB_DOMAIN" ]] || die "--web-domain is required."
[[ -n "$ADMIN_DOMAIN" ]] || ADMIN_DOMAIN="admin.$WEB_DOMAIN"
[[ -n "$APP_USER" ]] || APP_USER="$SSH_USER"
[[ $SSL -eq 0 || -n "$EMAIL" ]] || die "--ssl needs --email."
[[ "$API_ORIGIN" =~ ^https?://[^/]+$ ]] || die "--api-origin must look like https://api.wedpluz.com"
API_HOST="${API_ORIGIN#*://}"

VHOST="/etc/nginx/sites-available/wedpluz-web"
HEADERS="/etc/nginx/snippets/wedpluz-web-headers.conf"
GZIP="/etc/nginx/snippets/wedpluz-web-gzip.conf"

# ---------------------------------------------------------------- checks
step "Checking the server"
command -v nginx >/dev/null || die "nginx is not installed (the API's provision.sh installs it)."
id "$SSH_USER" >/dev/null 2>&1 || die "User $SSH_USER does not exist. Provision the API first, or pass --ssh-user."
id "$APP_USER" >/dev/null 2>&1 || die "User $APP_USER does not exist."
getent group www-data >/dev/null || die "Group www-data is missing."
for host in "$WEB_DOMAIN" "www.$WEB_DOMAIN" "$ADMIN_DOMAIN"; do
    # Refuse to take over a host name another site already serves.
    host_re="${host//./\\.}"
    clash=$(grep -RlsE "server_name[^;]*[[:space:]]$host_re([[:space:]]|;)" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | xargs -r -n1 readlink -f | grep -v "^$VHOST$" || true)
    [[ -z "$clash" ]] || die "$host is already used by: $clash"
done
ok "nginx $(nginx -v 2>&1 | cut -d/ -f2), users $SSH_USER/$APP_USER, hosts $WEB_DOMAIN, www.$WEB_DOMAIN, $ADMIN_DOMAIN free"

# ---------------------------------------------------------------- directories
step "Creating $APP_DIR"
usermod -aG www-data "$APP_USER"   # nginx reads the files through group www-data
# Parents are only created when missing: /var/www/apps is shared with other apps, so its mode is never changed.
[[ -d "$(dirname "$(dirname "$APP_DIR")")" ]] || install -d -m 755 "$(dirname "$(dirname "$APP_DIR")")"
[[ -d "$(dirname "$APP_DIR")" ]] || install -d -m 2750 -o "$APP_USER" -g www-data "$(dirname "$APP_DIR")"
install -d -m 2750 -o "$APP_USER" -g www-data "$APP_DIR" "$APP_DIR/releases" "$APP_DIR/shared"
cat > "$APP_DIR/shared/deploy.conf" <<EOF
# Written by provision-web.sh — read by wedpluz-web-deploy (no secrets).
WEB_DOMAIN=$WEB_DOMAIN
ADMIN_DOMAIN=$ADMIN_DOMAIN
API_ORIGIN=$API_ORIGIN
EOF
chown "$APP_USER:www-data" "$APP_DIR/shared/deploy.conf" && chmod 640 "$APP_DIR/shared/deploy.conf"
if [[ ! -L "$APP_DIR/current" ]]; then
    for app in web admin; do
        install -d -m 2750 -o "$APP_USER" -g www-data "$APP_DIR/releases/000-placeholder/$app/assets"
        printf '<!doctype html><meta charset="utf-8"><title>Wedpluz</title><div id="app">Wedpluz is being deployed. Please check back in a few minutes.</div>\n' > "$APP_DIR/releases/000-placeholder/$app/index.html"
        printf '{"revision":"placeholder"}\n' > "$APP_DIR/releases/000-placeholder/$app/version.json"
        chown "$APP_USER:www-data" "$APP_DIR/releases/000-placeholder/$app/"{index.html,version.json}
        chmod 640 "$APP_DIR/releases/000-placeholder/$app/"{index.html,version.json}
    done
    ln -sfn "$APP_DIR/releases/000-placeholder" "$APP_DIR/current" && chown -h "$APP_USER:www-data" "$APP_DIR/current"
    ok "Placeholder page live until the first deploy"
else
    ok "Existing release kept: $(basename "$(readlink -f "$APP_DIR/current")")"
fi

# ---------------------------------------------------------------- commands
step "Installing wedpluz-web-deploy and wedpluz-web-rollback"
install -m 755 "$DEPLOY_SRC/scripts/deploy.sh" /usr/local/bin/wedpluz-web-deploy
install -m 755 "$DEPLOY_SRC/scripts/rollback.sh" /usr/local/bin/wedpluz-web-rollback
if [[ "$SSH_USER" != "$APP_USER" ]]; then
    tmp=$(mktemp)
    cat > "$tmp" <<EOF
# Wedpluz web — $SSH_USER may deploy and roll back AS $APP_USER (never as root).
$SSH_USER ALL=($APP_USER) NOPASSWD: /usr/local/bin/wedpluz-web-deploy *, /usr/local/bin/wedpluz-web-rollback, /usr/local/bin/wedpluz-web-rollback *
$SSH_USER ALL=($APP_USER) NOPASSWD: /usr/bin/bash /tmp/wedpluz-web-deploy-*.sh *
EOF
    visudo -cf "$tmp" >/dev/null || { rm -f "$tmp"; die "sudoers rule failed validation."; }
    install -m 440 "$tmp" /etc/sudoers.d/wedpluz-web && rm -f "$tmp"
    ok "sudo rule /etc/sudoers.d/wedpluz-web ($SSH_USER → $APP_USER)"
fi

# ---------------------------------------------------------------- nginx
step "Configuring nginx"
RESOLVERS=$(awk '/^nameserver/ {print $2}' /etc/resolv.conf | grep -v ':' | head -n2 | tr '\n' ' ' | sed 's/ *$//')
[[ -n "$RESOLVERS" ]] || RESOLVERS="1.1.1.1 8.8.8.8"
render() {
    sed -e "s|{{WEB_DOMAIN}}|$WEB_DOMAIN|g" -e "s|{{ADMIN_DOMAIN}}|$ADMIN_DOMAIN|g" -e "s|{{APP_DIR}}|$APP_DIR|g" \
        -e "s|{{API_ORIGIN}}|$API_ORIGIN|g" -e "s|{{API_HOST}}|$API_HOST|g" -e "s|{{RESOLVERS}}|$RESOLVERS|g" "$1"
}
HSTS='# HSTS is enabled automatically once HTTPS works (provision-web.sh --ssl).'
if [[ $SSL -eq 1 ]] || grep -qs "managed by Certbot" "$VHOST"; then
    HSTS='add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;'
fi

BACKUP_DIR=$(mktemp -d)
for f in "$VHOST" "$HEADERS" "$GZIP"; do [[ -f "$f" ]] && cp -a "$f" "$BACKUP_DIR/"; done
restore() { for f in "$VHOST" "$HEADERS" "$GZIP"; do [[ -f "$BACKUP_DIR/$(basename "$f")" ]] && cp -a "$BACKUP_DIR/$(basename "$f")" "$f"; done; }

render "$DEPLOY_SRC/config/headers.conf.template" | sed "s|# {{HSTS_LINE}}|$HSTS|" > "$HEADERS"
render "$DEPLOY_SRC/config/gzip.conf.template" > "$GZIP"
if grep -qs "managed by Certbot" "$VHOST" && [[ $FORCE_NGINX -eq 0 ]]; then
    warn "$VHOST has Certbot changes; kept as is (use --force-nginx to re-render, then re-run Certbot)."
else
    render "$DEPLOY_SRC/config/nginx-web.conf.template" > "$VHOST"
fi
ln -sfn "$VHOST" /etc/nginx/sites-enabled/wedpluz-web
if ! nginx -t >/dev/null 2>&1; then
    nginx -t || true
    restore
    [[ -f "$BACKUP_DIR/wedpluz-web" ]] || rm -f /etc/nginx/sites-enabled/wedpluz-web "$VHOST"
    die "nginx config test failed; previous files restored, nothing reloaded."
fi
systemctl reload nginx
ok "nginx reloaded: $WEB_DOMAIN (+www), $ADMIN_DOMAIN → $APP_DIR/current/{web,admin}"

# ---------------------------------------------------------------- HTTPS
if [[ $SSL -eq 1 ]]; then
    step "Issuing the certificate"
    command -v certbot >/dev/null || { apt-get update -qq && apt-get install -y -qq certbot python3-certbot-nginx; }
    certbot --nginx -n --agree-tos -m "$EMAIL" --redirect --cert-name wedpluz-web \
        -d "$WEB_DOMAIN" -d "www.$WEB_DOMAIN" -d "$ADMIN_DOMAIN"
    nginx -t && systemctl reload nginx
    ok "HTTPS for $WEB_DOMAIN, www.$WEB_DOMAIN and $ADMIN_DOMAIN (auto-renewing), HSTS on"
fi

echo
echo "${GREEN}${BOLD}Done.${RESET} Next: add the GitHub secrets (docs/deployment-vps.md, step 3) and push to the production branch."
