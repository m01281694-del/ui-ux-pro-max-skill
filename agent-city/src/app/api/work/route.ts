import { NextResponse } from "next/server";
import { feedFrom, workBetween } from "@/lib/work/store";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  const now = Number(url.searchParams.get("t")) || Date.now();
  const from = now - (Number(url.searchParams.get("h")) || 10) * 3600000;
  const { tasks, contents } = workBetween(from, now + 3600000);
  return NextResponse.json({ now, tasks, contents, feed: feedFrom(tasks, now) });
}
