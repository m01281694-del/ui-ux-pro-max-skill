import { NextResponse } from "next/server";
import { z } from "zod";
import { getControl, setControl } from "@/lib/control";

export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json(getControl()); }
export async function POST(req: Request) {
  const body = z.object({ publishingPaused: z.boolean().optional(), approvalMode: z.enum(["manuel", "semi-auto", "full-auto"]).optional() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  return NextResponse.json(setControl(body.data));
}
