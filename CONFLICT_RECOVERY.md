# ContextForge Conflict Visibility and Recovery UX

Cross-device conflicts are now visible to the signed-in user instead of being
handled silently.

When optimistic concurrency returns HTTP 409, ContextForge preserves the
displaced local change in session-scoped recovery storage before applying the
authoritative cloud value.

The conflict center gives the user two explicit choices:

- Keep cloud version: retain the authoritative server value.
- Reapply my change: refresh the latest server revision and retry the displaced
  local mutation against that revision.

Recovery records are limited to the current browser session and are removed
after successful resolution.

The runtime still defaults to the safe server-wins policy immediately on
conflict, so a stale client never silently overwrites newer cloud data.
