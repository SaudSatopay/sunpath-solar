"use client";

import { motion } from "motion/react";
import {
  Gauge,
  Sun,
  Percent,
  FileText,
  CalendarCheck,
  Database,
  Check,
  Battery,
  Zap,
  TrendingUp,
  Wallet,
  Loader2,
  MapPin,
} from "lucide-react";
import { cn, usd, num } from "@/lib/utils";
import { TickerNumber } from "./ticker-number";
import type {
  LeadScoreResult,
  SystemRecResult,
  IncentivesResult,
  QuoteResult,
  BookingResult,
  CRMResult,
  LeadTier,
  ToolName,
} from "@/lib/tool-types";

/* Loose shape for an AI SDK tool UI part (avoids deep type imports). */
export type ToolPart = {
  type: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolCallId: string;
};

const FRIENDLY: Record<ToolName, string> = {
  scoreLead: "Qualifying lead",
  recommendSystem: "Sizing your system",
  lookupIncentives: "Checking incentives",
  generateQuote: "Preparing your quote",
  bookSurvey: "Booking your survey",
  logToCRM: "Updating CRM",
};

const ICONS: Record<ToolName, React.ComponentType<{ className?: string }>> = {
  scoreLead: Gauge,
  recommendSystem: Sun,
  lookupIncentives: Percent,
  generateQuote: FileText,
  bookSurvey: CalendarCheck,
  logToCRM: Database,
};

const enter = {
  initial: { opacity: 0, y: 12, scale: 0.98, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

/* Line-by-line assembly for the quote card. */
const cascade = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};
const cascadeItem = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

/* ------------------------------------------------------------------ */
/* Dispatcher                                                         */
/* ------------------------------------------------------------------ */
export function ToolCard({ part }: { part: ToolPart }) {
  const name = part.type.replace("tool-", "") as ToolName;

  if (part.state === "output-error") {
    return <ErrorCard name={name} text={part.errorText} />;
  }
  if (part.state !== "output-available" || part.output == null) {
    return <RunningCard name={name} />;
  }
  // "Needs info" signals steer the agent to ask a question — the reply text
  // carries it, so there's no card to render.
  if ((part.output as { needsInfo?: string }).needsInfo) {
    return null;
  }

  switch (name) {
    case "scoreLead":
      return <LeadScoreCard data={part.output as LeadScoreResult} />;
    case "recommendSystem":
      return <SystemRecCard data={part.output as SystemRecResult} />;
    case "lookupIncentives":
      return <IncentivesCard data={part.output as IncentivesResult} />;
    case "generateQuote":
      return <QuoteCard data={part.output as QuoteResult} />;
    case "bookSurvey":
      return <BookingCard data={part.output as BookingResult} />;
    case "logToCRM":
      return <CRMCard data={part.output as CRMResult} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Shell + primitives                                                 */
/* ------------------------------------------------------------------ */
function Shell({
  name,
  id,
  sunlit,
  children,
}: {
  name: ToolName;
  id?: string;
  sunlit?: boolean;
  children: React.ReactNode;
}) {
  const Icon = ICONS[name];
  return (
    <motion.div
      {...enter}
      className={cn(
        "glass sheen relative w-full max-w-[28rem] overflow-hidden rounded-[var(--radius-card)] p-4",
        sunlit && "glass-sun",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          sunlit ? "via-sun/50" : "via-cream/25",
        )}
      />
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-b from-dusk-600 to-dusk-800 text-sun ring-1 ring-inset ring-white/10">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-dim">
          {FRIENDLY[name]}
        </span>
        {id && (
          <span className="ml-auto rounded-md bg-dusk-800 px-2 py-0.5 font-mono text-[10px] text-faint">
            {id}
          </span>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "sun" | "leaf" | "cream";
}) {
  const color =
    accent === "leaf" ? "text-leaf" : accent === "sun" ? "text-sun-bright" : "text-cream";
  return (
    <div className="rounded-xl border border-line/50 bg-dusk-850/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className={cn("mt-0.5 font-display text-lg leading-tight", color)}>{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading / error                                                    */
/* ------------------------------------------------------------------ */
function RunningCard({ name }: { name: ToolName }) {
  return (
    <Shell name={name}>
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-sun" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-2/3 rounded-full" />
          <div className="skeleton h-3 w-1/3 rounded-full" />
        </div>
      </div>
    </Shell>
  );
}

function ErrorCard({ name, text }: { name: ToolName; text?: string }) {
  return (
    <Shell name={name}>
      <p className="text-sm text-ember">{text ?? "That step didn't complete. Let's try again."}</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Lead score                                                         */
/* ------------------------------------------------------------------ */
const TIER_META: Record<LeadTier, { color: string; label: string }> = {
  hot: { color: "var(--color-ember)", label: "Hot lead" },
  warm: { color: "var(--color-sun)", label: "Warm lead" },
  cool: { color: "var(--color-sky)", label: "Worth nurturing" },
  unqualified: { color: "var(--color-faint)", label: "Not a fit yet" },
};

function ScoreRing({ value, color }: { value: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <div
      className="relative h-[90px] w-[90px] shrink-0"
      style={{ filter: `drop-shadow(0 0 9px color-mix(in oklab, ${color} 40%, transparent))` }}
    >
      <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-dusk-700)" strokeWidth="6" />
        <motion.circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-2xl leading-none text-cream">
            <TickerNumber value={value} duration={1.1} delay={0.15} />
          </div>
          <div className="text-[9px] uppercase tracking-wider text-faint">/ 100</div>
        </div>
      </div>
    </div>
  );
}

function LeadScoreCard({ data }: { data: LeadScoreResult }) {
  const meta = TIER_META[data.tier];
  return (
    <Shell name="scoreLead">
      <div className="flex items-center gap-4">
        <ScoreRing value={data.score} color={meta.color} />
        <div className="min-w-0 flex-1">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              color: meta.color,
              background: `color-mix(in oklab, ${meta.color} 16%, transparent)`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
            {meta.label}
          </span>
          <p className="mt-2 text-sm leading-snug text-cream/85">{data.rationale}</p>
        </div>
      </div>
      {data.missing.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/40 pt-3">
          <span className="text-[10px] uppercase tracking-wider text-faint">Still need</span>
          {data.missing.map((m) => (
            <span
              key={m}
              className="rounded-md bg-dusk-800 px-2 py-0.5 text-[11px] text-dim"
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* System recommendation                                              */
/* ------------------------------------------------------------------ */
function SystemRecCard({ data }: { data: SystemRecResult }) {
  const { package: pkg, economics: e } = data;
  return (
    <Shell name="recommendSystem">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-xl text-cream">{pkg.name}</h3>
        <span className="text-sm text-sun-bright">{pkg.sizeKw} kW</span>
      </div>
      <p className="mt-0.5 text-sm text-dim">{data.tagline}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-cream/80">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-sun" /> {pkg.panelCount} panels
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Battery className="h-3.5 w-3.5 text-sun" />
          {pkg.batteryKwh ? `${pkg.batteryKwh} kWh battery` : "No battery"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sun className="h-3.5 w-3.5 text-sun" /> ~{num(pkg.estAnnualKwh)} kWh/yr
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Net price" value={usd(e.netPrice)} accent="cream" />
        <Stat label="Payback" value={`${e.paybackYears} yrs`} accent="sun" />
        <Stat label="Yr 1 savings" value={usd(e.estAnnualSavings)} accent="leaf" />
      </div>

      <p className="mt-2.5 text-[11px] text-faint">
        After the {usd(e.federalCredit)} federal credit
        {e.stateIncentive > 0 ? ` + ${usd(e.stateIncentive)} state incentive` : ""}.
      </p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Incentives                                                         */
/* ------------------------------------------------------------------ */
function IncentivesCard({ data }: { data: IncentivesResult }) {
  return (
    <Shell name="lookupIncentives">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sun to-ember">
          <span className="font-display text-lg font-semibold text-dusk-950">
            {data.federalPct}%
          </span>
        </div>
        <div>
          <div className="text-sm font-medium text-cream">{data.federalLabel}</div>
          <div className="text-xs text-dim">Applied to your full system cost, nationwide.</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-line/50 bg-dusk-850/60 p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-sun-bright">
          <MapPin className="h-3.5 w-3.5" /> {data.state.label}
        </div>
        <p className="mt-1 text-sm leading-snug text-cream/85">{data.state.summary}</p>
        {data.state.estValue > 0 && (
          <p className="mt-1.5 text-xs text-leaf">
            Est. extra value ~{usd(data.state.estValue)}
          </p>
        )}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Quote                                                              */
/* ------------------------------------------------------------------ */
function QuoteCard({ data }: { data: QuoteResult }) {
  const e = data.economics;
  return (
    <Shell name="generateQuote" id={data.quoteId} sunlit>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-xl text-cream">
          {data.package.name}
          {data.customerName ? (
            <span className="text-dim"> · for {data.customerName}</span>
          ) : null}
        </h3>
      </div>

      {/* price waterfall — assembles line by line */}
      <motion.div variants={cascade} initial="hidden" animate="show">
        <div className="mt-3 space-y-1.5 text-sm">
          <Row label="System price" value={usd(e.grossPrice)} />
          <Row label={`Federal credit (30%)`} value={`– ${usd(e.federalCredit)}`} muted />
          {e.stateIncentive > 0 && (
            <Row label="State incentive" value={`– ${usd(e.stateIncentive)}`} muted />
          )}
          <motion.div
            variants={cascadeItem}
            className="!mt-2 flex items-center justify-between border-t border-line/50 pt-2"
          >
            <span className="text-sm text-dim">Net cost</span>
            <span className="font-display text-xl text-cream">{usd(e.netPrice)}</span>
          </motion.div>
        </div>

        {/* financing + monthly */}
        <motion.div
          variants={cascadeItem}
          className="mt-3 flex items-center gap-2 rounded-xl border border-line/50 bg-dusk-850/60 px-3 py-2"
        >
          <Wallet className="h-4 w-4 text-sun" />
          <div className="flex-1">
            <div className="text-xs font-medium text-cream">{data.financing.label}</div>
            <div className="text-[11px] text-dim">{data.financing.blurb}</div>
          </div>
          {data.monthlyLoanEstimate != null && (
            <div className="text-right">
              <div className="font-display text-base text-sun-bright">
                {usd(data.monthlyLoanEstimate)}
              </div>
              <div className="text-[10px] text-faint">/ mo est.</div>
            </div>
          )}
        </motion.div>

        {/* hero: lifetime savings — the number arrives like a reveal */}
        <motion.div
          variants={cascadeItem}
          className="mt-3 flex items-center justify-between rounded-xl bg-gradient-to-r from-leaf/15 to-transparent px-3 py-2.5"
        >
          <span className="inline-flex items-center gap-1.5 text-xs text-cream/80">
            <TrendingUp className="h-4 w-4 text-leaf" /> 25-year net savings
          </span>
          <span className="font-display text-2xl text-leaf drop-shadow-[0_0_14px_rgba(116,215,154,0.35)]">
            <TickerNumber
              value={e.twentyFiveYearSavings}
              format={(n) => usd(Math.round(n))}
              duration={1.3}
              delay={0.45}
            />
          </span>
        </motion.div>
      </motion.div>

      <p className="mt-2.5 text-[11px] text-faint">
        Estimate valid {data.validDays} days · {data.warrantyYears}-yr warranty · final numbers
        confirmed at the on-site survey.
      </p>
    </Shell>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <motion.div variants={cascadeItem} className="flex items-center justify-between">
      <span className="text-dim">{label}</span>
      <span className={cn("tabular-nums", muted ? "text-leaf" : "text-cream")}>{value}</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Booking                                                            */
/* ------------------------------------------------------------------ */
function BookingCard({ data }: { data: BookingResult }) {
  return (
    <Shell name="bookSurvey" id={data.surveyId} sunlit>
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.1 }}
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-leaf/20 text-leaf"
        >
          {/* one celebratory ring, then gone */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full ring-2 ring-leaf/50"
            style={{ animation: "ringBurst 0.9s ease-out 0.3s both" }}
          />
          <Check className="h-5 w-5" strokeWidth={2.5} />
        </motion.div>
        <div>
          <div className="font-display text-lg text-cream">Survey booked</div>
          <div className="text-sm text-dim">
            {data.customerName} · {data.scheduled}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-line/50 bg-dusk-850/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-faint">Contact</div>
          <div className="mt-0.5 truncate text-cream/90">{data.contact}</div>
        </div>
        <div className="rounded-xl border border-line/50 bg-dusk-850/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-faint">System</div>
          <div className="mt-0.5 truncate text-cream/90">{data.package?.name ?? "TBD at survey"}</div>
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* CRM log (minimal, system-styled)                                   */
/* ------------------------------------------------------------------ */
function CRMCard({ data }: { data: CRMResult }) {
  return (
    <motion.div
      {...enter}
      className="flex w-full max-w-[28rem] items-center gap-2 rounded-xl border border-line/40 bg-dusk-850/50 px-3 py-2 font-mono text-[11px] text-faint"
    >
      <Database className="h-3.5 w-3.5 text-dim" />
      <span className="text-dim">crm</span>
      <span className="text-cream/70">{data.crmId}</span>
      <span className="ml-auto rounded bg-dusk-800 px-1.5 py-0.5 text-sun/80">{data.stage}</span>
    </motion.div>
  );
}
