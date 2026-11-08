export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API = process.env.CONTEXTFORGE_API_URL ?? "http://127.0.0.1:8001";

export async function GET() {
  try {
    const upstream = await fetch(`${API}/`, {cache:"no-store"});
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {"Content-Type":"application/json"},
    });
  } catch {
    return Response.json({status:"offline"}, {status:503});
  }
}
