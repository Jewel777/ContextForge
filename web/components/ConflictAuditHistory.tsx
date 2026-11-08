"use client";

import { useEffect, useState } from "react";

import {
  listConflictAudit,
  type ConflictAuditRecord,
} from "@/lib/contextforge-conflict-audit";

export default function ConflictAuditHistory() {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<ConflictAuditRecord[]>([]);

  useEffect(() => {
    if (!open) return;

    void listConflictAudit(25)
      .then(setRecords)
      .catch(() => setRecords([]));
  }, [open]);

  return (
    <div className="fixed bottom-4 left-4 z-[110]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur-xl hover:bg-white"
      >
        Conflict audit
      </button>

      {open ? (
        <div className="mt-2 max-h-[360px] w-[min(520px,calc(100vw-2rem))] overflow-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Recovery audit
              </p>
              <h2 className="mt-1 text-sm font-semibold text-slate-950">
                Recent cloud conflicts
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
                No persisted conflict history is available.
              </p>
            ) : (
              records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all text-xs font-medium text-slate-800">
                      {record.key}
                    </p>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                      {record.resolution ?? "pending"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    rev {record.expected_revision} → {record.actual_revision}
                    {" · "}
                    {record.local_action}
                    {" · "}
                    {new Date(record.detected_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
