// Wraps the ElevenLabs API: text in, playable audio stream out.

const ELEVEN_URL = (voiceId) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

/**
 * Requests speech audio for the given text and returns a Readable stream
 * of MP3 bytes ready to hand to @discordjs/voice.
 */
export async function textToSpeechStream(text) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

  const res = await fetch(ELEVEN_URL(voiceId), {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `ElevenLabs TTS failed (${res.status}): ${errText || res.statusText}`
    );
  }

  // res.body is a web ReadableStream; convert to a Node Readable for prism-media/ffmpeg
  const { Readable } = await import("node:stream");
  return Readable.fromWeb(res.body);
}
