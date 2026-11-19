// Password protection (HTTP Basic). Set SITE_PASSWORD in the environment; unset = open (local dev only).
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const pw = process.env.SITE_PASSWORD;
  if (!pw) return NextResponse.next();
  const h = req.headers.get("authorization");
  if (h?.startsWith("Basic ")) {
    const [, pass] = atob(h.slice(6)).split(":");
    if (pass === pw) return NextResponse.next();
  }
  return new NextResponse("Authentification requise", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Agent City"' } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
