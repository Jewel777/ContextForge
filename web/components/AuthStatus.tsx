"use client";

import { signIn, signOut, useSession } from "next-auth/react";

import AuthIdentityBridge from "@/components/AuthIdentityBridge";

export default function AuthStatus() {
  const { data: session, status } = useSession();

  const principalId = session?.user?.id ?? null;
  const displayName =
    session?.user?.name ??
    session?.user?.email ??
    null;

  const configured =
    process.env.NEXT_PUBLIC_CONTEXTFORGE_AUTH_CONFIGURED === "true";
  const required =
    process.env.NEXT_PUBLIC_CONTEXTFORGE_REQUIRE_AUTH === "true";

  return (
    <>
      <AuthIdentityBridge
        principalId={principalId}
        displayName={displayName}
      />

      <div className="fixed right-4 top-4 z-[100] flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 text-xs shadow-lg backdrop-blur-xl">
        {status === "loading" ? (
          <span className="font-medium text-slate-500">Checking session…</span>
        ) : session?.user ? (
          <>
            <span className="max-w-48 truncate font-medium text-slate-700">
              {displayName ?? "Signed in"}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </>
        ) : configured ? (
          <>
            <span className="font-medium text-slate-500">
              {required ? "Sign in required" : "Optional account"}
            </span>
            <button
              type="button"
              onClick={() => signIn("github")}
              className="rounded-xl bg-slate-950 px-3 py-1.5 font-semibold text-white transition hover:bg-slate-800"
            >
              Sign in with GitHub
            </button>
          </>
        ) : (
          <span className="font-medium text-slate-500">
            Local beta · OAuth not configured
          </span>
        )}
      </div>
    </>
  );
}
