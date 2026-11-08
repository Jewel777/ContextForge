from __future__ import annotations

import importlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"


def run_child(db_path: Path) -> tuple[int, str]:
    child = r"""
import json
import os
import sqlite3
import sys
from pathlib import Path

root = Path(os.environ["CONTEXTFORGE_TEST_ROOT"])
engine = root / "engine"
sys.path.insert(0, str(engine))

results = {
    "main_import": False,
    "health_callable": False,
    "persistence_enabled": False,
    "trusted_header_mode": False,
    "db_created": False,
    "tables": [],
    "errors": [],
}

try:
    main = __import__("main")
    results["main_import"] = True
except Exception as exc:
    results["errors"].append(f"main import failed: {type(exc).__name__}: {exc}")
    print(json.dumps(results))
    raise SystemExit(1)

try:
    persistence = __import__("persistence")
    settings = persistence.PersistenceSettings.from_env()
    results["persistence_enabled"] = bool(settings.enabled)
except Exception as exc:
    settings = None
    results["errors"].append(
        f"persistence settings inspection failed: {type(exc).__name__}: {exc}"
    )

try:
    auth_contract = __import__("auth_contract")
    mode = os.environ.get("CONTEXTFORGE_AUTH_MODE", "")
    results["trusted_header_mode"] = mode == "trusted_header"
except Exception as exc:
    results["errors"].append(f"auth import failed: {type(exc).__name__}: {exc}")

try:
    routes = []
    for route in getattr(main.app, "routes", []):
        path = getattr(route, "path", None)
        if path:
            routes.append(path)
    results["health_callable"] = "/health" in routes
except Exception as exc:
    results["errors"].append(f"route inspection failed: {type(exc).__name__}: {exc}")

db_path = Path(os.environ["CONTEXTFORGE_SERVER_PERSISTENCE_DB"])
results["db_created"] = db_path.exists()

if db_path.exists():
    try:
        with sqlite3.connect(db_path) as connection:
            rows = connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            ).fetchall()
        results["tables"] = [row[0] for row in rows]
    except Exception as exc:
        results["errors"].append(
            f"sqlite inspection failed: {type(exc).__name__}: {exc}"
        )

required_tables = {
    "principals",
    "workspaces",
    "workspace_kv",
    "workspace_audit",
}
missing_tables = sorted(required_tables.difference(results["tables"]))
if missing_tables:
    results["errors"].append(
        "missing core persistence tables: " + ", ".join(missing_tables)
    )

# Newer operational tables are required by the current runtime milestone.
operational_candidates = {
    "guardrail_policy_override",
}
missing_operational = sorted(
    operational_candidates.difference(results["tables"])
)
if missing_operational:
    results["errors"].append(
        "missing operational persistence tables: "
        + ", ".join(missing_operational)
    )

ok = (
    results["main_import"]
    and results["health_callable"]
    and results["persistence_enabled"]
    and results["trusted_header_mode"]
    and results["db_created"]
    and not results["errors"]
)

print(json.dumps(results))
raise SystemExit(0 if ok else 1)
"""

    env = os.environ.copy()
    env.update(
        {
            "CONTEXTFORGE_TEST_ROOT": str(ROOT),
            "CONTEXTFORGE_AUTH_MODE": "trusted_header",
            "CONTEXTFORGE_AUTH_TRUST_PROXY": "true",
            "CONTEXTFORGE_SERVER_PERSISTENCE_ENABLED": "true",
            "CONTEXTFORGE_SERVER_PERSISTENCE_DB": str(db_path),
            "PYTHONPATH": str(ENGINE),
        }
    )

    try:
        completed = subprocess.run(
            [sys.executable, "-c", child],
            cwd=str(ENGINE),
            env=env,
            text=True,
            capture_output=True,
            timeout=180,
        )
    except subprocess.TimeoutExpired as exc:
        partial_stdout = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        partial_stderr = exc.stderr.decode() if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        output = "\n".join(
            part.strip()
            for part in [partial_stdout, partial_stderr]
            if part and part.strip()
        )
        output += (
            "\nRuntime child exceeded 180 seconds while importing the real engine "
            "with persistence enabled."
        )
        return 124, output

    output = "\n".join(
        part.strip()
        for part in [completed.stdout, completed.stderr]
        if part.strip()
    )
    return completed.returncode, output


def parse_last_json(output: str) -> dict:
    for line in reversed(output.splitlines()):
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    return {}


def main() -> int:
    print("=" * 72)
    print("ContextForge enabled-persistence runtime integration")
    print("=" * 72)

    with tempfile.TemporaryDirectory(prefix="contextforge-runtime-") as temp_dir:
        db_path = Path(temp_dir) / "contextforge-integration.db"
        code, output = run_child(db_path)
        result = parse_last_json(output)

        if output:
            non_json = [
                line
                for line in output.splitlines()
                if not line.strip().startswith("{")
            ]
            if non_json:
                print("\nRuntime output")
                for line in non_json[-20:]:
                    print(f"  {line}")

        checks = [
            ("Engine imports with persistence enabled", result.get("main_import") is True),
            ("Trusted-header auth mode active", result.get("trusted_header_mode") is True),
            ("Persistence reports enabled", result.get("persistence_enabled") is True),
            ("Health route registered", result.get("health_callable") is True),
            ("Temporary SQLite database created", result.get("db_created") is True),
            (
                "Core persistence schema created",
                {"principals", "workspaces", "workspace_kv", "workspace_audit"}
                .issubset(set(result.get("tables", []))),
            ),
            (
                "Guardrail override schema created",
                "guardrail_policy_override" in set(result.get("tables", [])),
            ),
        ]

        print()
        failed = False
        for label, passed in checks:
            print(f"[{'PASS' if passed else 'FAIL'}] {label}")
            failed = failed or not passed

        errors = result.get("errors", [])
        if errors:
            print("\nErrors")
            for error in errors:
                print(f"  - {error}")
            failed = True

        if code != 0:
            failed = True

        print("\nTemporary DB:", db_path)
        print("Production/user data touched: NO")
        print("\nRESULT:", "FAIL" if failed else "PASS")
        return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
