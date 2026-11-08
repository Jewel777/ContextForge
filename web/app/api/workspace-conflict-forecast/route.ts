import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/require-auth";

const ENGINE_URL =
  process.env.CONTEXTFORGE_API_URL ?? "http://127.0.0.1:8001";

export async function GET(request: NextRequest) {
  const authGate = await requireApiSession();

  if (authGate.response) {
    return authGate.response;
  }

  const principalId = authGate.session?.user?.id;

  if (!principalId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const workspaceId =
    request.headers.get("x-contextforge-workspace-id")?.trim() ||
    "personal";
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const action =
    request.nextUrl.searchParams.get("action") ?? "set";

  const url = new URL(
    "/workspace-conflicts/forecast",
    ENGINE_URL,
  );
  url.searchParams.set("workspace_id", workspaceId);
  url.searchParams.set("key", key);
  url.searchParams.set("action", action);

  const response = await fetch(url, {
    headers: {
      "x-contextforge-principal-id": principalId,
      "x-contextforge-principal-name":
        authGate.session?.user?.name ??
        authGate.session?.user?.email ??
        principalId,
    },
    cache: "no-store",
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ??
        "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
