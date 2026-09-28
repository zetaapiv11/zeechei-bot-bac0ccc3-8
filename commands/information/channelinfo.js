const { SlashCommandBuilder, ChannelType } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { TXT: E } = require("../../utils/emojis");

const TYPE_MAP = {
  [ChannelType.GuildText]:         "Text Channel",
  [ChannelType.GuildVoice]:        "Voice Channel",
  [ChannelType.GuildCategory]:     "Category",
  [ChannelType.GuildAnnouncement]: "Announcement Channel",
  [ChannelType.GuildStageVoice]:   "Stage Channel",
  [ChannelType.GuildForum]:        "Forum Channel",
  [ChannelType.GuildMedia]:        "Media Channel",
  [ChannelType.GuildDirectory]:    "Directory Channel",
};

module.exports = {
  name: "channelinfo",
  aliases: ["ci", "channel"],
  description: "Shows information about a channel.",
  category: "information",
  usage: "+channelinfo [#channel]",
  data: new SlashCommandBuilder()
    .setName("channelinfo").setDescription("Shows information about a channel.")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to inspect (defaults to current)")),
  getSlashArgs: (opts) => {
    const ch = opts.getChannel("channel");
    return ch ? [`<#${ch.id}>`] : [];
  },

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);
    const ch    = message.mentions.channels.first() || message.channel;

    const typeName  = TYPE_MAP[ch.type] ?? "Unknown";
    const category  = ch.parent?.name ?? "None";
    const position  = ch.rawPosition ?? 0;
    const createdTs = Math.floor(ch.createdTimestamp / 1000);

    // Text Settings (only for text-based channels)
    const isText = ch.isTextBased?.() && ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice;
    const topic     = ch.topic || "No topic set";
    const nsfw      = ch.nsfw ? "Yes" : "No";
    const slowmode  = ch.rateLimitPerUser ? `${ch.rateLimitPerUser}s` : "Off";

    // Permission overwrites
    const overwrites = ch.permissionOverwrites?.cache ?? new Map();
    const roleOws  = [...overwrites.values()].filter(o => o.type === 0).length;
    const userOws  = [...overwrites.values()].filter(o => o.type === 1).length;

    let text =
      `### #${ch.name} — Channel Info\n\n`
      + `${E.arrow} General\n`
      + `ID: ${ch.id}\n`
      + `Type: \`${typeName}\`\n`
      + `Category: ${category}\n`
      + `Position: ${position}\n`
      + `Mention: <#${ch.id}>\n`
      + `Created: <t:${createdTs}:R>\n`;

    if (isText) {
      text +=
        `\n${E.arrow} Text Settings\n`
        + `Topic: ${topic}\n`
        + `NSFW: ${nsfw}\n`
        + `Slowmode: \`${slowmode}\`\n`;
    }

    text +=
      `\n${E.arrow} Permission Overwrites\n`
      + `Roles: ${roleOws}\n`
      + `Users: ${userOws}\n\n`
      + `-# Run in a channel to get its info, or mention/provide a channel ID.`;

    return message.reply(new V2Builder(color).text(text).build());
  },
};
