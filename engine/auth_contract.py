from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    id: str
    display_name: str


class AuthenticationUnavailable(RuntimeError):
    pass


def resolve_principal(headers: Mapping[str, str]) -> AuthenticatedPrincipal:
    mode = os.getenv(
        "CONTEXTFORGE_AUTH_MODE",
        "disabled",
    ).strip().lower()

    if mode == "disabled":
        raise AuthenticationUnavailable(
            "Server-side authenticated persistence is unavailable because "
            "CONTEXTFORGE_AUTH_MODE=disabled."
        )

    if mode != "trusted_header":
        raise AuthenticationUnavailable(
            f"Unsupported CONTEXTFORGE_AUTH_MODE={mode!r}."
        )

    principal_id = headers.get(
        "x-contextforge-principal-id",
        "",
    ).strip()
    display_name = headers.get(
        "x-contextforge-principal-name",
        principal_id,
    ).strip()

    if not principal_id:
        raise AuthenticationUnavailable(
            "Trusted identity header is missing."
        )

    if len(principal_id) > 160:
        raise AuthenticationUnavailable(
            "Trusted identity header is invalid."
        )

    return AuthenticatedPrincipal(
        id=principal_id,
        display_name=display_name or principal_id,
    )


def validate_auth_configuration() -> list[str]:
    environment = os.getenv(
        "CONTEXTFORGE_ENV",
        "development",
    ).strip().lower()

    mode = os.getenv(
        "CONTEXTFORGE_AUTH_MODE",
        "disabled",
    ).strip().lower()

    persistence_enabled = os.getenv(
        "CONTEXTFORGE_SERVER_PERSISTENCE_ENABLED",
        "false",
    ).strip().lower() in {"1", "true", "yes", "on"}

    errors: list[str] = []

    if persistence_enabled and mode == "disabled":
        errors.append(
            "Server persistence cannot be enabled while authentication "
            "mode is disabled."
        )

    if environment == "production" and mode == "trusted_header":
        trusted_proxy = os.getenv(
            "CONTEXTFORGE_AUTH_TRUST_PROXY",
            "",
        ).strip()

        if not trusted_proxy:
            errors.append(
                "Production trusted_header auth requires "
                "CONTEXTFORGE_AUTH_TRUST_PROXY."
            )

    return errors
