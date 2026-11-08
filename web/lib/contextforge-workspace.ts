export type ContextForgePrincipal = {
  id: string;
  kind: "local" | "authenticated";
  displayName: string;
};

export type ContextForgeWorkspace = {
  id: string;
  ownerPrincipalId: string;
  displayName: string;
};

export type ContextForgeWorkspaceContext = {
  principal: ContextForgePrincipal;
  workspace: ContextForgeWorkspace;
};

const IDENTITY_KEY = "contextforge_identity_v1";
const ACTIVE_WORKSPACE_KEY = "contextforge_active_workspace_v1";
const STORAGE_VERSION = "v1";

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function randomId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 160 &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

function loadOrCreatePrincipal(storage: Storage): ContextForgePrincipal {
  const existing = parseJson<ContextForgePrincipal>(
    storage.getItem(IDENTITY_KEY),
  );

  if (
    existing &&
    validId(existing.id) &&
    (existing.kind === "local" || existing.kind === "authenticated") &&
    typeof existing.displayName === "string"
  ) {
    return existing;
  }

  const principal: ContextForgePrincipal = {
    id: randomId("local"),
    kind: "local",
    displayName: "Local user",
  };

  storage.setItem(IDENTITY_KEY, JSON.stringify(principal));
  return principal;
}

function loadOrCreateWorkspace(
  storage: Storage,
  principal: ContextForgePrincipal,
): ContextForgeWorkspace {
  const existing = parseJson<ContextForgeWorkspace>(
    storage.getItem(ACTIVE_WORKSPACE_KEY),
  );

  if (
    existing &&
    validId(existing.id) &&
    validId(existing.ownerPrincipalId) &&
    existing.ownerPrincipalId === principal.id &&
    typeof existing.displayName === "string"
  ) {
    return existing;
  }

  const workspace: ContextForgeWorkspace = {
    id: "personal",
    ownerPrincipalId: principal.id,
    displayName: "Personal workspace",
  };

  storage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(workspace));
  return workspace;
}

export function getWorkspaceContext(): ContextForgeWorkspaceContext {
  const storage = browserStorage();

  if (!storage) {
    const principal: ContextForgePrincipal = {
      id: "server-local",
      kind: "local",
      displayName: "Local user",
    };

    return {
      principal,
      workspace: {
        id: "personal",
        ownerPrincipalId: principal.id,
        displayName: "Personal workspace",
      },
    };
  }

  const principal = loadOrCreatePrincipal(storage);
  const workspace = loadOrCreateWorkspace(storage, principal);

  return { principal, workspace };
}

function scopedStorageKey(
  key: string,
  context: ContextForgeWorkspaceContext,
): string {
  return [
    "contextforge",
    STORAGE_VERSION,
    context.principal.id,
    context.workspace.id,
    key,
  ].join("::");
}

function migrateLegacyValue(
  storage: Storage,
  legacyKey: string,
  scopedKey: string,
): string | null {
  const legacy = storage.getItem(legacyKey);
  if (legacy === null) return null;

  storage.setItem(scopedKey, legacy);
  storage.removeItem(legacyKey);
  return legacy;
}

export function getWorkspaceItem(key: string): string | null {
  const storage = browserStorage();
  if (!storage) return null;

  const context = getWorkspaceContext();
  const scopedKey = scopedStorageKey(key, context);
  const scoped = storage.getItem(scopedKey);

  if (scoped !== null) return scoped;

  return migrateLegacyValue(storage, key, scopedKey);
}

function emitWorkspaceStorageChange(
  key: string,
  action: "set" | "remove",
  value: string | null,
): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("contextforge:workspace-storage-change", {
      detail: { key, action, value },
    }),
  );
}

export function setWorkspaceItem(key: string, value: string): void {
  const storage = browserStorage();
  if (!storage) return;

  const context = getWorkspaceContext();
  storage.setItem(scopedStorageKey(key, context), value);
  emitWorkspaceStorageChange(key, "set", value);
}

export function setWorkspaceItemFromCloud(
  key: string,
  value: string,
): void {
  const storage = browserStorage();
  if (!storage) return;

  const context = getWorkspaceContext();
  storage.setItem(scopedStorageKey(key, context), value);
}

export function removeWorkspaceItem(key: string): void {
  const storage = browserStorage();
  if (!storage) return;

  const context = getWorkspaceContext();
  storage.removeItem(scopedStorageKey(key, context));
  storage.removeItem(key);
  emitWorkspaceStorageChange(key, "remove", null);
}

export function setAuthenticatedPrincipal(
  principal: Omit<ContextForgePrincipal, "kind">,
): ContextForgeWorkspaceContext {
  const storage = browserStorage();
  if (!storage) {
    throw new Error("Browser storage is unavailable.");
  }

  if (!validId(principal.id)) {
    throw new Error("Invalid principal id.");
  }

  const nextPrincipal: ContextForgePrincipal = {
    ...principal,
    kind: "authenticated",
  };

  storage.setItem(IDENTITY_KEY, JSON.stringify(nextPrincipal));

  const workspace: ContextForgeWorkspace = {
    id: "personal",
    ownerPrincipalId: nextPrincipal.id,
    displayName: "Personal workspace",
  };

  storage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(workspace));

  return {
    principal: nextPrincipal,
    workspace,
  };
}

export function setActiveWorkspace(
  workspace: ContextForgeWorkspace,
): ContextForgeWorkspaceContext {
  const storage = browserStorage();
  if (!storage) {
    throw new Error("Browser storage is unavailable.");
  }

  const principal = loadOrCreatePrincipal(storage);

  if (!validId(workspace.id)) {
    throw new Error("Invalid workspace id.");
  }

  if (workspace.ownerPrincipalId !== principal.id) {
    throw new Error(
      "Workspace ownership does not match the active principal.",
    );
  }

  storage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(workspace));

  return {
    principal,
    workspace,
  };
}

export function resetToLocalIdentity(): ContextForgeWorkspaceContext {
  const storage = browserStorage();
  if (!storage) {
    return getWorkspaceContext();
  }

  storage.removeItem(IDENTITY_KEY);
  storage.removeItem(ACTIVE_WORKSPACE_KEY);
  return getWorkspaceContext();
}

export function adoptAuthenticatedPrincipal(
  principal: Omit<ContextForgePrincipal, "kind">,
): ContextForgeWorkspaceContext {
  const storage = browserStorage();

  if (!storage) {
    throw new Error("Browser storage is unavailable.");
  }

  if (!validId(principal.id)) {
    throw new Error("Invalid principal id.");
  }

  const current = getWorkspaceContext();
  const nextPrincipal: ContextForgePrincipal = {
    ...principal,
    kind: "authenticated",
  };

  const nextWorkspace: ContextForgeWorkspace = {
    id: current.workspace.id,
    ownerPrincipalId: nextPrincipal.id,
    displayName: current.workspace.displayName,
  };

  const oldPrefix = [
    "contextforge",
    STORAGE_VERSION,
    current.principal.id,
    current.workspace.id,
    "",
  ].join("::");

  const newPrefix = [
    "contextforge",
    STORAGE_VERSION,
    nextPrincipal.id,
    nextWorkspace.id,
    "",
  ].join("::");

  const migrations: Array<[string, string, string]> = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (!key || !key.startsWith(oldPrefix)) {
      continue;
    }

    const suffix = key.slice(oldPrefix.length);
    const value = storage.getItem(key);

    if (value !== null) {
      migrations.push([
        key,
        `${newPrefix}${suffix}`,
        value,
      ]);
    }
  }

  for (const [oldKey, newKey, value] of migrations) {
    if (storage.getItem(newKey) === null) {
      storage.setItem(newKey, value);
    }
    storage.removeItem(oldKey);
  }

  storage.setItem(
    IDENTITY_KEY,
    JSON.stringify(nextPrincipal),
  );
  storage.setItem(
    ACTIVE_WORKSPACE_KEY,
    JSON.stringify(nextWorkspace),
  );

  return {
    principal: nextPrincipal,
    workspace: nextWorkspace,
  };
}
