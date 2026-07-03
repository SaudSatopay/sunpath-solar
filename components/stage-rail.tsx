"use client";

import { cn } from "@/lib/utils";

const STAGES = ["Qualify", "Design", "Quote", "Book"] as const;

/** `stage` is the index of the furthest reached step (-1 = none yet). */
export function StageRail({ stage }: { stage: number }) {
  return (
    <div className="flex items-center">
      {STAGES.map((label, i) => {
        const done = i <= stage;
        const active = i === stage;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-all duration-500",
                  done ? "bg-gradient-to-br from-sun-bright to-ember" : "bg-dusk-600",
                )}
                style={active ? { animation: "dotPulse 2.4s ease-in-out infinite" } : undefined}
              />
              <span
                className={cn(
                  "text-[11px] tracking-wide transition-colors duration-500",
                  active ? "text-sun-bright" : done ? "text-cream/90" : "text-faint",
                )}
              >
                {label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <span
                className={cn(
                  "mx-2 h-px w-5 transition-colors duration-500",
                  i < stage ? "bg-gradient-to-r from-sun/60 to-ember/40" : "bg-dusk-600",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
