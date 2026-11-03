# ContextForge

**ContextForge** is a local-first AI context compiler that turns documents and pasted text into compact, task-relevant context for use with AI models.

It is designed to preserve important requirements, numeric constraints, and evidence provenance while reducing unnecessary context.

## What ContextForge Does

ContextForge helps you:

- Upload PDF, DOCX, and TXT files
- Paste raw text directly
- Define what information you want to preserve
- Retrieve relevant evidence using semantic and lexical ranking
- Compress large source material into smaller context
- Preserve important numeric limits and requirements
- Inspect selected and rejected evidence
- Review provenance and traceability
- Check trust and objective coverage
- Export context for ChatGPT, Claude, Gemini, or other models

## Current Release

**ContextForge 2.1.0 — First Public Beta**

This release is currently available for **Windows x64**.

The source code is maintained privately.

---

# Download ContextForge

Go to the **Releases** section of this repository.

Download:

`ContextForge-2.1.0-Windows-x64.zip`

Do not download the automatically generated GitHub **Source code (zip)** or **Source code (tar.gz)** files.

Those are repository archives and are not the ContextForge Windows application.

---

# Windows Installation

## 1. Download

Download:

`ContextForge-2.1.0-Windows-x64.zip`

from the latest GitHub Release.

## 2. Extract the ZIP

Right-click the downloaded ZIP file and choose:

**Extract All...**

Open the extracted folder.

You should see:

```text
Start-ContextForge.cmd
Start-ContextForge.ps1
backend/
frontend/
models/
runtime/
```

## 3. Start ContextForge

Double-click:

`Start-ContextForge.cmd`

Use the `.cmd` file for normal startup.

You do not need to manually open `Start-ContextForge.ps1`.

## 4. Wait for Startup

ContextForge starts two local services:

- Web interface: `http://127.0.0.1:3000`
- Local engine: `http://127.0.0.1:8001`

Your browser should open automatically.

The first startup may take several seconds while the local embedding model loads.

If the page initially shows **Engine offline**, wait a few seconds and refresh the page once.

When everything is ready, the top-right status should show:

**Engine online**

---

# How to Use ContextForge

Once ContextForge opens:

### 1. Add source material

Upload a:

- PDF
- DOCX
- TXT

or choose **Paste** to enter text directly.

### 2. Define your objective

Tell ContextForge what information must survive the compilation.

For example:

```text
Extract all mandatory authentication and security requirements.
Preserve exact numeric limits and exclude unrelated operational details.
```

### 3. Compile

Choose the appropriate mode and context budget, then run the compilation.

### 4. Review the result

ContextForge lets you inspect:

- Compiled context
- Selected evidence
- Rejected evidence
- Evidence provenance
- Retrieval diagnostics
- Trust checks
- Objective coverage

### 5. Use the output

Copy the compiled context into:

- ChatGPT
- Claude
- Gemini
- another AI model
- your own prompt or workflow

---

# Processing Modes

ContextForge includes three processing modes:

- **Safe** — prioritizes preservation of potentially important evidence
- **Balanced** — balances compression and evidence retention
- **Aggressive** — prioritizes stronger context reduction

The interface also provides:

- **Standard mode** for simpler workflows
- **Advanced mode** for deeper inspection and governance controls

---

# Local-First

ContextForge is designed to run locally on your computer.

The Windows package includes:

- the ContextForge backend
- the web interface
- a bundled Node.js runtime
- the local embedding model

You do **not** need to separately install:

- Python
- Node.js
- sentence-transformers
- the embedding model

No paid AI model is required to compile context locally.

---

# Windows Security Notice

Because this public beta is not currently code-signed, Windows may display a security warning when launching the application.

If Windows shows a warning, verify that you downloaded ContextForge from the official GitHub Release for this repository.

---

# System Support

Current public build:

**Windows x64**

macOS and other platform builds are not included in the current 2.1.0 release.

---

# Highlights

- Local-first processing
- PDF, DOCX, TXT, and pasted-text input
- Hierarchical retrieval
- Semantic and lexical ranking
- Evidence-aware compression
- Exact numeric constraint preservation
- Critical requirement safeguards
- Provenance and traceability
- Trust and objective-coverage checks
- Selected/rejected evidence inspection
- Safe, Balanced, and Aggressive modes
- Standard and Advanced interfaces
- ChatGPT, Claude, Gemini, and raw-context output

---

# Status

ContextForge is currently in **public beta**.

Feedback, bug reports, and reproducible test cases are welcome.

## Version

**ContextForge 2.1.0**
