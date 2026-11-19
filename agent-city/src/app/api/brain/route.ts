import { NextResponse } from "next/server";
import { readBrain, readNote } from "@/lib/brain/graph";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const n = readNote(id);
    return n ? NextResponse.json(n) : NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(readBrain());
}
