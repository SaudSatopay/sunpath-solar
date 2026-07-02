/**
 * Robustness tests for the sales tools (lib/tools.ts).
 *
 * Real models mis-shape tool inputs in predictable ways — explicit `null` for
 * "not provided", numbers as strings, free text where an enum was suggested,
 * invented ids. Each case here reproduces a crash observed live (Groq
 * gpt-oss / Llama runs) that the schemas must now absorb.  Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { salesTools } from "./tools";

/** Minimal ToolCallOptions for invoking execute() directly in tests. */
const opts = { toolCallId: "test", messages: [] } as never;

/** The tools carry their zod schemas; give tests a parse() view of them. */
const schemaOf = (tool: { inputSchema: unknown }) =>
  tool.inputSchema as { parse: (v: unknown) => Record<string, unknown> };

/* ------------------------------------------------------------------ */
/* Schema hardening                                                   */
/* ------------------------------------------------------------------ */

test("scoreLead schema: accepts nulls, coerces string numbers, allows free-text timeline", () => {
  // Regression: gpt-oss sent score:null / free-text timeline and crashed strict schemas.
  const parsed = schemaOf(salesTools.scoreLead).parse({
    homeowner: true,
    monthlyBill: "240",
    state: null,
    roofType: null,
    timeline: "selling in ~1 year",
  });
  assert.equal(parsed.monthlyBill, 240);
  assert.equal(parsed.timeline, "selling in ~1 year");
  assert.equal(parsed.state, null);
});

test("logToCRM schema: tolerates explicit null score (regression: live crash)", async () => {
  const parsed = schemaOf(salesTools.logToCRM).parse({
    stage: "qualified",
    customerName: null,
    score: null,
    notes: null,
  });
  assert.equal(parsed.score, null);

  const out = await salesTools.logToCRM.execute!(
    { stage: "qualified", customerName: null, score: null, notes: null },
    opts,
  );
  assert.equal(out.status, "logged");
  assert.equal(out.score, null);
  assert.match(out.crmId, /^CRM-/);
});

test("recommendSystem schema: coerces a string bill", () => {
  const parsed = schemaOf(salesTools.recommendSystem).parse({ monthlyBill: "165" });
  assert.equal(parsed.monthlyBill, 165);
});

/* ------------------------------------------------------------------ */
/* Handler fallbacks                                                  */
/* ------------------------------------------------------------------ */

test("generateQuote: unknown package/financing ids fall back instead of crashing", async () => {
  const out = await salesTools.generateQuote.execute!(
    { packageId: "mega-ultra-9000", financingId: "crypto", state: null, customerName: null },
    opts,
  );
  assert.equal(out.package.id, "home"); // sensible default package
  assert.equal(out.financing.id, "loan"); // sensible default financing
  assert.match(out.quoteId, /^SP-/);
  assert.ok(out.economics.netPrice > 0);
});

test("bookSurvey: books with just name + contact", async () => {
  const out = await salesTools.bookSurvey.execute!(
    { customerName: "Ana", contact: "ana@example.com", preferredDate: null, packageId: null },
    opts,
  );
  assert.equal(out.status, "booked");
  assert.equal(out.package, null);
  assert.equal(out.scheduled, "to be confirmed by our team");
  assert.match(out.surveyId, /^SURVEY-/);
});

/* ------------------------------------------------------------------ */
/* Qualification logic                                                */
/* ------------------------------------------------------------------ */

test("scoreLead: renters are disqualified, never scored as a fit", async () => {
  const out = await salesTools.scoreLead.execute!(
    {
      homeowner: false,
      monthlyBill: 130,
      state: "NY",
      roofType: null,
      timeline: "this-year",
      motivation: null,
    },
    opts,
  );
  assert.equal(out.qualified, false);
  assert.equal(out.tier, "unqualified");
  assert.match(out.rationale, /rent/i);
});

test("scoreLead: reports what's still missing", async () => {
  const out = await salesTools.scoreLead.execute!(
    { homeowner: true, monthlyBill: null, state: null, roofType: null, timeline: null, motivation: null },
    opts,
  );
  assert.deepEqual(out.missing, ["monthly bill", "state", "timeline"]);
});
