const fs   = require("fs");
const path = require("path");
const config = require("../../config");

async function dmMainOwner(client, content) {
  try {
    const owner = await client.users.fetch(config.mainOwnerId);
    if (owner) await owner.send(content).catch(() => {});
  } catch (_) {}
}

module.exports = {
  name: "reloadall",
  aliases: ["rla"],
  description: "Reload every command from disk (main owner only).",
  category: "settings",
  usage: "+reloadall",
  mainOwnerOnly: true,
  argsRequired: false,

  async execute({ client, message }) {
    const { tick, cross, warning, rightsort: R } = client.emoji;
    const color = client.getColor(message.guild?.id);

    const wait = await message.reply(client.util.v2msg(color, `${warning} Reloading all commands...`));

    // ── DM main owner: reload started ────────────────────────────────────────
    await dmMainOwner(client,
      client.util.v2msg(client.getColor(null),
        `${warning} **Full Command Reload Started**\n\n`
        + `${R} **By:** ${message.author.tag}\n`
        + `${R} **Server:** ${message.guild?.name || "DM"}\n`
        + `-# Reloading all commands from disk...`,
      ),
    );

    let loaded = 0, failed = 0;
    const errors = [];
    const cmdsDir = path.join(__dirname, "../../commands");

    client.commands.clear();
    client.aliases.clear();

    for (const cat of fs.readdirSync(cmdsDir)) {
      const catPath = path.join(cmdsDir, cat);
      if (!fs.statSync(catPath).isDirectory()) continue;
      for (const file of fs.readdirSync(catPath)) {
        if (!file.endsWith(".js")) continue;
        const filePath = path.join(catPath, file);
        try {
          delete require.cache[require.resolve(filePath)];
          const cmd = require(filePath);
          client.commands.set(cmd.name.toLowerCase(), cmd);
          if (cmd.aliases) {
            for (const alias of cmd.aliases) client.aliases.set(alias.toLowerCase(), cmd.name.toLowerCase());
          }
          loaded++;
        } catch (err) {
          failed++;
          errors.push(`\`${file}\`: ${err.message.slice(0, 60)}`);
        }
      }
    }

    const resultLines = [
      `### ${tick} All Commands Reloaded\n`,
      `${R} **Loaded:** \`${loaded}\` commands`,
      failed ? `${R} **Failed:** \`${failed}\`\n${errors.slice(0, 5).map(e => `> ${e}`).join("\n")}` : "",
      `-# No restart needed — all commands refreshed from disk`,
    ].filter(Boolean).join("\n");

    // ── DM main owner: reload done ────────────────────────────────────────────
    await dmMainOwner(client,
      client.util.v2msg(client.getColor(null),
        `${tick} **Full Command Reload Complete**\n\n`
        + `${R} **Loaded:** \`${loaded}\` commands\n`
        + (failed ? `${R} **Failed:** \`${failed}\`\n` : "")
        + `${R} **By:** ${message.author.tag}\n`
        + `-# All commands are back online`,
      ),
    );

    return wait.edit(client.util.v2msg(color, resultLines));
  },
};
