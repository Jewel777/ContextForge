from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from contextforge.config import (
    APP_VERSION, CACHE_SCHEMA_VERSION, EMBEDDING_MODEL_NAME,
    MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS
)
from contextforge.schemas import OptimizeRequest
from contextforge.services.embeddings import embedding_service
from contextforge.services.extractors import extract_file
from contextforge.services.retrieval import optimize_sentences
from contextforge.services.context_manifest import build_explainability_manifest
from contextforge.services.text_utils import split_sentences

from security import install_security
from workspace_routes import router as workspace_router
from conflict_routes import router as conflict_router
from conflict_analytics_routes import router as conflict_analytics_router
from conflict_anomaly_routes import router as conflict_anomaly_router
from conflict_forecast_routes import router as conflict_forecast_router
from guardrail_policy_routes import router as guardrail_policy_router

app = FastAPI(title="ContextForge Engine", version=APP_VERSION)

security_settings = install_security(app)
app.include_router(workspace_router)
app.include_router(conflict_router)
app.include_router(conflict_analytics_router)
app.include_router(conflict_anomaly_router)
app.include_router(conflict_forecast_router)
app.include_router(guardrail_policy_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def prepare_text(text: str):
    return [{"sentence": s, "page": None, "section": None} for s in split_sentences(text)]

# === ContextForge API explainability manifest ===
def _attach_explainability_manifest(result: dict, task: str) -> dict:
    """
    Attach the explainability manifest at the API boundary.

    Retrieval/ranking/packing are not modified here. The API simply exposes
    explanation metadata for the evidence already selected by ContextForge.
    """
    if not isinstance(result, dict):
        return result

    sources = result.get("sources") or []
    rejected_sources = result.get("rejected_sources") or []
    metrics = result.get("metrics") or []
    processing_stats = result.get("processing_stats") or {}

    if isinstance(metrics, dict):
        strategy = (
            result.get("strategy")
            or metrics.get("retrieval_strategy")
            or metrics.get("strategy")
            or (
                processing_stats.get("retrieval_strategy")
                if isinstance(processing_stats, dict)
                else None
            )
            or "unknown"
        )
    else:
        strategy = (
            result.get("strategy")
            or (
                processing_stats.get("retrieval_strategy")
                if isinstance(processing_stats, dict)
                else None
            )
            or "unknown"
        )

    if "explainability_manifest" not in result:
        manifest_metrics = dict(metrics) if isinstance(metrics, dict) else {}

        final_facet_coverage = result.get("facet_coverage") or {}
        if isinstance(final_facet_coverage, dict):
            covered = int(final_facet_coverage.get("covered") or 0)
            total = int(final_facet_coverage.get("total") or 0)

            if total > 0:
                manifest_metrics["authoritative_facet_coverage"] = covered / total

        result["explainability_manifest"] = build_explainability_manifest(
            task=task,
            selected_evidence=sources,
            rejected_evidence=rejected_sources,
            strategy=strategy,
            metrics=manifest_metrics,
            requested_facets=(
                result.get("retrieval_facets")
                or (result.get("task_contract") or {}).get("include_facets")
                or []
            ),
        )

    return result

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "contextforge-engine",
    }


@app.get("/")
def health():
    return {
        "status":"running",
        "engine":"ContextForge",
        "version":APP_VERSION,
        "retrieval":"hierarchical_section_aware",
        "embedding_model":EMBEDDING_MODEL_NAME,
        "embedding_cache":"persistent_sqlite_v3",
        "cache_schema":CACHE_SCHEMA_VERSION,
        "embedding_cache_items":embedding_service.cache_size(),
        "supported_files":sorted(SUPPORTED_EXTENSIONS),
    }

@app.post("/optimize-text")
@app.post("/optimize")
def optimize_text(req: OptimizeRequest):
    try:
        return _attach_explainability_manifest(optimize_sentences(prepare_text(req.text), req.task, req.mode, req.token_budget), req.task)
    except ValueError as e:
        raise HTTPException(400, str(e))

@app.post("/optimize-file")
async def optimize_file(
    file: UploadFile = File(...),
    task: str = Form(...),
    mode: str = Form("balanced"),
    token_budget: int = Form(1000),
):
    data = await file.read()
    if not data:
        raise HTTPException(400, "Uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is too large. Maximum size is 25 MB.")
    items, metadata = extract_file(file.filename or "", data)
    try:
        result = optimize_sentences(items, task, mode, token_budget)
    except ValueError as e:
        raise HTTPException(400, str(e))
    result["filename"] = file.filename or ""
    result.update(metadata)
    return _attach_explainability_manifest(result, task)

@app.delete("/cache")
def clear_cache():
    return {"status":"cleared","deleted":embedding_service.clear_cache()}
