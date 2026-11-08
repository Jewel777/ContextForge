import { requireApiSession } from "@/lib/require-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.CONTEXTFORGE_API_URL ?? "http://127.0.0.1:8001";

export async function POST(request: Request) {
  const authGate = await requireApiSession();
  if (authGate.response) return authGate.response;

  try {
    const body = await request.formData();
    const upstream = await fetch(`${API}/optimize-file`, {
      method: "POST",
      body,
      cache: "no-store",
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {"Content-Type": upstream.headers.get("content-type") ?? "application/json"},
    });
  } catch (error) {
    return Response.json(
      {error:"ContextForge engine is offline.", details:error instanceof Error ? error.message : String(error)},
      {status:500}
    );
  }
}
