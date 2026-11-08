import {
  getWorkspaceContext,
} from "@/lib/contextforge-workspace";

export type ConflictAuditRecord = {
  id: string;
  workspace_id: string;
  principal_id: string;
  key: string;
  expected_revision: number;
  actual_revision: number;
  local_action: string;
  resolution: "cloud" | "local" | null;
  detected_at: string;
  resolved_at: string | null;
};

function workspaceHeaders(): HeadersInit {
  const context = getWorkspaceContext();

  return {
    "x-contextforge-workspace-id": context.workspace.id,
  };
}

export async function recordConflictDetected(input: {
  key: string;
  expectedRevision: number;
  actualRevision: number;
  localAction: "set" | "remove";
}): Promise<ConflictAuditRecord | null> {
  const context = getWorkspaceContext();

  if (context.principal.kind !== "authenticated") {
    return null;
  }

  const response = await fetch("/api/workspace-conflicts", {
    method: "POST",
    headers: {
      ...workspaceHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      workspace_id: context.workspace.id,
      key: input.key,
      expected_revision: input.expectedRevision,
      actual_revision: input.actualRevision,
      local_action: input.localAction,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Conflict audit write failed (${response.status}).`,
    );
  }

  return (await response.json()) as ConflictAuditRecord;
}

export async function recordConflictResolved(input: {
  conflictId: string;
  resolution: "cloud" | "local";
}): Promise<ConflictAuditRecord | null> {
  const context = getWorkspaceContext();

  if (context.principal.kind !== "authenticated") {
    return null;
  }

  const response = await fetch(
    "/api/workspace-conflicts?action=resolve",
    {
      method: "POST",
      headers: {
        ...workspaceHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspace_id: context.workspace.id,
        conflict_id: input.conflictId,
        resolution: input.resolution,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Conflict audit resolution failed (${response.status}).`,
    );
  }

  return (await response.json()) as ConflictAuditRecord;
}

export async function listConflictAudit(
  limit = 50,
): Promise<ConflictAuditRecord[]> {
  const context = getWorkspaceContext();

  if (context.principal.kind !== "authenticated") {
    return [];
  }

  const response = await fetch(
    `/api/workspace-conflicts?limit=${limit}`,
    {
      headers: workspaceHeaders(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Conflict audit read failed (${response.status}).`,
    );
  }

  const payload = (await response.json()) as {
    records: ConflictAuditRecord[];
  };

  return payload.records;
}
