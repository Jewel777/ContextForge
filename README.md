<div align="center">

# ⚡ ContextForge

### Distill the signal. Keep the evidence.

**A local-first context intelligence engine for turning large documents and raw text into compact, traceable, model-ready context.**

<br />

[![Release](https://img.shields.io/badge/Release-v2.1.2-111111?style=for-the-badge)](https://github.com/Jewel777/ContextForge/releases/tag/v2.1.2)
[![Public Beta](https://img.shields.io/badge/Status-Public_Beta-F5A623?style=for-the-badge)](https://github.com/Jewel777/ContextForge/releases)
[![Local First](https://img.shields.io/badge/Processing-Local_First-2EA44F?style=for-the-badge)](#-local-first-by-design)

[![Windows](https://img.shields.io/badge/Windows-x64-0078D4?style=for-the-badge&logo=windows11&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.2/ContextForge-2.1.2-Windows-x64.zip)
[![macOS](https://img.shields.io/badge/macOS-Apple_Silicon-1D1D1F?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.2/ContextForge-2.1.2-macOS-arm64.zip)

<br />

<img src="docs/contextforge-ui.png" alt="ContextForge Interface" width="920" />

<br />

### Context engineering you can inspect before model handoff.

**Retrieve intelligently · Preserve critical evidence · Compress safely · Verify what survived**

</div>

---

## The problem ContextForge solves

Large documents are easy to send to an AI model.

Sending the **right evidence** is harder.

Long context can contain requirements, thresholds, security controls, deadlines, identifiers, numeric constraints, policies, and important relationships buried inside pages of lower-value material.

ContextForge compiles that source material into a smaller, auditable context package.

```text
Raw documents / text
        │
        ▼
┌───────────────────────────┐
│       ContextForge        │
│                           │
│  Retrieve                 │
│  Rank                     │
│  Classify                 │
│  Protect                  │
│  Compress                 │
│  Verify                   │
└─────────────┬─────────────┘
              │
              ▼
      Model-ready context
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
    ChatGPT Claude Gemini
```

The goal is not simply to make context shorter.

> **The goal is to reduce context without losing the evidence that changes the answer.**

---

## Why ContextForge is different

Traditional retrieval usually asks:

> **What looks relevant?**

ContextForge also asks:

> **What must survive?**

and then:

> **Can we prove that it survived?**

| Capability | ContextForge |
|---|:---:|
| Semantic retrieval | ✅ |
| Lexical retrieval | ✅ |
| Hierarchical retrieval | ✅ |
| Evidence-aware compression | ✅ |
| Numeric constraint preservation | ✅ |
| Mandatory requirement protection | ✅ |
| Security / prohibition awareness | ✅ |
| Selected evidence inspection | ✅ |
| Rejected evidence inspection | ✅ |
| Provenance tracing | ✅ |
| Objective coverage analysis | ✅ |
| Hard-evidence validation | ✅ |
| Explainability manifest | ✅ |
| Local-first processing | ✅ |
| Model-agnostic output | ✅ |

---

# Core Intelligence

<table>
<tr>
<td width="50%" valign="top">

### 🔎 Hybrid Retrieval

Combines semantic similarity with lexical evidence so exact terminology, identifiers, controls, and constraints are less likely to disappear.

</td>
<td width="50%" valign="top">

### 🧭 Hierarchical Retrieval

Evaluates evidence across document structure, sections, pages, and sentence-level context instead of treating a document as one flat block.

</td>
</tr>

<tr>
<td width="50%" valign="top">

### 🛡️ Critical Evidence Protection

Designed to protect requirements such as:

- mandatory controls
- prohibitions
- deadlines
- deployment conditions
- policy rules
- security requirements

</td>
<td width="50%" valign="top">

### 🔢 Numeric Preservation

Explicitly protects evidence such as:

```text
15 minutes
5 failed attempts
256 MB
90 days
3 retries
```

</td>
</tr>

<tr>
<td width="50%" valign="top">

### 🔍 Evidence Inspection

Inspect what was:

- selected
- rejected
- preserved
- classified
- mapped to objectives
- traced to source

</td>
<td width="50%" valign="top">

### ✅ Trust & Coverage

Evaluates:

- critical evidence coverage
- numeric preservation
- objective coverage
- facet coverage
- provenance
- hard-evidence completeness

</td>
</tr>
</table>

---

# Download

<div align="center">

### ContextForge v2.1.2 Desktop

<br />

[![Download Windows](https://img.shields.io/badge/Download-Windows_x64-0078D4?style=for-the-badge&logo=windows11&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.2/ContextForge-2.1.2-Windows-x64.zip)

[![Download macOS](https://img.shields.io/badge/Download-macOS_Apple_Silicon-1D1D1F?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.2/ContextForge-2.1.2-macOS-arm64.zip)

<br />

**Self-contained desktop packages**

No separate Python installation · No separate Node.js installation · Local embedding model included

</div>

---

# Quick Start

## 🪟 Windows x64

### 1. Download

[**ContextForge-2.1.2-Windows-x64.zip**](https://github.com/Jewel777/ContextForge/releases/download/v2.1.2/ContextForge-2.1.2-Windows-x64.zip)

### 2. Extract

Use **Extract All...**

### 3. Start

Double-click:

```text
Start-ContextForge.cmd
```

ContextForge automatically starts the local engine and interface, selects available local ports, and opens your browser.

### 4. Stop

Double-click:

```text
Stop-ContextForge.cmd
```

---

## 🍎 macOS Apple Silicon

Supported on:

**M1 · M2 · M3 · M4 · newer Apple Silicon**

### 1. Download

[**ContextForge-2.1.2-macOS-arm64.zip**](https://github.com/Jewel777/ContextForge/releases/download/v2.1.2/ContextForge-2.1.2-macOS-arm64.zip)

### 2. Extract

Double-click the ZIP.

### 3. Start

Double-click:

```text
Start-ContextForge.command
```

### 4. First-launch permission

The current public-beta package is not notarized.

If macOS blocks the launcher:

**System Settings → Privacy & Security → Open Anyway**

Approve ContextForge and launch it again.

### 5. Stop

Double-click:

```text
Stop-ContextForge.command
```

---

# Workflow

ContextForge keeps the core workflow intentionally simple.

```text
01  Add source material
        ↓
02  Define what must survive
        ↓
03  Choose compression strategy
        ↓
04  Compile
        ↓
05  Inspect retained evidence
        ↓
06  Hand off to your model
```

---

## 01 · Add source material

Upload:

```text
PDF
DOCX
TXT
```

or paste source text directly.

---

## 02 · Define the objective

Tell ContextForge what information matters.

Example:

```text
Extract all mandatory authentication, security,
database, and deployment requirements.

Preserve exact numeric limits and exclude
unrelated operational details.
```

---

## 03 · Choose a strategy

| Strategy | Best for |
|---|---|
| 🛡️ **Safe** | Maximum supporting evidence |
| ⚖️ **Balanced** | Best default for most tasks |
| ⚡ **Aggressive** | Stronger context reduction |

A strict token ceiling can also be configured.

---

## 04 · Compile

ContextForge runs a structured evidence pipeline:

```text
Parse
  ↓
Retrieve
  ↓
Rank
  ↓
Classify
  ↓
Protect critical evidence
  ↓
Validate coverage
  ↓
Compress
  ↓
Pack
```

---

## 05 · Verify

Before model handoff, inspect:

- compiled output
- selected evidence
- rejected evidence
- rejection reasons
- evidence lineage
- source provenance
- objective coverage
- numeric preservation
- trust diagnostics

---

## 06 · Handoff

Use the compiled result with:

- ChatGPT
- Claude
- Gemini
- AI agents
- model APIs
- RAG pipelines
- prompt-engineering systems
- custom AI applications

---

# Context Inspector

The **Context Inspector** makes the compilation process visible.

It can expose:

```text
Selected Evidence
Rejected Evidence
Evidence Types
Matched Objectives
Matched Facets
Numeric Constraints
Structured Constraints
Semantic Roles
Source Pages
Source Sections
Provenance
Trust Metrics
Coverage
Diagnostics
```

This allows users to inspect the evidence package **before it reaches another model**.

---

# Explainability Manifest

ContextForge can generate a structured manifest describing how a compiled context package was constructed.

The manifest may contain:

- retrieval strategy
- selected evidence
- rejected evidence
- rejection reasons
- evidence classifications
- semantic roles
- structured constraints
- pages used
- covered facets
- provenance metadata
- trust metrics

This makes context compilation easier to inspect, audit, export, and integrate into downstream systems.

---

# Standard and Advanced Modes

## Standard

Designed for focused use:

```text
Source
   ↓
Objective
   ↓
Strategy
   ↓
Compile
   ↓
Verify
```

Standard mode hides unnecessary engineering controls.

## Advanced

Advanced mode exposes deeper operational and governance functionality:

- retrieval diagnostics
- evidence provenance
- selected / rejected evidence
- trust metrics
- objective coverage
- policy controls
- regression baselines
- persistence state
- workspace state
- conflict analytics
- audit history
- operational diagnostics

---

# Local-first by design

ContextForge is designed so its core context compilation workflow can run locally.

```text
Source Material
      │
      ▼
Document Parsing
      │
      ▼
Hierarchical Retrieval
      │
      ▼
Evidence Ranking
      │
      ▼
Constraint Protection
      │
      ▼
Coverage Validation
      │
      ▼
Context Packing
      │
      ▼
Explainability Manifest
      │
      ▼
Model-Ready Context
```

The application does **not require a paid LLM** to perform its core retrieval and compilation workflow.

---

# Privacy

Source documents are processed by the ContextForge engine.

ContextForge itself does not automatically send your source material to ChatGPT, Claude, Gemini, or another commercial model as part of the core local compilation workflow.

If you manually copy compiled output into an external AI provider, that provider's privacy and data-handling policies apply.

---

# Example

### Source

```text
The cafeteria serves lunch at noon.

Authentication requires JWT tokens.

Access tokens expire after 15 minutes.

After five failed login attempts,
the account is locked for 20 minutes.
```

### Objective

```text
Extract mandatory authentication and security requirements.
Preserve exact numeric limits.
Exclude unrelated operational details.
```

### Compiled context

```text
Authentication requires JWT tokens.

Access tokens expire after 15 minutes.

After five failed login attempts,
the account is locked for 20 minutes.
```

The cafeteria sentence is removed.

The security requirements and their numeric constraints remain traceable.

---

# Trust Checks

ContextForge evaluates the retained evidence before model handoff.

Example:

```text
Critical Evidence       PASS
Numeric Preservation    PASS
Provenance              PASS
Objective Coverage      PASS / REVIEW
Hard Evidence           PASS
```

A **REVIEW** state does not automatically mean failure.

For example, if an objective requests authentication, database, deployment, and security requirements while the source contains only authentication and security evidence, ContextForge can report incomplete coverage rather than invent missing information.

---

# Release Validation

ContextForge includes an automated release gate:

```powershell
.\tools\run_release_gate.ps1
```

The release pipeline validates areas including:

- retrieval regressions
- extended retrieval benchmarks
- production benchmark
- frontend production build
- critical fact recall
- numeric recall
- distractor rejection
- provenance accuracy
- facet coverage
- context reduction

### v2.1.2 validated benchmark

| Metric | Result |
|---|---:|
| Critical fact recall | **100%** |
| Numeric recall | **100%** |
| Distractor rejection | **100%** |
| Provenance accuracy | **100%** |
| Facet coverage | **7 / 7** |
| Context reduction | **68.99%** |

---

# Architecture

```text
┌───────────────────────────────────────────────────────┐
│                    ContextForge                       │
├─────────────────────────┬─────────────────────────────┤
│       Frontend          │          Engine             │
│                         │                             │
│  Next.js 16             │  Python                    │
│  React 19               │  FastAPI                   │
│  TypeScript             │  Sentence Transformers     │
│  Tailwind CSS           │  SQLite                    │
│                         │  PyMuPDF                    │
│                         │  python-docx                │
│                         │  tiktoken                   │
└─────────────────────────┴─────────────────────────────┘
```

### Embedding model

```text
all-MiniLM-L6-v2
```

---

# Technology

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS |
| API | FastAPI |
| Retrieval | Sentence Transformers |
| Embeddings | all-MiniLM-L6-v2 |
| Document parsing | PyMuPDF + python-docx |
| Tokenization | tiktoken |
| Persistence | SQLite |
| Production server | Uvicorn |
| Containers | Docker / Docker Compose |

---

# Developer Setup

## Backend

```bash
cd engine

python -m venv .venv
```

### Windows

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### macOS / Linux

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

Start:

```bash
python main.py
```

---

## Frontend

```bash
cd web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Production Docker

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.production.yml \
  up --build -d
```

Check status:

```bash
docker compose -f docker-compose.production.yml ps
```

Expected:

```text
engine   healthy
web      healthy
```

---

# Platform Support

| Platform | Status |
|---|---|
| Windows x64 | ✅ v2.1.2 package |
| macOS Apple Silicon | ✅ v2.1.2 package |
| macOS Intel | 🚧 Planned |
| Linux desktop | 🚧 Planned |
| Docker | ✅ Supported |

---

# Security Notice

ContextForge is currently a **public beta**.

Desktop packages are currently distributed without commercial code signing / notarization.

As a result:

- Windows may display a SmartScreen warning.
- macOS may display a Gatekeeper warning.
- Downloads should come only from the official ContextForge repository.

Official repository:

**https://github.com/Jewel777/ContextForge**

Latest release:

**https://github.com/Jewel777/ContextForge/releases/tag/v2.1.2**

---

# Roadmap

Planned areas include:

- package signing and notarization
- Linux desktop packaging
- macOS Intel support
- broader document support
- additional retrieval strategies
- stronger evidence classification
- richer trust diagnostics
- improved context optimization
- additional model handoff workflows
- deployment improvements
- continued UI/UX refinement

---

# Feedback

ContextForge is actively evolving.

Useful reports include:

- important evidence being removed
- irrelevant evidence surviving
- incorrect evidence selection
- numeric constraints being changed or lost
- incorrect provenance
- misleading trust results
- document parsing problems
- startup failures
- deployment problems
- UI/UX issues

When opening an issue, include:

```text
ContextForge version
Operating system
Input type
Steps to reproduce
Expected behavior
Actual behavior
Relevant screenshot or log
```

---

# Project Philosophy

<div align="center">

### Compressing context is easy.

## Preserving the right evidence is the hard part.

ContextForge is designed to reduce context while preserving the evidence required to **understand, inspect, and trust** the final model handoff.

</div>

---

## License

See [LICENSE](LICENSE).

## Citation

Academic and research users can cite ContextForge using:

[`CITATION.cff`](CITATION.cff)

---

<div align="center">

# ⚡ ContextForge

### Distill the signal. Keep the evidence.

**Compile less · Preserve more · Verify before handoff**

<br />

[![Windows Download](https://img.shields.io/badge/Download-Windows_x64-0078D4?style=for-the-badge&logo=windows11&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.2/ContextForge-2.1.2-Windows-x64.zip)

[![macOS Download](https://img.shields.io/badge/Download-macOS_Apple_Silicon-1D1D1F?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.2/ContextForge-2.1.2-macOS-arm64.zip)

<br />

**v2.1.2 · Windows x64 · macOS Apple Silicon · Public Beta**

</div>
