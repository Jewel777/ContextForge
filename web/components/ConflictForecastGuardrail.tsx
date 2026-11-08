"use client";

import { useEffect, useState } from "react";

import type {
  ConflictWriteForecast,
} from "@/lib/contextforge-conflict-forecast";

export default function ConflictForecastGuardrail() {
  const [forecast, setForecast] =
    useState<ConflictWriteForecast | null>(null);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (
        event as CustomEvent<ConflictWriteForecast>
      ).detail;

      if (detail?.warning) {
        setForecast(detail);
      }
    };

    window.addEventListener(
      "contextforge:conflict-forecast",
      listener,
    );

    return () => {
      window.removeEventListener(
        "contextforge:conflict-forecast",
        listener,
      );
    };
  }, []);

  if (!forecast) return null;

  return (
    <aside
      className="fixed right-4 top-4 z-[125] w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Preventive guardrail
          </p>
          <h2 className="mt-1 text-sm font-semibold text-slate-950">
            Elevated write-conflict risk
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setForecast(null)}
          className="text-xs font-semibold text-slate-500"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Risk
          </p>
          <p className="mt-1 text-lg font-semibold capitalize text-slate-950">
            {forecast.risk_level}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Score
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {forecast.risk_score}/100
          </p>
        </div>
      </div>

      <p className="mt-3 break-all text-xs font-medium text-slate-700">
        {forecast.key}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {forecast.recommendation}
      </p>

      {forecast.require_refresh ? (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-700">
          ContextForge refreshed the latest server revision before
          allowing this write to continue.
        </p>
      ) : null}
    </aside>
  );
}
