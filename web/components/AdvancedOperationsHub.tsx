"use client";

import { clearGuardrailOverride, getGuardrailOverride, setGuardrailOverride, type GuardrailPolicyOverride } from "@/lib/contextforge-guardrail-override";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listConflictAudit,
  type ConflictAuditRecord,
} from "@/lib/contextforge-conflict-audit";
import {
  loadConflictAnalytics,
  type ConflictAnalyticsSnapshot,
} from "@/lib/contextforge-conflict-analytics";
import {
  loadConflictAnomalies,
  type ConflictAnomalySnapshot,
} from "@/lib/contextforge-conflict-anomaly";
import {
  loadGuardrailPolicyHistory,
  type GuardrailPolicyAuditRecord,
} from "@/lib/contextforge-guardrail-policy-audit";

type Tab = "health" | "anomalies" | "audit" | "policy";

function elementShowsAdvancedMode(): boolean {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button,[role="button"],[role="tab"]',
    ),
  );

  return candidates.some((element) => {
    const label = element.textContent?.trim().toLowerCase();
    if (label !== "advanced") return false;

    return (
      element.getAttribute("aria-pressed") === "true" ||
      element.getAttribute("aria-selected") === "true" ||
      element.dataset.state === "active" ||
      /\b(active|selected|current)\b/i.test(
        element.className || "",
      )
    );
  });
}

function storageShowsAdvancedMode(): boolean {
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !/(experience|mode)/i.test(key)) continue;

      const value = window.localStorage.getItem(key);
      if (value && /advanced/i.test(value)) return true;
    }
  } catch {
    return false;
  }

  return false;
}

function isAdvancedExperience(): boolean {
  return storageShowsAdvancedMode() || elementShowsAdvancedMode();
}

export default function AdvancedOperationsHub() {
  const [advanced, setAdvanced] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("health");
  const [analytics, setAnalytics] =
    useState<ConflictAnalyticsSnapshot | null>(null);
  const [anomaly, setAnomaly] =
    useState<ConflictAnomalySnapshot | null>(null);
  const [audit, setAudit] = useState<ConflictAuditRecord[]>([]);
  const [policy, setPolicy] =
    useState<GuardrailPolicyAuditRecord[]>([]);
  const [loading, setLoading] = useState(false);


  const refreshExperience = useCallback(() => {
    const next = isAdvancedExperience();
    setAdvanced(next);
    if (!next) setOpen(false);
  }, []);

  useEffect(() => {
    queueMicrotask(refreshExperience);

    const observer = new MutationObserver(refreshExperience);
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });

    const interval = window.setInterval(refreshExperience, 800);
    window.addEventListener("storage", refreshExperience);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("storage", refreshExperience);
    };
  }, [refreshExperience]);

  useEffect(() => {
    if (!open || !advanced) return;

    queueMicrotask(() => setLoading(true));

    void Promise.all([
      loadConflictAnalytics().catch(() => null),
      loadConflictAnomalies().catch(() => null),
      listConflictAudit(40).catch(() => []),
      loadGuardrailPolicyHistory(40).catch(() => []),
    ])
      .then(([nextAnalytics, nextAnomaly, nextAudit, nextPolicy]) => {
        setAnalytics(nextAnalytics);
        setAnomaly(nextAnomaly);
        setAudit(nextAudit);
        setPolicy(nextPolicy);
      })
      .finally(() => setLoading(false));
  }, [open, advanced]);

  const unresolvedCount = useMemo(
    () => audit.filter((record) => record.resolution === null).length,
    [audit],
  );



  if (!advanced) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-[105] inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/92 px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-xl backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white"
        aria-label="Open Advanced operations"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Operations
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Advanced Operations and Reliability"
        >
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                  Advanced experience
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  Operations & Reliability
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Conflict health, anomaly analysis, recovery audit, and guardrail policy history.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-6 py-3">
              {(
                [
                  ["health", "Health"],
                  ["anomalies", "Anomalies"],
                  ["audit", "Recovery audit"],
                  ["policy", "Policy history"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    tab === value
                      ? "bg-slate-950 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-6">
              {loading ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">
                  Loading operational intelligenceâ€¦
                </div>
              ) : null}

              {!loading && tab === "health" ? (
                <HealthPanel
                  analytics={analytics}
                  unresolvedCount={unresolvedCount}
                />
              ) : null}

              {!loading && tab === "anomalies" ? (
                <AnomalyPanel anomaly={anomaly} />
              ) : null}

              {!loading && tab === "audit" ? (
                <AuditPanel records={audit} />
              ) : null}

              {!loading && tab === "policy" ? (
                <PolicyPanel records={policy} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function HealthPanel({
  analytics,
  unresolvedCount,
}: {
  analytics: ConflictAnalyticsSnapshot | null;
  unresolvedCount: number;
}) {
  if (!analytics) {
    return <EmptyState text="No authenticated conflict analytics are available." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Health" value={`${analytics.health_score}/100`} />
        <Metric label="24h conflicts" value={String(analytics.conflicts_24h)} />
        <Metric label="Unresolved" value={String(unresolvedCount)} />
        <Metric label="Max revision gap" value={String(analytics.max_revision_gap)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Resolution mix">
          <p className="text-sm text-slate-700">
            Cloud {analytics.cloud_resolutions}
            {" Â· "}
            Local {analytics.local_resolutions}
            {" Â· "}
            Cloud ratio {Math.round(analytics.resolution_cloud_ratio * 100)}%
          </p>
        </Card>

        <Card title="Revision pressure">
          <p className="text-sm text-slate-700">
            Average gap {analytics.average_revision_gap}
            {" Â· "}
            7-day conflicts {analytics.conflicts_7d}
            {" Â· "}
            Status {analytics.health_level}
          </p>
        </Card>
      </div>

      <Card title="Hot keys">
        {analytics.hot_keys.length === 0 ? (
          <p className="text-sm text-slate-500">No conflict hot spots.</p>
        ) : (
          <div className="space-y-2">
            {analytics.hot_keys.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-4 rounded-xl bg-white px-3 py-2 text-sm text-slate-700"
              >
                <span className="truncate">{item.key}</span>
                <span className="font-semibold">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AnomalyPanel({
  anomaly,
}: {
  anomaly: ConflictAnomalySnapshot | null;
}) {
  if (!anomaly) {
    return <EmptyState text="No authenticated anomaly analysis is available." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Anomaly score" value={`${anomaly.anomaly_score}/100`} />
        <Metric label="Severity" value={anomaly.severity} />
      </div>

      <Card title="Summary">
        <p className="text-sm text-slate-700">{anomaly.summary}</p>
      </Card>

      <Card title="Root causes">
        {anomaly.root_causes.length === 0 ? (
          <p className="text-sm text-slate-500">No root-cause pattern detected.</p>
        ) : (
          <div className="space-y-2">
            {anomaly.root_causes.map((cause, index) => (
              <p
                key={`${String(cause.code)}-${index}`}
                className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700"
              >
                {String(cause.message ?? cause.code)}
              </p>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recommended remediation">
        <div className="space-y-2">
          {anomaly.recommendations.map((item) => (
            <div key={item.code} className="rounded-xl bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">
                  {item.code.replaceAll("_", " ")}
                </p>
                <span className="text-[10px] font-semibold uppercase text-slate-500">
                  {item.priority}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{item.action}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AuditPanel({ records }: { records: ConflictAuditRecord[] }) {
  if (records.length === 0) {
    return <EmptyState text="No persisted conflict history is available." />;
  }

  return (
    <div className="space-y-2">
      {records.map((record) => (
        <div
          key={record.id}
          className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="break-all text-sm font-semibold text-slate-800">
              {record.key}
            </p>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
              {record.resolution ?? "pending"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            rev {record.expected_revision} â†’ {record.actual_revision}
            {" Â· "}
            {record.local_action}
            {" Â· "}
            {new Date(record.detected_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

function PolicyPanel({
  records,
}: {
  records: GuardrailPolicyAuditRecord[];
}) {
  const [override, setOverride] =
    useState<GuardrailPolicyOverride | null>(null);
  const [overrideKey, setOverrideKey] = useState("");
  const [warningThreshold, setWarningThreshold] = useState(30);
  const [refreshThreshold, setRefreshThreshold] = useState(55);
  const [criticalThreshold, setCriticalThreshold] = useState(75);
  const [backoffScale, setBackoffScale] = useState(1);
  const [overrideReason, setOverrideReason] = useState("");
  async function applyManualOverride() {
    if (!overrideKey.trim()) return;

    const next = await setGuardrailOverride({
      key: overrideKey.trim(),
      warningThreshold,
      refreshThreshold,
      criticalThreshold,
      backoffScale,
      source: "manual",
      reason: overrideReason || "Manual Advanced-mode override.",
    });
    setOverride(next);
  }

  async function restoreAuditedPolicy(
    record: GuardrailPolicyAuditRecord,
  ) {
    const next = await setGuardrailOverride({
      key: record.key,
      warningThreshold: record.warning_threshold,
      refreshThreshold: record.refresh_threshold,
      criticalThreshold: record.critical_threshold,
      backoffScale: record.backoff_scale,
      source: "rollback",
      sourceAuditId: record.id,
      reason: `Rollback to audited policy ${record.id}.`,
    });
    setOverrideKey(record.key);
    setOverride(next);
  }

  async function clearOverride() {
    if (!overrideKey.trim()) return;
    await clearGuardrailOverride(overrideKey.trim());
    setOverride(null);
  }

  async function loadOverrideForKey() {
    if (!overrideKey.trim()) return;
    const current = await getGuardrailOverride(overrideKey.trim());
    setOverride(current);
  }
  if (records.length === 0) {
    return <EmptyState text="No persisted policy changes are available yet." />;
  }

  return (
    <div className="space-y-2">

      <Card title="Safe manual override">
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">
              Durable state key
            </label>
            <input
              value={overrideKey}
              onChange={(event) => setOverrideKey(event.target.value)}
              placeholder="contextforge-quality-gate-policy"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NumberField
              label="Warn"
              value={warningThreshold}
              onChange={setWarningThreshold}
            />
            <NumberField
              label="Refresh"
              value={refreshThreshold}
              onChange={setRefreshThreshold}
            />
            <NumberField
              label="Critical"
              value={criticalThreshold}
              onChange={setCriticalThreshold}
            />
            <NumberField
              label="Backoff"
              value={backoffScale}
              step={0.05}
              onChange={setBackoffScale}
            />
          </div>
        </div>

        <textarea
          value={overrideReason}
          onChange={(event) => setOverrideReason(event.target.value)}
          placeholder="Reason for temporary override"
          className="mt-3 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void applyManualOverride()}
            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
          >
            Apply safe override
          </button>
          <button
            type="button"
            onClick={() => void loadOverrideForKey()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Load active override
          </button>
          <button
            type="button"
            onClick={() => void clearOverride()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Return to auto tuning
          </button>
        </div>

        {override ? (
          <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
            Active {override.source} override for {override.key}: warn{" "}
            {override.warning_threshold}, refresh{" "}
            {override.refresh_threshold}, critical{" "}
            {override.critical_threshold}, backoff{" "}
            {override.backoff_scale}Ã—
          </p>
        ) : null}
      </Card>

      {records.map((record, index) => {
        const previous = records[index + 1];
        const sameKeyPrevious =
          previous?.key === record.key ? previous : null;

        return (
          <div
            key={record.id}
            className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="break-all text-sm font-semibold text-slate-800">
                {record.key}
              </p>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                {record.changed ? "changed" : "initial"}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-700">
              warn {record.warning_threshold}
              {" Â· "}
              refresh {record.refresh_threshold}
              {" Â· "}
              critical {record.critical_threshold}
              {" Â· "}
              backoff {record.backoff_scale}Ã—
            </p>

            {sameKeyPrevious ? (
              <p className="mt-1 text-xs text-slate-500">
                Î” warn{" "}
                {record.warning_threshold -
                  sameKeyPrevious.warning_threshold}
                {" Â· "}
                refresh{" "}
                {record.refresh_threshold -
                  sameKeyPrevious.refresh_threshold}
                {" Â· "}
                critical{" "}
                {record.critical_threshold -
                  sameKeyPrevious.critical_threshold}
              </p>
            ) : null}

                        <button
              type="button"
              onClick={() => void restoreAuditedPolicy(record)}
              className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Restore this policy
            </button>

<p className="mt-2 text-xs text-slate-500">
              {record.tuning_reason
                .map((reason) => `${reason.code} (${reason.effect})`)
                .join(" Â· ")}
            </p>
          </div>
        );
      })}
    </div>
  );
}


function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-xs font-semibold text-slate-600">
      {label}
      <input
        type="number"
        value={value}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold capitalize text-slate-950">
        {value}
      </p>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">
      {text}
    </div>
  );
}

