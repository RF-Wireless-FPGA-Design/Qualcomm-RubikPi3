---
id: transformer-neurips2017
title: "Attention Is All You Need"
authors: [Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin]
year: 2017
venue: NeurIPS 2017
kind: reference
cluster: Language Models
url: https://arxiv.org/abs/1706.03762
topics: [Sequence Modeling, Machine Translation, Deep Learning]
methods: [Transformer, Multi-Head Attention, Positional Encoding]
datasets: [WMT 2014 English-German, WMT 2014 English-French]
builds_on: []
---

# Attention Is All You Need

## Summary
Proposes the Transformer, a sequence-to-sequence architecture built entirely on attention, with no recurrence or convolution. It became the basis of modern large language models.

## Key Contributions
- **Transformer architecture.** An encoder–decoder stack of multi-head self-attention and position-wise feed-forward layers, with residual connections and layer normalisation.
- **Multi-head scaled dot-product attention.** Lets the model attend to information from several representation subspaces at once.
- **Parallel training.** Removing recurrence makes training highly parallel and much faster than RNN-based models.

## Method
Tokens are embedded and given sinusoidal positional encodings. Each of the 6 encoder layers applies multi-head self-attention and then a feed-forward network. The decoder layers add masked self-attention and attention over the encoder output. Training uses Adam with a warm-up learning-rate schedule, label smoothing and dropout.

## Results
On WMT 2014 the Transformer reached 28.4 BLEU for English→German and set a new single-model state of the art for English→French, at a fraction of the training cost of earlier models.
