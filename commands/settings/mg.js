const fs = require("fs");
const path = require("path");

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} = require("discord.js");

const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { fetch } = require("undici");

const config = require("../../config");
const { V2Builder } = require("../../utils/V2Builder");

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "mg-profile.json");

const initializedClients = new WeakSet();

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          name: "MG",
          role: "Founder & Developer",
          about:
            "Founder and main developer of Zeechei. Building clean, powerful and reliable Discord experiences.",
          website: "",
          github: "",
          instagram: "",
          discord: "",
        },
        null,
        2
      )
    );
  }
}

function loadProfile() {
  ensureData();

  try {
    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    return {
      name: data.name || "MG",
      role: data.role || "Founder & Developer",
      about:
        data.about ||
        "Founder and main developer of Zeechei.",
      website: data.website || "",
      github: data.github || "",
      instagram: data.instagram || "",
      discord: data.discord || "",
    };
  } catch {
    return {
      name: "MG",
      role: "Founder & Developer",
      about: "Founder and main developer of Zeechei.",
      website: "",
      github: "",
      instagram: "",
      discord: "",
    };
  }
}

function saveProfile(profile) {
  ensureData();

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(profile, null, 2)
  );
}

function isMainOwner(userId) {
  return String(userId) === String(config.mainOwnerId);
}

function clean(value, max = 500) {
  return String(value || "")
    .trim()
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .slice(0, max);
}

function validUrl(value) {
  if (!value) return true;

  try {
    const u = new URL(value);

    return (
      u.protocol === "https:" ||
      u.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function truncateText(ctx, text, maxWidth) {
  let value = String(text || "");

  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  }

  while (
    value.length > 1 &&
    ctx.measureText(value + "…").width > maxWidth
  ) {
    value = value.slice(0, -1);
  }

  return value + "…";
}

function roundedRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function drawCover(ctx, image, x, y, w, h, radius) {
  if (!image) return;

  const iw = image.width;
  const ih = image.height;

  const scale = Math.max(
    w / iw,
    h / ih
  );

  const nw = iw * scale;
  const nh = ih * scale;

  const dx = x + (w - nw) / 2;
  const dy = y + (h - nh) / 2;

  ctx.save();

  roundedRect(
    ctx,
    x,
    y,
    w,
    h,
    radius
  );

  ctx.clip();

  ctx.drawImage(
    image,
    dx,
    dy,
    nw,
    nh
  );

  ctx.restore();
}

async function loadImageFromUrl(url) {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    return await loadImage(buffer);
  } catch {
    return null;
  }
}

function drawPill(
  ctx,
  text,
  x,
  y,
  width
) {
  roundedRect(
    ctx,
    x,
    y,
    width,
    34,
    17
  );

  ctx.fillStyle =
    "rgba(255,255,255,0.055)";

  ctx.fill();

  ctx.strokeStyle =
    "rgba(255,255,255,0.08)";

  ctx.lineWidth = 1;

  ctx.stroke();

  ctx.font =
    "bold 12px sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.70)";

  ctx.fillText(
    text,
    x + 13,
    y + 22
  );
}

async function generateMGCard(
  client,
  guildId
) {
  const profile = loadProfile();

  const W = 1400;
  const H = 720;

  const canvas =
    createCanvas(W, H);

  const ctx =
    canvas.getContext("2d");

  let owner = null;

  try {
    owner =
      await client.users.fetch(
        config.mainOwnerId
      );
  } catch {}

  const avatarUrl =
    owner?.displayAvatarURL({
      extension: "png",
      size: 512,
    }) || null;

  const avatar =
    await loadImageFromUrl(
      avatarUrl
    );

  /*
   * Background
   */
  const bg =
    ctx.createLinearGradient(
      0,
      0,
      W,
      H
    );

  bg.addColorStop(
    0,
    "#080910"
  );

  bg.addColorStop(
    0.48,
    "#10121c"
  );

  bg.addColorStop(
    1,
    "#07080d"
  );

  ctx.fillStyle = bg;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  /*
   * Decorative glow
   */
  const glow =
    ctx.createRadialGradient(
      240,
      120,
      20,
      240,
      120,
      560
    );

  glow.addColorStop(
    0,
    "rgba(125,92,255,0.22)"
  );

  glow.addColorStop(
    0.5,
    "rgba(85,120,255,0.08)"
  );

  glow.addColorStop(
    1,
    "rgba(0,0,0,0)"
  );

  ctx.fillStyle = glow;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  /*
   * Main card
   */
  roundedRect(
    ctx,
    24,
    24,
    W - 48,
    H - 48,
    30
  );

  ctx.fillStyle =
    "rgba(15,17,27,0.92)";

  ctx.fill();

  ctx.strokeStyle =
    "rgba(255,255,255,0.09)";

  ctx.lineWidth = 2;

  ctx.stroke();

  /*
   * Accent line
   */
  const accent =
    ctx.createLinearGradient(
      24,
      0,
      W - 24,
      0
    );

  accent.addColorStop(
    0,
    "#9d7cff"
  );

  accent.addColorStop(
    0.5,
    "#617eff"
  );

  accent.addColorStop(
    1,
    "rgba(97,126,255,0)"
  );

  ctx.fillStyle = accent;

  ctx.fillRect(
    54,
    53,
    W - 108,
    3
  );

  /*
   * Header
   */
  ctx.font =
    "bold 16px sans-serif";

  ctx.fillStyle =
    "#a98cff";

  ctx.fillText(
    "MG PROFILE",
    70,
    92
  );

  ctx.font =
    "13px sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.38)";

  ctx.fillText(
    "FOUNDER / MAIN DEVELOPER",
    70,
    116
  );

  /*
   * Avatar circle
   */
  const avatarX = 70;
  const avatarY = 155;
  const avatarSize = 210;

  ctx.save();

  ctx.shadowColor =
    "rgba(0,0,0,0.55)";

  ctx.shadowBlur = 35;

  ctx.beginPath();

  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 5,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    "#11131d";

  ctx.fill();

  ctx.restore();

  if (avatar) {
    ctx.save();

    ctx.beginPath();

    ctx.arc(
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
      avatarSize / 2,
      0,
      Math.PI * 2
    );

    ctx.clip();

    ctx.drawImage(
      avatar,
      avatarX,
      avatarY,
      avatarSize,
      avatarSize
    );

    ctx.restore();
  } else {
    ctx.beginPath();

    ctx.arc(
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
      avatarSize / 2,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#252838";

    ctx.fill();

    ctx.font =
      "bold 64px sans-serif";

    ctx.fillStyle =
      "#ffffff";

    ctx.textAlign = "center";

    ctx.fillText(
      "MG",
      avatarX + avatarSize / 2,
      avatarY + 135
    );

    ctx.textAlign = "left";
  }

  /*
   * Avatar ring
   */
  ctx.beginPath();

  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 5,
    0,
    Math.PI * 2
  );

  ctx.strokeStyle =
    "rgba(157,124,255,0.72)";

  ctx.lineWidth = 3;

  ctx.stroke();

  /*
   * Profile text
   */
  const X = 325;

  ctx.font =
    "bold 46px sans-serif";

  ctx.fillStyle =
    "#ffffff";

  ctx.fillText(
    truncateText(
      ctx,
      profile.name,
      600
    ),
    X,
    190
  );

  ctx.font =
    "bold 20px sans-serif";

  ctx.fillStyle =
    "#9d7cff";

  ctx.fillText(
    truncateText(
      ctx,
      profile.role,
      600
    ),
    X,
    225
  );

  /*
   * Owner badge
   */
  drawPill(
    ctx,
    "MAIN OWNER",
    X,
    252,
    132
  );

  drawPill(
    ctx,
    "FOUNDER",
    X + 142,
    252,
    108
  );

  drawPill(
    ctx,
    "DEVELOPER",
    X + 260,
    252,
    122
  );

  /*
   * About
   */
  ctx.font =
    "bold 15px sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.42)";

  ctx.fillText(
    "ABOUT",
    X,
    325
  );

  ctx.font =
    "18px sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.78)";

  const about =
    truncateText(
      ctx,
      profile.about,
      790
    );

  ctx.fillText(
    about,
    X,
    358
  );

  /*
   * Divider
   */
  ctx.strokeStyle =
    "rgba(255,255,255,0.08)";

  ctx.lineWidth = 1;

  ctx.beginPath();

  ctx.moveTo(
    X,
    390
  );

  ctx.lineTo(
    W - 70,
    390
  );

  ctx.stroke();

  /*
   * Social section
   */
  ctx.font =
    "bold 15px sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.42)";

  ctx.fillText(
    "SOCIALS",
    70,
    450
  );

  const socialItems = [
    [
      "WEBSITE",
      profile.website,
    ],
    [
      "GITHUB",
      profile.github,
    ],
    [
      "INSTAGRAM",
      profile.instagram,
    ],
    [
      "DISCORD",
      profile.discord,
    ],
  ];

  let sx = 70;

  for (const [
    label,
    value,
  ] of socialItems) {
    const boxW = 285;

    roundedRect(
      ctx,
      sx,
      475,
      boxW,
      78,
      18
    );

    ctx.fillStyle =
      "rgba(255,255,255,0.045)";

    ctx.fill();

    ctx.strokeStyle =
      "rgba(255,255,255,0.075)";

    ctx.stroke();

    ctx.font =
      "bold 11px sans-serif";

    ctx.fillStyle =
      "rgba(255,255,255,0.36)";

    ctx.fillText(
      label,
      sx + 18,
      500
    );

    ctx.font =
      "bold 14px sans-serif";

    ctx.fillStyle =
      value
        ? "#ffffff"
        : "rgba(255,255,255,0.28)";

    let shown =
      value || "Not configured";

    shown =
      truncateText(
        ctx,
        shown,
        boxW - 36
      );

    ctx.fillText(
      shown,
      sx + 18,
      527
    );

    sx += boxW + 16;
  }

  /*
   * Bottom status
   */
  ctx.strokeStyle =
    "rgba(255,255,255,0.08)";

  ctx.beginPath();

  ctx.moveTo(
    70,
    590
  );

  ctx.lineTo(
    W - 70,
    590
  );

  ctx.stroke();

  ctx.font =
    "13px sans-serif";

  ctx.fillStyle =
    "rgba(255,255,255,0.35)";

  ctx.fillText(
    "MG • Founder & Main Developer",
    70,
    625
  );

  ctx.fillText(
    "Only the main owner can modify this profile",
    70,
    650
  );

  /*
   * Small owner ID indicator
   */
  ctx.textAlign = "right";

  ctx.fillStyle =
    "rgba(255,255,255,0.24)";

  ctx.fillText(
    `OWNER • ${config.mainOwnerId}`,
    W - 70,
    625
  );

  ctx.textAlign = "left";

  return canvas.toBuffer(
    "image/png"
  );
}

function buildCardPayload(
  client,
  guildId,
  imageBuffer
) {
  const color =
    typeof client.getColor === "function"
      ? client.getColor(guildId)
      : 0x5865f2;

  const row =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mg:config")
        .setLabel("Configure")
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId("mg:refresh")
        .setLabel("Refresh")
        .setStyle(
          ButtonStyle.Secondary
        )
    );

  return new V2Builder(color)
    .media(
      "attachment://mg-profile.png"
    )
    .sep()
    .row(row)
    .build([
      new AttachmentBuilder(
        imageBuffer,
        {
          name: "mg-profile.png",
        }
      ),
    ]);
}

function buildModal() {
  const profile =
    loadProfile();

  const website =
    new TextInputBuilder()
      .setCustomId("mg_website")
      .setLabel("Website URL")
      .setPlaceholder(
        "https://example.com"
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(false)
      .setMaxLength(200)
      .setValue(
        profile.website || ""
      );

  const github =
    new TextInputBuilder()
      .setCustomId("mg_github")
      .setLabel("GitHub URL")
      .setPlaceholder(
        "https://github.com/..."
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(false)
      .setMaxLength(200)
      .setValue(
        profile.github || ""
      );

  const instagram =
    new TextInputBuilder()
      .setCustomId("mg_instagram")
      .setLabel("Instagram URL")
      .setPlaceholder(
        "https://instagram.com/..."
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(false)
      .setMaxLength(200)
      .setValue(
        profile.instagram || ""
      );

  const discord =
    new TextInputBuilder()
      .setCustomId("mg_discord")
      .setLabel("Discord URL")
      .setPlaceholder(
        "https://discord.gg/..."
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(false)
      .setMaxLength(200)
      .setValue(
        profile.discord || ""
      );

  return new ModalBuilder()
    .setCustomId("mg_modal_socials")
    .setTitle("MG Profile — Socials")
    .addComponents(
      new ActionRowBuilder()
        .addComponents(website),

      new ActionRowBuilder()
        .addComponents(github),

      new ActionRowBuilder()
        .addComponents(instagram),

      new ActionRowBuilder()
        .addComponents(discord)
    );
}

function registerInteractions(client) {
  if (
    initializedClients.has(client)
  ) {
    return;
  }

  initializedClients.add(client);

  client.on(
    "interactionCreate",
    async (interaction) => {
      try {
        /*
         * CONFIGURE / REFRESH BUTTONS
         */
        if (interaction.isButton()) {
          if (
            interaction.customId !== "mg:config" &&
            interaction.customId !== "mg:refresh"
          ) {
            return;
          }

          const color =
            typeof client.getColor === "function"
              ? client.getColor(
                  interaction.guildId
                )
              : 0x5865f2;

          /*
           * ONLY MAIN OWNER
           */
          if (
            interaction.customId ===
              "mg:config" &&
            !isMainOwner(
              interaction.user.id
            )
          ) {
            return interaction.reply(
              new V2Builder(color)
                .text(
                  `# Access Denied\n\n` +
                  `> Only the **main owner** can configure the MG profile.`
                )
                .buildEphemeral()
            );
          }

          if (
            interaction.customId ===
            "mg:refresh"
          ) {
            const buffer =
              await generateMGCard(
                client,
                interaction.guildId
              );

            return interaction.update(
              buildCardPayload(
                client,
                interaction.guildId,
                buffer
              )
            );
          }

          return interaction.showModal(
            buildModal()
          );
        }

        /*
         * MODAL SUBMIT
         */
        if (
          interaction.isModalSubmit() &&
          interaction.customId ===
            "mg_modal_socials"
        ) {
          const color =
            typeof client.getColor === "function"
              ? client.getColor(
                  interaction.guildId
                )
              : 0x5865f2;

          /*
           * MAIN OWNER CHECK
           */
          if (
            !isMainOwner(
              interaction.user.id
            )
          ) {
            return interaction.reply(
              new V2Builder(color)
                .text(
                  `# Access Denied\n\n` +
                  `> Only the **main owner** can modify the MG profile.`
                )
                .buildEphemeral()
            );
          }

          /*
           * ACK MODAL FIRST
           *
           * Fixes Discord:
           * "Something went wrong. Try again."
           */
          await interaction.deferReply({
            ephemeral: true,
          });

          const website =
            clean(
              interaction.fields.getTextInputValue(
                "mg_website"
              ),
              200
            );

          const github =
            clean(
              interaction.fields.getTextInputValue(
                "mg_github"
              ),
              200
            );

          const instagram =
            clean(
              interaction.fields.getTextInputValue(
                "mg_instagram"
              ),
              200
            );

          const discord =
            clean(
              interaction.fields.getTextInputValue(
                "mg_discord"
              ),
              200
            );

          const urls = [
            ["Website", website],
            ["GitHub", github],
            ["Instagram", instagram],
            ["Discord", discord],
          ];

          for (
            const [label, url] of urls
          ) {
            if (
              url &&
              !validUrl(url)
            ) {
              return interaction.editReply(
                new V2Builder(color)
                  .text(
                    `# Invalid URL\n\n` +
                    `> **${label}** is not a valid URL.\n\n` +
                    `> Use a complete URL beginning with \`https://\`.`
                  )
                  .buildEphemeral()
              );
            }
          }

          const profile =
            loadProfile();

          profile.website =
            website;

          profile.github =
            github;

          profile.instagram =
            instagram;

          profile.discord =
            discord;

          saveProfile(
            profile
          );

          /*
           * SUCCESS
           */
          return interaction.editReply(
            new V2Builder(color)
              .text(
                `# MG Profile Updated\n\n` +
                `> The MG profile configuration has been saved successfully.\n\n` +
                `> Use **Refresh** on the profile card to display the latest information.`
              )
              .buildEphemeral()
          );
        }
      } catch (error) {
        console.error(
          "[MG] Interaction Error:",
          error
        );

        try {
          if (
            interaction.deferred
          ) {
            await interaction.editReply(
              new V2Builder(
                typeof client.getColor ===
                  "function"
                  ? client.getColor(
                      interaction.guildId
                    )
                  : 0x5865f2
              )
                .text(
                  `# MG Error\n\n` +
                  `> Something went wrong while processing the MG configuration.`
                )
                .buildEphemeral()
            );
          } else if (
            !interaction.replied
          ) {
            await interaction.reply(
              new V2Builder(
                typeof client.getColor ===
                  "function"
                  ? client.getColor(
                      interaction.guildId
                    )
                  : 0x5865f2
              )
                .text(
                  `# MG Error\n\n` +
                  `> Something went wrong while processing the MG configuration.`
                )
                .buildEphemeral()
            );
          }
        } catch {}
      }
    }
  );
}

module.exports = {
  name: "mg",

  aliases: [
    "mgprofile",
    "founder",
  ],

  description:
    "Show the MG founder profile.",

  category: "Settings",

  usage:
    "mg [config]",

  argsRequired: false,

  /*
   * IMPORTANT:
   * Do NOT set mainOwnerOnly here.
   *
   * Everyone can VIEW the MG card.
   * Only config.mainOwnerId can MODIFY it.
   */

  data: {
    name: "mg",
    description:
      "Show the MG founder profile.",
  },

  getSlashArgs() {
    return [];
  },

  async execute({
    client,
    message,
    args,
  }) {
    if (!message.guild) {
      return;
    }

    registerInteractions(
      client
    );

    const sub =
      String(
        args?.[0] || ""
      ).toLowerCase();

    /*
     * +mg config
     */
    if (
      sub === "config"
    ) {
      if (
        !isMainOwner(
          message.author.id
        )
      ) {
        return message.reply(
          new V2Builder(
            typeof client.getColor ===
              "function"
              ? client.getColor(
                  message.guild.id
                )
              : 0x5865f2
          )
            .text(
              `# Access Denied\n\n` +
              `> Only the **main owner** can configure the MG profile.`
            )
            .buildEphemeral()
        );
      }

      return message.reply(
        new V2Builder(
          typeof client.getColor ===
            "function"
            ? client.getColor(
                message.guild.id
              )
            : 0x5865f2
        )
          .text(
            `# MG Configuration\n\n` +
            `> Choose **Configure** below to edit the MG social information.\n\n` +
            `> **Owner:** <@${config.mainOwnerId}>`
          )
          .sep()
          .row(
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    "mg:config"
                  )
                  .setLabel(
                    "Configure"
                  )
                  .setStyle(
                    ButtonStyle.Primary
                  )
              )
          )
          .build()
      );
    }

    /*
     * NORMAL +mg
     */
    const buffer =
      await generateMGCard(
        client,
        message.guild.id
      );

    return message.reply(
      buildCardPayload(
        client,
        message.guild.id,
        buffer
      )
    );
  },
};