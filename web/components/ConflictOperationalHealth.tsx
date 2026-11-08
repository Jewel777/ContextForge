"use client";

import { useEffect, useState } from "react";

import {
  loadConflictAnalytics,
  type ConflictAnalyticsSnapshot,
} from "@/lib/contextforge-conflict-analytics";

export default function ConflictOperationalHealth() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] =
    useState<ConflictAnalyticsSnapshot | null>(null);

  useEffect(() => {
    if (!open) return;

    void loadConflictAnalytics()
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, [open]);

  return (
    <div className="fixed bottom-4 left-36 z-[109]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-xl hover:bg-white"
      >
        Conflict health
      </button>

      {open ? (
        <div className="mt-2 w-[min(620px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Operational health
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-950">
                Cross-device conflict analytics
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
              No authenticated conflict analytics are available.
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric
                  label="Health"
                  value={`${snapshot.health_score}/100`}
                />
                <Metric
                  label="24h conflicts"
                  value={String(snapshot.conflicts_24h)}
                />
                <Metric
                  label="Unresolved"
                  value={String(snapshot.unresolved_conflicts)}
                />
                <Metric
                  label="Max rev gap"
                  value={String(snapshot.max_revision_gap)}
                />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <section className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Resolution mix
                  </p>
                  <p className="mt-2 text-xs text-slate-700">
                    Cloud {snapshot.cloud_resolutions}
                    {" · "}
                    Local {snapshot.local_resolutions}
                    {" · "}
                    Cloud ratio{" "}
                    {Math.round(
                      snapshot.resolution_cloud_ratio * 100,
                    )}
                    %
                  </p>
                </section>

                <section className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Revision pressure
                  </p>
                  <p className="mt-2 text-xs text-slate-700">
                    Avg gap {snapshot.average_revision_gap}
                    {" · "}
                    7d {snapshot.conflicts_7d}
                    {" · "}
                    Status {snapshot.health_level}
                  </p>
                </section>
              </div>

              <section className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Hot keys
                </p>
                <div className="mt-2 space-y-1">
                  {snapshot.hot_keys.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No conflict hot spots.
                    </p>
                  ) : (
                    snapshot.hot_keys.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-3 text-xs text-slate-700"
                      >
                        <span className="truncate">
                          {item.key}
                        </span>
                        <span className="font-semibold">
                          {item.count}
                        </span>
                      </div>
                    ))
                  )}
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
      <p className="mt-1 text-lg font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}
