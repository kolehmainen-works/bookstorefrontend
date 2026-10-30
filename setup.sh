#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup.sh - one-time setup for publishing bookstorefrontend to GitHub Pages.
#
# Usage: ./setup.sh [-r] [-k]
#   -r  create the GitHub repo GH_OWNER/GH_REPO (public) with gh if it is missing
#   -k  also create a per-repo SSH deploy key (only for servers / scheduled jobs;
#       on your own machine your normal gh/git login is enough)
#
# Reads ghpages.conf. After this, publish with ./deploy.sh
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

CREATE_REPO=0
DEPLOY_KEY=0
while getopts "rkh" opt; do
    case "$opt" in
        r) CREATE_REPO=1 ;;
        k) DEPLOY_KEY=1 ;;
        *) sed -n '2,11p' "$0"; exit 0 ;;
    esac
done

# shellcheck source=/dev/null
. ./ghpages.conf
SLUG="${GH_OWNER}/${GH_REPO}"

command -v node >/dev/null || { echo "ERROR: node is not installed" >&2; exit 1; }
command -v gh   >/dev/null || { echo "ERROR: gh CLI is not installed (https://cli.github.com)" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "ERROR: run 'gh auth login' first" >&2; exit 1; }

echo "== Installing dependencies"
npm ci

echo "== Checking GitHub repo $SLUG"
if gh repo view "$SLUG" >/dev/null 2>&1; then
    echo "Repo exists."
elif [ "$CREATE_REPO" -eq 1 ]; then
    gh repo create "$SLUG" --public --description "Bookstore frontend (React + TypeScript)"
else
    echo "ERROR: $SLUG not found. Create it on github.com, or re-run with -r." >&2
    exit 1
fi

if [ "$DEPLOY_KEY" -eq 1 ]; then
    echo "== Deploy key"
    bash ./setup-deploy-key.sh -c ghpages.conf
    echo "Now set HOST_ALIAS=\"gh-${GH_REPO}\" in ghpages.conf."
fi

echo
echo "Setup done. Dry run: ./deploy.sh -n   Publish: ./deploy.sh"
