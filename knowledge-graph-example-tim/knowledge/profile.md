---
# ─────────────────────────────────────────────────────────────────────────────
# YOUR PROFILE — the centre of the graph. Replace every value with your own.
# Everything between the two `---` lines is YAML; the builder reads only that part.
# Lists can be written as `[a, b]` or as `- a` lines. Quote strings that contain `:` or `#`.
# ─────────────────────────────────────────────────────────────────────────────

id: alex                      # REQUIRED. Short, no spaces. Your node id becomes person:alex
name: Alex Example            # REQUIRED. Your full name, exactly as in paper author lists
short: Alex                   # What the UI and chat call you (defaults to your first name)
aliases: [A. Example]         # Other spellings of your name in author lists, so those papers count as yours
headline: "M.Sc. student · Edge AI · Federated Learning · Retrieval-Augmented Generation"
github: https://github.com/your-github-id
website: https://your-github-id.github.io
motto: "Replace me with your own motto"
personal: [Hiking, Photography]

# Optional. Name of the collection your own papers go into (default "<short>'s Publications").
# own_collection: Alex's Publications

# Optional. Example questions shown as buttons in the chat panel.
chat_suggestions:
  - Summarise Alex's research interests
  - Which papers build on the Transformer?
  - What is the key idea of FedAvg?
  - How does GraphRAG differ from RAG?
  - Which papers address differential privacy?

# relation is free text (UPPER_SNAKE_CASE); it becomes the edge label.
# part_of links an institution to another one by id.
institutions:
  - {id: example-u, name: Example University, relation: STUDENT_AT, detail: "M.Sc., Electrical Engineering, 2025–present"}
  - {id: edge-ai-lab, name: Edge AI Lab, relation: MEMBER_OF, detail: "Research lab", part_of: example-u}

interests:                    # → Person INTERESTED_IN Topic
  - Federated Learning
  - Differential Privacy
  - Retrieval-Augmented Generation
  - Edge AI
learning:                     # → Person LEARNING Topic
  - Knowledge Graphs
  - Large Language Models

skills:                       # → Person HAS_SKILL Skill (category is free text)
  - {name: Python, category: Language}
  - {name: TypeScript, category: Language}
  - {name: PyTorch, category: Framework}
  - {name: Linux, category: Infrastructure}
  - {name: Ollama, category: Tool}

# papers: ids of paper files (knowledge/papers/*.md) this project relates to.
projects:
  - {id: proj-rubik-kg, name: RUBIK Pi Knowledge Graph, desc: "This repository: a personal research knowledge graph with a local LLM chat on the RUBIK Pi 3", url: "https://github.com/RF-Wireless-FPGA-Design/Qualcomm-RubikPi3/tree/main/knowledge-graph-example-tim", topics: [Knowledge Graphs, Retrieval-Augmented Generation, Edge AI], skills: [TypeScript, Ollama], papers: [example-course-report-2026]}

# project: id of a project above that the award was for (optional).
awards:
  - {id: award-example-hackathon, name: "Example Campus Hackathon — 2nd place (sample entry)", date: 2026-05, project: proj-rubik-kg}

# relation defaults to TEACHING_ASSISTANT_FOR; use ENROLLED_IN for a course you are taking.
# institution: id of an institution above (adds Course OFFERED_BY Institution).
courses:
  - {id: course-edge-ai, name: Edge AI Systems (example course), semester: Fall 2026, relation: ENROLLED_IN, instructor: Example Instructor, institution: example-u, topics: [Edge AI, Large Language Models], projects: [proj-rubik-kg]}

# Your own publications that have no markdown file in knowledge/papers/ (title-only entries).
extra_publications: []
#  - {id: my-workshop-2025, title: "My Workshop Paper", year: 2025, venue: "Some Workshop 2025", authors: [Alex Example, B. Coauthor], topics: [Edge AI]}
---

# Alex Example — profile

Everything below the frontmatter is free markdown. It is shown when you click the person node,
and the chat model can read it. Write a short bio here.

Alex is a (fictional) M.Sc. student in the Edge AI Lab at Example University. Alex studies how
machine-learning models can be trained and queried on small edge devices such as the RUBIK Pi 3,
with a focus on federated learning, differential privacy and retrieval-augmented generation.
