import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Partials,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";
import { joinVoiceChannel, getVoiceConnection } from "@discordjs/voice";
import { textToSpeechStream } from "./lib/tts.js";
import { generateReply } from "./lib/ai.js";
import { SpeechQueue, waitForConnectionReady } from "./lib/queue.js";

const {
  DISCORD_TOKEN,
  GUILD_ID,
  TEXT_CHANNEL_ID,
  REPLY_MODE = "mention",
  REPLY_CHANCE = "0.3",
  HISTORY_LENGTH = "10",
} = process.env;

for (const [name, val] of Object.entries({
  DISCORD_TOKEN,
  GUILD_ID,
  TEXT_CHANNEL_ID,
})) {
  if (!val) {
    console.error(`Missing required env var: ${name}. Check your .env file.`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// In-memory rolling history of recent chat, used as context for Claude.
const chatHistory = [];

// Set once the bot has joined a voice channel via /join.
let speechQueue = null;

const commands = [
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Bring the bot into your current voice channel"),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Disconnect the bot from voice"),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST().setToken(DISCORD_TOKEN);
  // Guild-scoped commands show up instantly (global commands can take up to an hour to propagate).
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands,
  });
  console.log("Slash commands registered.");
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  console.log("Waiting for /join to be run in Discord.");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "join") {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      await interaction.reply({
        content: "Join a voice channel first, then run /join.",
        ephemeral: true,
      });
      return;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: GUILD_ID,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    try {
      await waitForConnectionReady(connection);
      speechQueue = new SpeechQueue(connection);
      await interaction.reply(
        `Joined **${voiceChannel.name}**. I'll read and respond to messages in <#${TEXT_CHANNEL_ID}>.`
      );
    } catch (err) {
      console.error("Failed to join voice channel:", err.message);
      await interaction.reply({
        content: "Couldn't connect to that voice channel. Try again?",
        ephemeral: true,
      });
    }
    return;
  }

  if (interaction.commandName === "leave") {
    const connection = getVoiceConnection(GUILD_ID);
    if (connection) {
      connection.destroy();
      speechQueue = null;
      await interaction.reply("Left the voice channel.");
    } else {
      await interaction.reply({
        content: "I'm not in a voice channel.",
        ephemeral: true,
      });
    }
    return;
  }
});

// Flavor lines spoken before reading each message, for a bit of character.
const READ_INTROS = [
  "Alright, let's see vhat this user says...",
  "Dracula rubs his temples...",
];

function randomIntro() {
  return READ_INTROS[Math.floor(Math.random() * READ_INTROS.length)];
}

client.on("messageCreate", async (message) => {
  if (message.channel.id !== TEXT_CHANNEL_ID) return;
  if (message.author.bot) return;
  if (!message.content.trim()) return;
  if (!speechQueue) return; // bot hasn't been /join'd into voice yet

  const authorName = message.member?.displayName || message.author.username;

  // Track history for AI context
  chatHistory.push({ author: authorName, content: message.content });
  while (chatHistory.length > Number(HISTORY_LENGTH)) chatHistory.shift();

  // 1. Read the message aloud, prefixed with a flavor line and who said it
  speechQueue.enqueue(() =>
    textToSpeechStream(
      `${randomIntro()} ${authorName} says: ${message.content}`
    )
  );

  // 2. Decide whether the bot should also chime in with its own reply
  const wasMentioned = message.mentions.has(client.user);
  const isReplyToBot =
    message.reference &&
    (await message.fetchReference().catch(() => null))?.author.id ===
      client.user.id;

  const shouldReply =
    REPLY_MODE === "always" ||
    (REPLY_MODE === "mention" && (wasMentioned || isReplyToBot)) ||
    (REPLY_MODE === "random" && Math.random() < Number(REPLY_CHANCE));

  if (!shouldReply) return;

  try {
    const reply = await generateReply(chatHistory);
    if (!reply) return;

    chatHistory.push({ author: client.user.username, content: reply });
    while (chatHistory.length > Number(HISTORY_LENGTH)) chatHistory.shift();

    await message.channel.send(reply);
    speechQueue.enqueue(() => textToSpeechStream(reply));
  } catch (err) {
    console.error("Failed to generate/send AI reply:", err.message);
  }
});

client.login(DISCORD_TOKEN);
