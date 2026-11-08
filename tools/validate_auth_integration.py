from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


def main() -> int:
    errors: list[str] = []

    required_files = {
        "NextAuth v4 config": WEB / "auth.ts",
        "Auth route": WEB / "app" / "api" / "auth" / "[...nextauth]" / "route.ts",
        "API auth helper": WEB / "lib" / "require-auth.ts",
        "Auth status": WEB / "components" / "AuthStatus.tsx",
        "Session provider": WEB / "components" / "AuthSessionProvider.tsx",
        "Identity bridge": WEB / "components" / "AuthIdentityBridge.tsx",
        "Workspace layer": WEB / "lib" / "contextforge-workspace.ts",
    }

    for label, path in required_files.items():
        if not path.exists():
            errors.append(f"{label} missing: {path}")

    package = WEB / "package.json"
    if package.exists():
        data = json.loads(package.read_text(encoding="utf-8"))
        version = {
            **data.get("dependencies", {}),
            **data.get("devDependencies", {}),
        }.get("next-auth")
        if not version:
            errors.append("next-auth is not installed.")

    auth_file = WEB / "auth.ts"
    if auth_file.exists():
        text = auth_file.read_text(encoding="utf-8")
        for token in [
            "NextAuthOptions",
            "GithubProvider",
            "strategy: \"jwt\"",
            "session.user.id",
        ]:
            if token not in text:
                errors.append(
                    f"NextAuth v4 config missing expected feature: {token}"
                )

    route = WEB / "app" / "api" / "auth" / "[...nextauth]" / "route.ts"
    if route.exists():
        text = route.read_text(encoding="utf-8")
        if "NextAuth(authOptions)" not in text:
            errors.append(
                "Auth route is not using the NextAuth v4 App Router handler."
            )

    helper = WEB / "lib" / "require-auth.ts"
    if helper.exists():
        text = helper.read_text(encoding="utf-8")
        if "getServerSession(authOptions)" not in text:
            errors.append(
                "API auth helper is not using NextAuth v4 getServerSession."
            )

    layout = WEB / "app" / "layout.tsx"
    if layout.exists():
        text = layout.read_text(encoding="utf-8")
        if "AuthSessionProvider" not in text:
            errors.append("Root layout does not render AuthSessionProvider.")
        if "<AuthStatus />" not in text:
            errors.append("Root layout does not render AuthStatus.")

    for path in [
        WEB / "app" / "api" / "optimize-text" / "route.ts",
        WEB / "app" / "api" / "optimize-file" / "route.ts",
    ]:
        if path.exists() and "requireApiSession" not in path.read_text(encoding="utf-8"):
            errors.append(
                f"{path.relative_to(ROOT)} does not enforce the auth gate."
            )

    workspace = WEB / "lib" / "contextforge-workspace.ts"
    if workspace.exists():
        text = workspace.read_text(encoding="utf-8")
        if "adoptAuthenticatedPrincipal" not in text:
            errors.append(
                "Workspace layer does not adopt authenticated principals."
            )

    print("=" * 72)
    print("ContextForge real-auth integration validation")
    print("=" * 72)

    if errors:
        print("\nERRORS")
        for error in errors:
            print(f"  - {error}")
        print("\nRESULT: FAIL")
        return 1

    print("\nRESULT: PASS")
    print("NextAuth v4 integration: present")
    print("GitHub OAuth provider: present")
    print("JWT session handling: present")
    print("Protected compile API routes: present")
    print("Browser identity bridge: present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
