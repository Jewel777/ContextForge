"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clipboard,
  Clock3,
  Copy,
  Download,
  FileSearch,
  FileText,
  Gauge,
  History,
  Layers3,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  WandSparkles,
  Zap,
} from "lucide-react";
import { DragEvent, ReactNode, useEffect, useMemo, useState , useRef} from "react";

import { getWorkspaceItem, setWorkspaceItem, removeWorkspaceItem } from "@/lib/contextforge-workspace";
type Stats = {
  source_sentences: number;
  chunks_created: number;
  chunks_selected: number;
  candidate_sentences: number;
  sentences_selected: number;
  duplicates_suppressed: number;
  selected_pages: number;
  selected_sections: number;
  embedding_cache_items: number;
  elapsed_ms: number;
};

type SourceTrace = {
  page?: number | null;
  section?: string | null;
  sentence: string;
  semantic_score: number;
  priority_score: number;
};

type Result = {
  task?: string;
  mode?: string;
  token_budget?: number;
  original_tokens: number;
  optimized_tokens: number;
  tokens_saved: number;
  reduction_percent: number;
  retrieval_confidence?: number;
  optimized_text: string;
  selected_context_text?: string;
  selected_context_tokens?: number;
  compiled_prompt_tokens?: number;
  output_mode?: string;
  threshold?: number;
  filename?: string;
  headings_detected?: number;
  processing_stats?: Stats;
  sources?: SourceTrace[];
};

type HistoryEntry = {
  id: string;
  createdAt: string;
  sourceLabel: string;
  task: string;
  mode: string;
  budget: number;
  result: Result;
};

type ResultTab = "output" | "sources" | "explain" | "diagnostics";
type OutputTarget = "raw" | "chatgpt" | "claude" | "gemini";

// === ContextForge explainability UI ===
type ExplainabilityConstraint = Record<string, unknown>;

type ExplainabilityEvidence = {
  decision?: string;
  source_id?: string | null;
  text?: string;
  page?: number | null;
  facet?: string | null;
  facet_score?: number | null;
  evidence_type?: string | null;
  evidence_labels?: string[];
  mandatory?: boolean | null;
  hard?: boolean | null;
  has_number?: boolean | null;
  structured_constraints?: ExplainabilityConstraint[];
  semantic_role?: string | null;
  semantic_confidence?: number | null;
  semantic_relevance?: number | null;
  rejection_stage?: string | null;
  rejection_reasons?: string[];
  reasons?: string[];
};

type ExplainabilityManifest = {
  metrics?: Record<string, unknown>;
  version?: string;
  task?: string;
  strategy?: string | null;
  summary?: {
    selected_count?: number;
    rejected_count?: number;
    facets_covered?: string[];
    pages_used?: number[];
    evidence_type_counts?: Record<string, number>;
  };
  selected?: ExplainabilityEvidence[];
  rejected?: ExplainabilityEvidence[];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isExplicitlyIrrelevantManifestItem(item: Record<string, unknown>): boolean {
  const role = String(item?.semantic_role ?? item?.semanticRole ?? item?.role ?? "").toUpperCase();
  const reasons = Array.isArray(item?.reasons) ? item.reasons.map((reason: unknown) => String(reason).toLowerCase()) : [];
  return role === "IRRELEVANT" || reasons.some((reason: string) => reason.includes("semantic_role:irrelevant") || reason.includes("semantic role:irrelevant") || reason.includes("excluded_by_task_scope") || reason.includes("excluded by task scope"));
}

function readExplainabilityManifest(value: unknown): ExplainabilityManifest | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const manifest = candidate.explainability_manifest;
  if (!manifest || typeof manifest !== "object") return null;
  return manifest as ExplainabilityManifest;
}

function formatConstraintValue(constraint: ExplainabilityConstraint): string {
  return Object.entries(constraint)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

function BaselineControls({
  baseline,
  current,
  onSave,
  onClear,
}: {
  baseline: HistoryEntry | null;
  current: Result;
  onSave: () => void;
  onClear: () => void;
}) {
  const isCurrentBaseline =
    baseline?.result.optimized_text === current.optimized_text &&
    baseline?.result.original_tokens === current.original_tokens;

  return (
    <section className="cf-premium-card mt-4 rounded-[24px] border border-white/80 bg-white/78 px-5 py-4 shadow-[0_16px_44px_rgba(55,65,81,.07)] sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0a84ff]" />
            <h3 className="text-[14px] font-semibold text-slate-950">Regression baseline</h3>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            {baseline
              ? `Saved ${new Date(baseline.createdAt).toLocaleString()} · ${baseline.mode} · ${baseline.budget} tokens`
              : "Save a trusted compile and compare future runs against it."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={isCurrentBaseline}
            className="cf-interactive-button rounded-full border border-slate-200/70 bg-white/85 px-3.5 py-2 text-[11px] font-semibold text-slate-700 transition disabled:cursor-default disabled:opacity-50"
          >
            {isCurrentBaseline ? "Current is baseline" : baseline ? "Replace baseline" : "Set as baseline"}
          </button>

          {baseline && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-full border border-rose-200/70 bg-rose-50/70 px-3.5 py-2 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100/70"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

type CompilePolicyBundle = {
  id: string;
  name: string;
  createdAt: string;
  mode: string;
  budget: number;
  task: string;
  qualityGatePolicy: QualityGatePolicy;
};

type CompilePolicyBundleRevision = {
  id: string;
  bundleId: string;
  bundleName: string;
  createdAt: string;
  mode: string;
  budget: number;
  task: string;
  qualityGatePolicy: QualityGatePolicy;
};

function CompilePolicyBundleVersionDiff({
  revision,
  currentBundle,
}: {
  revision: CompilePolicyBundleRevision;
  currentBundle: CompilePolicyBundle | null;
}) {
  const currentPolicy = currentBundle?.qualityGatePolicy ?? null;

  const rows = [
    {
      label: "Retrieval mode",
      before: revision.mode,
      after: currentBundle?.mode ?? "Bundle missing",
      changed: currentBundle ? revision.mode !== currentBundle.mode : true,
    },
    {
      label: "Token budget",
      before: `${revision.budget}`,
      after: currentBundle ? `${currentBundle.budget}` : "Bundle missing",
      changed: currentBundle ? revision.budget !== currentBundle.budget : true,
    },
    {
      label: "Task instructions",
      before: revision.task.trim() || "No task",
      after: currentBundle ? currentBundle.task.trim() || "No task" : "Bundle missing",
      changed: currentBundle ? revision.task.trim() !== currentBundle.task.trim() : true,
    },
    {
      label: "Max confidence drop",
      before: `${revision.qualityGatePolicy.maxConfidenceDrop} pp`,
      after: currentPolicy ? `${currentPolicy.maxConfidenceDrop} pp` : "Bundle missing",
      changed: currentPolicy
        ? revision.qualityGatePolicy.maxConfidenceDrop !== currentPolicy.maxConfidenceDrop
        : true,
    },
    {
      label: "Max reduction drop",
      before: `${revision.qualityGatePolicy.maxReductionDrop} pp`,
      after: currentPolicy ? `${currentPolicy.maxReductionDrop} pp` : "Bundle missing",
      changed: currentPolicy
        ? revision.qualityGatePolicy.maxReductionDrop !== currentPolicy.maxReductionDrop
        : true,
    },
    {
      label: "Critical evidence loss",
      before: revision.qualityGatePolicy.criticalLossMode,
      after: currentPolicy ? currentPolicy.criticalLossMode : "Bundle missing",
      changed: currentPolicy
        ? revision.qualityGatePolicy.criticalLossMode !== currentPolicy.criticalLossMode
        : true,
    },
    {
      label: "Numeric evidence loss",
      before: revision.qualityGatePolicy.numericLossMode,
      after: currentPolicy ? currentPolicy.numericLossMode : "Bundle missing",
      changed: currentPolicy
        ? revision.qualityGatePolicy.numericLossMode !== currentPolicy.numericLossMode
        : true,
    },
  ];

  const changedCount = rows.filter((row) => row.changed).length;

  return (
    <div className="mt-3 rounded-2xl border border-slate-200/70 bg-slate-50/75 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold text-slate-700">Bundle revision diff</p>
        <span
          className={`rounded-full px-2 py-1 text-[8px] font-bold tracking-[0.08em] ${
            changedCount > 0
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {changedCount > 0
            ? `${changedCount} CHANGE${changedCount === 1 ? "" : "S"}`
            : "NO CHANGES"}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`rounded-xl border px-3 py-2.5 ${
              row.changed
                ? "border-amber-200/65 bg-amber-50/40"
                : "border-slate-200/60 bg-white/75"
            }`}
          >
            <p className="text-[9px] font-semibold text-slate-600">{row.label}</p>
            <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
              <span className="break-words text-[9px] leading-4 text-slate-500">
                {row.before}
              </span>
              <span className="text-[9px] font-semibold text-slate-400">→</span>
              <span
                className={`break-words text-right text-[9px] leading-4 ${
                  row.changed ? "font-semibold text-slate-900" : "text-slate-500"
                }`}
              >
                {row.after}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type CompilePolicyBundleRestoreAuditEntry = {
  id: string;
  restoredAt: string;
  bundleId: string;
  bundleName: string;
  revisionId: string;
  revisionCreatedAt: string;
  before: CompilePolicyBundle | null;
  after: CompilePolicyBundle;
};

function CompilePolicyBundleAuditExport({
  entries,
}: {
  entries: CompilePolicyBundleRestoreAuditEntry[];
}) {
  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const payload = {
      type: "contextforge-compile-policy-bundle-restore-audit",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
    };

    download(
      `contextforge-bundle-restore-audit-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  };

  const csvEscape = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? value
          : String(value);

    return `"${text.replace(/"/g, '""')}"`;
  };

  const exportCsv = () => {
    const headers = [
      "restored_at",
      "bundle_id",
      "bundle_name",
      "revision_id",
      "revision_created_at",
      "before_mode",
      "after_mode",
      "before_budget",
      "after_budget",
      "before_task",
      "after_task",
      "before_max_confidence_drop",
      "after_max_confidence_drop",
      "before_max_reduction_drop",
      "after_max_reduction_drop",
      "before_critical_loss_mode",
      "after_critical_loss_mode",
      "before_numeric_loss_mode",
      "after_numeric_loss_mode",
    ];

    const rows = entries.map((entry) => [
      entry.restoredAt,
      entry.bundleId,
      entry.bundleName,
      entry.revisionId,
      entry.revisionCreatedAt,
      entry.before?.mode ?? "",
      entry.after.mode,
      entry.before?.budget ?? "",
      entry.after.budget,
      entry.before?.task ?? "",
      entry.after.task,
      entry.before?.qualityGatePolicy.maxConfidenceDrop ?? "",
      entry.after.qualityGatePolicy.maxConfidenceDrop,
      entry.before?.qualityGatePolicy.maxReductionDrop ?? "",
      entry.after.qualityGatePolicy.maxReductionDrop,
      entry.before?.qualityGatePolicy.criticalLossMode ?? "",
      entry.after.qualityGatePolicy.criticalLossMode,
      entry.before?.qualityGatePolicy.numericLossMode ?? "",
      entry.after.qualityGatePolicy.numericLossMode,
    ]);

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\r\n");

    download(
      `contextforge-bundle-restore-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={exportJson}
        disabled={entries.length === 0}
        className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
      >
        Export JSON
      </button>

      <button
        type="button"
        onClick={exportCsv}
        disabled={entries.length === 0}
        className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
      >
        Export CSV
      </button>
    </div>
  );
}

function CompilePolicyBundleRestoreAuditTrail({
  entries,
  onClear,
}: {
  entries: CompilePolicyBundleRestoreAuditEntry[];
  onClear: () => void;
}) {
  return (
    <div className="border-b border-slate-200/65 bg-white/45 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">
            Bundle restore audit trail
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Every bundle rollback is recorded with its exact compile configuration transition.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <CompilePolicyBundleAuditExport entries={entries} />
          <button
            type="button"
            onClick={onClear}
            disabled={entries.length === 0}
            className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Clear bundle audit
          </button>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {entries.slice(0, 30).map((entry) => {
            const before = entry.before;
            const changes = [
              {
                label: "mode",
                before: before?.mode ?? "missing",
                after: entry.after.mode,
                changed: !before || before.mode !== entry.after.mode,
              },
              {
                label: "budget",
                before: before ? `${before.budget}` : "missing",
                after: `${entry.after.budget}`,
                changed: !before || before.budget !== entry.after.budget,
              },
              {
                label: "task",
                before: before ? before.task.trim() || "No task" : "missing",
                after: entry.after.task.trim() || "No task",
                changed: !before || before.task.trim() !== entry.after.task.trim(),
              },
              {
                label: "confidence",
                before: before
                  ? `${before.qualityGatePolicy.maxConfidenceDrop} pp`
                  : "missing",
                after: `${entry.after.qualityGatePolicy.maxConfidenceDrop} pp`,
                changed:
                  !before ||
                  before.qualityGatePolicy.maxConfidenceDrop !==
                    entry.after.qualityGatePolicy.maxConfidenceDrop,
              },
              {
                label: "reduction",
                before: before
                  ? `${before.qualityGatePolicy.maxReductionDrop} pp`
                  : "missing",
                after: `${entry.after.qualityGatePolicy.maxReductionDrop} pp`,
                changed:
                  !before ||
                  before.qualityGatePolicy.maxReductionDrop !==
                    entry.after.qualityGatePolicy.maxReductionDrop,
              },
              {
                label: "critical",
                before: before
                  ? before.qualityGatePolicy.criticalLossMode
                  : "missing",
                after: entry.after.qualityGatePolicy.criticalLossMode,
                changed:
                  !before ||
                  before.qualityGatePolicy.criticalLossMode !==
                    entry.after.qualityGatePolicy.criticalLossMode,
              },
              {
                label: "numeric",
                before: before
                  ? before.qualityGatePolicy.numericLossMode
                  : "missing",
                after: entry.after.qualityGatePolicy.numericLossMode,
                changed:
                  !before ||
                  before.qualityGatePolicy.numericLossMode !==
                    entry.after.qualityGatePolicy.numericLossMode,
              },
            ].filter((item) => item.changed);

            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200/70 bg-white/75 p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-900">
                      {entry.bundleName}
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                      Restored {new Date(entry.restoredAt).toLocaleString()}
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold tracking-[0.08em] text-slate-500">
                    {changes.length} CHANGE{changes.length === 1 ? "" : "S"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {changes.length > 0 ? (
                    changes.map((change) => (
                      <span
                        key={change.label}
                        className="max-w-full rounded-full bg-amber-50 px-2 py-1 text-[9px] text-amber-700"
                      >
                        {change.label}: {change.before} → {change.after}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] text-emerald-700">
                      No compile configuration fields changed
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[9px] text-slate-400">
                  Revision: {entry.revisionId} · saved{" "}
                  {new Date(entry.revisionCreatedAt).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-3 text-[10px] text-slate-500">
          No bundle restore events recorded yet.
        </div>
      )}
    </div>
  );
}

function CompilePolicyBundleRestoreConfirmation({
  revision,
  currentBundle,
  onCancel,
  onConfirm,
}: {
  revision: CompilePolicyBundleRevision;
  currentBundle: CompilePolicyBundle | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const currentPolicy = currentBundle?.qualityGatePolicy ?? null;

  const rows = [
    {
      label: "Retrieval mode",
      current: currentBundle?.mode ?? "Bundle missing",
      restored: revision.mode,
      changed: currentBundle ? currentBundle.mode !== revision.mode : true,
    },
    {
      label: "Token budget",
      current: currentBundle ? `${currentBundle.budget}` : "Bundle missing",
      restored: `${revision.budget}`,
      changed: currentBundle ? currentBundle.budget !== revision.budget : true,
    },
    {
      label: "Task instructions",
      current: currentBundle ? currentBundle.task.trim() || "No task" : "Bundle missing",
      restored: revision.task.trim() || "No task",
      changed: currentBundle ? currentBundle.task.trim() !== revision.task.trim() : true,
    },
    {
      label: "Max confidence drop",
      current: currentPolicy ? `${currentPolicy.maxConfidenceDrop} pp` : "Bundle missing",
      restored: `${revision.qualityGatePolicy.maxConfidenceDrop} pp`,
      changed: currentPolicy
        ? currentPolicy.maxConfidenceDrop !== revision.qualityGatePolicy.maxConfidenceDrop
        : true,
    },
    {
      label: "Max reduction drop",
      current: currentPolicy ? `${currentPolicy.maxReductionDrop} pp` : "Bundle missing",
      restored: `${revision.qualityGatePolicy.maxReductionDrop} pp`,
      changed: currentPolicy
        ? currentPolicy.maxReductionDrop !== revision.qualityGatePolicy.maxReductionDrop
        : true,
    },
    {
      label: "Critical evidence loss",
      current: currentPolicy ? currentPolicy.criticalLossMode : "Bundle missing",
      restored: revision.qualityGatePolicy.criticalLossMode,
      changed: currentPolicy
        ? currentPolicy.criticalLossMode !== revision.qualityGatePolicy.criticalLossMode
        : true,
    },
    {
      label: "Numeric evidence loss",
      current: currentPolicy ? currentPolicy.numericLossMode : "Bundle missing",
      restored: revision.qualityGatePolicy.numericLossMode,
      changed: currentPolicy
        ? currentPolicy.numericLossMode !== revision.qualityGatePolicy.numericLossMode
        : true,
    },
  ];

  const changedRows = rows.filter((row) => row.changed);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm bundle restore"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,.28)]">
        <div className="border-b border-slate-200/70 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600">
                Bundle restore confirmation
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                Restore {revision.bundleName}?
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Review the exact compile configuration changes before applying this revision.
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[66vh] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-slate-700">
              Change summary
            </p>
            <span
              className={`rounded-full px-2.5 py-1 text-[8px] font-bold tracking-[0.08em] ${
                changedRows.length > 0
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {changedRows.length > 0
                ? `${changedRows.length} CHANGE${changedRows.length === 1 ? "" : "S"}`
                : "NO CHANGES"}
            </span>
          </div>

          <div className="mt-3 grid gap-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className={`rounded-2xl border px-3.5 py-3 ${
                  row.changed
                    ? "border-amber-200/70 bg-amber-50/45"
                    : "border-slate-200/70 bg-slate-50/55"
                }`}
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {row.label}
                </p>

                <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">
                      Current
                    </p>
                    <p className="mt-0.5 break-words text-[10px] font-semibold leading-4 text-slate-700">
                      {row.current}
                    </p>
                  </div>

                  <span className="pt-3 text-[11px] font-semibold text-slate-400">→</span>

                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">
                      Restored
                    </p>
                    <p className="mt-0.5 break-words text-[10px] font-semibold leading-4 text-slate-950">
                      {row.restored}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-[10px] leading-5 text-slate-500">
            Revision saved {new Date(revision.createdAt).toLocaleString()}.
            Restoring replaces the saved bundle and immediately applies its mode, budget, task, and quality-gate policy.
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/70 bg-slate-50/60 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200/70 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-slate-800"
          >
            Restore bundle
          </button>
        </div>
      </div>
    </div>
  );
}

function CompilePolicyBundleVersioning({
  revisions,
  bundles,
  onRestore,
  onDeleteRevision,
}: {
  revisions: CompilePolicyBundleRevision[];
  bundles: CompilePolicyBundle[];
  onRestore: (revision: CompilePolicyBundleRevision) => void;
  onDeleteRevision: (id: string) => void;
}) {
  const [selectedBundleId, setSelectedBundleId] = useState<string>("all");
  const [expandedBundleRevisionId] = useState<string | null>(null);
  const [pendingBundleRestoreRevision, setPendingBundleRestoreRevision] = useState<CompilePolicyBundleRevision | null>(null);

  const filtered =
    selectedBundleId === "all"
      ? revisions
      : revisions.filter((revision) => revision.bundleId === selectedBundleId);

  return (
    <div className="border-b border-slate-200/65 bg-slate-50/35 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">
            Bundle version history
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Updating an existing bundle preserves its previous compile configuration for rollback.
          </p>
        </div>

        <select
          value={selectedBundleId}
          onChange={(event) => setSelectedBundleId(event.target.value)}
          className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 outline-none focus:border-indigo-300/60 focus:ring-4 focus:ring-indigo-500/10"
        >
          <option value="all">All bundles</option>
          {bundles.map((bundle) => (
            <option key={bundle.id} value={bundle.id}>
              {bundle.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {filtered.slice(0, 24).map((revision) => {
            const currentBundle =
              bundles.find((bundle) => bundle.id === revision.bundleId) ?? null;
            const expanded = expandedBundleRevisionId === revision.id;

            return (
            <div
              key={revision.id}
              className="rounded-2xl border border-slate-200/70 bg-white/75 p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[11px] font-semibold text-slate-900">
                      {revision.bundleName}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {new Date(revision.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {revision.mode}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {revision.budget} tokens
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      confidence {revision.qualityGatePolicy.maxConfidenceDrop} pp
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      reduction {revision.qualityGatePolicy.maxReductionDrop} pp
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-[9px] leading-4 text-slate-500">
                    {revision.task.trim() || "No task instruction saved"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingBundleRestoreRevision(revision)}
                    className="rounded-xl bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white transition hover:bg-slate-800"
                  >
                    Restore
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteRevision(revision.id)}
                    className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expanded ? (
                <CompilePolicyBundleVersionDiff
                  revision={revision}
                  currentBundle={currentBundle}
                />
              ) : null}
            </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200/80 bg-white/60 px-4 py-3 text-[10px] text-slate-500">
          No bundle revisions yet. Save over an existing bundle name to create version history.
        </div>
      )}

      {pendingBundleRestoreRevision ? (
        <CompilePolicyBundleRestoreConfirmation
          revision={pendingBundleRestoreRevision}
          currentBundle={
            bundles.find((bundle) => bundle.id === pendingBundleRestoreRevision.bundleId) ?? null
          }
          onCancel={() => setPendingBundleRestoreRevision(null)}
          onConfirm={() => {
            onRestore(pendingBundleRestoreRevision);
            setPendingBundleRestoreRevision(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CompilePolicyBundleTransfer({
  bundles,
  onImport,
}: {
  bundles: CompilePolicyBundle[];
  onImport: (bundles: CompilePolicyBundle[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportBundles = () => {
    const payload = {
      type: "contextforge-compile-policy-bundles",
      version: 1,
      exportedAt: new Date().toISOString(),
      bundles,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `contextforge-compile-policy-bundles-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setMessage(`Exported ${bundles.length} bundle${bundles.length === 1 ? "" : "s"}.`);
  };

  const validatePolicy = (value: unknown): value is QualityGatePolicy => {
    if (!value || typeof value !== "object") return false;
    const policy = value as Partial<QualityGatePolicy>;

    return (
      typeof policy.maxConfidenceDrop === "number" &&
      Number.isFinite(policy.maxConfidenceDrop) &&
      policy.maxConfidenceDrop >= 0 &&
      policy.maxConfidenceDrop <= 30 &&
      typeof policy.maxReductionDrop === "number" &&
      Number.isFinite(policy.maxReductionDrop) &&
      policy.maxReductionDrop >= 0 &&
      policy.maxReductionDrop <= 40 &&
      (policy.criticalLossMode === "fail" || policy.criticalLossMode === "warn") &&
      (policy.numericLossMode === "fail" || policy.numericLossMode === "warn")
    );
  };

  const validateBundle = (value: unknown): value is CompilePolicyBundle => {
    if (!value || typeof value !== "object") return false;
    const bundle = value as Partial<CompilePolicyBundle>;

    return (
      typeof bundle.id === "string" &&
      bundle.id.length > 0 &&
      typeof bundle.name === "string" &&
      bundle.name.trim().length > 0 &&
      bundle.name.length <= 50 &&
      typeof bundle.createdAt === "string" &&
      !Number.isNaN(Date.parse(bundle.createdAt)) &&
      typeof bundle.mode === "string" &&
      bundle.mode.length > 0 &&
      typeof bundle.budget === "number" &&
      Number.isFinite(bundle.budget) &&
      bundle.budget > 0 &&
      typeof bundle.task === "string" &&
      validatePolicy(bundle.qualityGatePolicy)
    );
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      let incoming: unknown = parsed;
      if (parsed && typeof parsed === "object" && "bundles" in parsed) {
        incoming = (parsed as { bundles?: unknown }).bundles;
      }

      if (!Array.isArray(incoming)) {
        throw new Error("JSON does not contain a bundles array.");
      }

      const valid = incoming.filter(validateBundle).slice(0, 12);
      if (valid.length === 0) {
        throw new Error("No valid ContextForge compile policy bundles found.");
      }

      onImport(valid);
      setMessage(`Imported ${valid.length} bundle${valid.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Import failed: ${error.message}`
          : "Import failed.",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="border-b border-slate-200/65 bg-white/45 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">
            Bundle transfer
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Export full compile configurations as JSON or import them on another machine.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportBundles}
            disabled={bundles.length === 0}
            className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Export bundles
          </button>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-xl bg-slate-950 px-3.5 py-2 text-[10px] font-semibold text-white transition hover:bg-slate-800"
          >
            Import bundles
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
        </div>
      </div>

      {message ? (
        <div className="mt-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-[10px] text-slate-600">
          {message}
        </div>
      ) : null}
    </div>
  );
}

type BundleExecutionGuardMode = "warn" | "block";

type BundleExecutionGuardEvaluation = {
  status: "PASS" | "WARN" | "BLOCK";
  reasons: Array<{
    level: "pass" | "warn" | "block";
    label: string;
    detail: string;
  }>;
};

function evaluateBundleExecutionGuard({
  activeBundle,
  baseline,
  mode,
  budget,
  task,
  policy,
}: {
  activeBundle: CompilePolicyBundle | null;
  baseline: HistoryEntry | null;
  mode: string;
  budget: number;
  task: string;
  policy: QualityGatePolicy;
}): BundleExecutionGuardEvaluation {
  const reasons: BundleExecutionGuardEvaluation["reasons"] = [];

  if (!activeBundle) {
    reasons.push({
      level: "warn",
      label: "Saved bundle",
      detail: "Current compile configuration does not exactly match a saved bundle.",
    });
  } else {
    reasons.push({
      level: "pass",
      label: "Saved bundle",
      detail: `Active bundle: ${activeBundle.name}.`,
    });
  }

  if (!baseline) {
    reasons.push({
      level: "warn",
      label: "Trusted baseline",
      detail: "No regression baseline is saved, so baseline safety checks are limited.",
    });
  } else {
    if (budget < baseline.result.optimized_tokens) {
      reasons.push({
        level: "block",
        label: "Token budget",
        detail: `Budget ${budget} is below the trusted baseline output size of ${baseline.result.optimized_tokens} tokens.`,
      });
    } else {
      reasons.push({
        level: "pass",
        label: "Token budget",
        detail: `Budget ${budget} can contain the trusted baseline output size of ${baseline.result.optimized_tokens} tokens.`,
      });
    }

    reasons.push(
      task.trim() !== baseline.task.trim()
        ? {
            level: "warn",
            label: "Task drift",
            detail: "Task instructions differ from the saved regression baseline.",
          }
        : {
            level: "pass",
            label: "Task drift",
            detail: "Task instructions match the saved regression baseline.",
          },
    );

    reasons.push(
      mode !== baseline.mode
        ? {
            level: "warn",
            label: "Retrieval mode",
            detail: `Mode changed from baseline ${baseline.mode} to ${mode}.`,
          }
        : {
            level: "pass",
            label: "Retrieval mode",
            detail: `Mode matches baseline ${baseline.mode}.`,
          },
    );
  }

  reasons.push(
    policy.criticalLossMode === "warn"
      ? {
          level: "warn",
          label: "Critical evidence policy",
          detail: "Critical evidence loss is configured as warning-only.",
        }
      : {
          level: "pass",
          label: "Critical evidence policy",
          detail: "Critical evidence loss remains a hard failure.",
        },
  );

  reasons.push(
    policy.numericLossMode === "warn"
      ? {
          level: "warn",
          label: "Numeric evidence policy",
          detail: "Numeric evidence loss is configured as warning-only.",
        }
      : {
          level: "pass",
          label: "Numeric evidence policy",
          detail: "Numeric evidence loss remains a hard failure.",
        },
  );

  const status = reasons.some((reason) => reason.level === "block")
    ? "BLOCK"
    : reasons.some((reason) => reason.level === "warn")
      ? "WARN"
      : "PASS";

  return { status, reasons };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BundleExecutionGuard({
  evaluation,
  guardMode,
  onModeChange,
  notice,
}: {
  evaluation: BundleExecutionGuardEvaluation;
  guardMode: BundleExecutionGuardMode;
  onModeChange: (mode: BundleExecutionGuardMode) => void;
  notice: string | null;
}) {
  const statusClasses =
    evaluation.status === "PASS"
      ? "border-emerald-200/80 bg-emerald-50/75 text-emerald-700"
      : evaluation.status === "WARN"
        ? "border-amber-200/80 bg-amber-50/80 text-amber-700"
        : "border-rose-200/80 bg-rose-50/80 text-rose-700";

  return (
    <section className="cf-premium-card mt-4 overflow-hidden rounded-[26px] border border-white/80 bg-white/78 shadow-[0_18px_50px_rgba(55,65,81,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/65 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0a84ff]" />
            <h3 className="text-[15px] font-semibold text-slate-950">
              Bundle execution guard
            </h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">
            Preflight checks catch unsafe compile configuration drift before execution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={guardMode}
            onChange={(event) =>
              onModeChange(event.target.value as BundleExecutionGuardMode)
            }
            className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 outline-none"
          >
            <option value="warn">Warn only</option>
            <option value="block">Block unsafe</option>
          </select>

          <span className={`rounded-full border px-3 py-2 text-[9px] font-bold tracking-[0.1em] ${statusClasses}`}>
            {evaluation.status}
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {evaluation.reasons.map((reason) => {
          const badge =
            reason.level === "pass"
              ? "PASS"
              : reason.level === "warn"
                ? "WARN"
                : "BLOCK";

          const badgeClasses =
            reason.level === "pass"
              ? "bg-emerald-50 text-emerald-700"
              : reason.level === "warn"
                ? "bg-amber-50 text-amber-700"
                : "bg-rose-50 text-rose-700";

          return (
            <div
              key={`${reason.label}-${reason.detail}`}
              className="rounded-2xl border border-slate-200/65 bg-white/72 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-slate-700">
                  {reason.label}
                </p>
                <span className={`rounded-full px-2 py-1 text-[8px] font-bold tracking-[0.08em] ${badgeClasses}`}>
                  {badge}
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">
                {reason.detail}
              </p>
            </div>
          );
        })}
      </div>

      {notice ? (
        <div className="border-t border-rose-200/70 bg-rose-50/70 px-5 py-3 text-[10px] font-semibold text-rose-700 sm:px-6">
          {notice}
        </div>
      ) : null}
    </section>
  );
}

type BundleExecutionGuardAuditEntry = {
  id: string;
  createdAt: string;
  outcome: "WARN" | "BLOCK";
  guardMode: BundleExecutionGuardMode;
  bundleId: string | null;
  bundleName: string | null;
  mode: string;
  budget: number;
  task: string;
  reasons: BundleExecutionGuardEvaluation["reasons"];
};

function BundleExecutionGuardAuditExport({
  entries,
}: {
  entries: BundleExecutionGuardAuditEntry[];
}) {
  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const payload = {
      type: "contextforge-bundle-execution-guard-audit",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
    };

    download(
      `contextforge-execution-guard-audit-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  };

  const csvEscape = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? value
          : JSON.stringify(value);

    return `"${text.replace(/"/g, '""')}"`;
  };

  const exportCsv = () => {
    const headers = [
      "created_at",
      "outcome",
      "guard_mode",
      "bundle_id",
      "bundle_name",
      "mode",
      "budget",
      "task",
      "reason_levels",
      "reason_labels",
      "reason_details",
    ];

    const rows = entries.map((entry) => [
      entry.createdAt,
      entry.outcome,
      entry.guardMode,
      entry.bundleId ?? "",
      entry.bundleName ?? "",
      entry.mode,
      entry.budget,
      entry.task,
      entry.reasons.map((reason) => reason.level).join(" | "),
      entry.reasons.map((reason) => reason.label).join(" | "),
      entry.reasons.map((reason) => reason.detail).join(" | "),
    ]);

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\r\n");

    download(
      `contextforge-execution-guard-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={exportJson}
        disabled={entries.length === 0}
        className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
      >
        Export JSON
      </button>

      <button
        type="button"
        onClick={exportCsv}
        disabled={entries.length === 0}
        className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
      >
        Export CSV
      </button>
    </div>
  );
}

function ExecutionGuardOperationalDashboard({
  entries,
}: {
  entries: BundleExecutionGuardAuditEntry[];
}) {
  const [operationalDashboardWindow, setOperationalDashboardWindow] =
    useState<7 | 30 | 90>(30);
  const [operationalDashboardBundle, setOperationalDashboardBundle] =
    useState<string>("all");

  const [now] = useState(Date.now);
  const dayMs = 24 * 60 * 60 * 1000;

  const availableBundles = Array.from(
    new Map(
      entries.map((entry) => [
        entry.bundleId ?? `custom::${entry.bundleName ?? "Custom configuration"}`,
        entry.bundleName ?? "Custom configuration",
      ]),
    ),
  ).map(([id, name]) => ({ id, name }));

  const dashboardWindowEntries = entries.filter((entry) => {
    const age = now - new Date(entry.createdAt).getTime();
    return age >= 0 && age <= operationalDashboardWindow * dayMs;
  });

  const dashboardEntries =
    operationalDashboardBundle === "all"
      ? dashboardWindowEntries
      : dashboardWindowEntries.filter((entry) => {
          const key =
            entry.bundleId ??
            `custom::${entry.bundleName ?? "Custom configuration"}`;
          return key === operationalDashboardBundle;
        });

  const sorted = [...dashboardEntries].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  const recent7d = sorted.filter(
    (entry) => now - new Date(entry.createdAt).getTime() <= 7 * dayMs,
  );
  const previous7d = sorted.filter((entry) => {
    const age = now - new Date(entry.createdAt).getTime();
    return age > 7 * dayMs && age <= 14 * dayMs;
  });

  const blockCount = dashboardEntries.filter((entry) => entry.outcome === "BLOCK").length;
  const warnCount = dashboardEntries.filter((entry) => entry.outcome === "WARN").length;
  const blockRate = dashboardEntries.length ? (blockCount / dashboardEntries.length) * 100 : 0;
  const recentBlockRate = recent7d.length
    ? (recent7d.filter((entry) => entry.outcome === "BLOCK").length /
        recent7d.length) *
      100
    : 0;
  const previousBlockRate = previous7d.length
    ? (previous7d.filter((entry) => entry.outcome === "BLOCK").length /
        previous7d.length) *
      100
    : 0;
  const blockRateDelta =
    recent7d.length && previous7d.length
      ? recentBlockRate - previousBlockRate
      : null;

  const reasonCounts = new Map<
    string,
    { label: string; detail: string; level: string; count: number }
  >();

  dashboardEntries.forEach((entry) => {
    entry.reasons.forEach((reason) => {
      if (reason.level === "pass") return;
      const key = `${reason.level}::${reason.label}::${reason.detail}`;
      const current = reasonCounts.get(key);
      reasonCounts.set(key, {
        label: reason.label,
        detail: reason.detail,
        level: reason.level,
        count: (current?.count ?? 0) + 1,
      });
    });
  });

  const topReasons = Array.from(reasonCounts.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  const bundleStats = new Map<
    string,
    { name: string; total: number; blocks: number; warnings: number; latestAt: string }
  >();

  dashboardEntries.forEach((entry) => {
    const key = entry.bundleId ?? `custom::${entry.bundleName ?? "Custom configuration"}`;
    const existing = bundleStats.get(key);
    const latestAt =
      !existing ||
      new Date(entry.createdAt).getTime() > new Date(existing.latestAt).getTime()
        ? entry.createdAt
        : existing.latestAt;

    bundleStats.set(key, {
      name: entry.bundleName ?? "Custom configuration",
      total: (existing?.total ?? 0) + 1,
      blocks: (existing?.blocks ?? 0) + (entry.outcome === "BLOCK" ? 1 : 0),
      warnings: (existing?.warnings ?? 0) + (entry.outcome === "WARN" ? 1 : 0),
      latestAt,
    });
  });

  const riskyBundles = Array.from(bundleStats.values())
    .map((bundle) => ({
      ...bundle,
      riskScore:
        bundle.total > 0
          ? ((bundle.blocks * 2 + bundle.warnings) / (bundle.total * 2)) * 100
          : 0,
    }))
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 4);

  const operationalRiskRankingMinimumEvents = 3;

  const configurationFingerprints = new Map<string, number>();
  recent7d.forEach((entry) => {
    const fingerprint = JSON.stringify({
      bundleId: entry.bundleId ?? null,
      mode: entry.mode,
      budget: entry.budget,
      task: entry.task.trim(),
      guardMode: entry.guardMode,
    });
    configurationFingerprints.set(
      fingerprint,
      (configurationFingerprints.get(fingerprint) ?? 0) + 1,
    );
  });

  const recentConfigurationVariants = configurationFingerprints.size;
  const driftSignal =
    recentConfigurationVariants >= 6
      ? "High"
      : recentConfigurationVariants >= 3
        ? "Moderate"
        : recentConfigurationVariants >= 2
          ? "Low"
          : "Stable";

  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index;
    const day = new Date(now - daysAgo * dayMs);
    const start = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
    ).getTime();
    const end = start + dayMs;

    const events = dashboardEntries.filter((entry) => {
      const created = new Date(entry.createdAt).getTime();
      return created >= start && created < end;
    });

    return {
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      total: events.length,
      blocks: events.filter((entry) => entry.outcome === "BLOCK").length,
      warnings: events.filter((entry) => entry.outcome === "WARN").length,
    };
  });

  const maxDailyEvents = Math.max(1, ...recentDays.map((day) => day.total));

  const totalReasonOccurrences = Array.from(reasonCounts.values()).reduce(
    (sum, reason) => sum + reason.count,
    0,
  );

  const topReasonConcentration =
    totalReasonOccurrences > 0 && topReasons[0]
      ? (topReasons[0].count / totalReasonOccurrences) * 100
      : 0;

  const exportOperationalSnapshot = () => {
    const payload = {
      type: "contextforge-execution-guard-operational-intelligence",
      version: 2,
      exportedAt: new Date().toISOString(),
      windowDays: operationalDashboardWindow,
      bundleFilter: operationalDashboardBundle,
      metrics: {
        auditedEvents: dashboardEntries.length,
        blockCount,
        warnCount,
        blockRate,
        recentBlockRate,
        previousBlockRate,
        blockRateDelta,
        driftSignal,
        recentConfigurationVariants,
        dominantCause: topReasons[0] ?? null,
        dominantCauseConcentration: topReasonConcentration,
      },
      topReasons,
      riskyBundles,
      recentDays,
      anomalyIntelligence: {
        signal: operationalAnomalySignal,
        spikeThreshold: operationalSpikeThreshold,
        spikeDays: operationalSpikeDays,
        latestRiskRatio: operationalLatestRiskRatio,
        historicalBaseline: operationalHistoricalBaseline,
      },
      driftIntelligence: {
        reasonDistributionShift: operationalReasonShift,
        reasonDistributionSignal: operationalReasonShiftSignal,
        bundleVolatility: operationalBundleVolatility,
      },
      riskTimeline: operationalRiskTimeline,
      incidentIntelligence: {
        health: operationalIncidentHealth,
        incidentGapHours: 6,
        episodes: operationalQualifiedIncidentEpisodes,
        rawEpisodeCount: operationalIncidentEpisodes.length,
        rootCauseClusters: operationalRootCauseClusters,
        meanRecoveryMinutes: operationalMeanRecoveryMinutes,
        recoveredIncidents: operationalRecoveredIncidents,
        sustainedDegradation: operationalSustainedDegradation,
      },
      forecastingIntelligence: {
        signal: operationalForecastSignal,
        confidence: operationalForecastConfidence,
        forecastRiskPoints: operationalForecastRiskPoints,
        trend: operationalForecastTrend,
        likelyNextCause: operationalLikelyNextCause,
        recoveryConfidence: operationalRecoveryConfidence,
        recoveryRate: operationalRecoveryRate,
        preRiskChanges: operationalPreRiskChanges,
        remediationPlan: operationalRemediationPlan,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contextforge-operational-intelligence-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const operationalTimelineDays = Math.min(
    operationalDashboardWindow,
    30,
  );

  const operationalRiskTimeline = Array.from(
    { length: operationalTimelineDays },
    (_, index) => {
      const daysAgo = operationalTimelineDays - 1 - index;
      const day = new Date(now - daysAgo * dayMs);
      const start = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
      ).getTime();
      const end = start + dayMs;

      const dayEntries = dashboardEntries.filter((entry) => {
        const created = new Date(entry.createdAt).getTime();
        return created >= start && created < end;
      });

      const blocks = dayEntries.filter(
        (entry) => entry.outcome === "BLOCK",
      ).length;
      const warnings = dayEntries.filter(
        (entry) => entry.outcome === "WARN",
      ).length;
      const riskPoints = blocks * 2 + warnings;

      return {
        label: day.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        total: dayEntries.length,
        blocks,
        warnings,
        riskPoints,
      };
    },
  );

  const operationalDailyVolumes = operationalRiskTimeline.map(
    (day) => day.total,
  );
  const operationalVolumeMean =
    operationalDailyVolumes.length > 0
      ? operationalDailyVolumes.reduce((sum, value) => sum + value, 0) /
        operationalDailyVolumes.length
      : 0;
  const operationalVolumeVariance =
    operationalDailyVolumes.length > 0
      ? operationalDailyVolumes.reduce(
          (sum, value) =>
            sum + Math.pow(value - operationalVolumeMean, 2),
          0,
        ) / operationalDailyVolumes.length
      : 0;
  const operationalVolumeStd = Math.sqrt(operationalVolumeVariance);
  const operationalSpikeThreshold =
    operationalVolumeMean + operationalVolumeStd * 2;

  const operationalSpikeDays = operationalRiskTimeline.filter(
    (day) =>
      day.total > 0 &&
      day.total > operationalSpikeThreshold &&
      day.total >= Math.max(2, operationalVolumeMean),
  );

  const operationalMaxRiskPoints = Math.max(
    1,
    ...operationalRiskTimeline.map((day) => day.riskPoints),
  );

  const operationalWindowMs = operationalDashboardWindow * dayMs;
  const operationalHalfWindowMs = operationalWindowMs / 2;

  const operationalRecentHalf = dashboardEntries.filter((entry) => {
    const age = now - new Date(entry.createdAt).getTime();
    return age >= 0 && age <= operationalHalfWindowMs;
  });

  const operationalPriorHalf = dashboardEntries.filter((entry) => {
    const age = now - new Date(entry.createdAt).getTime();
    return age > operationalHalfWindowMs && age <= operationalWindowMs;
  });

  const operationalReasonDistribution = (
    targetEntries: BundleExecutionGuardAuditEntry[],
  ) => {
    const counts = new Map<string, number>();
    let total = 0;

    targetEntries.forEach((entry) => {
      entry.reasons.forEach((reason) => {
        if (reason.level === "pass") return;
        counts.set(reason.label, (counts.get(reason.label) ?? 0) + 1);
        total += 1;
      });
    });

    return { counts, total };
  };

  const operationalRecentReasonDistribution =
    operationalReasonDistribution(operationalRecentHalf);
  const operationalPriorReasonDistribution =
    operationalReasonDistribution(operationalPriorHalf);

  const operationalReasonLabels = new Set([
    ...operationalRecentReasonDistribution.counts.keys(),
    ...operationalPriorReasonDistribution.counts.keys(),
  ]);

  const operationalReasonShift =
    operationalRecentReasonDistribution.total > 0 &&
    operationalPriorReasonDistribution.total > 0
      ? Array.from(operationalReasonLabels).reduce((sum, label) => {
          const recentShare =
            (operationalRecentReasonDistribution.counts.get(label) ?? 0) /
            operationalRecentReasonDistribution.total;
          const priorShare =
            (operationalPriorReasonDistribution.counts.get(label) ?? 0) /
            operationalPriorReasonDistribution.total;
          return sum + Math.abs(recentShare - priorShare);
        }, 0) / 2
      : 0;

  const operationalReasonShiftSignal =
    operationalRecentReasonDistribution.total === 0 ||
    operationalPriorReasonDistribution.total === 0
      ? "Insufficient data"
      : operationalReasonShift >= 0.5
        ? "High"
        : operationalReasonShift >= 0.25
          ? "Moderate"
          : operationalReasonShift >= 0.1
            ? "Low"
            : "Stable";

  const operationalBundleVolatility = Array.from(
    dashboardEntries.reduce(
      (map, entry) => {
        const key =
          entry.bundleId ??
          `custom::${entry.bundleName ?? "Custom configuration"}`;
        const current = map.get(key) ?? {
          id: key,
          name: entry.bundleName ?? "Custom configuration",
          entries: [] as BundleExecutionGuardAuditEntry[],
        };
        current.entries.push(entry);
        map.set(key, current);
        return map;
      },
      new Map<
        string,
        {
          id: string;
          name: string;
          entries: BundleExecutionGuardAuditEntry[];
        }
      >(),
    ).values(),
  )
    .map((bundle) => {
      const ordered = [...bundle.entries].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime(),
      );

      let transitions = 0;
      let changedTransitions = 0;

      for (let index = 1; index < ordered.length; index += 1) {
        transitions += 1;
        const previous = ordered[index - 1];
        const current = ordered[index];

        if (
          previous.mode !== current.mode ||
          previous.budget !== current.budget ||
          previous.task.trim() !== current.task.trim() ||
          previous.guardMode !== current.guardMode
        ) {
          changedTransitions += 1;
        }
      }

      return {
        id: bundle.id,
        name: bundle.name,
        events: ordered.length,
        transitions,
        changedTransitions,
        volatility:
          transitions > 0 ? (changedTransitions / transitions) * 100 : 0,
      };
    })
    .sort((left, right) => right.volatility - left.volatility);

  const operationalMostVolatileBundle =
    operationalBundleVolatility[0] ?? null;

  const operationalLatestDay =
    operationalRiskTimeline[operationalRiskTimeline.length - 1] ?? null;

  const operationalBaselineRisk =
    operationalRiskTimeline.length > 1
      ? operationalRiskTimeline
          .slice(0, -1)
          .reduce((sum, day) => sum + day.riskPoints, 0) /
        Math.max(1, operationalRiskTimeline.length - 1)
      : 0;

  const operationalLatestRiskRatio =
    operationalLatestDay && operationalBaselineRisk > 0
      ? operationalLatestDay.riskPoints / operationalBaselineRisk
      : null;

  const operationalAnomalySignal =
    operationalSpikeDays.length > 0 ||
    (operationalLatestRiskRatio !== null &&
      operationalLatestRiskRatio >= 2.5)
      ? "Elevated"
      : operationalReasonShift >= 0.5
        ? "Watch"
        : "Normal";

  const operationalHistoricalBaseline = {
    dailyEvents: operationalVolumeMean,
    dailyRiskPoints:
      operationalRiskTimeline.length > 0
        ? operationalRiskTimeline.reduce(
            (sum, day) => sum + day.riskPoints,
            0,
          ) / operationalRiskTimeline.length
        : 0,
    blockRate,
  };

  const operationalIncidentEntries = [...dashboardEntries].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  const operationalIncidentEpisodes: Array<{
    id: string;
    startedAt: string;
    endedAt: string;
    entries: BundleExecutionGuardAuditEntry[];
    blocks: number;
    warnings: number;
    dominantReason: string | null;
    bundles: string[];
    severity: "critical" | "high" | "moderate";
    durationMinutes: number;
  }> = [];

  const operationalIncidentGapMs = 6 * 60 * 60 * 1000;

  operationalIncidentEntries.forEach((entry) => {
    const previousEpisode =
      operationalIncidentEpisodes[operationalIncidentEpisodes.length - 1];
    const createdAt = new Date(entry.createdAt).getTime();
    const previousEndedAt = previousEpisode
      ? new Date(previousEpisode.endedAt).getTime()
      : null;

    if (
      !previousEpisode ||
      previousEndedAt === null ||
      createdAt - previousEndedAt > operationalIncidentGapMs
    ) {
      operationalIncidentEpisodes.push({
        id: entry.id,
        startedAt: entry.createdAt,
        endedAt: entry.createdAt,
        entries: [entry],
        blocks: entry.outcome === "BLOCK" ? 1 : 0,
        warnings: entry.outcome === "WARN" ? 1 : 0,
        dominantReason: null,
        bundles: [
          entry.bundleName ?? entry.bundleId ?? "Custom configuration",
        ],
        severity: entry.outcome === "BLOCK" ? "high" : "moderate",
        durationMinutes: 0,
      });
      return;
    }

    previousEpisode.entries.push(entry);
    previousEpisode.endedAt = entry.createdAt;
    previousEpisode.blocks += entry.outcome === "BLOCK" ? 1 : 0;
    previousEpisode.warnings += entry.outcome === "WARN" ? 1 : 0;

    const bundleName =
      entry.bundleName ?? entry.bundleId ?? "Custom configuration";
    if (!previousEpisode.bundles.includes(bundleName)) {
      previousEpisode.bundles.push(bundleName);
    }
  });

  operationalIncidentEpisodes.forEach((episode) => {
    const reasonCounts = new Map<string, number>();

    episode.entries.forEach((entry) => {
      entry.reasons.forEach((reason) => {
        if (reason.level === "pass") return;
        reasonCounts.set(
          reason.label,
          (reasonCounts.get(reason.label) ?? 0) + 1,
        );
      });
    });

    episode.dominantReason =
      Array.from(reasonCounts.entries()).sort(
        (left, right) => right[1] - left[1],
      )[0]?.[0] ?? null;

    episode.durationMinutes = Math.max(
      0,
      Math.round(
        (new Date(episode.endedAt).getTime() -
          new Date(episode.startedAt).getTime()) /
          60000,
      ),
    );

    const riskScore = episode.blocks * 2 + episode.warnings;
    episode.severity =
      episode.blocks >= 3 || riskScore >= 8
        ? "critical"
        : episode.blocks >= 1 || riskScore >= 4
          ? "high"
          : "moderate";
  });

  const operationalQualifiedIncidentEpisodes =
    operationalIncidentEpisodes.filter(
      (episode) =>
        episode.blocks > 0 ||
        episode.warnings >= 2 ||
        episode.entries.length >= 2,
    );

  const operationalActiveIncident =
    operationalQualifiedIncidentEpisodes.length > 0
      ? operationalQualifiedIncidentEpisodes[
          operationalQualifiedIncidentEpisodes.length - 1
        ]
      : null;

  const operationalRootCauseClusters = Array.from(
    dashboardEntries.reduce(
      (map, entry) => {
        entry.reasons.forEach((reason) => {
          if (reason.level === "pass") return;

          const key = reason.label;
          const current = map.get(key) ?? {
            label: key,
            count: 0,
            blocks: 0,
            warnings: 0,
            bundles: new Set<string>(),
          };

          current.count += 1;
          current.blocks += entry.outcome === "BLOCK" ? 1 : 0;
          current.warnings += entry.outcome === "WARN" ? 1 : 0;
          current.bundles.add(
            entry.bundleName ?? entry.bundleId ?? "Custom configuration",
          );

          map.set(key, current);
        });

        return map;
      },
      new Map<
        string,
        {
          label: string;
          count: number;
          blocks: number;
          warnings: number;
          bundles: Set<string>;
        }
      >(),
    ).values(),
  )
    .map((cluster) => ({
      ...cluster,
      bundles: Array.from(cluster.bundles),
      severityScore: cluster.blocks * 2 + cluster.warnings,
    }))
    .sort((left, right) => right.severityScore - left.severityScore)
    .slice(0, 6);

  const operationalEpisodeDurations =
    operationalQualifiedIncidentEpisodes
      .filter((episode) => episode.durationMinutes > 0)
      .map((episode) => episode.durationMinutes);

  const operationalMeanRecoveryMinutes =
    operationalEpisodeDurations.length > 0
      ? operationalEpisodeDurations.reduce(
          (sum, value) => sum + value,
          0,
        ) / operationalEpisodeDurations.length
      : null;

  const operationalRecoveredIncidents =
    operationalQualifiedIncidentEpisodes.filter((episode, index) => {
      if (index === operationalQualifiedIncidentEpisodes.length - 1) return false;
      const next = operationalQualifiedIncidentEpisodes[index + 1];
      return (
        new Date(next.startedAt).getTime() -
          new Date(episode.endedAt).getTime() >
        operationalIncidentGapMs
      );
    }).length;

  const operationalSustainedDegradation =
    operationalRiskTimeline.length >= 3 &&
    operationalRiskTimeline
      .slice(-3)
      .every((day) => day.riskPoints > 0);

  const operationalIncidentHealth =
    operationalActiveIncident?.severity === "critical" ||
    operationalSustainedDegradation
      ? "Degraded"
      : operationalActiveIncident?.severity === "high"
        ? "At risk"
        : "Stable";

  const operationalForecastWindow = operationalRiskTimeline.slice(-7);
  const operationalForecastValues = operationalForecastWindow.map(
    (day) => day.riskPoints,
  );

  const operationalForecastTrend =
    operationalForecastValues.length >= 2
      ? (() => {
          const n = operationalForecastValues.length;
          const meanX = (n - 1) / 2;
          const meanY =
            operationalForecastValues.reduce((sum, value) => sum + value, 0) /
            n;

          let numerator = 0;
          let denominator = 0;

          operationalForecastValues.forEach((value, index) => {
            const dx = index - meanX;
            numerator += dx * (value - meanY);
            denominator += dx * dx;
          });

          return denominator > 0 ? numerator / denominator : 0;
        })()
      : 0;

  const operationalRecentRiskAverage =
    operationalForecastValues.length > 0
      ? operationalForecastValues.reduce((sum, value) => sum + value, 0) /
        operationalForecastValues.length
      : 0;

  const operationalForecastRiskPoints = Math.max(
    0,
    operationalRecentRiskAverage + operationalForecastTrend * 2,
  );

  const operationalForecastObservationCount = dashboardEntries.length;

  const operationalForecastSignal =
    operationalForecastObservationCount < 4
      ? "Insufficient data"
      : operationalForecastRiskPoints >=
          Math.max(4, operationalHistoricalBaseline.dailyRiskPoints * 1.75)
        ? "High"
        : operationalForecastRiskPoints >=
            Math.max(2, operationalHistoricalBaseline.dailyRiskPoints * 1.15)
          ? "Elevated"
          : "Low";

  const operationalForecastConfidence =
    operationalForecastObservationCount >= 20
      ? "High"
      : operationalForecastObservationCount >= 8
        ? "Medium"
        : operationalForecastObservationCount >= 4
          ? "Low"
          : "Insufficient data";

  const operationalLikelyNextCause =
    operationalRootCauseClusters[0]?.label ??
    topReasons[0]?.label ??
    "No dominant cause";

  const operationalClosedIncidents = Math.max(
    0,
    operationalQualifiedIncidentEpisodes.length -
      (operationalActiveIncident ? 1 : 0),
  );

  const operationalRecoveryRate =
    operationalClosedIncidents > 0
      ? operationalRecoveredIncidents / operationalClosedIncidents
      : null;

  const operationalRecentRiskValues = operationalRiskTimeline
    .slice(-3)
    .map((day) => day.riskPoints);

  const operationalRiskDeclining =
    operationalRecentRiskValues.length >= 2 &&
    operationalRecentRiskValues.every(
      (value, index, values) => index === 0 || value <= values[index - 1],
    );

  const operationalRecoveryConfidence =
    operationalIncidentHealth === "Stable" && operationalRiskDeclining
      ? "High"
      : operationalRecoveryRate !== null &&
          operationalRecoveryRate >= 0.7 &&
          !operationalSustainedDegradation
        ? "Medium"
        : "Low";

  const operationalHighestRecentRiskDay = operationalRiskTimeline.reduce<
    (typeof operationalRiskTimeline)[number] | null
  >((highest, day) => {
    if (!highest || day.riskPoints > highest.riskPoints) return day;
    return highest;
  }, null);

  const operationalHighestRiskDayIndex =
    operationalHighestRecentRiskDay === null
      ? -1
      : operationalRiskTimeline.findIndex(
          (day) => day.label === operationalHighestRecentRiskDay.label,
        );

  const operationalPreviousRiskDay =
    operationalHighestRiskDayIndex > 0
      ? operationalRiskTimeline[operationalHighestRiskDayIndex - 1]
      : null;

  const operationalPreRiskChanges: string[] = [];

  if (
    operationalHighestRecentRiskDay &&
    operationalPreviousRiskDay &&
    operationalHighestRecentRiskDay.riskPoints >
      operationalPreviousRiskDay.riskPoints
  ) {
    const highDayDate = new Date(operationalHighestRecentRiskDay.label);
    const previousDayDate = new Date(operationalPreviousRiskDay.label);

    const highDayEntries = dashboardEntries.filter((entry) => {
      const created = new Date(entry.createdAt);
      return (
        created.getFullYear() === highDayDate.getFullYear() &&
        created.getMonth() === highDayDate.getMonth() &&
        created.getDate() === highDayDate.getDate()
      );
    });

    const previousDayEntries = dashboardEntries.filter((entry) => {
      const created = new Date(entry.createdAt);
      return (
        created.getFullYear() === previousDayDate.getFullYear() &&
        created.getMonth() === previousDayDate.getMonth() &&
        created.getDate() === previousDayDate.getDate()
      );
    });

    const latestHigh = highDayEntries[highDayEntries.length - 1];
    const latestPrevious = previousDayEntries[previousDayEntries.length - 1];

    if (latestHigh && latestPrevious) {
      if (latestHigh.mode !== latestPrevious.mode) {
        operationalPreRiskChanges.push(
          `Retrieval mode changed: ${latestPrevious.mode} → ${latestHigh.mode}`,
        );
      }
      if (latestHigh.guardMode !== latestPrevious.guardMode) {
        operationalPreRiskChanges.push(
          `Guard mode changed: ${latestPrevious.guardMode} → ${latestHigh.guardMode}`,
        );
      }
      if (latestHigh.budget !== latestPrevious.budget) {
        operationalPreRiskChanges.push(
          `Token budget changed: ${latestPrevious.budget} → ${latestHigh.budget}`,
        );
      }
      if (latestHigh.task.trim() !== latestPrevious.task.trim()) {
        operationalPreRiskChanges.push("Task scope changed before risk increased");
      }
      if (
        (latestHigh.bundleId ?? "") !==
        (latestPrevious.bundleId ?? "")
      ) {
        operationalPreRiskChanges.push("Active policy bundle changed");
      }
    }
  }

  if (
    operationalPreRiskChanges.length === 0 &&
    operationalReasonShift >= 0.25
  ) {
    operationalPreRiskChanges.push(
      `Guard-reason distribution shifted ${(operationalReasonShift * 100).toFixed(
        1,
      )}%`,
    );
  }

  if (
    operationalPreRiskChanges.length === 0 &&
    operationalMostVolatileBundle &&
    operationalMostVolatileBundle.volatility >= 40
  ) {
    operationalPreRiskChanges.push(
      `${operationalMostVolatileBundle.name} configuration volatility reached ${operationalMostVolatileBundle.volatility.toFixed(
        1,
      )}%`,
    );
  }

  const operationalRemediationCandidates: Array<{
    id: string;
    title: string;
    detail: string;
    impact: number;
    confidence: "high" | "medium" | "low";
  }> = [];

  if (operationalRootCauseClusters[0]) {
    operationalRemediationCandidates.push({
      id: "root-cause",
      title: `Address ${operationalRootCauseClusters[0].label}`,
      detail: `This is the highest-severity recurring cause across ${operationalRootCauseClusters[0].count} observations and ${operationalRootCauseClusters[0].bundles.length} bundle(s).`,
      impact: Math.min(
        100,
        45 + operationalRootCauseClusters[0].severityScore * 8,
      ),
      confidence: operationalRootCauseClusters[0].count >= 3 ? "high" : "medium",
    });
  }

  if (
    operationalMostVolatileBundle &&
    operationalMostVolatileBundle.volatility >= 25
  ) {
    operationalRemediationCandidates.push({
      id: "bundle-volatility",
      title: `Stabilize ${operationalMostVolatileBundle.name}`,
      detail: `${operationalMostVolatileBundle.volatility.toFixed(
        1,
      )}% of observed configuration transitions changed mode, budget, task, or guard mode.`,
      impact: Math.min(
        95,
        35 + operationalMostVolatileBundle.volatility * 0.7,
      ),
      confidence:
        operationalMostVolatileBundle.transitions >= 3 ? "high" : "medium",
    });
  }

  if (operationalReasonShift >= 0.25) {
    operationalRemediationCandidates.push({
      id: "reason-shift",
      title: "Review newly dominant guard reasons",
      detail: `Reason distribution shifted ${(operationalReasonShift * 100).toFixed(
        1,
      )}% between the prior and recent halves of the selected window.`,
      impact: Math.min(90, 40 + operationalReasonShift * 80),
      confidence:
        operationalRecentReasonDistribution.total >= 5 &&
        operationalPriorReasonDistribution.total >= 5
          ? "high"
          : "medium",
    });
  }

  if (blockRate >= 40) {
    operationalRemediationCandidates.push({
      id: "block-pressure",
      title: "Reduce repeated blocking pressure",
      detail: `${blockRate.toFixed(
        1,
      )}% of selected audit events are BLOCK outcomes. Correct the top recurring policy violation before changing guard strictness.`,
      impact: Math.min(100, 50 + blockRate * 0.5),
      confidence: dashboardEntries.length >= 10 ? "high" : "medium",
    });
  }

  if (operationalSustainedDegradation) {
    operationalRemediationCandidates.push({
      id: "sustained-degradation",
      title: "Treat recent activity as a sustained incident",
      detail:
        "Risk remained active across the latest three timeline days. Freeze avoidable configuration changes until the incident pattern clears.",
      impact: 92,
      confidence: "high",
    });
  }

  if (operationalRemediationCandidates.length === 0) {
    operationalRemediationCandidates.push({
      id: "maintain",
      title: "Maintain current guard posture",
      detail:
        "No strong remediation trigger is present. Continue monitoring drift, incidents, and recurring causes before changing thresholds.",
      impact: 25,
      confidence: "medium",
    });
  }

  const operationalRemediationPlan = operationalRemediationCandidates
    .sort((left, right) => right.impact - left.impact)
    .slice(0, 5);

  const actionableSummary =
    dashboardEntries.length === 0
      ? "No execution-guard events have been recorded yet."
      : blockRate >= 50
        ? "Blocking pressure is high. Review the dominant guard causes and the highest-risk bundle before relaxing policy."
        : topReasons.length > 0 && recentConfigurationVariants >= 4
          ? "Guard pressure is mixed with configuration drift. Stabilize the active bundle and address the most frequent rejection cause."
          : blockRateDelta !== null && blockRateDelta > 15
            ? "Block rate has risen materially versus the prior week. Inspect recent configuration changes and newly dominant reasons."
            : "Guard behavior is currently controlled. Continue monitoring dominant causes and bundle drift before changing thresholds.";

  return (
    <section className="cf-premium-card mt-4 overflow-hidden rounded-[28px] border border-white/80 bg-white/78 shadow-[0_22px_60px_rgba(55,65,81,.09)]">
      <div className="border-b border-slate-200/65 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#0a84ff]" />
              <h3 className="text-[15px] font-semibold text-slate-950">
                Operational intelligence
              </h3>
            </div>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
              Execution-guard health, dominant failure causes, bundle risk, and
              configuration drift from the local audit history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={operationalDashboardWindow}
              onChange={(event) =>
                setOperationalDashboardWindow(
                  Number(event.target.value) as 7 | 30 | 90,
                )
              }
              className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 outline-none transition focus:border-[#0a84ff]/40 focus:ring-2 focus:ring-[#0a84ff]/10"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>

            <select
              value={operationalDashboardBundle}
              onChange={(event) => setOperationalDashboardBundle(event.target.value)}
              className="max-w-[220px] rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 outline-none transition focus:border-[#0a84ff]/40 focus:ring-2 focus:ring-[#0a84ff]/10"
            >
              <option value="all">All bundles</option>
              {availableBundles.map((bundle) => (
                <option key={bundle.id} value={bundle.id}>
                  {bundle.name}
                </option>
              ))}
            </select>

            <span className="rounded-full border border-slate-200/70 bg-slate-50/80 px-3 py-1.5 text-[9px] font-semibold text-slate-500">
              {dashboardEntries.length} audited events
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Block rate</p>
          <p className="mt-2 text-[24px] font-semibold text-slate-950">{blockRate.toFixed(1)}%</p>
          <p className="mt-1 text-[9px] text-slate-500">
            {blockCount} blocked · {warnCount} warned
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">7-day block trend</p>
          <p className="mt-2 text-[24px] font-semibold text-slate-950">{recentBlockRate.toFixed(1)}%</p>
          <p className={`mt-1 text-[9px] font-medium ${
            blockRateDelta === null
              ? "text-slate-400"
              : blockRateDelta > 0
                ? "text-rose-600"
                : blockRateDelta < 0
                  ? "text-emerald-600"
                  : "text-slate-500"
          }`}>
            {blockRateDelta === null
              ? "Need prior-week data"
              : `${blockRateDelta > 0 ? "+" : ""}${blockRateDelta.toFixed(1)} pp vs prior week`}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Config drift</p>
          <p className="mt-2 text-[24px] font-semibold text-slate-950">{driftSignal}</p>
          <p className="mt-1 text-[9px] text-slate-500">{recentConfigurationVariants} recent variants</p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Dominant cause</p>
          <p className="mt-2 line-clamp-2 text-[12px] font-semibold text-slate-900">
            {topReasons[0]?.label ?? "No guard cause yet"}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">
            {topReasons[0] ? `${topReasons[0].count} occurrences` : "Awaiting audit data"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-200/65 px-4 py-4 sm:px-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-800">Recent guard activity</p>
              <p className="mt-1 text-[9px] text-slate-400">WARN and BLOCK volume by day</p>
            </div>
            <span className="text-[9px] text-slate-400">{recent7d.length} events</span>
          </div>

          <div className="mt-5 flex h-32 items-end gap-2">
            {recentDays.map((day) => (
              <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end justify-center gap-1">
                  <div
                    title={`${day.warnings} WARN`}
                    className="w-[34%] rounded-t-md bg-amber-300/80 transition-all"
                    style={{
                      height: `${Math.max(day.warnings ? 8 : 0, (day.warnings / maxDailyEvents) * 96)}px`,
                    }}
                  />
                  <div
                    title={`${day.blocks} BLOCK`}
                    className="w-[34%] rounded-t-md bg-rose-400/80 transition-all"
                    style={{
                      height: `${Math.max(day.blocks ? 8 : 0, (day.blocks / maxDailyEvents) * 96)}px`,
                    }}
                  />
                </div>
                <span className="text-[8px] font-medium text-slate-400">{day.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-4 text-[8px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-300/80" />
              WARN
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400/80" />
              BLOCK
            </span>
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
          <p className="text-[10px] font-semibold text-slate-800">Actionable summary</p>
          <p className="mt-2 text-[10px] leading-5 text-slate-600">{actionableSummary}</p>

          <div className="mt-4 rounded-xl border border-[#0a84ff]/10 bg-[#0a84ff]/5 p-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#0a84ff]">Current signal</p>
            <p className="mt-1 text-[9px] leading-4 text-slate-600">
              {blockRate >= 50
                ? "Policy pressure is dominated by BLOCK outcomes."
                : recentConfigurationVariants >= 4
                  ? "Configuration churn is the primary operational signal."
                  : topReasons[0]
                    ? `Most frequent cause: ${topReasons[0].label}.`
                    : "No dominant guard pattern has emerged."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t border-slate-200/65 px-4 py-4 sm:grid-cols-3 sm:px-5">
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Cause concentration
          </p>
          <p className="mt-2 text-[22px] font-semibold text-slate-950">
            {topReasonConcentration.toFixed(1)}%
          </p>
          <p className="mt-1 text-[9px] text-slate-500">
            Share of guard reasons from the dominant cause
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Window
          </p>
          <p className="mt-2 text-[22px] font-semibold text-slate-950">
            {operationalDashboardWindow}d
          </p>
          <p className="mt-1 text-[9px] text-slate-500">
            {operationalDashboardBundle === "all"
              ? "All bundles"
              : availableBundles.find(
                  (bundle) => bundle.id === operationalDashboardBundle,
                )?.name ?? "Selected bundle"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
          <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Snapshot
          </p>
          <button
            type="button"
            onClick={exportOperationalSnapshot}
            className="mt-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Export dashboard JSON
          </button>
          <p className="mt-2 text-[8px] leading-4 text-slate-400">
            Includes metrics, trend, dominant causes, risk ranking, and filters.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200/65 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-800">
              Anomaly + drift intelligence
            </p>
            <p className="mt-1 text-[9px] leading-4 text-slate-400">
              Historical baseline, activity spikes, reason-distribution change,
              bundle volatility, and compact risk timeline.
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-2.5 py-1 text-[8px] font-bold ${
              operationalAnomalySignal === "Elevated"
                ? "bg-rose-50 text-rose-700"
                : operationalAnomalySignal === "Watch"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {operationalAnomalySignal} risk signal
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Activity spikes
            </p>
            <p className="mt-2 text-[22px] font-semibold text-slate-950">
              {operationalSpikeDays.length}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              Threshold {operationalSpikeThreshold.toFixed(1)} events/day
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Reason distribution shift
            </p>
            <p className="mt-2 text-[15px] font-semibold text-slate-950">
              {operationalReasonShiftSignal}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              {(operationalReasonShift * 100).toFixed(1)}% distribution distance
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Bundle volatility
            </p>
            <p className="mt-2 truncate text-[12px] font-semibold text-slate-950">
              {operationalMostVolatileBundle?.name ?? "No bundle data"}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              {operationalMostVolatileBundle
                ? `${operationalMostVolatileBundle.volatility.toFixed(
                    1,
                  )}% changed transitions`
                : "Need multiple events"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Historical baseline
            </p>
            <p className="mt-2 text-[15px] font-semibold text-slate-950">
              {operationalHistoricalBaseline.dailyEvents.toFixed(1)} events/day
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              {operationalHistoricalBaseline.dailyRiskPoints.toFixed(1)} risk points/day
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[22px] border border-slate-200/70 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold text-slate-800">
                Compact risk timeline
              </p>
              <p className="mt-1 text-[8px] text-slate-400">
                Up to 30 days · BLOCK counts double WARN in risk intensity
              </p>
            </div>
            <span className="text-[8px] font-medium text-slate-400">
              {operationalTimelineDays}d
            </span>
          </div>

          <div className="mt-4 flex h-24 items-end gap-1">
            {operationalRiskTimeline.map((day) => {
              const height =
                day.riskPoints > 0
                  ? Math.max(
                      7,
                      (day.riskPoints / operationalMaxRiskPoints) * 78,
                    )
                  : 3;

              return (
                <div
                  key={day.label}
                  className="group relative flex min-w-0 flex-1 items-end justify-center"
                  title={`${day.label}: ${day.blocks} BLOCK, ${day.warnings} WARN`}
                >
                  <div
                    className={`w-full max-w-[14px] rounded-t-sm transition-all ${
                      day.blocks > 0
                        ? "bg-rose-400/80"
                        : day.warnings > 0
                          ? "bg-amber-300/80"
                          : "bg-slate-200/75"
                    }`}
                    style={{ height: `${height}px` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[8px] text-slate-400">
            <span>
              Latest risk ratio:{" "}
              {operationalLatestRiskRatio === null
                ? "—"
                : `${operationalLatestRiskRatio.toFixed(2)}× baseline`}
            </span>
            <span>
              Highest volatility:{" "}
              {operationalMostVolatileBundle
                ? `${operationalMostVolatileBundle.volatility.toFixed(1)}%`
                : "—"}
            </span>
            <span>
              Reason shift: {(operationalReasonShift * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/65 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-800">
              Incident intelligence
            </p>
            <p className="mt-1 text-[9px] leading-4 text-slate-400">
              Groups nearby guard events into incidents, clusters recurring guard triggers,
              tracks recovery, and flags sustained degradation.
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-2.5 py-1 text-[8px] font-bold ${
              operationalIncidentHealth === "Degraded"
                ? "bg-rose-50 text-rose-700"
                : operationalIncidentHealth === "At risk"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {operationalIncidentHealth}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Incident episodes
            </p>
            <p className="mt-2 text-[22px] font-semibold text-slate-950">
              {operationalQualifiedIncidentEpisodes.length}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              Grouped by 6-hour event gaps
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Recovery time
            </p>
            <p className="mt-2 text-[15px] font-semibold text-slate-950">
              {operationalMeanRecoveryMinutes === null
                ? "—"
                : `${operationalMeanRecoveryMinutes.toFixed(0)} min`}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              {operationalRecoveredIncidents} recovered episodes
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Sustained degradation
            </p>
            <p className="mt-2 text-[15px] font-semibold text-slate-950">
              {operationalSustainedDegradation ? "Detected" : "Not detected"}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              Based on continuing recent risk activity
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Active severity
            </p>
            <p className="mt-2 text-[15px] font-semibold capitalize text-slate-950">
              {operationalActiveIncident?.severity ?? "none"}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              {operationalActiveIncident
                ? `${operationalActiveIncident.blocks} block · ${operationalActiveIncident.warnings} warn`
                : "No incident data"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-800">
                  Incident timeline
                </p>
                <p className="mt-1 text-[8px] text-slate-400">
                  Latest grouped episodes with severity and recovery duration
                </p>
              </div>
              <span className="text-[8px] text-slate-400">
                Last {Math.min(6, operationalQualifiedIncidentEpisodes.length)}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {operationalQualifiedIncidentEpisodes.length > 0 ? (
                operationalQualifiedIncidentEpisodes
                  .slice(-6)
                  .reverse()
                  .map((episode) => (
                    <div
                      key={`${episode.id}-${episode.startedAt}`}
                      className="rounded-xl border border-slate-200/65 bg-slate-50/55 px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold text-slate-700">
                            {new Date(episode.startedAt).toLocaleString()}
                          </p>
                          <p className="mt-1 text-[8px] text-slate-400">
                            {episode.blocks} block · {episode.warnings} warn ·{" "}
                            {episode.durationMinutes} min
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${
                            episode.severity === "critical"
                              ? "bg-rose-50 text-rose-700"
                              : episode.severity === "high"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {episode.severity}
                        </span>
                      </div>

                      <p className="mt-2 text-[8px] leading-4 text-slate-500">
                        Guard trigger: {episode.dominantReason ?? "Unclassified"}
                      </p>
                    </div>
                  ))
              ) : (
                <p className="text-[9px] text-slate-400">
                  No incident episodes in this analysis window.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-800">
                  Guard-trigger clusters
                </p>
                <p className="mt-1 text-[8px] text-slate-400">
                  Recurring guard reasons weighted by severity
                </p>
              </div>
              <span className="text-[8px] text-slate-400">Top 6</span>
            </div>

            <div className="mt-3 space-y-2">
              {operationalRootCauseClusters.length > 0 ? (
                operationalRootCauseClusters.map((cluster) => (
                  <div
                    key={cluster.label}
                    className="rounded-xl border border-slate-200/65 bg-slate-50/55 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[9px] font-semibold text-slate-700">
                          {cluster.label}
                        </p>
                        <p className="mt-1 text-[8px] text-slate-400">
                          {cluster.blocks} block · {cluster.warnings} warn ·{" "}
                          {cluster.bundles.length} bundles
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-semibold text-slate-600">
                        {cluster.count}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[9px] text-slate-400">
                  No guard-trigger clusters available.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/65 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-800">
              Forecasting + remediation intelligence
            </p>
            <p className="mt-1 text-[9px] leading-4 text-slate-400">
              Near-term risk forecast, likely next cause, recovery confidence,
              pre-risk change analysis, and ranked remediation actions.
              Forecasting is withheld until at least 4 audit observations exist.
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-2.5 py-1 text-[8px] font-bold ${
              operationalForecastSignal === "High"
                ? "bg-rose-50 text-rose-700"
                : operationalForecastSignal === "Elevated"
                  ? "bg-amber-50 text-amber-700"
                  : operationalForecastSignal === "Insufficient data"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {operationalForecastSignal} forecast
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Near-term risk
            </p>
            <p className="mt-2 text-[22px] font-semibold text-slate-950">
              {operationalForecastObservationCount < 4 ? "—" : operationalForecastRiskPoints.toFixed(1)}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              Risk points · {operationalForecastConfidence} confidence
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Likely next cause
            </p>
            <p className="mt-2 line-clamp-2 text-[12px] font-semibold text-slate-950">
              {operationalLikelyNextCause}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              Based on severity-weighted recurring causes
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Recovery confidence
            </p>
            <p className="mt-2 text-[15px] font-semibold text-slate-950">
              {operationalRecoveryConfidence}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              {operationalRecoveryRate === null
                ? "Insufficient closed incidents"
                : `${(operationalRecoveryRate * 100).toFixed(0)}% observed recovery rate`}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/65 p-4">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Forecast trend
            </p>
            <p className={`mt-2 text-[15px] font-semibold ${
              operationalForecastTrend > 0.35
                ? "text-rose-700"
                : operationalForecastTrend < -0.35
                  ? "text-emerald-700"
                  : "text-slate-950"
            }`}>
              {operationalForecastTrend > 0.35
                ? "Rising"
                : operationalForecastTrend < -0.35
                  ? "Falling"
                  : "Flat"}
            </p>
            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              {operationalForecastTrend > 0 ? "+" : ""}
              {operationalForecastTrend.toFixed(2)} risk points/day
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
          <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
            <div>
              <p className="text-[10px] font-semibold text-slate-800">
                What changed before risk increased
              </p>
              <p className="mt-1 text-[8px] text-slate-400">
                Configuration and distribution changes associated with the highest recent risk increase
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {operationalPreRiskChanges.length > 0 ? (
                operationalPreRiskChanges.map((change, index) => (
                  <div
                    key={`${change}-${index}`}
                    className="rounded-xl border border-amber-200/70 bg-amber-50/45 px-3 py-2.5 text-[9px] leading-4 text-slate-600"
                  >
                    {change}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/45 px-3 py-2.5 text-[9px] leading-4 text-emerald-700">
                  No clear configuration change preceded the strongest recent risk increase.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-800">
                  Ranked remediation plan
                </p>
                <p className="mt-1 text-[8px] text-slate-400">
                  Deterministic actions ranked by expected operational impact
                </p>
              </div>
              <span className="text-[8px] text-slate-400">
                Top {operationalRemediationPlan.length}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {operationalRemediationPlan.map((action, index) => (
                <div
                  key={action.id}
                  className="rounded-xl border border-slate-200/65 bg-slate-50/55 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold text-slate-700">
                        {index + 1}. {action.title}
                      </p>
                      <p className="mt-1 text-[8px] leading-4 text-slate-400">
                        {action.detail}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${
                        action.impact >= 80
                          ? "bg-rose-50 text-rose-700"
                          : action.impact >= 55
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}>
                        {action.impact.toFixed(0)}
                      </span>
                      <p className="mt-1 text-[7px] uppercase tracking-[0.08em] text-slate-400">
                        {action.confidence} conf.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-200/65 px-4 py-4 sm:px-5 lg:grid-cols-2">
        <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold text-slate-800">Dominant guard causes</p>
            <span className="text-[8px] text-slate-400">Top 5</span>
          </div>

          <div className="mt-3 space-y-2">
            {topReasons.length > 0 ? (
              topReasons.map((reason) => (
                <div key={`${reason.level}-${reason.label}-${reason.detail}`} className="rounded-xl border border-slate-200/65 bg-slate-50/55 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-semibold text-slate-700">{reason.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${
                      reason.level === "block"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      {reason.count}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[8px] leading-4 text-slate-400">{reason.detail}</p>
                </div>
              ))
            ) : (
              <p className="text-[9px] text-slate-400">No actionable guard causes recorded.</p>
            )}
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200/70 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold text-slate-800">Bundle risk ranking</p>
            <span className="text-[8px] text-slate-400">Weighted by BLOCK severity</span>
          </div>

          <div className="mt-3 space-y-2">
            {riskyBundles.length > 0 ? (
              riskyBundles.map((bundle) => (
                <div key={`${bundle.name}-${bundle.latestAt}`} className="rounded-xl border border-slate-200/65 bg-slate-50/55 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[9px] font-semibold text-slate-700">{bundle.name}</p>
                      <p className="mt-1 text-[8px] text-slate-400">
                        {bundle.blocks} block · {bundle.warnings} warn · {bundle.total} total
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${
                      bundle.riskScore >= 70
                        ? "bg-rose-50 text-rose-700"
                        : bundle.riskScore >= 40
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {bundle.total < operationalRiskRankingMinimumEvents ? "—" : bundle.riskScore.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[9px] text-slate-400">No bundle risk data available.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function BundleExecutionGuardAuditTrail({
  entries,
  onClear,
  onDeleteSelected,
}: {
  entries: BundleExecutionGuardAuditEntry[];
  onClear: () => void;
  onDeleteSelected: (ids: string[]) => void;
}) {
  const [bundleExecutionGuardAuditQuery, setBundleExecutionGuardAuditQuery] = useState("");
  const [bundleExecutionGuardAuditOutcome, setBundleExecutionGuardAuditOutcome] =
    useState<"all" | "WARN" | "BLOCK">("all");
  const [bundleExecutionGuardAuditDateRange, setBundleExecutionGuardAuditDateRange] =
    useState<"all" | "24h" | "7d" | "30d">("all");
  const [bundleExecutionGuardAuditSort, setBundleExecutionGuardAuditSort] =
    useState<"newest" | "oldest">("newest");
  const [bundleExecutionGuardAuditVisibleCount, setBundleExecutionGuardAuditVisibleCount] =
    useState(20);
  const [bundleExecutionGuardAuditSelectedIds, setBundleExecutionGuardAuditSelectedIds] =
    useState<string[]>([]);
  const [bundleExecutionGuardAuditDeleteConfirmOpen, setBundleExecutionGuardAuditDeleteConfirmOpen] =
    useState(false);
  const [bundleExecutionGuardAuditInspectorId, setBundleExecutionGuardAuditInspectorId] =
    useState<string | null>(null);
  const [bundleExecutionGuardAuditCompareOpen, setBundleExecutionGuardAuditCompareOpen] =
    useState(false);

  const normalizedAuditQuery = bundleExecutionGuardAuditQuery.trim().toLowerCase();
  const [auditNow] = useState(Date.now);

  const filteredEntries = entries
    .filter((entry) => {
      if (
        bundleExecutionGuardAuditOutcome !== "all" &&
        entry.outcome !== bundleExecutionGuardAuditOutcome
      ) {
        return false;
      }

      if (bundleExecutionGuardAuditDateRange !== "all") {
        const ageMs = auditNow - new Date(entry.createdAt).getTime();
        const maxAgeMs =
          bundleExecutionGuardAuditDateRange === "24h"
            ? 24 * 60 * 60 * 1000
            : bundleExecutionGuardAuditDateRange === "7d"
              ? 7 * 24 * 60 * 60 * 1000
              : 30 * 24 * 60 * 60 * 1000;

        if (ageMs < 0 || ageMs > maxAgeMs) {
          return false;
        }
      }

      if (!normalizedAuditQuery) {
        return true;
      }

      const haystack = [
      entry.bundleName ?? "",
      entry.bundleId ?? "",
      entry.mode,
      String(entry.budget),
      entry.task,
      entry.outcome,
      entry.guardMode,
      ...entry.reasons.flatMap((reason) => [
        reason.level,
        reason.label,
        reason.detail,
      ]),
    ]
      .join(" ")
      .toLowerCase();

      return haystack.includes(normalizedAuditQuery);
    })
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return bundleExecutionGuardAuditSort === "newest"
        ? rightTime - leftTime
        : leftTime - rightTime;
    });

  const warnCount = entries.filter((entry) => entry.outcome === "WARN").length;
  const blockCount = entries.filter((entry) => entry.outcome === "BLOCK").length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBundleExecutionGuardAuditVisibleCount(20);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    bundleExecutionGuardAuditQuery,
    bundleExecutionGuardAuditOutcome,
    bundleExecutionGuardAuditDateRange,
    bundleExecutionGuardAuditSort,
  ]);

  const visibleAuditEntries = filteredEntries.slice(
    0,
    bundleExecutionGuardAuditVisibleCount,
  );
  const remainingAuditEntries = Math.max(
    0,
    filteredEntries.length - visibleAuditEntries.length,
  );

  const selectedAuditEntries = entries.filter((entry) =>
    bundleExecutionGuardAuditSelectedIds.includes(entry.id),
  );
  const inspectedAuditEntry =
    entries.find((entry) => entry.id === bundleExecutionGuardAuditInspectorId) ?? null;
  const comparedAuditEntries =
    selectedAuditEntries.length === 2
      ? [selectedAuditEntries[0], selectedAuditEntries[1]]
      : null;

  const compareAuditReasonKey = (
    reason: BundleExecutionGuardAuditEntry["reasons"][number],
  ) => `${reason.level}::${reason.label}::${reason.detail}`;

  const compareAuditChangedFields = comparedAuditEntries
    ? [
        comparedAuditEntries[0].outcome !== comparedAuditEntries[1].outcome
          ? "Outcome"
          : null,
        comparedAuditEntries[0].guardMode !== comparedAuditEntries[1].guardMode
          ? "Guard mode"
          : null,
        comparedAuditEntries[0].mode !== comparedAuditEntries[1].mode
          ? "Retrieval mode"
          : null,
        comparedAuditEntries[0].budget !== comparedAuditEntries[1].budget
          ? "Token budget"
          : null,
        (comparedAuditEntries[0].bundleName ?? "") !==
        (comparedAuditEntries[1].bundleName ?? "")
          ? "Bundle"
          : null,
        (comparedAuditEntries[0].bundleId ?? "") !==
        (comparedAuditEntries[1].bundleId ?? "")
          ? "Bundle ID"
          : null,
        comparedAuditEntries[0].task.trim() !== comparedAuditEntries[1].task.trim()
          ? "Task"
          : null,
        JSON.stringify(
          comparedAuditEntries[0].reasons.map(compareAuditReasonKey).sort(),
        ) !==
        JSON.stringify(
          comparedAuditEntries[1].reasons.map(compareAuditReasonKey).sort(),
        )
          ? "Guard reasons"
          : null,
      ].filter((field): field is string => field !== null)
    : [];

  const compareAuditOutcomeRank = (
    outcome: BundleExecutionGuardAuditEntry["outcome"],
  ) => (outcome === "BLOCK" ? 2 : 1);

  const compareAuditSeverityDirection = comparedAuditEntries
    ? compareAuditOutcomeRank(comparedAuditEntries[1].outcome) -
      compareAuditOutcomeRank(comparedAuditEntries[0].outcome)
    : 0;

  const compareAuditBudgetDelta = comparedAuditEntries
    ? comparedAuditEntries[1].budget - comparedAuditEntries[0].budget
    : 0;

  const compareAuditReasonDiff = comparedAuditEntries
    ? (() => {
        const left = new Set(
          comparedAuditEntries[0].reasons.map(compareAuditReasonKey),
        );
        const right = new Set(
          comparedAuditEntries[1].reasons.map(compareAuditReasonKey),
        );

        return {
          added: comparedAuditEntries[1].reasons.filter(
            (reason) => !left.has(compareAuditReasonKey(reason)),
          ),
          removed: comparedAuditEntries[0].reasons.filter(
            (reason) => !right.has(compareAuditReasonKey(reason)),
          ),
        };
      })()
    : { added: [], removed: [] };

  const compareAuditFieldChanged = (field: string) =>
    compareAuditChangedFields.includes(field);

  const exportAuditComparisonJson = () => {
    if (!comparedAuditEntries) return;

    const payload = {
      type: "contextforge-bundle-execution-guard-audit-comparison",
      version: 1,
      exportedAt: new Date().toISOString(),
      changedFields: compareAuditChangedFields,
      severityDirection: compareAuditSeverityDirection,
      budgetDelta: compareAuditBudgetDelta,
      reasonDiff: compareAuditReasonDiff,
      events: comparedAuditEntries,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contextforge-guard-audit-comparison-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const allFilteredAuditSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((entry) =>
      bundleExecutionGuardAuditSelectedIds.includes(entry.id),
    );

  const toggleAuditSelection = (id: string) => {
    setBundleExecutionGuardAuditSelectedIds((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id],
    );
  };

  const toggleAllFilteredAuditSelection = () => {
    setBundleExecutionGuardAuditSelectedIds((current) => {
      if (allFilteredAuditSelected) {
        const filteredIds = new Set(filteredEntries.map((entry) => entry.id));
        return current.filter((id) => !filteredIds.has(id));
      }

      return Array.from(
        new Set([...current, ...filteredEntries.map((entry) => entry.id)]),
      );
    });
  };

  const clearAuditSelection = () => {
    setBundleExecutionGuardAuditSelectedIds([]);
  };

  const deleteSelectedAuditEntries = () => {
    if (selectedAuditEntries.length === 0) return;

    onDeleteSelected(selectedAuditEntries.map((entry) => entry.id));
    setBundleExecutionGuardAuditSelectedIds([]);
    setBundleExecutionGuardAuditDeleteConfirmOpen(false);
  };

  const exportSelectedAuditJson = () => {
    if (selectedAuditEntries.length === 0) return;

    const payload = {
      type: "contextforge-bundle-execution-guard-audit-selection",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: selectedAuditEntries,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `contextforge-guard-audit-selection-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="cf-premium-card mt-4 overflow-hidden rounded-[26px] border border-white/80 bg-white/78 shadow-[0_18px_50px_rgba(55,65,81,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/65 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0a84ff]" />
            <h3 className="text-[15px] font-semibold text-slate-950">
              Execution guard audit trail
            </h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">
            Warned and blocked compile attempts are recorded with exact preflight reasons.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <BundleExecutionGuardAuditExport entries={entries} />
          <button
            type="button"
            onClick={onClear}
            disabled={entries.length === 0}
            className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Clear guard audit
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200/65 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBundleExecutionGuardAuditOutcome("all")}
              className={`rounded-xl border px-3 py-2 text-[9px] font-semibold transition ${
                bundleExecutionGuardAuditOutcome === "all"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              All · {entries.length}
            </button>

            <button
              type="button"
              onClick={() => setBundleExecutionGuardAuditOutcome("WARN")}
              className={`rounded-xl border px-3 py-2 text-[9px] font-semibold transition ${
                bundleExecutionGuardAuditOutcome === "WARN"
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              WARN · {warnCount}
            </button>

            <button
              type="button"
              onClick={() => setBundleExecutionGuardAuditOutcome("BLOCK")}
              className={`rounded-xl border px-3 py-2 text-[9px] font-semibold transition ${
                bundleExecutionGuardAuditOutcome === "BLOCK"
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              BLOCK · {blockCount}
            </button>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <select
              value={bundleExecutionGuardAuditDateRange}
              onChange={(event) =>
                setBundleExecutionGuardAuditDateRange(
                  event.target.value as "all" | "24h" | "7d" | "30d",
                )
              }
              className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 outline-none transition focus:border-[#0a84ff]/40 focus:ring-2 focus:ring-[#0a84ff]/10"
            >
              <option value="all">All dates</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>

            <select
              value={bundleExecutionGuardAuditSort}
              onChange={(event) =>
                setBundleExecutionGuardAuditSort(
                  event.target.value as "newest" | "oldest",
                )
              }
              className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 outline-none transition focus:border-[#0a84ff]/40 focus:ring-2 focus:ring-[#0a84ff]/10"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>

            <input
              type="search"
              value={bundleExecutionGuardAuditQuery}
              onChange={(event) =>
                setBundleExecutionGuardAuditQuery(event.target.value)
              }
              placeholder="Search bundle, task, reason…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#0a84ff]/40 focus:ring-2 focus:ring-[#0a84ff]/10 sm:min-w-[260px]"
            />

            {(bundleExecutionGuardAuditQuery ||
              bundleExecutionGuardAuditOutcome !== "all" ||
              bundleExecutionGuardAuditDateRange !== "all" ||
              bundleExecutionGuardAuditSort !== "newest") ? (
              <button
                type="button"
                onClick={() => {
                  setBundleExecutionGuardAuditQuery("");
                  setBundleExecutionGuardAuditOutcome("all");
                  setBundleExecutionGuardAuditDateRange("all");
                  setBundleExecutionGuardAuditSort("newest");
                }}
                className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Reset filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] text-slate-400">
          <span>
            Showing {filteredEntries.length} of {entries.length} audit events
          </span>
          {normalizedAuditQuery ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">
              Search: “{bundleExecutionGuardAuditQuery.trim()}”
            </span>
          ) : null}
          {bundleExecutionGuardAuditDateRange !== "all" ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">
              Range: {bundleExecutionGuardAuditDateRange}
            </span>
          ) : null}
          {bundleExecutionGuardAuditSort === "oldest" ? (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500">
              Oldest first
            </span>
          ) : null}
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="border-b border-slate-200/65 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAllFilteredAuditSelection}
                disabled={filteredEntries.length === 0}
                className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {allFilteredAuditSelected
                  ? "Unselect filtered"
                  : `Select filtered · ${filteredEntries.length}`}
              </button>

              {selectedAuditEntries.length > 0 ? (
                <span className="rounded-full bg-[#0a84ff]/10 px-2.5 py-1 text-[9px] font-semibold text-[#0a84ff]">
                  {selectedAuditEntries.length} selected
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportSelectedAuditJson}
                disabled={selectedAuditEntries.length === 0}
                className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export selected JSON
              </button>
              <button
                type="button"
                onClick={() => setBundleExecutionGuardAuditCompareOpen(true)}
                disabled={selectedAuditEntries.length !== 2}
                className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Compare selected
              </button>


              <button
                type="button"
                onClick={() => setBundleExecutionGuardAuditDeleteConfirmOpen(true)}
                disabled={selectedAuditEntries.length === 0}
                className="rounded-xl border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-[9px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete selected
              </button>

              <button
                type="button"
                onClick={clearAuditSelection}
                disabled={selectedAuditEntries.length === 0}
                className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear selection
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bundleExecutionGuardAuditCompareOpen && comparedAuditEntries ? (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/35 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-6xl rounded-[26px] border border-white/80 bg-white p-5 shadow-[0_32px_90px_rgba(15,23,42,.24)] sm:p-6">
            <div className="flex flex-col gap-3 border-b border-slate-200/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0a84ff]">
                  Execution guard audit
                </p>
                <h4 className="mt-2 text-[20px] font-semibold text-slate-950">
                  Compare selected events
                </h4>
                <p className="mt-1 text-[10px] text-slate-500">
                  Side-by-side comparison of exactly two selected audit events.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportAuditComparisonJson}
                  className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Export comparison JSON
                </button>
                <button
                  type="button"
                  onClick={() => setBundleExecutionGuardAuditCompareOpen(false)}
                  className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Changed fields</p>
                <p className="mt-1 text-[18px] font-semibold text-slate-900">
                  {compareAuditChangedFields.length}
                </p>
              </div>

              <div className={`rounded-2xl border p-3 ${
                compareAuditSeverityDirection > 0
                  ? "border-rose-200/80 bg-rose-50/70"
                  : compareAuditSeverityDirection < 0
                    ? "border-emerald-200/80 bg-emerald-50/70"
                    : "border-slate-200/70 bg-slate-50/70"
              }`}>
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Severity movement</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-800">
                  {compareAuditSeverityDirection > 0
                    ? "More severe"
                    : compareAuditSeverityDirection < 0
                      ? "Less severe"
                      : "Unchanged"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Budget delta</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-800">
                  {compareAuditBudgetDelta > 0 ? "+" : ""}{compareAuditBudgetDelta} tokens
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Reason delta</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-800">
                  +{compareAuditReasonDiff.added.length} / -{compareAuditReasonDiff.removed.length}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {compareAuditChangedFields.length > 0 ? (
                compareAuditChangedFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-[#0a84ff]/15 bg-[#0a84ff]/8 px-2.5 py-1 text-[8px] font-semibold text-[#0a84ff]"
                  >
                    {field} changed
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[8px] font-semibold text-emerald-700">
                  No tracked field changes
                </span>
              )}
            </div>

            {(compareAuditReasonDiff.added.length > 0 ||
              compareAuditReasonDiff.removed.length > 0) ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/45 p-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                    Reasons added in Event 2
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {compareAuditReasonDiff.added.length > 0 ? (
                      compareAuditReasonDiff.added.map((reason, index) => (
                        <p key={`${reason.label}-${index}`} className="rounded-lg bg-white/80 px-2.5 py-2 text-[9px] leading-4 text-slate-600">
                          <span className="font-semibold">{reason.label}</span>: {reason.detail}
                        </p>
                      ))
                    ) : (
                      <p className="text-[9px] text-slate-400">None</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200/70 bg-rose-50/45 p-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-rose-700">
                    Reasons removed from Event 1
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {compareAuditReasonDiff.removed.length > 0 ? (
                      compareAuditReasonDiff.removed.map((reason, index) => (
                        <p key={`${reason.label}-${index}`} className="rounded-lg bg-white/80 px-2.5 py-2 text-[9px] leading-4 text-slate-600">
                          <span className="font-semibold">{reason.label}</span>: {reason.detail}
                        </p>
                      ))
                    ) : (
                      <p className="text-[9px] text-slate-400">None</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {comparedAuditEntries.map((entry, compareIndex) => (
                <section
                  key={entry.id}
                  className="rounded-[22px] border border-slate-200/70 bg-slate-50/55 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Event {compareIndex + 1}
                      </p>
                      <p className="mt-1 text-[12px] font-semibold text-slate-900">
                        {entry.bundleName ?? "Custom configuration"}
                      </p>
                      <p className="mt-1 text-[9px] text-slate-400">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${
                      entry.outcome === "BLOCK"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      {entry.outcome}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className={`rounded-xl border bg-white p-3 ${compareAuditFieldChanged("Guard mode") ? "border-[#0a84ff]/35 ring-2 ring-[#0a84ff]/8" : "border-white/80"}`}>
                      <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Guard mode</p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-700">{entry.guardMode}</p>
                    </div>
                    <div className={`rounded-xl border bg-white p-3 ${compareAuditFieldChanged("Retrieval mode") ? "border-[#0a84ff]/35 ring-2 ring-[#0a84ff]/8" : "border-white/80"}`}>
                      <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Retrieval mode</p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-700">{entry.mode}</p>
                    </div>
                    <div className={`rounded-xl border bg-white p-3 ${compareAuditFieldChanged("Token budget") ? "border-[#0a84ff]/35 ring-2 ring-[#0a84ff]/8" : "border-white/80"}`}>
                      <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Token budget</p>
                      <p className="mt-1 text-[10px] font-semibold text-slate-700">{entry.budget}</p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white p-3">
                      <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Bundle ID</p>
                      <p className="mt-1 break-all text-[9px] font-medium text-slate-600">{entry.bundleId ?? "—"}</p>
                    </div>
                  </div>

                  <div className={`mt-3 rounded-xl border bg-white p-3 ${compareAuditFieldChanged("Task") ? "border-[#0a84ff]/35 ring-2 ring-[#0a84ff]/8" : "border-white/80"}`}>
                    <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Task</p>
                    <p className="mt-2 whitespace-pre-wrap text-[9px] leading-4 text-slate-600">
                      {entry.task.trim() || "No task instruction"}
                    </p>
                  </div>

                  <div className={`mt-3 rounded-xl border bg-white p-3 ${compareAuditFieldChanged("Guard reasons") ? "border-[#0a84ff]/35 ring-2 ring-[#0a84ff]/8" : "border-white/80"}`}>
                    <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">Guard reasons</p>
                    <div className="mt-2 space-y-2">
                      {entry.reasons.map((reason, reasonIndex) => (
                        <div
                          key={`${reason.label}-${reasonIndex}`}
                          className={`rounded-lg border px-2.5 py-2 ${
                            reason.level === "block"
                              ? "border-rose-200/80 bg-rose-50/60"
                              : reason.level === "warn"
                                ? "border-amber-200/80 bg-amber-50/60"
                                : "border-slate-200/70 bg-slate-50/60"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[9px] font-semibold text-slate-700">{reason.label}</span>
                            <span className="text-[8px] font-semibold uppercase text-slate-400">{reason.level}</span>
                          </div>
                          <p className="mt-1 text-[9px] leading-4 text-slate-500">{reason.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {inspectedAuditEntry ? (
        <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/30 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="Close audit inspector"
            onClick={() => setBundleExecutionGuardAuditInspectorId(null)}
            className="absolute inset-0 cursor-default"
          />

          <aside className="relative z-10 h-full w-full max-w-xl overflow-y-auto border-l border-white/70 bg-white/95 p-5 shadow-[-24px_0_70px_rgba(15,23,42,.18)] backdrop-blur-xl sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 pb-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0a84ff]">
                  Execution guard audit
                </p>
                <h4 className="mt-2 text-[20px] font-semibold text-slate-950">
                  Event details
                </h4>
                <p className="mt-1 text-[10px] text-slate-500">
                  {new Date(inspectedAuditEntry.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBundleExecutionGuardAuditInspectorId(null)}
                className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Outcome</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-800">
                  {inspectedAuditEntry.outcome}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Guard mode</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-800">
                  {inspectedAuditEntry.guardMode}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Retrieval mode</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-800">
                  {inspectedAuditEntry.mode}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Token budget</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-800">
                  {inspectedAuditEntry.budget}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4">
              <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Bundle</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-800">
                {inspectedAuditEntry.bundleName ?? "Custom configuration"}
              </p>
              {inspectedAuditEntry.bundleId ? (
                <p className="mt-1 break-all text-[9px] text-slate-400">
                  {inspectedAuditEntry.bundleId}
                </p>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4">
              <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Task instruction</p>
              <p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-slate-600">
                {inspectedAuditEntry.task.trim() || "No task instruction"}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4">
              <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">Guard reasons</p>
              <div className="mt-3 space-y-2">
                {inspectedAuditEntry.reasons.map((reason, index) => (
                  <div
                    key={`${reason.label}-${index}`}
                    className={`rounded-xl border px-3 py-2 ${
                      reason.level === "block"
                        ? "border-rose-200/80 bg-rose-50/70"
                        : reason.level === "warn"
                          ? "border-amber-200/80 bg-amber-50/70"
                          : "border-slate-200/70 bg-slate-50/70"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[9px] font-semibold text-slate-700">
                        {reason.label}
                      </span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[8px] font-semibold uppercase text-slate-500">
                        {reason.level}
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] leading-4 text-slate-500">
                      {reason.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <details className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-950 p-4">
              <summary className="cursor-pointer text-[9px] font-semibold text-slate-200">
                Raw event JSON
              </summary>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-300">
                {JSON.stringify(inspectedAuditEntry, null, 2)}
              </pre>
            </details>
          </aside>
        </div>
      ) : null}

      {bundleExecutionGuardAuditDeleteConfirmOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] border border-white/80 bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,.22)] sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-600">
              Destructive action
            </p>
            <h4 className="mt-2 text-[18px] font-semibold text-slate-950">
              Delete selected audit events?
            </h4>
            <p className="mt-3 text-[12px] leading-5 text-slate-500">
              This will permanently remove {selectedAuditEntries.length} selected
              execution guard audit {selectedAuditEntries.length === 1 ? "event" : "events"}
              from this browser.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setBundleExecutionGuardAuditDeleteConfirmOpen(false)}
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteSelectedAuditEntries}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-[10px] font-semibold text-white shadow-[0_8px_22px_rgba(225,29,72,.2)] transition hover:bg-rose-700"
              >
                Delete {selectedAuditEntries.length} selected
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="grid gap-3 p-4 sm:p-5">
          {visibleAuditEntries.map((entry) => {
            const actionable = entry.reasons.filter(
              (reason) => reason.level !== "pass",
            );

            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200/70 bg-white/75 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[9px] font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      checked={bundleExecutionGuardAuditSelectedIds.includes(entry.id)}
                      onChange={() => toggleAuditSelection(entry.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0a84ff]"
                    />
                    Select event
                  </label>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-semibold text-slate-900">
                        {entry.bundleName ?? "Custom configuration"}
                      </p>
                      <span
                        className={`rounded-full px-2 py-1 text-[8px] font-bold tracking-[0.08em] ${
                          entry.outcome === "BLOCK"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {entry.outcome}
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] text-slate-400">
                      {new Date(entry.createdAt).toLocaleString()} · guard {entry.guardMode}
                    </p>
                    <button
                      type="button"
                      onClick={() => setBundleExecutionGuardAuditInspectorId(entry.id)}
                      className="mt-2 rounded-lg border border-slate-200/70 bg-white px-2.5 py-1.5 text-[8px] font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      View details
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[9px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {entry.mode}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {entry.budget} tokens
                    </span>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-[9px] leading-4 text-slate-500">
                  {entry.task.trim() || "No task instruction"}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {actionable.map((reason, index) => (
                    <span
                      key={`${reason.label}-${index}`}
                      className={`rounded-full px-2 py-1 text-[9px] ${
                        reason.level === "block"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {reason.label}: {reason.detail}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-5 text-center">
              <p className="text-[10px] font-semibold text-slate-600">
                No audit events match these filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setBundleExecutionGuardAuditQuery("");
                  setBundleExecutionGuardAuditOutcome("all");
                  setBundleExecutionGuardAuditDateRange("all");
                  setBundleExecutionGuardAuditSort("newest");
                }}
                className="mt-2 text-[9px] font-semibold text-[#0a84ff] transition hover:text-[#006edb]"
              >
                Reset filters
              </button>
            </div>
          ) : null}
          {filteredEntries.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[9px] text-slate-500">
                Showing {visibleAuditEntries.length} of {filteredEntries.length} matching events
              </p>

              <div className="flex flex-wrap gap-2">
                {remainingAuditEntries > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setBundleExecutionGuardAuditVisibleCount((current) =>
                        Math.min(current + 20, filteredEntries.length),
                      )
                    }
                    className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Show 20 more · {remainingAuditEntries} remaining
                  </button>
                ) : null}

                {visibleAuditEntries.length > 20 ? (
                  <button
                    type="button"
                    onClick={() => setBundleExecutionGuardAuditVisibleCount(20)}
                    className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Collapse to 20
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <div className="rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-3 text-[10px] text-slate-500">
            No warned or blocked compile attempts recorded yet.
          </div>
        </div>
      )}
    </section>
  );
}

function CompilePolicyBundles({
  bundles,
  currentMode,
  currentBudget,
  currentTask,
  currentPolicy,
  onSave,
  onApply,
  onDelete,
  onImport,
  bundleRevisions,
  onRestoreRevision,
  onDeleteRevision,
  bundleRestoreAuditEntries,
  onClearBundleRestoreAudit,
}: {
  bundles: CompilePolicyBundle[];
  currentMode: string;
  currentBudget: number;
  currentTask: string;
  currentPolicy: QualityGatePolicy;
  onSave: (name: string) => void;
  onApply: (bundle: CompilePolicyBundle) => void;
  onDelete: (id: string) => void;
  onImport: (bundles: CompilePolicyBundle[]) => void;
  bundleRevisions: CompilePolicyBundleRevision[];
  onRestoreRevision: (revision: CompilePolicyBundleRevision) => void;
  onDeleteRevision: (id: string) => void;
  bundleRestoreAuditEntries: CompilePolicyBundleRestoreAuditEntry[];
  onClearBundleRestoreAudit: () => void;
}) {
  const [name, setName] = useState("");

  const samePolicy = (left: QualityGatePolicy, right: QualityGatePolicy) =>
    left.maxConfidenceDrop === right.maxConfidenceDrop &&
    left.maxReductionDrop === right.maxReductionDrop &&
    left.criticalLossMode === right.criticalLossMode &&
    left.numericLossMode === right.numericLossMode;

  const activeBundle = bundles.find(
    (bundle) =>
      bundle.mode === currentMode &&
      bundle.budget === currentBudget &&
      bundle.task.trim() === currentTask.trim() &&
      samePolicy(bundle.qualityGatePolicy, currentPolicy),
  );

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
  };

  return (
    <section className="cf-premium-card mt-4 overflow-hidden rounded-[26px] border border-white/80 bg-white/78 shadow-[0_18px_50px_rgba(55,65,81,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/65 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-[#0a84ff]" />
            <h3 className="text-[15px] font-semibold text-slate-950">
              Compile policy bundles
            </h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">
            Reuse mode, token budget, task instructions, and quality policy as one configuration.
          </p>
        </div>

        {activeBundle ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-bold tracking-[0.08em] text-emerald-700">
            ACTIVE · {activeBundle.name}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-semibold text-slate-500">
            Custom configuration
          </span>
        )}
      </div>

      <div className="border-b border-slate-200/65 bg-slate-50/40 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
            }}
            maxLength={50}
            placeholder="Bundle name — e.g. Security Review"
            className="min-w-[190px] flex-1 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 text-[11px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300/60 focus:ring-4 focus:ring-indigo-500/10"
          />
          <button
            type="button"
            onClick={save}
            disabled={!name.trim()}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Save current bundle
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] text-slate-500">
          <span className="rounded-full bg-white px-2 py-1">mode {currentMode}</span>
          <span className="rounded-full bg-white px-2 py-1">{currentBudget} tokens</span>
          <span className="rounded-full bg-white px-2 py-1">
            confidence {currentPolicy.maxConfidenceDrop} pp
          </span>
          <span className="rounded-full bg-white px-2 py-1">
            reduction {currentPolicy.maxReductionDrop} pp
          </span>
        </div>
      </div>

      <CompilePolicyBundleTransfer bundles={bundles} onImport={onImport} />

      <CompilePolicyBundleVersioning
        revisions={bundleRevisions}
        bundles={bundles}
        onRestore={onRestoreRevision}
        onDeleteRevision={onDeleteRevision}
      />

      <CompilePolicyBundleRestoreAuditTrail
        entries={bundleRestoreAuditEntries}
        onClear={onClearBundleRestoreAudit}
      />

      {bundles.length > 0 ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
          {bundles.map((bundle) => {
            const active = activeBundle?.id === bundle.id;

            return (
              <div
                key={bundle.id}
                className={`rounded-2xl border p-4 transition-all ${
                  active
                    ? "border-[#0a84ff]/35 bg-[#0a84ff]/[0.055] shadow-[0_10px_30px_rgba(10,132,255,.07)]"
                    : "border-slate-200/70 bg-white/72"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onApply(bundle)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-semibold text-slate-900">
                        {bundle.name}
                      </span>
                      {active ? (
                        <span className="rounded-full bg-[#0a84ff] px-1.5 py-0.5 text-[7px] font-bold tracking-[0.08em] text-white">
                          ACTIVE
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-500">
                      {bundle.task.trim() || "No task instruction saved"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-1">{bundle.mode}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        {bundle.budget} tokens
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(bundle.id)}
                    className="rounded-lg border border-slate-200/70 bg-white px-2 py-1.5 text-[9px] font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <div className="rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/55 px-4 py-4 text-[10px] text-slate-500">
            No bundles saved yet. Configure ContextForge once, then save the entire compile policy for reuse.
          </div>
        </div>
      )}
    </section>
  );
}

type QualityGatePolicy = {
  maxConfidenceDrop: number;
  maxReductionDrop: number;
  criticalLossMode: "fail" | "warn";
  numericLossMode: "fail" | "warn";
};

const DEFAULT_QUALITY_GATE_POLICY: QualityGatePolicy = {
  maxConfidenceDrop: 10,
  maxReductionDrop: 15,
  criticalLossMode: "fail",
  numericLossMode: "fail",
};

const QUALITY_GATE_PRESETS: Array<{
  id: "strict" | "balanced" | "lenient";
  label: string;
  description: string;
  policy: QualityGatePolicy;
}> = [
  {
    id: "strict",
    label: "Strict",
    description: "Best for benchmark and release validation.",
    policy: {
      maxConfidenceDrop: 5,
      maxReductionDrop: 8,
      criticalLossMode: "fail",
      numericLossMode: "fail",
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Recommended default for everyday compilation.",
    policy: {
      maxConfidenceDrop: 10,
      maxReductionDrop: 15,
      criticalLossMode: "fail",
      numericLossMode: "fail",
    },
  },
  {
    id: "lenient",
    label: "Lenient",
    description: "Allows more drift while keeping critical loss visible.",
    policy: {
      maxConfidenceDrop: 20,
      maxReductionDrop: 30,
      criticalLossMode: "warn",
      numericLossMode: "warn",
    },
  },
];

function QualityGatePresetPicker({
  policy,
  onApply,
}: {
  policy: QualityGatePolicy;
  onApply: (next: QualityGatePolicy) => void;
}) {
  const samePolicy = (left: QualityGatePolicy, right: QualityGatePolicy) =>
    left.maxConfidenceDrop === right.maxConfidenceDrop &&
    left.maxReductionDrop === right.maxReductionDrop &&
    left.criticalLossMode === right.criticalLossMode &&
    left.numericLossMode === right.numericLossMode;

  const activePreset = QUALITY_GATE_PRESETS.find((preset) =>
    samePolicy(policy, preset.policy),
  )?.id;

  return (
    <div className="border-b border-slate-200/65 bg-slate-50/45 px-4 py-4 sm:px-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {QUALITY_GATE_PRESETS.map((preset) => {
          const active = activePreset === preset.id;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApply(preset.policy)}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                active
                  ? "border-[#0a84ff]/35 bg-[#0a84ff]/[0.06] shadow-[0_10px_28px_rgba(10,132,255,.08)]"
                  : "border-slate-200/70 bg-white/75 hover:-translate-y-0.5 hover:border-slate-300/80 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold text-slate-900">
                  {preset.label}
                </span>
                {active ? (
                  <span className="rounded-full bg-[#0a84ff] px-2 py-1 text-[8px] font-bold tracking-[0.08em] text-white">
                    ACTIVE
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-[10px] leading-4 text-slate-500">
                {preset.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  confidence {preset.policy.maxConfidenceDrop} pp
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  reduction {preset.policy.maxReductionDrop} pp
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {!activePreset ? (
        <p className="mt-3 text-[10px] text-slate-500">
          Custom policy active.
        </p>
      ) : null}
    </div>
  );
}

type SavedQualityGateProfile = {
  id: string;
  name: string;
  createdAt: string;
  policy: QualityGatePolicy;
};

type QualityGateProfileRevision = {
  id: string;
  profileId: string;
  profileName: string;
  createdAt: string;
  policy: QualityGatePolicy;
};

function QualityGateProfileDiff({
  revision,
  currentProfile,
}: {
  revision: QualityGateProfileRevision;
  currentProfile: SavedQualityGateProfile | null;
}) {
  const current = currentProfile?.policy ?? null;

  const rows: Array<{
    label: string;
    before: string;
    after: string;
    changed: boolean;
  }> = [
    {
      label: "Max confidence drop",
      before: `${revision.policy.maxConfidenceDrop} pp`,
      after: current ? `${current.maxConfidenceDrop} pp` : "Profile missing",
      changed: current
        ? revision.policy.maxConfidenceDrop !== current.maxConfidenceDrop
        : true,
    },
    {
      label: "Max reduction drop",
      before: `${revision.policy.maxReductionDrop} pp`,
      after: current ? `${current.maxReductionDrop} pp` : "Profile missing",
      changed: current
        ? revision.policy.maxReductionDrop !== current.maxReductionDrop
        : true,
    },
    {
      label: "Critical evidence loss",
      before: revision.policy.criticalLossMode,
      after: current ? current.criticalLossMode : "Profile missing",
      changed: current
        ? revision.policy.criticalLossMode !== current.criticalLossMode
        : true,
    },
    {
      label: "Numeric evidence loss",
      before: revision.policy.numericLossMode,
      after: current ? current.numericLossMode : "Profile missing",
      changed: current
        ? revision.policy.numericLossMode !== current.numericLossMode
        : true,
    },
  ];

  const changedCount = rows.filter((row) => row.changed).length;

  return (
    <div className="mt-3 rounded-2xl border border-slate-200/70 bg-slate-50/75 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold text-slate-700">
          Revision diff
        </p>
        <span
          className={`rounded-full px-2 py-1 text-[8px] font-bold tracking-[0.08em] ${
            changedCount > 0
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {changedCount > 0 ? `${changedCount} CHANGE${changedCount === 1 ? "" : "S"}` : "NO CHANGES"}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid gap-2 rounded-xl border border-slate-200/60 bg-white/75 px-3 py-2.5 sm:grid-cols-[1.2fr_.9fr_auto_.9fr]"
          >
            <span className="text-[9px] font-semibold text-slate-600">
              {row.label}
            </span>
            <span className="text-[9px] text-slate-500">{row.before}</span>
            <span className="text-[9px] font-semibold text-slate-400">→</span>
            <span
              className={`text-[9px] font-semibold ${
                row.changed ? "text-slate-900" : "text-slate-500"
              }`}
            >
              {row.after}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type QualityGateRestoreAuditEntry = {
  id: string;
  restoredAt: string;
  profileId: string;
  profileName: string;
  revisionId: string;
  revisionCreatedAt: string;
  before: QualityGatePolicy | null;
  after: QualityGatePolicy;
};

function QualityGateAuditExport({
  entries,
}: {
  entries: QualityGateRestoreAuditEntry[];
}) {
  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const payload = {
      type: "contextforge-quality-gate-restore-audit",
      version: 1,
      exportedAt: new Date().toISOString(),
      entries,
    };

    download(
      `contextforge-restore-audit-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  };

  const csvEscape = (value: unknown) => {
    const text =
      value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? value
          : String(value);

    return `"${text.replace(/"/g, '""')}"`;
  };

  const exportCsv = () => {
    const headers = [
      "restored_at",
      "profile_id",
      "profile_name",
      "revision_id",
      "revision_created_at",
      "before_max_confidence_drop",
      "after_max_confidence_drop",
      "before_max_reduction_drop",
      "after_max_reduction_drop",
      "before_critical_loss_mode",
      "after_critical_loss_mode",
      "before_numeric_loss_mode",
      "after_numeric_loss_mode",
    ];

    const rows = entries.map((entry) => [
      entry.restoredAt,
      entry.profileId,
      entry.profileName,
      entry.revisionId,
      entry.revisionCreatedAt,
      entry.before?.maxConfidenceDrop ?? "",
      entry.after.maxConfidenceDrop,
      entry.before?.maxReductionDrop ?? "",
      entry.after.maxReductionDrop,
      entry.before?.criticalLossMode ?? "",
      entry.after.criticalLossMode,
      entry.before?.numericLossMode ?? "",
      entry.after.numericLossMode,
    ]);

    const csv = [
      headers.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\r\n");

    download(
      `contextforge-restore-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={exportJson}
        disabled={entries.length === 0}
        className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
      >
        Export JSON
      </button>

      <button
        type="button"
        onClick={exportCsv}
        disabled={entries.length === 0}
        className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
      >
        Export CSV
      </button>
    </div>
  );
}

function QualityGateRestoreAuditTrail({
  entries,
  onClear,
}: {
  entries: QualityGateRestoreAuditEntry[];
  onClear: () => void;
}) {
  return (
    <div className="border-b border-slate-200/65 bg-slate-50/35 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">
            Restore audit trail
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Every restored revision is recorded with its exact policy transition.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <QualityGateAuditExport entries={entries} />
          <button
            type="button"
            onClick={onClear}
            disabled={entries.length === 0}
            className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Clear audit log
          </button>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {entries.slice(0, 30).map((entry) => {
            const before = entry.before;
            const changes = [
              {
                label: "confidence",
                before: before ? `${before.maxConfidenceDrop} pp` : "missing",
                after: `${entry.after.maxConfidenceDrop} pp`,
                changed: !before || before.maxConfidenceDrop !== entry.after.maxConfidenceDrop,
              },
              {
                label: "reduction",
                before: before ? `${before.maxReductionDrop} pp` : "missing",
                after: `${entry.after.maxReductionDrop} pp`,
                changed: !before || before.maxReductionDrop !== entry.after.maxReductionDrop,
              },
              {
                label: "critical",
                before: before ? before.criticalLossMode : "missing",
                after: entry.after.criticalLossMode,
                changed: !before || before.criticalLossMode !== entry.after.criticalLossMode,
              },
              {
                label: "numeric",
                before: before ? before.numericLossMode : "missing",
                after: entry.after.numericLossMode,
                changed: !before || before.numericLossMode !== entry.after.numericLossMode,
              },
            ].filter((item) => item.changed);

            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200/70 bg-white/75 p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-900">
                      {entry.profileName}
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                      Restored {new Date(entry.restoredAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-bold tracking-[0.08em] text-slate-500">
                    {changes.length} CHANGE{changes.length === 1 ? "" : "S"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {changes.length > 0 ? (
                    changes.map((change) => (
                      <span
                        key={change.label}
                        className="rounded-full bg-amber-50 px-2 py-1 text-[9px] text-amber-700"
                      >
                        {change.label}: {change.before} → {change.after}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] text-emerald-700">
                      No policy fields changed
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[9px] text-slate-400">
                  Revision: {entry.revisionId} · saved{" "}
                  {new Date(entry.revisionCreatedAt).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200/80 bg-white/60 px-4 py-3 text-[10px] text-slate-500">
          No restore events recorded yet.
        </div>
      )}
    </div>
  );
}

function QualityGateRestoreConfirmation({
  revision,
  currentProfile,
  onCancel,
  onConfirm,
}: {
  revision: QualityGateProfileRevision;
  currentProfile: SavedQualityGateProfile | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const current = currentProfile?.policy ?? null;

  const rows = [
    {
      label: "Max confidence drop",
      current: current ? `${current.maxConfidenceDrop} pp` : "Profile missing",
      restored: `${revision.policy.maxConfidenceDrop} pp`,
      changed: current
        ? current.maxConfidenceDrop !== revision.policy.maxConfidenceDrop
        : true,
    },
    {
      label: "Max reduction drop",
      current: current ? `${current.maxReductionDrop} pp` : "Profile missing",
      restored: `${revision.policy.maxReductionDrop} pp`,
      changed: current
        ? current.maxReductionDrop !== revision.policy.maxReductionDrop
        : true,
    },
    {
      label: "Critical evidence loss",
      current: current ? current.criticalLossMode : "Profile missing",
      restored: revision.policy.criticalLossMode,
      changed: current
        ? current.criticalLossMode !== revision.policy.criticalLossMode
        : true,
    },
    {
      label: "Numeric evidence loss",
      current: current ? current.numericLossMode : "Profile missing",
      restored: revision.policy.numericLossMode,
      changed: current
        ? current.numericLossMode !== revision.policy.numericLossMode
        : true,
    },
  ];

  const changedRows = rows.filter((row) => row.changed);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm profile restore"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,.28)]">
        <div className="border-b border-slate-200/70 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600">
                Restore confirmation
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">
                Restore {revision.profileName}?
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Review exactly what will change before replacing the current policy.
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-slate-700">
              Change summary
            </p>
            <span
              className={`rounded-full px-2.5 py-1 text-[8px] font-bold tracking-[0.08em] ${
                changedRows.length > 0
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {changedRows.length > 0
                ? `${changedRows.length} CHANGE${changedRows.length === 1 ? "" : "S"}`
                : "NO CHANGES"}
            </span>
          </div>

          <div className="mt-3 grid gap-2">
            {rows.map((row) => (
              <div
                key={row.label}
                className={`rounded-2xl border px-3.5 py-3 ${
                  row.changed
                    ? "border-amber-200/70 bg-amber-50/45"
                    : "border-slate-200/70 bg-slate-50/55"
                }`}
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {row.label}
                </p>
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div>
                    <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">
                      Current
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-700">
                      {row.current}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">→</span>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-[0.08em] text-slate-400">
                      Restored
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-950">
                      {row.restored}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-[10px] leading-5 text-slate-500">
            Revision saved {new Date(revision.createdAt).toLocaleString()}.
            Restoring changes the saved profile and activates that policy immediately.
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200/70 bg-slate-50/60 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200/70 bg-white px-4 py-2.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-[10px] font-semibold text-white transition hover:bg-slate-800"
          >
            Restore revision
          </button>
        </div>
      </div>
    </div>
  );
}

function QualityGateProfileVersioning({
  revisions,
  profiles,
  onRestore,
  onDeleteRevision,
}: {
  revisions: QualityGateProfileRevision[];
  profiles: SavedQualityGateProfile[];
  onRestore: (revision: QualityGateProfileRevision) => void;
  onDeleteRevision: (id: string) => void;
}) {
  const [selectedProfileId, setSelectedProfileId] = useState<string>("all");
  const [expandedRevisionId, setExpandedRevisionId] = useState<string | null>(null);
  const [pendingRestoreRevision, setPendingRestoreRevision] = useState<QualityGateProfileRevision | null>(null);

  const filtered =
    selectedProfileId === "all"
      ? revisions
      : revisions.filter((revision) => revision.profileId === selectedProfileId);

  return (
    <div className="border-b border-slate-200/65 bg-white/45 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">
            Profile version history
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Updating an existing profile preserves its previous policy for rollback.
          </p>
        </div>

        <select
          value={selectedProfileId}
          onChange={(event) => setSelectedProfileId(event.target.value)}
          className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[10px] font-semibold text-slate-700 outline-none"
        >
          <option value="all">All profiles</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {filtered.slice(0, 24).map((revision) => {
            const currentProfile =
              profiles.find((profile) => profile.id === revision.profileId) ?? null;
            const expanded = expandedRevisionId === revision.id;

            return (
            <div
              key={revision.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/72 p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[11px] font-semibold text-slate-900">
                    {revision.profileName}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {new Date(revision.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[9px] text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    confidence {revision.policy.maxConfidenceDrop} pp
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    reduction {revision.policy.maxReductionDrop} pp
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    critical {revision.policy.criticalLossMode}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    numeric {revision.policy.numericLossMode}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedRevisionId(expanded ? null : revision.id)
                  }
                  className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {expanded ? "Hide diff" : "View diff"}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRestoreRevision(revision)}
                  className="rounded-xl bg-slate-950 px-3 py-2 text-[9px] font-semibold text-white transition hover:bg-slate-800"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRevision(revision.id)}
                  className="rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[9px] font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                >
                  Delete
                </button>
              </div>

              {expanded ? (
                <QualityGateProfileDiff
                  revision={revision}
                  currentProfile={currentProfile}
                />
              ) : null}
            </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-3 text-[10px] text-slate-500">
          No profile revisions yet. Update an existing saved profile to create history.
        </div>
      )}

      {pendingRestoreRevision ? (
        <QualityGateRestoreConfirmation
          revision={pendingRestoreRevision}
          currentProfile={
            profiles.find((profile) => profile.id === pendingRestoreRevision.profileId) ?? null
          }
          onCancel={() => setPendingRestoreRevision(null)}
          onConfirm={() => {
            onRestore(pendingRestoreRevision);
            setPendingRestoreRevision(null);
          }}
        />
      ) : null}
    </div>
  );
}

function QualityGateProfileTransfer({
  profiles,
  onImport,
}: {
  profiles: SavedQualityGateProfile[];
  onImport: (profiles: SavedQualityGateProfile[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportProfiles = () => {
    const payload = {
      type: "contextforge-quality-gate-profiles",
      version: 1,
      exportedAt: new Date().toISOString(),
      profiles,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `contextforge-quality-gate-profiles-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${profiles.length} profile${profiles.length === 1 ? "" : "s"}.`);
  };

  const validatePolicy = (policy: unknown): policy is QualityGatePolicy => {
    if (!policy || typeof policy !== "object") return false;
    const candidate = policy as Partial<QualityGatePolicy>;

    return (
      typeof candidate.maxConfidenceDrop === "number" &&
      Number.isFinite(candidate.maxConfidenceDrop) &&
      candidate.maxConfidenceDrop >= 0 &&
      candidate.maxConfidenceDrop <= 30 &&
      typeof candidate.maxReductionDrop === "number" &&
      Number.isFinite(candidate.maxReductionDrop) &&
      candidate.maxReductionDrop >= 0 &&
      candidate.maxReductionDrop <= 40 &&
      (candidate.criticalLossMode === "fail" ||
        candidate.criticalLossMode === "warn") &&
      (candidate.numericLossMode === "fail" ||
        candidate.numericLossMode === "warn")
    );
  };

  const validateProfile = (
    value: unknown,
  ): value is SavedQualityGateProfile => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<SavedQualityGateProfile>;

    return (
      typeof candidate.id === "string" &&
      candidate.id.length > 0 &&
      typeof candidate.name === "string" &&
      candidate.name.trim().length > 0 &&
      candidate.name.length <= 40 &&
      typeof candidate.createdAt === "string" &&
      !Number.isNaN(Date.parse(candidate.createdAt)) &&
      validatePolicy(candidate.policy)
    );
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      let incoming: unknown = parsed;
      if (
        parsed &&
        typeof parsed === "object" &&
        "profiles" in parsed
      ) {
        incoming = (parsed as { profiles?: unknown }).profiles;
      }

      if (!Array.isArray(incoming)) {
        throw new Error("JSON does not contain a profiles array.");
      }

      const validProfiles = incoming.filter(validateProfile);
      if (validProfiles.length === 0) {
        throw new Error("No valid ContextForge quality gate profiles found.");
      }

      onImport(validProfiles.slice(0, 12));
      setMessage(
        `Imported ${Math.min(validProfiles.length, 12)} profile${
          Math.min(validProfiles.length, 12) === 1 ? "" : "s"
        }.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Import failed: ${error.message}`
          : "Import failed.",
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="border-b border-slate-200/65 bg-slate-50/35 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">
            Profile transfer
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Export profiles as portable JSON or import them on another machine.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportProfiles}
            disabled={profiles.length === 0}
            className="rounded-xl border border-slate-200/70 bg-white px-3.5 py-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Export JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-slate-950 px-3.5 py-2 text-[10px] font-semibold text-white transition hover:bg-slate-800"
          >
            Import JSON
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
        </div>
      </div>

      {message ? (
        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/75 px-3 py-2 text-[10px] text-slate-600">
          {message}
        </div>
      ) : null}
    </div>
  );
}

function SavedQualityGateProfiles({
  profiles,
  activePolicy,
  onApply,
  onSave,
  onDelete,
}: {
  profiles: SavedQualityGateProfile[];
  activePolicy: QualityGatePolicy;
  onApply: (profile: SavedQualityGateProfile) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");

  const samePolicy = (left: QualityGatePolicy, right: QualityGatePolicy) =>
    left.maxConfidenceDrop === right.maxConfidenceDrop &&
    left.maxReductionDrop === right.maxReductionDrop &&
    left.criticalLossMode === right.criticalLossMode &&
    left.numericLossMode === right.numericLossMode;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
  };

  return (
    <div className="border-b border-slate-200/65 bg-white/45 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">
            Saved profiles
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Save this policy for one-click reuse.
          </p>
        </div>

        <div className="flex min-w-0 flex-1 justify-end gap-2 sm:flex-none">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder="Profile name"
            maxLength={40}
            className="min-w-0 w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-[11px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300/60 focus:ring-4 focus:ring-indigo-500/10 sm:w-44"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="shrink-0 rounded-xl bg-slate-950 px-3.5 py-2 text-[10px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Save profile
          </button>
        </div>
      </div>

      {profiles.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => {
            const active = samePolicy(activePolicy, profile.policy);

            return (
              <div
                key={profile.id}
                className={`rounded-2xl border p-3.5 transition ${
                  active
                    ? "border-[#0a84ff]/35 bg-[#0a84ff]/[0.055]"
                    : "border-slate-200/70 bg-white/72"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onApply(profile)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[11px] font-semibold text-slate-900">
                        {profile.name}
                      </span>
                      {active ? (
                        <span className="rounded-full bg-[#0a84ff] px-1.5 py-0.5 text-[7px] font-bold tracking-[0.08em] text-white">
                          ACTIVE
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1.5 text-[9px] leading-4 text-slate-500">
                      Confidence {profile.policy.maxConfidenceDrop} pp · Reduction{" "}
                      {profile.policy.maxReductionDrop} pp
                    </p>
                    <p className="text-[9px] leading-4 text-slate-400">
                      Critical {profile.policy.criticalLossMode} · Numeric{" "}
                      {profile.policy.numericLossMode}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete(profile.id)}
                    className="rounded-lg border border-slate-200/70 bg-white px-2 py-1.5 text-[9px] font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Delete ${profile.name}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-3 text-[10px] text-slate-500">
          No saved custom profiles yet.
        </div>
      )}
    </div>
  );
}

function QualityGatePolicyControls({
  policy,
  onChange,
  onReset,
  savedProfiles,
  onApplySavedProfile,
  onSaveProfile,
  onDeleteProfile,
  onImportProfiles,
  profileRevisions,
  onRestoreRevision,
  onDeleteRevision,
  restoreAuditEntries,
  onClearRestoreAudit,
}: {
  policy: QualityGatePolicy;
  onChange: (next: QualityGatePolicy) => void;
  onReset: () => void;
  savedProfiles: SavedQualityGateProfile[];
  onApplySavedProfile: (profile: SavedQualityGateProfile) => void;
  onSaveProfile: (name: string) => void;
  onDeleteProfile: (id: string) => void;
  onImportProfiles: (profiles: SavedQualityGateProfile[]) => void;
  profileRevisions: QualityGateProfileRevision[];
  onRestoreRevision: (revision: QualityGateProfileRevision) => void;
  onDeleteRevision: (id: string) => void;
  restoreAuditEntries: QualityGateRestoreAuditEntry[];
  onClearRestoreAudit: () => void;
}) {
  const update = <K extends keyof QualityGatePolicy>(
    key: K,
    value: QualityGatePolicy[K],
  ) => {
    onChange({ ...policy, [key]: value });
  };

  return (
    <section className="cf-premium-card mt-4 overflow-hidden rounded-[26px] border border-white/80 bg-white/78 shadow-[0_18px_50px_rgba(55,65,81,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/65 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[#0a84ff]" />
            <h3 className="text-[15px] font-semibold text-slate-950">Quality gate policy</h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">
            Configure how strict regression checks should be.
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-slate-200/70 bg-white/85 px-3.5 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Reset defaults
        </button>
      </div>

      <QualityGatePresetPicker policy={policy} onApply={onChange} />

      <SavedQualityGateProfiles
        profiles={savedProfiles}
        activePolicy={policy}
        onApply={onApplySavedProfile}
        onSave={onSaveProfile}
        onDelete={onDeleteProfile}
      />

      <QualityGateProfileTransfer
        profiles={savedProfiles}
        onImport={onImportProfiles}
      />

      <QualityGateProfileVersioning
        revisions={profileRevisions}
        profiles={savedProfiles}
        onRestore={onRestoreRevision}
        onDeleteRevision={onDeleteRevision}
      />

      <QualityGateRestoreAuditTrail
        entries={restoreAuditEntries}
        onClear={onClearRestoreAudit}
      />

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <label className="rounded-2xl border border-slate-200/65 bg-white/72 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold text-slate-700">Max confidence drop</span>
            <span className="text-[12px] font-semibold text-[#0a84ff]">{policy.maxConfidenceDrop} pp</span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={policy.maxConfidenceDrop}
            onChange={(event) => update("maxConfidenceDrop", Number(event.target.value))}
            className="mt-4 w-full accent-[#0a84ff]"
          />
          <p className="mt-2 text-[10px] leading-4 text-slate-500">
            Fail when retrieval confidence falls more than this amount versus baseline.
          </p>
        </label>

        <label className="rounded-2xl border border-slate-200/65 bg-white/72 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold text-slate-700">Max reduction drop</span>
            <span className="text-[12px] font-semibold text-[#0a84ff]">{policy.maxReductionDrop} pp</span>
          </div>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={policy.maxReductionDrop}
            onChange={(event) => update("maxReductionDrop", Number(event.target.value))}
            className="mt-4 w-full accent-[#0a84ff]"
          />
          <p className="mt-2 text-[10px] leading-4 text-slate-500">
            Warn when context reduction falls more than this amount versus baseline.
          </p>
        </label>

        <label className="rounded-2xl border border-slate-200/65 bg-white/72 p-4">
          <span className="text-[12px] font-semibold text-slate-700">Critical evidence loss</span>
          <select
            value={policy.criticalLossMode}
            onChange={(event) =>
              update("criticalLossMode", event.target.value as QualityGatePolicy["criticalLossMode"])
            }
            className="mt-3 w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 text-[12px] text-slate-700 outline-none focus:border-indigo-300/60 focus:ring-4 focus:ring-indigo-500/10"
          >
            <option value="fail">Hard fail</option>
            <option value="warn">Warning only</option>
          </select>
        </label>

        <label className="rounded-2xl border border-slate-200/65 bg-white/72 p-4">
          <span className="text-[12px] font-semibold text-slate-700">Numeric evidence loss</span>
          <select
            value={policy.numericLossMode}
            onChange={(event) =>
              update("numericLossMode", event.target.value as QualityGatePolicy["numericLossMode"])
            }
            className="mt-3 w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 text-[12px] text-slate-700 outline-none focus:border-indigo-300/60 focus:ring-4 focus:ring-indigo-500/10"
          >
            <option value="fail">Hard fail</option>
            <option value="warn">Warning only</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function RegressionQualityGate({
  current,
  baseline,
  policy,
}: {
  current: Result;
  baseline: HistoryEntry | null;
  policy: QualityGatePolicy;
}) {
  if (!baseline) {
    return (
      <section className="cf-premium-card mt-4 rounded-[24px] border border-slate-200/70 bg-white/78 px-5 py-4 shadow-[0_16px_44px_rgba(55,65,81,.07)] sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <h3 className="text-[14px] font-semibold text-slate-900">Regression quality gate</h3>
        </div>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          Set a regression baseline to enable automatic pass/fail checks.
        </p>
      </section>
    );
  }

  const currentManifest = readExplainabilityManifest(current);
  const baselineManifest = readExplainabilityManifest(baseline.result);

  const currentSelected = currentManifest?.selected ?? [];
  const baselineSelected = baselineManifest?.selected ?? [];

  const keyFor = (item: ExplainabilityEvidence) =>
    `${item.source_id ?? ""}|${item.page ?? ""}|${(item.text ?? "").trim().toLowerCase()}`;

  const currentKeys = new Set(currentSelected.map(keyFor));
  const disappeared = baselineSelected.filter((item) => !currentKeys.has(keyFor(item)));
  const disappearedCritical = disappeared.filter((item) => item.hard || item.mandatory);
  const disappearedNumeric = disappeared.filter((item) => item.has_number);

  const confidenceDrop =
    (baseline.result.retrieval_confidence ?? 0) - (current.retrieval_confidence ?? 0);

  const reductionDrop =
    baseline.result.reduction_percent - current.reduction_percent;

  const currentMetrics = (currentManifest?.metrics ?? {}) as Record<string, unknown>;
  const baselineMetrics = (baselineManifest?.metrics ?? {}) as Record<string, unknown>;

  const readPercent = (metrics: Record<string, unknown>, ...keys: string[]): number | null => {
    for (const key of keys) {
      const raw = metrics[key];
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      return Math.max(0, Math.min(100, Math.round(raw <= 1 ? raw * 100 : raw)));
    }
    return null;
  };

  const currentCriticalRecall = readPercent(currentMetrics, "critical_fact_recall", "critical_recall");
  const baselineCriticalRecall = readPercent(baselineMetrics, "critical_fact_recall", "critical_recall");
  const currentNumericRecall = readPercent(currentMetrics, "numeric_fact_recall", "numeric_recall");
  const baselineNumericRecall = readPercent(baselineMetrics, "numeric_fact_recall", "numeric_recall");

  const checks = [
    {
      label: "Critical evidence",
      passed: disappearedCritical.length === 0,
      detail:
        disappearedCritical.length === 0
          ? "No baseline critical evidence disappeared."
          : `${disappearedCritical.length} critical item(s) disappeared.`,
      severity: policy.criticalLossMode,
    },
    {
      label: "Numeric evidence",
      passed: disappearedNumeric.length === 0,
      detail:
        disappearedNumeric.length === 0
          ? "No baseline numeric evidence disappeared."
          : `${disappearedNumeric.length} numeric item(s) disappeared.`,
      severity: policy.numericLossMode,
    },
    {
      label: "Confidence floor",
      passed: confidenceDrop <= policy.maxConfidenceDrop,
      detail:
        confidenceDrop <= policy.maxConfidenceDrop
          ? `Confidence drop is ${Math.max(0, confidenceDrop)} pp (limit ${policy.maxConfidenceDrop} pp).`
          : `Confidence dropped ${confidenceDrop} pp (limit ${policy.maxConfidenceDrop} pp).`,
      severity: policy.numericLossMode,
    },
    {
      label: "Critical recall",
      passed:
        currentCriticalRecall === null ||
        baselineCriticalRecall === null ||
        currentCriticalRecall >= baselineCriticalRecall,
      detail:
        currentCriticalRecall === null || baselineCriticalRecall === null
          ? "Backend recall metric unavailable; check skipped."
          : `${baselineCriticalRecall}% baseline → ${currentCriticalRecall}% current.`,
      severity: "fail" as const,
    },
    {
      label: "Numeric recall",
      passed:
        currentNumericRecall === null ||
        baselineNumericRecall === null ||
        currentNumericRecall >= baselineNumericRecall,
      detail:
        currentNumericRecall === null || baselineNumericRecall === null
          ? "Backend recall metric unavailable; check skipped."
          : `${baselineNumericRecall}% baseline → ${currentNumericRecall}% current.`,
      severity: "fail" as const,
    },
    {
      label: "Compression efficiency",
      passed: reductionDrop <= policy.maxReductionDrop,
      detail:
        reductionDrop <= policy.maxReductionDrop
          ? `Reduction delta stays within the ${policy.maxReductionDrop} pp tolerance.`
          : `Reduction fell ${reductionDrop.toFixed(2)} pp versus baseline.`,
      severity: "warn" as const,
    },
  ];

  const hardFailures = checks.filter((check) => check.severity === "fail" && !check.passed);
  const warnings = checks.filter((check) => check.severity === "warn" && !check.passed);

  const status =
    hardFailures.length > 0 ? "FAIL" : warnings.length > 0 ? "WARN" : "PASS";

  const statusClasses =
    status === "PASS"
      ? "border-emerald-200/80 bg-emerald-50/75 text-emerald-700"
      : status === "WARN"
        ? "border-amber-200/80 bg-amber-50/80 text-amber-700"
        : "border-rose-200/80 bg-rose-50/80 text-rose-700";

  return (
    <section className="cf-premium-card mt-4 overflow-hidden rounded-[26px] border border-white/80 bg-white/78 shadow-[0_18px_50px_rgba(55,65,81,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/65 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0a84ff]" />
            <h3 className="text-[15px] font-semibold text-slate-950">Regression quality gate</h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">
            Automatic safety checks against your saved baseline.
          </p>
        </div>

        <div className={`rounded-full border px-3.5 py-2 text-[11px] font-bold tracking-[0.12em] ${statusClasses}`}>
          {status}
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {checks.map((check) => {
          const skipped = check.detail.includes("check skipped");
          const badge =
            skipped
              ? "SKIP"
              : check.passed
                ? "PASS"
                : check.severity === "warn"
                  ? "WARN"
                  : "FAIL";

          const badgeClasses =
            skipped
              ? "bg-slate-100 text-slate-500"
              : check.passed
                ? "bg-emerald-50 text-emerald-700"
                : check.severity === "warn"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-rose-50 text-rose-700";

          return (
            <div key={check.label} className="rounded-2xl border border-slate-200/65 bg-white/72 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold text-slate-700">{check.label}</p>
                <span className={`rounded-full px-2 py-1 text-[8px] font-bold tracking-[0.08em] ${badgeClasses}`}>
                  {badge}
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">{check.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 bg-slate-50/55 px-5 py-3 text-[10px] text-slate-500 sm:px-6">
        <span>Baseline: {baseline.mode} · {baseline.budget} tokens</span>
        <span>{hardFailures.length} hard failure(s) · {warnings.length} warning(s)</span>
      </div>
    </section>
  );
}

function CompileComparison({
  current,
  previous,
  comparisonKind = "previous",
}: {
  current: Result;
  previous: HistoryEntry | null;
  comparisonKind?: "previous" | "baseline";
}) {
  if (!previous) {
    return (
      <section className="cf-premium-card mt-4 rounded-[26px] border border-white/80 bg-white/78 p-5 shadow-[0_18px_50px_rgba(55,65,81,.08)] sm:p-6">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#0a84ff]" />
          <h3 className="text-[15px] font-semibold text-slate-950">Run comparison</h3>
        </div>
        <p className="mt-2 text-[12px] leading-5 text-slate-500">
          Compile another run to compare evidence retention, token reduction, and confidence against the previous result.
        </p>
      </section>
    );
  }

  const currentManifest = readExplainabilityManifest(current);
  const previousManifest = readExplainabilityManifest(previous.result);

  const currentSelected = currentManifest?.selected ?? [];
  const previousSelected = previousManifest?.selected ?? [];
  const currentRejected = currentManifest?.rejected ?? [];
  const previousRejected = previousManifest?.rejected ?? [];

  const evidenceKey = (item: ExplainabilityEvidence) =>
    `${item.source_id ?? ""}|${item.page ?? ""}|${(item.text ?? "").trim().toLowerCase()}`;

  const currentSelectedKeys = new Set(currentSelected.map(evidenceKey));
  const previousSelectedKeys = new Set(previousSelected.map(evidenceKey));
  const previousRejectedKeys = new Set(previousRejected.map(evidenceKey));

  const newlyKept = currentSelected.filter((item) => !previousSelectedKeys.has(evidenceKey(item)));
  const newlyRejected = currentRejected.filter((item) => !previousRejectedKeys.has(evidenceKey(item)));
  const noLongerKept = previousSelected.filter((item) => !currentSelectedKeys.has(evidenceKey(item)));

  const disappearedCritical = noLongerKept.filter((item) => item.hard || item.mandatory);
  const disappearedNumeric = noLongerKept.filter((item) => item.has_number);

  const isDisplayFacet = (facet: string | null | undefined): facet is string => {
    if (!facet) return false;
    const value = facet.trim();
    if (!value || value.length > 36) return false;
    if (/[.!?]/.test(value)) return false;
    return value.split(/\s+/).length <= 4;
  };

  const currentFacets = new Set(
    currentSelected.map((item) => item.facet).filter(isDisplayFacet),
  );
  const previousFacets = new Set(
    previousSelected.map((item) => item.facet).filter(isDisplayFacet),
  );

  const gainedFacets = [...currentFacets].filter((facet) => !previousFacets.has(facet));
  const lostFacets = [...previousFacets].filter((facet) => !currentFacets.has(facet));

  const reductionDelta = Math.round((current.reduction_percent - previous.result.reduction_percent) * 100) / 100;
  const confidenceDelta = Math.round(
    (current.retrieval_confidence ?? 0) - (previous.result.retrieval_confidence ?? 0),
  );
  const tokenDelta = current.optimized_tokens - previous.result.optimized_tokens;

  const signed = (value: number, suffix = "") =>
    `${value > 0 ? "+" : ""}${value}${suffix}`;

  const deltaClass = (value: number, positiveIsGood = true) => {
    const good = positiveIsGood ? value > 0 : value < 0;
    const bad = positiveIsGood ? value < 0 : value > 0;
    if (good) return "text-emerald-700 bg-emerald-50 border-emerald-200/70";
    if (bad) return "text-rose-700 bg-rose-50 border-rose-200/70";
    return "text-slate-600 bg-slate-50 border-slate-200/70";
  };

  return (
    <section className="cf-premium-card mt-4 overflow-hidden rounded-[26px] border border-white/80 bg-white/78 shadow-[0_18px_50px_rgba(55,65,81,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/65 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#0a84ff]" />
            <h3 className="text-[15px] font-semibold text-slate-950">Run comparison</h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">
            {comparisonKind === "baseline"
              ? "Current compile compared with your saved baseline."
              : "Current compile compared with the most recent matching-source, matching-task run."}
          </p>
        </div>
        <div className="rounded-full border border-slate-200/70 bg-white/80 px-3 py-1.5 text-[10px] font-medium text-slate-500">
          {new Date(previous.createdAt).toLocaleString()}
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <div className={`rounded-2xl border p-4 ${deltaClass(reductionDelta, true)}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Reduction Δ</p>
          <p className="mt-1 text-xl font-semibold">{signed(reductionDelta, "%")}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${deltaClass(confidenceDelta, true)}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Confidence Δ</p>
          <p className="mt-1 text-xl font-semibold">{signed(confidenceDelta, "%")}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${deltaClass(tokenDelta, false)}`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">Final tokens Δ</p>
          <p className="mt-1 text-xl font-semibold">{signed(tokenDelta)}</p>
        </div>
      </div>

      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/65 bg-white/72 p-4">
          <p className="text-[11px] font-semibold text-slate-700">Newly kept</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{newlyKept.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/65 bg-white/72 p-4">
          <p className="text-[11px] font-semibold text-slate-700">Newly rejected</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{newlyRejected.length}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${disappearedCritical.length ? "border-rose-200/70 bg-rose-50/70" : "border-slate-200/65 bg-white/72"}`}>
          <p className="text-[11px] font-semibold text-slate-700">Critical disappeared</p>
          <p className={`mt-1 text-2xl font-semibold ${disappearedCritical.length ? "text-rose-700" : "text-slate-950"}`}>
            {disappearedCritical.length}
          </p>
        </div>
        <div className={`rounded-2xl border p-4 ${disappearedNumeric.length ? "border-amber-200/70 bg-amber-50/70" : "border-slate-200/65 bg-white/72"}`}>
          <p className="text-[11px] font-semibold text-slate-700">Relevant numeric disappeared</p>
          <p className={`mt-1 text-2xl font-semibold ${disappearedNumeric.length ? "text-amber-700" : "text-slate-950"}`}>
            {disappearedNumeric.length}
          </p>
        </div>
      </div>

      {(gainedFacets.length > 0 || lostFacets.length > 0 || newlyKept.length > 0 || noLongerKept.length > 0) && (
        <div className="border-t border-slate-200/60 bg-slate-50/55 px-5 py-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Facet changes</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {gainedFacets.map((facet) => (
                  <span key={`gain-${facet}`} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
                    + {facet}
                  </span>
                ))}
                {lostFacets.map((facet) => (
                  <span key={`lost-${facet}`} className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700">
                    − {facet}
                  </span>
                ))}
                {gainedFacets.length === 0 && lostFacets.length === 0 && (
                  <span className="text-[10px] text-slate-500">No facet changes</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Regression guard</p>
              <p className={`mt-2 text-[11px] leading-5 ${
                disappearedCritical.length || disappearedNumeric.length ? "text-rose-700" : "text-emerald-700"
              }`}>
                {disappearedCritical.length || disappearedNumeric.length
                  ? `${disappearedCritical.length} critical and ${disappearedNumeric.length} numeric evidence item(s) from the previous run are no longer retained.`
                  : "No previously retained critical or numeric evidence disappeared."}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function EvidenceQualityDashboard({
  manifest,
  retrievalConfidence = 0,
}: {
  manifest?: ExplainabilityManifest | null;
  retrievalConfidence?: number | null;
}) {
  const selected = manifest?.selected ?? [];
  const rejected = manifest?.rejected ?? [];
  const all = [...selected, ...rejected];
  const backendMetrics = manifest?.metrics ?? {};

  const clampPercent = (value: number) =>
    Math.max(0, Math.min(100, Math.round(value)));

  const readBackendMetric = (...keys: string[]): number | null => {
    for (const key of keys) {
      const raw = backendMetrics[key];
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      return clampPercent(raw <= 1 ? raw * 100 : raw);
    }
    return null;
  };

  const ratio = (numerator: number, denominator: number): number | null =>
    denominator > 0 ? clampPercent((numerator / denominator) * 100) : null;

  const isCritical = (item: ExplainabilityEvidence) =>
    Boolean(item.hard || item.mandatory);
  const isNumeric = (item: ExplainabilityEvidence) =>
    Boolean(item.has_number);
  const hasConstraint = (item: ExplainabilityEvidence) =>
    Boolean(item.structured_constraints?.length);
  const isDistractor = (item: ExplainabilityEvidence) =>
    item.semantic_role?.toUpperCase() === "IRRELEVANT";

  const selectedCritical = selected.filter(isCritical).length;
  const allCritical = all.filter(isCritical).length;

  const selectedNumeric = selected.filter(isNumeric).length;
  const allNumeric = all.filter(isNumeric).length;

  const selectedConstraints = selected.filter(hasConstraint).length;
  const allConstraints = all.filter(hasConstraint).length;

  const rejectedDistractors = rejected.filter(isDistractor).length;
  const allDistractors = all.filter(isDistractor).length;

  const selectedFacets = new Set(
    selected
      .map((item) => item.facet)
      .filter((facet): facet is string => Boolean(facet)),
  );
  const allFacets = new Set(
    all
      .map((item) => item.facet)
      .filter((facet): facet is string => Boolean(facet)),
  );

  const metric = (
    label: string,
    backendValue: number | null,
    observedValue: number | null,
    backendDetail: string,
    observedDetail: string,
  ) => ({
    label,
    value: backendValue ?? observedValue,
    detail:
      backendValue !== null
        ? backendDetail
        : observedValue !== null
          ? observedDetail
          : "Unavailable for this compile",
    authoritative: backendValue !== null,
  });

  const metrics = [
    metric(
      "Critical preservation",
      readBackendMetric("critical_fact_recall", "critical_recall"),
      ratio(selectedCritical, allCritical),
      "Backend critical-fact recall",
      `${selectedCritical}/${allCritical} observed critical items retained`,
    ),
    metric(
      "Numeric preservation",
      readBackendMetric("numeric_fact_recall", "numeric_recall"),
      ratio(selectedNumeric, allNumeric),
      "Backend numeric-fact recall",
      `${selectedNumeric}/${allNumeric} observed numeric items retained`,
    ),
    metric(
      "Constraint preservation",
      readBackendMetric("constraint_recall"),
      ratio(selectedConstraints, allConstraints),
      "Backend constraint recall",
      `${selectedConstraints}/${allConstraints} observed constrained items retained`,
    ),
    metric(
      "Distractor rejection",
      readBackendMetric("distractor_rejection", "distractor_rejection_rate"),
      ratio(rejectedDistractors, allDistractors),
      "Backend distractor rejection",
      `${rejectedDistractors}/${allDistractors} observed irrelevant items rejected`,
    ),
    metric(
      "Facet coverage",
      readBackendMetric("facet_coverage", "facet_coverage_percent"),
      ratio(selectedFacets.size, allFacets.size),
      "Backend facet coverage",
      `${selectedFacets.size}/${allFacets.size} observed facets retained`,
    ),
    metric(
      "Provenance coverage",
      readBackendMetric("provenance", "provenance_coverage"),
      null,
      "Backend provenance coverage",
      "",
    ),
  ];

  const availableValues = metrics
    .map((item) => item.value)
    .filter((value): value is number => value !== null);

  const authoritativeCount = metrics.filter(
    (item) => item.authoritative && item.value !== null,
  ).length;

  // Trust Score is shown only when the backend supplies enough independent
  // quality metrics. Observed manifest ratios remain useful diagnostics, but
  // are not treated as ground-truth recall.
  const trustScore =
    authoritativeCount >= 4
      ? clampPercent(
          metrics
            .filter((item) => item.authoritative && item.value !== null)
            .reduce((sum, item) => sum + (item.value ?? 0), 0) /
            authoritativeCount,
        )
      : null;

  const trustLabel =
    trustScore === null
      ? "Not scored"
      : trustScore >= 90
        ? "Excellent"
        : trustScore >= 75
          ? "Strong"
          : trustScore >= 60
            ? "Moderate"
            : "Review";

  return (
    <section className="cf-premium-card mt-4 overflow-hidden rounded-[26px] border border-white/80 bg-white/78 shadow-[0_18px_50px_rgba(55,65,81,.08)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/65 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.45)]" />
            <h3 className="text-[15px] font-semibold text-slate-950">
              Evidence quality
            </h3>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">
            Backend quality metrics where available; otherwise observed manifest coverage.
          </p>
        </div>

        <div
          className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 ${
            trustScore === null
              ? "border-slate-200/80 bg-slate-50/80"
              : "border-emerald-200/70 bg-emerald-50/75"
          }`}
        >
          <div>
            <p
              className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${
                trustScore === null
                  ? "text-slate-500"
                  : "text-emerald-700/70"
              }`}
            >
              Trust score
            </p>
            <p
              className={`mt-0.5 text-[11px] font-medium ${
                trustScore === null ? "text-slate-600" : "text-emerald-700"
              }`}
            >
              {trustLabel}
            </p>
          </div>
          <div
            className={`text-2xl font-semibold tracking-[-0.04em] ${
              trustScore === null ? "text-slate-500" : "text-emerald-700"
            }`}
          >
            {trustScore === null ? "—" : trustScore}
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {metrics.map((item) => {
          const display = item.value === null ? "—" : `${item.value}%`;
          const width = item.value ?? 0;

          return (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200/65 bg-white/72 p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[12px] font-semibold text-slate-700">
                  {item.label}
                </p>
                <span className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
                  {display}
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0a84ff,#5e5ce6,#32ade6)] transition-[width] duration-700"
                  style={{ width: `${width}%` }}
                />
              </div>

              <div className="mt-2 flex items-start justify-between gap-2">
                <p className="text-[10px] leading-4 text-slate-500">
                  {item.detail}
                </p>
                {item.value !== null && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] ${
                      item.authoritative
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.authoritative ? "backend" : "observed"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 bg-slate-50/55 px-5 py-3 text-[10px] text-slate-500 sm:px-6">
        <span>
          {selected.length} retained · {rejected.length} rejected
        </span>
        <span>
          {availableValues.length}/6 signals available · {authoritativeCount}/6 backend-scored · retrieval confidence{" "}
          {Math.round(retrievalConfidence ?? 0)}%
        </span>
      </div>
    </section>
  );
}

function ExplainabilityPanel({ manifest }: { manifest: ExplainabilityManifest }) {
  const selected = manifest.selected ?? [];
  const rejected = manifest.rejected ?? [];
  const summary = manifest.summary ?? {};
  const facets = summary.facets_covered ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DiagnosticCard label="Retained evidence" value={`${summary.selected_count ?? selected.length}`} detail="selected evidence units" icon={<ListChecks className="h-4 w-4" />} />
        <DiagnosticCard label="Rejected evidence" value={`${summary.rejected_count ?? rejected.length}`} detail="excluded with traceable reasons" icon={<Target className="h-4 w-4" />} />
        <DiagnosticCard label="Facets covered" value={`${facets.length}`} detail={facets.length ? facets.join(", ") : "no facet metadata"} icon={<FileSearch className="h-4 w-4" />} />
        <DiagnosticCard label="Strategy" value={manifest.strategy ?? "—"} detail={`manifest v${manifest.version ?? "2.0"}`} icon={<Layers3 className="h-4 w-4" />} />
      </div>

      <div className="cf-premium-card cf-glass-panel rounded-2xl border border-slate-200/70 bg-[#f7f8fa]/92 p-5">
        <div>
          <p className="text-[13px] font-semibold text-slate-700">Why this evidence survived</p>
          <p className="mt-1 text-[13px] text-slate-500">Evidence type, facet, constraints, semantic role, and provenance for every retained unit.</p>
        </div>

        <div className="mt-4 space-y-3">
          {selected.map((item, index) => (
            <div key={`${item.source_id ?? item.text ?? "evidence"}-${index}`} className="cf-premium-card cf-stagger-card rounded-2xl border border-slate-200/70 bg-white/72 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                  <span>Evidence {String(index + 1).padStart(2, "0")}</span>
                  {item.page != null && <span className="rounded-md bg-slate-200/80 px-2 py-1">Page {item.page}</span>}
                  {item.facet && <span className="rounded-md bg-[#0a84ff]/10 px-2 py-1 text-[#0a84ff]">{item.facet}</span>}
                  {item.evidence_type && <span className="rounded-md bg-violet-500/10 px-2 py-1 text-violet-600">{item.evidence_type}</span>}
                  {item.semantic_role && <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700">{item.semantic_role}</span>}
                </div>
              </div>

              <p className="mt-3 text-[17px] leading-7 text-slate-800">{item.text || "Evidence text unavailable."}</p>

              {(item.reasons?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Why kept</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.reasons?.map((reason) => (
                      <span key={reason} className="rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                        {reason.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(item.structured_constraints?.length ?? 0) > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/80 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">Preserved constraints</p>
                  <div className="mt-2 space-y-1.5">
                    {item.structured_constraints?.map((constraint, constraintIndex) => (
                      <p key={constraintIndex} className="font-mono text-[12px] leading-5 text-amber-900">{formatConstraintValue(constraint)}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {rejected.length > 0 && (
        <details open className="rounded-2xl border border-rose-200/70 bg-rose-50/45 p-5">
          <summary className="cursor-pointer text-[13px] font-semibold text-slate-800">
            Rejected evidence ({rejected.length})
          </summary>
          <p className="mt-2 text-[12px] leading-5 text-slate-500">
            Evidence excluded from the compiled context, with the causal decision trace that removed it.
          </p>
          <div className="mt-4 space-y-3">
            {rejected.map((item, index) => {
              const rejectionReasons = item.rejection_reasons?.length
                ? item.rejection_reasons
                : item.reasons ?? [];

              return (
                <div
                  key={`${item.source_id ?? item.text ?? "rejected"}-${index}`}
                  className="cf-premium-card cf-stagger-card rounded-2xl border border-rose-200/70 bg-white/80 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
                    <span className="text-slate-500">Rejected {String(index + 1).padStart(2, "0")}</span>
                    {item.rejection_stage && (
                      <span className="rounded-md bg-rose-100 px-2 py-1 text-rose-700">
                        {item.rejection_stage.replaceAll("_", " ")}
                      </span>
                    )}
                    {item.semantic_role && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                        {item.semantic_role}
                      </span>
                    )}
                    {item.facet && (
                      <span className="rounded-md bg-[#0a84ff]/10 px-2 py-1 text-[#0a84ff]">
                        {item.facet}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-[15px] leading-7 text-slate-800">
                    {item.text || "Rejected evidence text unavailable."}
                  </p>

                  {rejectionReasons.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700">
                        Why rejected
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rejectionReasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-rose-200/80 bg-rose-50 px-2.5 py-1 text-[11px] text-rose-700"
                          >
                            {reason.replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

const HISTORY_KEY = "contextforge_history_v2_1";

const presets = [
  { name: "Security rules", task: "Extract authentication, authorization, password, token expiration, MFA, account lockout, and other security requirements." },
  { name: "Research findings", task: "Extract the study objective, methods, key numeric results, limitations, and conclusions." },
  { name: "Technical requirements", task: "Extract system requirements, limits, dependencies, configuration values, interfaces, and failure behavior." },
  { name: "Executive summary", task: "Extract the most decision-relevant facts, numbers, risks, constraints, and recommended actions." },
];

const modeInfo: Record<string, { label: string; description: string; badge: string }> = {
  safe: { label: "Safe", description: "Keeps more supporting context", badge: "~90% target" },
  balanced: { label: "Balanced", description: "Best default for most work", badge: "~78% target" },
  aggressive: { label: "Aggressive", description: "Prioritizes the smallest context", badge: "~60% target" },
};

const loadingStages = [
  "Reading source",
  "Ranking sections",
  "Selecting evidence",
  "Packing token budget",
];

// contextforgeStandardSurfaceComplete
// contextforgePublicBetaReadiness

type StandardTrustCheck = {
  id: string;
  label: string;
  status: "pass" | "review" | "unknown";
  detail: string;
};

type StandardTrustState =
  | "verified"
  | "limited"
  | "review";

type StandardTrustDecision = {
  ready: boolean;
  state: StandardTrustState;
  label: string;
  checks: StandardTrustCheck[];
  passed: number;
  review: number;
  unknown: number;
};

function readNestedNumber(
  value: unknown,
  paths: string[][],
): number | null {
  if (!value || typeof value !== "object") return null;

  for (const path of paths) {
    let current: unknown = value;

    for (const key of path) {
      if (!current || typeof current !== "object") {
        current = null;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (typeof current === "number" && Number.isFinite(current)) {
      return current;
    }
  }

  return null;
}

function readNestedBoolean(
  value: unknown,
  paths: string[][],
): boolean | null {
  if (!value || typeof value !== "object") return null;

  for (const path of paths) {
    let current: unknown = value;

    for (const key of path) {
      if (!current || typeof current !== "object") {
        current = null;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (typeof current === "boolean") {
      return current;
    }
  }

  return null;
}

function readNestedArrayLength(
  value: unknown,
  paths: string[][],
): number | null {
  if (!value || typeof value !== "object") return null;

  for (const path of paths) {
    let current: unknown = value;

    for (const key of path) {
      if (!current || typeof current !== "object") {
        current = null;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (Array.isArray(current)) {
      return current.length;
    }
  }

  return null;
}


// === ContextForge backend-authoritative Standard Trust ===
function resolveStandardTrustDecision(
  result: Parameters<typeof evaluateStandardEvidenceTrust>[0]
): StandardTrustDecision {
  const manifest = readExplainabilityManifest(result) as
    | {
        trust?: {
          version?: unknown;
          state?: unknown;
          label?: unknown;
          verified?: unknown;
          passed_count?: unknown;
          review_count?: unknown;
          unavailable_count?: unknown;
          checks?: unknown;
        };
      }
    | null
    | undefined;

  const backendTrust = manifest?.trust;

  const backendState =
    backendTrust?.state === "verified" ||
    backendTrust?.state === "limited" ||
    backendTrust?.state === "review"
      ? backendTrust.state
      : null;

  const backendLabel =
    typeof backendTrust?.label === "string" &&
    backendTrust.label.trim().length > 0
      ? backendTrust.label.trim()
      : null;

  /*
   * The local evaluator remains a compatibility fallback for responses
   * created by older ContextForge engines that do not expose manifest.trust.
   */
  const localDecision = evaluateStandardEvidenceTrust(result);

  if (!backendState || !backendLabel) {
    return localDecision;
  }

  /*
   * Backend-authoritative evidence checks.
   *
   * The engine owns both the verdict and, when available, the individual
   * integrity checks. "unavailable" maps to the existing Standard UI's
   * "unknown" presentation state.
   */
  const backendChecks = Array.isArray(backendTrust?.checks)
    ? backendTrust.checks
        .filter(
          (candidate): candidate is Record<string, unknown> =>
            typeof candidate === "object" &&
            candidate !== null &&
            !Array.isArray(candidate)
        )
        .map((candidate) => {
          const id =
            typeof candidate.id === "string"
              ? candidate.id
              : "backend_check";

          const label =
            typeof candidate.label === "string" &&
            candidate.label.trim().length > 0
              ? candidate.label.trim()
              : id;

          const status =
            candidate.status === "pass"
              ? "pass"
              : candidate.status === "review"
                ? "review"
                : "unknown";

          const rawValue = candidate.value;

          let detail = "Backend verification";

          if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
            detail = `${Math.round(rawValue * 100)}%`;
          } else if (typeof rawValue === "boolean") {
            detail = rawValue ? "Complete" : "Incomplete";
          } else if (candidate.status === "unavailable") {
            detail = "Unavailable";
          }

          return {
            id,
            label,
            status,
            detail,
          };
        })
    : [];

  return {
    ...localDecision,
    state: backendState,
    label: backendLabel,

    /*
     * Double assertion is deliberate at this compatibility boundary:
     * StandardTrustCheck is an internal UI representation while the
     * manifest is a runtime API contract. Runtime fields are validated
     * above before crossing that boundary.
     */
    checks:
      backendChecks.length > 0
        ? (backendChecks as unknown as StandardTrustDecision["checks"])
        : localDecision.checks,
  };
}


// === ContextForge Standard Trust evidence drill-down ===
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StandardTrustEvidenceDrilldown({
  result,
}: {
  result: Parameters<typeof readExplainabilityManifest>[0];
}) {
  const manifest = readExplainabilityManifest(result) as
    | {
        metrics?: Record<string, unknown>;
        trust?: {
          checks?: unknown;
        };
        selected?: unknown;
        rejected?: unknown;
      }
    | null
    | undefined;

  if (!manifest) {
    return null;
  }

  const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  const selected = Array.isArray(manifest.selected)
    ? manifest.selected
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];

  const rejected = Array.isArray(manifest.rejected)
    ? manifest.rejected
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];

  const trustChecks = Array.isArray(manifest.trust?.checks)
    ? manifest.trust.checks
        .map(asRecord)
        .filter((item): item is Record<string, unknown> => item !== null)
    : [];

  if (trustChecks.length === 0) {
    return null;
  }

  const textValue = (
    item: Record<string, unknown>,
    key: string,
  ): string | null => {
    const value = item[key];

    return typeof value === "string" && value.trim()
      ? value.trim()
      : null;
  };

  const boolValue = (
    item: Record<string, unknown>,
    key: string,
  ): boolean =>
    item[key] === true;

  const labels = (
    item: Record<string, unknown>,
  ): string[] =>
    Array.isArray(item.evidence_labels)
      ? item.evidence_labels.filter(
          (label): label is string =>
            typeof label === "string",
        )
      : [];

  const matchedFacets = (
    item: Record<string, unknown>,
  ): string[] =>
    Array.isArray(item.matched_facets)
      ? item.matched_facets.filter(
          (facet): facet is string =>
            typeof facet === "string" && facet.trim().length > 0,
        )
      : [];

  const reasons = (
    item: Record<string, unknown>,
  ): string[] =>
    Array.isArray(item.reasons)
      ? item.reasons.filter(
          (reason): reason is string =>
            typeof reason === "string",
        )
      : [];

  const isIrrelevantRejected = (
    item: Record<string, unknown>,
  ): boolean => {
    const itemReasons = reasons(item);

    return (
      itemReasons.includes("semantic_veto") ||
      itemReasons.includes("excluded_by_task_scope") ||
      itemReasons.some((reason) =>
        reason.startsWith("semantic_role:IRRELEVANT")
      )
    );
  };

  const relevantRejected = rejected.filter(
    (item) => !isIrrelevantRejected(item),
  );

  const isCritical = (
    item: Record<string, unknown>,
  ): boolean =>
    boolValue(item, "hard") ||
    boolValue(item, "mandatory") ||
    labels(item).some((label) =>
      [
        "critical",
        "mandatory",
        "constraint",
        "requirement",
      ].includes(label.toLowerCase())
    );

  const isNumeric = (
    item: Record<string, unknown>,
  ): boolean =>
    boolValue(item, "has_number");

  const hasProvenance = (
    item: Record<string, unknown>,
  ): boolean =>
    item.source_id !== null &&
    item.source_id !== undefined ||
    item.page !== null &&
    item.page !== undefined;

  const isHard = (
    item: Record<string, unknown>,
  ): boolean =>
    boolValue(item, "hard") ||
    boolValue(item, "mandatory");

  const evidenceForCheck = (
    id: string,
  ): Record<string, unknown>[] => {
    switch (id) {
      case "critical_evidence":
        return selected.filter(isCritical);

      case "numeric_preservation":
        return selected.filter(isNumeric);

      case "provenance":
        return selected.filter(hasProvenance);

      case "objective_coverage":
        return selected.filter(
          (item) =>
            textValue(item, "facet") !== null ||
            matchedFacets(item).length > 0,
        );

      case "hard_evidence":
        return selected.filter(isHard);

      default:
        return selected;
    }
  };

  const metricDetail = (
    id: string,
  ): string | null => {
    const metrics = manifest.metrics ?? {};

    const metricKey =
      id === "critical_evidence"
        ? "critical_fact_recall"
        : id === "numeric_preservation"
          ? "numeric_fact_recall"
          : id === "provenance"
            ? "provenance_coverage"
            : id === "objective_coverage"
              ? "facet_coverage"
              : id === "hard_evidence"
                ? "hard_evidence_complete"
                : null;

    if (!metricKey) {
      return null;
    }

    const value = metrics[metricKey];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return `${Math.round(value * 100)}%`;
    }

    if (typeof value === "boolean") {
      return value ? "Complete" : "Incomplete";
    }

    return null;
  };

  const provenanceLabel = (
    item: Record<string, unknown>,
  ): string => {
    const sourceId =
      item.source_id !== null &&
      item.source_id !== undefined
        ? String(item.source_id)
        : null;

    const page =
      item.page !== null &&
      item.page !== undefined
        ? String(item.page)
        : null;

    if (sourceId && page) {
      return `Source ${sourceId} · page ${page}`;
    }

    if (sourceId) {
      return `Source ${sourceId}`;
    }

    if (page) {
      return `Page ${page}`;
    }

    return "Source location unavailable";
  };

  const explanation = (
    id: string,
    status: string,
  ): string => {
    const outcome =
      status === "pass"
        ? "The backend verification passed."
        : status === "review"
          ? "The backend found a condition that requires review."
          : "The backend could not fully verify this check.";

    const meaning =
      id === "critical_evidence"
        ? "Critical and mandatory evidence retained by the compiler is shown below."
        : id === "numeric_preservation"
          ? "Selected evidence containing numeric limits or quantities is shown below."
          : id === "provenance"
            ? "Selected evidence with a traceable source unit or document page is shown below."
            : id === "objective_coverage"
              ? "Evidence mapped to task facets is shown below."
              : id === "hard_evidence"
                ? "Hard or mandatory evidence retained for the task is shown below."
                : "Selected evidence contributing to this Trust check is shown below.";

    return `${outcome} ${meaning}`;
  };

  return (
    <section
      data-contextforge-standard-trust-drilldown="true"
      className="mt-4 rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Verification evidence
          </div>

          <p className="mt-1 text-[12px] leading-5 text-slate-500">
            Expand a backend Trust check to inspect the evidence behind its verdict.
          </p>
        </div>

        <div className="text-[11px] font-medium text-slate-500">
          {selected.length} selected · {relevantRejected.length} relevant rejected
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {trustChecks.map((check, index) => {
          const id =
            typeof check.id === "string"
              ? check.id
              : `trust-check-${index}`;

          const label =
            typeof check.label === "string"
              ? check.label
              : id;

          const status =
            check.status === "pass"
              ? "pass"
              : check.status === "review"
                ? "review"
                : "unavailable";

          const evidence = evidenceForCheck(id);
          const metric = metricDetail(id);

          const statusClass =
            status === "pass"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : status === "review"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-500";

          return (
            <details
              key={id}
              data-contextforge-trust-check-detail={id}
              className="group overflow-hidden rounded-[16px] border border-slate-200/80 bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-900">
                    {label}
                  </div>

                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {metric ?? "Backend verification"}
                    {" · "}
                    {evidence.length} supporting evidence
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${statusClass}`}
                >
                  {status === "pass"
                    ? "Pass"
                    : status === "review"
                      ? "Review"
                      : "Unavailable"}
                </span>
              </summary>

              <div className="border-t border-slate-200/70 px-4 py-4">
                <p className="text-[12px] leading-5 text-slate-600">
                  {explanation(id, status)}
                </p>

                {evidence.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {evidence.slice(0, 8).map((item, evidenceIndex) => {
                      const evidenceText =
                        textValue(item, "text") ??
                        textValue(item, "sentence") ??
                        "Evidence text unavailable";

                      const facet = textValue(item, "facet");
                      const evidenceType =
                        textValue(item, "evidence_type");

                      return (
                        <div
                          key={`${id}-${evidenceIndex}`}
                          className="rounded-[14px] border border-slate-200/70 bg-slate-50/80 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                            <span>{provenanceLabel(item)}</span>

                            {facet ? (
                              <span>· {facet}</span>
                            ) : null}

                            {evidenceType ? (
                              <span>· {evidenceType}</span>
                            ) : null}
                          </div>

                          <p className="mt-1.5 text-[12px] leading-5 text-slate-700">
                            {evidenceText}
                          </p>
                        </div>
                      );
                    })}

                    {evidence.length > 8 ? (
                      <div className="px-1 text-[11px] text-slate-500">
                        + {evidence.length - 8} additional supporting evidence units
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[14px] border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                    No supporting evidence units were exposed for this check.
                  </div>
                )}

                {status !== "pass" && relevantRejected.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">
                      Relevant rejected evidence
                    </div>

                    <div className="mt-2 space-y-2">
                      {relevantRejected.slice(0, 5).map(
                        (item, rejectedIndex) => (
                          <div
                            key={`${id}-rejected-${rejectedIndex}`}
                            className="rounded-[14px] border border-amber-200/70 bg-amber-50/70 p-3"
                          >
                            <div className="text-[10px] font-semibold text-amber-700">
                              {provenanceLabel(item)}
                            </div>

                            <p className="mt-1 text-[12px] leading-5 text-slate-700">
                              {textValue(item, "text") ??
                                textValue(item, "sentence") ??
                                "Rejected evidence text unavailable"}
                            </p>

                            {reasons(item).length > 0 ? (
                              <p className="mt-1.5 text-[10px] text-slate-500">
                                {reasons(item).join(" · ")}
                              </p>
                            ) : null}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function evaluateStandardEvidenceTrust(
  result: Result,
): StandardTrustDecision {
  const manifest = readExplainabilityManifest(result) as unknown;

  const confidence = result.retrieval_confidence ?? 0;

  const expectedReduction =
    result.original_tokens > 0
      ? (result.tokens_saved / result.original_tokens) * 100
      : 0;

  const arithmeticValid =
    result.tokens_saved >= 0 &&
    result.tokens_saved <= result.original_tokens &&
    Math.abs(result.reduction_percent - expectedReduction) <= 1.5;

  const selectedEvidence =
    readNestedArrayLength(manifest, [
      ["selected_evidence"],
      ["selectedEvidence"],
      ["selected"],
      ["evidence", "selected"],
      ["manifest", "selected_evidence"],
    ]) ??
    readNestedNumber(manifest, [
      ["selected_evidence_count"],
      ["selectedEvidenceCount"],
      ["metrics", "selected_evidence"],
      ["metrics", "selected_evidence_count"],
      ["summary", "selected_count"],
    ]);

  const criticalRecall =
    readNestedNumber(manifest, [
      ["metrics", "critical_fact_recall"],
      ["metrics", "critical_recall"],
      ["critical_fact_recall"],
      ["critical_recall"],
      ["quality", "critical_fact_recall"],
    ]);

  const numericRecall =
    readNestedNumber(manifest, [
      ["metrics", "numeric_fact_recall"],
      ["metrics", "numeric_recall"],
      ["numeric_fact_recall"],
      ["numeric_recall"],
      ["quality", "numeric_fact_recall"],
    ]);

  const provenance =
    readNestedNumber(manifest, [
      ["metrics", "provenance"],
      ["metrics", "provenance_coverage"],
      ["provenance"],
      ["provenance_coverage"],
      ["quality", "provenance"],
    ]);

  const facetCoverage =
    readNestedNumber(manifest, [
      ["metrics", "facet_coverage"],
      ["facet_coverage"],
      ["quality", "facet_coverage"],
    ]);

  const hardEvidencePassed =
    readNestedBoolean(manifest, [
      ["hard_evidence_complete"],
      ["hardEvidenceComplete"],
      ["quality", "hard_evidence_complete"],
      ["metrics", "hard_evidence_complete"],
    ]);

  const normalizeRatio = (value: number | null): number | null => {
    if (value === null) return null;
    return value <= 1 ? value * 100 : value;
  };

  const normalizedCritical = normalizeRatio(criticalRecall);
  const normalizedNumeric = normalizeRatio(numericRecall);
  const normalizedProvenance = normalizeRatio(provenance);
  const normalizedFacet = normalizeRatio(facetCoverage);

  const checks: StandardTrustCheck[] = [
    {
      id: "confidence",
      label: "Retrieval confidence",
      status: confidence >= 50 ? "pass" : "review",
      detail:
        confidence >= 50
          ? `${confidence}% confidence meets the Standard threshold.`
          : `${confidence}% confidence should be reviewed.`,
    },
    {
      id: "arithmetic",
      label: "Metric integrity",
      status: arithmeticValid ? "pass" : "review",
      detail: arithmeticValid
        ? "Compression totals are mathematically consistent."
        : "Compression totals require review.",
    },
    {
      id: "evidence",
      label: "Evidence selected",
      status:
        selectedEvidence === null
          ? "unknown"
          : selectedEvidence > 0
            ? "pass"
            : "review",
      detail:
        selectedEvidence === null
          ? "Manifest does not expose a recognized evidence-count field."
          : selectedEvidence > 0
            ? `${selectedEvidence} evidence unit${selectedEvidence === 1 ? "" : "s"} selected.`
            : "No evidence units were selected.",
    },
    {
      id: "critical",
      label: "Critical evidence",
      status:
        hardEvidencePassed === true
          ? "pass"
          : hardEvidencePassed === false
            ? "review"
            : normalizedCritical === null
              ? "unknown"
              : normalizedCritical >= 99
                ? "pass"
                : "review",
      detail:
        hardEvidencePassed === true
          ? "Hard-evidence coverage passed."
          : hardEvidencePassed === false
            ? "Hard-evidence coverage failed."
            : normalizedCritical === null
              ? "Critical-evidence recall is not exposed by this manifest."
              : `${normalizedCritical.toFixed(0)}% critical-evidence recall.`,
    },
    {
      id: "numeric",
      label: "Numeric preservation",
      status:
        normalizedNumeric === null
          ? "unknown"
          : normalizedNumeric >= 99
            ? "pass"
            : "review",
      detail:
        normalizedNumeric === null
          ? "Numeric recall is not exposed by this manifest."
          : `${normalizedNumeric.toFixed(0)}% numeric recall.`,
    },
    {
      id: "provenance",
      label: "Provenance",
      status:
        normalizedProvenance === null
          ? "unknown"
          : normalizedProvenance >= 99
            ? "pass"
            : "review",
      detail:
        normalizedProvenance === null
          ? "Provenance coverage is not exposed by this manifest."
          : `${normalizedProvenance.toFixed(0)}% provenance coverage.`,
    },
    {
      id: "facets",
      label: "Objective coverage",
      status:
        normalizedFacet === null
          ? "unknown"
          : normalizedFacet >= 95
            ? "pass"
            : "review",
      detail:
        normalizedFacet === null
          ? "Facet coverage is not exposed by this manifest."
          : `${normalizedFacet.toFixed(0)}% objective/facet coverage.`,
    },
  ];

  const passed = checks.filter((check) => check.status === "pass").length;
  const review = checks.filter((check) => check.status === "review").length;
  const unknown = checks.filter((check) => check.status === "unknown").length;

  /*
   * Unknown optional manifest fields do NOT cause a false failure.
   * A concrete failed check does.
   */
  const baseReady =
    arithmeticValid &&
    confidence >= 50 &&
    selectedEvidence !== 0 &&
    review === 0;

  const state: StandardTrustState =
    !baseReady
      ? "review"
      : unknown > 0
        ? "limited"
        : "verified";

  const label =
    state === "verified"
      ? "Verified"
      : state === "limited"
        ? "Ready · limited verification"
        : "Review recommended";

  return {
    ready: state !== "review",
    state,
    label,
    checks,
    passed,
    review,
    unknown,
  };
}

export default function Home() {
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [contextforgeExperienceMode, setContextforgeExperienceMode] = useState<"standard" | "advanced">("standard");
  const contextforgeAdvancedMode = contextforgeExperienceMode === "advanced";
  const [contextforgeBetaOnboardingVisible, setContextforgeBetaOnboardingVisible] = useState(false);
  const [contextforgeBetaReady, setContextforgeBetaReady] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [task, setTask] = useState("");
  const [mode, setMode] = useState("balanced");
  const [budget, setBudget] = useState(1000);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState<boolean | null>(null);
  const [engineVersion, setEngineVersion] = useState("2.1");
  const [dragging, setDragging] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>("output");
  const [outputTarget, setOutputTarget] = useState<OutputTarget>("raw");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [baselineRun, setBaselineRun] = useState<HistoryEntry | null>(null);
  const [qualityGatePolicy, setQualityGatePolicy] = useState<QualityGatePolicy>(DEFAULT_QUALITY_GATE_POLICY);
  const [compilePolicyBundles, setCompilePolicyBundles] = useState<CompilePolicyBundle[]>([]);
  const [bundleExecutionGuardMode, setBundleExecutionGuardMode] = useState<BundleExecutionGuardMode>("warn");
  const [, setBundleExecutionGuardNotice] = useState<string | null>(null);
  const [bundleExecutionGuardAudit, setBundleExecutionGuardAudit] = useState<BundleExecutionGuardAuditEntry[]>([]);
  const [compilePolicyBundleRevisions, setCompilePolicyBundleRevisions] = useState<CompilePolicyBundleRevision[]>([]);
  const [compilePolicyBundleRestoreAudit, setCompilePolicyBundleRestoreAudit] = useState<CompilePolicyBundleRestoreAuditEntry[]>([]);
  const [savedQualityGateProfiles, setSavedQualityGateProfiles] = useState<SavedQualityGateProfile[]>([]);
  const [qualityGateProfileRevisions, setQualityGateProfileRevisions] = useState<QualityGateProfileRevision[]>([]);
  const [qualityGateRestoreAudit, setQualityGateRestoreAudit] = useState<QualityGateRestoreAuditEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then(async (r) => {
        setOnline(r.ok);
        if (r.ok) {
          const data = await r.json();
          if (data.version) setEngineVersion(data.version);
        }
      })
      .catch(() => setOnline(false));

    try {
      const saved = getWorkspaceItem(HISTORY_KEY);
      if (saved) window.setTimeout(() => setHistory(JSON.parse(saved)), 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!loading) {
      const resetTimer = window.setTimeout(() => setLoadingStage(0), 0);
      return () => window.clearTimeout(resetTimer);
    }
    const timer = window.setInterval(() => {
      setLoadingStage((current) => Math.min(current + 1, loadingStages.length - 1));
    }, 850);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const fileSize = useMemo(() => {
    if (!file) return "";
    const mb = file.size / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(file.size / 1024)} KB`;
  }, [file]);

  const sourceLabel = inputMode === "file" ? file?.name ?? "Uploaded file" : "Pasted text";

const formattedOutput = useMemo(() => {
  if (!result) return "";

  const compiled = result.optimized_text.trim();

  if (outputTarget === "raw") {
    return compiled;
  }

  if (outputTarget === "chatgpt") {
    return [
      "Use the compiled prompt below as the authoritative source.",
      "Preserve stated constraints and do not invent missing facts.",
      "",
      "COMPILED PROMPT",
      compiled,
    ].join("\n");
  }

  if (outputTarget === "claude") {
    return [
      "<compiled_prompt>",
      compiled,
      "</compiled_prompt>",
      "",
      "Use only the supplied compiled prompt for factual claims.",
      "Preserve stated constraints and source references where present.",
    ].join("\n");
  }

  return [
    "COMPILED PROMPT:",
    compiled,
    "",
    "INSTRUCTION:",
    "Use the compiled prompt above to complete the task.",
    "Keep factual claims grounded in the supplied material.",
  ].join("\n");
}, [result, outputTarget]);

  const budgetUsage = result ? Math.min(100, Math.round((result.optimized_tokens / Math.max(1, budget)) * 100)) : 0;
  const activeExecutionBundle =
    compilePolicyBundles.find(
      (bundle) =>
        bundle.mode === String(mode) &&
        bundle.budget === budget &&
        bundle.task.trim() === task.trim() &&
        bundle.qualityGatePolicy.maxConfidenceDrop === qualityGatePolicy.maxConfidenceDrop &&
        bundle.qualityGatePolicy.maxReductionDrop === qualityGatePolicy.maxReductionDrop &&
        bundle.qualityGatePolicy.criticalLossMode === qualityGatePolicy.criticalLossMode &&
        bundle.qualityGatePolicy.numericLossMode === qualityGatePolicy.numericLossMode,
    ) ?? null;

  const bundleExecutionGuard = evaluateBundleExecutionGuard({
    activeBundle: activeExecutionBundle,
    baseline: baselineRun,
    mode: String(mode),
    budget,
    task,
    policy: qualityGatePolicy,
  });

  const explainabilityManifest = result ? readExplainabilityManifest(result) : null;
  const previousHistoryEntry = result
    ? history.find((entry) =>
        entry.task.trim() === task.trim() &&
        entry.result.original_tokens === result.original_tokens &&
        !(
          entry.result.optimized_text === result.optimized_text &&
          entry.mode === mode &&
          entry.budget === budget
        ),
      ) ?? null
    : null;
  const comparisonEntry = baselineRun ?? previousHistoryEntry;
  const comparisonKind: "previous" | "baseline" = baselineRun ? "baseline" : "previous";

  function acceptFile(next: File | null) {
    if (!next) return;
    const ext = next.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt"].includes(ext ?? "")) {
      setError("Supported file types: PDF, DOCX, TXT.");
      return;
    }
    if (next.size > 25 * 1024 * 1024) {
      setError("File is larger than the 25 MB upload limit.");
      return;
    }
    setFile(next);
    setError("");
    setResult(null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0] ?? null);
  }

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-baseline");
      if (stored) {
        const parsed = JSON.parse(stored) as HistoryEntry;
        if (parsed?.result) window.setTimeout(() => setBaselineRun(parsed), 0);
      }
    } catch {
      // Ignore malformed local baseline state.
    }
  }, []);

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-quality-gate-policy");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<QualityGatePolicy>;
        queueMicrotask(() => setQualityGatePolicy({ ...DEFAULT_QUALITY_GATE_POLICY, ...parsed }));
      }
    } catch {
      // Ignore malformed local policy state.
    }
  }, []);

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-quality-gate-profiles");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        queueMicrotask(() => setSavedQualityGateProfiles(parsed as SavedQualityGateProfile[]));
      }
    } catch {
      // Ignore malformed saved profile state.
    }
  }, []);

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-quality-gate-profile-revisions");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        queueMicrotask(() => setQualityGateProfileRevisions(parsed as QualityGateProfileRevision[]));
      }
    } catch {
      // Ignore malformed revision history.
    }
  }, []);

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-quality-gate-restore-audit");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        queueMicrotask(() => setQualityGateRestoreAudit(parsed as QualityGateRestoreAuditEntry[]));
      }
    } catch {
      // Ignore malformed restore audit state.
    }
  }, []);

  function persistQualityGateRestoreAudit(next: QualityGateRestoreAuditEntry[]) {
    const trimmed = next.slice(0, 100);
    setQualityGateRestoreAudit(trimmed);
    try {
      setWorkspaceItem(
        "contextforge-quality-gate-restore-audit",
        JSON.stringify(trimmed),
      );
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function clearQualityGateRestoreAudit() {
    setQualityGateRestoreAudit([]);
    try {
      removeWorkspaceItem("contextforge-quality-gate-restore-audit");
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function persistQualityGateProfileRevisions(next: QualityGateProfileRevision[]) {
    const trimmed = next.slice(0, 60);
    setQualityGateProfileRevisions(trimmed);
    try {
      setWorkspaceItem(
        "contextforge-quality-gate-profile-revisions",
        JSON.stringify(trimmed),
      );
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function restoreQualityGateProfileRevision(revision: QualityGateProfileRevision) {
    const existing = savedQualityGateProfiles.find(
      (profile) => profile.id === revision.profileId,
    );

    const auditEntry: QualityGateRestoreAuditEntry = {
      id: `quality-restore-audit-${new Date().toISOString()}-${revision.id}`,
      restoredAt: new Date().toISOString(),
      profileId: revision.profileId,
      profileName: existing?.name ?? revision.profileName,
      revisionId: revision.id,
      revisionCreatedAt: revision.createdAt,
      before: existing ? { ...existing.policy } : null,
      after: { ...revision.policy },
    };

    const restored: SavedQualityGateProfile = {
      id: existing?.id ?? revision.profileId,
      name: existing?.name ?? revision.profileName,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      policy: { ...revision.policy },
    };

    const next = existing
      ? savedQualityGateProfiles.map((profile) =>
          profile.id === restored.id ? restored : profile,
        )
      : [restored, ...savedQualityGateProfiles].slice(0, 12);

    persistQualityGateProfiles(next);
    updateQualityGatePolicy({ ...revision.policy });
    persistQualityGateRestoreAudit([auditEntry, ...qualityGateRestoreAudit]);
  }

  function deleteQualityGateProfileRevision(id: string) {
    persistQualityGateProfileRevisions(
      qualityGateProfileRevisions.filter((revision) => revision.id !== id),
    );
  }

  function persistQualityGateProfiles(next: SavedQualityGateProfile[]) {
    setSavedQualityGateProfiles(next);
    try {
      setWorkspaceItem("contextforge-quality-gate-profiles", JSON.stringify(next));
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function saveQualityGateProfile(name: string) {
    const normalized = name.trim();
    if (!normalized) return;

    const existing = savedQualityGateProfiles.find(
      (profile) => profile.name.toLowerCase() === normalized.toLowerCase(),
    );

    if (existing) {
      const revision: QualityGateProfileRevision = {
        id: `quality-profile-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        profileId: existing.id,
        profileName: existing.name,
        createdAt: new Date().toISOString(),
        policy: { ...existing.policy },
      };

      persistQualityGateProfileRevisions([
        revision,
        ...qualityGateProfileRevisions,
      ]);
    }

    const nextProfile: SavedQualityGateProfile = {
      id: existing?.id ?? `quality-profile-${Date.now()}`,
      name: normalized,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      policy: { ...qualityGatePolicy },
    };

    const next = existing
      ? savedQualityGateProfiles.map((profile) =>
          profile.id === existing.id ? nextProfile : profile,
        )
      : [nextProfile, ...savedQualityGateProfiles].slice(0, 12);

    persistQualityGateProfiles(next);
  }

  function importQualityGateProfiles(profiles: SavedQualityGateProfile[]) {
    const byName = new Map<string, SavedQualityGateProfile>();

    for (const profile of savedQualityGateProfiles) {
      byName.set(profile.name.trim().toLowerCase(), profile);
    }

    for (const profile of profiles) {
      const key = profile.name.trim().toLowerCase();
      const existing = byName.get(key);

      byName.set(key, {
        ...profile,
        id: existing?.id ?? profile.id ?? `quality-profile-${Date.now()}-${Math.random()}`,
        createdAt: existing?.createdAt ?? profile.createdAt ?? new Date().toISOString(),
        name: profile.name.trim().slice(0, 40),
        policy: { ...profile.policy },
      });
    }

    persistQualityGateProfiles(Array.from(byName.values()).slice(0, 12));
  }

  function applySavedQualityGateProfile(profile: SavedQualityGateProfile) {
    updateQualityGatePolicy({ ...profile.policy });
  }

  function deleteQualityGateProfile(id: string) {
    persistQualityGateProfiles(
      savedQualityGateProfiles.filter((profile) => profile.id !== id),
    );
  }

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-compile-policy-bundles");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        queueMicrotask(() => setCompilePolicyBundles(parsed as CompilePolicyBundle[]));
      }
    } catch {
      // Ignore malformed bundle state.
    }
  }, []);

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-compile-policy-bundle-revisions");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        queueMicrotask(() => setCompilePolicyBundleRevisions(parsed as CompilePolicyBundleRevision[]));
      }
    } catch {
      // Ignore malformed bundle revision state.
    }
  }, []);

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-compile-policy-bundle-restore-audit");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        queueMicrotask(() => setCompilePolicyBundleRestoreAudit(parsed as CompilePolicyBundleRestoreAuditEntry[]));
      }
    } catch {
      // Ignore malformed bundle restore audit state.
    }
  }, []);

  function persistCompilePolicyBundleRestoreAudit(next: CompilePolicyBundleRestoreAuditEntry[]) {
    const trimmed = next.slice(0, 100);
    setCompilePolicyBundleRestoreAudit(trimmed);
    try {
      setWorkspaceItem(
        "contextforge-compile-policy-bundle-restore-audit",
        JSON.stringify(trimmed),
      );
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function clearCompilePolicyBundleRestoreAudit() {
    setCompilePolicyBundleRestoreAudit([]);
    try {
      removeWorkspaceItem("contextforge-compile-policy-bundle-restore-audit");
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function persistCompilePolicyBundleRevisions(next: CompilePolicyBundleRevision[]) {
    const trimmed = next.slice(0, 60);
    setCompilePolicyBundleRevisions(trimmed);
    try {
      setWorkspaceItem(
        "contextforge-compile-policy-bundle-revisions",
        JSON.stringify(trimmed),
      );
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function restoreCompilePolicyBundleRevision(revision: CompilePolicyBundleRevision) {
    const existing = compilePolicyBundles.find(
      (bundle) => bundle.id === revision.bundleId,
    );

    const auditEntry: CompilePolicyBundleRestoreAuditEntry = {
      id: `compile-bundle-restore-audit-${new Date().toISOString()}-${revision.id}`,
      restoredAt: new Date().toISOString(),
      bundleId: revision.bundleId,
      bundleName: existing?.name ?? revision.bundleName,
      revisionId: revision.id,
      revisionCreatedAt: revision.createdAt,
      before: existing ? { ...existing, qualityGatePolicy: { ...existing.qualityGatePolicy } } : null,
      after: {
        id: existing?.id ?? revision.bundleId,
        name: existing?.name ?? revision.bundleName,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        mode: revision.mode,
        budget: revision.budget,
        task: revision.task,
        qualityGatePolicy: { ...revision.qualityGatePolicy },
      },
    };

    const restored: CompilePolicyBundle = {
      id: existing?.id ?? revision.bundleId,
      name: existing?.name ?? revision.bundleName,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      mode: revision.mode,
      budget: revision.budget,
      task: revision.task,
      qualityGatePolicy: { ...revision.qualityGatePolicy },
    };

    const next = existing
      ? compilePolicyBundles.map((bundle) =>
          bundle.id === restored.id ? restored : bundle,
        )
      : [restored, ...compilePolicyBundles].slice(0, 12);

    persistCompilePolicyBundles(next);
    applyCompilePolicyBundle(restored);
    persistCompilePolicyBundleRestoreAudit([
      auditEntry,
      ...compilePolicyBundleRestoreAudit,
    ]);
  }

  function deleteCompilePolicyBundleRevision(id: string) {
    persistCompilePolicyBundleRevisions(
      compilePolicyBundleRevisions.filter((revision) => revision.id !== id),
    );
  }

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-bundle-execution-guard-mode");
      if (stored === "warn" || stored === "block") {
        queueMicrotask(() => setBundleExecutionGuardMode(stored));
      }
    } catch {
      // Local persistence is best-effort only.
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function updateBundleExecutionGuardMode(next: BundleExecutionGuardMode) {
    setBundleExecutionGuardMode(next);
    setBundleExecutionGuardNotice(null);
    try {
      setWorkspaceItem("contextforge-bundle-execution-guard-mode", next);
    } catch {
      // Local persistence is best-effort only.
    }
  }

  useEffect(() => {
    try {
      const stored = getWorkspaceItem("contextforge-bundle-execution-guard-audit");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        queueMicrotask(() => setBundleExecutionGuardAudit(parsed as BundleExecutionGuardAuditEntry[]));
      }
    } catch {
      // Ignore malformed local audit state.
    }
  }, []);

  function persistBundleExecutionGuardAudit(next: BundleExecutionGuardAuditEntry[]) {
    const trimmed = next.slice(0, 100);
    setBundleExecutionGuardAudit(trimmed);
    try {
      setWorkspaceItem(
        "contextforge-bundle-execution-guard-audit",
        JSON.stringify(trimmed),
      );
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function clearBundleExecutionGuardAudit() {
    setBundleExecutionGuardAudit([]);
    try {
      removeWorkspaceItem("contextforge-bundle-execution-guard-audit");
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function recordBundleExecutionGuardAudit(outcome: "WARN" | "BLOCK") {
    const entry: BundleExecutionGuardAuditEntry = {
      id: `bundle-execution-guard-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      outcome,
      guardMode: bundleExecutionGuardMode,
      bundleId: activeExecutionBundle?.id ?? null,
      bundleName: activeExecutionBundle?.name ?? null,
      mode: String(mode),
      budget,
      task,
      reasons: bundleExecutionGuard.reasons.map((reason) => ({ ...reason })),
    };

    persistBundleExecutionGuardAudit([entry, ...bundleExecutionGuardAudit]);
  }

  function persistCompilePolicyBundles(next: CompilePolicyBundle[]) {
    const trimmed = next.slice(0, 12);
    setCompilePolicyBundles(trimmed);
    try {
      setWorkspaceItem(
        "contextforge-compile-policy-bundles",
        JSON.stringify(trimmed),
      );
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function saveCompilePolicyBundle(name: string) {
    const normalized = name.trim().slice(0, 50);
    if (!normalized) return;

    const existing = compilePolicyBundles.find(
      (bundle) => bundle.name.toLowerCase() === normalized.toLowerCase(),
    );

    if (existing) {
      const revision: CompilePolicyBundleRevision = {
        id: `compile-policy-bundle-revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        bundleId: existing.id,
        bundleName: existing.name,
        createdAt: new Date().toISOString(),
        mode: existing.mode,
        budget: existing.budget,
        task: existing.task,
        qualityGatePolicy: { ...existing.qualityGatePolicy },
      };

      persistCompilePolicyBundleRevisions([
        revision,
        ...compilePolicyBundleRevisions,
      ]);
    }

    const nextBundle: CompilePolicyBundle = {
      id: existing?.id ?? `compile-policy-bundle-${Date.now()}`,
      name: normalized,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      mode: String(mode),
      budget,
      task,
      qualityGatePolicy: { ...qualityGatePolicy },
    };

    const next = existing
      ? compilePolicyBundles.map((bundle) =>
          bundle.id === existing.id ? nextBundle : bundle,
        )
      : [nextBundle, ...compilePolicyBundles];

    persistCompilePolicyBundles(next);
  }

  function applyCompilePolicyBundle(bundle: CompilePolicyBundle) {
    setMode(bundle.mode as typeof mode);
    setBudget(bundle.budget);
    setTask(bundle.task);
    updateQualityGatePolicy({ ...bundle.qualityGatePolicy });
  }

  function importCompilePolicyBundles(incoming: CompilePolicyBundle[]) {
    const byName = new Map<string, CompilePolicyBundle>();

    for (const bundle of compilePolicyBundles) {
      byName.set(bundle.name.trim().toLowerCase(), bundle);
    }

    for (const bundle of incoming) {
      const key = bundle.name.trim().toLowerCase();
      const existing = byName.get(key);

      byName.set(key, {
        ...bundle,
        id: existing?.id ?? bundle.id,
        createdAt: existing?.createdAt ?? bundle.createdAt,
        name: bundle.name.trim().slice(0, 50),
        task: bundle.task,
        qualityGatePolicy: { ...bundle.qualityGatePolicy },
      });
    }

    persistCompilePolicyBundles(Array.from(byName.values()).slice(0, 12));
  }

  function deleteCompilePolicyBundle(id: string) {
    persistCompilePolicyBundles(
      compilePolicyBundles.filter((bundle) => bundle.id !== id),
    );
  }

  function updateQualityGatePolicy(next: QualityGatePolicy) {
    setQualityGatePolicy(next);
    try {
      setWorkspaceItem("contextforge-quality-gate-policy", JSON.stringify(next));
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function resetQualityGatePolicy() {
    setQualityGatePolicy(DEFAULT_QUALITY_GATE_POLICY);
    try {
      removeWorkspaceItem("contextforge-quality-gate-policy");
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function saveCurrentAsBaseline() {
    if (!result) return;

    const entry: HistoryEntry = {
      id: `baseline-${Date.now()}`,
      createdAt: new Date().toISOString(),
      sourceLabel: inputMode === "file" ? file?.name ?? "Uploaded file" : "Pasted text",
      task,
      mode,
      budget,
      result,
    };

    setBaselineRun(entry);
    try {
      setWorkspaceItem("contextforge-baseline", JSON.stringify(entry));
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function clearBaseline() {
    setBaselineRun(null);
    try {
      removeWorkspaceItem("contextforge-baseline");
    } catch {
      // Local persistence is best-effort only.
    }
  }

  function persistHistory(entry: HistoryEntry) {
    const next = [entry, ...history.filter((item) => item.id !== entry.id)].slice(0, 8);
    setHistory(next);
    try {
      setWorkspaceItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
  }

  async function compile() {
    if (bundleExecutionGuardMode === "block" && bundleExecutionGuard.status === "BLOCK") {
      setBundleExecutionGuardNotice(
        "Compile blocked by Bundle Execution Guard. Resolve the blocking checks or switch the guard to Warn only.",
      );
      recordBundleExecutionGuardAudit("BLOCK");
      return;
    }
    if (bundleExecutionGuardMode === "warn" && bundleExecutionGuard.status !== "PASS") {
      recordBundleExecutionGuardAudit("WARN");
    }
    setBundleExecutionGuardNotice(null);

    setError("");
    setResult(null);
    setResultTab("output");

    if (!task.trim()) {
      setError("Tell ContextForge what the AI should do with the content.");
      return;
    }
    if (inputMode === "file" && !file) {
      setError("Drop or choose a PDF, DOCX, or TXT file.");
      return;
    }
    if (inputMode === "text" && !text.trim()) {
      setError("Paste source text first.");
      return;
    }

    try {
      setLoading(true);
      let response: Response;

      if (inputMode === "text") {
        response = await fetch("/api/optimize-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, task: task.trim(), mode, token_budget: budget }),
        });
      } else {
        const body = new FormData();
        body.append("file", file!);
        body.append("task", task.trim());
        body.append("mode", mode);
        body.append("token_budget", String(budget));
        response = await fetch("/api/optimize-file", { method: "POST", body });
      }

      const raw = await response.text();
      if (!response.ok) {
        let message = raw;
        try {
          const parsed = JSON.parse(raw);
          message = parsed.detail ?? parsed.error ?? raw;
        } catch {}
        throw new Error(message);
      }

      const parsed: Result = JSON.parse(raw);
      setResult(parsed);
      setOnline(true);
      persistHistory({
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        sourceLabel,
        task: task.trim(),
        mode,
        budget,
        result: parsed,
      });
      setToast("Context compiled");
    } catch (err) {
      setOnline(false);
      setError(err instanceof Error ? err.message : "Compilation failed.");
    } finally {
      setLoading(false);
    }
  }

  function restoreHistory(entry: HistoryEntry) {
    setTask(entry.task);
    setMode(entry.mode);
    setBudget(entry.budget);
    setResult(entry.result);
    setOutputTarget("raw");
    setResultTab("output");
    setHistoryOpen(false);
    setToast("Previous compilation restored");
  }

async function copyOutput() {
  if (!formattedOutput) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(formattedOutput);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = formattedOutput;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (!copied) {
        throw new Error("Clipboard copy is unavailable.");
      }
    }

    setToast(`Copied ${outputTarget === "raw" ? "context" : outputTarget} format`);
  } catch {
    setError("Could not copy to clipboard. Please copy the output manually.");
  }
}

  function exportOutput(ext: "txt" | "md") {
    if (!formattedOutput) return;
    const header = ext === "md"
      ? `# ContextForge Output\n\n**Task:** ${task}\n\n**Output target:** ${outputTarget}\n\n`
      : `ContextForge Output\nTask: ${task}\nOutput target: ${outputTarget}\n\n`;
    const blob = new Blob([header + formattedOutput], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contextforge-${outputTarget}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportManifestJson() {
    if (!explainabilityManifest) {
      setToast("No explainability manifest available");
      return;
    }

    const payload = JSON.stringify(explainabilityManifest, null, 2);
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeBase = (result?.filename ?? "contextforge")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "contextforge";

    a.href = url;
    a.download = `${safeBase}-manifest.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast("Manifest exported");
  }

  function resetWorkbench() {
    setFile(null);
    setText("");
    setTask("");
    setResult(null);
    setError("");
    setBudget(1000);
    setMode("balanced");
    setResultTab("output");
    setOutputTarget("raw");
  }

  useEffect(() => {
    try {
      const seen = getWorkspaceItem("contextforge-beta-onboarding-v1");
      queueMicrotask(() => setContextforgeBetaOnboardingVisible(seen !== "dismissed"));
    } catch {
      queueMicrotask(() => setContextforgeBetaOnboardingVisible(true));
    } finally {
      queueMicrotask(() => setContextforgeBetaReady(true));
    }
  }, []);

  function dismissContextforgeBetaOnboarding() {
    try {
      setWorkspaceItem("contextforge-beta-onboarding-v1", "dismissed");
    } catch {
      // Browser storage is optional; dismissal still applies for this session.
    }
    setContextforgeBetaOnboardingVisible(false);
  }

  function loadContextforgeSecurityExample() {
    setText(
      "JWT access tokens expire after 15 minutes.\n" +
        "Refresh tokens expire after 7 days.\n" +
        "MFA is required for administrative accounts.\n" +
        "The marketing dashboard refreshes every 45 minutes.\n" +
        "Database exports cannot be stored on personal devices.\n" +
        "Every production deployment must have a documented rollback procedure.",
    );
    setTask(
      "Extract all mandatory authentication, security, database, and deployment requirements. Preserve exact numeric limits and exclude unrelated operational details.",
    );
    setMode("balanced");
    setBudget(500);
    setFile(null);
    setResult(null);
    setError("");
    setResultTab("output");
    dismissContextforgeBetaOnboarding();
  }

  function startContextforgeBlank() {
    setFile(null);
    setText("");
    setTask("");
    setResult(null);
    setError("");
    dismissContextforgeBetaOnboarding();
  }

  return (
    <main
      className="cf-app-shell min-h-screen bg-[#f2f3f5] text-[#1d1d1f]"
      data-contextforge-root="true"
      data-contextforge-experience-mode={contextforgeExperienceMode}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--cf-x", `${event.clientX - rect.left}px`);
        event.currentTarget.style.setProperty("--cf-y", `${event.clientY - rect.top}px`);
      }}
    >
      {/* ContextForge Standard desktop workspace — canonical */}
      <style jsx global>{`
        :root {
          color-scheme: light;
        }


        .cf-app-shell {
          --cf-x: 50vw;
          --cf-y: 18vh;
          background-image:
            radial-gradient(560px circle at var(--cf-x) var(--cf-y), rgba(10,132,255,.10), transparent 42%),
            radial-gradient(780px circle at 86% 14%, rgba(94,92,230,.07), transparent 48%),
            linear-gradient(180deg, #f7f9fc 0%, #f2f3f5 38%, #eef2f7 100%);
          background-attachment: fixed;
        }

        .cf-premium-card {
          position: relative;
          overflow: hidden;
          transform: translateZ(0);
          transition: transform 220ms cubic-bezier(.2,.8,.2,1), box-shadow 220ms ease, border-color 220ms ease;
          will-change: transform;
        }

        .cf-premium-card::after {
          content: "";
          position: absolute;
          inset: -45% -70%;
          pointer-events: none;
          background: linear-gradient(115deg, transparent 42%, rgba(255,255,255,.10) 47%, rgba(255,255,255,.78) 50%, rgba(255,255,255,.12) 53%, transparent 58%);
          transform: translate3d(-42%,0,0) rotate(7deg);
          opacity: 0;
          transition: transform 900ms cubic-bezier(.18,.78,.16,1), opacity 180ms ease;
        }

        .cf-premium-card:hover {
          transform: translateY(-3px) scale(1.006);
          border-color: rgba(10,132,255,.22);
          box-shadow: 0 22px 54px rgba(15,23,42,.10), 0 4px 14px rgba(10,132,255,.08), inset 0 1px 0 rgba(255,255,255,.92);
        }

        .cf-premium-card:hover::after {
          transform: translate3d(44%,0,0) rotate(7deg);
          opacity: .72;
        }

        .cf-premium-card > * {
          position: relative;
          z-index: 1;
        }

        .cf-glass-panel {
          backdrop-filter: blur(18px) saturate(135%);
          -webkit-backdrop-filter: blur(18px) saturate(135%);
        }

        .cf-interactive-button {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          transition: transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 220ms ease, filter 220ms ease;
        }

        .cf-interactive-button::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background: linear-gradient(110deg, transparent 22%, rgba(255,255,255,.46) 48%, transparent 72%);
          transform: translateX(-145%);
          transition: transform 620ms cubic-bezier(.2,.75,.2,1);
        }

        .cf-interactive-button:hover {
          transform: translateY(-2px);
          filter: saturate(1.08);
          box-shadow: 0 12px 30px rgba(10,132,255,.22), 0 2px 8px rgba(15,23,42,.10);
        }

        .cf-interactive-button:hover::before {
          transform: translateX(145%);
        }

        .cf-interactive-button:active {
          transform: translateY(0) scale(.985);
        }

        .cf-tab-motion {
          transition: transform 160ms ease, color 180ms ease, border-color 180ms ease;
        }

        .cf-tab-motion:hover {
          transform: translateY(-1px);
        }

        .cf-status-pulse {
          position: relative;
        }

        .cf-status-pulse::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          border: 1px solid rgba(52,211,153,.55);
          animation: cf-status-ring 1.9s ease-out infinite;
        }

        @keyframes cf-status-ring {
          0% { transform: scale(.75); opacity: .8; }
          80%, 100% { transform: scale(1.9); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .cf-premium-card,
          .cf-interactive-button,
          .cf-tab-motion {
            transition: none !important;
          }

          .cf-premium-card::after,
          .cf-interactive-button::before,
          .cf-status-pulse::after {
            animation: none !important;
            transition: none !important;
          }
        }


        .cf-app-shell {
          position: relative;
          isolation: isolate;
          overflow-x: clip;
        }

        .cf-app-shell::before,
        .cf-app-shell::after {
          content: "";
          position: fixed;
          z-index: -1;
          width: 42rem;
          height: 42rem;
          border-radius: 999px;
          filter: blur(92px);
          pointer-events: none;
          opacity: .42;
          mix-blend-mode: screen;
        }

        .cf-app-shell::before {
          left: -12rem;
          top: 4rem;
          background: radial-gradient(circle, rgba(10,132,255,.32) 0%, rgba(90,120,255,.13) 42%, transparent 72%);
          animation: cf-aurora-a 13s ease-in-out infinite alternate;
        }

        .cf-app-shell::after {
          right: -14rem;
          top: 17rem;
          background: radial-gradient(circle, rgba(94,92,230,.28) 0%, rgba(50,173,230,.11) 46%, transparent 74%);
          animation: cf-aurora-b 16s ease-in-out infinite alternate;
        }

        @keyframes cf-aurora-a {
          0% { transform: translate3d(0,0,0) scale(1); }
          50% { transform: translate3d(7rem,4rem,0) scale(1.14); }
          100% { transform: translate3d(2rem,10rem,0) scale(.96); }
        }

        @keyframes cf-aurora-b {
          0% { transform: translate3d(0,0,0) scale(.95); }
          50% { transform: translate3d(-8rem,5rem,0) scale(1.12); }
          100% { transform: translate3d(-3rem,-2rem,0) scale(1); }
        }

        .cf-premium-card {
          box-shadow:
            0 1px 0 rgba(255,255,255,.9) inset,
            0 10px 30px rgba(15,23,42,.045);
        }

        .cf-premium-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(
            125deg,
            rgba(255,255,255,.95),
            rgba(10,132,255,.22),
            rgba(94,92,230,.18),
            rgba(255,255,255,.72)
          );
          background-size: 240% 240%;
          -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: .72;
          animation: cf-border-flow 7s linear infinite;
        }

        @keyframes cf-border-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .cf-premium-card:hover {
          transform: translateY(-5px) scale(1.012);
          box-shadow:
            0 30px 70px rgba(15,23,42,.13),
            0 10px 28px rgba(10,132,255,.12),
            inset 0 1px 0 rgba(255,255,255,.96);
        }

        .cf-interactive-button:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow:
            0 18px 42px rgba(10,132,255,.24),
            0 5px 16px rgba(15,23,42,.10);
        }

        .cf-interactive-button:active {
          transform: translateY(0) scale(.975);
        }

        .cf-result-reveal {
          animation: cf-result-pop 520ms cubic-bezier(.2,.8,.2,1) both;
        }

        @keyframes cf-result-pop {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(.985);
            filter: blur(5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        .cf-stagger-card {
          animation: cf-stagger-in 520ms cubic-bezier(.2,.8,.2,1) both;
        }

        .cf-stagger-card:nth-child(1) { animation-delay: 40ms; }
        .cf-stagger-card:nth-child(2) { animation-delay: 90ms; }
        .cf-stagger-card:nth-child(3) { animation-delay: 140ms; }
        .cf-stagger-card:nth-child(4) { animation-delay: 190ms; }
        .cf-stagger-card:nth-child(5) { animation-delay: 240ms; }
        .cf-stagger-card:nth-child(6) { animation-delay: 290ms; }

        @keyframes cf-stagger-in {
          0% { opacity: 0; transform: translateY(14px) scale(.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        .cf-workflow-live {
          animation: cf-workflow-glow 2.4s ease-in-out infinite;
        }

        @keyframes cf-workflow-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(10,132,255,0); }
          50% { box-shadow: 0 0 0 7px rgba(10,132,255,.08); }
        }

        @media (prefers-reduced-motion: reduce) {
          .cf-app-shell::before,
          .cf-app-shell::after,
          .cf-premium-card::before,
          .cf-result-reveal,
          .cf-stagger-card,
          .cf-workflow-live {
            animation: none !important;
          }
        }


        /* === ContextForge high-visibility premium surface pass === */
        .cf-app-shell {
          background:
            radial-gradient(900px circle at 18% 8%, rgba(10,132,255,.18), transparent 48%),
            radial-gradient(820px circle at 82% 16%, rgba(94,92,230,.16), transparent 46%),
            linear-gradient(180deg, #eef5ff 0%, #f7f9fc 34%, #eef2f8 100%) !important;
        }

        .cf-glass-panel {
          background:
            linear-gradient(155deg, rgba(255,255,255,.94), rgba(244,248,255,.86)) !important;
          border-color: rgba(10,132,255,.16) !important;
          box-shadow:
            0 1px 0 rgba(255,255,255,.96) inset,
            0 24px 60px rgba(15,23,42,.08),
            0 8px 24px rgba(10,132,255,.07) !important;
        }

        .cf-premium-card {
          background:
            linear-gradient(160deg, rgba(255,255,255,.96), rgba(246,249,255,.90)) !important;
          border-color: rgba(10,132,255,.15) !important;
          box-shadow:
            0 1px 0 rgba(255,255,255,.98) inset,
            0 16px 42px rgba(15,23,42,.07),
            0 5px 16px rgba(10,132,255,.06) !important;
        }

        .cf-premium-card::before {
          opacity: .95 !important;
          background:
            linear-gradient(
              125deg,
              rgba(255,255,255,1),
              rgba(10,132,255,.44),
              rgba(94,92,230,.35),
              rgba(50,173,230,.30),
              rgba(255,255,255,.96)
            ) !important;
          background-size: 300% 300% !important;
        }

        .cf-premium-card::after {
          opacity: .16;
        }

        .cf-premium-card:hover {
          transform: translateY(-7px) scale(1.018) !important;
          border-color: rgba(10,132,255,.36) !important;
          box-shadow:
            0 34px 78px rgba(15,23,42,.14),
            0 12px 34px rgba(10,132,255,.18),
            inset 0 1px 0 rgba(255,255,255,1) !important;
        }

        .cf-premium-card:hover::after {
          opacity: .95 !important;
        }

        .cf-interactive-button {
          border-color: rgba(10,132,255,.20) !important;
          background:
            linear-gradient(145deg, rgba(255,255,255,.96), rgba(239,246,255,.94)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.98),
            0 8px 22px rgba(15,23,42,.08) !important;
        }

        .cf-interactive-button:hover {
          border-color: rgba(10,132,255,.40) !important;
          transform: translateY(-3px) scale(1.025) !important;
          box-shadow:
            0 18px 44px rgba(10,132,255,.24),
            0 6px 18px rgba(15,23,42,.10) !important;
        }

        .cf-tab-motion {
          position: relative;
        }

        .cf-tab-motion::after {
          content: "";
          position: absolute;
          left: 18%;
          right: 18%;
          bottom: -2px;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, #0a84ff, #5e5ce6, #32ade6);
          opacity: 0;
          transform: scaleX(.35);
          transition: opacity 180ms ease, transform 220ms ease;
        }

        .cf-tab-motion:hover::after {
          opacity: .65;
          transform: scaleX(1);
        }

        .cf-result-reveal {
          position: relative;
        }

        .cf-result-reveal::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: 28px;
          pointer-events: none;
          background: linear-gradient(
            120deg,
            rgba(10,132,255,.20),
            rgba(94,92,230,.14),
            rgba(50,173,230,.16)
          );
          filter: blur(20px);
          opacity: .20;
          z-index: -1;
        }

        .cf-stagger-card {
          border-left: 3px solid rgba(10,132,255,.18) !important;
        }

        .cf-stagger-card:hover {
          border-left-color: rgba(10,132,255,.70) !important;
        }

        .cf-status-pulse {
          box-shadow: 0 0 0 4px rgba(52,211,153,.08), 0 0 18px rgba(52,211,153,.35);
        }

        @keyframes cf-border-flow-strong {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }


        .cf-app-shell,
        .cf-app-shell * { box-sizing: border-box; }

        .cf-app-shell { overflow-x: hidden; }

        .cf-app-shell img,
        .cf-app-shell svg,
        .cf-app-shell video,
        .cf-app-shell canvas { max-width: 100%; }

        @media (max-width: 767px) {
          html, body { overflow-x: hidden !important; }

          .cf-app-shell {
            --cf-x: 50vw !important;
            --cf-y: 12vh !important;
            width: 100%;
            min-width: 0 !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
            background:
              radial-gradient(520px circle at 20% 4%, rgba(10,132,255,.14), transparent 50%),
              radial-gradient(520px circle at 90% 22%, rgba(94,92,230,.10), transparent 48%),
              linear-gradient(180deg, #f4f8ff 0%, #f7f9fc 42%, #eef2f7 100%) !important;
          }

          .cf-app-shell::before,
          .cf-app-shell::after {
            width: 22rem !important;
            height: 22rem !important;
            filter: blur(72px) !important;
            opacity: .22 !important;
          }

          .cf-app-shell * { min-width: 0 !important; }

          .cf-app-shell [class*="max-w-"] { max-width: 100% !important; }
          .cf-app-shell [class*="w-["] { max-width: 100% !important; }

          .cf-app-shell .grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .cf-app-shell .sticky {
            position: static !important;
            top: auto !important;
          }

          .cf-app-shell textarea,
          .cf-app-shell input,
          .cf-app-shell select,
          .cf-app-shell button {
            max-width: 100%;
          }

          .cf-app-shell textarea,
          .cf-app-shell input,
          .cf-app-shell select {
            font-size: 16px !important;
          }

          .cf-app-shell h1 {
            font-size: clamp(2rem, 10vw, 3rem) !important;
            line-height: .96 !important;
            letter-spacing: -.045em !important;
          }

          .cf-app-shell h2 {
            font-size: clamp(1.25rem, 6vw, 1.65rem) !important;
          }

          .cf-app-shell .cf-premium-card {
            transform: none !important;
            border-radius: 20px !important;
            box-shadow:
              0 1px 0 rgba(255,255,255,.96) inset,
              0 12px 32px rgba(15,23,42,.07) !important;
          }

          .cf-app-shell .cf-premium-card::after { display: none !important; }

          .cf-app-shell .cf-interactive-button:hover,
          .cf-app-shell .cf-premium-card:hover {
            transform: none !important;
          }

          .cf-app-shell .cf-tab-motion {
            min-height: 44px;
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          .cf-app-shell button,
          .cf-app-shell [role="button"] {
            min-height: 44px;
          }

          .cf-app-shell .cf-scrollbar { max-height: none !important; }
        }

        @media (hover: none), (pointer: coarse) {
          .cf-premium-card:hover,
          .cf-interactive-button:hover,
          .cf-tab-motion:hover {
            transform: none !important;
          }

          .cf-premium-card::after,
          .cf-interactive-button::before {
            display: none !important;
          }
        }

        @media (max-width: 767px) {
          .cf-app-shell .cf-glass {
            border-radius: 22px !important;
          }

          .cf-app-shell .cf-enter {
            animation-duration: 360ms !important;
          }

          .cf-app-shell .cf-premium-card {
            border-radius: 18px !important;
          }

          .cf-app-shell .cf-tab-motion {
            flex: 1 1 auto;
            justify-content: center;
            padding-left: 8px !important;
            padding-right: 8px !important;
            font-size: 12px !important;
          }
        }


        @media (max-width: 480px) {
          .cf-app-shell {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          .cf-mobile-header {
            width: 100% !important;
            min-width: 0 !important;
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 10px !important;
            padding: 10px 12px !important;
          }

          .cf-mobile-header > * {
            min-width: 0 !important;
            max-width: 100% !important;
          }

          .cf-mobile-header [class*="justify-between"],
          .cf-mobile-header [class*="justify-end"] {
            justify-content: flex-start !important;
          }

          .cf-mobile-header [class*="ml-auto"] {
            margin-left: 0 !important;
          }

          .cf-mobile-hero {
            border-radius: 24px !important;
          }

          .cf-mobile-hero > .grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .cf-mobile-hero h2 {
            font-size: clamp(1.9rem, 11vw, 2.5rem) !important;
            line-height: .98 !important;
          }

          .cf-mobile-feature-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .cf-mobile-feature-grid > * {
            width: 100% !important;
          }

          .cf-app-shell section,
          .cf-app-shell aside,
          .cf-app-shell article,
          .cf-app-shell form {
            max-width: 100% !important;
          }

          .cf-app-shell button {
            white-space: normal !important;
          }

          .cf-app-shell .grid-cols-3,
          .cf-app-shell .grid-cols-4,
          .cf-app-shell .grid-cols-5 {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }


        @media (max-width: 480px) {
          .cf-mobile-stepper .grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }

          .cf-mobile-stepper .grid > div {
            padding: 8px 4px !important;
            border-radius: 14px !important;
          }

          .cf-mobile-stepper .grid > div > div {
            width: 24px !important;
            height: 24px !important;
          }

          .cf-mobile-stepper .grid > div p {
            margin-top: 6px !important;
            font-size: 10px !important;
            line-height: 1.15 !important;
          }

          .cf-source-panel-head {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }

          .cf-source-panel-head > * {
            width: 100% !important;
            min-width: 0 !important;
          }

          .cf-source-mode-toggle {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            width: 100% !important;
            max-width: none !important;
          }

          .cf-source-mode-toggle button {
            width: 100% !important;
            min-width: 0 !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }
        }


        @media (max-width: 240px) {
          .cf-app-shell {
            padding-left: 6px !important;
            padding-right: 6px !important;
          }

          .cf-mobile-stepper .cf-glass {
            padding: 6px !important;
          }

          .cf-mobile-stepper .grid {
            gap: 4px !important;
          }

          .cf-mobile-stepper .grid > div {
            padding: 6px 2px !important;
            border-radius: 12px !important;
          }

          .cf-source-panel-head {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            align-items: stretch !important;
            gap: 10px !important;
          }

          .cf-source-panel-head > * {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
          }

          .cf-source-mode-toggle {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            width: 100% !important;
          }

          .cf-source-mode-toggle button {
            width: 100% !important;
            min-width: 0 !important;
            padding: 8px 4px !important;
            font-size: 11px !important;
          }

          .cf-source-panel-head + * {
            min-width: 0 !important;
          }

          .cf-app-shell textarea {
            padding: 12px !important;
            font-size: 14px !important;
            line-height: 1.45 !important;
          }
        }


        @media (max-width: 480px) {
          .cf-app-shell button.group {
            align-items: flex-start !important;
            gap: 10px !important;
            padding: 14px !important;
          }

          .cf-app-shell button.group > div:first-child {
            min-width: 0 !important;
            flex: 1 1 auto !important;
          }

          .cf-app-shell button.group > div:last-child {
            flex: 0 0 auto !important;
            margin-top: 2px !important;
          }
        }

        @keyframes cf-rise {
          from { opacity: 0; transform: translateY(16px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes cf-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -5px, 0); }
        }

        @keyframes cf-orbit {
          0% { transform: translate3d(-2%, -1%, 0) scale(1); }
          50% { transform: translate3d(4%, 3%, 0) scale(1.08); }
          100% { transform: translate3d(-2%, -1%, 0) scale(1); }
        }

        @keyframes cf-shimmer {
          from { transform: translateX(-130%) skewX(-18deg); }
          to { transform: translateX(260%) skewX(-18deg); }
        }

        @keyframes cf-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(10,132,255,.18); }
          50% { box-shadow: 0 0 0 8px rgba(10,132,255,0); }
        }

        .cf-enter {
          animation: cf-rise .55s cubic-bezier(.16,1,.3,1) both;
        }

        .cf-float {
          animation: cf-float 5s ease-in-out infinite;
        }

        .cf-orbit {
          animation: cf-orbit 14s ease-in-out infinite;
        }

        .cf-glass {
          position: relative;
          background:
            linear-gradient(180deg, rgba(255,255,255,.64), rgba(245,247,250,.44));
          border: 1px solid rgba(255,255,255,.92);
          box-shadow:
            0 18px 46px rgba(34,48,73,.12),
            0 0 0 1px rgba(65,83,110,.08),
            inset 0 1px 0 rgba(255,255,255,.94),
            inset 0 -1px 0 rgba(76,94,118,.08);
          backdrop-filter: blur(28px) saturate(165%);
          -webkit-backdrop-filter: blur(28px) saturate(165%);
        }

        .cf-glass::before,
        .cf-glass-strong::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background:
            linear-gradient(145deg, rgba(255,255,255,.72), transparent 21%, transparent 72%, rgba(33,51,78,.08));
          opacity: .58;
        }

        .cf-glass-strong {
          position: relative;
          background:
            linear-gradient(180deg, rgba(255,255,255,.76), rgba(244,247,251,.54));
          border: 1px solid rgba(255,255,255,.88);
          box-shadow:
            0 22px 56px rgba(34,48,73,.12),
            0 0 0 1px rgba(65,83,110,.09),
            inset 0 1px 0 rgba(255,255,255,.98),
            inset 0 -1px 0 rgba(76,94,118,.09);
          backdrop-filter: blur(34px) saturate(175%);
          -webkit-backdrop-filter: blur(34px) saturate(175%);
        }

        .cf-glass-dark {
          position: relative;
          background:
            linear-gradient(180deg, rgba(28,32,39,.82), rgba(20,24,31,.70));
          border: 1px solid rgba(255,255,255,.13);
          box-shadow:
            0 22px 58px rgba(20,28,42,.24),
            inset 0 1px 0 rgba(255,255,255,.12);
          backdrop-filter: blur(30px) saturate(160%);
          -webkit-backdrop-filter: blur(30px) saturate(160%);
        }

        .cf-surface {
          background:
            linear-gradient(180deg, rgba(255,255,255,.88), rgba(249,250,252,.80));
          border: 0;
          box-shadow:
            0 22px 60px rgba(40,56,82,.10),
            0 2px 10px rgba(40,56,82,.05),
            inset 0 1px 0 rgba(255,255,255,.96);
        }

        .cf-surface-soft {
          background: rgba(255,255,255,.58);
          border: 0;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.88),
            0 8px 22px rgba(35,49,72,.05);
        }

        .cf-liquid-btn {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          transform: translateZ(0);
          border: 1px solid rgba(255,255,255,.58);
          box-shadow:
            0 14px 30px rgba(10,132,255,.24),
            0 2px 8px rgba(10,132,255,.15),
            inset 0 1px 0 rgba(255,255,255,.46);
          transition:
            transform .24s cubic-bezier(.2,.8,.2,1),
            box-shadow .24s ease,
            filter .24s ease;
        }

        .cf-liquid-btn:hover {
          transform: translateY(-2px) scale(1.012);
          filter: saturate(1.08) brightness(1.03);
          box-shadow:
            0 20px 42px rgba(10,132,255,.30),
            0 4px 12px rgba(10,132,255,.16),
            inset 0 1px 0 rgba(255,255,255,.52);
        }

        .cf-liquid-btn:active {
          transform: translateY(0) scale(.982);
        }

        .cf-liquid-btn::before {
          content: "";
          position: absolute;
          left: 12%;
          right: 12%;
          top: 1px;
          height: 44%;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,255,255,.46), rgba(255,255,255,0));
          opacity: .72;
          pointer-events: none;
        }

        .cf-liquid-btn::after {
          content: "";
          position: absolute;
          inset: -36% auto -36% -34%;
          width: 30%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.92), transparent);
          opacity: 0;
          pointer-events: none;
        }

        .cf-liquid-btn:hover {
          transform: translateY(-2px) scale(1.01);
        }

        .cf-liquid-btn:hover::after {
          opacity: .8;
          animation: cf-shimmer .8s cubic-bezier(.16,1,.3,1);
        }

        .cf-liquid-btn:active {
          transform: translateY(0) scale(.985);
        }

        .cf-segment {
          transition:
            transform .22s cubic-bezier(.16,1,.3,1),
            background .22s ease,
            color .22s ease,
            box-shadow .22s ease;
        }

        .cf-segment:active {
          transform: scale(.96);
        }

        button, label[for], input[type="range"] { cursor: pointer; }
        button:focus-visible, input:focus-visible, textarea:focus-visible {
          outline: 3px solid rgba(10,132,255,.20);
          outline-offset: 2px;
        }

        .cf-shell button,
        .cf-shell input,
        .cf-shell textarea {
          font-size: 15px;
        }

        .cf-shell textarea {
          line-height: 1.6;
        }

        .cf-shell button {
          letter-spacing: -0.01em;
          font-weight: 600;
        }

        ::selection {
          background: rgba(10,132,255,.18);
        }

        @media (prefers-reduced-motion: reduce) {
          .cf-enter,
          .cf-float,
          .cf-orbit,
          .cf-liquid-btn::after {
            animation: none !important;
          }
          .cf-liquid-btn,
          .cf-segment,
          button {
            transition-duration: .01ms !important;
          }
        }

        .cf-scrollbar::-webkit-scrollbar { width: 8px; }
        .cf-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .cf-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100,116,139,.26);
          border-radius: 999px;
        }

        .cf-range {
          accent-color: #0a84ff;
        }

        /* Standard workspace balance */
        @media (min-width: 1280px) {
          [data-contextforge-inspector="true"] {
            scroll-margin-top: 7rem;
          }
        }

        [data-contextforge-compile-cta="true"] {
          text-wrap: nowrap;
        }

        /* Standard desktop density */
        [data-contextforge-experience="true"] > div:last-child {
          flex: 0 0 auto;
          align-self: flex-start;
        }

        @media (min-width: 1024px) {
          [data-contextforge-experience="true"] > div:last-child {
            align-self: center;
          }

          [data-contextforge-beta-onboarding][data-contextforge-onboarding-density="compact"] h2 {
            margin-top: 0.65rem !important;
          }

          [data-contextforge-beta-onboarding][data-contextforge-onboarding-density="compact"] p {
            margin-top: 0.5rem !important;
          }

          [data-contextforge-beta-onboarding][data-contextforge-onboarding-density="compact"] .mt-5 {
            margin-top: 0.85rem !important;
          }
        }

        /* Standard real two-column workspace */
        @media (min-width: 1024px) {
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] {
            display: grid !important;
            grid-template-columns:
              minmax(0, 0.92fr)
              minmax(0, 1.08fr) !important;
            gap: clamp(20px, 2vw, 30px) !important;
            align-items: start !important;
          }

          /* Remove both navigation rails from the Standard desktop canvas. */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(1),
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(2) {
            display: none !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(3) {
            grid-column: 1 !important;
            min-width: 0 !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(4) {
            grid-column: 2 !important;
            min-width: 0 !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] {
            position: sticky !important;
            top: 6rem !important;
            align-self: start !important;
            z-index: 5;
          }
        }


        /* Standard workspace finishing pass */
        @media (min-width: 1024px) {

          /*
           * Keep the Inspector as a viewport-sized working surface.
           * Large compiled results scroll inside the Inspector instead of
           * making the right column disappear while the workflow continues.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] {
            position: sticky !important;
            top: 6rem !important;
            align-self: start !important;
            height: calc(100vh - 7.5rem) !important;
            max-height: calc(100vh - 7.5rem) !important;
            overflow: hidden !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] > div {
            min-height: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow-y: auto !important;
            overscroll-behavior: contain;
          }

          /*
           * The Compile footer previously shared horizontal space with
           * explanatory copy, which crushed the primary CTA.
           * Force that action group into one clean vertical stack.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"]
          :has(> [data-contextforge-compile-cta="true"]) {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            align-items: stretch !important;
            gap: 12px !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-compile-cta="true"] {
            display: inline-flex !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            min-height: 58px !important;
            justify-content: center !important;
            align-items: center !important;
            white-space: nowrap !important;
            grid-column: 1 / -1 !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"]
          :has(> [data-contextforge-compile-cta="true"]) > * {
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
          }

          /*
           * Standard explanatory copy belongs below the primary action,
           * not beside it.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"]
          :has(> [data-contextforge-compile-cta="true"]) p {
            grid-column: 1 / -1 !important;
            margin: 0 !important;
            line-height: 1.6 !important;
          }
        }


        /* Standard inspector sticky carrier */
        @media (min-width: 1024px) {

          /*
           * The inspector section must span the height of the workflow.
           * Its inner card performs the actual sticky behavior.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] {
            position: relative !important;
            top: auto !important;
            height: auto !important;
            max-height: none !important;
            min-height: 100% !important;
            align-self: stretch !important;
            overflow: visible !important;
            z-index: 5;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] > div {
            position: sticky !important;
            top: 6rem !important;

            height: calc(100vh - 7.5rem) !important;
            max-height: calc(100vh - 7.5rem) !important;
            min-height: 560px !important;

            overflow-y: auto !important;
            overscroll-behavior: contain;
          }
        }


        /* Standard inspector full-row span */
        @media (min-width: 1024px) {

          /*
           * Standard desktop has one grid row containing the controls and
           * inspector. Stretch that row so the inspector carrier remains
           * available for the full height of Source -> Objective -> Compression.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] {
            align-items: stretch !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(3) {
            align-self: start !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(4) {
            align-self: stretch !important;
            height: 100% !important;
            min-height: 100% !important;
            overflow: visible !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] {
            position: relative !important;
            top: auto !important;
            height: 100% !important;
            max-height: none !important;
            min-height: 100% !important;
            overflow: visible !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] > div {
            position: sticky !important;
            top: 6rem !important;
            height: calc(100vh - 7.5rem) !important;
            min-height: 560px !important;
            max-height: calc(100vh - 7.5rem) !important;
            overflow-y: auto !important;
            overscroll-behavior: contain;
          }
        }


        /* Standard definitive row-span workspace */
        @media (min-width: 1024px) {

          /*
           * Standard desktop becomes a true two-column / three-row workspace.
           * The left workflow provides the row heights.
           * Context Inspector spans the entire workflow vertically.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] {
            display: grid !important;
            grid-template-columns:
              minmax(0, 0.92fr)
              minmax(0, 1.08fr) !important;
            grid-template-rows: auto auto auto !important;
            column-gap: clamp(20px, 2vw, 30px) !important;
            row-gap: 16px !important;
            align-items: stretch !important;
          }

          /* Hide mobile and legacy desktop workflow navigation. */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(1),
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(2) {
            display: none !important;
          }

          /*
           * Promote Source / Objective / Compression out of their old wrapper
           * so each becomes a real grid row.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-controls="true"] {
            display: contents !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-controls="true"] > :nth-child(1) {
            grid-column: 1 !important;
            grid-row: 1 !important;
            min-width: 0 !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-controls="true"] > :nth-child(2) {
            grid-column: 1 !important;
            grid-row: 2 !important;
            min-width: 0 !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-controls="true"] > :nth-child(3) {
            grid-column: 1 !important;
            grid-row: 3 !important;
            min-width: 0 !important;
          }

          /*
           * Inspector owns the entire right side from Source through Compile.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] {
            grid-column: 2 !important;
            grid-row: 1 / 4 !important;

            position: relative !important;
            top: auto !important;

            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            max-height: none !important;

            align-self: stretch !important;
            overflow: visible !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] > div {
            position: sticky !important;
            top: 5.5rem !important;

            width: 100% !important;
            height: min(76vh, 720px) !important;
            min-height: 560px !important;
            max-height: 720px !important;

            overflow-y: auto !important;
            overscroll-behavior: contain;
          }
        }


        /* Standard inspector natural grid stretch */
        @media (min-width: 1024px) {

          /*
           * Important: do not give the spanning grid item height:100%.
           * Its grid area is composed of auto-sized rows, so natural stretch
           * is the reliable way to make it span Source -> Objective -> Compile.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] {
            grid-column: 2 !important;
            grid-row: 1 / 4 !important;

            position: relative !important;
            top: auto !important;

            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;

            align-self: stretch !important;
            justify-self: stretch !important;

            overflow: visible !important;
          }

          /*
           * Only the visual Inspector surface is sticky.
           * Its carrier continues through the complete workflow.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] > div {
            position: sticky !important;
            top: 5.5rem !important;

            width: 100% !important;
            height: min(68vh, 620px) !important;
            min-height: 480px !important;
            max-height: 620px !important;

            overflow-y: auto !important;
            overscroll-behavior: contain;
          }
        }


        /* Standard full-height inspector final */
        @media (min-width: 1024px) {

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] {
            align-items: stretch !important;
          }

          /*
           * Inspector permanently owns the full right column.
           * No sticky positioning. No viewport-height tricks.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] {
            grid-column: 2 !important;
            grid-row: 1 / 4 !important;

            position: static !important;
            top: auto !important;

            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            max-height: none !important;

            align-self: stretch !important;
            justify-self: stretch !important;

            overflow: visible !important;
          }

          /*
           * The visible Inspector card stretches with the complete workflow.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] > div {
            position: static !important;
            top: auto !important;

            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            max-height: none !important;

            overflow: hidden !important;
          }
        }


        /* Standard inspector final viewport surface */
        @media (min-width: 1024px) {

          /*
           * Outer Inspector already spans Source -> Objective -> Compression.
           * Keep only its visible surface in the viewport.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] > div {
            position: sticky !important;
            top: 5rem !important;

            width: 100% !important;
            height: calc(100vh - 6.5rem) !important;
            min-height: 520px !important;
            max-height: calc(100vh - 6.5rem) !important;

            overflow-y: auto !important;
            overscroll-behavior: contain;
          }
        }


        /* Standard final desktop composition */
        @media (min-width: 1024px) {

          /*
           * Final Standard structure:
           *
           * Source      | Inspector
           * Objective   | Inspector
           * ------------------------
           * Compression + Compile
           *
           * No sticky behavior and no artificial empty right column.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] {
            display: grid !important;
            grid-template-columns:
              minmax(0, 0.92fr)
              minmax(0, 1.08fr) !important;
            grid-template-rows: auto auto auto !important;
            column-gap: clamp(20px, 2vw, 30px) !important;
            row-gap: 16px !important;
            align-items: start !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(1),
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-workspace="true"] > :nth-child(2) {
            display: none !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-controls="true"] {
            display: contents !important;
          }

          /* Source */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-controls="true"] > :nth-child(1) {
            grid-column: 1 !important;
            grid-row: 1 !important;
            min-width: 0 !important;
          }

          /* Objective */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-controls="true"] > :nth-child(2) {
            grid-column: 1 !important;
            grid-row: 2 !important;
            min-width: 0 !important;
          }

          /* Compression becomes the deliberate full-width final step. */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-standard-controls="true"] > :nth-child(3) {
            grid-column: 1 / 3 !important;
            grid-row: 3 !important;

            width: 100% !important;
            min-width: 0 !important;

            margin-top: 4px !important;
          }

          /* Inspector occupies only the upper working area. */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] {
            grid-column: 2 !important;
            grid-row: 1 / 3 !important;

            position: static !important;
            top: auto !important;

            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            max-height: none !important;

            align-self: stretch !important;
            overflow: visible !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] > div {
            position: static !important;
            top: auto !important;

            width: 100% !important;
            height: 100% !important;
            min-height: 620px !important;
            max-height: none !important;

            overflow: hidden !important;
          }

          /* Keep the final action hierarchy strong. */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-compile-cta="true"] {
            width: 100% !important;
            min-height: 58px !important;
            justify-content: center !important;
            white-space: nowrap !important;
          }
        }


        /* Standard inspector page-scroll ownership */
        @media (min-width: 1024px) {

          /*
           * Standard mode uses normal document scrolling.
           * The Context Inspector must never trap the mouse wheel.
           */
          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] {
            overflow: visible !important;
            overscroll-behavior: auto !important;
            touch-action: auto !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] > div {
            position: static !important;
            top: auto !important;

            height: auto !important;
            min-height: 620px !important;
            max-height: none !important;

            overflow: visible !important;
            overflow-y: visible !important;

            overscroll-behavior: auto !important;
            overscroll-behavior-y: auto !important;
            touch-action: auto !important;
          }

          main[data-contextforge-experience-mode="standard"]
          [data-contextforge-inspector="true"] [role="tabpanel"] {
            overflow: visible !important;
            max-height: none !important;
            overscroll-behavior: auto !important;
          }
        }

      `}</style>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#f5f7fb_0%,#eef2f7_45%,#f5f5f6_100%)]" />
        <div className="cf-orbit absolute -left-[11rem] -top-[12rem] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(79,126,255,.24),rgba(79,126,255,0)_68%)] blur-3xl" />
        <div className="cf-orbit absolute -right-[8rem] top-[1rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(76,201,240,.18),rgba(76,201,240,0)_70%)] blur-3xl [animation-delay:-5s]" />
        <div className="absolute bottom-[-14rem] left-[31%] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(154,118,255,.14),rgba(154,118,255,0)_72%)] blur-3xl" />
        <div className="absolute bottom-[-9rem] right-[8%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(255,173,96,.11),rgba(255,173,96,0)_74%)] blur-3xl" />
      </div>
      <div className="relative mx-auto w-[min(94vw,1480px)] px-4 py-5 sm:px-5 lg:px-6">
        <header className="cf-mobile-header cf-glass-strong sticky top-4 z-30 mb-5 flex items-center justify-between rounded-[32px] px-5 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[14px] border border-white/80 bg-gradient-to-br from-white/90 via-[#dfe9ff]/85 to-[#d7f7ff]/80 shadow-[0_8px_22px_rgba(37,99,235,.15)]">
              <Sparkles className="h-5 w-5 text-[#0a84ff]" />
            </div>
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h1 className="text-lg font-semibold tracking-[-0.02em] text-slate-950">ContextForge</h1>
                <span className="rounded-full border border-blue-200/80 bg-blue-50/80 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-[#0a84ff]">2.1</span>
              </div>
              <p className="text-[13px] text-slate-500">local AI context compiler</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryOpen((value) => !value)}
              className="cf-liquid-btn hidden items-center gap-2 rounded-full border border-slate-200/80 bg-white/78 px-4 py-2.5 text-[13px] font-semibold text-slate-800 shadow-[0_6px_18px_rgba(15,23,42,.10)] hover:bg-white hover:shadow-[0_9px_24px_rgba(15,23,42,.14)] sm:inline-flex"
            >
              <History className="h-3.5 w-3.5" />
              History
              {history.length > 0 && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{history.length}</span>}
            </button>
            <StatusPill online={online} version={engineVersion} />
          </div>
        </header>

      {contextforgeBetaReady && contextforgeBetaOnboardingVisible ? (
        <section data-contextforge-beta-onboarding data-contextforge-onboarding-density="compact" className="mx-auto mb-4 w-full max-w-[1440px] overflow-hidden rounded-[28px] border border-blue-100/80 bg-gradient-to-br from-white via-blue-50/60 to-violet-50/60 p-4 shadow-[0_22px_70px_rgba(15,23,42,0.09)] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 shadow-sm">
                Public beta readiness
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Compile context in three steps. Verify what survived.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Add source material, tell ContextForge what matters, then inspect the compiled evidence before sending it to a model. Standard mode keeps the workflow simple; Advanced exposes the full governance and audit console.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/90 bg-white/75 p-4 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">01 · Source</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">Paste or upload evidence</div>
                </div>
                <div className="rounded-2xl border border-white/90 bg-white/75 p-4 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600">02 · Objective</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">Define what must survive</div>
                </div>
                <div className="rounded-2xl border border-white/90 bg-white/75 p-4 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">03 · Verify</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">Inspect evidence and output</div>
                </div>
              </div>
            </div>

            <div className="flex min-w-[250px] flex-col gap-2">
              <button type="button" onClick={loadContextforgeSecurityExample} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.25)]">
                Try the security example
              </button>
              <button type="button" onClick={startContextforgeBlank} className="rounded-2xl border border-slate-200 bg-white/85 px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white">
                Start with my own content
              </button>
              <button type="button" onClick={dismissContextforgeBetaOnboarding} className="px-3 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-800">
                Dismiss onboarding
              </button>
            </div>
          </div>
        </section>
      ) : null}


      <section data-contextforge-experience="true" className="mx-auto mb-5 flex w-full max-w-[1440px] flex-col gap-4 rounded-[24px] border border-white/70 bg-white/78 p-4 shadow-[0_16px_48px_rgba(15,23,42,0.07)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Experience</div>
          <div className="mt-1 text-sm text-slate-600">Standard keeps ContextForge focused. Advanced reveals the full engineering console. Beta builds prioritize transparent evidence review before model handoff.</div>
        </div>
        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100/90 p-1 shadow-inner">
          <button type="button" onClick={() => setContextforgeExperienceMode("standard")} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${contextforgeExperienceMode === "standard" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Standard</button>
          <button type="button" onClick={() => setContextforgeExperienceMode("advanced")} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${contextforgeExperienceMode === "advanced" ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Advanced</button>
        </div>
      </section>

      {!contextforgeAdvancedMode && result ? (
        <section className="mx-auto mb-6 w-full max-w-[1440px] overflow-hidden rounded-[30px] border border-emerald-100/80 bg-gradient-to-br from-white via-emerald-50/40 to-cyan-50/50 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Trust summary</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Context preserved. Evidence ready for review.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Standard mode keeps the core compile workflow and result visible while hiding professional governance, regression, audit, policy, and operational tooling. Switch to Advanced whenever you need full controls and diagnostics. The underlying compile result does not change.</p>
            </div>
            <button type="button" onClick={() => setContextforgeExperienceMode("advanced")} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">Inspect advanced evidence</button>
          </div>
        </section>
      ) : null}


        {historyOpen && (
          <div className="absolute right-6 top-[74px] z-40 w-[min(420px,calc(100vw-48px))] overflow-hidden rounded-2xl border border-white/10 bg-[#10131a] shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[17px] font-semibold">Recent compilations</p>
                <p className="text-[13px] text-slate-500">Stored only in this browser.</p>
              </div>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    setHistory([]);
                    removeWorkspaceItem(HISTORY_KEY);
                  }}
                  className="text-[13px] text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-[430px] overflow-y-auto p-2">
              {history.length === 0 ? (
                <div className="p-8 text-center text-[17px] text-slate-500">No local history yet.</div>
              ) : history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => restoreHistory(entry)}
                  className="group w-full rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-slate-800">{entry.sourceLabel}</p>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-500">{entry.task}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-slate-700" />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                    <span>{entry.result.reduction_percent}% saved</span>
                    <span>{entry.result.retrieval_confidence ?? 0}% confidence</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <section className="cf-mobile-hero cf-enter mb-6 overflow-hidden rounded-[38px] bg-[linear-gradient(135deg,rgba(255,255,255,.92),rgba(246,249,255,.80))] shadow-[0_28px_80px_rgba(48,67,98,.12)] ring-1 ring-white/80">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative p-5 sm:p-7 lg:p-9">
              <div className="pointer-events-none absolute -left-10 -top-16 h-64 w-64 rounded-full bg-[#0a84ff]/12 blur-3xl" />
              <div className="relative">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-[#fafbfc]/94 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#0a84ff] shadow-sm backdrop-blur-xl">
                  <WandSparkles className="h-3.5 w-3.5" />
                  Context intelligence workspace
                </div>
                <h2 className="max-w-4xl text-[38px] font-semibold leading-[0.98] tracking-[-0.055em] text-[#111318] sm:text-[52px] lg:text-[64px]">
                  Distill the signal.
                  <span className="block bg-gradient-to-r from-[#0a84ff] via-[#5e5ce6] to-[#32ade6] bg-clip-text text-transparent">
                    Keep the evidence.
                  </span>
                </h2>
                <p className="mt-3 max-w-2xl text-[14px] leading-5 text-slate-500 sm:mt-4 sm:text-base sm:leading-6">
                  ContextForge ranks, compresses, and traces the source material your task actually needs — before it reaches a model.
                </p>
              </div>
            </div>

            <div className="relative border-t border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,.72),rgba(248,250,253,.52))] p-3 sm:p-4 lg:border-l lg:border-t-0 lg:p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(10,132,255,.15),transparent_45%)]" />
              <div className="cf-mobile-feature-grid relative grid h-full grid-cols-3 content-center gap-2 sm:gap-3 lg:grid-cols-1">
                <FeatureStat icon={<Layers3 className="h-4 w-4" />} value="Hierarchical" label="section → sentence retrieval" />
                <FeatureStat icon={<ShieldCheck className="h-4 w-4" />} value="Local-first" label="no paid model required" />
                <FeatureStat icon={<Gauge className="h-4 w-4" />} value="Budget-aware" label="hard token ceiling" />
              </div>
            </div>
          </div>
        </section>

        <section
          data-contextforge-standard-workspace="true"
          className="grid gap-5 xl:grid-cols-[170px_minmax(390px,0.86fr)_minmax(560px,1.34fr)]"
        >
          <div className="cf-mobile-stepper xl:hidden">
            <div className="cf-glass rounded-[22px] p-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    number: "01",
                    label: "Source",
                    ready: inputMode === "file" ? Boolean(file) : Boolean(text.trim()),
                  },
                  {
                    number: "02",
                    label: "Task",
                    ready: Boolean(task.trim()),
                  },
                  {
                    number: "03",
                    label: "Compile",
                    ready: Boolean(result),
                  },
                ].map((step) => (
                  <div
                    key={step.number}
                    className={`rounded-2xl border px-3 py-3 text-center transition ${
                      step.ready
                        ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
                        : "border-slate-200/80 bg-white/72 text-slate-500"
                    }`}
                  >
                    <div className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[10px] font-semibold shadow-sm">
                      {step.ready ? <Check className="h-3.5 w-3.5" /> : step.number}
                    </div>
                    <p className="mt-2 text-[11px] font-semibold">{step.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="cf-enter hidden xl:sticky xl:top-28 xl:block xl:self-start">
            <div className="cf-glass rounded-[32px] p-3">
              <div className="px-3 pb-3 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow</p>
              </div>

              <RailStep
                number="01"
                label="Source"
                detail={inputMode === "file" ? (file ? file.name : "Add a document") : (text.trim() ? `${text.length.toLocaleString()} chars` : "Paste source text")}
                ready={inputMode === "file" ? Boolean(file) : Boolean(text.trim())}
              />
              <RailConnector ready={inputMode === "file" ? Boolean(file) : Boolean(text.trim())} />
              <RailStep
                number="02"
                label="Task"
                detail={task.trim() ? "Objective defined" : "Define what matters"}
                ready={Boolean(task.trim())}
              />
              <RailConnector ready={Boolean(task.trim())} />
              <RailStep
                number="03"
                label="Compile"
                detail={`${modeInfo[mode].label} · ${budget.toLocaleString()} tokens`}
                ready={Boolean(result)}
                active={Boolean(task.trim()) && (inputMode === "file" ? Boolean(file) : Boolean(text.trim())) && !result}
              />

              <div className="mt-3 border-t border-slate-200/70 px-3 pt-4">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Engine</span>
                  <span className={online ? "text-emerald-300" : "text-rose-300"}>
                    {online ? "Ready" : "Offline"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      result ? "w-full bg-emerald-400" :
                      task.trim() && (inputMode === "file" ? file : text.trim()) ? "w-2/3 bg-indigo-400" :
                      (inputMode === "file" ? file : text.trim()) ? "w-1/3 bg-indigo-400" :
                      "w-[8%] bg-slate-600"
                    }`}
                  />
                </div>
              </div>
            </div>
          </aside>

          <div
            data-contextforge-standard-controls="true"
            className="cf-enter space-y-4 [animation-delay:60ms]"
          >
            <Panel className="overflow-hidden p-0 md:p-0">
              <div className="border-b border-slate-200/75 px-6 py-5">
                <div className="cf-source-panel-head flex items-start justify-between gap-4">
                <SectionTitle number="01" title="Source material" subtitle="Paste or upload the evidence ContextForge should compile. Start with the security example if you want a guided first run." />
                  <div className="cf-source-mode-toggle flex rounded-[14px] border border-slate-200/80 bg-slate-100/80 p-1 shadow-inner">
                    <Tab active={inputMode === "file"} onClick={() => setInputMode("file")}>Upload</Tab>
                    <Tab active={inputMode === "text"} onClick={() => setInputMode("text")}>Paste</Tab>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {inputMode === "file" ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={`group relative overflow-hidden rounded-[26px] border border-dashed px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.85)] transition duration-300 ${
                      dragging
                        ? "border-[#0a84ff]/50 bg-[#0a84ff]/8"
                        : "border-slate-200/80 bg-[#f7f8fa]/92 hover:border-[#0a84ff]/35 hover:bg-[#0a84ff]/[0.04]"
                    }`}
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                      <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a84ff]/10 blur-3xl" />
                    </div>
                    {!file ? (
                      <div className="relative">
                        <div className="cf-float mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-indigo-300/15 bg-[#0a84ff]/10">
                          <UploadCloud className="h-6 w-6 text-[#0a84ff]" />
                        </div>
                        <p className="mt-4 text-[17px] font-semibold text-slate-950">Drop PDF, DOCX, or TXT</p>
                        <p className="mt-1.5 text-[13px] text-slate-500">Up to 25 MB · processed locally</p>
                        <label className="cf-liquid-btn mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#0a84ff]/20 bg-[#0a84ff] px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(10,132,255,.28)] hover:bg-[#0077ed] hover:shadow-[0_14px_30px_rgba(10,132,255,.34)]">
                          Choose file
                          <input className="hidden" type="file" accept=".pdf,.docx,.txt" onChange={(e) => acceptFile(e.target.files?.[0] ?? null)} />
                        </label>
                      </div>
                    ) : (
                      <div className="relative flex items-center justify-between gap-4 text-left">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-indigo-300/20 bg-[#0a84ff]/10">
                            <FileText className="h-5 w-5 text-[#0a84ff]" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[17px] font-semibold text-slate-950">{file.name}</p>
                            <p className="mt-1 text-[13px] text-slate-500">{fileSize} · ready to compile</p>
                          </div>
                        </div>
                        <button onClick={() => setFile(null)} className="rounded-xl border border-slate-200/70 px-3 py-2 text-[13px] text-slate-500 transition hover:border-slate-500 hover:bg-slate-200 hover:text-white">
                          Replace
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Paste documentation, policies, research text, logs, notes, or a long prompt..."
                      className="min-h-44 w-full resize-y sm:min-h-56 rounded-[22px] border border-slate-200/65 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] p-5 text-[17px] leading-7 text-slate-800 outline-none transition placeholder:text-slate-500 focus:border-indigo-300/50 focus:ring-4 focus:ring-indigo-500/10"
                    />
                    <div className="mt-2 flex justify-between text-[13px] text-slate-500">
                      <span>Plain text source</span>
                      <span>{text.length.toLocaleString()} characters</span>
                    </div>
                  </div>
                )}
              </div>
            </Panel>

            <Panel>
              <SectionTitle number="02" title="Retrieval objective" subtitle="Describe exactly what information deserves to survive compression." />

              <div className="mt-5 flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setTask(preset.task)}
                    className="rounded-full border border-slate-200/70 bg-slate-200/45 px-3.5 py-2 text-[13px] text-slate-500 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300/35 hover:bg-[#0a84ff]/10 hover:text-[#0a84ff] active:translate-y-0"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>

              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Example: Extract authentication rules, expiry limits, MFA requirements, and account lockout behavior."
                className="mt-4 min-h-28 w-full resize-y sm:min-h-32 rounded-[22px] border border-slate-200/65 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] p-5 text-[17px] leading-7 text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-indigo-300/50 focus:ring-4 focus:ring-indigo-500/10"
              />
            </Panel>

            <Panel>
              <SectionTitle number="03" title="Compression strategy" subtitle="Control how much supporting context ContextForge keeps." />

              <div className="mt-5 grid gap-3">
                {Object.entries(modeInfo).map(([key, info]) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={`group flex items-center justify-between gap-4 rounded-2xl border p-4 text-left transition duration-300 ${
                      mode === key
                        ? "bg-[linear-gradient(135deg,rgba(10,132,255,.15),rgba(94,92,230,.08))] ring-1 ring-[#0a84ff]/22 shadow-[0_14px_30px_rgba(10,132,255,.11)]"
                        : "bg-slate-100/72 ring-1 ring-slate-200/70 hover:bg-white hover:shadow-[0_10px_24px_rgba(47,62,89,.07)]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[17px] font-semibold ${mode === key ? "text-[#0a84ff]" : "text-slate-800"}`}>{info.label}</span>
                        <span className="text-[9px] uppercase tracking-[0.10em] text-slate-500 sm:text-[10px] sm:tracking-[0.12em]">{info.badge}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-slate-500">{info.description}</p>
                    </div>
                    <div className={`grid h-8 w-8 place-items-center rounded-full border transition ${mode === key ? "border-indigo-300/30 bg-[#0a84ff]/10 text-[#0a84ff]" : "border-slate-300/70 text-slate-700 group-hover:text-slate-500"}`}>
                      {mode === key ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200/70 bg-[#f7f8fa]/92 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700">Token ceiling</p>
                    <p className="mt-1 text-[13px] text-slate-500">Maximum size of the compiled context.</p>
                  </div>
                  <input
                    type="number"
                    min={20}
                    max={100000}
                    value={budget}
                    onChange={(e) => setBudget(Math.max(20, Number(e.target.value) || 20))}
                    className="w-28 rounded-[14px] border border-slate-200/70 bg-white px-3 py-2.5 text-right text-[17px] font-semibold text-slate-950 shadow-inner outline-none focus:border-indigo-400/50"
                  />
                </div>
                <input
                  type="range"
                  min={100}
                  max={8000}
                  step={100}
                  value={Math.min(8000, Math.max(100, budget))}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="cf-range mt-5 w-full"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {[500, 1000, 2000, 4000].map((value) => (
                    <button
                      key={value}
                      onClick={() => setBudget(value)}
                      className={`rounded-lg border px-3 py-1.5 text-[13px] transition ${
                        budget === value
                          ? "border-indigo-300/35 bg-[#0a84ff]/10 text-[#0a84ff]"
                          : "border-slate-200/80 text-slate-500 hover:border-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {value.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[17px] text-red-300">{error}</div>
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
                <button
                  onClick={compile}
                  disabled={loading}
                  data-contextforge-compile-cta="true"
                  className={`cf-liquid-btn group flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#0077ed]/30 bg-gradient-to-b from-[#1797ff] to-[#0077ed] px-7 py-3.5 text-[17px] font-semibold text-white shadow-[0_14px_30px_rgba(10,132,255,.30),inset_0_1px_0_rgba(255,255,255,.45)] ring-1 ring-white/40 hover:shadow-[0_18px_36px_rgba(10,132,255,.38)] disabled:cursor-not-allowed disabled:opacity-50 ${
                    !contextforgeAdvancedMode ? "w-full whitespace-nowrap" : ""
                  }`}
                >
                  {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {loading ? loadingStages[loadingStage] : "Compile context"}
                  {!loading && <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />}
                </button>
        {!contextforgeAdvancedMode ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">Standard mode keeps the core workflow simple. Switch to Advanced for evidence lineage, quality gates, policy bundles, execution audits, and operational intelligence.</p>
        ) : null}

                <button
                  onClick={resetWorkbench}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white/52 px-4 text-[13px] text-slate-500 transition duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-200 hover:text-slate-800 active:translate-y-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </div>

              {loading && (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {loadingStages.map((stage, index) => (
                    <div key={stage} className="min-w-0">
                      <div className={`h-1.5 rounded-full transition-all ${index <= loadingStage ? "bg-indigo-400" : "bg-slate-200"}`} />
                      <p className={`mt-1.5 truncate text-[9px] ${index === loadingStage ? "text-indigo-300" : "text-slate-500"}`}>{stage}</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <section
            data-contextforge-inspector="true"
            className={`cf-enter [animation-delay:100ms] ${
              !contextforgeAdvancedMode
                ? "lg:sticky lg:top-24 lg:self-start"
                : ""
            }`}
          >
            <div className="min-h-[520px] overflow-hidden rounded-[26px] sm:min-h-[700px] sm:rounded-[30px] xl:min-h-[900px] xl:rounded-[34px] border border-white/75 bg-white/72 shadow-[0_28px_90px_rgba(55,65,81,.10)] backdrop-blur-[26px]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/70 bg-white/38 px-4 py-4 backdrop-blur-xl sm:gap-4 sm:px-7 sm:py-5">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#0a84ff] shadow-[0_0_16px_rgba(10,132,255,.42)]" />
                    <p className="text-base font-semibold text-slate-950">Context inspector</p>
                  </div>
                  <p className="mt-1.5 text-[13px] text-slate-500">Compiled output, evidence lineage, and retrieval diagnostics.</p>
                </div>

                {result ? (
                  <div className="flex flex-wrap gap-2">
                    <ActionButton onClick={copyOutput} icon={<Copy className="h-3.5 w-3.5" />}>Copy</ActionButton>
                    <ActionButton onClick={() => exportOutput("md")} icon={<Download className="h-3.5 w-3.5" />}>.md</ActionButton>
                    <ActionButton onClick={() => exportOutput("txt")} icon={<Download className="h-3.5 w-3.5" />}>.txt</ActionButton>
                    <ActionButton onClick={exportManifestJson} icon={<Download className="h-3.5 w-3.5" />}>Manifest</ActionButton>
                  </div>
                ) : (
                  <div className="rounded-full border border-white/80 bg-white/62 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 shadow-sm">
                    Awaiting compile
                  </div>
                )}
              </div>

              {!result ? (
                <InspectorEmpty />
              ) : (
                <div className="p-4 sm:p-6">
                  {!contextforgeAdvancedMode ? (() => {
                    const trustDecision = resolveStandardTrustDecision(result);

                    return (
                    <section
                      data-contextforge-standard-trust-summary="true"
                      className="mb-5 overflow-hidden rounded-[24px] border border-blue-100/80 bg-gradient-to-br from-white via-blue-50/55 to-violet-50/55 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
                    >
                      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-blue-200/80 bg-white/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">
                              Trust summary
                            </span>

                            <span
                              data-contextforge-trust-state="true"
                              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                                trustDecision.state === "verified"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : trustDecision.state === "limited"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {trustDecision.label}
                            </span>
                          </div>

                          <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">
                            {trustDecision.state === "verified"
                              ? "Evidence checks verified"
                              : trustDecision.state === "limited"
                                ? "Compiled context ready with limited verification"
                                : "Compiled context needs review"}
                          </h3>

                          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-600">
                            {trustDecision.state === "verified"
                              ? "ContextForge verified the available evidence-quality checks for this compilation. Review the evidence trail before model handoff."
                              : trustDecision.state === "limited"
                                ? `${trustDecision.unknown} evidence-quality check${trustDecision.unknown === 1 ? "" : "s"} could not be verified from the current manifest. No available check failed.`
                                : `${trustDecision.review} evidence-quality check${trustDecision.review === 1 ? "" : "s"} requires attention before model handoff.`}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={copyOutput}
                          className="cf-liquid-btn inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-blue-200/80 bg-white/90 px-5 text-[13px] font-semibold text-slate-900 shadow-[0_10px_26px_rgba(15,23,42,0.10)] transition hover:-translate-y-0.5 hover:bg-white"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy compiled context
                        </button>
                      </div>

                      <div
                        data-contextforge-standard-trust-checks="true"
                        className="border-t border-white/80 bg-white/70 px-5 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            Evidence integrity
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {trustDecision.passed} passed · {trustDecision.review} review
                            {trustDecision.unknown > 0
                              ? ` · ${trustDecision.unknown} unavailable`
                              : ""}
                          </p>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          {trustDecision.checks.map((check) => (
                            <div
                              key={check.id}
                              title={check.detail}
                              className={`rounded-2xl border px-3 py-3 ${
                                check.status === "pass"
                                  ? "border-emerald-100 bg-emerald-50/70"
                                  : check.status === "review"
                                    ? "border-amber-200 bg-amber-50/80"
                                    : "border-slate-200 bg-white/80"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    check.status === "pass"
                                      ? "bg-emerald-500"
                                      : check.status === "review"
                                        ? "bg-amber-500"
                                        : "bg-slate-300"
                                  }`}
                                />
                                <span className="text-[11px] font-semibold text-slate-800">
                                  {check.label}
                                </span>
                              </div>

                              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
                                {check.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid border-t border-white/80 bg-white/55 sm:grid-cols-3">
                        <div className="p-4 sm:p-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            Retrieval confidence
                          </p>
                          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                            {result.retrieval_confidence ?? 0}%
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Signal selected for the requested task.
                          </p>
                        </div>

                        <div className="border-t border-white/80 p-4 sm:border-l sm:border-t-0 sm:p-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            Context reduction
                          </p>
                          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                            {result.reduction_percent}%
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {result.tokens_saved.toLocaleString()} tokens removed.
                          </p>
                        </div>

                        <div className="border-t border-white/80 p-4 sm:border-l sm:border-t-0 sm:p-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            Packed handoff
                          </p>
                          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                            {result.optimized_tokens.toLocaleString()}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Total model-ready package, including task framing.
                          </p>
                        </div>
                      </div>
                    </section>
                    );
                  })() : null}

                  {!contextforgeAdvancedMode ? (
                    <div
                      data-contextforge-standard-token-semantics="true"
                      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
                    >
                      <Metric
                        label="Source evidence"
                        value={result.original_tokens.toLocaleString()}
                        unit="tokens"
                      />

                      <Metric
                        label="Retained evidence"
                        value={Math.max(
                          0,
                          result.original_tokens - result.tokens_saved
                        ).toLocaleString()}
                        unit="tokens"
                      />

                      <Metric
                        label="Saved"
                        value={result.tokens_saved.toLocaleString()}
                        unit="tokens"
                        positive
                      />

                      <Metric
                        label="Reduction"
                        value={`${result.reduction_percent}%`}
                        positive
                      />

                      <Metric
                        label="Packed handoff"
                        value={result.optimized_tokens.toLocaleString()}
                        unit="tokens"
                      />

                      <Metric
                        label="Confidence"
                        value={`${result.retrieval_confidence ?? 0}%`}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      <Metric
                        label="Source"
                        value={result.original_tokens.toLocaleString()}
                        unit="tokens"
                      />
                      <Metric
                        label="Final"
                        value={result.optimized_tokens.toLocaleString()}
                        unit="tokens"
                      />
                      <Metric
                        label="Saved"
                        value={result.tokens_saved.toLocaleString()}
                        unit="tokens"
                        positive
                      />
                      <Metric
                        label="Reduction"
                        value={`${result.reduction_percent}%`}
                        positive
                      />
                      <Metric
                        label="Confidence"
                        value={`${result.retrieval_confidence ?? 0}%`}
                      />
                    </div>
                  )}

                  <div className={contextforgeAdvancedMode ? "contents" : "hidden"} data-contextforge-advanced="evidence-quality-dashboard">
<EvidenceQualityDashboard
                    manifest={readExplainabilityManifest(result)}
                    retrievalConfidence={result.retrieval_confidence ?? 0}
                  />
</div>

                  <div className={contextforgeAdvancedMode ? "contents" : "hidden"} data-contextforge-advanced="baseline-controls">
<BaselineControls
                    baseline={baselineRun}
                    current={result}
                    onSave={saveCurrentAsBaseline}
                    onClear={clearBaseline}
                  />
</div>

                  <div className={contextforgeAdvancedMode ? "contents" : "hidden"} data-contextforge-advanced="execution-guard-operational-dashboard">
<ExecutionGuardOperationalDashboard entries={bundleExecutionGuardAudit} />
</div>
<div className={contextforgeAdvancedMode ? "contents" : "hidden"} data-contextforge-advanced="bundle-execution-guard">
<BundleExecutionGuardAuditTrail
                    entries={bundleExecutionGuardAudit}
                    onClear={clearBundleExecutionGuardAudit}
                    onDeleteSelected={(ids) => {
    const selectedIds = new Set(ids);
    setBundleExecutionGuardAudit((current) => {
      const next = current.filter((entry) => !selectedIds.has(entry.id));
      setWorkspaceItem(
        "contextforge-bundle-execution-guard-audit",
        JSON.stringify(next),
      );
      return next;
    });
  }}
/>
</div>

                  <div className={contextforgeAdvancedMode ? "contents" : "hidden"} data-contextforge-advanced="compile-policy-bundles">
<CompilePolicyBundles
                    bundles={compilePolicyBundles}
                    currentMode={String(mode)}
                    currentBudget={budget}
                    currentTask={task}
                    currentPolicy={qualityGatePolicy}
                    onSave={saveCompilePolicyBundle}
                    onApply={applyCompilePolicyBundle}
                    onDelete={deleteCompilePolicyBundle}
                    onImport={importCompilePolicyBundles}
                    bundleRevisions={compilePolicyBundleRevisions}
                    onRestoreRevision={restoreCompilePolicyBundleRevision}
                    onDeleteRevision={deleteCompilePolicyBundleRevision}
                    bundleRestoreAuditEntries={compilePolicyBundleRestoreAudit}
                    onClearBundleRestoreAudit={clearCompilePolicyBundleRestoreAudit}
                  />
</div>

                  <div className={contextforgeAdvancedMode ? "contents" : "hidden"} data-contextforge-advanced="quality-gate-policy-controls">
<QualityGatePolicyControls
                    policy={qualityGatePolicy}
                    onChange={updateQualityGatePolicy}
                    onReset={resetQualityGatePolicy}
                    savedProfiles={savedQualityGateProfiles}
                    onApplySavedProfile={applySavedQualityGateProfile}
                    onSaveProfile={saveQualityGateProfile}
                    onDeleteProfile={deleteQualityGateProfile}
                    onImportProfiles={importQualityGateProfiles}
                    profileRevisions={qualityGateProfileRevisions}
                    onRestoreRevision={restoreQualityGateProfileRevision}
                    onDeleteRevision={deleteQualityGateProfileRevision}
                    restoreAuditEntries={qualityGateRestoreAudit}
                    onClearRestoreAudit={clearQualityGateRestoreAudit}
                  />
</div>

                  <div className={contextforgeAdvancedMode ? "contents" : "hidden"} data-contextforge-advanced="regression-quality-gate">
<RegressionQualityGate
                    current={result}
                    baseline={baselineRun}
                    policy={qualityGatePolicy}
                  />
</div>

                  <div className={contextforgeAdvancedMode ? "contents" : "hidden"} data-contextforge-advanced="compile-comparison">
<CompileComparison
                    current={result}
                    previous={comparisonEntry}
                    comparisonKind={comparisonKind}
                  />
</div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
                    <div className="cf-premium-card cf-glass-panel rounded-2xl border border-slate-200/70 bg-[#f7f8fa]/92 p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-[13px] font-semibold text-slate-700">Budget utilization</p>
                          <p className="mt-1 text-[13px] text-slate-500">{result.optimized_tokens.toLocaleString()} of {budget.toLocaleString()} tokens</p>
                        </div>
                        <span className="text-[17px] font-semibold text-[#0a84ff]">{budgetUsage}%</span>
                      </div>
                      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#0a84ff] via-[#5e5ce6] to-[#32ade6] transition-all duration-700" style={{ width: `${budgetUsage}%` }} />
                      </div>
                    </div>
                    <div className="cf-premium-card cf-glass-panel rounded-2xl border border-slate-200/70 bg-[#f7f8fa]/92 p-5">
                      <p className="text-[13px] font-semibold text-slate-700">Evidence selected</p>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-semibold text-white">{result.processing_stats?.sentences_selected ?? result.sources?.length ?? 0}</span>
                        <span className="text-[13px] text-slate-500"><span className="text-[20px] font-semibold text-slate-950">{readExplainabilityManifest(result)?.selected?.length ?? 0}</span>{" "}units</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/75">
                    <div className="flex gap-1">
                      <ResultTabButton active={resultTab === "output"} onClick={() => setResultTab("output")} icon={<FileText className="h-3.5 w-3.5" />}>Output</ResultTabButton>
                      <ResultTabButton active={resultTab === "sources"} onClick={() => setResultTab("sources")} icon={<FileSearch className="h-3.5 w-3.5" />}>Evidence <span className="text-[10px] text-slate-500">{result.sources?.length ?? 0}</span></ResultTabButton>
                      <ResultTabButton active={resultTab === "explain"} onClick={() => setResultTab("explain")} icon={<ListChecks className="h-3.5 w-3.5" />}>Explain <span className="text-[10px] text-slate-500">{explainabilityManifest?.summary?.selected_count ?? 0}</span></ResultTabButton>
                      <ResultTabButton active={resultTab === "diagnostics"} onClick={() => setResultTab("diagnostics")} icon={<BarChart3 className="h-3.5 w-3.5" />}>Diagnostics</ResultTabButton>
                    </div>
                  </div>

                  {resultTab === "output" && (
                    <div className="pt-5">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200/70 bg-[#f7f8fa]/92 p-1">
                          {(["raw", "chatgpt", "claude", "gemini"] as OutputTarget[]).map((target) => (
                            <button
                              key={target}
                              onClick={() => setOutputTarget(target)}
                              className={`rounded-full px-4 py-2.5 text-[13px] font-medium capitalize transition ${
                                outputTarget === target ? "bg-slate-100 text-slate-950 shadow-sm" : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                              }`}
                            >
                              {target === "raw" ? "Context only" : target}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-[13px] text-slate-500">
                          <span className="cf-status-pulse h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          AI-ready
                        </div>
                      </div>

                      <div className="cf-premium-card cf-glass-panel overflow-hidden rounded-[22px] border border-slate-200/65 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] shadow-inner shadow-black/20">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/75 px-5 py-4">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Compiled context</p>
                            <p className="mt-1 max-w-xl truncate text-[13px] text-slate-500">{result.filename ?? sourceLabel}</p>
                          </div>
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-emerald-300">{outputTarget}</span>
                        </div>
                        <div className="cf-scrollbar max-h-[640px] overflow-y-auto whitespace-pre-wrap p-6 font-mono text-[13.5px] leading-7 text-slate-700">{formattedOutput}</div>
                      </div>
                    </div>
                  )}

                  {resultTab === "sources" && (
                    <div className="pt-5">
                      <div className="mb-4">
                        <p className="text-[13px] font-semibold text-slate-700">Evidence lineage</p>
                        <p className="mt-1 text-[13px] text-slate-500">Every retained sentence with its page, section, and ranking signals.</p>
                      </div>
                      <div className="space-y-3">
                        {(result.sources ?? []).map((source, index) => (
                          <div key={`${source.sentence}-${index}`} className="cf-premium-card cf-glass-panel rounded-2xl border border-slate-200/70 bg-[#f7f8fa]/92 p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
                                <span>Evidence {String(index + 1).padStart(2, "0")}</span>
                                {source.page != null && <span className="rounded-md bg-slate-200/80 px-2 py-1">Page {source.page}</span>}
                                {source.section && <span className="rounded-md bg-slate-200/80 px-2 py-1">{source.section}</span>}
                              </div>
                              <div className="flex gap-3 text-[10px] text-slate-500">
                                <span>semantic {(source.semantic_score * 100).toFixed(0)}%</span>
                                <span>priority {(source.priority_score * 100).toFixed(0)}</span>
                              </div>
                            </div>
                            <p className="mt-3 text-[17px] leading-7 text-slate-800">{source.sentence}</p>
                          </div>
                        ))}
                        {(!result.sources || result.sources.length === 0) && (
                          <div className="rounded-2xl border border-slate-200/70 p-10 text-center text-[17px] text-slate-500">No source trace data returned.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {resultTab === "explain" && (
                    <div className="pt-5">
                      {explainabilityManifest ? (
                        <ExplainabilityPanel manifest={explainabilityManifest} />
                      ) : (
                        <div className="rounded-2xl border border-slate-200/70 bg-[#f7f8fa]/92 p-10 text-center">
                          <p className="text-[17px] font-semibold text-slate-800">Explainability data unavailable</p>
                          <p className="mt-2 text-[13px] text-slate-500">
                            Recompile with the current ContextForge API to receive evidence reasoning and constraint metadata.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {resultTab === "diagnostics" && (
                    <div className="pt-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <DiagnosticCard label="Chunks ranked" value={`${result.processing_stats?.chunks_selected ?? 0}/${result.processing_stats?.chunks_created ?? 0}`} detail="hierarchical pass" icon={<Layers3 className="h-4 w-4" />} />
                        <DiagnosticCard label="Candidates" value={`${result.processing_stats?.candidate_sentences ?? 0}`} detail="sentence ranking pool" icon={<Target className="h-4 w-4" />} />
                        <DiagnosticCard label="Duplicates removed" value={`${result.processing_stats?.duplicates_suppressed ?? 0}`} detail="near-duplicate filter" icon={<ListChecks className="h-4 w-4" />} />
                        <DiagnosticCard label="Latency" value={`${result.processing_stats?.elapsed_ms ?? 0} ms`} detail="local compile time" icon={<Clock3 className="h-4 w-4" />} />
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200/70 bg-[#f7f8fa]/92 p-5">
                        <p className="text-[13px] font-semibold text-slate-700">Retrieval details</p>
                        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 text-[13px] sm:grid-cols-3">
                          <Diagnostic label="Source sentences" value={`${result.processing_stats?.source_sentences ?? 0}`} />
                          <Diagnostic label="Selected sentences" value={`${result.processing_stats?.sentences_selected ?? 0}`} />
                          <Diagnostic label="Selected pages" value={`${result.processing_stats?.selected_pages ?? 0}`} />
                          <Diagnostic label="Selected sections" value={`${result.processing_stats?.selected_sections ?? 0}`} />
                          <Diagnostic label="Embedding cache" value={`${result.processing_stats?.embedding_cache_items ?? 0}`} />
                          <Diagnostic label="Headings detected" value={`${result.headings_detected ?? 0}`} />
                          <Diagnostic label="Threshold" value={`${result.threshold ?? "—"}`} />
                          <Diagnostic label="Output mode" value={`${result.output_mode ?? "—"}`} />
                          <Diagnostic label="Selected tokens" value={`${result.selected_context_tokens ?? result.optimized_tokens}`} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </section>

        <footer className="flex flex-col gap-2 py-5 text-[13px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>ContextForge 2.1 · local-first context compilation</p>
          <p>PDF · DOCX · TXT · Paste text · Browser-local history</p>
        </footer>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full cf-glass-strong px-4 py-2.5 text-[13px] font-medium text-slate-800">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {toast}
        </div>
      )}
    </main>
  );
}

function InspectorEmpty() {
  return (
    <div className="relative flex min-h-[810px] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[38%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a84ff]/8 blur-3xl" />
        <div className="absolute inset-x-12 top-28 h-px bg-gradient-to-r from-transparent via-slate-700/60 to-transparent" />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <div className="relative">
          <div className="cf-float grid h-20 w-20 place-items-center rounded-[32px] border border-white/80 bg-gradient-to-br from-white/80 via-[#e7f2ff]/76 to-[#e7fbff]/72 shadow-[0_20px_60px_-30px_rgba(99,102,241,.8)]">
            <Activity className="h-8 w-8 text-[#0a84ff]/80" />
          </div>
          <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#0a84ff] shadow-[0_0_18px_rgba(165,180,252,.9)]" />
        </div>

        <p className="mt-7 text-xl font-semibold tracking-tight text-slate-950">Your context inspector is empty</p>
        <p className="mx-auto mt-2 max-w-lg text-[17px] leading-7 text-slate-500">
          Add source material, define what matters, and compile. ContextForge will expose the compressed output, evidence trail, and retrieval diagnostics here.
        </p>

        <div className="mt-9 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          <EmptyFeature icon={<FileSearch className="h-4 w-4" />} title="Evidence-aware" text="Retain page, section, and sentence traceability." />
          <EmptyFeature icon={<Gauge className="h-4 w-4" />} title="Budget-controlled" text="Fit the selected signal to a deliberate token ceiling." />
          <EmptyFeature icon={<Clipboard className="h-4 w-4" />} title="Model-ready" text="Format the result for ChatGPT, Claude, Gemini, or raw use." />
        </div>

        <div className="mt-8 w-full max-w-3xl rounded-[24px] bg-[#eef2f7]/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.86)]">
          <div className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>Local pipeline</span>
            <span>4 stages</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {["Parse", "Retrieve", "Deduplicate", "Pack"].map((label, index) => (
              <div key={label} className="flex min-w-0 flex-1 items-center gap-2 rounded-[16px] bg-white/76 px-3 py-3 shadow-[0_8px_18px_rgba(50,64,90,.06)] ring-1 ring-white/80">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0a84ff]/10 text-[10px] font-bold text-[#0a84ff]">0{index + 1}</span>
                <span className="truncate text-[12px] font-semibold text-slate-700">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RailStep({
  number,
  label,
  detail,
  ready,
  active = false,
}: {
  number: string;
  label: string;
  detail: string;
  ready: boolean;
  active?: boolean;
}) {
  return (
    <div className={`rounded-[20px] px-3 py-3.5 transition duration-300 ${
      ready
        ? "bg-emerald-50/75 ring-1 ring-emerald-200/70"
        : active
          ? "bg-[#0a84ff]/8 ring-1 ring-[#0a84ff]/20"
          : "hover:bg-white/55"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-[15px] text-[11px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,.85)] ${
          ready
            ? "bg-emerald-500 text-white shadow-[0_6px_16px_rgba(16,185,129,.18)]"
            : active
              ? "bg-[#0a84ff] text-white shadow-[0_6px_16px_rgba(10,132,255,.22)]"
              : "bg-slate-100 text-slate-500"
        }`}>
          {ready ? <Check className="h-4 w-4" /> : number}
        </div>
        <div className="min-w-0">
          <p className={`text-[14px] font-semibold tracking-[-0.01em] ${ready ? "text-slate-900" : active ? "text-[#0a84ff]" : "text-slate-700"}`}>{label}</p>
          <p className="mt-0.5 truncate text-[11px] leading-4 text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function RailConnector({ ready }: { ready: boolean }) {
  return (
    <div className="ml-[31px] h-3 w-px bg-slate-200">
      <div className={`h-full w-px transition-colors duration-500 ${ready ? "bg-emerald-300" : "bg-transparent"}`} />
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[34px] bg-white/82 p-7 shadow-[0_24px_64px_rgba(52,67,92,.10)] ring-1 ring-slate-200/55 backdrop-blur-[24px] transition duration-300 hover:-translate-y-[1px] hover:shadow-[0_30px_74px_rgba(52,67,92,.12)] md:p-8 ${className}`}>{children}</div>;
}

function SectionTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-[#0a84ff]/10 text-[12px] font-bold text-[#0a84ff] shadow-[inset_0_1px_0_rgba(255,255,255,.85)]">{number}</span>
      <div>
        <p className="text-[18px] font-semibold tracking-[-0.025em] text-[#17191d]">{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function StatusPill({ online, version }: { online: boolean | null; version: string }) {
  const text = online === null ? "Checking" : online ? "Engine online" : "Engine offline";
  const dot = online === null ? "bg-amber-400" : online ? "bg-emerald-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/74 px-3.5 py-2 text-[12px] font-medium text-slate-600 shadow-[0_8px_22px_rgba(46,61,86,.07)] ring-1 ring-white/90 backdrop-blur-xl">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="hidden sm:inline">{text}</span>
      {online && <span className="text-[10px] text-slate-500">v{version}</span>}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[12px] px-4 py-2.5 text-[13px] font-semibold transition duration-200 ${
        active
          ? "bg-white text-slate-950 shadow-[0_5px_14px_rgba(44,58,82,.10),inset_0_1px_0_rgba(255,255,255,.95)]"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function FeatureStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="group flex min-w-[160px] items-center gap-4 rounded-[22px] bg-white/58 px-4 py-4 shadow-[0_10px_28px_rgba(47,62,89,.07)] ring-1 ring-white/80 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-white/78 hover:shadow-[0_16px_34px_rgba(47,62,89,.10)]">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[15px] bg-[linear-gradient(180deg,rgba(10,132,255,.15),rgba(10,132,255,.07))] text-[#0a84ff] shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
        {icon}
      </div>
      <div>
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">{value}</p>
        <p className="mt-0.5 text-[12px] leading-5 text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, unit, positive }: { label: string; value: string; unit?: string; positive?: boolean }) {
  return (
    <div className="cf-premium-card cf-glass-panel rounded-2xl border border-white/80 bg-[#fafbfc]/94 p-4 shadow-sm">
      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-2.5 text-xl font-semibold ${positive ? "text-emerald-300" : "text-slate-950"}`}>{value}</p>
      {unit && <p className="mt-0.5 text-[10px] text-zinc-800">{unit}</p>}
    </div>
  );
}

function ResultTabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`cf-tab-motion inline-flex items-center gap-2 border-b-2 px-4 py-3.5 text-[13px] font-medium ${active ? "border-indigo-400 text-[#0a84ff]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
      {icon}{children}
    </button>
  );
}

function DiagnosticCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <div className="cf-premium-card cf-glass-panel rounded-2xl border border-slate-200/70 bg-[#f7f8fa]/92 p-5">
      <div className="text-indigo-300/80">{icon}</div>
      <p className="mt-3 text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-[13px] font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 break-words font-medium text-slate-800">{value}</p>
    </div>
  );
}

function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 rounded-full bg-white/76 px-4 py-2.5 text-[12px] font-semibold text-slate-600 shadow-[0_6px_18px_rgba(45,60,84,.07)] ring-1 ring-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-[#0a84ff] hover:shadow-[0_10px_24px_rgba(45,60,84,.10)] active:translate-y-0">
      {icon}{children}
    </button>
  );
}

function EmptyFeature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="group rounded-[22px] bg-white/68 p-5 text-left shadow-[0_12px_32px_rgba(49,65,94,.07)] ring-1 ring-white/90 transition duration-300 hover:-translate-y-1 hover:bg-white/88 hover:shadow-[0_18px_38px_rgba(49,65,94,.10)]">
      <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#0a84ff]/10 text-[#0a84ff] transition group-hover:scale-105">
        {icon}
      </div>
      <p className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-slate-900">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-slate-500">{text}</p>
    </div>
  );
}









