from contextforge.services.retrieval import optimize_sentences
from contextforge.services.text_utils import split_sentences

def make_items(text):
    return [{"sentence": s, "page": None, "section": None} for s in split_sentences(text)]

CASES = [
    {
        "name":"security",
        "text":"The cafeteria serves lunch at noon. Authentication requires JWT tokens. Access tokens expire after 15 minutes. Employees receive parking permits. After five failed login attempts, the account is locked for 20 minutes. Password reset requires identity verification. MFA is required for administrator accounts.",
        "task":"Extract authentication, token expiration, login security, password reset, and MFA rules.",
        "must":["Authentication requires JWT tokens.","Access tokens expire after 15 minutes.","After five failed login attempts","Password reset requires identity verification.","MFA is required for administrator accounts."],
        "exclude":["cafeteria","parking permits"],
        "budget":120,
    },
    {
        "name":"database",
        "text":"The team orders pizza on Fridays. The database pool is limited to 30 connections. Queries exceeding 5 seconds are logged as slow queries. Failed database connections retry three times before raising an error. Backups run every night at 2 AM.",
        "task":"Extract database limits, slow query rules, retries, and backup timing.",
        "must":["30 connections","5 seconds","retry three times","2 AM"],
        "exclude":["pizza"],
        "budget":110,
    },
    {
        "name":"research",
        "text":"The authors thank their colleagues. The primary detector uses a rolling median absolute deviation window of six. The threshold multiplier is 2.5. The strongest poisoning condition produced 16 alert-set changes. The clean baseline contained 537 alerts.",
        "task":"Extract detector settings and strongest attack result.",
        "must":["window of six","2.5","16 alert-set changes"],
        "exclude":["thank their colleagues"],
        "budget":100,
    },
]

def run(case):
    result = optimize_sentences(make_items(case["text"]), case["task"], "balanced", case["budget"])
    out = result["optimized_text"].lower()
    missing = [x for x in case["must"] if x.lower() not in out]
    unwanted = [x for x in case["exclude"] if x.lower() in out]
    ok = not missing and not unwanted
    print(f'[{case["name"]}] {"PASS" if ok else "FAIL"} | reduction={result["reduction_percent"]}% | confidence={result["retrieval_confidence"]}')
    if missing: print(" missing:", missing)
    if unwanted: print(" unwanted:", unwanted)
    return ok

if __name__ == "__main__":
    results = [run(c) for c in CASES]
    if not all(results):
        raise SystemExit(1)
    print(f"All {len(CASES)} retrieval checks passed.")
