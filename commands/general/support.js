const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");

const { createCanvas } = require("@napi-rs/canvas");
const config = require("../../config");

function validUrl(value) {
  if (!value || typeof value !== "string") return null;

  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function getColor(client, guildId) {
  try {
    if (typeof client.getColor === "function") {
      return client.getColor(guildId);
    }
  } catch {}

  return config.embedColor || 0x2f3136;
}

function createSupportBanner(color) {
  const width = 1600;
  const height = 500;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;

  const background = ctx.createLinearGradient(
    0,
    0,
    width,
    height
  );

  background.addColorStop(0, "#06070a");
  background.addColorStop(0.5, "#12141a");
  background.addColorStop(1, "#06070a");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width / 2,
    height / 2,
    20,
    width / 2,
    height / 2,
    800
  );

  glow.addColorStop(
    0,
    `rgba(${r}, ${g}, ${b}, 0.32)`
  );

  glow.addColorStop(
    0.45,
    `rgba(${r}, ${g}, ${b}, 0.10)`
  );

  glow.addColorStop(
    1,
    "rgba(0, 0, 0, 0)"
  );

  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle =
    `rgba(${r}, ${g}, ${b}, 0.65)`;

  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.roundRect(
    28,
    28,
    width - 56,
    height - 56,
    30
  );
  ctx.stroke();

  ctx.strokeStyle =
    "rgba(255, 255, 255, 0.08)";

  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.roundRect(
    48,
    48,
    width - 96,
    height - 96,
    22
  );
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "700 82px Arial";
  ctx.fillStyle = "#ffffff";

  ctx.fillText(
    "Zeechei Support Server",
    width / 2,
    215
  );

  ctx.font = "400 30px Arial";
  ctx.fillStyle =
    "rgba(255, 255, 255, 0.62)";

  ctx.fillText(
    "Official support, updates and assistance",
    width / 2,
    300
  );

  ctx.fillStyle =
    `rgb(${r}, ${g}, ${b})`;

  ctx.beginPath();
  ctx.roundRect(
    width / 2 - 135,
    365,
    270,
    5,
    3
  );
  ctx.fill();

  return canvas.toBuffer("image/png");
}

module.exports = {
  name: "support",

  aliases: [
    "helpserver",
    "supportserver",
  ],

  description:
    "Shows the Zeechei support server and official links.",

  category: "general",

  usage: "+support",

  argsRequired: false,

  ownerOnly: false,

  data: new SlashCommandBuilder()
    .setName("support")
    .setDescription(
      "Shows the Zeechei support server and official links."
    ),

  getSlashArgs: () => [],

  async execute({ client, message }) {
    const color = getColor(
      client,
      message.guild?.id
    );

    const supportServer = validUrl(
      config.supportServer
    );

    const website = validUrl(
      config.website
    );

    const voteUrl = validUrl(
      config.voteUrl
    );

    const prefix =
      config.prefix || ",,";

    const serverCount =
      client.guilds?.cache?.size || 0;

    const userCount =
      client.guilds?.cache
        ? [...client.guilds.cache.values()]
            .reduce(
              (total, guild) =>
                total + (guild.memberCount || 0),
              0
            )
        : 0;

    const bannerBuffer =
      createSupportBanner(color);

    const bannerFile =
      new AttachmentBuilder(
        bannerBuffer,
        {
          name: "zeechei-support-banner.png",
        }
      );

    const buttons = [];

    if (supportServer) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("Support Server")
          .setStyle(ButtonStyle.Link)
          .setURL(supportServer)
      );
    }

    if (website) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("Website")
          .setStyle(ButtonStyle.Link)
          .setURL(website)
      );
    }

    if (voteUrl) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("Vote")
          .setStyle(ButtonStyle.Link)
          .setURL(voteUrl)
      );
    }

    if (client.user?.id) {
      const inviteUrl =
        "https://discord.com/oauth2/authorize" +
        `?client_id=${client.user.id}` +
        "&permissions=8" +
        "&scope=bot%20applications.commands";

      buttons.push(
        new ButtonBuilder()
          .setLabel("Add Zeechei")
          .setStyle(ButtonStyle.Link)
          .setURL(inviteUrl)
      );
    }

    const container = {
      type: 17,
      accent_color: color,

      components: [
        {
          type: 12,

          items: [
            {
              media: {
                url:
                  "attachment://zeechei-support-banner.png",
              },
            },
          ],
        },

        {
          type: 14,
          divider: true,
          spacing: 2,
        },

        {
          type: 10,

          content:
            "## Welcome to Zeechei Support\n\n" +
            "Need help with Zeechei? Join the official " +
            "support server for assistance, updates " +
            "and bot-related information.",
        },

        {
          type: 14,
          divider: true,
          spacing: 2,
        },

        {
          type: 10,

          content:
            "## Zeechei Information\n\n" +
            `**Servers**\n` +
            `\`${formatNumber(serverCount)}\`\n\n` +
            `**Users**\n` +
            `\`${formatNumber(userCount)}\`\n\n` +
            `**Default Prefix**\n` +
            `\`${prefix}\`\n\n` +
            "**Status**\n" +
            "`Online`",
        },

        {
          type: 14,
          divider: true,
          spacing: 2,
        },

        {
          type: 10,

          content:
            "## Official Links\n\n" +

            `**Support Server**\n` +
            (
              supportServer
                ? `[Join Support Server](${supportServer})`
                : "`Not configured`"
            ) +

            "\n\n" +

            `**Website**\n` +
            (
              website
                ? `[Open Website](${website})`
                : "`Not configured`"
            ) +

            "\n\n" +

            `**Vote**\n` +
            (
              voteUrl
                ? `[Vote for Zeechei](${voteUrl})`
                : "`Not configured`"
            ),
        },

        ...(buttons.length
          ? [
              {
                type: 1,

                components:
                  buttons.map(
                    button => button.toJSON()
                  ),
              },
            ]
          : []),
      ],
    };

    return message.reply({
      components: [container],
      files: [bannerFile],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};