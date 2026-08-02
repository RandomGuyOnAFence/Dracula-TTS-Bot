# Discord TTS + AI Voice Bot

Joins a voice channel, reads out messages posted in a chosen text channel using
an ElevenLabs voice, and (based on your settings) jumps in with its own
AI-generated replies — spoken and posted as text.

## How it works

1. Join a voice channel yourself, then run `/join` — the bot joins your
   current voice channel. Run `/leave` to disconnect it.
2. Once it's in a voice channel, someone posts in your configured text
   channel.
3. The bot sends that text to ElevenLabs and speaks it aloud, prefixed with
   the author's name ("Alex says: ...").
4. Depending on `REPLY_MODE`, it may then ask Claude for a short reply using
   recent chat as context, post that reply as text, and speak it too.
5. Everything is queued so the bot never talks over itself.

Note: it only reads/responds to the text channel once it's actually in a
voice channel — messages sent before `/join` are ignored.

## Setup

### 1. Discord bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → New Application.
2. Bot tab → enable **Message Content Intent** and **Server Members Intent**.
3. OAuth2 → URL Generator → scopes: `bot`, `applications.commands`.
   Permissions: `Connect`, `Speak`, `View Channels`, `Send Messages`,
   `Read Message History`. Use the generated URL to invite it to your
   server. (`applications.commands` is required for `/join` and `/leave`
   to register.)
4. Copy the bot token (Bot tab → Reset Token) into `.env`.
5. Enable Developer Mode in Discord (User Settings → Advanced), then
   right-click your server, the text channel, and the voice channel to
   copy their IDs into `.env`.

### 2. ElevenLabs voice

1. Sign up at [elevenlabs.io](https://elevenlabs.io) and grab an API key
   (Profile → API Keys).
2. Pick a voice from their Voice Library, or clone/design your own under
   **Voices**. Copy its Voice ID into `.env` as `ELEVENLABS_VOICE_ID`.
   (Note: only clone voices you own or have explicit permission to use —
   ElevenLabs enforces this and impersonating real people without consent
   can violate their terms and, depending on use, the law.)

### 3. Anthropic (for AI replies)

Grab an API key from [console.anthropic.com](https://console.anthropic.com)
and put it in `.env` as `ANTHROPIC_API_KEY`.

### 4. Install & run locally (optional, for testing)

```bash
npm install
cp .env.example .env
# fill in .env with your keys/IDs
npm start
```

Node.js 18+ is required (uses native `fetch`).

### 5. Deploy to Railway (recommended for 24/7 hosting)

The bot needs to stay running continuously to hold its voice connection, so
it needs "always-on" hosting rather than a serverless platform — Railway
works well for this.

1. Push this project to a GitHub repo (make sure `.env` is **not** committed
   — `.gitignore` already excludes it).
2. Go to [railway.com](https://railway.com) → New Project → **Deploy from
   GitHub repo** → select your repo.
3. Railway auto-detects Node.js and runs `npm install` + `npm start`
   (defined in `package.json`) — no extra config needed.
4. Go to the service's **Variables** tab and add every key from
   `.env.example` (`DISCORD_TOKEN`, `GUILD_ID`, `TEXT_CHANNEL_ID`,
   `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ANTHROPIC_API_KEY`, etc.)
   with your real values. Don't upload `.env` itself — enter them individually.
5. Railway redeploys automatically once variables are set. Check the
   **Deployments → Logs** tab for `Logged in as YourBot#1234` and `Slash
   commands registered.` to confirm it's running.
6. In Discord, join a voice channel and run `/join`.

Railway's Hobby plan ($5/mo, includes $5 of usage) is normally enough for a
bot this lightweight, but usage-based billing means heavy voice activity
could push you slightly over — worth checking the **Usage** tab after the
first week.

## Configuration (.env)

| Variable | Purpose |
|---|---|
| `REPLY_MODE` | `mention` (only replies when @mentioned/replied to), `always` (replies to every message — can get chatty/expensive), or `random` (replies to a random fraction) |
| `REPLY_CHANCE` | Used only in `random` mode, e.g. `0.3` = ~30% of messages |
| `HISTORY_LENGTH` | How many recent messages Claude sees as context |
| `SYSTEM_PROMPT` | The bot's personality/instructions |
| `ELEVENLABS_MODEL_ID` | `eleven_turbo_v2_5` (fast/cheap) or `eleven_multilingual_v2` (higher quality) |

`mention` mode is the sane default — `always` means every message in the
channel triggers a paid TTS + LLM call, which adds up fast in an active
channel.

## Cost notes

- **ElevenLabs**: free tier is 10,000 credits/month (~10 min of audio),
  but has no voice cloning and no commercial-use license. Cloning your own
  voice needs Starter ($6/mo) or up. For a chat-reading bot, 10 min/month
  is not much — expect to pay $6+/mo once you're using it regularly.
- **Anthropic**: no free tier, pay-as-you-go (typically a $5 minimum
  prepay). Claude Haiku 4.5 is $1 per million input tokens / $5 per
  million output tokens — for short chat replies that's genuinely pennies
  a month, the cheap part of this stack by far.
- Consider a per-user cooldown or muting the bot in very active channels if
  you're on `always` mode, since that's what drives ElevenLabs cost up.

## Extending

- Swap `generateReply` in `lib/ai.js` for OpenAI if you'd rather use GPT.
- Add a `/join` and `/leave` slash command instead of always auto-joining
  on startup (see `index.js`, the `joinVoiceChannel` call).
- Add per-speaker voice IDs if you want different people to sound different.
