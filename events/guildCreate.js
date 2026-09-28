const {
  AuditLogEvent, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const { V2Builder } = require("../utils/V2Builder");
const { BTN }       = require("../utils/emojis");
const WebhookLogger = require("../logger/WebhookLogger");
const config        = require("../config");

const BANNER_URL = require("../config").bannerUrl;

function buildWelcomePayload(client, guild, prefix) {
  const members    = guild.memberCount?.toLocaleString() ?? "Unknown";
  const inviteUrl  = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`;
  const supportUrl = config.supportServer || "https://discord.gg/d4RDX4KXc";
  const websiteUrl = config.website       || "https://discord.gg/d4RDX4KXc";

  const mainText =
    `#  zeechei has been added to ${guild.name}\n`
    + `-# __thanks for adding zeechei to your server__\n\n`
    + `> **${guild.name}** : ${members}\n`
    + `> **Default prefix** : ${prefix}`;

  const manualText =
    ` **__User Manual__**\n\n`
    + ` \`${prefix}help\`\n`
    + ` \`${prefix}config\`\n`
    + ` \`${prefix}customize\`\n`
    + ` \`${prefix}play\`\n`
    + ` \`${prefix}playlist\`\n`
    + ` \`${prefix}spotify\`\n`
    + ` \`${prefix}moderation\`\n`
    + ` \`${prefix}fun\``;

  const supportText =
    ` **__Need Support?__**\n`
    + ` Join our support server through the link given below — our team is always available to help you.\n\n`
    + ` To change prefix: \`/setprefix ||newprefix||\``;

  const linkRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Support Server").setURL(supportUrl).setStyle(ButtonStyle.Link).setEmoji(BTN.link_support),
    new ButtonBuilder().setLabel("Website").setURL(websiteUrl).setStyle(ButtonStyle.Link).setEmoji(BTN.link_website),
    new ButtonBuilder().setLabel("Invite Bot").setURL(inviteUrl).setStyle(ButtonStyle.Link).setEmoji(BTN.link_invite),
  );

  return new V2Builder()
    .text(mainText)
    .sep()
    .text(manualText)
    .sep()
    .text(supportText)
    .sep()
    .media(BANNER_URL)
    .sep()
    .row(linkRow)
    .build();
}

module.exports = {
  name: "guildCreate",
  once: false,
  async execute(client, guild) {
    console.log(`[Guild] Joined: ${guild.name} (${guild.id}) | Members: ${guild.memberCount}`);
    WebhookLogger.guildJoin(guild.name, guild.id, guild.memberCount);

    const prefix = config.prefix;

    // ── Find who added the bot ─────────────────────────────────────────────────
    let adder = null;
    try {
      await new Promise(r => setTimeout(r, 3500));
      const logs  = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
      const entry = logs.entries.find(e => e.target?.id === client.user.id);
      if (entry?.executor) adder = entry.executor;
    } catch (e) {
      console.log(`[GuildCreate] Audit log failed for ${guild.name}: ${e.message}`);
    }

    if (!adder) {
      try { adder = await client.users.fetch(guild.ownerId); } catch {}
    }

    // ── DM the adder / owner ───────────────────────────────────────────────────
    if (adder) {
      await adder.send(buildWelcomePayload(client, guild, prefix))
        .catch(e => console.log(`[GuildCreate] DM failed to ${adder.tag}: ${e.message}`));
    }

    // ── Welcome message in server ─────────────────────────────────────────────
    const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);

    const ch = guild.systemChannel?.permissionsFor(me)?.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ])
      ? guild.systemChannel
      : guild.channels.cache
          .filter(c =>
            c.type === ChannelType.GuildText &&
            c.permissionsFor(me)?.has([
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ]),
          )
          .sort((a, b) => a.position - b.position)
          .first();

    if (!ch) return;

    await ch.send(buildWelcomePayload(client, guild, prefix))
      .catch(e => console.log(`[GuildCreate] Channel msg failed: ${e.message}`));
  },
};
