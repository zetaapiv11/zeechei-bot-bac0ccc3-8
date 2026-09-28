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
      const data = { maintenance: false, reason: "System maintenance" };
      fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
      return data;
    }

    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { maintenance: false, reason: "System maintenance" };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  name: "maintenance",
  aliases: ["maint", "maintenance-mode"],
  description: "Toggle Zeechei maintenance mode.",
  category: "general",
  usage: "+maintenance <on/off> [reason]",
  ownerOnly: true,

  data: new SlashCommandBuilder()
    .setName("maintenance")
    .setDescription("Toggle Zeechei maintenance mode.")
    .addStringOption(o =>
      o.setName("status")
        .setDescription("Maintenance status")
        .setRequired(true)
        .addChoices(
          { name: "Enable", value: "on" },
          { name: "Disable", value: "off" }
        )
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("Maintenance reason")
        .setRequired(false)
    ),

  getSlashArgs: opts => [
    opts.getString("status", true),
    opts.getString("reason", false) || ""
  ],

  async execute({ client, message, args }) {
    if (!owner(message.author.id)) {
      return message.reply(
        new V2Builder()
          .text("### ❌ Owner Only\n\nOnly Zeechei owners can use this command.")
          .build()
      );
    }

    const status = String(args[0] || "").toLowerCase();

    if (!["on", "off"].includes(status)) {
      return message.reply(
        new V2Builder()
          .text(
            "### ❌ Invalid Status\n\n" +
            "Use `+maintenance on [reason]` or `+maintenance off`."
          )
          .build()
      );
    }

    const data = read();

    if (status === "on") {
      data.maintenance = true;
      data.reason =
        args.slice(1).join(" ").trim() ||
        "Zeechei is currently under maintenance.";
    } else {
      data.maintenance = false;
      data.reason = "System maintenance";
    }

    save(data);

    const text = data.maintenance
      ? `### 🔧 Maintenance Enabled\n\n` +
        `> 🔴 **Status:** Maintenance Mode\n` +
        `> 📝 **Reason:** ${data.reason}\n\n` +
        `-# Zeechei command access is now restricted.`
      : `### ✅ Maintenance Disabled\n\n` +
        `> 🟢 **Status:** Online\n` +
        `> 🚀 Zeechei is back to normal operation.`;

    return message.reply(
      new V2Builder(client.getColor(message.guild?.id))
        .text(text)
        .build()
    );
  }
};