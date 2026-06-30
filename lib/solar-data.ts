/**
 * SunPath Solar — domain knowledge base.
 *
 * Fictional residential solar installer used to ground the agentic sales bot.
 * All figures are realistic US-market ballparks (2026) so the demo's economics
 * hold up to scrutiny, but the company and catalog are invented.
 */

export type RoofType = "asphalt-shingle" | "metal" | "tile" | "flat" | "unsure";
export type FinancingId = "cash" | "loan" | "lease-ppa";

/* ------------------------------------------------------------------ */
/* Catalog                                                            */
/* ------------------------------------------------------------------ */

export interface SolarPackage {
  id: string;
  name: string;
  tagline: string;
  sizeKw: number;
  panelCount: number;
  panelModel: string;
  inverter: string;
  batteryKwh: number | null;
  /** Estimated production in a region with ~1,400 kWh/kW/yr. */
  estAnnualKwh: number;
  /** Gross system price before any incentives, USD. */
  grossPrice: number;
  warrantyYears: number;
  bestFor: string;
}

/** ~1,400 kWh per kW per year is a defensible national-average yield. */
export const YIELD_KWH_PER_KW = 1_400;

export const PACKAGES: SolarPackage[] = [
  {
    id: "starter",
    name: "SunPath Starter",
    tagline: "Right-sized for smaller homes and modest bills.",
    sizeKw: 4.0,
    panelCount: 10,
    panelModel: "SunPath 400W monocrystalline",
    inverter: "Enphase IQ8 microinverters",
    batteryKwh: null,
    estAnnualKwh: 5_600,
    grossPrice: 10_400,
    warrantyYears: 25,
    bestFor: "Bills under ~$120/mo, 1–2 occupants, no EV.",
  },
  {
    id: "home",
    name: "SunPath Home",
    tagline: "Our most popular system — covers a typical family's usage.",
    sizeKw: 6.5,
    panelCount: 16,
    panelModel: "SunPath 400W monocrystalline",
    inverter: "Enphase IQ8 microinverters",
    batteryKwh: null,
    estAnnualKwh: 9_100,
    grossPrice: 16_900,
    warrantyYears: 25,
    bestFor: "Bills ~$120–$220/mo, 3–4 occupants.",
  },
  {
    id: "home-plus",
    name: "SunPath Home+ Battery",
    tagline: "Daytime solar plus overnight and outage backup.",
    sizeKw: 8.0,
    panelCount: 20,
    panelModel: "SunPath 400W monocrystalline",
    inverter: "Enphase IQ8 + IQ Battery",
    batteryKwh: 13.5,
    estAnnualKwh: 11_200,
    grossPrice: 28_000,
    warrantyYears: 25,
    bestFor: "Bills ~$220–$320/mo, outage resilience, time-of-use rates.",
  },
  {
    id: "whole-home",
    name: "SunPath Whole-Home",
    tagline: "Maximum offset for large homes, EVs, and electrification.",
    sizeKw: 11.0,
    panelCount: 27,
    panelModel: "SunPath 400W monocrystalline",
    inverter: "Enphase IQ8 + IQ Battery",
    batteryKwh: 13.5,
    estAnnualKwh: 15_400,
    grossPrice: 36_000,
    warrantyYears: 25,
    bestFor: "Bills over ~$320/mo, EV charging, all-electric homes.",
  },
];

export function getPackage(id: string): SolarPackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}

/* ------------------------------------------------------------------ */
/* Incentives                                                         */
/* ------------------------------------------------------------------ */

/** Federal Residential Clean Energy Credit (ITC): 30% of system cost. */
export const FEDERAL_ITC = 0.3;

export interface StateIncentive {
  state: string;
  label: string;
  summary: string;
  /** Rough additional incentive value used for demo estimates, USD. */
  estValue: number;
}

export const STATE_INCENTIVES: Record<string, StateIncentive> = {
  CA: {
    state: "CA",
    label: "California",
    summary: "SGIP battery rebate + net billing (NEM 3.0); strong battery economics.",
    estValue: 1_500,
  },
  TX: {
    state: "TX",
    label: "Texas",
    summary: "No state income tax; utility/co-op rebates (e.g. Oncor) and high summer offset.",
    estValue: 1_200,
  },
  NY: {
    state: "NY",
    label: "New York",
    summary: "NY-Sun incentive + 25% state tax credit (capped at $5,000).",
    estValue: 4_000,
  },
  AZ: {
    state: "AZ",
    label: "Arizona",
    summary: "25% state tax credit (capped at $1,000) + abundant sun hours.",
    estValue: 1_000,
  },
  FL: {
    state: "FL",
    label: "Florida",
    summary: "Sales-tax & property-tax exemptions on solar; strong year-round production.",
    estValue: 900,
  },
  MA: {
    state: "MA",
    label: "Massachusetts",
    summary: "SMART program production payments + $1,000 state tax credit.",
    estValue: 3_000,
  },
};

export const DEFAULT_STATE_INCENTIVE: StateIncentive = {
  state: "US",
  label: "your state",
  summary: "Federal ITC applies nationwide; many areas add local utility rebates.",
  estValue: 0,
};

export function getStateIncentive(state?: string): StateIncentive {
  if (!state) return DEFAULT_STATE_INCENTIVE;
  return STATE_INCENTIVES[state.toUpperCase()] ?? DEFAULT_STATE_INCENTIVE;
}

/* ------------------------------------------------------------------ */
/* Financing                                                          */
/* ------------------------------------------------------------------ */

export interface FinancingOption {
  id: FinancingId;
  label: string;
  blurb: string;
  /** Whether the homeowner keeps the federal ITC. */
  keepsItc: boolean;
}

export const FINANCING_OPTIONS: FinancingOption[] = [
  {
    id: "cash",
    label: "Cash purchase",
    blurb: "Lowest lifetime cost and fastest payback; you claim the full 30% ITC.",
    keepsItc: true,
  },
  {
    id: "loan",
    label: "$0-down solar loan",
    blurb: "Typical 6.49% APR over 25 yrs; payment often below your old bill. You claim the ITC.",
    keepsItc: true,
  },
  {
    id: "lease-ppa",
    label: "Lease / PPA",
    blurb: "No upfront cost, but the provider keeps the ITC and lifetime savings are smaller.",
    keepsItc: false,
  },
];

/* ------------------------------------------------------------------ */
/* Objection-handling playbook (RAG-style grounding)                  */
/* ------------------------------------------------------------------ */

export interface Objection {
  id: string;
  /** Keywords that hint the lead is raising this objection. */
  triggers: string[];
  /** Grounded rebuttal the agent should adapt — never invent numbers beyond these. */
  rebuttal: string;
}

export const OBJECTION_PLAYBOOK: Objection[] = [
  {
    id: "too-expensive",
    triggers: ["expensive", "cost", "afford", "price", "too much", "cheaper"],
    rebuttal:
      "The 30% federal ITC plus any state incentive cuts the sticker price right away, and with a $0-down loan the monthly payment is usually at or below the utility bill it replaces — so it can be cash-flow positive from month one.",
  },
  {
    id: "payback-skeptic",
    triggers: ["payback", "worth it", "roi", "break even", "return", "how long"],
    rebuttal:
      "Most SunPath homeowners see a 7–10 year payback, then 15+ years of near-free power against utility rates that have risen ~4%/yr. The 25-year warranty outlasts the payback by more than a decade.",
  },
  {
    id: "roof-damage",
    triggers: ["roof", "leak", "damage", "holes", "warranty void"],
    rebuttal:
      "Mounts are flashed and sealed to roofing standards and backed by our workmanship warranty. If your roof is near end-of-life we'll flag it during the survey — re-roofing first is cheaper than removing panels later.",
  },
  {
    id: "moving-soon",
    triggers: ["moving", "sell", "selling", "move", "not staying"],
    rebuttal:
      "Owned solar typically raises home value by around 4% and homes with solar tend to sell faster, so you usually recover the investment at sale even if you move before full payback.",
  },
  {
    id: "aesthetics",
    triggers: ["ugly", "look", "appearance", "hoa", "aesthetic", "panels look"],
    rebuttal:
      "We use all-black panels with hidden framing and can lay out the array to favor less-visible roof faces. We also handle HOA solar-access paperwork, which most states protect by law.",
  },
  {
    id: "cloudy-reliability",
    triggers: ["cloudy", "rain", "winter", "night", "snow", "reliable", "weather"],
    rebuttal:
      "Systems are sized against your annual usage, so sunny months bank credits that cover cloudy ones via net metering. Adding a battery covers nights and outages directly.",
  },
  {
    id: "maintenance",
    triggers: ["maintenance", "clean", "upkeep", "break", "repair"],
    rebuttal:
      "Panels have no moving parts; rain handles most cleaning. Microinverters carry a 25-year warranty and the app flags any underperforming panel automatically, so upkeep is minimal.",
  },
];

export function matchObjection(text: string): Objection | undefined {
  const lower = text.toLowerCase();
  return OBJECTION_PLAYBOOK.find((o) => o.triggers.some((t) => lower.includes(t)));
}

/* ------------------------------------------------------------------ */
/* Sizing & economics helpers                                         */
/* ------------------------------------------------------------------ */

/** Peak sun hours per day by state (used for sizing); falls back to a US average. */
const PEAK_SUN_HOURS: Record<string, number> = {
  CA: 5.5,
  TX: 5.0,
  NY: 4.0,
  AZ: 6.5,
  FL: 5.3,
  MA: 4.2,
};
export const DEFAULT_PEAK_SUN_HOURS = 4.5;

export function peakSunHours(state?: string): number {
  if (!state) return DEFAULT_PEAK_SUN_HOURS;
  return PEAK_SUN_HOURS[state.toUpperCase()] ?? DEFAULT_PEAK_SUN_HOURS;
}

/** Blended residential electricity rate, USD per kWh (national-ish). */
export const AVG_RATE_PER_KWH = 0.16;
/** Assumed utility rate inflation, used for lifetime-savings framing. */
export const RATE_INFLATION = 0.04;

export function annualUsageKwhFromBill(monthlyBill: number): number {
  return (monthlyBill / AVG_RATE_PER_KWH) * 12;
}

/** Pick the smallest package whose annual production meets ~100% of usage. */
export function recommendPackageId(monthlyBill: number): string {
  const targetKwh = annualUsageKwhFromBill(monthlyBill);
  const fit = PACKAGES.find((p) => p.estAnnualKwh >= targetKwh * 0.95);
  return (fit ?? PACKAGES[PACKAGES.length - 1]).id;
}

export interface Economics {
  grossPrice: number;
  federalCredit: number;
  stateIncentive: number;
  netPrice: number;
  estAnnualSavings: number;
  paybackYears: number;
  twentyFiveYearSavings: number;
}

export function computeEconomics(pkg: SolarPackage, state?: string): Economics {
  const incentive = getStateIncentive(state);
  const federalCredit = Math.round(pkg.grossPrice * FEDERAL_ITC);
  const netPrice = pkg.grossPrice - federalCredit - incentive.estValue;

  // Savings = production offset valued at the local rate (capped at usage value).
  const estAnnualSavings = Math.round(pkg.estAnnualKwh * AVG_RATE_PER_KWH);
  const paybackYears = Math.round((netPrice / estAnnualSavings) * 10) / 10;

  // 25-yr savings with simple rate inflation, minus net price.
  let cumulative = 0;
  for (let y = 0; y < 25; y++) {
    cumulative += estAnnualSavings * Math.pow(1 + RATE_INFLATION, y);
  }
  const twentyFiveYearSavings = Math.round(cumulative - netPrice);

  return {
    grossPrice: pkg.grossPrice,
    federalCredit,
    stateIncentive: incentive.estValue,
    netPrice,
    estAnnualSavings,
    paybackYears,
    twentyFiveYearSavings,
  };
}
