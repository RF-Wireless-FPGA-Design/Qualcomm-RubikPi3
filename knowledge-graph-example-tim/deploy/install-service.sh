#!/usr/bin/env bash
# Builds the app and installs it as the systemd service "rubik-kg" (starts now and at every boot).
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/../app" && pwd)"
RUN_AS="${SUDO_USER:-$USER}"

(cd "$APP_DIR" && npm run build)
sed -e "s|__USER__|$RUN_AS|" -e "s|__APP_DIR__|$APP_DIR|" "$(dirname "$0")/rubik-kg.service" \
  | sudo tee /etc/systemd/system/rubik-kg.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now rubik-kg
sleep 2
systemctl --no-pager --lines=5 status rubik-kg
echo
echo "Open http://$(hostname -I | awk '{print $1}'):4173"
