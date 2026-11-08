import {
  getWorkspaceContext,
} from "@/lib/contextforge-workspace";

export type ConflictWriteForecast = {
  workspace_id: string;
  key: string;
  action: "set" | "remove";
  generated_at: string;
  risk_score: number;
  risk_level:
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "critical";
  warning: boolean;
  require_refresh: boolean;
  recommended_backoff_ms: number;
  recent_key_conflicts_24h: number;
  key_conflict_share: number;
  max_recent_revision_gap: number;
  workspace_anomaly_score: number;
  reasons: Array<{
    code: string;
    contribution: number;
    value: unknown;
    message: string;
  }>;
  recommendation: string;
};

export async function evaluateConflictWriteRisk(
  key: string,
  action: "set" | "remove",
): Promise<ConflictWriteForecast | null> {
  const context = getWorkspaceContext();

  if (context.principal.kind !== "authenticated") {
    return null;
  }

  const params = new URLSearchParams({
    key,
    action,
  });

  const response = await fetch(
    `/api/workspace-conflict-forecast?${params.toString()}`,
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

  return (await response.json()) as ConflictWriteForecast;
}

export function publishConflictRisk(
  forecast: ConflictWriteForecast,
): void {
  window.dispatchEvent(
    new CustomEvent("contextforge:conflict-forecast", {
      detail: forecast,
    }),
  );
}
