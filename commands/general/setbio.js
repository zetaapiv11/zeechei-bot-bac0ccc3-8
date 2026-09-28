const { SlashCommandBuilder } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");
const Database      = require("../../database/Database");

const MAX_BIO = 150;

module.exports = {
  name: "setbio",
  aliases: ["bio"],
  description: "Set your profile bio (shown on +profile).",
  category: "general",
  usage: "+setbio <text> | +setbio clear",
  argsRequired: true,
  examples: ["+setbio I love music!", "+setbio clear"],
  data: new SlashCommandBuilder()
    .setName("setbio")
    .setDescription("Set your profile bio (shown on +profile).")
    .addStringOption(o =>
      o.setName("text")
        .setDescription(`Your bio (max ${MAX_BIO} chars). Use 'clear' to remove.`)
        .setRequired(true),
    ),
  getSlashArgs: (opts) => opts.getString("text", true).split(" "),

  async execute({ client, message, args }) {
    const { tick, cross, rightsort } = client.emoji;
    const userId = message.author.id;
    const input  = args.join(" ").trim();

    if (!input) {
      return message.reply(
        new V2Builder()
          .text(`### ${cross} No Bio Provided\n\n${rightsort} Usage: \`+setbio <your bio>\`\n${rightsort} To clear: \`+setbio clear\``)
          .build(),
      );
    }

    // Clear bio
    if (input.toLowerCase() === "clear" || input.toLowerCase() === "reset") {
      Database.setBio(userId, null);
      return message.reply(
        new V2Builder()
          .text(`### ${tick} Bio Cleared\n\n${rightsort} Your profile bio has been removed.`)
          .build(),
      );
    }

    if (input.length > MAX_BIO) {
      return message.reply(
        new V2Builder()
          .text(
            `### ${cross} Bio Too Long\n\n`
            + `${rightsort} Maximum length is **${MAX_BIO}** characters.\n`
            + `${rightsort} Yours is **${input.length}** characters.\n\n`
            + `-# Trim it down and try again.`,
          )
          .build(),
      );
    }

    Database.setBio(userId, input);
    return message.reply(
      new V2Builder()
        .section(
          `### ${tick} Bio Updated!\n\n`
          + `${rightsort} **Your new bio:**\n> *${input}*\n\n`
          + `-# Visible on \`+profile\``,
          message.author.displayAvatarURL({ size: 256 }),
        )
        .build(),
    );
  },
};
