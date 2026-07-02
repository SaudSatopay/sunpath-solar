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
 * RESUMABLE: every completed conversation is checkpointed to eval/.eval-cache.json
 * immediately, so a free-tier quota interruption never loses progress — re-run
 * `npm run eval` and finished conversations are skipped. eval/results.json is
 * written only once ALL conversations complete (so the dashboard never shows
 * partial numbers).
 *
 * Run:  npm run eval            (needs a key in .env.local)
 * Knobs (env): PERSONA_LIMIT, MAX_TURNS, THROTTLE_MS, EVAL_FRESH=1,
 *              AGENT_PROVIDER/AGENT_MODEL, LEAD_PROVIDER/LEAD_MODEL.
 */

import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { generateText, stepCountIs } from "ai";
import { makeModel, DEFAULT_MODEL, type Provider } from "../lib/model";
import { PERSONAS, type LeadPersona } from "./personas";
import { SYSTEM_PROMPT } from "../lib/agent-prompt";
import { salesTools, repairGarbledToolCall } from "../lib/tools";

const asProvider = (v: string | undefined, d: Provider): Provider =>
  v === "google" || v === "anthropic" || v === "groq" ? v : d;

const AGENT_PROVIDER = asProvider(process.env.AGENT_PROVIDER, "google");
const LEAD_PROVIDER = asProvider(process.env.LEAD_PROVIDER, "google");
const AGENT_MODEL_ID = process.env.AGENT_MODEL ?? DEFAULT_MODEL[AGENT_PROVIDER];
const LEAD_MODEL_ID = process.env.LEAD_MODEL ?? DEFAULT_MODEL[LEAD_PROVIDER];

const AGENT_LM = makeModel(AGENT_PROVIDER, AGENT_MODEL_ID);
const LEAD_LM = makeModel(LEAD_PROVIDER, LEAD_MODEL_ID);

const AGENT_LABEL = `${AGENT_PROVIDER}:${AGENT_MODEL_ID}`;
const LEAD_LABEL = `${LEAD_PROVIDER}:${LEAD_MODEL_ID}`;

const MAX_TURNS = Number(process.env.MAX_TURNS ?? 7);
// Be gentle on free-tier rate limits.
const THROTTLE_MS = Number(process.env.THROTTLE_MS ?? 400);
// Optionally run a subset of personas (e.g. PERSONA_LIMIT=6) to conserve free-tier quota.
const PERSONA_LIMIT = Number(process.env.PERSONA_LIMIT ?? 0);
const LEADS = PERSONA_LIMIT > 0 ? PERSONAS.slice(0, PERSONA_LIMIT) : PERSONAS;

const CACHE_PATH = path.join(process.cwd(), "eval", ".eval-cache.json");
const RESULTS_PATH = path.join(process.cwd(), "eval", "results.json");

const BASELINE_PROMPT = `You are a friendly FAQ assistant on SunPath Solar's website. Answer homeowners' questions about solar energy accurately and concisely, and be polite. You do not have access to pricing tools, quotes, or scheduling — you just answer questions.`;

type Arm = "agentic" | "baseline";
type Turn = { role: "agent" | "lead"; content: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse "try again in 1m7.39s" / "…in 45s" hints from provider rate-limit errors. */
function parseRetryDelayMs(msg: string): number | null {
  const m = msg.match(/try again in\s+([\dhms.\s]+)/i);
  if (!m) return null;
  let ms = 0;
  const h = m[1].match(/([\d.]+)\s*h/);
  if (h) ms += parseFloat(h[1]) * 3_600_000;
  const min = m[1].match(/([\d.]+)\s*m(?!s)/);
  if (min) ms += parseFloat(min[1]) * 60_000;
  const s = m[1].match(/([\d.]+)\s*s/);
  if (s) ms += parseFloat(s[1]) * 1_000;
  return ms > 0 ? ms : null;
}

/** Retry with backoff on rate-limit / overload errors, honoring the provider's
 *  retry-after hint (free tiers meter tokens per day and trickle them back). */
async function withRetry<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  let delay = 2000;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      // Tool-call garbles are stochastic — a fresh attempt usually generates clean.
      const retryable =
        /rate|quota|429|RESOURCE_EXHAUSTED|overload|503|500|high demand|try again|not in request\.tools|tool call validation/i.test(
          msg,
        );
      if (attempt === tries - 1 || !retryable) throw err;
      const hinted = parseRetryDelayMs(msg);
      // Wait what the provider asked for (+1s of slack), capped at 10 minutes.
      const wait = Math.min(hinted != null ? hinted + 1_000 : delay, 600_000);
      if (wait > 10_000) {
        console.log(`    …rate-limited, waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${tries})`);
      }
      await sleep(wait);
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
      model: LEAD_LM,
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
            model: AGENT_LM,
            system: SYSTEM_PROMPT,
            messages,
            tools: salesTools,
            stopWhen: stepCountIs(8),
            experimental_repairToolCall: repairGarbledToolCall,
          }),
        )
      : await withRetry(() =>
          generateText({ model: AGENT_LM, system: BASELINE_PROMPT, messages }),
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

/* --------------------------- checkpoint cache --------------------------- */
type Cell = { booked: boolean; turns: number };

async function loadCache(): Promise<Record<string, Cell>> {
  if (process.env.EVAL_FRESH) {
    await rm(CACHE_PATH, { force: true });
    return {};
  }
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8")) as Record<string, Cell>;
  } catch {
    return {};
  }
}

async function saveCache(cache: Record<string, Cell>) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/* ------------------------------- report -------------------------------- */
function armReport(outcomes: PersonaOutcome[]): ArmReport {
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
  if (
    AGENT_PROVIDER === "google" &&
    LEAD_PROVIDER === "google" &&
    !process.env.GOOGLE_GENERATIVE_AI_API_KEY
  ) {
    console.error(
      "Missing GOOGLE_GENERATIVE_AI_API_KEY. Copy .env.example to .env.local and add your free Google AI Studio key (or set SUNPATH/AGENT/LEAD provider to anthropic with ANTHROPIC_API_KEY).",
    );
    process.exit(1);
  }

  const ARMS: Arm[] = ["agentic", "baseline"];
  const total = LEADS.length * ARMS.length;
  const cache = await loadCache();

  console.log(`\nConversion-lift eval — ${LEADS.length} leads × 2 arms (${total} conversations)`);
  console.log(`Agent: ${AGENT_LABEL} · Lead simulator: ${LEAD_LABEL}`);
  console.log(`Resumable — progress cached to eval/.eval-cache.json\n`);

  const collected: Record<Arm, PersonaOutcome[]> = { agentic: [], baseline: [] };
  let done = 0;
  let aborted: string | null = null;

  outer: for (const arm of ARMS) {
    console.log(`Arm — ${arm}:`);
    for (const p of LEADS) {
      // Namespace by model config so a provider switch can't reuse stale outcomes.
      const key = `${AGENT_LABEL}|${LEAD_LABEL}|${arm}|${p.id}`;
      const cached = !!cache[key];
      try {
        let cell = cache[key];
        if (!cell) {
          const r = await runConversation(p, arm);
          cell = { booked: r.booked, turns: r.turns };
          cache[key] = cell;
          await saveCache(cache); // persist immediately — survives a later crash
        }
        collected[arm].push({ id: p.id, qualified: p.qualified, booked: cell.booked, turns: cell.turns });
        done++;
        console.log(
          `  [${arm}] ${p.id.padEnd(16)} ${cell.booked ? "BOOKED " : "—      "} (${p.qualified ? "qualified" : "unqualified"})${cached ? "  ·cached" : ""}`,
        );
      } catch (err) {
        aborted = `${arm}/${p.id}: ${(err as Error).message}`;
        break outer;
      }
    }
  }

  const complete = done === total && !aborted;

  // Interim/final stats to the console.
  const agentic = armReport(collected.agentic);
  const baseline = armReport(collected.baseline);
  const liftPts = agentic.convQualifiedPct - baseline.convQualifiedPct;
  const relativeLiftPct =
    baseline.convQualifiedPct > 0 ? Math.round((liftPts / baseline.convQualifiedPct) * 100) : null;

  console.log("\n────────────────────────────────────────");
  console.log(`Qualified-lead booking rate${complete ? "" : "  (INTERIM — partial run)"}`);
  console.log(`  Sunny (agentic): ${agentic.convQualifiedPct}%`);
  console.log(`  Baseline (FAQ):  ${baseline.convQualifiedPct}%`);
  console.log(`  Lift: +${liftPts} pts${relativeLiftPct != null ? ` (+${relativeLiftPct}% relative)` : ""}`);
  console.log(`  False-push on unqualified — Sunny ${agentic.falsePushPct}% vs baseline ${baseline.falsePushPct}%`);

  if (complete) {
    const out = {
      generatedAt: new Date().toISOString(),
      agentModel: AGENT_LABEL,
      leadModel: LEAD_LABEL,
      personasCount: LEADS.length,
      qualifiedCount: LEADS.filter((p) => p.qualified).length,
      agentic,
      baseline,
      liftPoints: liftPts,
      relativeLiftPct,
    };
    await mkdir(path.dirname(RESULTS_PATH), { recursive: true });
    await writeFile(RESULTS_PATH, JSON.stringify(out, null, 2));
    console.log(`\n✓ Complete — wrote eval/results.json (${total} conversations).`);
  } else {
    console.log(`\nProgress saved: ${done}/${total} conversations cached (eval/.eval-cache.json).`);
    if (aborted) {
      console.log(`Stopped at ${aborted}`);
      console.log("Likely free-tier quota. Re-run `npm run eval` to continue — finished conversations are skipped.");
    }
    console.log("eval/results.json is written only once all conversations complete.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
