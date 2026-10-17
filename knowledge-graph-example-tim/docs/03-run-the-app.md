# 3. Run the knowledge graph

All commands in this chapter run inside the `app/` folder.

```bash
cd ~/Qualcomm-RubikPi3/knowledge-graph-example-tim/app
npm ci          # installs the exact dependency versions from package-lock.json (~1 min)
```

## 3.1 Production mode (use this one)

```bash
npm run serve
```

This one command:

1. runs `build:graph`, which reads `../knowledge/` and writes `public/graph.json`, `../knowledge/export/*.jsonl` and `../knowledge/papers/INDEX.md`;
2. type-checks the TypeScript (`tsc --noEmit`);
3. bundles the UI into `dist/` with Vite;
4. starts `server/server.ts`, a single Node.js process that serves the UI **and** the chat API on port **4173**.

You should see:

```
Graph: 103 nodes, 151 edges { Person: 1, Institution: 2, Topic: 15, … }
✓ built in 3.10s
[graph] loaded …/app/dist/graph.json (103 nodes)
[server] http://0.0.0.0:4173  model=qwen3.5:2b  ollama=http://127.0.0.1:11434
```

Open **`http://localhost:4173`** on the Pi, or **`http://<pi-ip>:4173`** from another device on the same network. The server listens on all interfaces (`0.0.0.0`).

After the first build you can restart without rebuilding: `npm start`.

## 3.2 Check that it works

```bash
curl -s localhost:4173/api/health
# {"ok":true,"model":"qwen3.5:2b","graph":{"nodes":103,"docs":103},"ollama":{"ok":true,"modelAvailable":true}}
```

- `ollama.ok: false` means Ollama is not running: `sudo systemctl start ollama`.
- `modelAvailable: false` means the model has not been pulled yet: `ollama pull qwen3.5:2b`.

Ask a question from the command line. The answer streams back as NDJSON, one JSON object per line:

```bash
curl -sN localhost:4173/api/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Which papers build on the Transformer?"}]}'
```

The first line lists the graph nodes that were retrieved (`{"type":"sources",…}`), then the `{"type":"token",…}` lines carry the answer text, and the last line is `{"type":"done",…}`.

## 3.3 Using the UI

- **Search** (top left): finds papers, topics, methods, authors and so on. Press Enter to jump to the first hit.
- **Node types legend:** click a type to hide or show it.
- **Click a node:** shows its properties, summary, contributions and method, plus its neighbours grouped by relation. Click a neighbour to jump to it.
- **Neighbourhood:** restricts the view to the 1- or 2-hop neighbourhood of the selected node.
- **URL hash:** the selected node is stored in the URL (for example `#paper:rag-neurips2020`), so you can share a link to it.
- **💬 Chat with the graph:**
  - The nodes that were retrieved for an answer are highlighted in the graph.
  - Click a source chip under an answer to open that node.
  - If a node is selected, it is always added to the context, so "summarise this paper" works.
  - **Reasoning** lets Qwen think before it answers. It gives better answers to hard questions but is much slower on the CPU.

## 3.4 Development mode (when you change the code)

```bash
npm run dev
```

This runs **two** processes: the Vite dev server on **5173**, which hot-reloads the UI, and the chat API on **8787**. Vite forwards every `/api/*` request to port 8787, so open `http://<pi-ip>:5173`.

> If the chat in dev mode shows **"Failed to fetch"** or **"chat API offline"**, the API process on 8787 is not running, for example because you started `npx vite` on its own. Stop everything and start with `npm run dev`, or use `npm run serve`. See [Troubleshooting](07-troubleshooting.md).

The graph is not hot-reloaded. After you edit files in `knowledge/`, run `npm run build:graph` and refresh the browser. The API server picks up the new `graph.json` within 2 seconds by itself.

## 3.5 Configuration

All settings are environment variables, for example `OLLAMA_MODEL=qwen3.5:4b PORT=8080 npm start`.

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4173` | HTTP port of the server |
| `HOST` | `0.0.0.0` | Interface to listen on (`127.0.0.1` makes it reachable only from the Pi itself) |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Where Ollama runs |
| `OLLAMA_MODEL` | `qwen3.5:2b` | Model used for answers (and by `draft:paper`) |
| `GRAPH_PATH` | `dist/graph.json`, else `public/graph.json` | Which graph file the server loads |
| `KNOWLEDGE_DIR` | `../knowledge` | Folder that `build:graph` and `draft:paper` read from |

## 3.6 All npm scripts

| Command | What it does |
|---|---|
| `npm run build:graph` | Rebuild the graph from `knowledge/` only |
| `npm run build` | `build:graph` + type check + bundle the UI into `dist/` |
| `npm start` | Start the production server (needs `dist/` from a previous build) |
| `npm run serve` | `build` + `start` |
| `npm run dev` | Hot-reload UI on 5173 + API on 8787 |
| `npm run typecheck` | Type-check only |
| `npm run draft:paper -- file.pdf` | Draft a paper markdown file from a PDF (chapter 4.5) |

The server stops when you close the terminal. To keep it running, see [chapter 5](05-keep-it-running.md).

Next: [4. Use your own data →](04-customize-your-data.md)
