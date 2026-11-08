import {
  getWorkspaceContext,
} from "@/lib/contextforge-workspace";

export type ConflictAnalyticsSnapshot = {
  workspace_id: string;
  generated_at: string;
  total_conflicts: number;
  conflicts_24h: number;
  conflicts_7d: number;
  unresolved_conflicts: number;
  cloud_resolutions: number;
  local_resolutions: number;
  resolution_cloud_ratio: number;
  average_revision_gap: number;
  max_revision_gap: number;
  hot_keys: Array<{ key: string; count: number }>;
  repeated_stale_keys: Array<{
    key: string;
    count: number;
  }>;
  trend_daily: Array<{ date: string; count: number }>;
  health_score: number;
  health_level: "healthy" | "watch" | "degraded";
};

export async function loadConflictAnalytics():
  Promise<ConflictAnalyticsSnapshot | null> {
  const context = getWorkspaceContext();

  if (context.principal.kind !== "authenticated") {
    return null;
  }

  const response = await fetch(
    "/api/workspace-conflict-analytics",
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
      `Conflict analytics failed (${response.status}).`,
    );
  }

  return (await response.json()) as ConflictAnalyticsSnapshot;
}
