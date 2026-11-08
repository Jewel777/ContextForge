"use client";

import { useEffect, useState } from "react";

import {
  loadGuardrailPolicyHistory,
  type GuardrailPolicyAuditRecord,
} from "@/lib/contextforge-guardrail-policy-audit";

export default function GuardrailPolicyAuditHistory() {
  const [open, setOpen] = useState(false);
  const [records, setRecords] =
    useState<GuardrailPolicyAuditRecord[]>([]);

  useEffect(() => {
    if (!open) return;

    void loadGuardrailPolicyHistory(30)
      .then(setRecords)
      .catch(() => setRecords([]));
  }, [open]);

  return (
    <div className="fixed bottom-4 left-[29rem] z-[107]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-xl hover:bg-white"
      >
        Policy history
      </button>

      {open ? (
        <div className="mt-2 max-h-[70vh] w-[min(720px,calc(100vw-2rem))] overflow-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Explainable auto-tuning
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-950">
                Guardrail policy change history
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-slate-500"
            >
              Close
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {records.length === 0 ? (
              <p className="text-xs text-slate-500">
                No persisted policy changes are available yet.
              </p>
            ) : (
              records.map((record, index) => {
                const previous = records[index + 1];
                const sameKeyPrevious =
                  previous?.key === record.key ? previous : null;

                return (
                  <div
                    key={record.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-all text-xs font-semibold text-slate-800">
                        {record.key}
                      </p>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                        {record.changed ? "changed" : "initial"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-700">
                      warn {record.warning_threshold}
                      {" · "}
                      refresh {record.refresh_threshold}
                      {" · "}
                      critical {record.critical_threshold}
                      {" · "}
                      backoff {record.backoff_scale}×
                    </p>

                    {sameKeyPrevious ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Δ warn{" "}
                        {record.warning_threshold -
                          sameKeyPrevious.warning_threshold}
                        {" · "}
                        refresh{" "}
                        {record.refresh_threshold -
                          sameKeyPrevious.refresh_threshold}
                        {" · "}
                        critical{" "}
                        {record.critical_threshold -
                          sameKeyPrevious.critical_threshold}
                      </p>
                    ) : null}

                    <p className="mt-2 text-[11px] text-slate-500">
                      {record.tuning_reason
                        .map((reason) =>
                          `${reason.code} (${reason.effect})`,
                        )
                        .join(" · ")}
                    </p>

                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(record.created_at).toLocaleString()}
                      {" · "}
                      sample {record.sample_size}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
