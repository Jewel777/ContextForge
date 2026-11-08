import {
  getWorkspaceContext,
} from "@/lib/contextforge-workspace";

export type GuardrailPolicy = {
  workspace_id: string;
  key: string;
  generated_at: string;
  warning_threshold: number;
  refresh_threshold: number;
  critical_threshold: number;
  backoff_scale: number;
  sample_size: number;
  local_resolution_ratio: number;
  unresolved_ratio: number;
  average_revision_gap: number;
  max_revision_gap: number;
  tuning_reason: Array<{
    code: string;
    effect: string;
    value: unknown;
  }>;
};

export async function loadGuardrailPolicy(
  key: string,
): Promise<GuardrailPolicy | null> {
  const context = getWorkspaceContext();

  if (context.principal.kind !== "authenticated") {
    return null;
  }

  const params = new URLSearchParams({ key });

  const response = await fetch(
    `/api/workspace-guardrail-policy?${params.toString()}`,
    {
      headers: {
        "x-contextforge-workspace-id":
          context.workspace.id,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GuardrailPolicy;
}
