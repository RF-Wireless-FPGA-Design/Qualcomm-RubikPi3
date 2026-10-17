---
id: graphrag-2024
title: "From Local to Global: A Graph RAG Approach to Query-Focused Summarization"
authors: [Darren Edge, Ha Trinh, Newman Cheng, Joshua Bradley, Alex Chao, Apurva Mody, Steven Truitt, Jonathan Larson]
year: 2024
venue: arXiv 2404.16130
kind: reference
cluster: Language Models
url: https://arxiv.org/abs/2404.16130
topics: [Retrieval-Augmented Generation, Knowledge Graphs, Query-Focused Summarization]
methods: [GraphRAG, Community Detection, Map-Reduce Summarization]
datasets: [Podcast transcripts, News articles]
builds_on: [rag-neurips2020]
---

# From Local to Global: A Graph RAG Approach to Query-Focused Summarization

## Summary
Builds an entity knowledge graph from a document collection with an LLM, then answers global questions ("what are the main themes?") by summarising graph communities. Plain vector RAG answers such questions poorly.

## Key Contributions
- **Graph-based index.** An LLM extracts entities and relations from text chunks to form a knowledge graph.
- **Community summaries.** Leiden community detection splits the graph into a hierarchy, and each community gets a pre-generated summary.
- **Global sensemaking queries.** Map-reduce over community summaries answers corpus-wide questions.

## Method
Documents are split into chunks. An LLM extracts entities, relations and claims from each chunk, and these are merged into a graph. The Leiden algorithm finds nested communities, and the LLM summarises each one. At query time, each community summary produces a partial answer (map), and the partial answers are combined into a final answer (reduce).

## Results
On million-token corpora, GraphRAG beat a naive vector-RAG baseline on the comprehensiveness and diversity of answers to global questions, as judged by an LLM evaluator.
