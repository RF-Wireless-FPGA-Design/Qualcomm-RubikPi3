#!/usr/bin/env bash
# One-shot setup for a fresh RUBIK Pi 3 (Ubuntu 24.04 arm64): tutorial chapters 1–3.
# Safe to re-run: each step is skipped when it is already done.
#   ./scripts/setup-rubik.sh            # uses qwen3.5:2b
#   MODEL=qwen3.5:4b ./scripts/setup-rubik.sh
set -euo pipefail
MODEL="${MODEL:-qwen3.5:2b}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
step() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

step "Ubuntu package sources"
if [ ! -s /etc/apt/sources.list.d/ubuntu.sources ] && ! grep -rqs '^deb .*ubuntu' /etc/apt/sources.list; then
  echo "ubuntu.sources is empty: restoring the standard noble arm64 sources"
  sudo tee /etc/apt/sources.list.d/ubuntu.sources >/dev/null <<'SRC'
Types: deb
URIs: http://ports.ubuntu.com/ubuntu-ports/
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://ports.ubuntu.com/ubuntu-ports/
Suites: noble-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
SRC
else
  echo "ok"
fi

step "Base packages"
sudo apt-get update
sudo apt-get install -y git curl ca-certificates build-essential poppler-utils

step "Node.js 22"
if ! command -v node >/dev/null || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

step "Ollama"
command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
for _ in $(seq 30); do curl -sf localhost:11434/api/tags >/dev/null && break; sleep 1; done
ollama -v

step "Model $MODEL"
ollama pull "$MODEL"

step "App dependencies and build"
cd "$ROOT/app"
npm ci
npm run build

step "Done"
cat <<MSG
Start the server:      cd $ROOT/app && OLLAMA_MODEL=$MODEL npm start
Or run it as a service: $ROOT/deploy/install-service.sh
Then open:             http://$(hostname -I | awk '{print $1}'):4173
MSG
