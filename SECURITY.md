# Security Policy

## Supported Versions

ContextForge is currently in public beta.

| Version | Supported |
|---|---|
| 2.1.x | ✅ Yes |
| Older versions | ❌ No |

Users should always use the latest published release from the official repository:

https://github.com/Jewel777/ContextForge/releases

## Reporting a Security Vulnerability

Please **do not open a public GitHub issue** for security vulnerabilities.

If you discover a security issue in ContextForge, report it privately through GitHub's security reporting features when available.

Please include:

- ContextForge version
- operating system
- affected component
- clear description of the issue
- steps to reproduce
- expected behavior
- actual behavior
- relevant logs, screenshots, or proof of concept
- potential impact, if known

Avoid including sensitive personal information, credentials, API keys, tokens, or private documents in reports.

## Scope

Security reports may include issues related to:

- local file handling
- document parsing
- local API exposure
- input validation
- path handling
- bundled runtime components
- authentication or authorization behavior
- dependency-related vulnerabilities
- unintended data exposure
- unsafe execution behavior
- installer or launcher behavior

## Local-First Architecture

ContextForge is designed around local-first processing.

The application uses local services on:

- `http://127.0.0.1:3000`
- `http://127.0.0.1:8001`

Users should not intentionally expose these local services to untrusted networks.

## Unsigned Beta Builds

ContextForge 2.1.0 is currently distributed as an unsigned public beta.

Windows SmartScreen or macOS Gatekeeper may display security warnings during first launch.

Users should only download ContextForge from the official repository and release page:

https://github.com/Jewel777/ContextForge

https://github.com/Jewel777/ContextForge/releases

## Response

Security reports will be reviewed as quickly as practical.

Confirmed issues may result in:

- a patched release
- updated documentation
- dependency updates
- launcher or packaging changes
- additional mitigations

Thank you for helping improve ContextForge security.
