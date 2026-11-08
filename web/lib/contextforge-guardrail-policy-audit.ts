import {
  getWorkspaceContext,
} from "@/lib/contextforge-workspace";

export type GuardrailPolicyAuditRecord = {
  id: string;
  workspace_id: string;
  principal_id: string;
  key: string;
  warning_threshold: number;
  refresh_threshold: number;
  critical_threshold: number;
  backoff_scale: number;
  sample_size: number;
  tuning_reason: Array<{
    code: string;
    effect: string;
    value: unknown;
  }>;
  policy_hash: string;
  previous_policy_hash: string | null;
  changed: boolean;
  created_at: string;
};

export async function loadGuardrailPolicyHistory(
  limit = 50,
): Promise<GuardrailPolicyAuditRecord[]> {
  const context = getWorkspaceContext();

  if (context.principal.kind !== "authenticated") {
    return [];
  }

  const response = await fetch(
    `/api/workspace-guardrail-policy-history?limit=${limit}`,
    {
      headers: {
        "x-contextforge-workspace-id":
          context.workspace.id,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Guardrail policy history failed (${response.status}).`,
    );
  }

  const payload = (await response.json()) as {
    records: GuardrailPolicyAuditRecord[];
  };

  return payload.records;
}
