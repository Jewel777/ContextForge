"use client";

import { useCallback, useEffect, useState } from "react";

import {
  listCloudConflicts,
  removeCloudConflict,
  type CloudConflictRecord,
} from "@/lib/contextforge-conflicts";
import {
  acceptCloudConflict,
  reapplyLocalConflict,
} from "@/lib/contextforge-workspace-sync";

export default function CloudConflictCenter() {
  const [conflicts, setConflicts] = useState<CloudConflictRecord[]>(() => listCloudConflicts());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setConflicts(listCloudConflicts());
  }, []);

  useEffect(() => {
    const listener = () => refresh();
    window.addEventListener("contextforge:cloud-conflict", listener);
    window.addEventListener("contextforge:cloud-conflict-resolved", listener);

    return () => {
      window.removeEventListener("contextforge:cloud-conflict", listener);
      window.removeEventListener("contextforge:cloud-conflict-resolved", listener);
    };
  }, [refresh]);

  if (conflicts.length === 0) return null;

  const active = conflicts[0];
  const busyId = `${active.workspaceId}:${active.key}`;
  const isBusy = busyKey === busyId;

  async function acceptCloud() {
    setBusyKey(busyId);
    try {
      await acceptCloudConflict(active);
      removeCloudConflict(active.workspaceId, active.key);
      refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function reapplyLocal() {
    setBusyKey(busyId);
    try {
      await reapplyLocalConflict(active);
      removeCloudConflict(active.workspaceId, active.key);
      refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <aside
      className="fixed bottom-4 right-4 z-[120] w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            Cloud conflict detected
          </p>
          <h2 className="mt-1 text-sm font-semibold text-slate-950">
            Another signed-in session changed this workspace state.
          </h2>
        </div>
        <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
          rev {active.serverRevision}
        </span>
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
        <p className="break-all text-xs font-medium text-slate-700">
          {active.key}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Your displaced local change was preserved for recovery.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={acceptCloud}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Keep cloud version
        </button>

        <button
          type="button"
          disabled={isBusy}
          onClick={reapplyLocal}
          className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          Reapply my change
        </button>

        {conflicts.length > 1 ? (
          <span className="self-center text-[11px] text-slate-500">
            +{conflicts.length - 1} more conflict
            {conflicts.length > 2 ? "s" : ""}
          </span>
        ) : null}
      </div>
    </aside>
  );
}



