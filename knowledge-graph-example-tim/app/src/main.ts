import ForceGraph from 'force-graph';
import { marked } from 'marked';
import { initChat } from './chat';
import type { KGEdge, KGNode, KnowledgeGraph, NodeType } from './types';
import './style.css';

type GNode = KGNode & { x?: number; y?: number; fx?: number; fy?: number; degree: number };
type GLink = { source: string | GNode; target: string | GNode; relation: string };

const TYPE_STYLE: Record<NodeType, { color: string; label: string; on: boolean }> = {
  Person: { color: '#e8590c', label: 'Person', on: true },
  Paper: { color: '#1c7ed6', label: 'Papers', on: true },
  Topic: { color: '#2f9e44', label: 'Topics', on: true },
  Method: { color: '#7048e8', label: 'Methods', on: true },
  Author: { color: '#adb5bd', label: 'Authors', on: true },
  Dataset: { color: '#15aabf', label: 'Datasets', on: false },
  Project: { color: '#d6336c', label: 'Projects', on: true },
  Award: { color: '#f59f00', label: 'Awards', on: true },
  Course: { color: '#c92a2a', label: 'Courses', on: true },
  Skill: { color: '#82c91e', label: 'Skills', on: true },
  Institution: { color: '#862e9c', label: 'Institutions', on: true },
  Collection: { color: '#0b7285', label: 'Collections', on: true },
};
const OWN_PAPER_COLOR = '#1864ab';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const data: KnowledgeGraph = await fetch(`${import.meta.env.BASE_URL}graph.json`).then((r) => r.json());

$('title').textContent = `${data.owner.short} · Knowledge Graph`;
document.title = `${data.owner.short} · Knowledge Graph`;

// ---------- indexes ----------

const byId = new Map<string, GNode>();
const adjacency = new Map<string, { edge: KGEdge; other: string; out: boolean }[]>();
for (const n of data.nodes) {
  byId.set(n.id, { ...n, degree: 0 });
  adjacency.set(n.id, []);
}
for (const e of data.edges) {
  byId.get(e.source)!.degree++;
  byId.get(e.target)!.degree++;
  adjacency.get(e.source)!.push({ edge: e, other: e.target, out: true });
  adjacency.get(e.target)!.push({ edge: e, other: e.source, out: false });
}
const nodes = [...byId.values()];
const links: GLink[] = data.edges.map((e) => ({ ...e }));
const linkId = (end: string | GNode) => (typeof end === 'string' ? end : end.id);

const isOwnPaper = (n: GNode) => n.type === 'Paper' && n.props?.kind === 'own';
const colorOf = (n: GNode) => (isOwnPaper(n) ? OWN_PAPER_COLOR : TYPE_STYLE[n.type].color);
const radiusOf = (n: GNode) =>
  n.type === 'Person' ? 14 : isOwnPaper(n) ? 8 : Math.min(11, 2.5 + Math.sqrt(n.degree) * 1.3);
/** Nodes whose label is worth drawing even when zoomed out. */
const prominent = (n: GNode) => n.type === 'Person' || isOwnPaper(n) || (n.type === 'Topic' && n.degree >= 7);

// ---------- state ----------

const state = {
  selected: null as GNode | null,
  hovered: null as GNode | null,
  hops: 0,
  labels: true,
  arrows: false,
  types: new Set((Object.keys(TYPE_STYLE) as NodeType[]).filter((t) => TYPE_STYLE[t].on)),
};
let highlight = new Set<string>();
/** Nodes retrieved for the latest chat answer. */
let chatSources = new Set<string>();
let neighbourhood: Set<string> | null = null;

function within(startId: string, hops: number): Set<string> {
  const seen = new Set([startId]);
  let frontier = [startId];
  for (let i = 0; i < hops; i++) {
    const next: string[] = [];
    for (const id of frontier)
      for (const { other } of adjacency.get(id)!) if (!seen.has(other)) (seen.add(other), next.push(other));
    frontier = next;
  }
  return seen;
}

const nodeVisible = (n: GNode) =>
  (state.types.has(n.type) || n === state.selected || chatSources.has(n.id)) &&
  (!neighbourhood || neighbourhood.has(n.id) || chatSources.has(n.id));

function refreshHighlight() {
  const focus = state.hovered ?? state.selected;
  highlight = focus ? within(focus.id, 1) : new Set(chatSources);
  neighbourhood = state.selected && state.hops > 0 ? within(state.selected.id, state.hops) : null;
  graph.nodeVisibility(graph.nodeVisibility()); // re-evaluate accessors
  graph.linkVisibility(graph.linkVisibility());
}

// ---------- graph ----------

const container = $('graph');
const graph = new ForceGraph<GNode, GLink>(container)
  .graphData({ nodes, links })
  .backgroundColor(css('--bg'))
  .nodeId('id')
  .nodeLabel((n) => `<b>${escapeHtml(n.label)}</b><br/><small>${n.type}${n.summary ? ' · ' + escapeHtml(n.summary.slice(0, 140)) : ''}</small>`)
  .nodeVisibility(nodeVisible)
  .linkVisibility((l) => {
    const s = byId.get(linkId(l.source))!;
    const t = byId.get(linkId(l.target))!;
    return nodeVisible(s) && nodeVisible(t);
  })
  .linkColor((l) => {
    const focus = state.hovered ?? state.selected;
    if (!focus) return css('--link');
    return linkId(l.source) === focus.id || linkId(l.target) === focus.id ? css('--link-hi') : css('--link');
  })
  .linkWidth((l) => {
    const focus = state.hovered ?? state.selected;
    return focus && (linkId(l.source) === focus.id || linkId(l.target) === focus.id) ? 1.6 : 0.6;
  })
  .linkDirectionalArrowLength(() => (state.arrows ? 3.5 : 0))
  .linkDirectionalArrowRelPos(1)
  .linkLabel((l) => l.relation.replace(/_/g, ' ').toLowerCase())
  .nodeCanvasObject((n, ctx, scale) => {
    const r = radiusOf(n);
    const dim = highlight.size > 0 && !highlight.has(n.id);
    ctx.globalAlpha = dim ? 0.18 : 1;
    ctx.beginPath();
    ctx.arc(n.x!, n.y!, r, 0, 2 * Math.PI);
    ctx.fillStyle = colorOf(n);
    ctx.fill();
    if (n === state.selected || chatSources.has(n.id) || isOwnPaper(n) || n.type === 'Person') {
      ctx.lineWidth = n === state.selected || chatSources.has(n.id) ? 3 / scale : 1.5 / scale;
      ctx.strokeStyle = n === state.selected || chatSources.has(n.id) ? css('--accent') : css('--bg');
      ctx.stroke();
    }
    const showLabel =
      state.labels && !dim && (highlight.has(n.id) || (prominent(n) && scale > 0.7) || scale > 2.4);
    if (showLabel) {
      const size = Math.max(10 / scale, n.type === 'Person' ? 4.5 : 3);
      ctx.font = `${n.type === 'Person' || isOwnPaper(n) ? 600 : 400} ${size}px system-ui, sans-serif`;
      const text = n.label.length > 48 ? n.label.slice(0, 46) + '…' : n.label;
      const w = ctx.measureText(text).width;
      const y = n.y! + r + size * 0.9;
      ctx.fillStyle = css('--label-bg');
      ctx.fillRect(n.x! - w / 2 - 1, y - size * 0.75, w + 2, size * 1.05);
      ctx.fillStyle = css('--label');
      ctx.textAlign = 'center';
      ctx.fillText(text, n.x!, y);
    }
    ctx.globalAlpha = 1;
  })
  .nodePointerAreaPaint((n, color, ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(n.x!, n.y!, radiusOf(n) + 2, 0, 2 * Math.PI);
    ctx.fill();
  })
  .onNodeHover((n) => {
    state.hovered = n;
    container.style.cursor = n ? 'pointer' : 'default';
    refreshHighlight();
  })
  .onNodeClick((n) => select(n))
  .onNodeDragEnd((n) => ((n.fx = n.x), (n.fy = n.y)))
  .onBackgroundClick(() => select(null))
  .cooldownTicks(300);

graph.d3Force('charge')?.strength(-60);
(graph.d3Force('link') as any)?.distance((l: GLink) => (l.relation === 'AUTHORED' ? 18 : 34));

let fitted = false;
graph.onEngineStop(() => {
  if (!fitted) (graph.zoomToFit(600, 40), (fitted = true));
});

new ResizeObserver(() => graph.width(container.clientWidth).height(container.clientHeight)).observe(container);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => graph.backgroundColor(css('--bg')));

// ---------- selection & details ----------

function select(n: GNode | null, center = false) {
  state.selected = n;
  history.replaceState(null, '', n ? `#${encodeURIComponent(n.id)}` : location.pathname);
  refreshHighlight();
  renderDetails();
  chat.refreshFocus();
  if (n && center) {
    graph.centerAt(n.x, n.y, 600);
    graph.zoom(Math.max(graph.zoom(), 2.2), 600);
  }
}

function renderProps(n: GNode): string {
  const rows = Object.entries(n.props ?? {})
    .filter(([, v]) => !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => {
      const value = Array.isArray(v) ? v.join(', ') : String(v);
      const html = /^https?:\/\//.test(value)
        ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener">${escapeHtml(value)}</a>`
        : escapeHtml(value);
      return `<dt>${escapeHtml(k)}</dt><dd>${html}</dd>`;
    });
  return rows.length ? `<dl>${rows.join('')}</dl>` : '';
}

function renderNeighbours(n: GNode): string {
  const groups = new Map<string, { other: GNode; out: boolean }[]>();
  for (const { edge, other, out } of adjacency.get(n.id)!) {
    const key = `${out ? '→' : '←'} ${edge.relation.replace(/_/g, ' ').toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ other: byId.get(other)!, out });
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(
      ([rel, items]) => `<h3>${escapeHtml(rel)} (${items.length})</h3><ul class="neighbours">${items
        .sort((a, b) => b.other.degree - a.other.degree)
        .map(
          ({ other }) =>
            `<li data-id="${escapeHtml(other.id)}"><span class="dot-inline" style="color:${colorOf(other)}">●</span>${escapeHtml(other.label)}<span class="rel">${other.type}</span></li>`,
        )
        .join('')}</ul>`,
    )
    .join('');
}

function renderDetails() {
  const panel = $('details');
  const n = state.selected;
  panel.hidden = !n;
  if (!n) return;
  const kind = isOwnPaper(n) ? `Paper · ${data.owner.short}` : n.type;
  $('details-content').innerHTML = `
    <span class="badge" style="background:${colorOf(n)}">${kind}</span>
    <h2>${escapeHtml(n.label)}</h2>
    ${n.summary && !n.body ? `<p class="muted">${escapeHtml(n.summary)}</p>` : ''}
    ${renderProps(n)}
    ${n.body ? `<div class="md">${marked.parse(n.body, { async: false })}</div>` : ''}
    ${renderNeighbours(n)}`;
  panel.scrollTop = 0;
}

$('details-content').addEventListener('click', (ev) => {
  const li = (ev.target as HTMLElement).closest<HTMLElement>('li[data-id]');
  if (li) select(byId.get(li.dataset.id!)!, true);
});
$('close-details').addEventListener('click', () => select(null));
addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') select(null);
});

// ---------- sidebar ----------

const typeCounts = nodes.reduce((m, n) => m.set(n.type, (m.get(n.type) ?? 0) + 1), new Map<NodeType, number>());
$('stats').textContent = `${nodes.length} nodes · ${links.length} relations · ${typeCounts.get('Paper')} papers`;

const legend = $('legend');
for (const type of Object.keys(TYPE_STYLE) as NodeType[]) {
  if (!typeCounts.get(type)) continue;
  const li = document.createElement('li');
  li.className = state.types.has(type) ? '' : 'off';
  li.innerHTML = `<span class="dot" style="background:${TYPE_STYLE[type].color}"></span>${TYPE_STYLE[type].label}<span class="count">${typeCounts.get(type)}</span>`;
  li.title = 'Click to toggle';
  li.addEventListener('click', () => {
    state.types.has(type) ? state.types.delete(type) : state.types.add(type);
    li.classList.toggle('off');
    refreshHighlight();
  });
  legend.append(li);
}

$<HTMLSelectElement>('hops').addEventListener('change', (ev) => {
  state.hops = Number((ev.target as HTMLSelectElement).value);
  refreshHighlight();
  graph.zoomToFit(600, 60, nodeVisible);
});
$<HTMLInputElement>('labels').addEventListener('change', (ev) => (state.labels = (ev.target as HTMLInputElement).checked));
$<HTMLInputElement>('arrows').addEventListener('change', (ev) => {
  state.arrows = (ev.target as HTMLInputElement).checked;
  graph.linkDirectionalArrowLength(graph.linkDirectionalArrowLength());
});
$('focus-owner').textContent = `Focus on ${data.owner.short}`;
$('focus-owner').addEventListener('click', () => select(byId.get(data.owner.id)!, true));
$('fit').addEventListener('click', () => graph.zoomToFit(600, 40, nodeVisible));

// Search: substring match on label, then summary; Enter picks the first hit.
const search = $<HTMLInputElement>('search');
const results = $<HTMLUListElement>('results');
let hits: GNode[] = [];
search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  hits = !q
    ? []
    : nodes
        .map((n) => ({ n, score: n.label.toLowerCase().includes(q) ? 2 : n.summary?.toLowerCase().includes(q) ? 1 : 0 }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score || b.n.degree - a.n.degree)
        .slice(0, 14)
        .map((h) => h.n);
  results.hidden = hits.length === 0;
  results.innerHTML = hits
    .map((n, i) => `<li data-i="${i}"><span style="color:${colorOf(n)}">●</span>${escapeHtml(n.label)}<span class="type">${n.type}</span></li>`)
    .join('');
});
const pick = (n: GNode | undefined) => {
  if (!n) return;
  state.types.add(n.type);
  legend.querySelectorAll('li').forEach((li) => li.textContent?.startsWith(TYPE_STYLE[n.type].label) && li.classList.remove('off'));
  results.hidden = true;
  search.value = '';
  select(n, true);
};
results.addEventListener('mousedown', (ev) => {
  const li = (ev.target as HTMLElement).closest<HTMLElement>('li[data-i]');
  if (li) pick(hits[Number(li.dataset.i)]);
});
search.addEventListener('keydown', (ev) => ev.key === 'Enter' && pick(hits[0]));
search.addEventListener('blur', () => setTimeout(() => (results.hidden = true), 150));

// ---------- chat ----------

const chat = initChat({
  ownerName: data.owner.short,
  suggestions: data.owner.suggestions,
  focusId: () => state.selected?.id,
  colorOf: (id) => (byId.has(id) ? colorOf(byId.get(id)!) : '#888'),
  onSelect: (id) => byId.has(id) && select(byId.get(id)!, true),
  onSources: (sources) => {
    chatSources = new Set(sources.map((s) => s.id).filter((id) => byId.has(id)));
    refreshHighlight();
    if (chatSources.size && !state.selected) graph.zoomToFit(800, 80, (n) => chatSources.has(n.id));
  },
});

// Restore selection from the URL hash (shareable links like #paper:muninn-vtc2026).
const initial = byId.get(decodeURIComponent(location.hash.slice(1)));
if (initial) setTimeout(() => select(initial, true), 1200);
