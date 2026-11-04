<div align="center">

# ⚡ ContextForge

### Distill the signal. Keep the evidence.

**A local-first AI context compiler that turns large documents and raw text into compact, traceable, model-ready context.**

<br>

[![Release](https://img.shields.io/badge/release-v2.1.0-2563EB?style=for-the-badge)](https://github.com/Jewel777/ContextForge/releases/tag/v2.1.0)
![Windows](https://img.shields.io/badge/Windows-x64-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-111111?style=for-the-badge&logo=apple&logoColor=white)
![Status](https://img.shields.io/badge/status-public%20beta-F59E0B?style=for-the-badge)
![Local First](https://img.shields.io/badge/processing-local--first-16A34A?style=for-the-badge)

<br>

<img src="contextforge-ui.png" alt="ContextForge Interface" width="880">

<br><br>

### Download ContextForge 2.1.0

[![Windows Download](https://img.shields.io/badge/Windows_x64-Download-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-Windows-x64.zip)
&nbsp;
[![macOS Download](https://img.shields.io/badge/macOS_Apple_Silicon-Download-111111?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-macOS-arm64.zip)

**Self-contained · No Python setup · No Node.js setup · Local embedding model included**

</div>

---

## Why ContextForge?

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
│ Retrieve            │
│ Rank                │
│ Preserve            │
│ Compress            │
│ Trace               │
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

ContextForge is designed for tasks where losing a single requirement, limit, deadline, prohibition, or source relationship can materially change the result.

---

## What makes it different?

Most context-reduction workflows answer one question:

> **What looks relevant?**

ContextForge goes further:

> **What must survive — and can we prove that it survived?**

| Capability | ContextForge |
|---|---|
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
| Trust diagnostics | ✅ |
| Local-first processing | ✅ |
| Model-agnostic handoff | ✅ |

---

## Core capabilities

### 🧠 Hybrid retrieval

ContextForge combines semantic similarity with lexical evidence instead of relying on a single retrieval signal.

This helps preserve exact terminology, identifiers, requirements, and domain-specific language that purely semantic systems may overlook.

### 🗂 Hierarchical retrieval

Evidence can be evaluated across document structure and sentence-level context, allowing ContextForge to retain relevant information without blindly forwarding entire documents.

### 🛡 Critical evidence protection

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

### 🔢 Numeric preservation

Numbers often carry more meaning than surrounding prose.

ContextForge explicitly tracks numeric evidence such as:

```text
15 minutes
5 failed attempts
20 minutes
256 MB
90 days
3 retries
```

### 🔎 Evidence inspection

You can inspect:

- what was selected
- what was rejected
- why evidence was selected
- why evidence was rejected
- matched facets
- provenance
- confidence signals
- evidence classifications

### 📊 Trust and coverage

Before handing compiled context to a model, ContextForge evaluates evidence quality through checks including:

- critical evidence recall
- numeric preservation
- provenance coverage
- objective coverage
- hard-evidence completeness

---

## Quick start

### Windows x64

**1. Download**

[`ContextForge-2.1.0-Windows-x64.zip`](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-Windows-x64.zip)

**2. Extract the ZIP**

Right-click → **Extract All...**

**3. Launch**

Double-click:

```text
Start-ContextForge.cmd
```

---

### macOS Apple Silicon

For Macs using Apple Silicon:

- M1
- M2
- M3
- M4
- later Apple Silicon processors

**1. Download**

[`ContextForge-2.1.0-macOS-arm64.zip`](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-macOS-arm64.zip)

**2. Extract the ZIP**

**3. Open the extracted folder**

**4. Launch**

Double-click:

```text
Start-ContextForge.command
```

---

### After launch

ContextForge starts its local engine and web interface automatically.

The browser opens at:

```text
http://127.0.0.1:3000
```

When ready, the interface displays:

```text
● Engine online
```

> ContextForge 2.1.0 is currently unsigned. Windows or macOS may display a security warning on first launch. See the security section below.

---

## A typical workflow

### 01 — Add source material

Upload:

```text
PDF
DOCX
TXT
```

or paste text directly.

### 02 — Define what matters

Tell ContextForge what information must survive compression.

Example:

```text
Extract all mandatory authentication, security,
database, and deployment requirements.

Preserve exact numeric limits and exclude
unrelated operational details.
```

### 03 — Compile

Choose a context budget and processing mode.

ContextForge retrieves, evaluates, ranks, and compiles the relevant evidence.

### 04 — Verify

Before sending anything to an AI model, inspect:

- compiled output
- selected evidence
- rejected evidence
- evidence lineage
- provenance
- trust summary
- objective coverage
- retrieval diagnostics

### 05 — Handoff

Use the compiled context with:

- ChatGPT
- Claude
- Gemini
- agent workflows
- custom AI pipelines
- prompt engineering systems

---

## Processing modes

| Mode | Purpose |
|---|---|
| 🛡 **Safe** | Maximum evidence preservation |
| ⚖️ **Balanced** | General-purpose context compilation |
| ⚡ **Aggressive** | Stronger context reduction |

The goal is not simply to produce fewer tokens.

The goal is to reduce context **without silently destroying evidence that matters**.

---

## Standard and Advanced interfaces

### Standard

Designed for focused everyday use.

```text
Add Source
   ↓
Define Objective
   ↓
Compile
   ↓
Review
```

### Advanced

Provides deeper visibility into ContextForge's internal decisions, including:

- evidence provenance
- selected evidence
- rejected evidence
- retrieval diagnostics
- trust metrics
- objective coverage
- context budgets
- engineering controls

---

## Context Inspector

The Context Inspector exposes the reasoning structure behind a compiled context package.

It can surface:

```text
Selected Evidence
Rejected Evidence
Evidence Types
Matched Facets
Numeric Constraints
Provenance
Trust Metrics
Coverage
Diagnostics
```

This allows users to inspect the context **before** it reaches the model.

---

## Local-first architecture

ContextForge is distributed as a self-contained local application.

### Windows package

```text
ContextForge-2.1.0/
│
├── Start-ContextForge.cmd
├── Start-ContextForge.ps1
├── backend/
├── frontend/
├── models/
├── runtime/
└── logs/
```

### macOS package

```text
ContextForge-2.1.0-macOS-arm64/
│
├── Start-ContextForge.command
├── backend/
├── frontend/
├── models/
├── runtime/
└── logs/
```

The packages include the runtime components needed by ContextForge.

You do **not** need to separately install:

```text
Python
Node.js
PyTorch
sentence-transformers
the embedding model
```

---

## Privacy

ContextForge is designed around **local-first processing**.

Source documents are processed by the local ContextForge engine.

The core application runs on:

```text
127.0.0.1
```

If you manually copy compiled output into an external AI provider, that provider's own privacy and data-handling policies apply.

ContextForge does not change the policies of services such as ChatGPT, Claude, or Gemini.

---

## Local services

| Component | Local address |
|---|---|
| ContextForge UI | `http://127.0.0.1:3000` |
| ContextForge Engine | `http://127.0.0.1:8001` |

These services are used by the local application.

---

## Example

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

### ContextForge result

```text
Authentication requires JWT tokens.

Access tokens expire after 15 minutes.

After five failed login attempts,
the account is locked for 20 minutes.
```

The cafeteria sentence is excluded.

The security requirements and exact numeric constraints remain traceable.

---

## Trust checks

ContextForge evaluates the quality of the compiled context before model handoff.

Examples include:

```text
Critical Evidence       PASS
Numeric Preservation    PASS
Provenance              PASS
Objective Coverage      REVIEW / PASS
Hard Evidence           PASS
```

A review state does not automatically mean failure.

For example, if the objective asks for authentication, security, database, and deployment requirements but the source only contains authentication and security evidence, ContextForge can flag incomplete objective coverage rather than inventing missing information.

---

## Supported platforms

| Platform | Status |
|---|---|
| Windows x64 | ✅ Available |
| macOS Apple Silicon (`arm64`) | ✅ Available |
| macOS Intel | 🚧 Planned |
| Linux | 🚧 Planned |

---

## Security notice

ContextForge 2.1.0 is a **public beta** and is currently **not code-signed**.

Because of this:

- Windows may display a SmartScreen warning.
- macOS may display a Gatekeeper warning.
- Users should only download ContextForge from the official repository and release page.

Official repository:

**https://github.com/Jewel777/ContextForge**

Official release:

**https://github.com/Jewel777/ContextForge/releases/tag/v2.1.0**

---

## Release checksums

Verify downloaded packages using SHA-256.

### Windows x64

```text
ContextForge-2.1.0-Windows-x64.zip

9B4A9280C916069D6F7C0D5C365508FBA997B0FC82697394782255B6F0AB0D0C
```

### macOS Apple Silicon

```text
ContextForge-2.1.0-macOS-arm64.zip

958FD54D75E630D83DD4F46722A6465CDBA0864EC640BE6E21F341B23CE7F073
```

---

## Current release

### ContextForge 2.1.0 — First Public Beta

Included in this release:

- local-first execution
- PDF input
- DOCX input
- TXT input
- pasted-text input
- semantic retrieval
- lexical retrieval
- hierarchical retrieval
- evidence-aware context reduction
- numeric constraint preservation
- critical-evidence safeguards
- provenance tracking
- selected evidence inspection
- rejected evidence inspection
- objective coverage analysis
- trust metrics
- Safe mode
- Balanced mode
- Aggressive mode
- Standard interface
- Advanced interface
- ChatGPT handoff
- Claude handoff
- Gemini handoff
- raw-context output
- Windows x64 package
- macOS Apple Silicon package

> **Source code is maintained privately.**

---

## Beta feedback

ContextForge is actively being tested.

Useful reports include:

- incorrect evidence selection
- important evidence being removed
- irrelevant evidence surviving
- numeric constraints being changed or lost
- incorrect provenance
- misleading trust results
- startup failures
- document parsing issues
- interface problems

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

Diagnostic logs are stored inside:

```text
logs/
```

---

## Roadmap

Areas planned for future development include:

- macOS Intel support
- Linux packaging
- broader document support
- additional retrieval strategies
- stronger evidence classification
- expanded trust diagnostics
- improved context optimization
- additional model handoff workflows
- packaging and signing improvements

---

## Project philosophy

ContextForge is built around a simple principle:

> **Compressing context is easy. Preserving the right evidence is the hard part.**

The system is designed to optimize context while keeping the evidence needed to understand, audit, and trust the final handoff.

---

<div align="center">

## ⚡ ContextForge

### Distill the signal. Keep the evidence.

**Compile less. Preserve more. Verify before handoff.**

<br>

[![Windows Download](https://img.shields.io/badge/Download-Windows_x64-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-Windows-x64.zip)

[![macOS Download](https://img.shields.io/badge/Download-macOS_Apple_Silicon-111111?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-macOS-arm64.zip)

<br>

**ContextForge 2.1.0 · Public Beta**

</div>
