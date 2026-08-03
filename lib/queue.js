import {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  StreamType,
  entersState,
  VoiceConnectionStatus,
} from "@discordjs/voice";

/**
 * Plays queued TTS lines one at a time on a single voice connection,
 * so the bot never talks over itself.
 */
export class SpeechQueue {
  constructor(connection) {
    this.connection = connection;
    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);
    this.queue = [];
    this.playing = false;

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.playing = false;
      this._playNext();
    });

    this.player.on("error", (err) => {
      console.error("Audio player error:", err.message);
      this.playing = false;
      this._playNext();
    });
  }

  /** streamFactory: () => Promise<Readable> that produces MP3 audio */
  enqueue(streamFactory) {
    this.queue.push(streamFactory);
    if (!this.playing) this._playNext();
  }

  async _playNext() {
    const next = this.queue.shift();
    if (!next) return;

    this.playing = true;
    try {
      const stream = await next();
      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
      });
      this.player.play(resource);
      await entersState(this.player, AudioPlayerStatus.Playing, 5000);
    } catch (err) {
      console.error("Failed to play queued audio:", err.message);
      this.playing = false;
      this._playNext();
    }
  }
}

export async function waitForConnectionReady(connection) {
  await entersState(connection, VoiceConnectionStatus.Ready, 20000);
}
