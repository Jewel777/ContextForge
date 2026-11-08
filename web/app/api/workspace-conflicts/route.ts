import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/require-auth";

const ENGINE_URL =
  process.env.CONTEXTFORGE_API_URL ?? "http://127.0.0.1:8001";

async function principalHeaders() {
  const authGate = await requireApiSession();

  if (authGate.response) {
    return {
      response: authGate.response,
      headers: null,
    };
  }

  const principalId = authGate.session?.user?.id;

  if (!principalId) {
    return {
      response: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
      headers: null,
    };
  }

  return {
    response: null,
    headers: new Headers({
      "x-contextforge-principal-id": principalId,
      "x-contextforge-principal-name":
        authGate.session?.user?.name ??
        authGate.session?.user?.email ??
        principalId,
    }),
  };
}

export async function GET(request: NextRequest) {
  const auth = await principalHeaders();
  if (auth.response || !auth.headers) return auth.response;

  const workspaceId =
    request.headers.get("x-contextforge-workspace-id")?.trim() || "personal";
  const limit = request.nextUrl.searchParams.get("limit") ?? "50";

  const url = new URL("/workspace-conflicts", ENGINE_URL);
  url.searchParams.set("workspace_id", workspaceId);
  url.searchParams.set("limit", limit);

  const response = await fetch(url, {
    headers: auth.headers,
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

export async function POST(request: NextRequest) {
  const auth = await principalHeaders();
  if (auth.response || !auth.headers) return auth.response;

  const payload = await request.json();
  const action = request.nextUrl.searchParams.get("action");

  const path =
    action === "resolve"
      ? "/workspace-conflicts/resolve"
      : "/workspace-conflicts/detected";

  auth.headers.set("content-type", "application/json");

  const response = await fetch(new URL(path, ENGINE_URL), {
    method: "POST",
    headers: auth.headers,
    body: JSON.stringify(payload),
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
