import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Bot, MessageSquare, Users, Target } from "lucide-react";
import { Atmosphere } from "@/components/atmosphere";
import { PERSONAS } from "@/eval/personas";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conversion eval — SunPath Solar",
  description:
    "A controlled A/B: Sunny (agentic) vs a plain FAQ bot, scored on completed bookings — not stated willingness.",
};

interface ArmReport {
  convQualifiedPct: number;
  /** Stated willingness ([BOOKED] token) — the v1 metric, reported for contrast. */
  willingQualifiedPct?: number;
  falsePushPct: number;
  qualAccuracyPct: number;
  outcomes: { id: string; qualified: boolean; booked: boolean; willing?: boolean; turns: number }[];
}
interface Results {
  generatedAt: string;
  metric?: string;
  agentModel: string;
  leadModel: string;
  personasCount: number;
  qualifiedCount: number;
  agentic: ArmReport;
  baseline: ArmReport;
  liftPoints: number;
  relativeLiftPct: number | null;
}

async function loadResults(): Promise<Results | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "eval", "results.json"), "utf8");
    return JSON.parse(raw) as Results;
  } catch {
    return null;
  }
}

export default async function ResultsPage() {
  const data = await loadResults();

  return (
    <main className="relative min-h-dvh">
      <Atmosphere />
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-dim transition-colors hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sunny
        </Link>

        <h1 className="mt-6 font-display text-3xl text-cream">
          Conversion <span className="text-gradient-sun italic">eval</span>
        </h1>
        <p className="mt-1.5 max-w-lg text-[15px] leading-relaxed text-dim">
          Every lead in <code className="font-mono text-cream/80">eval/personas.ts</code> is
          played against two reps — Sunny (agentic, with tools) and a plain FAQ bot — using the
          same model and the same lead simulator. Only the rep differs.
        </p>
        <div aria-hidden className="flare-line mt-6 opacity-50" />

        {data ? <Report data={data} /> : <EmptyState />}
      </div>
    </main>
  );
}

function EmptyState() {
  const total = PERSONAS.length;
  const qualified = PERSONAS.filter((p) => p.qualified).length;
  return (
    <div className="mt-8 space-y-4">
      {/* Methodology — the rigor lands even before numbers exist */}
      <div className="glass sheen relative rounded-[var(--radius-card)] p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-dim">
          <Users className="h-4 w-4 text-sun" /> The test
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-cream/85">
          <span className="text-cream">{total} simulated homeowners</span> — {qualified}{" "}
          genuinely qualified and {total - qualified} not a fit (renters, tiny bills, accidental
          visitors) — each hold a full chat with two reps. Both run on the{" "}
          <span className="text-cream/95">same model</span> and the same decision protocol; the
          only variable is the rep.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-sun/25 bg-dusk-850/60 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-cream">
              <Bot className="h-4 w-4 text-sun" /> Sunny — agentic
            </div>
            <p className="mt-1 text-xs leading-relaxed text-dim">
              Full agent: qualifies, sizes, quotes, and books via 6 tools and multi-step
              reasoning.
            </p>
          </div>
          <div className="rounded-xl border border-line/50 bg-dusk-850/60 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-cream">
              <MessageSquare className="h-4 w-4 text-dim" /> Baseline — FAQ bot
            </div>
            <p className="mt-1 text-xs leading-relaxed text-dim">
              Same model, no tools or methodology — it just answers questions politely.
            </p>
          </div>
        </div>
      </div>

      {/* What's scored */}
      <div className="glass sheen relative rounded-[var(--radius-card)] p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-dim">
          <Target className="h-4 w-4 text-leaf" /> What we score
        </div>
        <ul className="mt-3 space-y-2.5 text-sm">
          <li>
            <span className="text-cream">Completed bookings</span>{" "}
            <span className="text-faint">
              — the headline: % of good-fit leads whose survey was <em>actually scheduled</em>{" "}
              (Sunny: a verified bookSurvey call; FAQ bot: agreement + contact captured). Stated
              willingness is reported alongside — it saturates.
            </span>
          </li>
          <li>
            <span className="text-cream">False-push rate</span>{" "}
            <span className="text-faint">— % of unfit leads wrongly pushed to book. Lower is better; honesty matters.</span>
          </li>
          <li>
            <span className="text-cream">Qualification accuracy</span>{" "}
            <span className="text-faint">— how often the rep&apos;s book/pass decision matches ground truth.</span>
          </li>
        </ul>
      </div>

      {/* Run it */}
      <div className="glass sheen relative rounded-[var(--radius-card)] p-6">
        <p className="text-cream/90">No results yet.</p>
        <p className="mt-2 text-sm text-dim">
          Add an API key to <code className="font-mono text-cream/80">.env.local</code>, then
          generate the numbers (the run is resumable — finished conversations are cached):
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-line/50 bg-dusk-950/70 px-4 py-3 font-mono text-sm text-sun-bright">
          npm run eval
        </pre>
      </div>
    </div>
  );
}

function Report({ data }: { data: Results }) {
  const lift = data.liftPoints;
  return (
    <>
      {/* Hero lift */}
      <div className="glass glass-sun sheen relative mt-8 overflow-hidden rounded-[var(--radius-card)] p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-leaf/15 blur-3xl"
        />
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-dim">
          <TrendingUp className="h-4 w-4 text-leaf" /> Completed-booking lift · qualified leads
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-display text-5xl text-leaf drop-shadow-[0_0_24px_rgba(116,215,154,0.35)]">
            {lift >= 0 ? "+" : ""}
            {lift} pts
          </span>
          {data.relativeLiftPct != null && (
            <span className="text-lg text-cream/70">
              ({data.relativeLiftPct >= 0 ? "+" : ""}
              {data.relativeLiftPct}% relative)
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-dim">
          more genuinely-qualified homeowners had a survey <em>actually scheduled</em> with Sunny
          than with the FAQ bot — appointment created, contact captured.
        </p>
      </div>

      {/* Why the naive metric isn't the headline */}
      {data.agentic.willingQualifiedPct != null && data.baseline.willingQualifiedPct != null && (
        <div className="glass sheen relative mt-4 rounded-[var(--radius-card)] p-5">
          <div className="mb-2 text-xs uppercase tracking-[0.16em] text-dim">
            Why not &ldquo;willingness&rdquo;?
          </div>
          <p className="text-sm leading-relaxed text-cream/85">
            Asked only &ldquo;would you book?&rdquo;, leads say yes to any polite rep —{" "}
            <span className="text-cream">{data.baseline.willingQualifiedPct}%</span> for the FAQ
            bot vs <span className="text-cream">{data.agentic.willingQualifiedPct}%</span> for
            Sunny. But willingness isn&apos;t a conversion: the headline above counts bookings
            that <em>exist</em> — a scheduled survey with a name and contact attached.
          </p>
        </div>
      )}

      {/* Two arms */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ArmCard
          title="Sunny — agentic"
          icon={<Bot className="h-4 w-4" />}
          sunlit
          report={data.agentic}
        />
        <ArmCard
          title="Baseline — FAQ bot"
          icon={<MessageSquare className="h-4 w-4" />}
          report={data.baseline}
        />
      </div>

      {/* Per-persona dots — both arms, same leads */}
      <div className="glass sheen relative mt-4 rounded-[var(--radius-card)] p-5">
        <div className="mb-3 text-xs uppercase tracking-[0.16em] text-dim">
          Per-lead outcomes · same 16 leads, both reps
        </div>
        <DotRow label="Sunny" outcomes={data.agentic.outcomes} />
        <DotRow label="FAQ bot" outcomes={data.baseline.outcomes} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
          <Legend color="var(--color-leaf)" label="booked a qualified lead" />
          <Legend color="var(--color-faint)" label="correctly passed on an unfit lead" />
          <Legend color="var(--color-sun)" label="missed a qualified lead" />
          <Legend color="var(--color-ember)" label="pushed an unfit lead" />
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] text-faint">
        {data.personasCount} simulated leads ({data.qualifiedCount} qualified) ·{" "}
        {data.agentModel} vs {data.leadModel} lead sim · generated{" "}
        {new Date(data.generatedAt).toLocaleString()}
      </p>
    </>
  );
}

function ArmCard({
  title,
  icon,
  report,
  sunlit,
}: {
  title: string;
  icon: React.ReactNode;
  report: ArmReport;
  sunlit?: boolean;
}) {
  return (
    <div
      className={`glass sheen relative rounded-[var(--radius-card)] p-5 ${sunlit ? "glass-sun" : ""}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-cream">
        <span className="text-sun">{icon}</span>
        {title}
      </div>
      <div className="mt-4">
        <div className="font-display text-4xl text-cream">{report.convQualifiedPct}%</div>
        <div className="text-xs text-dim">of qualified leads — survey actually scheduled</div>
      </div>
      <div className="mt-4 space-y-1.5 border-t border-line/40 pt-3 text-sm">
        {report.willingQualifiedPct != null && (
          <div className="flex justify-between">
            <span className="text-dim">Stated willingness</span>
            <span className="text-cream/70">{report.willingQualifiedPct}%</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-dim">Qualification accuracy</span>
          <span className="text-cream">{report.qualAccuracyPct}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-dim">Pushed unfit leads</span>
          <span className={report.falsePushPct > 0 ? "text-ember" : "text-leaf"}>
            {report.falsePushPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

function DotRow({
  label,
  outcomes,
}: {
  label: string;
  outcomes: ArmReport["outcomes"];
}) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="w-14 shrink-0 text-[11px] text-dim">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {outcomes.map((o, i) => {
          const good = o.booked === o.qualified;
          const color = !o.qualified
            ? o.booked
              ? "var(--color-ember)" /* pushed an unfit lead — bad */
              : "var(--color-faint)" /* correctly passed */
            : o.booked
              ? "var(--color-leaf)" /* booked a good lead — win */
              : "var(--color-sun)"; /* missed a good lead */
          return (
            <span
              key={o.id}
              title={`${o.id} — ${o.qualified ? "qualified" : "unqualified"}, ${o.booked ? "booked" : o.willing ? "willing, never scheduled" : "no"}`}
              className="anim-rise h-3 w-3 rounded-full ring-1 ring-inset ring-white/10"
              style={{ background: color, opacity: good ? 1 : 0.85, animationDelay: `${i * 40}ms` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
