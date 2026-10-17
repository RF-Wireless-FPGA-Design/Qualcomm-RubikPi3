export type NodeType =
  | 'Person'
  | 'Paper'
  | 'Author'
  | 'Topic'
  | 'Method'
  | 'Dataset'
  | 'Project'
  | 'Award'
  | 'Course'
  | 'Skill'
  | 'Institution'
  | 'Collection';

export interface KGNode {
  id: string;
  type: NodeType;
  label: string;
  /** Short one-line description shown in tooltips and search. */
  summary?: string;
  /** Markdown body (paper summaries, profile text) rendered in the detail panel. */
  body?: string;
  /** Free-form attributes (year, venue, url, pdf, ...). */
  props?: Record<string, string | number | boolean | string[]>;
  /** Plain-text description of the node and its neighbourhood, ready to feed an embedding model. */
  text?: string;
}

export interface KGEdge {
  source: string;
  target: string;
  relation: string;
}

/** The person the graph is about, taken from knowledge/profile.md. */
export interface Owner {
  id: string;
  name: string;
  short: string;
  headline?: string;
  /** Example questions shown in the chat panel. */
  suggestions: string[];
}

export interface KnowledgeGraph {
  generatedAt: string;
  owner: Owner;
  nodes: KGNode[];
  edges: KGEdge[];
}
