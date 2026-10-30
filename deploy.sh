#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy.sh - build bookstorefrontend and publish dist/ to the gh-pages branch,
# then make sure GitHub Pages is turned on for it.
#
# Usage: ./deploy.sh [-n]
#   -n  dry run: build and show what would change, push nothing
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

# shellcheck source=/dev/null
. ./ghpages.conf
SLUG="${GH_OWNER}/${GH_REPO}"

# deploy-ghpages.sh checks SRC_DIR exists before it builds
mkdir -p "$SRC_DIR"
bash ./deploy-ghpages.sh -c ghpages.conf "$@"

case " $* " in *" -n "*) exit 0 ;; esac

# First deploy: enable Pages from gh-pages / root
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if ! gh api "repos/${SLUG}/pages" >/dev/null 2>&1; then
        gh api -X POST "repos/${SLUG}/pages" -f "source[branch]=${BRANCH}" -f "source[path]=/" >/dev/null \
            && echo "Pages enabled from ${BRANCH} /. First build takes about a minute."
    fi
else
    echo "gh not logged in: enable Pages once at https://github.com/${SLUG}/settings/pages"
fi
