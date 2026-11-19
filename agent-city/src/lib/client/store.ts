"use client";
import { useSyncExternalStore } from "react";
import type { Content, FeedItem, Task } from "../work/types";

export type Selection = { type: "resident" | "building"; id: number } | null;

export interface AppState {
  live: boolean;
  replayBase: number; // sim ts when replay (re)started
  replayReal: number; // performance.now() at that moment
  speed: number;
  selected: Selection;
  follow: boolean;
  tasks: Task[];
  contents: Content[];
  feed: FeedItem[];
  focus: { x: number; y: number } | null; // ask the camera to center on tile
  feedFilter: { dept: string; platform: string; residentId: number | null };
  paused: boolean; // kill switch
}

let state: AppState = {
  live: true, replayBase: 0, replayReal: 0, speed: 60, selected: null, follow: false, tasks: [], contents: [], feed: [],
  focus: null, feedFilter: { dept: "", platform: "", residentId: null }, paused: false,
};
const subs = new Set<() => void>();

export const getState = () => state;
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  subs.forEach((f) => f());
}
export function useApp<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => sel(state), () => sel(state));
}

/** current simulated timestamp (live = real time) */
export function simNow(): number {
  const s = state;
  if (s.live) return Date.now();
  return s.replayBase + (performance.now() - s.replayReal) * s.speed;
}

export function startReplay(ts: number, speed: number) {
  setState({ live: false, replayBase: ts, replayReal: performance.now(), speed });
}
export function goLive() { setState({ live: true }); }

export function activeTaskMap(tasks: Task[], t: number): Map<number, Task> {
  const m = new Map<number, Task>();
  for (const x of tasks) if (x.start <= t && t < x.end) m.set(x.residentId, x);
  return m;
}
