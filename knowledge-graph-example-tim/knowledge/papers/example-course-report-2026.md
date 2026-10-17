---
id: example-course-report-2026
title: "Chat with Your Research: A Local GraphRAG on the RUBIK Pi 3 (sample report)"
authors: [Alex Example]
year: 2026
venue: Course project report (example entry)
kind: own
url: https://github.com/RF-Wireless-FPGA-Design/Qualcomm-RubikPi3/tree/main/knowledge-graph-example-tim
topics: [Knowledge Graphs, Retrieval-Augmented Generation, Edge AI]
methods: [BM25, GraphRAG, Ollama]
datasets: []
builds_on: [rag-neurips2020, graphrag-2024]
---

# Chat with Your Research: A Local GraphRAG on the RUBIK Pi 3 (sample report)

> This is a **sample "own paper"** that shows how your own work appears in the graph.
> Because its author list contains the profile's `name`, it is drawn as your paper and linked to you.
> Replace it with your own report or delete it.

## Summary
Describes this repository: markdown notes about papers are compiled into a knowledge graph, and a small LLM running locally on a RUBIK Pi 3 answers questions using only facts retrieved from that graph.

## Key Contributions
- A markdown + YAML format for papers and profiles that is easy to write by hand and easy to parse.
- GraphRAG-lite retrieval: BM25 finds seed nodes, and their 1-hop relations become the LLM's context.
- Runs fully offline on an 8 GB ARM board with Ollama and a 2B-parameter model.

## Method
A TypeScript build script turns the markdown into `graph.json`. A Node.js server ranks nodes with BM25, collects each top node's properties and relations within a character budget, and streams an answer from Ollama.

## Results
(Fill in your own measurements, e.g. answer latency on the RUBIK Pi 3 or retrieval accuracy on a set of test questions.)
