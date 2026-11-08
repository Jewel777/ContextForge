# ContextForge Deployment Guide

ContextForge is a two-service application:

- `web/` — Next.js frontend and same-origin API routes
- `engine/` — Python/FastAPI retrieval and context compiler

The recommended public deployment keeps the Python engine private and exposes
only the Next.js service to the internet.

## 1. Production environment

Create the production environment file:

```powershell
Copy-Item .env.production.example .env.production
```

Edit `.env.production` and set:

- `NEXT_PUBLIC_CONTEXTFORGE_URL` to the public HTTPS URL
- `CONTEXTFORGE_ALLOWED_ORIGINS` to the exact public web origin
- `CONTEXTFORGE_API_URL=http://engine:8001` for Docker Compose
- `HF_TOKEN` if higher Hugging Face download/rate limits are desired

Never commit `.env.production`.

Validate configuration:

```powershell
.\engine\.venv\Scripts\python.exe .\tools\validate_production_env.py
```

## 2. Preflight validation

Run the full deployment preflight:

```powershell
.\tools\run_deployment_preflight.ps1
```

This validates the production environment and performs a Next.js production
build before deployment.

The existing release gate remains the quality/retrieval regression gate:

```powershell
.\tools\run_release_gate.ps1
```

Both should pass before a release.

## 3. Docker Compose deployment

Build and start:

```powershell
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

Inspect status:

```powershell
docker compose -f docker-compose.production.yml ps
```

Follow logs:

```powershell
docker compose -f docker-compose.production.yml logs -f
```

The public web service defaults to port `3000`. The Python engine is not
published to the host; it is reachable only by the web service over the
Compose network.

## 4. Health and smoke tests

Frontend health:

```text
GET /api/health
```

End-to-end production smoke test:

```powershell
.\engine\.venv\Scripts\python.exe .\tools\smoke_test_production.py --web https://your-domain.example
```

The smoke test verifies both the public health route and a real context
compilation request.

## 5. Reverse proxy and TLS

For a public beta, terminate TLS in front of the Next.js service using the
hosting platform, load balancer, Caddy, Nginx, Cloudflare, or equivalent.

Requirements:

- HTTPS only
- redirect HTTP to HTTPS
- do not expose the Python engine directly
- preserve `X-Forwarded-*` headers
- set the public origin exactly in `CONTEXTFORGE_ALLOWED_ORIGINS`

## 6. Release checklist

Before each public deployment:

1. `git status` is clean.
2. `tools/run_release_gate.ps1` passes.
3. `tools/run_deployment_preflight.ps1` passes.
4. `.env.production` contains no example domain.
5. public origin uses HTTPS.
6. the Python engine is not directly internet-exposed.
7. deploy both services.
8. wait for health checks to become healthy.
9. run `tools/smoke_test_production.py` against the public URL.
10. verify Standard and Advanced modes in the browser.

## 7. Rollback

Deployments should be tied to a Git commit. If a release fails:

1. identify the last known-good commit,
2. redeploy that commit,
3. rerun the production smoke test,
4. preserve the failed release logs for diagnosis.

The current compiler regression benchmark remains the authoritative guard
against silent evidence-selection degradation.


## Production security validation

Run `tools/validate_security_posture.py` before deployment and `tools/security_smoke_test.py` after deployment. See `SECURITY.md` for origin, request-size, proxy-trust, rate-limit, and edge requirements.
