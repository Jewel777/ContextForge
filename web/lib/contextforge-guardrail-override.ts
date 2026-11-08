import {
  getWorkspaceContext,
} from "@/lib/contextforge-workspace";

export type GuardrailPolicyOverride = {
  id: string;
  workspace_id: string;
  principal_id: string;
  key: string;
  warning_threshold: number;
  refresh_threshold: number;
  critical_threshold: number;
  backoff_scale: number;
  source: "manual" | "rollback";
  source_audit_id: string | null;
  reason: string;
  active: boolean;
  created_at: string;
  cleared_at: string | null;
};

function workspaceHeaders(): HeadersInit {
  const context = getWorkspaceContext();

  return {
    "x-contextforge-workspace-id": context.workspace.id,
  };
}

export async function getGuardrailOverride(
  key: string,
): Promise<GuardrailPolicyOverride | null> {
  const context = getWorkspaceContext();
  if (context.principal.kind !== "authenticated") return null;

  const params = new URLSearchParams({ key });
  const response = await fetch(
    `/api/workspace-guardrail-override?${params.toString()}`,
    {
      headers: workspaceHeaders(),
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Guardrail override read failed (${response.status}).`,
    );
  }

  return (await response.json()) as GuardrailPolicyOverride;
}

export async function setGuardrailOverride(input: {
  key: string;
  warningThreshold: number;
  refreshThreshold: number;
  criticalThreshold: number;
  backoffScale: number;
  source: "manual" | "rollback";
  sourceAuditId?: string | null;
  reason: string;
}): Promise<GuardrailPolicyOverride> {
  const context = getWorkspaceContext();

  const response = await fetch(
    "/api/workspace-guardrail-override",
    {
      method: "POST",
      headers: {
        ...workspaceHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspace_id: context.workspace.id,
        key: input.key,
        warning_threshold: input.warningThreshold,
        refresh_threshold: input.refreshThreshold,
        critical_threshold: input.criticalThreshold,
        backoff_scale: input.backoffScale,
        source: input.source,
        source_audit_id: input.sourceAuditId ?? null,
        reason: input.reason,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Guardrail override write failed (${response.status}).`,
    );
  }

  return (await response.json()) as GuardrailPolicyOverride;
}

export async function clearGuardrailOverride(
  key: string,
): Promise<void> {
  const context = getWorkspaceContext();

  const response = await fetch(
    "/api/workspace-guardrail-override",
    {
      method: "DELETE",
      headers: {
        ...workspaceHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspace_id: context.workspace.id,
        key,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Guardrail override clear failed (${response.status}).`,
    );
  }
}
