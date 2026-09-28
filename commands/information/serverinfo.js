const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require("discord.js");

const VERIFY = ["None", "Low", "Medium", "High", "Very High"];
const MFA    = ["Disabled", "Enabled"];
const FILTER = ["Disabled", "Members Without Roles", "All Members"];

module.exports = {
  name: "serverinfo",
  aliases: ["si", "server", "guildinfo"],
  description: "Shows detailed information about this server.",
  category: "information",
  usage: "+serverinfo",
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Shows detailed information about this server."),

  async execute({ client, message }) {
    const color = client.getColor(message.guild?.id);
    const g     = message.guild;
    if (!g) return;

    await g.members.fetch().catch(() => {});

    const owner   = await g.fetchOwner().catch(() => null);
    const iconUrl = g.iconURL({ size: 256 }) || null;

    const createdTs = Math.floor(g.createdTimestamp / 1000);
    const verify  = VERIFY[g.verificationLevel] ?? "Unknown";
    const mfa     = MFA[g.mfaLevel]            ?? "Unknown";
    const filter  = FILTER[g.explicitContentFilter] ?? "Unknown";
    const bots   = g.members.cache.filter(m => m.user.bot).size;
    const humans = g.memberCount - bots;
    const cats   = g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const texts  = g.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).size;
    const voices = g.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const stages = g.channels.cache.filter(c => c.type === ChannelType.GuildStageVoice).size;
    const regularEmojis  = g.emojis.cache.filter(e => !e.animated).size;
    const animatedEmojis = g.emojis.cache.filter(e => e.animated).size;
    const stickers       = g.stickers.cache.size;
    const totalEmojis    = g.emojis.cache.size;
    const boostLevel = g.premiumTier;
    const boostCount = g.premiumSubscriptionCount ?? 0;
    const boosterRole = g.roles.premiumSubscriberRole;

    const roles = g.roles.cache.filter(r => r.id !== g.id).sort((a, b) => b.position - a.position);
    const roleNames = roles.map(r => `@${r.name}`).slice(0, 25).join(", ")
      + (roles.size > 25 ? ` and ${roles.size - 25} more...` : "");
    const roleStr = roles.size ? roleNames : "None";

    const desc = g.description || "No description set.";
    const features = g.features.length
      ? g.features.map(f => `✅ ${f}`).join("\n")
      : "None";

    const embed = new EmbedBuilder()
      .setColor(color || 0x2f3136)
      .setTitle(g.name)
      .setThumbnail(iconUrl)
      .setTimestamp()
      .setFooter({ text: `ID: ${g.id}` })
      .addFields(
        {
          name: "📋 General",
          value: [
            `**Owner:** ${owner ? owner.user.tag : g.ownerId}`,
            `**Created:** <t:${createdTs}:R>`,
            `**Description:** ${desc}`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "🔒 Security",
          value: [
            `**Verification:** ${verify}`,
            `**MFA Level:** ${mfa}`,
            `**Content Filter:** ${filter}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "👥 Members",
          value: [
            `**Total:** ${g.memberCount}`,
            `**Humans:** ${humans}`,
            `**Bots:** ${bots}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "📢 Channels",
          value: [
            `**Categories:** ${cats}`,
            `**Text:** ${texts}`,
            `**Voice:** ${voices}`,
            `**Stage:** ${stages}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "😀 Emojis",
          value: [
            `**Regular:** ${regularEmojis}`,
            `**Animated:** ${animatedEmojis}`,
            `**Stickers:** ${stickers}`,
            `**Total:** ${totalEmojis}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: "💎 Boosts",
          value: [
            `**Level:** ${boostLevel}`,
            `**Count:** ${boostCount}`,
            `**Booster Role:** ${boosterRole ? `@${boosterRole.name}` : "None"}`,
          ].join("\n"),
          inline: true,
        },
        {
          name: `🏷️ Roles (${roles.size})`,
          value: roleStr.length > 1024 ? roleStr.slice(0, 1020) + "..." : roleStr || "None",
          inline: false,
        },
        {
          name: "✨ Features",
          value: features.length > 1024 ? features.slice(0, 1020) + "..." : features,
          inline: false,
        },
      );

    return message.reply({ embeds: [embed] });
  },
};
