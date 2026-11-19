"use client";
import { useEffect, useState } from "react";

export type Stats = {
  updatedAt: number; source: string; period: string;
  platforms: Record<string, { handle: string; followers: number; posts: number; views: number; likes?: number }>;
  posts: { network: string; publishedAt: number; url: string; title: string; views: number; likes: number; comments: number; shares: number }[];
  revenue: { currency: string; total: number; sales: { at: number; amount: number; product: string }[]; source: string; offer?: { name: string; price: number; url: string } };
  scheduled?: { contentId: string; at: string; networks: string[] }[];
};

export function useStats(): Stats | null {
  const [s, set] = useState<Stats | null>(null);
  useEffect(() => {
    const load = () => fetch("/api/stats", { cache: "no-store" }).then((r) => r.json()).then(set).catch(() => {});
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);
  return s;
}

export function ago(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}
