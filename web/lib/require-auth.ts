import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfigured, authOptions } from "@/auth";

export function authenticationRequired(): boolean {
  return process.env.CONTEXTFORGE_REQUIRE_AUTH === "true";
}

export async function requireApiSession() {
  if (!authenticationRequired()) {
    return {
      session: null,
      response: null,
    };
  }

  if (!authConfigured) {
    return {
      session: null,
      response: NextResponse.json(
        {
          error: "Authentication is required but no OAuth provider is configured.",
        },
        { status: 503 },
      ),
    };
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      session: null,
      response: NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 },
      ),
    };
  }

  return {
    session,
    response: null,
  };
}
