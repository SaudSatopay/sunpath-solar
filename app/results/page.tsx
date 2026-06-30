import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Bot, MessageSquare, Users, Target } from "lucide-react";
import { Atmosphere } from "@/components/atmosphere";
import { PERSONAS } from "@/eval/personas";

export const dynamic = "force-dynamic";

interface ArmReport {
  convQualifiedPct: number;
  falsePushPct: number;
  qualAccuracyPct: number;
  outcomes: { id: string; qualified: boolean; booked: boolean; turns: number }[];
}
interface Results {
  generatedAt: string;
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

        <h1 className="mt-6 font-display text-3xl text-cream">Conversion eval</h1>
        <p className="mt-1.5 max-w-lg text-[15px] leading-relaxed text-dim">
          Every lead in <code className="font-mono text-cream/80">eval/personas.ts</code> is
          played against two reps — Sunny (agentic, with tools) and a plain FAQ bot — using the
          same model and the same lead simulator. Only the rep differs.
        </p>

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
      <div className="glass rounded-[var(--radius-card)] p-6">
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
      <div className="glass rounded-[var(--radius-card)] p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-dim">
          <Target className="h-4 w-4 text-leaf" /> What we score
        </div>
        <ul className="mt-3 space-y-2.5 text-sm">
          <li>
            <span className="text-cream">Qualified-lead booking rate</span>{" "}
            <span className="text-faint">— the headline: % of good-fit leads that book a survey.</span>
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
      <div className="glass rounded-[var(--radius-card)] p-6">
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
      <div className="glass glass-sun mt-8 overflow-hidden rounded-[var(--radius-card)] p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-dim">
          <TrendingUp className="h-4 w-4 text-leaf" /> Qualified-lead booking lift
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-display text-5xl text-leaf">
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
          more genuinely-qualified homeowners booked a survey with Sunny than with the FAQ bot.
        </p>
      </div>

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

      {/* Per-persona dots */}
      <div className="glass mt-4 rounded-[var(--radius-card)] p-5">
        <div className="mb-3 text-xs uppercase tracking-[0.16em] text-dim">
          Per-lead outcome (Sunny)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.agentic.outcomes.map((o) => {
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
                title={`${o.id} — ${o.qualified ? "qualified" : "unqualified"}, ${o.booked ? "booked" : "no"}`}
                className="h-3 w-3 rounded-full ring-1 ring-inset ring-white/10"
                style={{ background: color, opacity: good ? 1 : 0.85 }}
              />
            );
          })}
        </div>
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
      className={`glass rounded-[var(--radius-card)] p-5 ${sunlit ? "glass-sun" : ""}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-cream">
        <span className="text-sun">{icon}</span>
        {title}
      </div>
      <div className="mt-4">
        <div className="font-display text-4xl text-cream">{report.convQualifiedPct}%</div>
        <div className="text-xs text-dim">of qualified leads booked</div>
      </div>
      <div className="mt-4 space-y-1.5 border-t border-line/40 pt-3 text-sm">
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

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
