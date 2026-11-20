#!/usr/bin/env bash
#
# Wedpluz web + admin — switch back to an earlier release (installed as wedpluz-web-rollback).
#
#   wedpluz-web-rollback              # back to the release before the live one
#   wedpluz-web-rollback --list       # releases, * = live
#   wedpluz-web-rollback <release>    # a specific release directory name
#
# Static files only: nothing to reload. Runs as the app user (usir by default).
set -Eeuo pipefail

APP_DIR="${WEDPLUZ_WEB_DIR:-/var/www/apps/wedpluz/web}"
RELEASES_DIR="$APP_DIR/releases"
CURRENT_LINK="$APP_DIR/current"
PREVIOUS_LINK="$APP_DIR/previous"
LOG_FILE="$APP_DIR/deploy.log"

log() { local line; line="[$(date -u '+%Y-%m-%d %H:%M:%S')] $*"; echo "$line" >> "$LOG_FILE" 2>/dev/null || true; echo "$line"; }
current_name() { [[ -L "$CURRENT_LINK" ]] && basename "$(readlink -f "$CURRENT_LINK")" || echo none; }
mapfile -t RELEASES < <(ls -1t "$RELEASES_DIR" 2>/dev/null | grep -v '^000-placeholder$' || true)

case "${1:-}" in
    -h|--help) sed -n '3,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    --list)
        for r in "${RELEASES[@]}"; do
            mark=" "; [[ "$r" == "$(current_name)" ]] && mark="*"
            rev=$(cat "$RELEASES_DIR/$r/REVISION" 2>/dev/null | cut -c1-7)
            echo "$mark $r  ${rev:-?}"
        done
        exit 0 ;;
esac

LIVE=$(current_name)
TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
    for i in "${!RELEASES[@]}"; do
        if [[ "${RELEASES[$i]}" == "$LIVE" ]]; then TARGET="${RELEASES[$((i + 1))]:-}"; break; fi
    done
fi
[[ -n "$TARGET" && -d "$RELEASES_DIR/$TARGET" ]] || { echo "No release to roll back to (live: $LIVE). Use --list." >&2; exit 1; }
[[ "$TARGET" != "$LIVE" ]] || { echo "$TARGET is already live." >&2; exit 1; }
[[ -f "$RELEASES_DIR/$TARGET/web/index.html" ]] || { echo "$TARGET has no web/index.html." >&2; exit 1; }

ln -sfn "$RELEASES_DIR/$LIVE" "$APP_DIR/.previous.tmp" && mv -Tf "$APP_DIR/.previous.tmp" "$PREVIOUS_LINK"
ln -sfn "$RELEASES_DIR/$TARGET" "$APP_DIR/.current.tmp" && mv -Tf "$APP_DIR/.current.tmp" "$CURRENT_LINK"
log "Rolled back web + admin: $LIVE -> $TARGET"
