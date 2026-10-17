# 5. Keep it running

`npm run serve` stops when you close the SSH session. Pick one of the options below.

## Option A: systemd service (recommended)

The service starts at boot, restarts if it crashes, and waits for Ollama.

```bash
cd ~/Qualcomm-RubikPi3/knowledge-graph-example-tim
./deploy/install-service.sh
```

The script builds the app, fills your user name and folder into `deploy/rubik-kg.service`, installs it as `/etc/systemd/system/rubik-kg.service`, and enables it.

Day-to-day commands:

```bash
systemctl status rubik-kg              # is it running?
journalctl -u rubik-kg -f              # live logs (Ctrl-C to stop watching)
sudo systemctl restart rubik-kg        # after changing code or settings
sudo systemctl disable --now rubik-kg  # stop it and remove it from boot
```

**After editing `knowledge/`**, run `cd app && npm run build`. No restart is needed, because the server reloads `graph.json` when it changes. A restart is needed only when you change files in `app/server/`.

**Change the model or port:** run `sudo systemctl edit rubik-kg` and add the lines below, then `sudo systemctl restart rubik-kg`:

```ini
[Service]
Environment=OLLAMA_MODEL=qwen3.5:4b
Environment=PORT=8080
```

Ollama itself is already a systemd service (`systemctl status ollama`), installed in chapter 2.

## Option B: tmux (quick, no root)

```bash
tmux new -s kg                 # open a session
cd ~/Qualcomm-RubikPi3/knowledge-graph-example-tim/app && npm run serve
# press Ctrl-b, then d, to detach. The server keeps running after you log out.
tmux attach -t kg              # come back later
```

This does not survive a reboot.

## Reaching it from outside the lab network

The server listens on every interface of the Pi, so anyone on the same LAN can open `http://<pi-ip>:4173`. The chat API has **no login**, so do not forward the port to the internet. To show it to someone remotely, use an SSH tunnel (`ssh -L 4173:localhost:4173 ubuntu@<pi-ip>`, then open `http://localhost:4173` on your laptop) or a VPN such as Tailscale.

Next: [6. How it works →](06-how-it-works.md)
