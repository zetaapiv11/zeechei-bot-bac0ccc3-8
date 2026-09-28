const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const { BTN } = require("../../utils/emojis");
const Database = require("../../database/Database");

module.exports = {
  name: "warnings",
  aliases: ["warnlist", "warns"],
  description: "View warnings for a user (paginated).",
  category: "moderation",
  usage: "+warnings [@user]",
  examples: ["+warnings", "+warnings @user"],
  data: new SlashCommandBuilder()
    .setName("warnings").setDescription("View warnings for a user.")
    .addUserOption(o => o.setName("user").setDescription("User to check (leave blank for yourself)")),
  async execute({ client, message }) {
    const { rightsort, space, cross } = client.emoji;
    const color  = client.getColor(message.guild.id);
    const target = message.mentions.members.first() || message.member;
    const warns  = Database.getWarnings(message.guild.id, target.id);

    if (!warns.length) {
      return message.reply(client.util.v2msg(color,
        `✅ **No Warnings**\n\n${rightsort} **${target.user.tag}** has no warnings on record.`,
      ));
    }

    const PAGE_SIZE = 5;
    const pages = [];
    for (let i = 0; i < warns.length; i += PAGE_SIZE) {
      pages.push(warns.slice(i, i + PAGE_SIZE));
    }
    let page = 0;

    const buildPayload = (p) => {
      const entries = pages[p].map((w, i) =>
        `${rightsort} **#${p * PAGE_SIZE + i + 1}** ${w.reason}\n${space} By <@${w.modId}> • <t:${w.created}:R>`,
      ).join("\n\n");

      const content =
        `### __Warnings — ${target.user.tag}__\n\n`
        + entries
        + `\n\n-# ${warns.length} warning${warns.length === 1 ? "" : "s"} total • Page ${p + 1} / ${pages.length}`;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("w_first").setEmoji(BTN.nav_first).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId("w_prev").setEmoji(BTN.nav_prev).setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId("w_close").setEmoji(BTN.nav_close).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("w_next").setEmoji(BTN.nav_next).setStyle(ButtonStyle.Secondary).setDisabled(p >= pages.length - 1),
        new ButtonBuilder().setCustomId("w_last").setEmoji(BTN.nav_last).setStyle(ButtonStyle.Secondary).setDisabled(p >= pages.length - 1),
      );

      const builder = new V2Builder(color).text(content);
      if (pages.length > 1) builder.sep().row(row);
      return builder.build();
    };

    if (pages.length <= 1) return message.reply(buildPayload(0));

    const msg = await message.reply(buildPayload(0));
    const collector = msg.createMessageComponentCollector({
      filter: (b) => {
        if (b.user.id === message.author.id) return true;
        b.reply(client.util.v2eph(color, `${cross} Only **${message.author.username}** can navigate this.`));
        return false;
      },
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (btn) => {
      switch (btn.customId) {
        case "w_first": page = 0; break;
        case "w_prev":  page = Math.max(page - 1, 0); break;
        case "w_close": collector.stop(); return btn.update({ components: [] });
        case "w_next":  page = Math.min(page + 1, pages.length - 1); break;
        case "w_last":  page = pages.length - 1; break;
        default: return;
      }
      await btn.update(buildPayload(page));
    });
  },
};
