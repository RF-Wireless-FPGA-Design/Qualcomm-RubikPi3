# 4. Use your own data

Everything in the graph comes from the markdown files in `knowledge/`, and you never need to touch `app/`. Each file has a YAML **frontmatter** block between two `---` lines, which holds the structured data the graph is built from. A free markdown **body** follows it and is shown in the UI and read by the chat model.

```
knowledge/
├── profile.md        ← you
├── taxonomy.md       ← how topics nest
├── papers/*.md       ← one file per paper
└── templates/        ← copy these
```

The workflow is always:

```bash
# edit files in knowledge/
cd app && npm run build:graph     # rebuild; it stops with a clear message if something is wrong
# refresh the browser (the running server reloads graph.json by itself)
```

## 4.1 How your markdown becomes a graph

| You write… | …and the graph gets |
|---|---|
| `profile.md` → `id`, `name` | the central **Person** node `person:<id>` |
| `institutions:` | **Institution** nodes + `<relation>` edges (e.g. `STUDENT_AT`), `PART_OF` |
| `interests:` / `learning:` | **Topic** nodes + `INTERESTED_IN` / `LEARNING` |
| `skills:` | **Skill** nodes + `HAS_SKILL` |
| `projects:` | **Project** nodes + `BUILT`, `ABOUT` topic, `USES_SKILL`, `RELATED_TO_PAPER` |
| `awards:` | **Award** nodes + `RECEIVED`, `AWARDED_FOR` project, `ABOUT` topic |
| `courses:` | **Course** nodes + `ENROLLED_IN`/`TEACHING_ASSISTANT_FOR`, `TEACHES`, `OFFERED_BY`, `COVERS`, `USES_MATERIAL` |
| `taxonomy.md` → `child: parent` | `SUBTOPIC_OF` edges between topics |
| a paper file | a **Paper** node + `AUTHORED` (from each **Author**), `ADDRESSES` topic, `USES_METHOD`, `EVALUATED_ON` dataset, `BUILDS_ON` paper, `IN_COLLECTION`, and you `STUDIED_PAPER` (for references) |

**Names are the glue.** Two papers that both list the topic `Differential Privacy` share one Topic node. Node ids ignore capitalisation and punctuation, so `differential privacy` and `Differential-Privacy` are the same node. A different wording, such as `DP` or `Differential Privacy (DP)`, creates a second, separate node. The same goes for methods, datasets, skills and author names (`J. Smith` and `Jane Smith` are two different authors). Ids (`builds_on`, `papers`, `project`, `institution`, `part_of`) must match exactly, or the build stops with an error.

## 4.2 Edit your profile

Open `knowledge/profile.md`. Every field has a comment. At minimum, change:

```yaml
id: tim                                  # your node becomes person:tim (lower case, no spaces)
name: Timothius Victorio Yasin           # exactly as it appears in author lists
short: Tim                               # used in the UI and in the chat's system prompt
aliases: [T. V. Yasin]                   # other spellings in author lists
headline: "Ph.D. student · Wireless · Federated Learning"
```

Any paper whose `authors:` list contains your `name` or one of your `aliases` is treated as **your own paper**. It gets a darker colour and goes into "<short>'s Publications", and the build adds no `STUDIED_PAPER` edge for it.

Then replace the example `institutions`, `interests`, `skills`, `projects`, `awards` and `courses` entries with yours, or delete the sections you don't need (an empty list `[]` also works). Use `chat_suggestions` to change the example questions shown in the chat panel.

The body under the frontmatter is your bio. Write a few sentences: the chat model receives it whenever someone asks about you.

## 4.3 Add a paper

```bash
cp knowledge/templates/paper-template.md knowledge/papers/smith-fl-survey-2024.md
```

Edit the frontmatter:

```yaml
---
id: smith-fl-survey-2024          # unique; also used in builds_on and in URLs (#paper:smith-fl-survey-2024)
title: "A Survey of Federated Learning"
authors: [Jane Smith, Wei Chen]
year: 2024
venue: IEEE Communications Surveys & Tutorials
kind: reference                   # reference = a paper you read; own = your paper
cluster: Federated Learning       # optional collection (folder) the paper belongs to
url: https://arxiv.org/abs/xxxx.xxxxx
pdf: papers-pdf/smith-2024.pdf    # optional, informational only
topics: [Federated Learning, Communication Efficiency]
methods: [FedAvg, FedProx]
datasets: [CIFAR-10]
builds_on: [fedavg-aistats2017]   # ids of other paper files
---
```

The body uses fixed `##` headings. `## Summary` becomes the node's one-line summary, and the whole body appears in the details panel and goes to the chat model (the first ~1,400 characters):

```markdown
# A Survey of Federated Learning

## Summary
One or two sentences.

## Key Contributions
- **Contribution 1.** …

## Method
One paragraph.

## Results
Main numbers.
```

Write the summary in **your own words**. It's better for learning, it's what makes the chat answers useful, and it avoids copying copyrighted text into a public repository. **Do not commit the PDFs** of other people's papers; link to them with `url:` instead.

Rebuild with `npm run build:graph`. `knowledge/papers/INDEX.md` is regenerated as a table of all papers.

## 4.4 Organise topics

`knowledge/taxonomy.md` maps each child topic to its parent:

```yaml
topics:
  Communication Efficiency: Federated Learning
  Federated Learning: Machine Learning
```

Topics that never appear on the left are roots. A topic can have only one parent. The hierarchy is what lets the graph connect "FedProx" questions to the broader "Federated Learning" area.

## 4.5 Draft a paper file from a PDF (optional)

Writing summaries by hand is the best way to learn a paper. For a first draft, though, the local model can read a PDF and fill in the template:

```bash
cd app
npm run draft:paper -- ~/Downloads/some-paper.pdf --id smith-fl-survey-2024
# Asking qwen3.5:2b to read some-paper.pdf (on the RUBIK Pi CPU this takes a few minutes)…
# Wrote …/knowledge/papers/smith-fl-survey-2024.md
```

Options: `--kind own` for your own paper, and `--model qwen3.5:4b` for better extraction. The script needs `pdftotext` (`sudo apt install poppler-utils`). It reads the first 3 pages and the last page, asks Ollama for JSON that matches a fixed schema, and writes the markdown.

**Always review the draft.** A 2B model gets most titles, authors and venues right, but it often:

- picks topic names that differ from yours. The script maps a topic onto an existing one when the names match (ignoring case and punctuation) and prints every **new** topic, so you can rename each one to an existing topic or add it to `taxonomy.md`. Do not paste your topic list into the prompt: in testing, the 2B model then copied the whole list onto an unrelated paper;
- gets numbers in the results wrong or rounds them;
- leaves `builds_on` empty, because it cannot know your other paper ids.

Fix those issues, delete the `# DRAFT …` comment line, and run `npm run build:graph`.

## 4.6 Common build errors

| Message | Cause and fix |
|---|---|
| `profile.md: missing frontmatter field "id"` | Add `id:` and `name:` to `profile.md` |
| `xyz.md: missing frontmatter id` | Every paper file needs an `id:` |
| `These relations point to ids that do not exist … (missing: paper:fedavg-2017)` | A typo in `builds_on`, a project's `papers`, an award's `project`, a course's `institution`, or `part_of`. The message names the missing id |
| `YAMLParseError: … at line N` | Usually a `:` or `#` inside an unquoted value. Put the value in quotes: `title: "RAG: a survey"` |
| Two nodes for the same topic or author | The wording differs between files (`DP` vs `Differential Privacy`, `J. Smith` vs `Jane Smith`). Use the same name everywhere |
| My paper is not shown as mine | Your name in its `authors:` does not match `name`/`aliases` exactly. Add the spelling to `aliases`, or set `kind: own` |

## 4.7 Use the exports elsewhere

Each build also writes two files to `knowledge/export/`, which can be used outside this app:

- `nodes.jsonl`: one line per node. Its `text` field combines the description, properties, markdown body and every incident fact as a sentence, ready to feed an embedding model (e.g. `ollama pull nomic-embed-text`) for vector search.
- `triples.jsonl`: one `(subject, relation, object)` triple per line plus a sentence form. Use it for KG-embedding models (TransE, RotatE) or for loading into Neo4j and other GraphRAG tools.

Next: [5. Keep it running →](05-keep-it-running.md)
