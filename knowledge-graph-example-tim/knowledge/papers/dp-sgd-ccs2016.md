---
id: dp-sgd-ccs2016
title: "Deep Learning with Differential Privacy"
authors: [Martín Abadi, Andy Chu, Ian Goodfellow, H. Brendan McMahan, Ilya Mironov, Kunal Talwar, Li Zhang]
year: 2016
venue: ACM CCS 2016
kind: reference
cluster: Privacy
url: https://arxiv.org/abs/1607.00133
topics: [Differential Privacy, Deep Learning, Privacy-Preserving ML]
methods: [DP-SGD, Moments Accountant, Gradient Clipping]
datasets: [MNIST, CIFAR-10]
builds_on: []
---

# Deep Learning with Differential Privacy

## Summary
Shows how to train deep neural networks with formal differential-privacy guarantees and a modest loss of accuracy, using differentially private SGD and a tighter way to account for privacy loss.

## Key Contributions
- **DP-SGD.** Clips each example's gradient to a fixed norm and adds Gaussian noise to every minibatch update.
- **Moments accountant.** Tracks the privacy loss over many training steps much more tightly than the standard composition theorems, which allows more training for the same (ε, δ) budget.
- **Practical evaluation.** Shows that non-convex deep models can be trained under single-digit ε budgets.

## Method
For each lot of examples, compute the per-example gradients, clip each one to L2 norm C, add noise N(0, σ²C²I), average them, and take a step. The moments accountant bounds the log moments of the privacy-loss random variable under random subsampling, and converts the bound into an (ε, δ) guarantee.

## Results
On MNIST and CIFAR-10 the private models get close to non-private baselines at modest privacy budgets (ε in single digits, δ = 1e-5).
