# ☀️ SunPath Solar — Sunny, the agentic AI sales rep

> FlowZint AI Hackathon 2026 · **Sales Bot** track

Most "sales bots" are a chat box over an FAQ. **Sunny** is an _agent_: it qualifies a
homeowner, sizes a real system, handles objections with grounded facts, generates a quote,
and **books a site survey** — taking real actions through tools, with every step streaming
into the chat as a live interactive card.

It's built for one number: **booked surveys from genuinely qualified homeowners.** A
reproducible eval ([`/results`](#-the-eval-that-proves-it)) measures the lift over a baseline
FAQ bot.

> SunPath Solar is a fictional installer. All figures are realistic US-market estimates used
> to keep the demo honest — the company and catalog are invented.

---

## What makes it agentic (not a chat wrapper)

Sunny runs a real sales funnel via **6 tools** and multi-step tool use. Each tool call renders
a bespoke **generative-UI card** inline, and a funnel rail (`Qualify → Design → Quote → Book`)
lights up as it progresses.

| Tool | What it does | Renders as |
|------|--------------|-----------|
| `scoreLead` | BANT-style qualification → 0–100 score, tier, what's missing | animated score gauge |
| `recommendSystem` | Picks the right package for the bill + computes economics | system card with net price / payback / savings |
| `lookupIncentives` | Federal ITC + state-specific programs | incentives card |
| `generateQuote` | Formal quote with price waterfall + financing | premium quote card (25-yr savings hero) |
| `bookSurvey` | Books the on-site survey — **the conversion** | booking confirmation |
| `logToCRM` | Records the lead + pipeline stage | system log line |

**Guardrails for trust:** the agent never invents prices, incentives, or production figures —
they come from tool output or the knowledge base in `lib/solar-data.ts`. Objection handling is
grounded in an approved playbook. It's coached to be honest even when it costs the sale (it will
tell a renter or a tiny-bill household that solar isn't a fit).

---

## 📈 The eval that proves it

`eval/run.ts` plays every simulated homeowner in `eval/personas.ts` against **two reps** —
Sunny (agentic, with tools) and a plain FAQ bot — using the **same model** and the **same lead
simulator**, with an identical `[BOOKED]` / `[DECLINE]` decision protocol. The only variable is
the rep.

It reports, per arm:

- **Booking rate among genuinely qualified leads** → the headline lift
- **False-push rate** on unqualified leads (did the rep pressure an unfit homeowner?)
- **Qualification accuracy** (booked exactly the right leads)

```bash
npm run eval        # writes eval/results.json; view it at /results
```

The live app surfaces the result at **`/results`** — so the metric is part of the demo, not a
slide.

---

## 🧰 Bleeding-edge stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 16** (App Router, Turbopack) · **React 19.2** |
| AI | **Vercel AI SDK v7** (`streamText`, multi-step `stopWhen: stepCountIs`) + `@ai-sdk/google` (provider-swappable) |
| Model | **Gemini 2.5 Flash** (free tier) — switch to **Claude Opus 4.8** in one line |
| Schemas | **Zod 4** tool input schemas |
| UI | **Tailwind v4**, **Motion 12**, generative tool cards, "Twilight Energy" design system |
| Deploy | Vercel-ready (one public live URL) |

---

## 🚀 Quickstart

```bash
# 1. Install
npm install

# 2. Add your FREE Google AI Studio key — https://aistudio.google.com/apikey
cp .env.example .env.local      # then paste your key into .env.local

# 3. Run
npm run dev                     # http://localhost:3000

# 4. (optional) generate the conversion-lift numbers
npm run eval                    # populates /results
```

Build: `npm run build`. Requires `GOOGLE_GENERATIVE_AI_API_KEY` (free — [Google AI Studio](https://aistudio.google.com/apikey)).

---

## 🗂 Project structure

```
app/
  api/chat/route.ts     # streamText + tools + multi-step (the agent loop)
  page.tsx              # the chat experience
  results/page.tsx      # conversion-lift dashboard
components/
  chat.tsx             # useChat client, message + tool-part rendering, funnel rail
  tool-cards.tsx       # generative UI: one bespoke card per tool
  atmosphere.tsx       # animated dusk + solar-glow backdrop
  stage-rail.tsx       # Qualify → Design → Quote → Book progress
lib/
  agent-prompt.ts      # Sunny's system prompt (composed from the KB)
  tools.ts             # the 6 agent tools (Zod schemas + execute)
  solar-data.ts        # catalog, incentives, financing, objection playbook, sizing math
eval/
  personas.ts          # 16 simulated leads (with ground-truth qualified flag)
  run.ts               # the conversion-lift harness
```

---

## 🎯 Why this wins the rubric

- **Model innovation (30%)** — genuine multi-step agentic tool use with generative UI, not a
  Q&A wrapper. The agent _acts_.
- **Real-world applicability (25%)** — a measurable business outcome (booking lift) on a real
  funnel, grounded in defensible economics.
- **Technical architecture (25%)** — clean separation (agent / tools / data / UI / eval),
  typed end-to-end, public repo, builds clean on a bleeding-edge stack.
- **Documentation (20%)** — this README + a self-explanatory `/results` dashboard.
