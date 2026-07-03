"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";

/**
 * Animated count-up for the numbers that matter (lead score, savings).
 * Renders the formatted zero-state, then sweeps to `value` on mount.
 * Honors prefers-reduced-motion by rendering the final value directly.
 */
export function TickerNumber({
  value,
  format = (n: number) => String(Math.round(n)),
  duration = 1.1,
  delay = 0.2,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  delay?: number;
}) {
  const mv = useMotionValue(0);
  const ref = useRef<HTMLSpanElement>(null);
  // Keep the latest formatter without retriggering the animation on re-renders
  // (parents re-render on every streamed token).
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      if (ref.current) ref.current.textContent = formatRef.current(value);
      return;
    }
    const unsubscribe = mv.on("change", (v) => {
      if (ref.current) ref.current.textContent = formatRef.current(v);
    });
    const controls = animate(mv, value, { duration, delay, ease: [0.22, 1, 0.36, 1] });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, duration, delay, reduced, mv]);

  return <span ref={ref}>{format(reduced ? value : 0)}</span>;
}
