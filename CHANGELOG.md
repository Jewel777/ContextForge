# Changelog

All notable changes to ContextForge are documented here.

## [2.1.1] - 2026-11-08

### Improved
- Improved objective coverage under tight token budgets.
- Improved semantic handling of endpoints, deprecation dates, authentication, rate limits, and payload limits.
- Improved retrieval confidence alignment with final selected evidence.
- Improved Trust and context-manifest coverage reporting.
- Improved explainability metadata for selected evidence.

### Fixed
- Fixed unrelated numeric constraints displacing requested evidence.
- Fixed false numeric facet coverage across incompatible objectives.
- Fixed token-lifetime evidence being incorrectly selected for authentication-header-only tasks.
- Fixed deprecation-date evidence being dropped under multi-objective tasks.
- Fixed uncovered facets reporting misleading evidence counts.

### Validation
- 40/40 engine tests passing.
- Final five-objective benchmark reaches full 5/5 coverage at the validated token-budget boundary.

## [2.1.0]

- First public beta release of ContextForge.
