/**
 * UI-facing types mirroring the `execute` return shapes in lib/tools.ts.
 * Keep these in sync with the tool definitions — the generative cards rely on them.
 */

export interface PackageSummary {
  id: string;
  name: string;
  sizeKw: number;
  panelCount: number;
  batteryKwh: number | null;
  estAnnualKwh: number;
}

export interface EconomicsResult {
  grossPrice: number;
  federalCredit: number;
  stateIncentive: number;
  netPrice: number;
  estAnnualSavings: number;
  paybackYears: number;
  twentyFiveYearSavings: number;
}

export type LeadTier = "hot" | "warm" | "cool" | "unqualified";

export interface LeadScoreResult {
  score: number;
  tier: LeadTier;
  qualified: boolean;
  missing: string[];
  rationale: string;
}

export interface SystemRecResult {
  package: PackageSummary;
  tagline: string;
  economics: EconomicsResult;
  state: string | null;
}

export interface IncentivesResult {
  federalPct: number;
  federalLabel: string;
  state: { label: string; summary: string; estValue: number };
}

export interface QuoteResult {
  quoteId: string;
  customerName: string | null;
  package: PackageSummary;
  warrantyYears: number;
  economics: EconomicsResult;
  financing: { id: string; label: string; blurb: string };
  monthlyLoanEstimate: number | null;
  validDays: number;
}

export interface BookingResult {
  surveyId: string;
  customerName: string;
  contact: string;
  scheduled: string;
  package: PackageSummary | null;
  status: string;
}

export interface CRMResult {
  crmId: string;
  stage: string;
  customerName: string | null;
  score: number | null;
  notes: string | null;
  status: string;
}

/** The tool names exposed to the model — used as `tool-<name>` UI part types. */
export type ToolName =
  | "scoreLead"
  | "recommendSystem"
  | "lookupIncentives"
  | "generateQuote"
  | "bookSurvey"
  | "logToCRM";
