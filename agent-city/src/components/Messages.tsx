"use client";
import { useEffect, useMemo, useState } from "react";
import Shell from "./Shell";

type Reply = { id: string; step: string; when: string; where: string; text: string };
type Data = { updatedAt: string; link: string; rules: string[]; replies: Reply[] };

export default function Messages() {
  const [d, setD] = useState<Data | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [step, setStep] = useState("");
  useEffect(() => { fetch("/api/replies", { cache: "no-store" }).then((r) => r.json()).then(setD); }, []);
  const steps = useMemo(() => [...new Set(d?.replies.map((r) => r.step) ?? [])], [d]);
  const copy = async (r: Reply) => {
    const txt = r.text.replaceAll("{link}", d!.link);
    try { await navigator.clipboard.writeText(txt); } catch {
      const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(r.id); setTimeout(() => setCopied(null), 1600);
  };
  return (
    <Shell>
      <div className="absolute inset-0 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-xl font-semibold text-white">Messages : réponses prêtes</h1>
          <p className="mt-1 text-sm text-slate-400">TikTok et Instagram ne permettent pas à la ville de répondre à ta place. Ici, tes réponses sont prêtes : tu copies, tu colles dans TikTok ou Instagram, et c&apos;est envoyé.</p>
          {d && (<>
            <ul className="mt-3 space-y-1 rounded-xl border border-orange-400/30 bg-orange-500/10 p-3 text-[13px] text-orange-100">
              {d.rules.map((r) => <li key={r}>• {r}</li>)}
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <button onClick={() => setStep("")} className={`rounded-full px-3 py-1 text-xs ${!step ? "bg-orange-500 text-white" : "bg-white/5 text-slate-300"}`}>Tout</button>
              {steps.map((s) => <button key={s} onClick={() => setStep(s)} className={`rounded-full px-3 py-1 text-xs ${step === s ? "bg-orange-500 text-white" : "bg-white/5 text-slate-300"}`}>{s}</button>)}
            </div>
            <div className="mt-4 space-y-3" data-testid="replies">
              {d.replies.filter((r) => !step || r.step === step).map((r) => (
                <article key={r.id} className="rounded-xl border border-white/10 bg-[#0d1426] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-orange-300">{r.step} · {r.where === "commentaire" ? "à coller en commentaire" : "en message privé"}</div>
                      <div className="mt-0.5 text-sm font-semibold text-white">{r.when}</div>
                    </div>
                    <button onClick={() => copy(r)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${copied === r.id ? "bg-emerald-500 text-white" : "bg-orange-500 text-white active:scale-95"}`}>
                      {copied === r.id ? "✓ Copié" : "Copier"}
                    </button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white/[0.04] p-3 text-[14px] leading-relaxed text-slate-200">{r.text.replaceAll("{link}", d.link)}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-xs text-slate-500">Mis à jour le {d.updatedAt}. La ville améliorera ces réponses à partir de ce qui convertit.</p>
          </>)}
        </div>
      </div>
    </Shell>
  );
}
