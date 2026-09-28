const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { V2Builder } = require("./V2Builder");
const { BTN } = require("./emojis");

const CAT_EMOJI = {
  music:       "🎵 Music",
  filter:      "🎛️ Filter",
  playlist:    "📂 Playlist",
  moderation:  "🛡️ Moderation",
  information: "ℹ️ Information",
  settings:    "⚙️ Settings",
  fun:         "🎉 Fun",
  general:     "🤖 General",
  customize:   "🎨 Customize",
};

/**
 * Send a lily-style V2 usage embed for a command.
 * Shows the command info with prev/close/next navigation
 * through all commands in the same category.
 */
async function sendUsage(client, message, command) {
  const { rightsort, dot } = client.emoji;
  const color  = client.getColor(message.guild?.id);
  const prefix = message.prefix || "+";
  const avatar = client.user?.displayAvatarURL({ size: 512 });

  // Collect all commands in the same category, sorted alphabetically
  const catCmds = [...client.commands.values()]
    .filter(c => c.category === command.category)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Remove duplicates (aliases resolved to same command)
  const seen = new Set();
  const cmds = catCmds.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; });

  let idx = cmds.findIndex(c => c.name === command.name);
  if (idx === -1) idx = 0;
  const total = cmds.length;

  function buildPayload(i) {
    const cmd = cmds[i];
    const usageLine = (cmd.usage || `${prefix}${cmd.name}`).replace(/^\+/, prefix);
    const catLabel  = CAT_EMOJI[cmd.category] || cmd.category || "general";

    let body =
      `**${cmd.name}**\n`
      + `${cmd.description || "No description available."}\n\n`
      + `${rightsort} **Usage:** \`${usageLine}\`\n`
      + `${rightsort} **Category:** ${catLabel}\n`
      + `${rightsort} **Aliases:** ${cmd.aliases?.length
          ? cmd.aliases.map(a => `\`${prefix}${a}\``).join(", ")
          : "None"}\n`;

    if (cmd.examples?.length) {
      body += `\n**Examples:**\n`
        + cmd.examples.map(e => `⠀\`${e.replace(/^\+/, prefix)}\``).join("\n") + "\n";
    }

    body += `\n-# ${i + 1} / ${total} ${dot} Slash: \`/${cmd.name}\``;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("usage_first")
        .setEmoji(BTN.nav_first)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(i === 0),
      new ButtonBuilder()
        .setCustomId("usage_prev")
        .setEmoji(BTN.nav_prev)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(i === 0),
      new ButtonBuilder()
        .setCustomId("usage_close")
        .setEmoji(BTN.nav_close)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("usage_next")
        .setEmoji(BTN.nav_next)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(i >= total - 1),
      new ButtonBuilder()
        .setCustomId("usage_last")
        .setEmoji(BTN.nav_last)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(i >= total - 1),
    );

    const builder = new V2Builder(color).section(body, avatar);
    if (total > 1) builder.sep().row(row);
    return builder.build();
  }

  if (total <= 1) return message.reply(buildPayload(idx));

  const msg = await message.reply(buildPayload(idx));

  const collector = msg.createMessageComponentCollector({
    filter: (b) => {
      if (b.user.id === message.author.id) return true;
      b.deferUpdate().catch(() => {});
      return false;
    },
    time: 3 * 60 * 1000,
  });

  collector.on("collect", async (btn) => {
    try {
      switch (btn.customId) {
        case "usage_first": idx = 0; break;
        case "usage_prev":  idx = Math.max(idx - 1, 0); break;
        case "usage_close":
          collector.stop("closed");
          return btn.update({ components: [] });
        case "usage_next": idx = Math.min(idx + 1, total - 1); break;
        case "usage_last": idx = total - 1; break;
        default: return;
      }
      await btn.update(buildPayload(idx));
    } catch {}
  });

  collector.on("end", (_, reason) => {
    if (reason !== "closed") msg.edit({ components: [] }).catch(() => {});
  });
}

module.exports = { sendUsage };
