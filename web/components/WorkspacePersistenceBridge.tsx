"use client";

import { useEffect } from "react";

import {
  mirrorWorkspaceStorageChange,
  syncKnownWorkspaceState,
} from "@/lib/contextforge-workspace-sync";

type WorkspaceStorageChangeDetail = {
  key: string;
  action: "set" | "remove";
  value: string | null;
};

export default function WorkspacePersistenceBridge() {
  useEffect(() => {
    const initialSync = window.setTimeout(() => {
      void syncKnownWorkspaceState().catch((error) => {
        console.warn(
          "ContextForge workspace persistence sync failed:",
          error,
        );
      });
    }, 0);

    const listener = (event: Event) => {
      const custom = event as CustomEvent<WorkspaceStorageChangeDetail>;

      void mirrorWorkspaceStorageChange(custom.detail).catch((error) => {
        console.warn(
          "ContextForge workspace persistence mirror failed:",
          error,
        );
      });
    };

    window.addEventListener(
      "contextforge:workspace-storage-change",
      listener,
    );

    return () => {
      window.clearTimeout(initialSync);
      window.removeEventListener(
        "contextforge:workspace-storage-change",
        listener,
      );
    };
  }, []);

  return null;
}
