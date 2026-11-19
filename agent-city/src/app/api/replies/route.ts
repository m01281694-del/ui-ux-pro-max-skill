import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json(JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "replies.json"), "utf8")));
}
