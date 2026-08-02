import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Given recent chat history (oldest -> newest) and the latest message,
 * asks Claude for a short spoken-style reply.
 * history items: { author: string, content: string }
 */
export async function generateReply(history) {
  const model = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
  const systemPrompt =
    process.env.SYSTEM_PROMPT ||
    "You are a witty voice in this Discord server. Keep replies short since they're read aloud.";

  // Fold the multi-speaker channel history into a single user turn,
  // since Claude's API expects alternating user/assistant roles and we
  // don't track which lines were previously spoken by the bot itself.
  const transcript = history
    .map((m) => `${m.author}: ${m.content}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model,
    max_tokens: 200,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Recent chat:\n${transcript}\n\nRespond naturally to the conversation as yourself, in 1-3 sentences.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text.trim() : "";
}
