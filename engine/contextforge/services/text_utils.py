import re

STOP_TERMS = {
    "this", "that", "with", "from", "into", "what", "should", "find", "show", "give",
    "about", "rules", "rule", "content", "information", "details", "please", "using",
    "used", "have", "will", "would", "could", "there", "their", "these", "those", "which",
    "when", "where", "also", "extract", "summarize"
}

EXPANSIONS = {
    "login": {"login", "signin", "authentication", "failed", "locked", "lockout"},
    "authentication": {"authentication", "login", "jwt", "token", "credential", "mfa"},
    "security": {"security", "locked", "lockout", "password", "credential", "mfa", "failed"},
    "token": {"token", "tokens", "jwt", "access", "refresh", "expire", "expires", "expiration"},
    "expiration": {"expiration", "expiry", "expire", "expires", "timeout", "minutes", "hours", "days"},
    "database": {"database", "db", "sql", "query", "schema", "table", "connection"},
    "error": {"error", "errors", "exception", "failure", "failed", "warning"},
    "research": {"study", "paper", "results", "method", "dataset", "findings"},
}


def normalize_space(text: str) -> str:
    return " ".join(text.split())


def split_sentences(text: str) -> list[str]:
    text = normalize_space(text)
    if not text:
        return []

    return [
        x.strip()
        for x in re.split(r"(?<=[.!?])\s+", text)
        if x.strip()
    ]


def dedupe_sentence_items(items: list[dict]) -> list[dict]:
    seen, out = set(), []

    for item in items:
        key = re.sub(r"\s+", " ", item["sentence"].lower()).strip()

        if key and key not in seen:
            seen.add(key)
            out.append(item)

    return out


def is_meta_sentence(sentence: str) -> bool:
    t = sentence.lower()

    return any(
        p in t
        for p in (
            "suggested contextforge task",
            "suggested task",
            "example task",
            "example prompt",
            "contextforge task",
            "what should ai do",
            "prompt:",
            "task:",
            "instructions:",
            "instruction:",
        )
    )


def validate_mode(mode: str) -> str:
    mode = mode.lower().strip()
    return mode if mode in {"safe", "balanced", "aggressive"} else "balanced"


def mode_multiplier(mode: str) -> float:
    return {
        "safe": 0.36,
        "balanced": 0.50,
        "aggressive": 0.62,
    }[validate_mode(mode)]


def terms(text: str) -> set[str]:
    return {
        t
        for t in re.findall(r"[a-zA-Z0-9-]+", text.lower())
        if len(t) >= 3 and t not in STOP_TERMS
    }


def expanded_task_terms(task: str) -> set[str]:
    base = terms(task)
    out = set(base)

    for t in base:
        out.update(EXPANSIONS.get(t, set()))

    return out


def importance_bonus(sentence: str) -> float:
    t = sentence.lower()
    bonus = 0.0

    if re.search(r"\d", sentence):
        bonus += 0.07

    if any(
        x in t
        for x in (
            "must",
            "shall",
            "required",
            "requires",
            "cannot",
            "never",
            "minimum",
            "maximum",
            "limit",
        )
    ):
        bonus += 0.08

    if re.search(
        r"\b(?:minute|minutes|hour|hours|day|days|expire|expires|expiration|timeout)\b",
        t,
    ):
        bonus += 0.07

    if any(
        x in t
        for x in (
            "authentication",
            "jwt",
            "token",
            "password",
            "login",
            "security",
            "mfa",
            "locked",
            "lockout",
            "failed",
        )
    ):
        bonus += 0.09

    if any(
        x in t
        for x in (
            "error",
            "exception",
            "failure",
            "warning",
            "critical",
        )
    ):
        bonus += 0.05

    return bonus
