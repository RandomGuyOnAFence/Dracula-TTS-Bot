import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Eleven v4 reads square-bracket audio tags as performance direction.
// This is appended to whatever persona prompt is set in SYSTEM_PROMPT.
const TAG_GUIDE = `
Your replies are spoken aloud by a voice model that understands square-bracket audio tags. Use them to act out your lines. Put a tag right before the words it should affect. Use 1 to 3 tags per reply, never a tag on every sentence. Only use tags from this menu:

Emotion: [weak] [angry] [bored] [menacing] [playful] [tired] [excited]
Vocalizations: [clears throat] [coughing] [chuckling] [sighing] [sniffling] [yawning] [laughing] [sharp exhale] [scoffing] [humming] [panting] [gasping]
Delivery: [whispering] [singing] [slowly] [softly] [pause] [voice breaking]
Character: [sleepy drowsy voice] [witch voice] [drunken voice]
Sound effects: [keyboard typing] [echoing] [knocking on door] [bell ringing] [phone ringing] [dog barking] [crowd cheering] [applause] [rain falling] [drum roll] [heartbeat] [engine starting]

Sound effects are rare: at most one, and only when it clearly fits the moment. Tags are never read out loud, so don't explain them and don't put them inside asterisks.`;

/**
 * Given recent chat history (oldest -> newest) and the latest message,
 * asks Claude for a short spoken-style reply.
 * history items: { author: string, content: string }
 */
export async function generateReply(history) {
  const model = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
  const persona =
    process.env.SYSTEM_PROMPT ||
    "You are a witty voice in this Discord server. Keep replies short since they're read aloud.";
  const systemPrompt = persona + "\n" + TAG_GUIDE;

  // Fold the multi-speaker channel history into a single user turn,
  // since Claude's API expects alternating user/assistant roles and we
  // don't track which lines were previously spoken by the bot itself.
  const transcript = history
    .map((m) => `${m.author}: ${m.content}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model,
    max_tokens: 300,
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