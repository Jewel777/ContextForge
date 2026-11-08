# ContextForge 2.1.2

**ContextForge** is a local-first AI context compiler that retrieves, compresses, and preserves task-relevant evidence before model handoff.

It is designed for workflows where **traceability, numeric preservation, hard requirements, provenance, and token efficiency** matter.

![ContextForge UI](docs/contextforge-ui.png)

## Why ContextForge?

Long source documents often contain a small amount of information that actually matters to a task.

ContextForge reduces that context while preserving the evidence that should not be lost.

Instead of treating compression as a black box, ContextForge exposes:

- what was selected
- what was rejected
- why evidence was retained or removed
- which requirements were preserved
- where retained evidence came from
- how much context was reduced

The result is compact, traceable, model-ready context for downstream AI systems.

## What ContextForge does

ContextForge can ingest:

- PDF
- DOCX
- TXT
- pasted text

It then:

- retrieves task-relevant evidence
- ranks semantic and lexical relevance
- suppresses noise and near-duplicates
- preserves exact numeric constraints
- preserves hard requirements and prohibitions
- tracks source provenance
- protects critical evidence
- checks objective and facet coverage
- compresses context under a strict token budget
- exposes selected and rejected evidence
- produces model-ready output

Supported output targets include:

- ChatGPT
- Claude
- Gemini
- raw context

## Core features

### Evidence-aware retrieval

ContextForge combines hierarchical and sentence-level retrieval to identify evidence relevant to the requested task.

Key capabilities include:

- section-to-sentence retrieval
- semantic ranking
- lexical relevance
- critical-evidence detection
- hard-evidence rescue
- objective-aware coverage

### Constraint preservation

ContextForge is designed to preserve information that conventional summarization can easily lose.

This includes:

- exact numbers
- thresholds
- deadlines
- quantities
- structured constraints
- mandatory requirements
- prohibitions
- security rules
- policy conditions

### Context compression

Three compilation modes are available:

**Safe**  
Preserves more supporting context.

**Balanced**  
Default mode for most workflows.

**Aggressive**  
Prioritizes maximum context reduction while preserving required evidence.

A configurable token ceiling controls final context size.

## Trust and explainability

ContextForge exposes evidence-level diagnostics instead of treating context compilation as a black box.

Trust checks include:

- critical evidence preservation
- numeric preservation
- provenance coverage
- objective coverage
- hard-evidence completeness

Each compile may expose:

- selected evidence
- rejected evidence
- rejection reasons
- evidence type
- matched facets
- structured constraints
- semantic role
- source page
- source section
- provenance trace

## Context Manifest

ContextForge generates a structured evidence manifest that can be used to inspect how the final context was assembled.

The manifest can include:

- retrieval strategy
- selected evidence
- rejected evidence
- covered facets
- evidence types
- pages used
- structured constraints
- trust metrics
- provenance metadata

Manifest data can also be exported for auditing and downstream workflows.

## Standard and Advanced interfaces

### Standard

The Standard interface focuses on the core workflow:

1. Add source material
2. Define the retrieval objective
3. Select a compression strategy
4. Compile
5. Review the retained context

### Advanced

Advanced mode exposes additional engineering and governance tooling, including:

- evidence diagnostics
- trust evaluation
- policy controls
- regression baselines
- conflict analysis
- audit history
- workspace state
- persistence controls
- operational diagnostics

## Local-first architecture

ContextForge is designed to operate without requiring a paid language model for retrieval and context compilation.

Core processing runs through the local Python engine.

The architecture includes:

```text
Source material
      |
      v
Document parsing
      |
      v
Hierarchical retrieval
      |
      v
Evidence ranking
      |
      v
Constraint preservation
      |
      v
Coverage validation
      |
      v
Context packing
      |
      v
Explainability manifest
      |
      v
Model-ready context
```

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

### Deployment

- Docker
- Docker Compose
- Uvicorn
- production health checks
- configurable origin policy
- request-size protection
- optional authentication and persistence foundation

## Quick start

### Windows launcher

Double-click:

```text
Start-ContextForge.cmd
```

To stop ContextForge:

```text
Stop-ContextForge.cmd
```

## Manual development setup

### Backend

```powershell
cd engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

### Frontend

```powershell
cd web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Production build

### Frontend

```powershell
cd web
npm run build
```

### Production Docker stack

From the repository root:

```powershell
docker compose --env-file .env.production -f docker-compose.production.yml up --build -d
```

Check service status:

```powershell
docker compose -f docker-compose.production.yml ps
```

## Health check

```powershell
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
```

A healthy deployment should return:

```text
200 OK
```

## Release validation

ContextForge includes a release gate for retrieval quality and production readiness.

Run:

```powershell
.\tools\run_release_gate.ps1
```

The release gate validates:

- original retrieval regression tests
- extended retrieval regression tests
- production benchmark
- frontend production build
- working-tree cleanliness
- critical fact recall
- numeric recall
- distractor rejection
- provenance accuracy
- facet coverage
- context reduction

## Production security validation

Before deployment:

```powershell
.\engine\.venv\Scripts\python.exe .\tools\validate_security_posture.py
```

After deployment:

```powershell
.\engine\.venv\Scripts\python.exe .\tools\security_smoke_test.py --web https://your-domain.example
.\engine\.venv\Scripts\python.exe .\tools\smoke_test_production.py --web https://your-domain.example
```

## Public deployment requirements

The public edge should provide:

- HTTPS termination
- HTTP-to-HTTPS redirect
- shared or distributed rate limiting
- request body-size limits
- DDoS and basic bot protection
- public exposure of only the Next.js web service
- private access to the Python engine

Authentication and account-level authorization are separate deployment capabilities.

## Repository structure

```text
ContextForge/
├── engine/
│   ├── contextforge/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── web/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── Dockerfile
├── tools/
├── docs/
├── docker-compose.production.yml
├── README.md
├── SECURITY.md
├── DEPLOYMENT.md
└── CHANGELOG.md
```

## Current release

**v2.1.2**

This release includes:

- production container database permission fixes
- validated retrieval regression coverage
- production benchmark verification
- frontend production build verification
- Docker deployment validation
- GitHub release publication

## License

See [LICENSE](LICENSE).

## Citation

If you use ContextForge in academic or research work, see:

```text
CITATION.cff
```

## Project status

ContextForge is under active development.

The current release focuses on:

- reliable evidence preservation
- traceable compression
- local-first retrieval
- production deployment readiness
- trust and explainability
