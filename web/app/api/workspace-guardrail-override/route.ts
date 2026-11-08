import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/require-auth";

const ENGINE_URL =
  process.env.CONTEXTFORGE_API_URL ?? "http://127.0.0.1:8001";

async function authHeaders() {
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
  const auth = await authHeaders();
  if (auth.response || !auth.headers) return auth.response;

  const workspaceId =
    request.headers.get("x-contextforge-workspace-id")?.trim() ||
    "personal";
  const key = request.nextUrl.searchParams.get("key") ?? "";

  const url = new URL(
    "/workspace-conflicts/guardrail-policy/override",
    ENGINE_URL,
  );
  url.searchParams.set("workspace_id", workspaceId);
  url.searchParams.set("key", key);

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
  const auth = await authHeaders();
  if (auth.response || !auth.headers) return auth.response;

  auth.headers.set("content-type", "application/json");

  const response = await fetch(
    new URL(
      "/workspace-conflicts/guardrail-policy/override",
      ENGINE_URL,
    ),
    {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    },
  );

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

export async function DELETE(request: NextRequest) {
  const auth = await authHeaders();
  if (auth.response || !auth.headers) return auth.response;

  auth.headers.set("content-type", "application/json");

  const response = await fetch(
    new URL(
      "/workspace-conflicts/guardrail-policy/override",
      ENGINE_URL,
    ),
    {
      method: "DELETE",
      headers: auth.headers,
      body: JSON.stringify(await request.json()),
      cache: "no-store",
    },
  );

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
