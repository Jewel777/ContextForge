<div align="center">

# ⚡ ContextForge

### Distill the signal. Keep the evidence.

**A local-first AI context compiler that turns large documents and raw text into compact, traceable, model-ready context.**

<br>

[![Release](https://img.shields.io/badge/release-v2.1.2-F97316?style=for-the-badge)](https://github.com/Jewel777/ContextForge/releases/tag/v2.1.2)
![Windows](https://img.shields.io/badge/Windows-x64-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=for-the-badge&logo=apple&logoColor=white)
![Status](https://img.shields.io/badge/status-public%20beta-F59E0B?style=for-the-badge)
![Local First](https://img.shields.io/badge/processing-local--first-16A34A?style=for-the-badge)

<br>

<img src="docs/contextforge-ui.png" alt="ContextForge Interface" width="900">

<br><br>

## ⬇️ Download ContextForge

### Desktop packages

[![Windows Download](https://img.shields.io/badge/Windows_x64-Download-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-Windows-x64.zip)
&nbsp;
[![macOS Download](https://img.shields.io/badge/macOS_Apple_Silicon-Download-111111?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-macOS-arm64.zip)

**Current packaged desktop build: v2.1.0**

**Latest source release: v2.1.2**

Self-contained desktop packages · No separate Python setup · No separate Node.js setup · Local embedding model included

</div>

---

## 🚀 What is ContextForge?

Large documents are easy to send to an AI model.

Sending the **right information** is harder.

ContextForge sits between your source material and the model. It retrieves relevant evidence, protects important requirements and numeric constraints, removes lower-value context, and shows you exactly what survived the compilation process.

```text
Large Source
     │
     ▼
┌─────────────────────┐
│    ContextForge     │
│                     │
│  Retrieve           │
│  Rank               │
│  Preserve           │
│  Compress           │
│  Trace              │
└──────────┬──────────┘
           │
           ▼
 Compact, verified,
 model-ready context
           │
     ┌─────┼─────┐
     ▼     ▼     ▼
 ChatGPT Claude Gemini
```

ContextForge is designed for workflows where losing a single requirement, limit, deadline, prohibition, control, number, or source relationship can materially change the result.

---

## ✨ What makes ContextForge different?

Most context-reduction workflows answer one question:

> **What looks relevant?**

ContextForge goes further:

> **What must survive — and can we verify that it survived?**

| Capability | ContextForge |
|---|:---:|
| Semantic retrieval | ✅ |
| Lexical retrieval | ✅ |
| Hierarchical retrieval | ✅ |
| Evidence-aware compression | ✅ |
| Numeric constraint preservation | ✅ |
| Mandatory requirement protection | ✅ |
| Prohibition / control awareness | ✅ |
| Selected evidence inspection | ✅ |
| Rejected evidence inspection | ✅ |
| Provenance tracing | ✅ |
| Objective coverage checks | ✅ |
| Hard-evidence coverage | ✅ |
| Trust diagnostics | ✅ |
| Local-first processing | ✅ |
| Model-agnostic handoff | ✅ |

---

# 🧠 Core Capabilities

## 🔎 Hybrid Retrieval

ContextForge combines semantic similarity with lexical evidence instead of relying on a single retrieval signal.

This helps preserve:

- exact terminology
- identifiers
- requirements
- numeric constraints
- security controls
- domain-specific language
- operational constraints

that purely semantic retrieval may overlook.

---

## 🧭 Hierarchical Retrieval

Evidence can be evaluated across document structure and sentence-level context.

Instead of blindly forwarding entire documents, ContextForge identifies the sections and sentences most relevant to the requested objective.

---

## 🛡️ Critical Evidence Protection

ContextForge is designed to recognize and protect information such as:

- mandatory requirements
- prohibitions
- security controls
- deadlines
- numeric limits
- durations
- counts
- thresholds
- structured constraints
- deployment requirements
- policy conditions

---

## 🔢 Numeric Preservation

Numbers often carry more meaning than the surrounding prose.

ContextForge explicitly protects numeric evidence such as:

```text
15 minutes
5 failed attempts
20 minutes
256 MB
90 days
3 retries
```

This helps prevent compression from silently changing important operational requirements.

---

## 🔍 Evidence Inspection

You can inspect:

- what was selected
- what was rejected
- why evidence was retained
- why evidence was rejected
- matched objectives and facets
- evidence classification
- semantic role
- source page
- source section
- structured constraints
- provenance
- confidence signals

---

## ✅ Trust & Coverage

Before handing compiled context to a model, ContextForge evaluates the quality of the retained evidence.

Checks include:

- critical evidence preservation
- numeric preservation
- provenance coverage
- objective coverage
- facet coverage
- hard-evidence completeness

ContextForge is designed to surface uncertainty rather than silently invent missing evidence.

---

# ⚡ Quick Start

## 🪟 Windows x64

### 1. Download

[**ContextForge-2.1.0-Windows-x64.zip**](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-Windows-x64.zip)

### 2. Extract

Right-click the ZIP file and choose:

**Extract All...**

### 3. Launch

Open the extracted folder and double-click:

```text
Start-ContextForge.cmd
```

### 4. Use ContextForge

Your browser opens automatically at:

```text
http://127.0.0.1:3000
```

When ready, the interface displays:

```text
● Engine online
```

---

## 🍎 macOS Apple Silicon

Supported on Apple Silicon Macs including:

- M1
- M2
- M3
- M4
- later Apple Silicon processors

### 1. Download

[**ContextForge-2.1.0-macOS-arm64.zip**](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-macOS-arm64.zip)

### 2. Extract

Double-click the downloaded ZIP.

### 3. Open

Open the extracted ContextForge folder.

### 4. Launch

Double-click:

```text
Start-ContextForge.command
```

### 5. First-launch macOS permission

The current packaged build is unsigned.

macOS may display a Gatekeeper warning on first launch.

If this happens:

1. Click **Done**
2. Open **System Settings**
3. Open **Privacy & Security**
4. Scroll to **Security**
5. Locate the blocked ContextForge launcher
6. Click **Open Anyway**
7. Authenticate if prompted
8. Confirm **Open**

After the one-time approval, launch ContextForge again.

### 6. Use ContextForge

The browser opens at:

```text
http://127.0.0.1:3000
```

When ready:

```text
● Engine online
```

---

# 🎯 Typical Workflow

## 01 · Add Source Material

Upload:

```text
PDF
DOCX
TXT
```

or paste text directly.

---

## 02 · Define the Objective

Tell ContextForge what information must survive.

Example:

```text
Extract all mandatory authentication, security,
database, and deployment requirements.

Preserve exact numeric limits and exclude
unrelated operational details.
```

---

## 03 · Choose a Strategy

ContextForge provides three compilation modes:

| Mode | Purpose |
|---|---|
| 🛡️ **Safe** | Maximum evidence preservation |
| ⚖️ **Balanced** | Best default for most workflows |
| ⚡ **Aggressive** | Stronger context reduction |

You can also define a strict token ceiling.

---

## 04 · Compile

ContextForge:

```text
Parses
  ↓
Retrieves
  ↓
Ranks
  ↓
Classifies
  ↓
Protects critical evidence
  ↓
Checks coverage
  ↓
Compresses
  ↓
Builds the final context
```

---

## 05 · Verify

Before sending anything to an AI model, inspect:

- compiled output
- selected evidence
- rejected evidence
- rejection reasons
- evidence lineage
- provenance
- trust summary
- objective coverage
- numeric preservation
- retrieval diagnostics

---

## 06 · Handoff

Use the compiled context with:

- ChatGPT
- Claude
- Gemini
- AI agents
- prompt-engineering workflows
- custom AI pipelines
- model APIs

---

# 🖥️ Standard vs Advanced

## Standard

Designed for focused everyday use:

```text
Add Source
    ↓
Define Objective
    ↓
Choose Strategy
    ↓
Compile
    ↓
Review
```

Standard mode keeps the primary workflow simple and focused.

---

## Advanced

Advanced mode exposes deeper engineering and governance controls, including:

- evidence provenance
- selected evidence
- rejected evidence
- retrieval diagnostics
- trust metrics
- objective coverage
- policy controls
- regression baselines
- workspace state
- conflict analysis
- audit history
- persistence controls
- operational diagnostics

---

# 🔎 Context Inspector

The Context Inspector exposes the evidence structure behind a compiled context package.

It can surface:

```text
Selected Evidence
Rejected Evidence
Evidence Types
Matched Facets
Numeric Constraints
Structured Constraints
Semantic Roles
Provenance
Trust Metrics
Coverage
Diagnostics
```

This allows users to inspect the context **before it reaches the model**.

---

# 📋 Context Manifest

ContextForge can generate a structured explainability manifest describing how the compiled context was assembled.

The manifest can contain:

- retrieval strategy
- selected evidence
- rejected evidence
- rejection reasons
- covered facets
- pages used
- evidence types
- structured constraints
- semantic roles
- trust metrics
- provenance metadata

The manifest can also be exported for auditing and downstream workflows.

---

# 🔐 Local-First Architecture

ContextForge is designed around local-first processing.

The core application does not require a paid language model for retrieval and context compilation.

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
Constraint Preservation
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

---

# 🌐 Local Services

| Component | Local Address |
|---|---|
| ContextForge UI | `http://127.0.0.1:3000` |
| ContextForge Engine | `http://127.0.0.1:8001` |

These services run locally on your computer.

---

# 🔒 Privacy

ContextForge is designed around **local-first processing**.

Source documents are processed by the ContextForge engine.

If you manually copy compiled output into an external AI provider, that provider's privacy and data-handling policies apply.

ContextForge does not change the policies of:

- ChatGPT
- Claude
- Gemini
- other external AI systems

---

# 🧪 Example

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

### ContextForge Result

```text
Authentication requires JWT tokens.

Access tokens expire after 15 minutes.

After five failed login attempts,
the account is locked for 20 minutes.
```

The cafeteria sentence is discarded.

The security requirements and numeric constraints remain traceable.

---

# 📊 Trust Checks

ContextForge evaluates compiled context before model handoff.

Example:

```text
Critical Evidence       PASS
Numeric Preservation    PASS
Provenance              PASS
Objective Coverage      PASS / REVIEW
Hard Evidence           PASS
```

A **REVIEW** state does not necessarily mean failure.

For example, if an objective requests authentication, database, deployment, and security requirements but the source contains only authentication and security evidence, ContextForge can flag incomplete coverage instead of inventing missing information.

---

# 🧰 Tech Stack

## Backend

- Python
- FastAPI
- Sentence Transformers
- `all-MiniLM-L6-v2`
- PyMuPDF
- python-docx
- SQLite
- tiktoken
- Uvicorn

## Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

## Deployment

- Docker
- Docker Compose
- production health checks
- security posture validation
- configurable origin policy
- request-size controls
- optional authentication foundation
- optional server persistence

---

# 🧑‍💻 Developer Setup

## Backend

```powershell
cd engine

python -m venv .venv

.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

Start the engine:

```powershell
python main.py
```

---

## Frontend

```powershell
cd web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# 🐳 Production Docker

Create your production environment configuration and run:

```powershell
docker compose --env-file .env.production -f docker-compose.production.yml up --build -d
```

Check status:

```powershell
docker compose -f docker-compose.production.yml ps
```

Expected:

```text
engine   healthy
web      healthy
```

---

# ❤️ Health Check

```powershell
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
```

Expected:

```text
StatusCode : 200
```

---

# 🧪 Release Validation

ContextForge includes an automated release gate.

Run:

```powershell
.\tools\run_release_gate.ps1
```

The gate validates:

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
- working-tree cleanliness

The validated `v2.1.2` production benchmark achieved:

```text
Critical fact recall     100%
Numeric recall           100%
Distractor rejection     100%
Provenance accuracy      100%
Facet coverage           7 / 7
Context reduction        68.99%
```

---

# 💻 Platform Support

| Platform | Status |
|---|---|
| Windows x64 | ✅ Packaged build available |
| macOS Apple Silicon | ✅ Packaged build available |
| macOS Intel | 🚧 Planned |
| Linux | 🚧 Planned |
| Docker | ✅ Supported |

---

# ⚠️ Security Notice

ContextForge is currently a **public beta**.

The packaged desktop builds are not currently code-signed.

Because of this:

- Windows may display a SmartScreen warning.
- macOS may display a Gatekeeper warning.
- Users should download ContextForge only from the official repository and release pages.

Official repository:

**https://github.com/Jewel777/ContextForge**

Latest source release:

**https://github.com/Jewel777/ContextForge/releases/tag/v2.1.2**

---

# 📦 Releases

## ContextForge v2.1.2

Latest source release.

Highlights:

- production container database permission fix
- validated Docker production stack
- retrieval regression verification
- production benchmark verification
- frontend production build verification
- deployment and security tooling
- expanded Advanced operations infrastructure

[View ContextForge v2.1.2](https://github.com/Jewel777/ContextForge/releases/tag/v2.1.2)

---

## ContextForge v2.1.0

Current downloadable desktop package.

Includes:

- Windows x64 package
- macOS Apple Silicon package
- bundled runtime
- bundled embedding model
- local-first execution

[View ContextForge v2.1.0](https://github.com/Jewel777/ContextForge/releases/tag/v2.1.0)

---

# 🐛 Feedback & Issues

ContextForge is currently in public beta.

Useful reports include:

- incorrect evidence selection
- important evidence being removed
- irrelevant evidence surviving
- numeric constraints being changed or lost
- incorrect provenance
- misleading trust results
- startup failures
- document parsing problems
- UI/UX problems
- deployment issues

When opening an issue, please include:

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

# 🗺️ Roadmap

Planned areas include:

- updated v2.1.x desktop packages
- Linux packaging
- macOS Intel support
- package signing
- broader document support
- additional retrieval strategies
- stronger evidence classification
- expanded trust diagnostics
- improved context optimization
- additional model handoff workflows
- deployment improvements
- UI/UX refinement

---

# 💡 Project Philosophy

ContextForge is built around a simple principle:

> **Compressing context is easy. Preserving the right evidence is the hard part.**

ContextForge is designed to reduce context while preserving the evidence needed to understand, audit, and trust the final model handoff.

---

# 📄 License

See [LICENSE](LICENSE).

---

# 📚 Citation

Academic and research users can cite ContextForge using:

[`CITATION.cff`](CITATION.cff)

---

<div align="center">

# ⚡ ContextForge

### Distill the signal. Keep the evidence.

**Compile less. Preserve more. Verify before handoff.**

<br>

[![Windows Download](https://img.shields.io/badge/Download-Windows_x64-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-Windows-x64.zip)

[![macOS Download](https://img.shields.io/badge/Download-macOS_Apple_Silicon-111111?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-macOS-arm64.zip)

<br><br>

**Latest source: v2.1.2 · Desktop package: v2.1.0 · Public Beta**

</div>
