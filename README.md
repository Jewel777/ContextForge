# ContextForge 2.1

**ContextForge** is a local-first AI context compiler that retrieves, compresses, and preserves task-relevant evidence before model handoff.

It is designed for workflows where **traceability, numeric preservation, hard requirements, provenance, and token efficiency** matter.
![ContextForge UI](docs/contextforge-ui.png)
## What ContextForge does

ContextForge can ingest:

- PDF
- DOCX
- TXT
- Pasted text

It then:

- Retrieves task-relevant evidence
- Suppresses noise and near-duplicates
- Preserves exact numeric constraints
- Preserves hard requirements and prohibitions
- Tracks provenance and source evidence
- Compresses context under a strict token budget
- Produces model-ready output for ChatGPT, Claude, Gemini, or raw context
- Exposes selected and rejected evidence for review

## Key features

- Hierarchical section-to-sentence retrieval
- Semantic and lexical ranking
- Evidence-aware context compression
- Exact numeric and structured-constraint preservation
- Critical evidence safeguards
- Provenance and traceability
- Trust evaluation
- Objective/facet coverage checks
- Selected/rejected evidence inspection
- Safe, Balanced, and Aggressive compilation modes
- Token-budget presets and utilization tracking
- Compile history
- Manifest export
- Local SQLite embedding cache
- Standard and Advanced interfaces
- Local-first architecture

## Trust and explainability

ContextForge exposes evidence-level diagnostics instead of treating compression as a black box.

Trust checks include:

- Critical evidence preservation
- Numeric preservation
- Provenance coverage
- Objective coverage
- Hard evidence completeness

Each compile can also expose:

- Selected evidence
- Rejected evidence
- Rejection reasons
- Evidence type
- Matched facets
- Structured constraints
- Source traceability

## Tech stack

### Backend

- Python
- FastAPI
- Sentence Transformers
- `all-MiniLM-L6-v2`
- PyMuPDF
- python-docx
- SQLite
- tiktoken

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

## Start

### Windows launcher

Double-click:

```text
Start-ContextForge.cmd
