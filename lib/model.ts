/**
 * Model selection for SunPath.
 *
 * One place to choose the LLM, so the app and the eval stay in sync and
 * switching providers is an env change — not a code edit.
 *
 *   Default          → Google Gemini (gemini-flash-latest), best free-tier headroom.
 *   SUNPATH_PROVIDER=anthropic → Claude (claude-opus-4-8), the strongest demo model.
 *   SUNPATH_PROVIDER=groq      → OpenAI gpt-oss-120b on Groq's free, high-limit tier.
 *
 * FAILOVER: when a GROQ_API_KEY is present, the live app's model transparently
 * retries the call on Groq if the primary provider is throttled or down
 * (429 / 5xx / overload / missing key). Free-tier Gemini hits "model is
 * experiencing high demand" spikes in real life — with failover the demo keeps
 * answering instead of erroring. Disable with SUNPATH_FAILOVER=0.
 *
 * Each provider's SDK reads its own key from the environment lazily
 * (GOOGLE_GENERATIVE_AI_API_KEY / ANTHROPIC_API_KEY / GROQ_API_KEY), so importing
 * them all here is free — a key is only required for the provider you call.
 */
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { groq } from "@ai-sdk/groq";
import {
  wrapLanguageModel,
  APICallError,
  LoadAPIKeyError,
  type LanguageModel,
} from "ai";

export type Provider = "google" | "anthropic" | "groq";

/** Concrete model instance — all three providers return a LanguageModelV4. */
type ProviderModel = ReturnType<typeof google>;

export const DEFAULT_MODEL: Record<Provider, string> = {
  google: "gemini-flash-latest",
  anthropic: "claude-opus-4-8",
  // gpt-oss-120b is the strongest reliable tool-caller on Groq's free tier
  // (Llama 3.x on Groq emits malformed tool calls under our 6-tool schema).
  groq: "openai/gpt-oss-120b",
};

function isProvider(value: string | undefined): value is Provider {
  return value === "google" || value === "anthropic" || value === "groq";
}

/** Build a language model for an explicit provider/model pair. */
export function makeModel(provider: Provider, model?: string): ProviderModel {
  if (provider === "anthropic") return anthropic(model ?? DEFAULT_MODEL.anthropic);
  if (provider === "groq") return groq(model ?? DEFAULT_MODEL.groq);
  return google(model ?? DEFAULT_MODEL.google);
}

/** Errors that mean "this provider can't serve right now" — throttled, down, or unkeyed. */
function isUnavailableError(error: unknown): boolean {
  if (LoadAPIKeyError.isInstance(error)) return true;
  if (APICallError.isInstance(error)) {
    return (
      error.isRetryable ||
      error.statusCode === 429 ||
      // 401/403: missing, revoked, or misconfigured key — the backup should serve.
      // (Verified live: a blank Google key surfaces as 403 PERMISSION_DENIED, not LoadAPIKeyError.)
      error.statusCode === 401 ||
      error.statusCode === 403 ||
      (error.statusCode ?? 0) >= 500
    );
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /rate limit|quota|overload|high demand|resource_exhausted|permission_denied|api key|unavailable/i.test(
    msg,
  );
}

/**
 * Wrap a primary model so throttle/outage errors transparently retry once on a
 * fallback provider. The failure surfaces on the initial doStream/doGenerate
 * call — before any tokens reach the client — so a failed-over turn looks like
 * a normal reply, just from the backup model.
 */
function withFailover(
  primary: ProviderModel,
  fallback: ProviderModel,
  fallbackLabel: string,
): LanguageModel {
  return wrapLanguageModel({
    model: primary,
    middleware: {
      wrapStream: async ({ doStream, params }) => {
        try {
          return await doStream();
        } catch (error) {
          if (!isUnavailableError(error)) throw error;
          console.warn(`[model] primary provider unavailable — failing over to ${fallbackLabel}`);
          return fallback.doStream(params);
        }
      },
      wrapGenerate: async ({ doGenerate, params }) => {
        try {
          return await doGenerate();
        } catch (error) {
          if (!isUnavailableError(error)) throw error;
          console.warn(`[model] primary provider unavailable — failing over to ${fallbackLabel}`);
          return fallback.doGenerate(params);
        }
      },
    },
  });
}

/**
 * The model the live app talks to, resolved from the environment, with
 * automatic failover to Groq when a key for it exists.
 */
export function salesModel(): LanguageModel {
  const provider = isProvider(process.env.SUNPATH_PROVIDER)
    ? process.env.SUNPATH_PROVIDER
    : "google";
  const primary = makeModel(provider, process.env.SUNPATH_MODEL);

  const failoverEnabled =
    process.env.SUNPATH_FAILOVER !== "0" && provider !== "groq" && !!process.env.GROQ_API_KEY;
  if (!failoverEnabled) return primary;

  return withFailover(primary, makeModel("groq"), `groq:${DEFAULT_MODEL.groq}`);
}

/** Human-readable label for the active app model (for logs / UI). */
export function salesModelLabel(): string {
  const provider = isProvider(process.env.SUNPATH_PROVIDER)
    ? process.env.SUNPATH_PROVIDER
    : "google";
  return `${provider}:${process.env.SUNPATH_MODEL ?? DEFAULT_MODEL[provider]}`;
}
