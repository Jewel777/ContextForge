import { evaluateConflictWriteRisk, publishConflictRisk } from "@/lib/contextforge-conflict-forecast";
import { recordConflictDetected, recordConflictResolved } from "@/lib/contextforge-conflict-audit";
import { saveCloudConflict, type CloudConflictRecord } from "@/lib/contextforge-conflicts";
import {
  CONTEXTFORGE_CLOUD_STATE_KEYS,
  createCloudEnvelope,
  isCloudStateKey,
  readCloudEnvelope,
  type ContextForgeCloudStateKey,
} from "@/lib/contextforge-cloud-state";
import {
  getWorkspaceContext,
  getWorkspaceItem,
  setWorkspaceItemFromCloud,
} from "@/lib/contextforge-workspace";

type WorkspaceStateResponse = {
  workspace_id: string;
  key: string;
  value: unknown;
  revision: number;
  updated_at: string | null;
};

const revisionCache = new Map<string, number>();

function revisionKey(
  workspaceId: string,
  key: ContextForgeCloudStateKey,
): string {
  return `${workspaceId}::${key}`;
}

function endpoint(
  key: string,
  expectedRevision?: number,
): string {
  const params = new URLSearchParams({ key });

  if (expectedRevision !== undefined) {
    params.set("expected_revision", String(expectedRevision));
  }

  return `/api/workspace-state?${params.toString()}`;
}

async function readRemote(
  key: ContextForgeCloudStateKey,
): Promise<WorkspaceStateResponse> {
  const context = getWorkspaceContext();

  const response = await fetch(endpoint(key), {
    method: "GET",
    headers: {
      "x-contextforge-workspace-id": context.workspace.id,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Workspace persistence read failed (${response.status}).`,
    );
  }

  const payload =
    (await response.json()) as WorkspaceStateResponse;

  revisionCache.set(
    revisionKey(context.workspace.id, key),
    payload.revision ?? 0,
  );

  return payload;
}

async function resolveConflict(
  key: ContextForgeCloudStateKey,
  localAction: "set" | "remove",
  localValue: string | null,
): Promise<void> {
  const context = getWorkspaceContext();
  const remote = await readRemote(key);
  const envelope = readCloudEnvelope(
    key,
    remote.value,
  );

  const expectedRevision = revisionCache.get(
    revisionKey(context.workspace.id, key),
  ) ?? 0;

  const auditRecord = await recordConflictDetected({
    key,
    expectedRevision,
    actualRevision: remote.revision,
    localAction,
  }).catch(() => null);

  saveCloudConflict({
    key,
    workspaceId: context.workspace.id,
    serverRevision: remote.revision,
    localAction,
    localValue,
    detectedAt: new Date().toISOString(),
    policy: "server-wins",
    auditId: auditRecord?.id ?? null,
  });

  if (envelope) {
    setWorkspaceItemFromCloud(
      key,
      envelope.payload,
    );
  }

  window.dispatchEvent(
    new CustomEvent(
      "contextforge:cloud-conflict",
      {
        detail: {
          key,
          workspaceId: context.workspace.id,
          revision: remote.revision,
          policy: "server-wins",
        },
      },
    ),
  );
}


async function applyPreventiveConflictGuardrail(
  key: ContextForgeCloudStateKey,
  action: "set" | "remove",
): Promise<void> {
  const forecast = await evaluateConflictWriteRisk(key, action);

  if (!forecast) return;

  if (forecast.warning) {
    publishConflictRisk(forecast);
  }

  if (forecast.require_refresh) {
    await readRemote(key);
  }

  if (forecast.recommended_backoff_ms > 0) {
    await new Promise((resolve) =>
      window.setTimeout(resolve, Math.min(forecast.recommended_backoff_ms, 1200)),
    );
  }
}

async function writeRemote(
  key: ContextForgeCloudStateKey,
  payload: string,
): Promise<void> {
  await applyPreventiveConflictGuardrail(key, "set");
  const context = getWorkspaceContext();
  const cacheKey = revisionKey(
    context.workspace.id,
    key,
  );
  const expectedRevision =
    revisionCache.get(cacheKey) ?? 0;

  const response = await fetch(endpoint(key), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-contextforge-workspace-id": context.workspace.id,
    },
    body: JSON.stringify({
      value: createCloudEnvelope(
        key,
        payload,
      ),
      expected_revision: expectedRevision,
    }),
  });

  if (response.status === 409) {
    await resolveConflict(key, "set", payload);
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Workspace persistence write failed (${response.status}).`,
    );
  }

  const result = (await response.json()) as {
    revision: number;
  };

  revisionCache.set(
    cacheKey,
    result.revision,
  );
}

async function deleteRemote(
  key: ContextForgeCloudStateKey,
): Promise<void> {
  await applyPreventiveConflictGuardrail(key, "remove");
  const context = getWorkspaceContext();
  const cacheKey = revisionKey(
    context.workspace.id,
    key,
  );
  const expectedRevision =
    revisionCache.get(cacheKey) ?? 0;

  const response = await fetch(
    endpoint(key, expectedRevision),
    {
      method: "DELETE",
      headers: {
        "x-contextforge-workspace-id": context.workspace.id,
      },
    },
  );

  if (response.status === 409) {
    await resolveConflict(key, "remove", null);
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Workspace persistence delete failed (${response.status}).`,
    );
  }

  const result = (await response.json()) as {
    revision: number;
  };

  revisionCache.set(
    cacheKey,
    result.revision,
  );
}

async function reconcileKey(
  key: ContextForgeCloudStateKey,
): Promise<void> {
  const remote = await readRemote(key);
  const envelope = readCloudEnvelope(
    key,
    remote.value,
  );

  if (envelope) {
    setWorkspaceItemFromCloud(
      key,
      envelope.payload,
    );
    return;
  }

  const local = getWorkspaceItem(key);

  if (local !== null) {
    await writeRemote(key, local);
  }
}

export async function syncKnownWorkspaceState(): Promise<void> {
  const context = getWorkspaceContext();

  if (context.principal.kind !== "authenticated") {
    return;
  }

  for (const key of CONTEXTFORGE_CLOUD_STATE_KEYS) {
    await reconcileKey(key);
  }
}

export async function mirrorWorkspaceStorageChange(
  detail: {
    key: string;
    action: "set" | "remove";
    value: string | null;
  },
): Promise<void> {
  const context = getWorkspaceContext();

  if (
    context.principal.kind !== "authenticated" ||
    !isCloudStateKey(detail.key)
  ) {
    return;
  }

  if (detail.action === "remove") {
    await deleteRemote(detail.key);
    return;
  }

  if (detail.value !== null) {
    await writeRemote(
      detail.key,
      detail.value,
    );
  }
}


export async function acceptCloudConflict(
  conflict: CloudConflictRecord,
): Promise<void> {
  const remote = await readRemote(conflict.key);
  const envelope = readCloudEnvelope(conflict.key, remote.value);
  if (envelope) {
    setWorkspaceItemFromCloud(conflict.key, envelope.payload);
  }
  if (conflict.auditId) {
    await recordConflictResolved({
      conflictId: conflict.auditId,
      resolution: "cloud",
    }).catch(() => null);
  }

  window.dispatchEvent(new CustomEvent("contextforge:cloud-conflict-resolved", { detail: { key: conflict.key, resolution: "cloud" } }));
}

export async function reapplyLocalConflict(
  conflict: CloudConflictRecord,
): Promise<void> {
  await readRemote(conflict.key);
  if (conflict.localAction === "remove") {
    await deleteRemote(conflict.key);
  } else if (conflict.localValue !== null) {
    await writeRemote(conflict.key, conflict.localValue);
    setWorkspaceItemFromCloud(conflict.key, conflict.localValue);
  }
  if (conflict.auditId) {
    await recordConflictResolved({
      conflictId: conflict.auditId,
      resolution: "local",
    }).catch(() => null);
  }

  window.dispatchEvent(new CustomEvent("contextforge:cloud-conflict-resolved", { detail: { key: conflict.key, resolution: "local" } }));
}
