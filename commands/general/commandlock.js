const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const config = require("../../config");
const Database = require("../../database/Database");
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "../../database/zeechei_control.json");

function owner(id) {
  return (
    id === config.mainOwnerId ||
    id === config.ownerId ||
    config.ownerIds?.includes(id) ||
    Database.isOwner?.(id)
  );
}

function read() {
  try {
    if (!fs.existsSync(FILE)) {
      const data = {
        maintenance: false,
        reason: "System maintenance",
        locked: []
      };

      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

      return data;
    }

    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

    if (!Array.isArray(data.locked)) {
      data.locked = [];
    }

    return data;
  } catch {
    return {
      maintenance: false,
      reason: "System maintenance",
      locked: []
    };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  name: "commandlock",
  aliases: ["cmdlock", "lockcmd"],
  description: "Lock or unlock a specific Zeechei command.",
  category: "general",
  usage: "+commandlock <lock/unlock/list> [command]",
  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName("commandlock")
    .setDescription("Lock or unlock an Zeechei command.")
    .addStringOption(o =>
      o.setName("action")
        .setDescription("Lock, unlock or list locked commands")
        .setRequired(true)
        .addChoices(
          { name: "Lock", value: "lock" },
          { name: "Unlock", value: "unlock" },
          { name: "List", value: "list" }
        )
    )
    .addStringOption(o =>
      o.setName("command")
        .setDescription("Command name")
        .setRequired(false)
    ),

  getSlashArgs: opts => [
    opts.getString("action", true),
    opts.getString("command", false) || ""
  ],

  async execute({ client, message, args }) {
    if (!owner(message.author.id)) {
      return message.reply(
        new V2Builder()
          .text("### ❌ Owner Only\n\nOnly Zeechei owners can use this command.")
          .build()
      );
    }

    const action = String(args[0] || "").toLowerCase();
    const query = String(args[1] || "").toLowerCase().trim();

    const data = read();

    if (action === "list") {
      if (!data.locked.length) {
        return message.reply(
          new V2Builder()
            .text(
              "### 🔓 Command Locks\n\n" +
              "No commands are currently locked."
            )
            .build()
        );
      }

      const list = data.locked
        .map((name, i) => `> **${i + 1}.** \`${name}\``)
        .join("\n");

      return message.reply(
        new V2Builder(client.getColor(message.guild?.id))
          .text(
            `### 🔒 Locked Commands\n\n` +
            `${list}\n\n` +
            `-# Total locked: **${data.locked.length}**`
          )
          .build()
      );
    }

    if (!query) {
      return message.reply(
        new V2Builder()
          .text(
            "### ❌ Missing Command\n\n" +
            "Use:\n" +
            "`+commandlock lock <command>`\n" +
            "`+commandlock unlock <command>`\n" +
            "`+commandlock list`"
          )
          .build()
      );
    }

    let command = client.commands.get(query);

    if (!command) {
      command = client.commands.find(cmd =>
        cmd.aliases?.some(alias =>
          String(alias).toLowerCase() === query
        )
      );
    }

    if (!command) {
      return message.reply(
        new V2Builder()
          .text(
            `### ❌ Command Not Found\n\n` +
            `No loaded command matches \`${query}\`.`
          )
          .build()
      );
    }

    const name = command.name.toLowerCase();

    if (name === "maintenance" || name === "commandlock") {
      return message.reply(
        new V2Builder()
          .text(
            "### ⚠️ Protected Command\n\n" +
            "The control commands cannot be locked."
          )
          .build()
      );
    }

    if (action === "lock") {
      if (data.locked.includes(name)) {
        return message.reply(
          new V2Builder()
            .text(
              `### ⚠️ Already Locked\n\n` +
              `\`${name}\` is already locked.`
            )
            .build()
        );
      }

      data.locked.push(name);
      save(data);

      return message.reply(
        new V2Builder(client.getColor(message.guild?.id))
          .text(
            `### 🔒 Command Locked\n\n` +
            `> **Command:** \`${name}\`\n` +
            `> **Status:** Locked\n\n` +
            `-# Non-owner users can no longer use this command.`
          )
          .build()
      );
    }

    if (action === "unlock") {
      if (!data.locked.includes(name)) {
        return message.reply(
          new V2Builder()
            .text(
              `### ⚠️ Not Locked\n\n` +
              `\`${name}\` isn't currently locked.`
            )
            .build()
        );
      }

      data.locked = data.locked.filter(x => x !== name);
      save(data);

      return message.reply(
        new V2Builder(client.getColor(message.guild?.id))
          .text(
            `### 🔓 Command Unlocked\n\n` +
            `> **Command:** \`${name}\`\n` +
            `> **Status:** Unlocked`
          )
          .build()
      );
    }

    return message.reply(
      new V2Builder()
        .text("### ❌ Invalid Action\n\nUse `lock`, `unlock`, or `list`.")
        .build()
    );
  }
};