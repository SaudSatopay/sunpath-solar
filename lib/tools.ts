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

const PACKAGE_IDS = ["starter", "home", "home-plus", "whole-home"] as const;
const FINANCING_IDS = ["cash", "loan", "lease-ppa"] as const;

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
      monthlyBill: z
        .number()
        .optional()
        .describe("Average monthly electricity bill in USD."),
      state: z.string().optional().describe("Two-letter US state code, e.g. CA."),
      roofType: z
        .enum(["asphalt-shingle", "metal", "tile", "flat", "unsure"])
        .optional()
        .describe("Roof material, if known."),
      timeline: z
        .enum(["now", "few-months", "this-year", "researching", "unsure"])
        .optional()
        .describe("How soon they might move forward."),
      motivation: z
        .string()
        .optional()
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
      monthlyBill: z.number().describe("Average monthly electricity bill in USD."),
      state: z.string().optional().describe("Two-letter US state code, e.g. CA."),
    }),
    execute: async ({ monthlyBill, state }) => {
      const pkg = getPackage(recommendPackageId(monthlyBill))!;
      const economics = computeEconomics(pkg, state);
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
      state: z.string().optional().describe("Two-letter US state code, e.g. CA."),
    }),
    execute: async ({ state }) => {
      const incentive = getStateIncentive(state);
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
      packageId: z.enum(PACKAGE_IDS).describe("The SunPath package to quote."),
      financingId: z
        .enum(FINANCING_IDS)
        .describe("Financing approach: cash, loan, or lease-ppa."),
      state: z.string().optional().describe("Two-letter US state code, e.g. CA."),
      customerName: z.string().optional().describe("Customer's first name, if known."),
    }),
    execute: async ({ packageId, financingId, state, customerName }) => {
      const pkg = getPackage(packageId)!;
      const economics = computeEconomics(pkg, state);
      const financing = FINANCING_OPTIONS.find((f) => f.id === financingId)!;
      const monthlyLoanEstimate =
        financingId === "loan" ? monthlyPayment(economics.netPrice, 0.0649, 25) : null;

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
      customerName: z.string().describe("Customer's name."),
      contact: z.string().describe("Email address or phone number."),
      preferredDate: z
        .string()
        .optional()
        .describe("Preferred date/time in the customer's words."),
      packageId: z.enum(PACKAGE_IDS).optional().describe("Package of interest, if chosen."),
    }),
    execute: async ({ customerName, contact, preferredDate, packageId }) => {
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
        .enum(["new", "qualified", "quoted", "booked", "disqualified"])
        .describe("Current pipeline stage."),
      customerName: z.string().optional().describe("Customer's name, if known."),
      score: z.number().optional().describe("Lead score from scoreLead, if available."),
      notes: z.string().optional().describe("Short summary of the interaction."),
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
