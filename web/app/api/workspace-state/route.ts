import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/require-auth";

const ENGINE_URL =
  process.env.CONTEXTFORGE_API_URL ?? "http://127.0.0.1:8001";

async function forward(
  request: NextRequest,
  method: "GET" | "PUT" | "DELETE",
) {
  const authGate = await requireApiSession();
  if (authGate.response) return authGate.response;

  const principalId = authGate.session?.user?.id;
  if (!principalId) {
    return NextResponse.json(
      { error: "Authenticated persistence requires a signed-in user." },
      { status: 401 },
    );
  }

  const workspaceId =
    request.headers.get("x-contextforge-workspace-id")?.trim() || "personal";
  const key = request.nextUrl.searchParams.get("key")?.trim();

  if (!key) {
    return NextResponse.json({ error: "Missing persistence key." }, { status: 400 });
  }

  const url = new URL("/workspace-state", ENGINE_URL);
  url.searchParams.set("workspace_id", workspaceId);
  url.searchParams.set("key", key);

  const headers = new Headers({
    "x-contextforge-principal-id": principalId,
    "x-contextforge-principal-name":
      authGate.session?.user?.name ??
      authGate.session?.user?.email ??
      principalId,
  });

  let body: string | undefined;
  if (method === "PUT") {
    headers.set("content-type", "application/json");
    body = JSON.stringify(await request.json());
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") ??
        "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  return forward(request, "GET");
}

export async function PUT(request: NextRequest) {
  return forward(request, "PUT");
}

export async function DELETE(request: NextRequest) {
  return forward(request, "DELETE");
}
