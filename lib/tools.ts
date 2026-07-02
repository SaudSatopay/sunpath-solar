import { tool } from "ai";
import { z } from "zod";
import {
  PACKAGES,
  getPackage,
  recommendPackageId,
  computeEconomics,
  getStateIncentive,
  FEDERAL_ITC,
  FINANCING_OPTIONS,
  type SolarPackage,
} from "./solar-data";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Tool inputs are deliberately permissive: LLMs frequently emit explicit
// `null` for "not provided", send numbers as strings, or pass free-text where
// a strict enum is expected. We accept that at the schema boundary (.nullish(),
// z.coerce.number(), z.string() with the valid values documented) and normalize
// in the handler, so a stray value never crashes a tool call.

function shortId(prefix: string): string {
  // Server-side only; crypto is available in the Node/Edge runtime.
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

/** Standard amortized monthly payment. */
function monthlyPayment(principal: number, apr: number, years: number): number {
  const r = apr / 12;
  const n = years * 12;
  if (r === 0) return Math.round(principal / n);
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -n)));
}

function packageSummary(pkg: SolarPackage) {
  return {
    id: pkg.id,
    name: pkg.name,
    sizeKw: pkg.sizeKw,
    panelCount: pkg.panelCount,
    batteryKwh: pkg.batteryKwh,
    estAnnualKwh: pkg.estAnnualKwh,
  };
}

/* ------------------------------------------------------------------ */
/* Tools                                                              */
/* ------------------------------------------------------------------ */

export const salesTools = {
  scoreLead: tool({
    description:
      "Qualify and score a homeowner lead. Call once you know whether they own the home plus at least their monthly bill or state. Re-call as you learn more.",
    inputSchema: z.object({
      homeowner: z.boolean().describe("Does the person own (not rent) the home?"),
      monthlyBill: z.coerce
        .number()
        .nullish()
        .describe("Average monthly electricity bill in USD."),
      state: z.string().nullish().describe("Two-letter US state code, e.g. CA."),
      roofType: z
        .string()
        .nullish()
        .describe("Roof material if known: asphalt-shingle, metal, tile, flat, or unsure."),
      timeline: z
        .string()
        .nullish()
        .describe(
          "How soon they might move forward: now, few-months, this-year, researching, or unsure.",
        ),
      motivation: z
        .string()
        .nullish()
        .describe("Why they're interested (savings, outages, EV, green, etc.)."),
    }),
    execute: async ({ homeowner, monthlyBill, state, roofType, timeline, motivation }) => {
      const missing: string[] = [];
      if (monthlyBill == null) missing.push("monthly bill");
      if (!state) missing.push("state");
      if (!timeline) missing.push("timeline");

      let score = 0;
      if (homeowner) score += 35;
      if (monthlyBill != null) {
        if (monthlyBill >= 250) score += 30;
        else if (monthlyBill >= 150) score += 22;
        else if (monthlyBill >= 90) score += 12;
        else score += 2; // bill too small for good payback
      }
      if (state) score += 8;
      if (roofType && roofType !== "unsure") score += 7;
      if (timeline === "now" || timeline === "few-months") score += 15;
      else if (timeline === "this-year") score += 10;
      else if (timeline === "researching") score += 4;
      if (motivation) score += 5;
      score = Math.min(100, score);

      const qualified = homeowner && (monthlyBill == null || monthlyBill >= 90);
      let tier: "hot" | "warm" | "cool" | "unqualified";
      if (!qualified) tier = "unqualified";
      else if (score >= 70) tier = "hot";
      else if (score >= 45) tier = "warm";
      else tier = "cool";

      const rationale = !homeowner
        ? "Renters can't install panels — not a fit."
        : monthlyBill != null && monthlyBill < 90
          ? "Bill is likely too low for solar to pay off."
          : tier === "hot"
            ? "Strong fit — owns the home, meaningful bill, ready to move."
            : "Potential fit — keep qualifying before quoting.";

      return { score, tier, qualified, missing, rationale };
    },
  }),

  recommendSystem: tool({
    description:
      "Recommend the right-sized SunPath package for a homeowner and return exact economics (net price after incentives, payback, savings). Requires their monthly bill.",
    inputSchema: z.object({
      monthlyBill: z.coerce
        .number()
        .nullish()
        .describe("Average monthly electricity bill in USD (required to size a system)."),
      state: z.string().nullish().describe("Two-letter US state code, e.g. CA."),
    }),
    execute: async ({ monthlyBill, state }) => {
      // Steer the agent instead of crashing the turn (observed: models call
      // this before collecting the bill).
      if (monthlyBill == null) {
        return {
          needsInfo: "monthlyBill",
          message:
            "No bill provided — ask for their average monthly electricity bill, then call recommendSystem again.",
        } as const;
      }
      const pkg = getPackage(recommendPackageId(monthlyBill))!;
      const economics = computeEconomics(pkg, state ?? undefined);
      return {
        package: packageSummary(pkg),
        tagline: pkg.tagline,
        economics,
        state: state?.toUpperCase() ?? null,
      };
    },
  }),

  lookupIncentives: tool({
    description:
      "Look up the solar incentives a homeowner qualifies for: the federal tax credit plus any state-specific programs.",
    inputSchema: z.object({
      state: z.string().nullish().describe("Two-letter US state code, e.g. CA."),
    }),
    execute: async ({ state }) => {
      const incentive = getStateIncentive(state ?? undefined);
      return {
        federalPct: Math.round(FEDERAL_ITC * 100),
        federalLabel: "Federal Residential Clean Energy Credit (ITC)",
        state: {
          label: incentive.label,
          summary: incentive.summary,
          estValue: incentive.estValue,
        },
      };
    },
  }),

  generateQuote: tool({
    description:
      "Generate a formal quote for an interested homeowner. Call after recommending a system and agreeing on a financing approach.",
    inputSchema: z.object({
      packageId: z
        .string()
        .describe("The SunPath package to quote: starter, home, home-plus, or whole-home."),
      financingId: z
        .string()
        .describe("Financing approach: cash, loan, or lease-ppa."),
      state: z.string().nullish().describe("Two-letter US state code, e.g. CA."),
      customerName: z.string().nullish().describe("Customer's first name, if known."),
    }),
    execute: async ({ packageId, financingId, state, customerName }) => {
      // Fall back to sensible defaults if the model passes an unknown id.
      const pkg = getPackage(packageId) ?? getPackage("home")!;
      const economics = computeEconomics(pkg, state ?? undefined);
      const financing =
        FINANCING_OPTIONS.find((f) => f.id === financingId) ??
        FINANCING_OPTIONS.find((f) => f.id === "loan")!;
      const monthlyLoanEstimate =
        financing.id === "loan" ? monthlyPayment(economics.netPrice, 0.0649, 25) : null;

      return {
        quoteId: shortId("SP"),
        customerName: customerName ?? null,
        package: packageSummary(pkg),
        warrantyYears: pkg.warrantyYears,
        economics,
        financing: { id: financing.id, label: financing.label, blurb: financing.blurb },
        monthlyLoanEstimate,
        validDays: 30,
      };
    },
  }),

  bookSurvey: tool({
    description:
      "Book a free on-site survey for a qualified, interested homeowner. Collect their name and a contact (email or phone) first. This is the conversion.",
    inputSchema: z.object({
      customerName: z.string().nullish().describe("Customer's name."),
      contact: z.string().nullish().describe("Email address or phone number."),
      preferredDate: z
        .string()
        .nullish()
        .describe("Preferred date/time in the customer's words."),
      packageId: z
        .string()
        .nullish()
        .describe("Package of interest, if chosen: starter, home, home-plus, or whole-home."),
    }),
    execute: async ({ customerName, contact, preferredDate, packageId }) => {
      // Never book without a name + contact — steer the agent to collect them.
      if (!customerName?.trim() || !contact?.trim()) {
        return {
          needsInfo: "contact",
          message:
            "Missing the customer's name and/or contact — collect both, then call bookSurvey again.",
        } as const;
      }
      const pkg = packageId ? getPackage(packageId) : undefined;
      return {
        surveyId: shortId("SURVEY"),
        customerName,
        contact,
        scheduled: preferredDate ?? "to be confirmed by our team",
        package: pkg ? packageSummary(pkg) : null,
        status: "booked",
      };
    },
  }),

  logToCRM: tool({
    description:
      "Record the lead and outcome in the CRM after a meaningful step (qualified, quoted, booked, or disqualified).",
    inputSchema: z.object({
      stage: z
        .string()
        .describe("Current pipeline stage: new, qualified, quoted, booked, or disqualified."),
      customerName: z.string().nullish().describe("Customer's name, if known."),
      score: z.coerce.number().nullish().describe("Lead score from scoreLead, if available."),
      notes: z.string().nullish().describe("Short summary of the interaction."),
    }),
    execute: async ({ stage, customerName, score, notes }) => {
      return {
        crmId: shortId("CRM"),
        stage,
        customerName: customerName ?? null,
        score: score ?? null,
        notes: notes ?? null,
        status: "logged",
      };
    },
  }),
};

export type SalesTools = typeof salesTools;
export const PACKAGE_ID_LIST = PACKAGES.map((p) => p.id);
