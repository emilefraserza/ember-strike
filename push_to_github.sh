#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-}"
if [ -z "$REPO_URL" ]; then
  echo "Usage: $0 <github-repo-url>"
  exit 1
fi

git init
git checkout -B main
git add .
git commit -m "feat(ember-strike): sync V4 10-symbol roster, math-sdk event books, and frontend stage"
git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"
git push -u origin main
