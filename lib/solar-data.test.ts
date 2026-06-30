/**
 * Unit tests for the SunPath economics engine (lib/solar-data.ts).
 *
 * These are the numbers Sunny quotes to homeowners, so they have to hold up.
 * Pure functions, no network — run with:  npm test
 * (node:test + tsx, zero extra dependencies).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PACKAGES,
  getPackage,
  FEDERAL_ITC,
  AVG_RATE_PER_KWH,
  STATE_INCENTIVES,
  DEFAULT_STATE_INCENTIVE,
  getStateIncentive,
  FINANCING_OPTIONS,
  OBJECTION_PLAYBOOK,
  matchObjection,
  DEFAULT_PEAK_SUN_HOURS,
  peakSunHours,
  annualUsageKwhFromBill,
  recommendPackageId,
  computeEconomics,
} from "./solar-data";

const round = (n: number) => Math.round(n);

/* ------------------------------------------------------------------ */
/* Catalog integrity                                                  */
/* ------------------------------------------------------------------ */

test("packages are ordered by ascending size — recommendPackageId relies on it", () => {
  for (let i = 1; i < PACKAGES.length; i++) {
    assert.ok(
      PACKAGES[i].sizeKw > PACKAGES[i - 1].sizeKw,
      `sizeKw must strictly increase (${PACKAGES[i - 1].id} -> ${PACKAGES[i].id})`,
    );
    assert.ok(
      PACKAGES[i].estAnnualKwh > PACKAGES[i - 1].estAnnualKwh,
      `estAnnualKwh must strictly increase (${PACKAGES[i - 1].id} -> ${PACKAGES[i].id})`,
    );
  }
});

test("package ids are unique and each has sane figures", () => {
  const ids = new Set<string>();
  for (const p of PACKAGES) {
    assert.ok(!ids.has(p.id), `duplicate package id: ${p.id}`);
    ids.add(p.id);
    assert.ok(p.grossPrice > 0, `${p.id} grossPrice > 0`);
    assert.ok(p.estAnnualKwh > 0, `${p.id} estAnnualKwh > 0`);
    assert.ok(p.panelCount > 0, `${p.id} panelCount > 0`);
    assert.ok(p.warrantyYears >= 25, `${p.id} warranty at least 25y`);
  }
});

test("getPackage returns the package by id, undefined otherwise", () => {
  assert.equal(getPackage("home")?.id, "home");
  assert.equal(getPackage("starter")?.name, "SunPath Starter");
  assert.equal(getPackage("does-not-exist"), undefined);
});

/* ------------------------------------------------------------------ */
/* Usage & sizing                                                     */
/* ------------------------------------------------------------------ */

test("annualUsageKwhFromBill inverts bill -> kWh at the blended rate", () => {
  // $160/mo at $0.16/kWh = 1,000 kWh/mo = 12,000 kWh/yr.
  assert.equal(annualUsageKwhFromBill(160), 12_000);
  assert.equal(annualUsageKwhFromBill(0), 0);
  // General identity: bill = annualUsage / 12 * rate.
  const bill = 215;
  assert.equal(annualUsageKwhFromBill(bill), (bill / AVG_RATE_PER_KWH) * 12);
});

test("recommendPackageId picks the smallest package that covers usage", () => {
  // Tiny bill -> smallest package.
  assert.equal(recommendPackageId(35), "starter");
  // Very large bill -> exceeds even the biggest, so the largest is returned.
  assert.equal(recommendPackageId(1_000), PACKAGES[PACKAGES.length - 1].id);

  // Monotonic: a higher bill never recommends a smaller system.
  const sizeOf = (id: string) => getPackage(id)!.sizeKw;
  let prev = 0;
  for (const bill of [20, 60, 100, 140, 180, 240, 320, 500]) {
    const size = sizeOf(recommendPackageId(bill));
    assert.ok(size >= prev, `bill $${bill} should not downsize (${prev} -> ${size})`);
    prev = size;
  }
});

/* ------------------------------------------------------------------ */
/* Incentives & sun hours                                             */
/* ------------------------------------------------------------------ */

test("getStateIncentive is case-insensitive and falls back to default", () => {
  assert.equal(getStateIncentive("ca").state, "CA");
  assert.equal(getStateIncentive("TX").state, "TX");
  assert.equal(getStateIncentive("zz"), DEFAULT_STATE_INCENTIVE);
  assert.equal(getStateIncentive(undefined), DEFAULT_STATE_INCENTIVE);
  // Every configured state carries a non-negative estimated value.
  for (const inc of Object.values(STATE_INCENTIVES)) {
    assert.ok(inc.estValue >= 0, `${inc.state} estValue >= 0`);
  }
});

test("peakSunHours is case-insensitive and falls back to the US average", () => {
  assert.equal(peakSunHours("az"), 6.5);
  assert.equal(peakSunHours("CA"), 5.5);
  assert.equal(peakSunHours(undefined), DEFAULT_PEAK_SUN_HOURS);
  assert.equal(peakSunHours("zz"), DEFAULT_PEAK_SUN_HOURS);
});

/* ------------------------------------------------------------------ */
/* Economics                                                          */
/* ------------------------------------------------------------------ */

test("computeEconomics: exact figures for the Home package in CA", () => {
  const e = computeEconomics(getPackage("home")!, "CA");
  assert.equal(e.grossPrice, 16_900);
  assert.equal(e.federalCredit, 5_070); // round(16900 * 0.30)
  assert.equal(e.stateIncentive, 1_500); // CA SGIP demo value
  assert.equal(e.netPrice, 16_900 - 5_070 - 1_500); // 10,330
  assert.equal(e.estAnnualSavings, round(9_100 * AVG_RATE_PER_KWH)); // 1,456
  assert.equal(e.paybackYears, 7.1); // round(10330/1456 * 10)/10
});

test("computeEconomics: no state -> only the federal credit applies", () => {
  const e = computeEconomics(getPackage("home")!, undefined);
  assert.equal(e.stateIncentive, 0);
  assert.equal(e.netPrice, 16_900 - 5_070);
});

test("computeEconomics: a state incentive lowers net price and shortens payback", () => {
  const pkg = getPackage("home-plus")!;
  const withState = computeEconomics(pkg, "NY"); // $4,000 incentive
  const without = computeEconomics(pkg, "zz"); // unknown -> $0
  assert.ok(withState.netPrice < without.netPrice);
  assert.ok(withState.paybackYears <= without.paybackYears);
});

test("computeEconomics: invariants hold for every package", () => {
  for (const pkg of PACKAGES) {
    const e = computeEconomics(pkg, "TX");
    assert.equal(e.federalCredit, round(pkg.grossPrice * FEDERAL_ITC), `${pkg.id} ITC`);
    assert.ok(e.netPrice > 0 && e.netPrice < e.grossPrice, `${pkg.id} 0 < net < gross`);
    assert.equal(
      e.estAnnualSavings,
      round(pkg.estAnnualKwh * AVG_RATE_PER_KWH),
      `${pkg.id} annual savings`,
    );
    assert.ok(e.paybackYears > 0 && Number.isFinite(e.paybackYears), `${pkg.id} payback finite`);
    // Every package in the catalog should pay for itself within the warranty window.
    assert.ok(e.paybackYears < pkg.warrantyYears, `${pkg.id} pays back before warranty ends`);
    // 25-year savings beat the simple (no-inflation) floor, since rates compound up.
    assert.ok(
      e.twentyFiveYearSavings > e.estAnnualSavings * 25 - e.netPrice,
      `${pkg.id} 25y savings exceed the no-inflation floor`,
    );
  }
});

/* ------------------------------------------------------------------ */
/* Financing & objection playbook                                     */
/* ------------------------------------------------------------------ */

test("financing options: only lease/PPA forfeits the ITC", () => {
  const byId = Object.fromEntries(FINANCING_OPTIONS.map((f) => [f.id, f]));
  assert.equal(byId["cash"].keepsItc, true);
  assert.equal(byId["loan"].keepsItc, true);
  assert.equal(byId["lease-ppa"].keepsItc, false);
});

test("matchObjection maps representative phrases to the right rebuttal", () => {
  assert.equal(matchObjection("honestly this is way too expensive")?.id, "too-expensive");
  assert.equal(matchObjection("how long until payback?")?.id, "payback-skeptic");
  assert.equal(matchObjection("will drilling damage my roof?")?.id, "roof-damage");
  assert.equal(matchObjection("we might be moving in a year")?.id, "moving-soon");
  assert.equal(matchObjection("the panels look ugly on the house")?.id, "aesthetics");
  assert.equal(matchObjection("what about cloudy winter days?")?.id, "cloudy-reliability");
  assert.equal(matchObjection("is there much maintenance involved?")?.id, "maintenance");
  // No trigger words -> no forced match.
  assert.equal(matchObjection("hi there, just browsing for now"), undefined);
});

test("objection playbook entries are well-formed", () => {
  const ids = new Set<string>();
  for (const o of OBJECTION_PLAYBOOK) {
    assert.ok(!ids.has(o.id), `duplicate objection id: ${o.id}`);
    ids.add(o.id);
    assert.ok(o.triggers.length > 0, `${o.id} has trigger words`);
    assert.ok(o.rebuttal.trim().length > 0, `${o.id} has a rebuttal`);
  }
});
