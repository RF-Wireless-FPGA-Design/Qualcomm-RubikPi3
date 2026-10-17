# 1. Prepare the RUBIK Pi 3

This chapter takes a freshly flashed RUBIK Pi 3 (Ubuntu 24.04 Server image) to the point where it can build the app. Run the commands on the Pi, either over SSH or with a keyboard and monitor.

> **Already have Node.js ≥ 22.18, git and curl?** Skip to [chapter 2](02-install-ollama.md).

## 1.1 Log in and check the board

```bash
ssh ubuntu@<pi-ip>                 # find the IP on your router, or run `hostname -I` on the Pi
cat /proc/device-tree/model; echo  # → Thundercomm, Inc. RUBIK Pi 3
uname -m                           # → aarch64
free -h                            # about 7 GB total
df -h /                            # you need about 5 GB free (Ollama + model + node_modules)
```

## 1.2 Make sure the Ubuntu package sources are present

Some RUBIK Pi images ship with **only Qualcomm's repository** configured, and an empty `/etc/apt/sources.list.d/ubuntu.sources` file. The symptoms are that `apt install` reports common packages (`python3-pip`, `unzip`, `build-essential`) as "not found", and kernel updates are held back.

Check it:

```bash
cat /etc/apt/sources.list.d/ubuntu.sources
```

If the file is empty or missing, restore the standard Ubuntu 24.04 (noble) ARM64 sources:

```bash
sudo tee /etc/apt/sources.list.d/ubuntu.sources >/dev/null <<'EOF'
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
EOF
```

ARM64 Ubuntu packages come from `ports.ubuntu.com`, not `archive.ubuntu.com`.

## 1.3 Update and install the base tools

```bash
sudo apt update
sudo apt full-upgrade -y           # can take 10–20 minutes the first time
sudo apt install -y git curl ca-certificates build-essential poppler-utils
```

`poppler-utils` provides `pdftotext`, which the PDF helper in [chapter 4](04-customize-your-data.md#45-draft-a-paper-file-from-a-pdf-optional) uses.

If the upgrade installed a new kernel, reboot now (`sudo reboot`) so the rest of the tutorial runs on it.

## 1.4 Install Node.js 22

The server runs TypeScript files directly with Node's built-in type stripping, which needs **Node.js 22.18 or newer**. Ubuntu's own `nodejs` package is too old, so install Node from NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v      # v22.18.0 or newer
npm -v
```

> **Old `node` on your PATH?** If `which node` prints something other than `/usr/bin/node` (for example a broken link in `~/.local/bin` left behind by another tool), remove that link or fix your `PATH`.

## 1.5 Get the code

```bash
cd ~
git clone https://github.com/RF-Wireless-FPGA-Design/Qualcomm-RubikPi3.git
cd Qualcomm-RubikPi3/knowledge-graph-example-tim
```

Next: [2. Install Ollama and a model →](02-install-ollama.md)
