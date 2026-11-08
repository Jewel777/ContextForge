# ContextForge Production Security

ContextForge includes application-level production hardening for the public beta.

Implemented controls:

- exact production Origin enforcement
- request-size limits for declared and streamed bodies
- request IDs on engine responses
- browser security headers and CSP
- optional sliding-window engine rate limiting
- restricted forwarded-header trust
- security posture validation
- public security-header smoke testing

## Environment controls

```text
CONTEXTFORGE_MAX_REQUEST_BYTES=20971520
CONTEXTFORGE_RATE_LIMIT_ENABLED=false
CONTEXTFORGE_RATE_LIMIT_REQUESTS=600
CONTEXTFORGE_RATE_LIMIT_WINDOW_SECONDS=60
CONTEXTFORGE_FORWARDED_ALLOW_IPS=127.0.0.1,::1
```

The built-in rate limiter is process-local. For a multi-worker or horizontally
scaled public deployment, use shared edge/load-balancer rate limiting.

Never set `CONTEXTFORGE_FORWARDED_ALLOW_IPS=*` in production.

## Validation

```powershell
.\engine\.venv\Scripts\python.exe .\tools\validate_security_posture.py
.\tools\run_deployment_preflight.ps1
```

After deployment:

```powershell
.\engine\.venv\Scripts\python.exe .\tools\security_smoke_test.py --web https://your-domain.example
.\engine\.venv\Scripts\python.exe .\tools\smoke_test_production.py --web https://your-domain.example
```

## Public beta edge requirements

The public edge should also provide:

- HTTPS termination
- HTTP to HTTPS redirect
- shared/distributed rate limiting
- request body-size limits
- DDoS/basic bot protection
- only the Next.js web service exposed publicly
- the Python engine kept private

Authentication and account-level authorization are separate milestones. This
security layer hardens the unauthenticated public-beta application boundary.
