#!/usr/bin/env bash
# Setup openspec-loop as a full Pi package: OpenSpec CLI + Pi skills + this extension.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="${1:-$(pwd)}"

echo "==> openspec-loop setup"
echo "    package: $ROOT"
echo "    project: $PROJECT_DIR"

echo "==> Install package deps"
(cd "$ROOT" && npm install --omit=peer)

if ! command -v openspec >/dev/null 2>&1; then
  echo "==> Installing OpenSpec CLI (@fission-ai/openspec)"
  npm install -g @fission-ai/openspec@latest
else
  echo "==> OpenSpec CLI present: $(openspec --version 2>/dev/null || echo ok)"
fi

echo "==> Link Pi extension"
mkdir -p "$HOME/.pi/agent/extensions"
ln -sfn "$ROOT" "$HOME/.pi/agent/extensions/openspec-loop"
echo "    ~/.pi/agent/extensions/openspec-loop -> $ROOT"

echo "==> Init OpenSpec for Pi in project"
cd "$PROJECT_DIR"
if [[ ! -d openspec ]]; then
  openspec init --tools pi --force || openspec init --tools pi
else
  echo "    openspec/ exists — running openspec update --tools pi (best effort)"
  openspec update --tools pi 2>/dev/null || openspec update 2>/dev/null || true
fi

mkdir -p "$PROJECT_DIR/.pi"
if [[ ! -f "$PROJECT_DIR/.pi/openspec-loop.yaml" ]]; then
  cp "$ROOT/config.example.yaml" "$PROJECT_DIR/.pi/openspec-loop.yaml"
  echo "    wrote .pi/openspec-loop.yaml"
else
  echo "    kept existing .pi/openspec-loop.yaml"
fi

cat <<EOF

Done.

In Pi (/reload if already running):
  /openspec-feature <what to build>   # plan → apply loop
  /openspec-plan <what to build>      # plan only
  /openspec-loop                      # apply only (pick models + gates)

EOF
