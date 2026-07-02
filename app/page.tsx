import { readFile } from "node:fs/promises";
import path from "node:path";
import { Atmosphere } from "@/components/atmosphere";
import { Chat } from "@/components/chat";

/**
 * Measured conversion lift from the committed eval results, if a run has
 * completed. Read at build time (this page is static), so the footer badge
 * only ever shows a real, reproducible number.
 */
async function measuredLift(): Promise<number | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "eval", "results.json"), "utf8");
    const data = JSON.parse(raw) as { liftPoints?: unknown };
    return typeof data.liftPoints === "number" ? data.liftPoints : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const lift = await measuredLift();
  return (
    <main className="relative">
      <Atmosphere />
      <Chat lift={lift} />
    </main>
  );
}
