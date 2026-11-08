"use client";

import { useEffect } from "react";

import {
  adoptAuthenticatedPrincipal,
  resetToLocalIdentity,
} from "@/lib/contextforge-workspace";

type Props = {
  principalId: string | null;
  displayName: string | null;
};

export default function AuthIdentityBridge({
  principalId,
  displayName,
}: Props) {
  useEffect(() => {
    if (principalId) {
      adoptAuthenticatedPrincipal({
        id: principalId,
        displayName: displayName || "Authenticated user",
      });
      return;
    }

    resetToLocalIdentity();
  }, [principalId, displayName]);

  return null;
}
