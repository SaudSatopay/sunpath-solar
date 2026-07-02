import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  APICallError,
  type UIMessage,
} from "ai";
import { salesTools, repairGarbledToolCall } from "@/lib/tools";
import { SYSTEM_PROMPT } from "@/lib/agent-prompt";
import { salesModel } from "@/lib/model";

// Allow time for a multi-step agentic turn (qualify -> recommend -> quote -> book).
export const maxDuration = 60;

/**
 * Turn a streaming error into a friendly, in-character message.
 *
 * The live demo runs on Gemini's free tier, which throttles aggressively
 * (per-minute rate limits and a low daily quota). When that happens the
 * provider returns HTTP 429 / RESOURCE_EXHAUSTED — we detect it and say so
 * plainly instead of showing a generic "glitch", so a quota hit during a
 * demo reads as expected rather than broken.
 */
function friendlyErrorMessage(error: unknown): string {
  const quotaHit =
    (APICallError.isInstance(error) && error.statusCode === 429) ||
    /quota|rate limit|resource_exhausted|too many requests/i.test(
      error instanceof Error ? `${error.message} ${(error as { responseBody?: string }).responseBody ?? ""}` : String(error),
    );
  if (quotaHit) {
    return "Sunny's getting a lot of love right now and we've briefly hit our demo usage limit. Give it a minute and send that again — your conversation is saved.";
  }

  // Provider/server hiccup that's worth a retry (5xx, transient network).
  if (APICallError.isInstance(error) && (error.isRetryable || (error.statusCode ?? 0) >= 500)) {
    return "Sunny's connection dropped for a second. Mind sending that again?";
  }

  return "Sorry — something glitched on our end. Please try that again.";
}

export async function POST(req: Request): Promise<Response> {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    // Provider/model from the environment (lib/model.ts). Defaults to the
    // Gemini free tier; set SUNPATH_PROVIDER=anthropic for Claude Opus 4.8.
    model: salesModel(),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages, { tools: salesTools }),
    tools: salesTools,
    // The agent may chain several tool calls in one turn before replying.
    stopWhen: stepCountIs(10),
    // Some open models garble tool names (Harmony-token leaks) — repair them.
    experimental_repairToolCall: repairGarbledToolCall,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[chat] stream error:", error);
      return friendlyErrorMessage(error);
    },
  });
}
