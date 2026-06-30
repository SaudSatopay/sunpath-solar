/**
 * Conversion-lift eval.
 *
 * Plays each simulated homeowner (eval/personas.ts) against two reps:
 *   - "agentic"  — Sunny, the full SunPath agent (system prompt + 6 tools + multi-step)
 *   - "baseline" — a plain FAQ assistant (same model, no tools, no methodology)
 *
 * The same lead model drives both arms with an identical decision protocol, so
 * the ONLY difference is the rep. A lead emits [BOOKED] when it agrees to a
 * survey and [DECLINE] when it opts out. We report booked-rate among genuinely
 * qualified leads, the false-push rate among unqualified leads, and the lift.
 *
 * Run:  npm run eval   (requires GOOGLE_GENERATIVE_AI_API_KEY in .env.local)
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { PERSONAS, type LeadPersona } from "./personas";
import { SYSTEM_PROMPT } from "../lib/agent-prompt";
import { salesTools } from "../lib/tools";

const AGENT_MODEL = process.env.AGENT_MODEL ?? "gemini-2.5-flash";
const LEAD_MODEL = process.env.LEAD_MODEL ?? "gemini-2.5-flash";
const MAX_TURNS = 7;
// Be gentle on free-tier rate limits.
const THROTTLE_MS = Number(process.env.THROTTLE_MS ?? 400);
// Optionally run a subset of personas (e.g. PERSONA_LIMIT=6) to conserve free-tier quota.
const PERSONA_LIMIT = Number(process.env.PERSONA_LIMIT ?? 0);
const LEADS = PERSONA_LIMIT > 0 ? PERSONAS.slice(0, PERSONA_LIMIT) : PERSONAS;

const BASELINE_PROMPT = `You are a friendly FAQ assistant on SunPath Solar's website. Answer homeowners' questions about solar energy accurately and concisely, and be polite. You do not have access to pricing tools, quotes, or scheduling — you just answer questions.`;

type Arm = "agentic" | "baseline";
type Turn = { role: "agent" | "lead"; content: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry with exponential backoff on rate-limit / overload errors (free tier). */
async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let delay = 2000;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      const retryable = /rate|quota|429|RESOURCE_EXHAUSTED|overload|503|500/i.test(msg);
      if (attempt === tries - 1 || !retryable) throw err;
      await sleep(delay);
      delay = Math.min(delay * 2, 30_000);
    }
  }
  throw new Error("unreachable");
}

function leadSystem(p: LeadPersona): string {
  return `You are role-playing a homeowner using a solar company's website chat. Stay fully in character and never break character.

Your situation (only you know this):
- Name: ${p.name}
- ${p.homeowner ? "You OWN your home." : "You RENT — you do NOT own the home."}
- State: ${p.state}
- Monthly electricity bill: ${p.monthlyBill ? "$" + p.monthlyBill : "negligible / very low"}
- Roof: ${p.roofType}
- Timeline: ${p.timeline}
- Temperament: ${p.temperament}
- Your main concern: ${p.primaryObjection}
- Note: ${p.notes}

Behave realistically. Answer the rep's questions, and raise your main concern once. Keep each message to 1-3 sentences.

Decision protocol:
- If the rep is honest and genuinely addresses your situation AND solar is actually a good fit for you, agree to book the free on-site survey and end that message with the exact token [BOOKED].
- If you decide solar isn't right for you, or the rep is pushy, evasive, or invents numbers, end a message with the exact token [DECLINE].
- Do NOT book if you don't own the home, or if solar clearly won't pay off for you.
- Otherwise, keep the conversation going (no token).`;
}

function toMessages(transcript: Turn[], selfRole: "agent" | "lead") {
  const msgs = transcript.map((t) => ({
    role: (t.role === selfRole ? "assistant" : "user") as "assistant" | "user",
    content: t.content,
  }));
  // Anthropic/Gemini both require the first message to be a user turn.
  if (msgs.length === 0 || msgs[0].role !== "user") {
    msgs.unshift({ role: "user", content: "(Begin the conversation.)" });
  }
  return msgs;
}

async function leadReply(p: LeadPersona, transcript: Turn[]) {
  const res = await withRetry(() =>
    generateText({
      model: google(LEAD_MODEL),
      system: leadSystem(p),
      messages:
        transcript.length === 0
          ? [{ role: "user" as const, content: "(You just opened the chat. Send your first message.)" }]
          : toMessages(transcript, "lead"),
    }),
  );
  await sleep(THROTTLE_MS);
  return res.text.trim();
}

async function agentReply(arm: Arm, transcript: Turn[]) {
  const messages = toMessages(transcript, "agent");
  const res =
    arm === "agentic"
      ? await withRetry(() =>
          generateText({
            model: google(AGENT_MODEL),
            system: SYSTEM_PROMPT,
            messages,
            tools: salesTools,
            stopWhen: stepCountIs(8),
          }),
        )
      : await withRetry(() =>
          generateText({ model: google(AGENT_MODEL), system: BASELINE_PROMPT, messages }),
        );
  await sleep(THROTTLE_MS);
  return res.text.trim() || "(…)";
}

async function runConversation(p: LeadPersona, arm: Arm) {
  const transcript: Turn[] = [];
  transcript.push({ role: "lead", content: await leadReply(p, transcript) });

  for (let i = 0; i < MAX_TURNS; i++) {
    transcript.push({ role: "agent", content: await agentReply(arm, transcript) });
    const lead = await leadReply(p, transcript);
    transcript.push({ role: "lead", content: lead });
    if (lead.includes("[BOOKED]")) return { booked: true, turns: transcript.length };
    if (lead.includes("[DECLINE]")) return { booked: false, turns: transcript.length };
  }
  return { booked: false, turns: transcript.length };
}

interface PersonaOutcome {
  id: string;
  qualified: boolean;
  booked: boolean;
  turns: number;
}

interface ArmReport {
  convQualifiedPct: number;
  falsePushPct: number;
  qualAccuracyPct: number;
  outcomes: PersonaOutcome[];
}

async function evalArm(arm: Arm): Promise<ArmReport> {
  const outcomes: PersonaOutcome[] = [];
  for (const p of LEADS) {
    let booked = false;
    let turns = 0;
    try {
      const r = await runConversation(p, arm);
      booked = r.booked;
      turns = r.turns;
    } catch (err) {
      console.error(`  ! ${arm}/${p.id} errored:`, (err as Error).message);
    }
    outcomes.push({ id: p.id, qualified: p.qualified, booked, turns });
    console.log(
      `  [${arm}] ${p.id.padEnd(16)} ${booked ? "BOOKED " : "—      "} (${p.qualified ? "qualified" : "unqualified"})`,
    );
  }

  const qualified = outcomes.filter((o) => o.qualified);
  const unqualified = outcomes.filter((o) => !o.qualified);
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  return {
    convQualifiedPct: pct(qualified.filter((o) => o.booked).length, qualified.length),
    falsePushPct: pct(unqualified.filter((o) => o.booked).length, unqualified.length),
    qualAccuracyPct: pct(outcomes.filter((o) => o.booked === o.qualified).length, outcomes.length),
    outcomes,
  };
}

async function main() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error(
      "Missing GOOGLE_GENERATIVE_AI_API_KEY. Copy .env.example to .env.local and add your free Google AI Studio key.",
    );
    process.exit(1);
  }

  console.log(`\nConversion-lift eval — ${LEADS.length} leads × 2 arms`);
  console.log(`Agent: ${AGENT_MODEL} · Lead simulator: ${LEAD_MODEL}\n`);

  console.log("Arm 1/2 — agentic (Sunny + tools):");
  const agentic = await evalArm("agentic");
  console.log("\nArm 2/2 — baseline (FAQ bot):");
  const baseline = await evalArm("baseline");

  const liftPts = agentic.convQualifiedPct - baseline.convQualifiedPct;
  const relativeLiftPct =
    baseline.convQualifiedPct > 0
      ? Math.round((liftPts / baseline.convQualifiedPct) * 100)
      : null;

  const out = {
    generatedAt: new Date().toISOString(),
    agentModel: AGENT_MODEL,
    leadModel: LEAD_MODEL,
    personasCount: LEADS.length,
    qualifiedCount: LEADS.filter((p) => p.qualified).length,
    agentic,
    baseline,
    liftPoints: liftPts,
    relativeLiftPct,
  };

  const dir = path.join(process.cwd(), "eval");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "results.json"), JSON.stringify(out, null, 2));

  console.log("\n────────────────────────────────────────");
  console.log(`Qualified-lead booking rate`);
  console.log(`  Sunny (agentic): ${agentic.convQualifiedPct}%`);
  console.log(`  Baseline (FAQ):  ${baseline.convQualifiedPct}%`);
  console.log(`  Lift: +${liftPts} pts${relativeLiftPct != null ? ` (+${relativeLiftPct}% relative)` : ""}`);
  console.log(`  False-push on unqualified — Sunny ${agentic.falsePushPct}% vs baseline ${baseline.falsePushPct}%`);
  console.log(`\nWrote eval/results.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
