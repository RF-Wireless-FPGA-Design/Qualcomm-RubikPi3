---
# Copy this file to knowledge/papers/<id>.md, fill it in, then run `npm run build:graph` in app/.
id: firstauthor-keyword-year      # unique, lower case, no spaces; used by builds_on and in URLs
title: "Full Paper Title"         # keep the quotes if the title contains ':' or '#'
authors: [First Author, Second Author]   # write each name the same way in every file
year: 2025
venue: Conference or Journal 2025
kind: reference                   # reference = a paper you read; own = your paper
cluster: References               # optional collection; papers with the same cluster are grouped
url: https://arxiv.org/abs/0000.00000
# pdf: path/to/local.pdf          # optional; do not commit other people's PDFs
topics: [Topic A, Topic B]        # reuse names from taxonomy.md so the paper links into the graph
methods: [Method X]
datasets: []
builds_on: []                     # ids of other files in knowledge/papers/
---

# Full Paper Title

## Summary
One or two sentences in your own words: what problem, what idea, why it matters.

## Key Contributions
- **Contribution 1.** …
- **Contribution 2.** …

## Method
One paragraph: the setting, the algorithm or model, and how it is trained or evaluated.

## Results
The main numbers and what they are compared against.
