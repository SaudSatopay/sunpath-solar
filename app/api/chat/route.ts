import { google } from "@ai-sdk/google";
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { salesTools } from "@/lib/tools";
import { SYSTEM_PROMPT } from "@/lib/agent-prompt";

// Allow time for a multi-step agentic turn (qualify -> recommend -> quote -> book).
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    // gemini-flash-latest: current Flash model with the most free-tier daily headroom.
    // Swap to "claude-opus-4-8" (via @ai-sdk/anthropic) for the strongest final.
    model: google("gemini-flash-latest"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages, { tools: salesTools }),
    tools: salesTools,
    // The agent may chain several tool calls in one turn before replying.
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[chat] stream error:", error);
      return "Sorry — something glitched on our end. Please try that again.";
    },
  });
}
