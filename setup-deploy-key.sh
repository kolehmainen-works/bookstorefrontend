#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-deploy-key.sh - one-time setup so deploy-ghpages.sh can push from a
# server or scheduled task without a personal login.
#
# Usage: setup-deploy-key.sh [-c path/to/ghpages.conf] [-p]
#   -p  also enable GitHub Pages (branch $BRANCH, root) via the gh CLI
#
# 1. creates a passphrase-less ed25519 key for this repo only
# 2. adds ssh-config aliases <HOST_ALIAS> (github.com:22) and
#    <HOST_ALIAS>-443 (ssh.github.com:443)
# 3. registers the key as a write deploy key: via `gh` if logged in,
#    otherwise prints the key and the settings URL
# 4. verifies read and write access (push --dry-run, changes nothing)
# Idempotent: re-run until everything says OK.
# ---------------------------------------------------------------------------
set -uo pipefail

CONFIG="ghpages.conf"
ENABLE_PAGES=0
while getopts "c:ph" opt; do
    case "$opt" in
        c) CONFIG="$OPTARG" ;;
        p) ENABLE_PAGES=1 ;;
        *) sed -n '2,17p' "$0"; exit 0 ;;
    esac
done

GH_OWNER=""; GH_REPO=""; BRANCH="gh-pages"; HOST_ALIAS=""; KEY_PATH=""
[ -f "$CONFIG" ] || { echo "ERROR: config not found: $CONFIG" >&2; exit 1; }
# shellcheck source=/dev/null
. "$CONFIG"
[ -n "$GH_OWNER" ] && [ -n "$GH_REPO" ] || { echo "ERROR: set GH_OWNER and GH_REPO" >&2; exit 1; }
HOST_ALIAS="${HOST_ALIAS:-gh-${GH_REPO}}"
KEY_PATH="${KEY_PATH:-$HOME/.ssh/id_ed25519_ghpages_${GH_OWNER}_${GH_REPO}}"
SLUG="${GH_OWNER}/${GH_REPO}"

# --- 1. Key -----------------------------------------------------------------
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ -f "$KEY_PATH" ]; then
    echo "Key exists: $KEY_PATH"
else
    echo "Creating ed25519 key without passphrase (for unattended runs)..."
    ssh-keygen -q -t ed25519 -N "" -C "ghpages-$(hostname)-${SLUG}" -f "$KEY_PATH" || exit 1
fi
chmod 600 "$KEY_PATH"; chmod 644 "${KEY_PATH}.pub"

# --- 2. ssh-config ----------------------------------------------------------
SSH_CONFIG="$HOME/.ssh/config"
touch "$SSH_CONFIG" && chmod 600 "$SSH_CONFIG"
add_host_block() {
    local alias_name="$1" host_name="$2" port="$3"
    if grep -qE "^[[:space:]]*Host[[:space:]]+${alias_name}([[:space:]]|$)" "$SSH_CONFIG"; then
        echo "ssh-config already has '${alias_name}', not changed."
        return
    fi
    cat >> "$SSH_CONFIG" <<EOF

Host ${alias_name}
    HostName ${host_name}
    Port ${port}
    User git
    IdentityFile ${KEY_PATH}
    IdentitiesOnly yes
    StrictHostKeyChecking accept-new
EOF
    echo "Added ssh-config: ${alias_name} -> ${host_name}:${port}"
}
add_host_block "$HOST_ALIAS" github.com 22
add_host_block "${HOST_ALIAS}-443" ssh.github.com 443

# --- 3. Register deploy key -------------------------------------------------
find_alias() {
    local a out
    for a in "$HOST_ALIAS" "${HOST_ALIAS}-443"; do
        out="$(ssh -o BatchMode=yes -o ConnectTimeout=10 -T "$a" 2>&1)"
        if printf '%s' "$out" | grep -q "successfully authenticated"; then
            echo "$a"; return 0
        fi
    done
    return 1
}

if ! ALIAS="$(find_alias)"; then
    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
        echo "Adding write deploy key to ${SLUG} with gh..."
        gh repo deploy-key add "${KEY_PATH}.pub" --repo "$SLUG" \
            --title "ghpages-$(hostname)" --allow-write || exit 1
        ALIAS="$(find_alias)" || { echo "ERROR: key added but ssh still fails" >&2; exit 1; }
    else
        cat <<EOF

==========================================================================
Add this key as a deploy key WITH write access (once):
  https://github.com/${SLUG}/settings/keys -> Add deploy key
  [x] Allow write access
or, after 'gh auth login', just re-run this script.

$(cat "${KEY_PATH}.pub")

"Key is already in use" = this key is on a user account or another repo;
remove it there, or delete ${KEY_PATH}* and re-run.
==========================================================================
EOF
        exit 1
    fi
fi
echo "SSH OK via '$ALIAS'."
REMOTE="git@${ALIAS}:${SLUG}.git"

# --- 4. Read + write check --------------------------------------------------
git ls-remote --heads "$REMOTE" >/dev/null 2>&1 || { echo "ERROR: cannot read $REMOTE" >&2; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git init -q "$TMP"
git -C "$TMP" remote add origin "$REMOTE"
git -C "$TMP" -c user.name=t -c user.email=t@t commit -q --allow-empty -m test
if ! OUT="$(git -C "$TMP" push --dry-run origin "HEAD:refs/heads/__write_test__" 2>&1)"; then
    echo "$OUT" >&2
    echo "ERROR: no write access. Re-add the deploy key with 'Allow write access'." >&2
    exit 1
fi
echo "Write access OK."

# --- 5. Enable Pages (optional) ---------------------------------------------
if [ "$ENABLE_PAGES" -eq 1 ]; then
    if ! git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
        echo "Branch $BRANCH does not exist yet: deploy once, then re-run with -p."
    elif ! command -v gh >/dev/null 2>&1; then
        echo "gh CLI missing: enable Pages at https://github.com/${SLUG}/settings/pages"
    elif gh api "repos/${SLUG}/pages" >/dev/null 2>&1; then
        gh api -X PUT "repos/${SLUG}/pages" -f "source[branch]=${BRANCH}" -f "source[path]=/" >/dev/null \
            && echo "Pages source set to ${BRANCH} /."
    else
        gh api -X POST "repos/${SLUG}/pages" -f "source[branch]=${BRANCH}" -f "source[path]=/" >/dev/null \
            && echo "Pages enabled from ${BRANCH} /."
    fi
fi

echo
echo "Setup done. Set HOST_ALIAS=\"$HOST_ALIAS\" in $CONFIG and run deploy-ghpages.sh."
