---
id: rag-neurips2020
title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"
authors: [Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis, Wen-tau Yih, Tim Rocktäschel, Sebastian Riedel, Douwe Kiela]
year: 2020
venue: NeurIPS 2020
kind: reference
cluster: Language Models
url: https://arxiv.org/abs/2005.11401
topics: [Retrieval-Augmented Generation, Question Answering, Large Language Models]
methods: [Dense Passage Retrieval, BART, Maximum Inner Product Search]
datasets: [Natural Questions, TriviaQA, WebQuestions, CuratedTrec]
builds_on: [transformer-neurips2017]
---

# Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks

## Summary
Combines a pretrained sequence-to-sequence generator with a neural retriever over a Wikipedia index, so the model's answers are conditioned on retrieved passages instead of only on knowledge stored in its weights.

## Key Contributions
- **RAG models.** A general recipe that couples parametric memory (a seq2seq Transformer) with non-parametric memory (a dense vector index of documents).
- **Two variants.** RAG-Sequence uses the same retrieved passage for the whole output; RAG-Token can use a different passage for each generated token.
- **Updatable knowledge.** The model's knowledge can be changed by swapping the document index, without retraining.

## Method
A DPR query encoder embeds the input, and maximum inner product search returns the top-k Wikipedia passages. BART generates the output conditioned on the input and each passage, and the results are marginalised over the retrieved passages. The retriever's query encoder and the generator are fine-tuned together, end to end.

## Results
RAG set the state of the art on open-domain QA (Natural Questions, WebQuestions, CuratedTrec). Its generations were more factual and specific than those of a parametric-only BART baseline.
