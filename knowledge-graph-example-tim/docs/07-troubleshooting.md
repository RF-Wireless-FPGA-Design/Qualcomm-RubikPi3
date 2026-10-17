# 7. Troubleshooting

Start with these three checks. They locate most problems:

```bash
systemctl is-active ollama                        # Ollama running?
curl -s localhost:11434/api/tags                  # Ollama answering, model listed?
curl -s localhost:4173/api/health                 # app server running (use :8787 in dev mode)?
```

## Chat shows "Failed to fetch", "chat API offline", or the status dot is red

The page loaded, but the browser cannot reach `/api/*` on the **same host and port** as the page.

| How you started it | Page port | API is served by | Fix |
|---|---|---|---|
| `npm run serve` / `npm start` / systemd | 4173 | the same process | Check that the process is still running (`systemctl status rubik-kg`, or the terminal) |
| `npm run dev` | 5173 | a second process on 8787, which Vite forwards `/api` to | If that process died or was never started (e.g. you ran `npx vite` on its own), stop everything and run `npm run dev` again |
| `npx vite preview` or another static server | any | **nothing** | Static servers do not run the chat API. Use `npm start` instead |

Also check that `ss -ltnp | grep -E '4173|5173|8787'` shows the ports you expect. If an old process still holds a port, find it with `ss -ltnp` and stop it.

## Status says "● qwen3.5:2b unavailable"

The app server is up, but Ollama is not. Either it isn't running (`sudo systemctl start ollama`), or the model hasn't been pulled (`ollama pull qwen3.5:2b`). If you set `OLLAMA_MODEL`, the name must match `ollama list` exactly.

## Answers are very slow

This is normal on the CPU: about 1–2 minutes for a full answer with `qwen3.5:2b`. The first question after a while also has to load the model (`ollama ps` shows whether it is loaded). To speed it up:

- Keep **Reasoning** unchecked.
- Ask narrower questions. Shorter answers come back faster.
- Close other programs that use the CPU (`htop`).

## Ollama gets killed, or the board freezes

The model does not fit in RAM. Use `qwen3.5:2b`, close the browser on the Pi itself (use a laptop instead), and check `free -h`. A swap file helps avoid crashes but makes everything slower:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

## The answer is wrong or says "the context does not contain …"

- Check the **source chips** under the answer. If the right node is not among them, retrieval missed it. Rephrase the question with words from the node's title, or select the node in the graph first (it is then always included).
- If the right node is there but the answer is still wrong, the 2B model misread the context. Try `qwen3.5:4b`, or improve the paper's `## Summary`.

## Build errors

See the table in [chapter 4.6](04-customize-your-data.md#46-common-build-errors).

## `npm start` fails with `ERR_UNKNOWN_FILE_EXTENSION ".ts"` or a `SyntaxError` at a type annotation

Node is older than 22.18, so it cannot run TypeScript files directly. Check `node -v` and `which node`, then install Node 22 as in [chapter 1.4](01-prepare-rubik-pi.md#14-install-nodejs-22).

## `apt` says packages are "not found"

Your Ubuntu package sources are missing. See [chapter 1.2](01-prepare-rubik-pi.md#12-make-sure-the-ubuntu-package-sources-are-present).

## `ollama pull` is stuck or very slow

Run it again and the download resumes. On restricted networks, check that `https://registry.ollama.ai` is reachable (`curl -I https://registry.ollama.ai`).

## The page from another computer does not load at all

- Check that the Pi and the laptop are on the same network, and use the Pi's IP address from `hostname -I`.
- Check whether a firewall is blocking the port: `sudo ufw status`. If ufw is active, run `sudo ufw allow 4173/tcp`.
- Some campus Wi-Fi networks isolate clients from each other. Use an SSH tunnel instead ([chapter 5](05-keep-it-running.md#reaching-it-from-outside-the-lab-network)).
