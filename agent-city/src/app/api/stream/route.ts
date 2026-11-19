// Server-Sent Events: pushes new feed items as real (or demo) work happens.
import { feedFrom, workBetween } from "@/lib/work/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function GET(req: Request) {
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(ctrl) {
      let last = Date.now();
      const send = (ev: string, data: unknown) => ctrl.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
      send("hello", { now: last });
      timer = setInterval(() => {
        const now = Date.now();
        const { tasks } = workBetween(last - 120000, now);
        const items = feedFrom(tasks, now, 500).filter((i) => i.ts > last && i.ts <= now);
        if (items.length) send("feed", items);
        else ctrl.enqueue(enc.encode(`: ping\n\n`));
        last = now;
      }, 3000);
      req.signal.addEventListener("abort", () => { clearInterval(timer); try { ctrl.close(); } catch {} });
    },
    cancel() { clearInterval(timer); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
