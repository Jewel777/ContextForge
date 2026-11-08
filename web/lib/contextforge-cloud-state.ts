export const CONTEXTFORGE_CLOUD_STATE_SCHEMA_VERSION = 1 as const;

export const CONTEXTFORGE_CLOUD_STATE_KEYS = [
  "contextforge-baseline",
  "contextforge-beta-onboarding-v1",
  "contextforge-bundle-execution-guard-audit",
  "contextforge-bundle-execution-guard-mode",
  "contextforge-compile-policy-bundle-restore-audit",
  "contextforge-compile-policy-bundle-revisions",
  "contextforge-compile-policy-bundles",
  "contextforge-quality-gate-policy",
  "contextforge-quality-gate-profile-revisions",
  "contextforge-quality-gate-profiles",
  "contextforge-quality-gate-restore-audit",
] as const;

export type ContextForgeCloudStateKey =
  (typeof CONTEXTFORGE_CLOUD_STATE_KEYS)[number];

export type ContextForgeCloudEnvelope = {
  schemaVersion: typeof CONTEXTFORGE_CLOUD_STATE_SCHEMA_VERSION;
  key: ContextForgeCloudStateKey;
  updatedAt: string;
  payload: string;
};

const KEY_SET = new Set<string>(CONTEXTFORGE_CLOUD_STATE_KEYS);

export function isCloudStateKey(
  key: string,
): key is ContextForgeCloudStateKey {
  return KEY_SET.has(key);
}

export function createCloudEnvelope(
  key: ContextForgeCloudStateKey,
  payload: string,
): ContextForgeCloudEnvelope {
  return {
    schemaVersion: CONTEXTFORGE_CLOUD_STATE_SCHEMA_VERSION,
    key,
    updatedAt: new Date().toISOString(),
    payload,
  };
}

export function readCloudEnvelope(
  key: ContextForgeCloudStateKey,
  value: unknown,
): ContextForgeCloudEnvelope | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<ContextForgeCloudEnvelope>;

  if (
    candidate.schemaVersion !==
      CONTEXTFORGE_CLOUD_STATE_SCHEMA_VERSION ||
    candidate.key !== key ||
    typeof candidate.updatedAt !== "string" ||
    typeof candidate.payload !== "string"
  ) {
    return null;
  }

  return candidate as ContextForgeCloudEnvelope;
}
