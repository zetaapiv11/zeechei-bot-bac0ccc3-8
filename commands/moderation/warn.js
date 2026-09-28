const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { BTN, TXT: E } = require("../../utils/emojis");
const Database = require("../../database/Database");

const MAX_WARNS = 5;

// ── Paginated help pages ──────────────────────────────────────────────────────
const PAGES = [
  {
    title: "Warning Management System",
    desc:  "Track and manage member warnings with an automatic limit system. Each member can receive a maximum of 5 warnings. Warnings are stored persistently and can be listed, removed individually, or reset entirely.",
    sections: null,
  },
  {
    title: "Warning Management System → `@member <reason>`",
    desc:  "Issue a warning to a member with an optional reason. Each warning is assigned a unique ID for future reference. Members cannot be warned if they already have 5 active warnings.",
    sections: [
      { h: "Usage",               body: "`+warn @member [reason]`" },
      { h: "Example",             body: "`+warn @BadUser Spamming in general`" },
      { h: "Notes",               body: 'If no reason is provided, it defaults to "No Reason Provided".' },
      { h: "Permission Required", body: "`Kick Members / Mod Role`" },
    ],
  },
  {
    title: "Warning Management System → `list`",
    desc:  "Display all active warnings for a specific member, including the warning ID, reason, and timestamp for each one.",
    sections: [
      { h: "Usage",               body: "`+warnings @member`" },
      { h: "Example",             body: "`+warnings @BadUser`" },
      { h: "Permission Required", body: "`Kick Members / Mod Role`" },
    ],
  },
  {
    title: "Warning Management System → `remove`",
    desc:  "Remove a specific warning from a member using the warning ID. The ID can be found using `+warnings`.",
    sections: [
      { h: "Usage",               body: "`+clearwarns @member <warnID>`" },
      { h: "Example",             body: "`+clearwarns @BadUser 482916`" },
      { h: "Notes",               body: "The warnID is shown when you use `+warnings` on a member." },
      { h: "Permission Required", body: "`Kick Members / Mod Role`" },
    ],
  },
  {
    title: "Warning Management System → `reset`",
    desc:  "Clear ALL warnings for a member at once. This permanently deletes every warning entry for that user in this server.",
    sections: [
      { h: "Usage",               body: "`+clearwarns @member`" },
      { h: "Example",             body: "`+clearwarns @BadUser`" },
      { h: "Notes",               body: "This action cannot be undone. All warning history for the member will be permanently deleted." },
      { h: "Permission Required", body: "`Kick Members / Mod Role`" },
    ],
  },
];

function buildHelpPage(color, page, total) {
  const p = PAGES[page];
  let text = `### __${p.title}__\n${p.desc}`;
  if (p.sections) {
    text += "\n\n" + p.sections.map(s => `${E.arrow} __${s.h}__\n${s.body}`).join("\n\n");
  }
  if (total > 1) text += `\n\n-# Page ${page + 1}/${total}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("wh_first").setEmoji(BTN.nav_first).setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId("wh_prev").setEmoji(BTN.nav_prev).setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId("wh_close").setEmoji(BTN.nav_close).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("wh_next").setEmoji(BTN.nav_next).setStyle(ButtonStyle.Secondary).setDisabled(page >= total - 1),
    new ButtonBuilder().setCustomId("wh_last").setEmoji(BTN.nav_last).setStyle(ButtonStyle.Secondary).setDisabled(page >= total - 1),
  );

  return new V2Builder(color).text(text).sep().row(row).build();
}

// ── Command ───────────────────────────────────────────────────────────────────
module.exports = {
  name: "warn",
  aliases: ["w"],
  description: "Warn a member, or view warning system help.",
  category: "moderation",
  usage: "+warn [@member] [reason]",
  examples: ["+warn", "+warn @user Breaking rules"],
  data: new SlashCommandBuilder()
    .setName("warn").setDescription("Warn a member.")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Warn reason")),
  getSlashArgs: (opts) => { const r = opts.getString("reason") || ""; return [opts.getUser("user") ? `<@${opts.getUser("user").id}>` : "_", ...r.split(" ")]; },

  async execute({ client, message, args }) {
    const color  = client.getColor(message.guild?.id);
    const target = message.mentions.members?.first();

    // ── No target → paginated help ─────────────────────────────────────────
    if (!target) {
      let page = 0;
      const total = PAGES.length;
      const msg = await message.reply(buildHelpPage(color, page, total));

      const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 });
      collector.on("collect", async (btn) => {
        if (btn.user.id !== message.author.id) {
          return btn.reply(new V2Builder(color).text(`❌ Only <@${message.author.id}> can navigate this.`).buildEphemeral());
        }
        switch (btn.customId) {
          case "wh_first": page = 0; break;
          case "wh_prev":  page = Math.max(page - 1, 0); break;
          case "wh_close": collector.stop(); return btn.update({ components: [] });
          case "wh_next":  page = Math.min(page + 1, total - 1); break;
          case "wh_last":  page = total - 1; break;
        }
        return btn.update(buildHelpPage(color, page, total));
      });
      collector.on("end", () => msg.edit({ components: [] }).catch(() => {}));
      return;
    }

    // ── Warn target ────────────────────────────────────────────────────────
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply(
        new V2Builder(0xe74c3c).text(`❌ You need **Kick Members** permission to warn members.\n\n${E.arrow} __Permission Required__\n\`Kick Members\``).build(),
      );
    }

    const currentWarns = Database.getWarnings(message.guild.id, target.id);
    if (currentWarns.length >= MAX_WARNS) {
      return message.reply(
        new V2Builder(0xe74c3c)
          .text(`❌ **${target.user.username}** already has ${MAX_WARNS} active warnings — the maximum allowed.\n\n-# Use \`+clearwarns\` to remove warnings.`)
          .build(),
      );
    }

    const reason = args.slice(1).join(" ").trim() || "No Reason Provided";
    const warnId = Database.addWarning(message.guild.id, target.id, reason, message.author.id);
    const total  = Database.getWarnings(message.guild.id, target.id).length;

    // DM the warned user
    const dmText =
      `### __You have been warned__\n\n`
      + `${E.arrow} Server\n${message.guild.name}\n\n`
      + `${E.arrow} Reason\n${reason}\n\n`
      + `${E.arrow} Warning ID\n${warnId}\n\n`
      + `-# Warned by ${message.author.username}`;

    const notified = await target.user.send(new V2Builder(color).text(dmText).build()).then(() => true).catch(() => false);

    // Channel response
    const text =
      `### __Member Warned__\n\n`
      + `${E.arrow} User\n${target.user.username} (${target.id})\n\n`
      + `${E.arrow} Reason\n${reason}\n\n`
      + `${E.arrow} Warning ID\n${warnId}\n\n`
      + `-# Warned by ${message.author.username} · Total: ${total}/${MAX_WARNS} · Notified: ${notified ? "Yes" : "No"}`;

    return message.reply(new V2Builder(color).text(text).build());
  },
};
