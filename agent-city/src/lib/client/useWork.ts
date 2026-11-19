"use client";
import { useEffect } from "react";
import { getState, setState, simNow, useApp } from "./store";
import type { FeedItem } from "../work/types";

/** Keeps tasks/contents/feed in sync with the server (polling + SSE when live). */
export function useWorkSync() {
  const live = useApp((s) => s.live);
  const replayBase = useApp((s) => s.replayBase);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const t = Math.round(simNow());
        const res = await fetch(`/api/work?t=${t}&h=10`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (!stop) setState({ tasks: j.tasks, contents: j.contents, feed: j.feed });
      } catch {}
    };
    load();
    const iv = setInterval(load, live ? 30000 : 2500);
    let es: EventSource | null = null;
    if (live) {
      es = new EventSource("/api/stream");
      es.addEventListener("feed", (ev) => {
        const items: FeedItem[] = JSON.parse((ev as MessageEvent).data);
        const known = new Set(getState().feed.map((f) => `${f.taskId}:${f.kind}:${f.ts}`));
        const fresh = items.filter((i) => !known.has(`${i.taskId}:${i.kind}:${i.ts}`));
        if (fresh.length) setState((s) => ({ feed: [...fresh, ...s.feed].slice(0, 300) }));
      });
    }
    return () => { stop = true; clearInterval(iv); es?.close(); };
  }, [live, replayBase]);
}

/** re-render every `ms` */
import { useState } from "react";
export function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const i = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(i); }, [ms]);
}
