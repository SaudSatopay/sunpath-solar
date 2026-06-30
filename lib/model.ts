/**
 * Model selection for SunPath.
 *
 * One place to choose the LLM, so the app and the eval stay in sync and
 * switching providers is an env change — not a code edit.
 *
 *   Default          → Google Gemini (gemini-flash-latest), best free-tier headroom.
 *   SUNPATH_PROVIDER=anthropic → Claude (claude-opus-4-8), the strongest demo model.
 *
 * Each provider's SDK reads its own key from the environment lazily
 * (GOOGLE_GENERATIVE_AI_API_KEY / ANTHROPIC_API_KEY), so importing both here is
 * free — a key is only required for the provider you actually call.
 */
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export type Provider = "google" | "anthropic";

export const DEFAULT_MODEL: Record<Provider, string> = {
  google: "gemini-flash-latest",
  anthropic: "claude-opus-4-8",
};

function isProvider(value: string | undefined): value is Provider {
  return value === "google" || value === "anthropic";
}

/** Build a language model for an explicit provider/model pair. */
export function makeModel(provider: Provider, model?: string): LanguageModel {
  if (provider === "anthropic") return anthropic(model ?? DEFAULT_MODEL.anthropic);
  return google(model ?? DEFAULT_MODEL.google);
}

/**
 * The model the live app talks to, resolved from the environment.
 * Falls back to the Gemini free tier when nothing is configured.
 */
export function salesModel(): LanguageModel {
  const provider = isProvider(process.env.SUNPATH_PROVIDER)
    ? process.env.SUNPATH_PROVIDER
    : "google";
  return makeModel(provider, process.env.SUNPATH_MODEL);
}

/** Human-readable label for the active app model (for logs / UI). */
export function salesModelLabel(): string {
  const provider = isProvider(process.env.SUNPATH_PROVIDER)
    ? process.env.SUNPATH_PROVIDER
    : "google";
  return `${provider}:${process.env.SUNPATH_MODEL ?? DEFAULT_MODEL[provider]}`;
}
