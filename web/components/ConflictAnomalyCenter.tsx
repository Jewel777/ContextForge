"use client";

import { useEffect, useState } from "react";

import {
  loadConflictAnomalies,
  type ConflictAnomalySnapshot,
} from "@/lib/contextforge-conflict-anomaly";

export default function ConflictAnomalyCenter() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] =
    useState<ConflictAnomalySnapshot | null>(null);

  useEffect(() => {
    if (!open) return;

    void loadConflictAnomalies()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, [open]);

  return (
    <div className="fixed bottom-4 left-[17rem] z-[108]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-xl hover:bg-white"
      >
        Conflict anomalies
      </button>

      {open ? (
        <div className="mt-2 max-h-[70vh] w-[min(680px,calc(100vw-2rem))] overflow-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Automated remediation
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-950">
                Conflict anomaly analysis
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

          {!snapshot ? (
            <p className="mt-4 text-xs text-slate-500">
              No authenticated anomaly analysis is available.
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric
                  label="Anomaly score"
                  value={`${snapshot.anomaly_score}/100`}
                />
                <Metric
                  label="Severity"
                  value={snapshot.severity}
                />
              </div>

              <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                {snapshot.summary}
              </p>

              <section className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Root causes
                </p>
                <div className="mt-2 space-y-2">
                  {snapshot.root_causes.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No root-cause pattern detected.
                    </p>
                  ) : (
                    snapshot.root_causes.map((cause, index) => (
                      <p
                        key={`${String(cause.code)}-${index}`}
                        className="text-xs text-slate-700"
                      >
                        {String(cause.message ?? cause.code)}
                      </p>
                    ))
                  )}
                </div>
              </section>

              <section className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Recommended remediation
                </p>
                <div className="mt-2 space-y-2">
                  {snapshot.recommendations.map((item) => (
                    <div
                      key={item.code}
                      className="rounded-lg bg-white p-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-800">
                          {item.code.replaceAll("_", " ")}
                        </p>
                        <span className="text-[10px] font-semibold uppercase text-slate-500">
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {item.action}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold capitalize text-slate-950">
        {value}
      </p>
    </div>
  );
}
