/**
 * Production server: serves the built UI (dist/) and the chat API on one port.
 *
 *   GET  /api/health   server, graph and Ollama status
 *   POST /api/chat     { messages: [{role, content}], focusId? } → NDJSON stream:
 *                      {"type":"sources","nodes":[...]} then {"type":"token","text":...}… then {"type":"done"}
 *
 * Env: PORT (4173), HOST (0.0.0.0), OLLAMA_URL (http://127.0.0.1:11434), OLLAMA_MODEL (qwen3.5:2b),
 *      GRAPH_PATH (dist/graph.json, falling back to public/graph.json)
 */
import { createReadStream, existsSync, readFileSync, statSync, watchFile } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KnowledgeGraph } from '../src/types.ts';
import { GraphIndex } from './retrieve.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.HOST ?? '0.0.0.0';
const OLLAMA = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'qwen3.5:2b';

// ---------- graph (hot-reloaded when graph.json is rebuilt) ----------

const graphPath = process.env.GRAPH_PATH
  ? resolve(ROOT, process.env.GRAPH_PATH)
  : existsSync(join(DIST, 'graph.json')) ? join(DIST, 'graph.json') : join(ROOT, 'public', 'graph.json');
let index: GraphIndex;
function loadGraph() {
  index = new GraphIndex(JSON.parse(readFileSync(graphPath, 'utf8')) as KnowledgeGraph);
  console.log(`[graph] loaded ${graphPath} (${index.size.nodes} nodes)`);
}
loadGraph();
watchFile(graphPath, { interval: 2000 }, () => {
  try {
    loadGraph();
  } catch (err) {
    console.error('[graph] reload failed, keeping previous graph', err);
  }
});

// ---------- chat ----------

const systemPrompt = () => `You are the assistant for ${index.owner.short}'s personal research knowledge graph.
${index.owner.name}${index.owner.headline ? ` — ${index.owner.headline}` : ''}.
Answer ONLY from the knowledge-graph context provided. If the context does not contain the answer, say so plainly.
Be concise. Use bullet points for lists. When you mention a paper, give its title (and year/venue if known).
Do not invent papers, results, numbers, awards or affiliations.`;

type Msg = { role: 'user' | 'assistant'; content: string };

async function readJson(req: IncomingMessage, limit = 64_000): Promise<any> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw new Error('payload too large');
  }
  return JSON.parse(raw || '{}');
}

async function handleChat(req: IncomingMessage, res: ServerResponse) {
  const body = await readJson(req);
  const history: Msg[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .slice(-6)
    .map((m: Msg) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  const question = [...history].reverse().find((m) => m.role === 'user')?.content;
  if (!question) return sendJson(res, 400, { error: 'messages must contain a user message' });

  // Retrieval uses the last two user turns so follow-ups ("what method did it use?") keep their subject.
  const userTurns = history.filter((m) => m.role === 'user').slice(-2).map((m) => m.content).join(' ');
  const { seeds, context } = index.retrieve(userTurns, typeof body.focusId === 'string' ? body.focusId : undefined);

  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  const send = (o: object) => res.write(JSON.stringify(o) + '\n');
  send({ type: 'sources', nodes: seeds.map((n) => ({ id: n.id, label: n.label, type: n.type })) });

  const messages = [
    { role: 'system', content: `${systemPrompt()}\n\n## Profile\n${index.profileBrief()}\n\n## Knowledge-graph context\n${context || '(no matching nodes)'}` },
    ...history,
  ];

  const abort = new AbortController();
  res.on('close', () => abort.abort());
  try {
    const upstream = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        think: Boolean(body.think),
        keep_alive: '30m',
        options: { temperature: 0.2, num_ctx: 8192 },
      }),
      signal: abort.signal,
    });
    if (!upstream.ok || !upstream.body) throw new Error(`Ollama ${upstream.status}: ${await upstream.text()}`);
    const decoder = new TextDecoder();
    let buf = '';
    for await (const chunk of upstream.body as any as AsyncIterable<Uint8Array>) {
      buf += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.error) throw new Error(msg.error);
        if (msg.message?.thinking) send({ type: 'thinking', text: msg.message.thinking });
        if (msg.message?.content) send({ type: 'token', text: msg.message.content });
        if (msg.done) send({ type: 'done', stats: { tokens: msg.eval_count, seconds: (msg.total_duration ?? 0) / 1e9 } });
      }
    }
  } catch (err: any) {
    if (!abort.signal.aborted) send({ type: 'error', message: String(err?.message ?? err) });
  }
  res.end();
}

async function handleHealth(res: ServerResponse) {
  let ollama: unknown = 'unreachable';
  try {
    const r = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const tags = (await r.json()) as { models: { name: string }[] };
    ollama = { ok: true, modelAvailable: tags.models.some((m) => m.name === MODEL) };
  } catch {}
  sendJson(res, 200, { ok: true, model: MODEL, graph: index.size, ollama });
}

// ---------- static files ----------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = normalize(join(DIST, urlPath));
  if (!file.startsWith(DIST)) return sendJson(res, 403, { error: 'forbidden' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  if (!existsSync(file)) return sendJson(res, 503, { error: 'UI not built — run `npm run build`' });
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

function sendJson(res: ServerResponse, status: number, obj: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

createServer(async (req, res) => {
  try {
    if (req.url === '/api/health') return await handleHealth(res);
    if (req.url === '/api/chat' && req.method === 'POST') return await handleChat(req, res);
    if (req.url?.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });
    serveStatic(req, res);
  } catch (err: any) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: String(err?.message ?? err) });
    else res.end();
  }
}).listen(PORT, HOST, () => console.log(`[server] http://${HOST}:${PORT}  model=${MODEL}  ollama=${OLLAMA}`));
