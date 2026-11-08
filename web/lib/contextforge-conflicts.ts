"use client";

import type { ContextForgeCloudStateKey } from "@/lib/contextforge-cloud-state";

export type CloudConflictAction = "set" | "remove";

export type CloudConflictRecord = {
  key: ContextForgeCloudStateKey;
  workspaceId: string;
  serverRevision: number;
  localAction: CloudConflictAction;
  localValue: string | null;
  detectedAt: string;
  policy: "server-wins";
  auditId: string | null;
};

const STORAGE_KEY = "contextforge:cloud-conflicts:v1";

function readAll(): CloudConflictRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(records: CloudConflictRecord[]): void {
  if (typeof window === "undefined") return;

  if (records.length === 0) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function listCloudConflicts(): CloudConflictRecord[] {
  return readAll();
}

export function saveCloudConflict(record: CloudConflictRecord): void {
  const existing = readAll().filter(
    (item) =>
      !(
        item.workspaceId === record.workspaceId &&
        item.key === record.key
      ),
  );

  writeAll([record, ...existing].slice(0, 25));
}

export function removeCloudConflict(
  workspaceId: string,
  key: ContextForgeCloudStateKey,
): void {
  writeAll(
    readAll().filter(
      (item) =>
        !(
          item.workspaceId === workspaceId &&
          item.key === key
        ),
    ),
  );
}
