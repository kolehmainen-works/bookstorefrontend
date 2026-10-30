#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy-ghpages.sh - publish a static front-end directory to a GitHub Pages
# branch without GitHub Actions. Safe to run from cron / Task Scheduler.
#
# Usage: deploy-ghpages.sh [-c path/to/ghpages.conf] [-n]
#   -c  config file (default: ./ghpages.conf); relative paths in it are
#       resolved against the config file's directory
#   -n  dry run: build, stage and show the diff, but do not commit or push
#
# Flow: build hook -> sanity checks -> shallow clone of the Pages branch into
# a temp dir -> replace its contents with SRC_DIR -> commit + push only if
# something changed -> optional root-redirect repo.
# ---------------------------------------------------------------------------
set -euo pipefail

CONFIG="ghpages.conf"
DRY_RUN=0
while getopts "c:nh" opt; do
    case "$opt" in
        c) CONFIG="$OPTARG" ;;
        n) DRY_RUN=1 ;;
        *) sed -n '2,15p' "$0"; exit 0 ;;
    esac
done

die()  { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARNING: $*" >&2; }

# --- Defaults (override in the config file) --------------------------------
GH_OWNER=""                 # user or organisation
GH_REPO=""                  # repository name
BRANCH="gh-pages"           # Pages source branch
SRC_DIR="."                 # what gets published
REMOTE="${REMOTE:-}"        # explicit remote URL (env or config); empty = auto-detect
HOST_ALIAS=""               # ssh-config alias from ghpages-setup (deploy key)
BUILD_CMD=""                # run before publishing, e.g. fetch data / npm run build
BUILD_REQUIRED=1            # 0 = build failure only warns (keep old data)
JEKYLL=0                    # 0 = add .nojekyll, 1 = let GitHub run Jekyll
CUSTOM_DOMAIN=""            # writes CNAME when set
EXCLUDE=(.git .github .claude ghpages.conf node_modules '.env*' '*.tmp')
GIT_NAME="$(git config user.name 2>/dev/null || echo deploy-bot)"
GIT_EMAIL="$(git config user.email 2>/dev/null || echo deploy-bot@users.noreply.github.com)"
ROOT_REDIRECT_REPO=""       # e.g. "<owner>.github.io" to redirect the root there
ROOT_HOST_ALIAS=""          # deploy keys are per repo, so the root repo needs its own alias

[ -f "$CONFIG" ] || die "config not found: $CONFIG (copy ghpages.conf.example)"
CONFIG_DIR="$(cd "$(dirname "$CONFIG")" && pwd)"
# shellcheck source=/dev/null
. "$CONFIG_DIR/$(basename "$CONFIG")"
cd "$CONFIG_DIR"

[ -n "$GH_OWNER" ] && [ -n "$GH_REPO" ] || die "GH_OWNER and GH_REPO must be set in $CONFIG"
[ -d "$SRC_DIR" ] || die "source directory does not exist: $SRC_DIR"
SRC_DIR="$(cd "$SRC_DIR" && pwd)"

# --- Lock: avoid overlapping scheduled runs --------------------------------
LOCK="${TMPDIR:-/tmp}/ghpages-${GH_OWNER}-${GH_REPO}.lock"
mkdir "$LOCK" 2>/dev/null || die "another deploy is running (remove $LOCK if stale)"
WORK=""; ROOT_WORK=""
trap 'rm -rf "$LOCK" ${WORK:+"$WORK"} ${ROOT_WORK:+"$ROOT_WORK"}' EXIT

# --- Python for build hooks (python3 on Windows may be the Store stub) -----
PYTHON=""
for p in python3 python py; do
    if command -v "$p" >/dev/null 2>&1 && "$p" -c 'import sys; sys.exit(sys.version_info < (3, 8))' >/dev/null 2>&1; then
        PYTHON="$p"; break
    fi
done
export PYTHON SRC_DIR

# --- Build hook -------------------------------------------------------------
if [ -n "$BUILD_CMD" ]; then
    echo "== Build: $BUILD_CMD"
    if ! bash -c "$BUILD_CMD"; then
        if [ "$BUILD_REQUIRED" -eq 1 ]; then
            die "build failed, nothing published"
        fi
        warn "build failed, publishing previous files"
    fi
fi

# --- Sanity checks ----------------------------------------------------------
[ -n "$(ls -A "$SRC_DIR")" ] || die "$SRC_DIR is empty, refusing to publish"
if [ ! -f "$SRC_DIR/index.html" ] && [ ! -f "$SRC_DIR/index.md" ] && [ ! -f "$SRC_DIR/README.md" ]; then
    warn "no index.html, index.md or README.md: the site root will be a 404"
fi
if [ "$JEKYLL" -eq 1 ] && [ -f "$SRC_DIR/index.md" ] && ! head -n 1 "$SRC_DIR/index.md" | grep -q '^---[[:space:]]*$'; then
    warn "index.md has no YAML front matter, Jekyll will show it raw"
fi

# --- Resolve a remote that works (deploy-key alias, its :443 twin, normal ssh, https)
resolve_remote() {
    local repo="$1" alias="$2" cand
    local cands=()
    if [ -n "$alias" ]; then
        cands+=("git@${alias}:${GH_OWNER}/${repo}.git" "git@${alias}-443:${GH_OWNER}/${repo}.git")
    fi
    cands+=("git@github.com:${GH_OWNER}/${repo}.git" "https://github.com/${GH_OWNER}/${repo}.git")
    for cand in "${cands[@]}"; do
        if GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh} -o BatchMode=yes -o ConnectTimeout=10" \
            git ls-remote "$cand" >/dev/null 2>&1; then
            echo "$cand"; return 0
        fi
    done
    return 1
}

if [ -z "$REMOTE" ]; then
    REMOTE="$(resolve_remote "$GH_REPO" "$HOST_ALIAS")" \
        || die "cannot reach ${GH_OWNER}/${GH_REPO}; run the ghpages-setup script"
fi
echo "== Remote: $REMOTE"

# --- Clone the Pages branch (or start it) -----------------------------------
WORK="$(mktemp -d "${TMPDIR:-/tmp}/ghpages.XXXXXX")"
if git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
    git clone --quiet --depth 1 --branch "$BRANCH" "$REMOTE" "$WORK"
else
    echo "Branch $BRANCH does not exist yet, creating it"
    git init --quiet "$WORK"
    git -C "$WORK" checkout --quiet -b "$BRANCH"
    git -C "$WORK" remote add origin "$REMOTE"
fi
git -C "$WORK" config user.name  "$GIT_NAME"
git -C "$WORK" config user.email "$GIT_EMAIL"

# --- Replace contents -------------------------------------------------------
find "$WORK" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
excl=()
for e in "${EXCLUDE[@]}"; do excl+=("--exclude=$e"); done
tar -C "$SRC_DIR" ${excl[@]+"${excl[@]}"} -cf - . | tar -C "$WORK" -xf -

[ "$JEKYLL" -eq 0 ] && touch "$WORK/.nojekyll"
[ -n "$CUSTOM_DOMAIN" ] && printf '%s\n' "$CUSTOM_DOMAIN" > "$WORK/CNAME"

# --- Commit + push only when changed ----------------------------------------
git -C "$WORK" add -A
if git -C "$WORK" diff --cached --quiet; then
    echo "No changes, nothing published."
else
    git -C "$WORK" diff --cached --stat
    SRC_REV="$(git -C "$SRC_DIR" rev-parse --short HEAD 2>/dev/null || true)"
    MSG="Deploy $(date '+%Y-%m-%d %H:%M:%S') from $(hostname)${SRC_REV:+ (source $SRC_REV)}"
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "Dry run: would commit \"$MSG\" and push to $BRANCH"
    else
        git -C "$WORK" commit --quiet -m "$MSG"
        git -C "$WORK" push --quiet origin "HEAD:refs/heads/${BRANCH}"
        echo "Published."
    fi
fi

if [ -n "$CUSTOM_DOMAIN" ]; then
    SITE_URL="https://${CUSTOM_DOMAIN}/"
elif [ "$GH_REPO" = "${GH_OWNER}.github.io" ]; then
    SITE_URL="https://${GH_OWNER}.github.io/"
else
    SITE_URL="https://${GH_OWNER}.github.io/${GH_REPO}/"
fi
echo "URL: $SITE_URL"

# --- Optional: redirect <owner>.github.io root to this site -----------------
if [ -n "$ROOT_REDIRECT_REPO" ]; then
    if ROOT_REMOTE="$(resolve_remote "$ROOT_REDIRECT_REPO" "$ROOT_HOST_ALIAS")"; then
        ROOT_WORK="$(mktemp -d "${TMPDIR:-/tmp}/ghpages-root.XXXXXX")"
        if git ls-remote --exit-code --heads "$ROOT_REMOTE" main >/dev/null 2>&1; then
            git clone --quiet --depth 1 --branch main "$ROOT_REMOTE" "$ROOT_WORK"
        else
            git init --quiet "$ROOT_WORK"
            git -C "$ROOT_WORK" checkout --quiet -b main
            git -C "$ROOT_WORK" remote add origin "$ROOT_REMOTE"
        fi
        git -C "$ROOT_WORK" config user.name  "$GIT_NAME"
        git -C "$ROOT_WORK" config user.email "$GIT_EMAIL"
        cat > "$ROOT_WORK/index.html" <<EOF
<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${SITE_URL}"><title>Redirect</title></head>
<body><p><a href="${SITE_URL}">${SITE_URL}</a></p><script>location.replace('${SITE_URL}');</script></body></html>
EOF
        git -C "$ROOT_WORK" add -A
        if ! git -C "$ROOT_WORK" diff --cached --quiet && [ "$DRY_RUN" -eq 0 ]; then
            git -C "$ROOT_WORK" commit --quiet -m "Redirect root to ${SITE_URL}"
            git -C "$ROOT_WORK" push --quiet origin main
        fi
        echo "Root redirect: https://${GH_OWNER}.github.io/ -> $SITE_URL"
    else
        warn "cannot reach ${GH_OWNER}/${ROOT_REDIRECT_REPO}; root redirect skipped"
    fi
fi
