# ContextForge Top Alignment UI Fix

The main application shell was vertically centered inside the viewport,
creating a large blank band above the product UI on desktop screens.

The root page is now explicitly top-aligned with a small responsive top
offset. The rule is scoped to the root `<main>` only so dialogs, modal
surfaces, Advanced Operations, and internal panels keep their own alignment.

This fixes presentation only. No compiler, retrieval, persistence, or
operational behavior is changed.
