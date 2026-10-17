---
id: fedavg-aistats2017
title: "Communication-Efficient Learning of Deep Networks from Decentralized Data"
authors: [H. Brendan McMahan, Eider Moore, Daniel Ramage, Seth Hampson, Blaise Agüera y Arcas]
year: 2017
venue: AISTATS 2017
kind: reference
cluster: Federated Learning
url: https://arxiv.org/abs/1602.05629
topics: [Federated Learning, Communication Efficiency, Deep Learning]
methods: [FedAvg, Stochastic Gradient Descent]
datasets: [MNIST, CIFAR-10, Shakespeare]
builds_on: []
---

# Communication-Efficient Learning of Deep Networks from Decentralized Data

## Summary
Introduces federated learning: many clients (for example phones) train a shared model on their own data, which never leaves the device, and a server averages their model updates.

## Key Contributions
- **Problem formulation.** Defines the federated setting: data that is non-IID, unbalanced, spread over a very large number of clients, and reached over slow, unreliable links.
- **FederatedAveraging (FedAvg).** Each selected client runs several epochs of local SGD, and the server takes a weighted average of the resulting models.
- **Empirical study.** Shows that FedAvg works with non-IID data, across five model architectures and four datasets.

## Method
In each round the server samples a fraction C of the clients and sends them the current model. Each client runs E local epochs of minibatch SGD (batch size B) and sends its model back. The server averages the models, weighting each by the client's number of examples. FedSGD is the special case of one gradient step per round.

## Results
FedAvg needs 10–100× fewer communication rounds than FedSGD to reach a target accuracy, including on pathologically non-IID splits of MNIST.
