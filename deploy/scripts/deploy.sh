#!/usr/bin/env bash
#
# Wedpluz web + admin — zero-downtime release of the static frontend builds.
#
# Runs ON THE SERVER as the app user (usir by default), e.g.
#   wedpluz-web-deploy --artifact /tmp/wedpluz-web-<sha>.tar.gz
# Each release gets its own directory holding both builds; the `current` symlink is
# switched atomically only after the release is unpacked and checked. If the live check
# fails after the switch, the previous release is restored automatically.
#
#   /var/www/apps/wedpluz/web/
#   ├── current  -> releases/20261120101500-3f2a9c1   nginx serves current/web and current/admin
#   ├── previous -> releases/20261119170000-9b1e0aa   older hashed assets stay reachable for open tabs
#   ├── releases/                                     one directory per release (last N kept)
#   ├── shared/deploy.conf                            domains, written by provision-web.sh (no secrets)
#   └── deploy.log                                    history of every deployment
#
# Usage:
#   deploy.sh --artifact /tmp/wedpluz-web-<sha>.tar.gz
#
# Options:
#   --app-dir DIR        Application root            (default /var/www/apps/wedpluz/web)
#   --keep N             Releases to keep            (default 5)
#   --skip-health        Do not run the post-switch check (not recommended)
#   -h, --help           Show this help
#
# Exit codes: 0 deployed · 1 failed before switching (nothing changed)
#             2 failed after switching and rolled back
set -Eeuo pipefail
umask 027

APP_DIR="/var/www/apps/wedpluz/web"
KEEP_RELEASES=5
ARTIFACT=""
SKIP_HEALTH=0

usage() { sed -n '3,27p' "$0" | sed 's/^# \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --artifact) ARTIFACT="$2"; shift 2 ;;
        --app-dir) APP_DIR="${2%/}"; shift 2 ;;
        --keep) KEEP_RELEASES="$2"; shift 2 ;;
        --skip-health) SKIP_HEALTH=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
    esac
done

RELEASES_DIR="$APP_DIR/releases"
SHARED_DIR="$APP_DIR/shared"
CURRENT_LINK="$APP_DIR/current"
PREVIOUS_LINK="$APP_DIR/previous"
LOG_FILE="$APP_DIR/deploy.log"
LOCK_FILE="$APP_DIR/.deploy.lock"

STARTED_AT=$(date +%s)
RELEASE_DIR=""
PREVIOUS_RELEASE=""
OLD_PREVIOUS_LINK=""
SWITCHED=0

# ---------------------------------------------------------------- output
if [[ -t 1 ]]; then BOLD=$'\e[1m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; RESET=$'\e[0m'; else BOLD=""; GREEN=""; YELLOW=""; RED=""; RESET=""; fi
log() { local line; line="[$(date -u '+%Y-%m-%d %H:%M:%S')] $*"; echo "$line" >> "$LOG_FILE" 2>/dev/null || true; echo "$line"; }
step() { log "${BOLD}==> $*${RESET}"; }
ok() { log "${GREEN}    ✓ $*${RESET}"; }
warn() { log "${YELLOW}    ! $*${RESET}"; }
fail() { log "${RED}    ✗ $*${RESET}"; }

current_target() { [[ -L "$CURRENT_LINK" ]] && readlink -f "$CURRENT_LINK" || true; }
release_name() { [[ -n "${1:-}" ]] && basename "$1" || echo none; }

link_atomically() {
    # Create a temporary link, then rename it over the real one: readers never see a missing link.
    ln -sfn "$2" "$APP_DIR/.$(basename "$1").tmp"
    mv -Tf "$APP_DIR/.$(basename "$1").tmp" "$1"
}

conf_value() {
    # Read KEY from shared/deploy.conf without sourcing it.
    grep -E "^$1=" "$SHARED_DIR/deploy.conf" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '"'"'" || true
}

# ---------------------------------------------------------------- failure handling
rollback_to() {
    warn "Rolling back to $(basename "$1")"
    link_atomically "$CURRENT_LINK" "$1"
    # Put `previous` back where it was, so older tabs keep their asset fallback.
    if [[ -n "$OLD_PREVIOUS_LINK" ]]; then link_atomically "$PREVIOUS_LINK" "$OLD_PREVIOUS_LINK"; else rm -f "$PREVIOUS_LINK"; fi
    log "${YELLOW}Rolled back; nginx serves $(basename "$1") again (no reload needed for static files).${RESET}"
}

on_error() {
    local code=$? line=${1:-?}
    trap - ERR
    fail "Deployment failed at line $line (exit $code)."
    if [[ $SWITCHED -eq 1 && -n "$PREVIOUS_RELEASE" ]]; then
        rollback_to "$PREVIOUS_RELEASE"
        log "Release $(basename "$RELEASE_DIR") kept for inspection."
        exit 2
    fi
    if [[ -n "$RELEASE_DIR" && -d "$RELEASE_DIR" && "$(current_target)" != "$RELEASE_DIR" ]]; then
        rm -rf "$RELEASE_DIR"
        warn "Removed incomplete release $(basename "$RELEASE_DIR"); the live site was not changed."
    fi
    exit 1
}
trap 'on_error $LINENO' ERR

live_check() {
    # Ask nginx on THIS server (bypassing DNS/CDN) for /version.json and require the new revision.
    local domain="$1" app="$2" expected="$3" attempt body
    for attempt in 1 2 3 4 5; do
        body=$(curl -sS --insecure --max-time 8 --resolve "$domain:443:127.0.0.1" "https://$domain/version.json" 2>/dev/null || true)
        if [[ -z "$body" ]]; then
            # No TLS listener yet (before Certbot): check over plain HTTP instead.
            body=$(curl -sS --max-time 8 --resolve "$domain:80:127.0.0.1" "http://$domain/version.json" 2>/dev/null || true)
        fi
        if [[ "$body" == *"\"revision\":\"$expected\""* ]]; then
            ok "$app is live on $domain (attempt $attempt)"
            return 0
        fi
        warn "$app check attempt $attempt on $domain: ${body:-no response}; retrying..."
        sleep 2
    done
    fail "$domain does not serve revision ${expected:0:7}. Is its nginx root $CURRENT_LINK/$app?"
    return 1
}

# ---------------------------------------------------------------- 0. preflight
mkdir -p "$RELEASES_DIR" "$SHARED_DIR"
exec 9>"$LOCK_FILE"
if command -v flock >/dev/null 2>&1; then
    flock -n 9 || { echo "Another deployment is running (lock: $LOCK_FILE)." >&2; exit 1; }
fi

step "Preflight"
[[ -n "$ARTIFACT" ]] || { fail "Pass --artifact FILE."; exit 1; }
[[ -f "$ARTIFACT" ]] || { fail "Artifact not found: $ARTIFACT"; exit 1; }
WEB_DOMAIN=$(conf_value WEB_DOMAIN)
ADMIN_DOMAIN=$(conf_value ADMIN_DOMAIN)
[[ -n "$WEB_DOMAIN" ]] || { fail "WEB_DOMAIN missing in $SHARED_DIR/deploy.conf (run provision-web.sh)."; exit 1; }
FREE_MB=$(df -Pm "$APP_DIR" | awk 'NR==2 {print $4}')
[[ "${FREE_MB:-0}" -gt 200 ]] || { fail "Less than 200 MB free on $(df -P "$APP_DIR" | awk 'NR==2 {print $6}')."; exit 1; }
PREVIOUS_RELEASE=$(current_target)
[[ "$(basename "${PREVIOUS_RELEASE:-x}")" == 000-placeholder ]] && PREVIOUS_RELEASE=""
ok "web: $WEB_DOMAIN, admin: ${ADMIN_DOMAIN:-none}, ${FREE_MB} MB free, live release: $(release_name "$PREVIOUS_RELEASE")"

# ---------------------------------------------------------------- 1. unpack and check the release
step "Installing release"
TIMESTAMP=$(date -u +%Y%m%d%H%M%S)
RELEASE_DIR="$RELEASES_DIR/$TIMESTAMP"
mkdir -p "$RELEASE_DIR"
tar -xzf "$ARTIFACT" -C "$RELEASE_DIR" --no-same-owner
REVISION=$(cat "$RELEASE_DIR/REVISION" 2>/dev/null || echo unknown)
NEW_NAME="$TIMESTAMP-${REVISION:0:7}"
mv "$RELEASE_DIR" "$RELEASES_DIR/$NEW_NAME"
RELEASE_DIR="$RELEASES_DIR/$NEW_NAME"
for app in web admin; do
    [[ -f "$RELEASE_DIR/$app/index.html" && -d "$RELEASE_DIR/$app/assets" ]] || { fail "Release is missing $app/index.html or $app/assets/."; false; }
    grep -q 'id="app"' "$RELEASE_DIR/$app/index.html" || { fail "$app/index.html has no app mount point."; false; }
    grep -q "\"revision\":\"$REVISION\"" "$RELEASE_DIR/$app/version.json" || { fail "$app/version.json does not match REVISION."; false; }
done
[[ -f "$RELEASE_DIR/web/robots.txt" ]] || warn "web/robots.txt missing (the SEO build step did not run?)"
# nginx (group www-data via the setgid app directory) needs read access; nothing here is secret.
chmod -R g+rX,o-rwx "$RELEASE_DIR"
ok "Release $NEW_NAME (revision $REVISION): web $(du -sh "$RELEASE_DIR/web" | cut -f1), admin $(du -sh "$RELEASE_DIR/admin" | cut -f1)"

# ---------------------------------------------------------------- 2. go live
step "Switching to the new release"
OLD_PREVIOUS_LINK=$(readlink -f "$PREVIOUS_LINK" 2>/dev/null || true)
[[ -n "$PREVIOUS_RELEASE" ]] && link_atomically "$PREVIOUS_LINK" "$PREVIOUS_RELEASE"
link_atomically "$CURRENT_LINK" "$RELEASE_DIR"
SWITCHED=1
ok "current -> $NEW_NAME$([[ -n "$PREVIOUS_RELEASE" ]] && echo ", previous -> $(basename "$PREVIOUS_RELEASE")")"

# ---------------------------------------------------------------- 3. verify
if [[ $SKIP_HEALTH -eq 0 ]]; then
    step "Verifying"
    live_check "$WEB_DOMAIN" web "$REVISION"
    [[ -z "$ADMIN_DOMAIN" ]] || live_check "$ADMIN_DOMAIN" admin "$REVISION"
else
    warn "Live check skipped (--skip-health)"
fi

# ---------------------------------------------------------------- 4. clean up
step "Cleaning up old releases (keeping $KEEP_RELEASES)"
mapfile -t OLD < <(ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | sed 's:/*$::' | tail -n +"$((KEEP_RELEASES + 1))")
for dir in "${OLD[@]}"; do
    name=$(basename "$dir")
    [[ "$name" == "$(release_name "$(current_target)")" || "$name" == "$(release_name "$(readlink -f "$PREVIOUS_LINK" 2>/dev/null || true)")" ]] && continue
    rm -rf "$dir" && ok "Removed $name"
done

trap - ERR
log "${GREEN}${BOLD}Deployed $NEW_NAME in $(( $(date +%s) - STARTED_AT ))s.${RESET} Previous: $(release_name "$PREVIOUS_RELEASE")"
