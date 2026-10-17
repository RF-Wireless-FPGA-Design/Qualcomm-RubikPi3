/**
 * Graph retrieval for chat: BM25 over node text finds seed nodes, then the
 * graph supplies their 1-hop facts, which become the LLM context (GraphRAG-lite).
 */
import type { KGEdge, KGNode, KnowledgeGraph, Owner } from '../src/types.ts';

const STOP = new Set(
  'a an and are as at be by can do does for from has have he her his how i in is it its me my of on or our she that the their them they this to was what when where which who why with you your about tell list show give papers paper work works'.split(' '),
);

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t))
    // light stemming so "awards" matches "award" and "courses" matches "course"
    .map((t) => (t.length > 4 && t.endsWith('ies') ? t.slice(0, -3) + 'y' : t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));

export interface Retrieval {
  seeds: KGNode[];
  context: string;
}

export class GraphIndex {
  private byId = new Map<string, KGNode>();
  private adj = new Map<string, KGEdge[]>();
  private docs: { node: KGNode; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 1;
  readonly owner: Owner;

  constructor(graph: KnowledgeGraph) {
    this.owner = graph.owner;
    for (const n of graph.nodes) (this.byId.set(n.id, n), this.adj.set(n.id, []));
    for (const e of graph.edges) (this.adj.get(e.source)!.push(e), this.adj.get(e.target)!.push(e));
    for (const n of graph.nodes) {
      // Label tokens count three times so a node named after the query term outranks passing mentions.
      // Type and incident-relation words let questions like "which awards…" or "who teaches…" match by role.
      const relWords = [...new Set(this.adj.get(n.id)!.map((e) => e.relation.replace(/_/g, ' ')))].join(' ');
      const tokens = [
        ...tokenize(n.label), ...tokenize(n.label), ...tokenize(n.label),
        ...tokenize(n.type), ...tokenize(n.type),
        ...tokenize(n.summary ?? ''), ...tokenize(n.body ?? ''), ...tokenize(relWords),
      ];
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push({ node: n, tf, len: tokens.length });
    }
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / this.docs.length;
  }

  get size() {
    return { nodes: this.byId.size, docs: this.docs.length };
  }

  private bm25(query: string): { node: KGNode; score: number }[] {
    const q = [...new Set(tokenize(query))];
    const N = this.docs.length;
    const k1 = 1.2, b = 0.75;
    return this.docs
      .map(({ node, tf, len }) => {
        let score = 0;
        for (const t of q) {
          const f = tf.get(t);
          if (!f) continue;
          const idf = Math.log(1 + (N - this.df.get(t)! + 0.5) / (this.df.get(t)! + 0.5));
          score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * len) / this.avgLen));
        }
        // Collections ("Alex's Publications") match almost any question about the owner but add little context.
        return { node, score: node.type === 'Collection' ? score * 0.3 : score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private fact(e: KGEdge) {
    return `${this.byId.get(e.source)!.label} —${e.relation.toLowerCase().replace(/_/g, ' ')}→ ${this.byId.get(e.target)!.label}`;
  }

  /** `focusId` lets the UI pin the node currently selected in the graph into the context. */
  retrieve(query: string, focusId?: string, maxSeeds = 8, budget = 7000): Retrieval {
    const ranked = this.bm25(query);
    const seeds: KGNode[] = [];
    const focus = focusId ? this.byId.get(focusId) : undefined;
    if (focus) seeds.push(focus);
    for (const { node } of ranked) {
      if (seeds.length >= maxSeeds) break;
      if (!seeds.includes(node)) seeds.push(node);
    }

    const blocks: string[] = [];
    let used = 0;
    for (const n of seeds) {
      const facts = this.adj
        .get(n.id)!
        // Paper/topic/project relations carry the meaning; author/method lists are kept but ranked last.
        .sort((a, b) => Number(a.relation === 'AUTHORED') - Number(b.relation === 'AUTHORED'))
        .slice(0, 30)
        .map((e) => `- ${this.fact(e)}`);
      const props = Object.entries(n.props ?? {})
        .filter(([k]) => !['markdown', 'pdf'].includes(k))
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('; ');
      const body = (n.body ?? '').replace(/^# .*$/m, '').replace(/\n{2,}/g, '\n').trim().slice(0, 1400);
      let block = `### [${n.type}] ${n.label} (id: ${n.id})\n${props ? props + '\n' : ''}${n.summary && !body ? n.summary + '\n' : ''}${body ? body + '\n' : ''}Relations:\n${facts.join('\n')}`;
      const remaining = budget - used;
      if (remaining < 300) break;
      if (block.length > remaining) block = block.slice(0, remaining);
      blocks.push(block);
      used += block.length;
    }
    return { seeds: seeds.slice(0, blocks.length), context: blocks.join('\n\n') };
  }

  /** Always-included summary of the owner, so "who is …" questions work even when retrieval misses. */
  profileBrief(): string {
    const me = this.byId.get(this.owner.id);
    if (!me) return '';
    const out = this.adj.get(me.id)!.filter((e) => e.source === me.id);
    const to = (pred: (e: KGEdge, target: KGNode) => boolean) =>
      out.filter((e) => pred(e, this.byId.get(e.target)!)).map((e) => this.byId.get(e.target)!.label);
    const line = (name: string, items: string[]) => (items.length ? `${name}: ${items.join('; ')}.` : '');
    return [
      `${me.label}${me.summary ? `: ${me.summary}` : ''}.`,
      line('Affiliations', to((_, t) => t.type === 'Institution')),
      line('Interests', to((e) => e.relation === 'INTERESTED_IN')),
      line('Learning', to((e) => e.relation === 'LEARNING')),
      line('Skills', to((e) => e.relation === 'HAS_SKILL')),
      line('Courses', to((_, t) => t.type === 'Course')),
      line('Own papers', to((e) => e.relation === 'AUTHORED')),
    ]
      .filter(Boolean)
      .join('\n');
  }
}
