<div align="center">

# ⚡ ContextForge

### Distill the signal. Keep the evidence.

**Local-first AI context compiler for evidence-aware, traceable, and token-efficient model handoff.**

[![Release](https://img.shields.io/badge/release-v2.1.0-blue?style=for-the-badge)](https://github.com/Jewel777/ContextForge/releases/tag/v2.1.0)
![Windows](https://img.shields.io/badge/Windows-x64-0078D6?style=for-the-badge&logo=windows)
![Status](https://img.shields.io/badge/status-public%20beta-orange?style=for-the-badge)
![Local First](https://img.shields.io/badge/processing-local--first-success?style=for-the-badge)

<br>

<img src="contextforge-ui.png" alt="ContextForge Interface" width="900">

<br><br>

### ⬇️ Download for Windows

[![Download ContextForge](https://img.shields.io/badge/Download-ContextForge%202.1.0-2563EB?style=for-the-badge&logo=github)](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-Windows-x64.zip)

**Windows x64 · No Python required · No Node.js setup · Local embedding model included**

</div>

---

## 🚀 What is ContextForge?

ContextForge turns large documents and raw text into **compact, task-relevant context** before the information is handed to an AI model.

Instead of blindly sending everything, ContextForge identifies what matters, preserves critical evidence, removes lower-value context, and exposes what survived.

It is designed for workflows where **requirements, numeric constraints, provenance, and traceability matter**.

---

## ✨ Core Capabilities

| | Capability | What it does |
|---|---|---|
| 🧠 | **Semantic + Lexical Retrieval** | Combines semantic similarity with lexical evidence |
| 🗂️ | **Hierarchical Retrieval** | Retrieves evidence across document sections and sentences |
| ✂️ | **Evidence-Aware Compression** | Reduces context while protecting important information |
| 🔢 | **Numeric Preservation** | Protects values such as limits, durations, counts, and thresholds |
| 🛡️ | **Critical Evidence Safeguards** | Preserves mandatory requirements, prohibitions, and controls |
| 🔎 | **Selected / Rejected Evidence** | Shows what was kept and what was excluded |
| 🔗 | **Provenance** | Tracks compiled context back to source evidence |
| 📊 | **Trust & Coverage Checks** | Measures evidence quality and objective coverage |
| 🖥️ | **Local-First Processing** | Core compilation runs on your own computer |
| 🤖 | **Model-Agnostic Output** | Works with ChatGPT, Claude, Gemini, and other models |

---

## ⚡ Quick Start

### 1. Download

Download the Windows package:

**[`ContextForge-2.1.0-Windows-x64.zip`](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-Windows-x64.zip)**

> Do not download GitHub's automatically generated `Source code (zip)` or `Source code (tar.gz)` files.

### 2. Extract

Right-click the ZIP file and choose:

**Extract All...**

### 3. Launch

Open the extracted folder and double-click:

```text
Start-ContextForge.cmd
```

### 4. Use ContextForge

Your browser will open automatically at:

```text
http://127.0.0.1:3000
```

If **Engine offline** appears briefly, wait a few seconds and refresh once.

When ready, the status will show:

```text
🟢 Engine online
```

---

## 🎯 How It Works

```text
Source Material
      │
      ▼
┌──────────────────────┐
│  Retrieval Pipeline  │
│ Semantic + Lexical   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Evidence Evaluation  │
│ Requirements         │
│ Numeric Constraints  │
│ Provenance           │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Context Compilation  │
│ Safe / Balanced /    │
│ Aggressive           │
└──────────┬───────────┘
           │
           ▼
     Model-Ready Context
           │
           ▼
 ChatGPT / Claude / Gemini
```

---

## 🧭 Typical Workflow

### 01 · Add Source

Upload:

- PDF
- DOCX
- TXT

or paste text directly.

### 02 · Define the Objective

Tell ContextForge what information must survive.

Example:

```text
Extract all mandatory authentication and security requirements.
Preserve exact numeric limits and exclude unrelated operational details.
```

### 03 · Compile

Choose your processing mode and context budget.

### 04 · Verify

Inspect:

- compiled context
- selected evidence
- rejected evidence
- provenance
- objective coverage
- trust checks
- retrieval diagnostics

### 05 · Use the Output

Copy the compiled context into:

- ChatGPT
- Claude
- Gemini
- agent workflows
- custom prompt pipelines

---

## 🎚️ Processing Modes

| Mode | Best for |
|---|---|
| 🛡️ **Safe** | Maximum evidence preservation |
| ⚖️ **Balanced** | General-purpose compilation |
| ⚡ **Aggressive** | Stronger context reduction |

---

## 🖥️ Standard vs Advanced

### Standard

Designed for fast, focused use:

- add content
- define objective
- compile
- review output

### Advanced

Adds deeper visibility into:

- retrieval diagnostics
- evidence provenance
- rejected evidence
- trust metrics
- objective coverage
- engineering controls

---

## 🔐 Local-First Architecture

The Windows package includes everything required to run ContextForge:

```text
ContextForge-2.1.0/
│
├── Start-ContextForge.cmd
├── Start-ContextForge.ps1
├── backend/
├── frontend/
├── models/
└── runtime/
```

You do **not** need to install:

- Python
- Node.js
- PyTorch
- sentence-transformers
- the embedding model

Core context compilation runs locally.

---

## 🌐 Local Services

| Service | Address |
|---|---|
| ContextForge UI | `http://127.0.0.1:3000` |
| ContextForge Engine | `http://127.0.0.1:8001` |

These services run only on your local machine.

---

## 🔒 Privacy

ContextForge is designed around local-first processing.

Source documents are processed by the local ContextForge engine.

If you copy the compiled output into an external AI service, that service's own privacy and data-handling policies apply.

---

## 💻 Platform Support

| Platform | Status |
|---|---|
| Windows x64 | ✅ Available |
| macOS Apple Silicon | 🚧 Planned |
| macOS Intel | 🚧 Planned |
| Linux | 🚧 Planned |

---

## ⚠️ Windows Security Notice

ContextForge 2.1.0 is currently a public beta and is not code-signed.

Windows may display a security warning when launching the application.

Only download ContextForge from the official repository:

**https://github.com/Jewel777/ContextForge**

---

## 🧪 Current Release

### ContextForge 2.1.0 — First Public Beta

Includes:

- local-first processing
- PDF, DOCX, TXT, and pasted-text input
- hierarchical retrieval
- semantic and lexical ranking
- evidence-aware compression
- exact numeric constraint preservation
- critical evidence safeguards
- provenance and traceability
- selected/rejected evidence inspection
- trust checks
- objective-coverage analysis
- Safe, Balanced, and Aggressive modes
- Standard and Advanced interfaces
- ChatGPT, Claude, Gemini, and raw-context output

**Source code is maintained privately.**

---

## 🐛 Feedback & Issues

ContextForge is currently in public beta.

Bug reports and reproducible test cases are welcome.

When reporting an issue, please include:

- ContextForge version
- Windows version
- steps to reproduce
- expected result
- actual result
- screenshots or error messages

---

<div align="center">

## ContextForge 2.1.0

### Distill the signal. Keep the evidence.

[Download for Windows](https://github.com/Jewel777/ContextForge/releases/download/v2.1.0/ContextForge-2.1.0-Windows-x64.zip)

</div>
