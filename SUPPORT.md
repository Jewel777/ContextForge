# ContextForge Support

ContextForge is currently in public beta.

If you encounter a problem, please check the steps below before opening an issue.

## Common Startup Checks

### Windows

1. Make sure you downloaded the official release ZIP.
2. Extract the ZIP before launching.
3. Run:

```text
Start-ContextForge.cmd
```

4. Wait for the local engine to initialize.
5. ContextForge should open at:

```text
http://127.0.0.1:3000
```

### macOS Apple Silicon

1. Download the official macOS arm64 release ZIP.
2. Extract the ZIP.
3. Run:

```text
Start-ContextForge.command
```

4. If macOS blocks the launcher:
   - click **Done**
   - open **System Settings**
   - go to **Privacy & Security**
   - scroll to the **Security** section
   - click **Open Anyway**
   - authenticate if prompted
   - launch ContextForge again

5. ContextForge should open at:

```text
http://127.0.0.1:3000
```

## Engine Status

When ContextForge is ready, the interface should display:

```text
Engine online
```

If the engine appears offline, wait a few seconds and refresh once.

## Diagnostic Logs

ContextForge creates diagnostic logs inside the extracted application folder:

```text
logs/
```

Relevant files may include:

```text
backend.log
frontend.log
```

These files are useful when reporting startup or runtime problems.

## Reporting a Bug

For non-security bugs, open a GitHub issue and include:

- ContextForge version
- operating system
- input type
- steps to reproduce
- expected behavior
- actual behavior
- relevant screenshots
- relevant log output

Official issue tracker:

https://github.com/Jewel777/ContextForge/issues

## Security Issues

Do not report security vulnerabilities in a public issue.

See:

```text
SECURITY.md
```

for security reporting guidance.

## Supported Platforms

| Platform | Status |
|---|---|
| Windows x64 | ✅ Available |
| macOS Apple Silicon | ✅ Available |
| macOS Intel | 🚧 Planned |
| Linux | 🚧 Planned |

## Official Downloads

Only download ContextForge from:

https://github.com/Jewel777/ContextForge/releases

## Current Release

ContextForge 2.1.0 — First Public Beta
