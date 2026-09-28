const { SlashCommandBuilder, Routes } = require("discord.js");
const { V2Builder } = require("../../utils/V2Builder");

const VALID = ["avatar", "banner", "bio", "nickname", "all"];

module.exports = {
  name: "resetcustom",
  aliases: ["resetbot", "clearbot", "clearcustom"],
  description: "Reset the bot's server avatar, banner, bio, or nickname. (Server Owner only)",
  category: "customize",
  usage: "+resetcustom <avatar | banner | bio | nickname | all>",
  examples: ["+resetcustom avatar", "+resetcustom all"],
  argsRequired: true,

  data: new SlashCommandBuilder()
    .setName("resetcustom")
    .setDescription("Reset bot customizations for this server. (Server Owner only)")
    .addStringOption(o =>
      o.setName("what")
        .setDescription("What to reset")
        .setRequired(true)
        .addChoices(
          { name: "Avatar",   value: "avatar"   },
          { name: "Banner",   value: "banner"   },
          { name: "Bio",      value: "bio"      },
          { name: "Nickname", value: "nickname" },
          { name: "All",      value: "all"      },
        )
    ),
  getSlashArgs: (opts) => [opts.getString("what")],

  async execute({ client, message, args }) {
    const color = client.getColor(message.guild?.id);
    const { tick, cross, rightsort } = client.emoji;

    if (message.author.id !== message.guild.ownerId && !client.config?.ownerIds?.includes(message.author.id)) {
      return message.reply(client.util.v2msg(color,
        `${cross} **Permission Denied** — Only the **Server Owner** can reset bot customizations.`
      ));
    }

    const what = (args[0] || "").toLowerCase();
    if (!VALID.includes(what)) {
      return message.reply(client.util.v2msg(color,
        `${cross} **Invalid option:** \`${what || "none"}\`\n\n`
        + `${rightsort} Choose one of: \`avatar\` \`banner\` \`bio\` \`nickname\` \`all\`\n`
        + `${rightsort} Example: \`+resetcustom all\``
      ));
    }

    try {
      // Build REST body for avatar/banner/bio resets
      const body = {};
      if (what === "avatar" || what === "all") body.avatar = null;
      if (what === "banner" || what === "all") body.banner = null;
      if (what === "bio"    || what === "all") body.bio    = null;
      if (Object.keys(body).length) {
        await client.rest.patch(Routes.guildMember(message.guild.id, "@me"), { body });
      }

      // Nickname reset via guild member
      if (what === "nickname" || what === "all") {
        const me = await message.guild.members.fetchMe();
        await me.setNickname(null);
      }

      const whatLabel = what === "all"
        ? "avatar, banner, bio & nickname"
        : what;

      return message.reply(
        new V2Builder(color)
          .text(
            `### ${tick} Customization Reset!\n\n`
            + `${rightsort} **Server:** ${message.guild.name}\n`
            + `${rightsort} **By:** ${message.author.username}\n`
            + `${rightsort} **Reset:** \`${whatLabel}\`\n\n`
            + `-# Bot reverted to global defaults for the above field(s)`
          ).build()
      );
    } catch (err) {
      return message.reply(client.util.v2msg(color,
        `${cross} **Reset failed**\n\n${rightsort} \`${err.message}\``
      ));
    }
  },
};
