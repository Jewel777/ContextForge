from __future__ import annotations

from contextforge.services.retrieval import optimize_sentences
from contextforge.services.text_utils import split_sentences


def make_items_from_sections(sections):
    items = []
    page = 1

    for section_name, text in sections:
        for sentence in split_sentences(text):
            items.append(
                {
                    "sentence": sentence,
                    "page": page,
                    "section": section_name,
                }
            )
        page += 1

    return items


CASES = [
    {
        "name": "security_long",
        "mode": "balanced",
        "budget": 180,
        "sections": [
            (
                "Office Information",
                "The cafeteria opens at 7 AM. Visitor parking is available behind the building. "
                "Employees can reserve conference rooms through the intranet."
            ),
            (
                "Authentication",
                "Authentication requires JWT access tokens. Access tokens expire after 15 minutes. "
                "Refresh tokens expire after seven days. MFA is required for administrator accounts. "
                "Password reset requires identity verification."
            ),
            (
                "Login Protection",
                "After five failed login attempts, the account is locked for 20 minutes. "
                "Security events are written to the audit log. Dormant accounts are reviewed quarterly."
            ),
            (
                "General Operations",
                "The office orders lunch on Fridays. The facilities team replaces air filters every month."
            ),
        ],
        "task": "Extract authentication, token expiration, MFA, password reset, and failed-login lockout requirements.",
        "must": [
            "Authentication requires JWT access tokens.",
            "Access tokens expire after 15 minutes.",
            "MFA is required for administrator accounts.",
            "Password reset requires identity verification.",
            "After five failed login attempts",
        ],
        "exclude": [
            "cafeteria",
            "visitor parking",
            "orders lunch",
            "air filters",
        ],
        "target_reduction": 20.0,
    },
    {
        "name": "database_operations",
        "mode": "balanced",
        "budget": 170,
        "sections": [
            (
                "Team Notes",
                "The team orders pizza on Fridays. The office coffee machine was replaced last month."
            ),
            (
                "Database Runtime",
                "The database pool is limited to 30 connections. Queries exceeding 5 seconds are logged as slow queries. "
                "Failed database connections retry three times before raising an error."
            ),
            (
                "Backup Policy",
                "Backups run every night at 2 AM. Backup retention is 30 days. "
                "A restore test is performed on the first Monday of each month."
            ),
            (
                "Unrelated Service",
                "The marketing dashboard refreshes every 45 minutes. Design assets are archived yearly."
            ),
        ],
        "task": "Extract database connection limits, slow-query threshold, retry behavior, backup timing, and retention.",
        "must": [
            "30 connections",
            "5 seconds",
            "retry three times",
            "2 AM",
            "30 days",
        ],
        "exclude": [
            "pizza",
            "coffee machine",
            "marketing dashboard",
            "design assets",
        ],
        "target_reduction": 20.0,
    },
    {
        "name": "research_results",
        "mode": "balanced",
        "budget": 170,
        "sections": [
            (
                "Acknowledgements",
                "The authors thank their colleagues. Funding support was provided by the departmental research office."
            ),
            (
                "Methods",
                "The primary detector uses a rolling median absolute deviation window of six. "
                "The threshold multiplier is 2.5. Bounded-influence preprocessing is applied before alert generation."
            ),
            (
                "Results",
                "The clean baseline contained 537 alerts. The sustained-spike attack introduced one additional alert. "
                "The strongest poisoning condition produced 16 alert-set changes. The corresponding Jaccard similarity was 0.971."
            ),
            (
                "Administrative Notes",
                "The manuscript was formatted using a standard journal template. Figure captions were revised before submission."
            ),
        ],
        "task": "Extract detector settings, clean baseline, strongest poisoning result, and corresponding similarity.",
        "must": [
            "window of six",
            "2.5",
            "537 alerts",
            "16 alert-set changes",
            "0.971",
        ],
        "exclude": [
            "thank their colleagues",
            "funding support",
            "journal template",
            "figure captions",
        ],
        "target_reduction": 20.0,
    },
    {
        "name": "policy_constraints",
        "mode": "safe",
        "budget": 200,
        "sections": [
            (
                "Office Benefits",
                "Employees receive a wellness newsletter each month. The company picnic is held every summer."
            ),
            (
                "Data Handling Policy",
                "Customer records must be encrypted at rest using AES-256. "
                "Production database exports cannot be stored on personal devices. "
                "Access to customer records requires manager approval and MFA."
            ),
            (
                "Retention",
                "Audit logs must be retained for a minimum of 365 days. "
                "Deleted customer records remain in encrypted backups for no more than 30 days."
            ),
            (
                "Facilities",
                "Parking permits are renewed each January. Office furniture requests are handled by facilities."
            ),
        ],
        "task": "Extract mandatory customer-data protection, access, export, audit-log retention, and backup-retention rules.",
        "must": [
            "AES-256",
            "cannot be stored on personal devices",
            "manager approval and MFA",
            "minimum of 365 days",
            "no more than 30 days",
        ],
        "exclude": [
            "wellness newsletter",
            "company picnic",
            "parking permits",
            "office furniture",
        ],
        "target_reduction": 20.0,
    },
    {
        "name": "deployment_config",
        "mode": "balanced",
        "budget": 190,
        "sections": [
            (
                "Developer Conveniences",
                "The team uses dark mode in the editor. Stand-up meetings begin at 9:30 AM."
            ),
            (
                "API Deployment",
                "The production API listens on port 8001. Health checks use the /api/health endpoint. "
                "Requests larger than 25 MB are rejected. The service allows three retry attempts for transient upstream failures."
            ),
            (
                "Caching",
                "Embedding results are stored in a persistent SQLite cache. "
                "Cache schema version v3 is required for the current release."
            ),
            (
                "Frontend",
                "The frontend development server runs on port 3000. The logo was updated during the last design review."
            ),
        ],
        "task": "Extract production API port, health endpoint, upload size limit, retry count, embedding cache type, and cache schema.",
        "must": [
            "port 8001",
            "/api/health",
            "25 MB",
            "three retry attempts",
            "persistent SQLite cache",
            "schema version v3",
        ],
        "exclude": [
            "dark mode",
            "stand-up meetings",
            "logo was updated",
        ],
        "target_reduction": 15.0,
    },
    {
        "name": "incident_response",
        "mode": "aggressive",
        "budget": 175,
        "sections": [
            (
                "General",
                "The support team rotates snack purchases weekly. Conference rooms are cleaned each evening."
            ),
            (
                "Incident Severity",
                "A production outage affecting authentication is classified as Severity 1. "
                "Severity 1 incidents require paging the on-call engineer immediately."
            ),
            (
                "Response Targets",
                "The incident commander must be assigned within 10 minutes. "
                "Customer-facing status updates must be published every 30 minutes until mitigation."
            ),
            (
                "Post-Incident",
                "A written postmortem is required within five business days for every Severity 1 incident. "
                "Action items must have an owner and due date."
            ),
        ],
        "task": "Extract Severity 1 classification, paging, incident commander timing, status update frequency, and postmortem deadline.",
        "must": [
            "classified as Severity 1",
            "paging the on-call engineer immediately",
            "within 10 minutes",
            "every 30 minutes",
            "within five business days",
        ],
        "exclude": [
            "snack purchases",
            "conference rooms are cleaned",
        ],
        "target_reduction": 15.0,
    },
]


def run(case):
    items = make_items_from_sections(case["sections"])

    result = optimize_sentences(
        items,
        case["task"],
        case["mode"],
        case["budget"],
    )

    output = result["optimized_text"].lower()

    missing = [text for text in case["must"] if text.lower() not in output]
    unwanted = [text for text in case["exclude"] if text.lower() in output]

    within_budget = result["optimized_tokens"] <= case["budget"]
    relevance_ok = not missing and not unwanted
    passed = relevance_ok and within_budget

    reduction = result["reduction_percent"]
    target_reduction = case["target_reduction"]

    print(
        f'[{case["name"]}] {"PASS" if passed else "FAIL"} '
        f'| mode={case["mode"]} '
        f'| reduction={reduction}% '
        f'| tokens={result["original_tokens"]}->{result["optimized_tokens"]}/{case["budget"]} '
        f'| confidence={result["retrieval_confidence"]}'
    )

    if missing:
        print("  missing:", missing)

    if unwanted:
        print("  unwanted:", unwanted)

    if not within_budget:
        print(
            "  budget exceeded:",
            result["optimized_tokens"],
            ">",
            case["budget"],
        )

    if reduction < target_reduction:
        print(
            f"  note: reduction below target "
            f"({reduction}% < {target_reduction}%)"
        )

    return passed


if __name__ == "__main__":
    results = [run(case) for case in CASES]

    passed = sum(results)
    total = len(results)

    print()
    print(f"Extended retrieval benchmark: {passed}/{total} passed.")

    if not all(results):
        raise SystemExit(1)
