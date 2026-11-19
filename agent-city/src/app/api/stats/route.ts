import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export function GET() {
  try { return NextResponse.json(JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "stats.json"), "utf8"))); }
  catch { return NextResponse.json({ updatedAt: 0, platforms: {}, posts: [], revenue: { total: 0, sales: [] } }); }
}
