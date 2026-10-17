/**
 * Drafts a knowledge/papers/<id>.md file from a PDF with the local Ollama model.
 *
 *   npm run draft:paper -- path/to/paper.pdf [--id my-paper-id] [--model qwen3.5:2b] [--kind own|reference]
 *
 * Reads the first 3 and the last page with `pdftotext` (sudo apt install poppler-utils), asks the
 * model for structured JSON, and writes the markdown in the format build-graph.ts expects.
 * A small model makes mistakes: always check the title, authors, year and numbers against the PDF.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE = resolve(process.env.KNOWLEDGE_DIR ?? resolve(here, '../../knowledge'));
const OLLAMA = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const model = flag('model') ?? process.env.OLLAMA_MODEL ?? 'qwen3.5:2b';
const kind = flag('kind') ?? 'reference';
const wantedId = flag('id');
const pdf = args[0];
if (!pdf || !existsSync(pdf)) {
  console.error('usage: npm run draft:paper -- <file.pdf> [--id id] [--model name] [--kind own|reference]');
  process.exit(1);
}

const slug = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');

function pdfText(): string {
  const run = (...a: string[]) => execFileSync('pdftotext', [...a, pdf, '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  let pages = 0;
  try {
    pages = Number(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }).match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  } catch (err: any) {
    if (err.code === 'ENOENT') throw new Error('pdftotext/pdfinfo not found — install them with: sudo apt install poppler-utils');
    throw err;
  }
  const head = run('-f', '1', '-l', String(Math.min(3, pages || 3)));
  const tail = pages > 3 ? run('-f', String(pages), '-l', String(pages)) : '';
  // About 3k tokens: enough for the abstract, introduction and conclusion, and small enough for the CPU.
  return (head.slice(0, 10_000) + '\n…\n' + tail.slice(0, 2_500)).replace(/[ \t]+/g, ' ');
}

// Reusing existing topic names is what links a new paper into the graph. A 2B model copies any list it is
// shown, so the list stays out of the prompt and topics are matched to it here instead.
const knownTopics = new Map<string, string>();
const addKnown = (t: unknown) => typeof t === 'string' && knownTopics.set(slug(t), t);
Object.entries<string>(parseYaml(readFileSync(join(KNOWLEDGE, 'taxonomy.md'), 'utf8').split(/^---$/m)[1] ?? '')?.topics ?? {})
  .flat()
  .forEach(addKnown);
for (const f of readdirSync(join(KNOWLEDGE, 'papers')).filter((f) => f.endsWith('.md'))) {
  const fm = readFileSync(join(KNOWLEDGE, 'papers', f), 'utf8').split(/^---$/m)[1];
  try {
    (parseYaml(fm ?? '')?.topics ?? []).forEach(addKnown);
  } catch {}
}

const schema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    authors: { type: 'array', items: { type: 'string' } },
    year: { type: 'integer' },
    venue: { type: 'string' },
    topics: { type: 'array', items: { type: 'string' } },
    methods: { type: 'array', items: { type: 'string' } },
    datasets: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    contributions: { type: 'array', items: { type: 'string' } },
    method: { type: 'string' },
    results: { type: 'string' },
  },
  required: ['title', 'authors', 'year', 'venue', 'topics', 'methods', 'datasets', 'summary', 'contributions', 'method', 'results'],
};

const prompt = `Extract structured information from this research paper text.
- title, authors (full names as printed), year, venue: copy them from the paper.
- topics: 2-5 short names of research areas the paper is about (e.g. "Federated Learning", "Open RAN").
- methods: named algorithms, models or techniques. datasets: named datasets (empty list if none).
- summary: 1-2 sentences. contributions: 2-4 items. method: one paragraph. results: 1-3 sentences with the main numbers.
Use only information in the text.

PAPER TEXT:
${pdfText()}`;

console.log(`Asking ${model} to read ${basename(pdf)} (on the RUBIK Pi CPU this takes a few minutes)…`);
const res = await fetch(`${OLLAMA}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    think: false,
    format: schema,
    options: { temperature: 0, num_ctx: 8192 },
  }),
});
if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
const p = JSON.parse(((await res.json()) as any).message.content);

const topics: string[] = [...new Set((p.topics ?? []).slice(0, 5).map((t: string) => knownTopics.get(slug(t)) ?? t))] as string[];
const newTopics = topics.filter((t) => !knownTopics.has(slug(t)));

const surname = String(p.authors?.[0] ?? 'paper').split(/\s+/).pop()!;
const id = wantedId ?? slug(`${surname}-${String(p.title).split(/\s+/).slice(0, 2).join(' ')}-${p.year}`);
const out = join(KNOWLEDGE, 'papers', `${id}.md`);
if (existsSync(out)) throw new Error(`${out} already exists — pass --id to choose another name`);

const meta = {
  id,
  title: p.title,
  authors: p.authors,
  year: p.year,
  venue: p.venue,
  kind,
  pdf,
  topics,
  methods: p.methods,
  datasets: p.datasets,
  builds_on: [],
};
// One `key: value` line per field; JSON strings are valid YAML and keep titles with ':' safe.
const frontmatter = (o: Record<string, unknown>) =>
  Object.entries(o)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map((x) => JSON.stringify(String(x))).join(', ')}]` : typeof v === 'number' ? v : JSON.stringify(String(v ?? ''))}`)
    .join('\n');

const md = `---
# DRAFT written by ${model} from ${basename(pdf)}. Check every field against the PDF, then delete this line.
${frontmatter(meta)}
---

# ${p.title}

## Summary
${p.summary}

## Key Contributions
${(p.contributions ?? []).map((c: string) => `- ${c}`).join('\n')}

## Method
${p.method}

## Results
${p.results}
`;
writeFileSync(out, md);
console.log(`Wrote ${out}`);
console.log(`Topics already in the graph: ${topics.filter((t) => !newTopics.includes(t)).join(', ') || '(none)'}`);
if (newTopics.length)
  console.log(`New topics: ${newTopics.join(', ')}\n  → rename them to existing topics if they mean the same thing, or add them to taxonomy.md`);
console.log('Review the file, add builds_on links, then run: npm run build:graph');
