import {
  getWorkspaceContext,
} from "@/lib/contextforge-workspace";

export type ConflictAnomalySnapshot = {
  workspace_id: string;
  generated_at: string;
  anomaly_score: number;
  severity:
    | "healthy"
    | "low"
    | "medium"
    | "high"
    | "critical";
  detected: boolean;
  summary: string;
  signals: Array<Record<string, unknown>>;
  root_causes: Array<Record<string, unknown>>;
  recommendations: Array<{
    code: string;
    priority: string;
    action: string;
    key?: string;
  }>;
};

export async function loadConflictAnomalies():
  Promise<ConflictAnomalySnapshot | null> {
  const context = getWorkspaceContext();

  if (context.principal.kind !== "authenticated") {
    return null;
  }

  const response = await fetch(
    "/api/workspace-conflict-anomalies",
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
      `Conflict anomaly analysis failed (${response.status}).`,
    );
  }

  return (await response.json()) as ConflictAnomalySnapshot;
}
