#!/usr/bin/env bash
# Make bd (beads) available, restore the issue database from the git-tracked
# .beads/issues.jsonl when it is missing, then print the agent context.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

if ! command -v bd >/dev/null 2>&1; then
  npm install -g @beads/bd@1.3.1 >/dev/null 2>&1 || {
    echo "beads: could not install bd (npm install -g @beads/bd)" >&2
    exit 0
  }
fi

if [ ! -d .beads/embeddeddolt ] && [ ! -d .beads/dolt ]; then
  bd bootstrap --yes >/dev/null 2>&1 || echo "beads: bd bootstrap failed" >&2
fi

bd prime --hook-json
