const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

function colorToHex(c) {
  if (!c || c === "random") return "Random";
  return `#${Number(c).toString(16).padStart(6, "0").toUpperCase()}`;
}

module.exports = {
  name: "botappearance",
  aliases: ["botlook", "appearance", "myappearance", "botcard"],
  description: "Preview all current bot customizations for this server.",
  category: "customize",
  usage: "+botappearance",
  examples: ["+botappearance"],
  argsRequired: false,

  data: new SlashCommandBuilder()
    .setName("botappearance")
    .setDescription("Preview all current bot customizations for this server."),

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);
    const { rightsort, dot } = client.emoji;
    const g = message.guild;
    if (!g) return message.reply(client.util.v2msg(color, `${client.emoji.cross} This command can only be used in a server.`));

    const me = await g.members.fetchMe();
    const botUser = client.user;

    const guildAvatarUrl = me.avatarURL({ size: 512, extension: "png", forceStatic: false });
    const globalAvatarUrl = botUser.displayAvatarURL({ size: 512, extension: "png", forceStatic: false });
    const bannerUrl = me.bannerURL ? me.bannerURL({ size: 1024, extension: "png", forceStatic: false }) : null;

    const nickname = me.nickname || null;
    const bio = me.bio || null;
    const storedColor = client.guildColors?.get(g.id);
    const embedColorHex = colorToHex(storedColor);
    const isDefaultColor = storedColor === undefined || storedColor === null;

    const iconUrl = guildAvatarUrl || globalAvatarUrl;

    const lines = [
      `### 🎨 Bot Appearance — ${g.name}\n`,
      `${dot} **Icon**\n> ${guildAvatarUrl ? `[Server-specific icon set](${guildAvatarUrl})` : `*Using global avatar*`}`,
      `${dot} **Banner**\n> ${bannerUrl ? `[Server banner set](${bannerUrl})` : `*No server banner set*`}`,
      `${dot} **Nickname**\n> ${nickname ? `\`${nickname}\`` : `*No nickname — using default*`}`,
      `${dot} **Bio**\n> ${bio ? `\`\`\`${bio.slice(0, 190)}\`\`\`` : `*No server bio set*`}`,
      `${dot} **Embed Color**\n> ${isDefaultColor ? `\`${embedColorHex}\` *(default)*` : `\`${embedColorHex}\``}`,
      `\n-# Use \`+customize\` to change any of the above`,
    ];

    const builder = new V2Builder(color).section(lines.join("\n"), iconUrl).sep();
    if (bannerUrl) builder.media(bannerUrl);

    return message.reply(builder.build());
  },
};
