// Talking to a resident: the ONLY place the life layer calls an LLM (Haiku, short answers).
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorld } from "@/lib/sim/world";
import { DEPT_BY_ID } from "@/lib/sim/data";
import { recordUsage, budgetLeft } from "@/lib/ai/budget";

const Body = z.object({
  residentId: z.number().int().min(0).max(999),
  activity: z.string().max(200),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1000) })).min(1).max(20),
});

const SYSTEM = `Tu incarnes un habitant d'« Agent City », une ville simulée dont une partie des habitants travaille dans un pipeline de création de contenu (Research, Content, Publish, Community, Sales, The loop).
Réponds en français, à la première personne, en 1 à 3 phrases courtes, avec la personnalité donnée. N'invente aucun chiffre réel sur le business : si on te demande des résultats, renvoie vers le tableau de bord.`;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { residentId, activity, messages } = parsed.data;
  const r = getWorld().residents[residentId];
  const persona = `Tu es ${r.first} ${r.last}, ${r.age} ans, ${r.job}${r.dept ? ` (département ${DEPT_BY_ID[r.dept].name})` : ""}. En ce moment : ${activity}. Traits (0-100) : ${Object.entries(r.traits).map(([k, v]) => `${k} ${Math.round(v * 100)}`).join(", ")}.`;

  const hasCreds = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  if (!hasCreds || budgetLeft() <= 0) {
    return NextResponse.json({ text: `(${r.first} sourit) Je suis en train de ${activity.replace(/^en /, "être en ")}. — réponse automatique : ${hasCreds ? "plafond de dépense IA du jour atteint" : "clé Claude pas encore configurée"}.`, offline: true });
  }
  const client = new Anthropic();
  try {
    const res = await client.messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 400,
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: persona }],
      messages,
    });
    recordUsage("chat", "claude-haiku-5-5", res.usage.input_tokens, res.usage.output_tokens);
    if (res.stop_reason === "refusal") return NextResponse.json({ text: "…je préfère ne pas parler de ça." });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
    return NextResponse.json({ text });
  } catch (e) {
    if (e instanceof Anthropic.APIError) return NextResponse.json({ text: `(indisponible : erreur API ${e.status})` }, { status: 200 });
    throw e;
  }
}
