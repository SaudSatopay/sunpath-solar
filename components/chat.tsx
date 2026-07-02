"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { ArrowUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolCard, type ToolPart } from "./tool-cards";
import { StageRail } from "./stage-rail";

const SUGGESTIONS = [
  "How much could I save?",
  "Is my home a good fit for solar?",
  "What's the federal tax credit?",
  "I want backup power during outages",
];

function SunMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative grid place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 35% 30%, #ffce5a, #ff6a3d)",
        boxShadow: "0 0 18px -2px rgba(255,140,60,0.7)",
      }}
    >
      <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
    </span>
  );
}

function deriveStage(reached: Set<string>): number {
  let stage = -1;
  if (reached.has("scoreLead")) stage = 0;
  if (reached.has("recommendSystem") || reached.has("lookupIncentives")) stage = Math.max(stage, 1);
  if (reached.has("generateQuote")) stage = Math.max(stage, 2);
  if (reached.has("bookSurvey")) stage = Math.max(stage, 3);
  return stage;
}

export function Chat({ lift = null }: { lift?: number | null }) {
  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const busy = status !== "ready";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  // Funnel progress from completed tool calls.
  const reached = new Set<string>();
  for (const m of messages) {
    for (const p of m.parts) {
      if (
        p.type.startsWith("tool-") &&
        (p as unknown as ToolPart).state === "output-available"
      ) {
        reached.add(p.type.replace("tool-", ""));
      }
    }
  }
  const stage = deriveStage(reached);
  const waiting = busy && messages[messages.length - 1]?.role === "user";

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-line/40 py-4">
        <div className="flex items-center gap-2.5">
          <SunMark />
          <div className="leading-none">
            <div className="font-display text-lg text-cream">SunPath</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-faint">Solar</div>
          </div>
        </div>
        {stage >= 0 ? (
          <div className="hidden sm:block">
            <StageRail stage={stage} />
          </div>
        ) : (
          <span className="hidden items-center gap-1.5 text-[11px] text-dim sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-leaf" style={{ boxShadow: "0 0 8px var(--color-leaf)" }} />
            Sunny is online
          </span>
        )}
      </header>

      {/* Messages */}
      <div
        className="flex-1 space-y-5 overflow-y-auto py-6"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation with Sunny"
      >
        {messages.length === 0 ? (
          <Empty onPick={send} />
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("anim-msg-in flex gap-3", m.role === "user" && "justify-end")}
            >
              {m.role === "assistant" && (
                <div className="mt-1 shrink-0">
                  <SunMark size={26} />
                </div>
              )}
              <div
                className={cn(
                  "flex max-w-[85%] flex-col gap-2",
                  m.role === "user" && "items-end",
                )}
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return part.text ? (
                      <div
                        key={i}
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                          m.role === "user"
                            ? "rounded-br-md bg-gradient-to-br from-sun to-sun-bright text-dusk-950"
                            : "glass rounded-bl-md text-cream/90",
                        )}
                      >
                        {part.text}
                      </div>
                    ) : null;
                  }
                  if (part.type.startsWith("tool-")) {
                    return <ToolCard key={i} part={part as unknown as ToolPart} />;
                  }
                  return null;
                })}
              </div>
            </div>
          ))
        )}

        {waiting && (
          <div className="anim-msg-in flex gap-3" role="status">
            <span className="sr-only">Sunny is typing…</span>
            <div className="mt-1 shrink-0">
              <SunMark size={26} />
            </div>
            <div
              aria-hidden
              className="glass flex items-center gap-1.5 rounded-2xl rounded-bl-md px-4 py-3.5"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-sun"
                  style={{ animation: `blink 1.2s ease-in-out ${i * 0.18}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center gap-2 text-sm text-ember">
            {/* The API route's onError returns friendly, quota-aware copy — show it. */}
            <span>{error.message?.trim() || "Something went wrong."}</span>
            <button
              onClick={() => regenerate()}
              className="inline-flex items-center gap-1 rounded-md bg-dusk-800 px-2 py-1 text-cream/80 hover:text-cream"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="pb-5 pt-2">
        <form
          onSubmit={onSubmit}
          className="glass flex items-end gap-2 rounded-2xl p-2 focus-within:border-sun/40 focus-within:shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-sun)_25%,transparent)]"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell Sunny about your home and energy bill…"
            aria-label="Message Sunny"
            name="message"
            autoComplete="off"
            enterKeyHint="send"
            // 16px keeps iOS Safari from zooming the viewport on focus.
            className="flex-1 bg-transparent px-3 py-2 text-base text-cream placeholder:text-faint focus:outline-none"
            autoFocus
          />
          <motion.button
            type="submit"
            disabled={busy || !input.trim()}
            whileTap={{ scale: 0.92 }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sun to-ember text-dusk-950 transition-opacity disabled:opacity-35"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </motion.button>
        </form>
        <p className="mt-2 text-center text-[10px] text-faint">
          Sunny is an AI demo · estimates confirmed at survey ·{" "}
          <a
            href="/results"
            className="underline decoration-line underline-offset-2 transition-colors hover:text-sun"
          >
            conversion eval
          </a>
          {typeof lift === "number" && lift > 0 && (
            <span className="text-leaf"> · +{lift} pts measured lift</span>
          )}
        </p>
      </div>
    </div>
  );
}

function Empty({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center pb-10 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 16 }}
        style={{ animation: "floatY 6s ease-in-out infinite" }}
      >
        <SunMark size={56} />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 font-display text-3xl text-cream"
      >
        Hi, I&apos;m <span className="text-gradient-sun italic">Sunny</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-dim"
      >
        Tell me about your home and energy bill — I&apos;ll size a system, run the real
        numbers, and book your free survey.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
        className="mt-7 flex max-w-md flex-wrap justify-center gap-2"
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="glass rounded-full px-3.5 py-2 text-[13px] text-cream/85 transition-colors hover:border-sun/40 hover:text-cream"
          >
            {s}
          </button>
        ))}
      </motion.div>
    </div>
  );
}
