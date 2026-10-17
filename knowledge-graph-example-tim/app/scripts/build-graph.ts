/**
 * Builds the knowledge graph from the markdown files in ../knowledge
 * (or the folder named by the KNOWLEDGE_DIR environment variable).
 *
 *   knowledge/profile.md      structured profile of the graph's owner (frontmatter)
 *   knowledge/taxonomy.md     topic hierarchy (frontmatter)
 *   knowledge/papers/*.md     one file per paper (frontmatter + markdown body)
 *
 * Outputs:
 *   public/graph.json             graph consumed by the web UI
 *   ../knowledge/export/nodes.jsonl    one node per line with a `text` field for embedding
 *   ../knowledge/export/triples.jsonl  (subject, relation, object) triples with a sentence form
 *   ../knowledge/papers/INDEX.md       generated table of all papers
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import type { KGEdge, KGNode, KnowledgeGraph, NodeType } from '../src/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE = resolve(process.env.KNOWLEDGE_DIR ?? resolve(here, '../../knowledge'));
const PUBLIC = resolve(here, '../public');
const EXPORT = join(KNOWLEDGE, 'export');

// ---------- markdown helpers ----------

function readMarkdown(path: string): { meta: any; body: string } {
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  return { meta: parseYaml(m[1]) ?? {}, body: m[2].trim() };
}

/** Text of a "## Heading" section, or '' when absent. */
function section(body: string, heading: string): string {
  const re = new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm');
  return body.match(re)?.[1].trim() ?? '';
}

const slug = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');

// ---------- graph accumulation ----------

const nodes = new Map<string, KGNode>();
const edges: KGEdge[] = [];
const edgeKeys = new Set<string>();

function addNode(id: string, type: NodeType, label: string, extra: Partial<KGNode> = {}): string {
  const existing = nodes.get(id);
  if (existing) Object.assign(existing, Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)));
  else nodes.set(id, { id, type, label, ...extra });
  return id;
}

function addEdge(source: string, relation: string, target: string) {
  const key = `${source}|${relation}|${target}`;
  if (source === target || edgeKeys.has(key)) return;
  edgeKeys.add(key);
  edges.push({ source, target, relation });
}

const topic = (name: string) => addNode(`topic:${slug(name)}`, 'Topic', name);
const method = (name: string) => addNode(`method:${slug(name)}`, 'Method', name);
const skill = (name: string) => addNode(`skill:${slug(name)}`, 'Skill', name);
const dataset = (name: string) => addNode(`dataset:${slug(name)}`, 'Dataset', name);

// ---------- profile ----------

const profile = readMarkdown(join(KNOWLEDGE, 'profile.md'));
const p = profile.meta;
for (const key of ['id', 'name']) if (!p[key]) throw new Error(`profile.md: missing frontmatter field "${key}"`);
p.short ??= String(p.name).split(' ')[0];

// The owner's node id, and every spelling of their name that may appear in a paper's author list.
const OWNER = `person:${slug(String(p.id))}`;
const OWNER_NAMES = new Set([p.name, ...(p.aliases ?? [])].map((n: string) => n.toLowerCase()));
const OWN_COLLECTION: string = p.own_collection ?? `${p.short}'s Publications`;

// Authors are keyed by the slug of their name as written, so keep spellings consistent across papers.
function author(name: string): string {
  if (OWNER_NAMES.has(name.toLowerCase())) return OWNER;
  return addNode(`author:${slug(name)}`, 'Author', name);
}

addNode(OWNER, 'Person', p.short === p.name ? p.name : `${p.name} (${p.short})`, {
  summary: p.headline,
  body: profile.body,
  props: { github: p.github, website: p.website, motto: p.motto, personal: p.personal ?? [] },
});

for (const inst of p.institutions ?? []) {
  addNode(`inst:${inst.id}`, 'Institution', inst.name, { summary: inst.detail });
  addEdge(OWNER, inst.relation, `inst:${inst.id}`);
  if (inst.part_of) addEdge(`inst:${inst.id}`, 'PART_OF', `inst:${inst.part_of}`);
}
for (const t of p.interests ?? []) addEdge(OWNER, 'INTERESTED_IN', topic(t));
for (const t of p.learning ?? []) addEdge(OWNER, 'LEARNING', topic(t));
for (const s of p.skills ?? []) {
  addNode(skill(s.name), 'Skill', s.name, { props: { category: s.category } });
  addEdge(OWNER, 'HAS_SKILL', skill(s.name));
}

for (const pr of p.projects ?? []) {
  const id = addNode(`project:${pr.id}`, 'Project', pr.name, { summary: pr.desc, props: pr.url ? { url: pr.url } : {} });
  addEdge(OWNER, 'BUILT', id);
  for (const t of pr.topics ?? []) addEdge(id, 'ABOUT', topic(t));
  for (const s of pr.skills ?? []) addEdge(id, 'USES_SKILL', skill(s));
  for (const paper of pr.papers ?? []) addEdge(id, 'RELATED_TO_PAPER', `paper:${paper}`);
}

for (const a of p.awards ?? []) {
  const id = addNode(`award:${a.id}`, 'Award', a.name, { props: { date: String(a.date) } });
  addEdge(OWNER, 'RECEIVED', id);
  if (a.project) addEdge(id, 'AWARDED_FOR', `project:${a.project}`);
  for (const t of a.topics ?? []) addEdge(id, 'ABOUT', topic(t));
}

for (const c of p.courses ?? []) {
  const id = addNode(`course:${c.id}`, 'Course', c.name, {
    summary: [c.semester, c.instructor && `instructor ${c.instructor}`].filter(Boolean).join(' · '),
    props: { semester: c.semester, url: c.url },
  });
  addEdge(OWNER, c.relation ?? 'TEACHING_ASSISTANT_FOR', id);
  if (c.instructor) addEdge(author(c.instructor), 'TEACHES', id);
  if (c.institution) addEdge(id, 'OFFERED_BY', `inst:${c.institution}`);
  for (const t of c.topics ?? []) addEdge(id, 'COVERS', topic(t));
  for (const s of c.skills ?? []) addEdge(id, 'USES_SKILL', skill(s));
  for (const pr of c.projects ?? []) addEdge(id, 'USES_MATERIAL', `project:${pr}`);
}

// ---------- taxonomy ----------

const taxonomy = readMarkdown(join(KNOWLEDGE, 'taxonomy.md')).meta.topics ?? {};
for (const [child, parent] of Object.entries<string>(taxonomy)) addEdge(topic(child), 'SUBTOPIC_OF', topic(parent));

// ---------- papers ----------

interface PaperRow { id: string; title: string; year: number; venue: string; kind: string; cluster: string; file: string }
const paperRows: PaperRow[] = [];

function addPaper(meta: any, body: string, file?: string) {
  const id = `paper:${meta.id}`;
  const own = meta.kind === 'own' || (meta.authors ?? []).some((a: string) => OWNER_NAMES.has(a.toLowerCase()));
  addNode(id, 'Paper', meta.title, {
    summary: section(body, 'Summary') || `${meta.venue} (${meta.year})`,
    body: body || undefined,
    props: {
      year: meta.year,
      venue: meta.venue,
      kind: own ? 'own' : 'reference',
      authors: meta.authors ?? [],
      ...(meta.url ? { url: meta.url } : {}),
      ...(meta.pdf ? { pdf: meta.pdf } : {}),
      ...(file ? { markdown: `knowledge/papers/${file}` } : {}),
    },
  });
  (meta.authors ?? []).forEach((a: string) => addEdge(author(a), 'AUTHORED', id));
  for (const t of meta.topics ?? []) addEdge(id, 'ADDRESSES', topic(t));
  for (const m of meta.methods ?? []) addEdge(id, 'USES_METHOD', method(m));
  for (const d of meta.datasets ?? []) addEdge(id, 'EVALUATED_ON', dataset(d));
  for (const b of meta.builds_on ?? []) addEdge(id, 'BUILDS_ON', `paper:${b}`);
  const cluster = meta.cluster ?? (own ? OWN_COLLECTION : 'References');
  addEdge(id, 'IN_COLLECTION', addNode(`collection:${slug(cluster)}`, 'Collection', cluster));
  if (!own) addEdge(OWNER, 'STUDIED_PAPER', id);
  paperRows.push({ id: meta.id, title: meta.title, year: meta.year, venue: meta.venue, kind: own ? 'own' : 'reference', cluster, file: file ?? '' });
}

const paperDir = join(KNOWLEDGE, 'papers');
for (const f of readdirSync(paperDir).filter((f) => f.endsWith('.md') && f !== 'INDEX.md').sort()) {
  const { meta, body } = readMarkdown(join(paperDir, f));
  if (!meta.id) throw new Error(`${f}: missing frontmatter id`);
  addPaper(meta, body, f);
}
for (const ep of p.extra_publications ?? []) addPaper({ ...ep, kind: 'own', cluster: ep.cluster ?? OWN_COLLECTION }, '');

for (const n of nodes.values()) if (n.type === 'Collection') addEdge(OWNER, 'CURATES', n.id);

// ---------- validation ----------

// A dangling edge almost always means a typo in an id reference (builds_on, papers, project, institution, part_of).
const dangling = edges.filter((e) => !nodes.has(e.source) || !nodes.has(e.target));
if (dangling.length)
  throw new Error(
    `These relations point to ids that do not exist — check the spelling in your markdown:\n${dangling
      .map((e) => `  ${e.source} ${e.relation} ${e.target}  (missing: ${[e.source, e.target].filter((x) => !nodes.has(x)).join(', ')})`)
      .join('\n')}`,
  );

// ---------- embedding text ----------

const label = (id: string) => nodes.get(id)!.label;
const sentence = (e: KGEdge) => `${label(e.source)} ${e.relation.toLowerCase().replace(/_/g, ' ')} ${label(e.target)}.`;

for (const n of nodes.values()) {
  const facts = edges.filter((e) => e.source === n.id || e.target === n.id).map(sentence);
  const props = Object.entries(n.props ?? {})
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('; ');
  const body = (n.body ?? '').replace(/[#*`>|]/g, '').replace(/\s+/g, ' ').trim();
  n.text = [`[${n.type}] ${n.label}.`, n.summary, props, body, facts.join(' ')].filter(Boolean).join('\n');
}

// ---------- write outputs ----------

const graph: KnowledgeGraph = {
  generatedAt: new Date().toISOString(),
  owner: {
    id: OWNER,
    name: p.name,
    short: p.short,
    headline: p.headline,
    suggestions: p.chat_suggestions ?? [`Summarise ${p.short}'s research interests`, `Which papers has ${p.short} studied?`, `What skills does ${p.short} have?`],
  },
  nodes: [...nodes.values()],
  edges,
};
mkdirSync(PUBLIC, { recursive: true });
writeFileSync(join(PUBLIC, 'graph.json'), JSON.stringify(graph));

mkdirSync(EXPORT, { recursive: true });
writeFileSync(
  join(EXPORT, 'nodes.jsonl'),
  graph.nodes.map((n) => JSON.stringify({ id: n.id, type: n.type, label: n.label, text: n.text })).join('\n') + '\n',
);
writeFileSync(
  join(EXPORT, 'triples.jsonl'),
  edges.map((e) => JSON.stringify({ subject: e.source, relation: e.relation, object: e.target, text: sentence(e) })).join('\n') + '\n',
);

const rows = paperRows.sort((a, b) => (a.kind === b.kind ? b.year - a.year : a.kind === 'own' ? -1 : 1));
writeFileSync(
  join(paperDir, 'INDEX.md'),
  [
    '# Paper index',
    '',
    '_Generated by `app/scripts/build-graph.ts` — edit the individual paper files, not this table._',
    '',
    '| Year | Title | Venue | Kind | Collection |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.year} | ${r.file ? `[${r.title}](${r.file})` : r.title} | ${r.venue} | ${r.kind} | ${r.cluster} |`),
    '',
  ].join('\n'),
);

const counts = graph.nodes.reduce<Record<string, number>>((acc, n) => ((acc[n.type] = (acc[n.type] ?? 0) + 1), acc), {});
console.log(`Graph: ${graph.nodes.length} nodes, ${edges.length} edges`, counts);
