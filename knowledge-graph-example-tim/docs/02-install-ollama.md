# 2. Install Ollama and a model

[Ollama](https://ollama.com) downloads and runs open LLMs locally and exposes them through an HTTP API on port `11434`. The knowledge-graph server talks to that API.

## 2.1 Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

The script downloads the ARM64 build (more than 1 GB, so allow several minutes on a slow link), creates an `ollama` user, and installs and starts the `ollama` systemd service. It will report that **no GPU was found and Ollama runs in CPU-only mode**. That is expected on the RUBIK Pi: Ollama cannot use the Adreno GPU or the Hexagon NPU, so models run on the 8 CPU cores.

Check it:

```bash
ollama -v                              # e.g. ollama version is 0.40.3
systemctl is-active ollama             # active
curl -s localhost:11434/api/tags       # {"models":[]}
```

## 2.2 Choose and pull a model

The RUBIK Pi has about 7 GB of usable RAM, and the OS, Node.js and the browser need some of it.

| Model | Download | RAM in use (`ollama ps`) | Speed on the Pi | Notes |
|---|---|---|---|---|
| `qwen3.5:2b` | 2.7 GB | 3.0 GB (measured, 8k context) | ~1–2 min per answer | **Recommended default.** Leaves memory free for everything else |
| `qwen3.5:4b` | 3.3 GB | ~4.5 GB (estimate) | slower (not measured) | Better answers. Close other programs first |
| 8B+ models | 5 GB+ | > 7 GB | — | Do not fit; the board starts swapping or gets killed for running out of memory |

```bash
ollama pull qwen3.5:2b
ollama list
```

The download can be slow (around 1–2 MB/s on some campus networks). If it stops, run the same command again and it resumes.

## 2.3 Test the model once

```bash
ollama run qwen3.5:2b "In one sentence, what is federated learning?"
```

Or test the HTTP API that the app uses. `"think": false` turns off Qwen's step-by-step reasoning, which is much faster on a CPU:

```bash
curl -s localhost:11434/api/chat -d '{
  "model": "qwen3.5:2b", "stream": false, "think": false,
  "messages": [{"role": "user", "content": "In one sentence, what is federated learning?"}]
}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["message"]["content"])'
```

The first call takes longer because the model has to load into RAM. The app asks Ollama to keep the model loaded for 30 minutes after each question.

## 2.4 (Optional) Ollama settings

- **Use a different model in the app:** set `OLLAMA_MODEL=qwen3.5:4b` when you start the server (see [chapter 3](03-run-the-app.md#35-configuration)).
- **Ollama on another machine:** set `OLLAMA_URL=http://<that-host>:11434` for the app. On that machine, make Ollama listen on the network with `sudo systemctl edit ollama`, add these lines, then run `sudo systemctl restart ollama`:
  ```ini
  [Service]
  Environment="OLLAMA_HOST=0.0.0.0"
  ```
  Only do this on a network you trust, because Ollama has no authentication.

Next: [3. Run the knowledge graph →](03-run-the-app.md)
