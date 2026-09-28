const fs = require("fs");
const path = require("path");

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionsBitField,
} = require("discord.js");

const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { fetch } = require("undici");

const CONFIG_PATH = path.join(
  process.cwd(),
  "data",
  "greet.json"
);

fs.mkdirSync(path.dirname(CONFIG_PATH), {
  recursive: true,
});

let store = null;
const initializedClients = new WeakSet();

function loadStore() {
  if (store) return store;

  try {
    store = JSON.parse(
      fs.readFileSync(CONFIG_PATH, "utf8")
    );
  } catch {
    store = {};
  }

  return store;
}

function saveStore() {
  try {
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify(loadStore(), null, 2)
    );
  } catch (err) {
    console.error("[Greet] Save error:", err);
  }
}

function getGuildConfig(guildId) {
  const db = loadStore();

  if (!db[guildId]) {
    db[guildId] = {
      enabled: false,
      channelId: null,

      message:
        "Welcome {user} to {server}!",

      card: true,

      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveStore();
  }

  return db[guildId];
}

function deleteGuildConfig(guildId) {
  const db = loadStore();

  delete db[guildId];

  saveStore();
}

function hasManageGuild(member) {
  if (!member) return false;

  return member.permissions?.has(
    PermissionsBitField.Flags.ManageGuild
  );
}

function replaceVariables(text, member) {
  if (!text) return "";

  const guild = member.guild;
  const user = member.user;

  return String(text)
    .replaceAll(
      "{user}",
      `<@${user.id}>`
    )
    .replaceAll(
      "{mention}",
      `<@${user.id}>`
    )
    .replaceAll(
      "{username}",
      user.username
    )
    .replaceAll(
      "{displayname}",
      member.displayName || user.username
    )
    .replaceAll(
      "{server}",
      guild.name
    )
    .replaceAll(
      "{membercount}",
      String(guild.memberCount)
    )
    .replaceAll(
      "{id}",
      user.id
    )
    .replaceAll(
      "{channel}",
      `<#${guild.systemChannelId || ""}>`
    )
    .replaceAll(
      "{created}",
      `<t:${Math.floor(
        user.createdTimestamp / 1000
      )}:R>`
    )
    .replaceAll(
      "{joined}",
      `<t:${Math.floor(
        Date.now() / 1000
      )}:R>`
    );
}

async function fetchImage(url) {
  if (!url) return null;

  try {
    const response = await fetch(url);

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

function roundedRect(
  ctx,
  x,
  y,
  width,
  height,
  radius
) {
  const r = Math.min(
    radius,
    width / 2,
    height / 2
  );

  ctx.beginPath();

  ctx.moveTo(x + r, y);

  ctx.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    r
  );

  ctx.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    r
  );

  ctx.arcTo(
    x,
    y + height,
    x,
    y,
    r
  );

  ctx.arcTo(
    x,
    y,
    x + width,
    y,
    r
  );

  ctx.closePath();
}

function drawRoundedImage(
  ctx,
  image,
  x,
  y,
  width,
  height,
  radius
) {
  if (!image) return;

  ctx.save();

  roundedRect(
    ctx,
    x,
    y,
    width,
    height,
    radius
  );

  ctx.clip();

  const scale = Math.max(
    width / image.width,
    height / image.height
  );

  const drawWidth =
    image.width * scale;

  const drawHeight =
    image.height * scale;

  const drawX =
    x + (width - drawWidth) / 2;

  const drawY =
    y + (height - drawHeight) / 2;

  ctx.drawImage(
    image,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );

  ctx.restore();
}

function drawCircularImage(
  ctx,
  image,
  x,
  y,
  size
) {
  if (!image) return;

  ctx.save();

  ctx.beginPath();

  ctx.arc(
    x + size / 2,
    y + size / 2,
    size / 2,
    0,
    Math.PI * 2
  );

  ctx.clip();

  const scale = Math.max(
    size / image.width,
    size / image.height
  );

  const width =
    image.width * scale;

  const height =
    image.height * scale;

  ctx.drawImage(
    image,
    x + (size - width) / 2,
    y + (size - height) / 2,
    width,
    height
  );

  ctx.restore();
}

function text(
  ctx,
  value,
  x,
  y,
  size,
  weight = "400",
  align = "left"
) {
  ctx.font =
    `${weight} ${size}px Arial`;

  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  ctx.fillText(
    String(value),
    x,
    y
  );
}

function fitText(
  ctx,
  value,
  maxWidth,
  startSize,
  minSize = 18,
  weight = "700"
) {
  let size = startSize;

  while (size > minSize) {
    ctx.font =
      `${weight} ${size}px Arial`;

    if (
      ctx.measureText(String(value))
        .width <= maxWidth
    ) {
      break;
    }

    size -= 2;
  }

  return size;
}

async function generateGuideCard() {
  const W = 1500;
  const H = 850;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(
    0,
    0,
    W,
    H
  );

  bg.addColorStop(
    0,
    "#08090d"
  );

  bg.addColorStop(
    0.5,
    "#11131b"
  );

  bg.addColorStop(
    1,
    "#191329"
  );

  ctx.fillStyle = bg;
  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  const glow = ctx.createRadialGradient(
    1200,
    100,
    20,
    1200,
    100,
    600
  );

  glow.addColorStop(
    0,
    "rgba(151,92,255,0.30)"
  );

  glow.addColorStop(
    1,
    "rgba(151,92,255,0)"
  );

  ctx.fillStyle = glow;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  ctx.fillStyle =
    "#9d6cff";

  roundedRect(
    ctx,
    65,
    60,
    180,
    42,
    21
  );

  ctx.fill();

  ctx.fillStyle =
    "#ffffff";

  text(
    ctx,
    "ZEECHEI SYSTEM",
    155,
    81,
    17,
    "700",
    "center"
  );

  ctx.fillStyle =
    "#ffffff";

  text(
    ctx,
    "Zeechei Greet System",
    65,
    165,
    58,
    "800"
  );

  ctx.fillStyle =
    "#a9acb8";

  text(
    ctx,
    "A complete server greeting system with live welcome cards.",
    68,
    215,
    22,
    "400"
  );

  const cards = [
    [
      "CREATE",
      "+greet create #channel",
      "Create a greeting configuration.",
    ],
    [
      "SET",
      "+greet set #channel",
      "Enable the automatic welcome card.",
    ],
    [
      "TEST",
      "+greet test",
      "Preview the current welcome card.",
    ],
    [
      "CONFIG",
      "+greet config",
      "View the complete server configuration.",
    ],
    [
      "DELETE",
      "+greet delete",
      "Remove the greeting system.",
    ],
    [
      "MESSAGE",
      "+greet config message ...",
      "Change the welcome message.",
    ],
  ];

  let startX = 65;
  let startY = 285;

  for (let i = 0; i < cards.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);

    const x =
      startX + col * 700;

    const y =
      startY + row * 145;

    ctx.fillStyle =
      "rgba(255,255,255,0.045)";

    roundedRect(
      ctx,
      x,
      y,
      650,
      115,
      18
    );

    ctx.fill();

    ctx.strokeStyle =
      "rgba(255,255,255,0.08)";

    ctx.lineWidth = 1;

    ctx.stroke();

    ctx.fillStyle =
      "#a874ff";

    text(
      ctx,
      cards[i][0],
      x + 25,
      y + 27,
      14,
      "800"
    );

    ctx.fillStyle =
      "#ffffff";

    text(
      ctx,
      cards[i][1],
      x + 25,
      y + 57,
      20,
      "700"
    );

    ctx.fillStyle =
      "#9699a5";

    text(
      ctx,
      cards[i][2],
      x + 25,
      y + 87,
      15,
      "400"
    );
  }

  ctx.strokeStyle =
    "rgba(255,255,255,0.10)";

  ctx.beginPath();

  ctx.moveTo(65, 755);
  ctx.lineTo(1435, 755);

  ctx.stroke();

  ctx.fillStyle =
    "#858895";

  text(
    ctx,
    "Variables: {user}  {username}  {displayname}  {server}  {membercount}  {id}  {channel}  {created}  {joined}",
    65,
    790,
    15,
    "400"
  );

  return canvas.toBuffer(
    "image/png"
  );
}

async function generateWelcomeCard(
  member
) {
  const W = 1500;
  const H = 650;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const guild = member.guild;
  const user = member.user;

  const avatarUrl =
    user.displayAvatarURL({
      extension: "png",
      size: 512,
    });

  const guildIconUrl =
    guild.iconURL({
      extension: "png",
      size: 256,
    });

  const [
    avatar,
    guildIcon,
  ] = await Promise.all([
    fetchImage(avatarUrl),
    fetchImage(guildIconUrl),
  ]);

  const background =
    ctx.createLinearGradient(
      0,
      0,
      W,
      H
    );

  background.addColorStop(
    0,
    "#07080c"
  );

  background.addColorStop(
    0.45,
    "#11131a"
  );

  background.addColorStop(
    1,
    "#1b1428"
  );

  ctx.fillStyle = background;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  const glow =
    ctx.createRadialGradient(
      1180,
      70,
      10,
      1180,
      70,
      650
    );

  glow.addColorStop(
    0,
    "rgba(150,91,255,0.28)"
  );

  glow.addColorStop(
    1,
    "rgba(150,91,255,0)"
  );

  ctx.fillStyle = glow;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  // Top accent

  ctx.fillStyle =
    "#9b6cff";

  roundedRect(
    ctx,
    70,
    55,
    170,
    38,
    19
  );

  ctx.fill();

  ctx.fillStyle =
    "#ffffff";

  text(
    ctx,
    "ZEECHEI GREET",
    155,
    74,
    14,
    "800",
    "center"
  );

  // User avatar

  ctx.fillStyle =
    "rgba(255,255,255,0.06)";

  roundedRect(
    ctx,
    70,
    145,
    330,
    330,
    30
  );

  ctx.fill();

  if (avatar) {
    drawCircularImage(
      ctx,
      avatar,
      115,
      190,
      240
    );
  }

  // Main text

  ctx.fillStyle =
    "#ffffff";

  text(
    ctx,
    "WELCOME",
    455,
    160,
    56,
    "800"
  );

  const username =
    member.displayName ||
    user.username;

  const usernameSize =
    fitText(
      ctx,
      username,
      850,
      43,
      24,
      "700"
    );

  ctx.fillStyle =
    "#a978ff";

  text(
    ctx,
    username,
    455,
    220,
    usernameSize,
    "700"
  );

  ctx.fillStyle =
    "#a8abb6";

  text(
    ctx,
    "has joined the server",
    455,
    270,
    24,
    "400"
  );

  // Server panel

  ctx.fillStyle =
    "rgba(255,255,255,0.045)";

  roundedRect(
    ctx,
    455,
    325,
    950,
    150,
    22
  );

  ctx.fill();

  if (guildIcon) {
    drawCircularImage(
      ctx,
      guildIcon,
      485,
      355,
      90
    );
  }

  const guildName =
    guild.name;

  const guildNameSize =
    fitText(
      ctx,
      guildName,
      600,
      27,
      17,
      "700"
    );

  ctx.fillStyle =
    "#ffffff";

  text(
    ctx,
    guildName,
    600,
    380,
    guildNameSize,
    "700"
  );

  ctx.fillStyle =
    "#858995";

  text(
    ctx,
    "SERVER",
    600,
    415,
    13,
    "800"
  );

  // Member count

  ctx.fillStyle =
    "#ffffff";

  text(
    ctx,
    String(guild.memberCount),
    1050,
    375,
    28,
    "800"
  );

  ctx.fillStyle =
    "#858995";

  text(
    ctx,
    "MEMBERS",
    1050,
    415,
    13,
    "800"
  );

  // User ID

  ctx.fillStyle =
    "#858995";

  text(
    ctx,
    `ID  ${user.id}`,
    485,
    515,
    14,
    "400"
  );

  // Join timestamp

  ctx.fillStyle =
    "#858995";

  text(
    ctx,
    `JOINED  ${new Date().toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    )}`,
    1050,
    515,
    14,
    "400"
  );

  ctx.strokeStyle =
    "rgba(255,255,255,0.10)";

  ctx.beginPath();

  ctx.moveTo(
    70,
    570
  );

  ctx.lineTo(
    1430,
    570
  );

  ctx.stroke();

  ctx.fillStyle =
    "#888b97";

  text(
    ctx,
    "ZEECHEI • SERVER GREETING SYSTEM",
    70,
    605,
    14,
    "700"
  );

  ctx.fillStyle =
    "#6f7280";

  text(
    ctx,
    `Member #${guild.memberCount}`,
    1430,
    605,
    14,
    "600",
    "right"
  );

  return canvas.toBuffer(
    "image/png"
  );
}

function buildGuideComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("greet:guide")
        .setLabel("Guide")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("greet:config")
        .setLabel("Config")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("greet:test")
        .setLabel("Test")
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

function buildWelcomeMessage(
  buffer,
  config,
  member
) {
  const attachment =
    new AttachmentBuilder(
      buffer,
      {
        name: "zeechei-welcome.png",
      }
    );

  const message =
    replaceVariables(
      config.message,
      member
    );

  return {
    content: message || null,

    files: [
      attachment,
    ],

    embeds: [
      new EmbedBuilder()
        .setColor("#9b6cff")
        .setImage(
          "attachment://zeechei-welcome.png"
        )
        .setFooter({
          text:
            "Zeechei Greet System",
        })
        .setTimestamp(),
    ],
  };
}

function buildConfigEmbed(
  guild,
  config
) {
  const channel =
    config.channelId
      ? `<#${config.channelId}>`
      : "`Not configured`";

  return new EmbedBuilder()
    .setColor(
      config.enabled
        ? "#9b6cff"
        : "#777b86"
    )
    .setTitle(
      "Zeechei Greet Configuration"
    )
    .setDescription(
      "Complete greeting configuration for this server."
    )
    .addFields(
      {
        name: "Status",
        value:
          config.enabled
            ? "Enabled"
            : "Disabled",
        inline: true,
      },
      {
        name: "Channel",
        value: channel,
        inline: true,
      },
      {
        name: "Welcome Card",
        value:
          config.card
            ? "Enabled"
            : "Disabled",
        inline: true,
      },
      {
        name: "Message",
        value:
          `\`${config.message || "None"}\``,
        inline: false,
      },
      {
        name: "Variables",
        value:
          [
            "`{user}`",
            "`{username}`",
            "`{displayname}`",
            "`{server}`",
            "`{membercount}`",
            "`{id}`",
            "`{channel}`",
            "`{created}`",
            "`{joined}`",
          ].join(" "),
        inline: false,
      }
    )
    .setFooter({
      text:
        `${guild.name} • Zeechei Greet`,
    })
    .setTimestamp();
}

function buildConfigButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("greet:guide")
        .setLabel("Guide")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("greet:test")
        .setLabel("Test")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("greet:refresh")
        .setLabel("Refresh")
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

async function sendWelcome(
  member
) {
  const config =
    getGuildConfig(
      member.guild.id
    );

  if (!config.enabled) {
    return false;
  }

  if (!config.channelId) {
    return false;
  }

  const channel =
    member.guild.channels.cache.get(
      config.channelId
    );

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    return false;
  }

  try {
    let buffer;

    if (config.card !== false) {
      buffer =
        await generateWelcomeCard(
          member
        );
    }

    if (!buffer) {
      await channel.send({
        content:
          replaceVariables(
            config.message,
            member
          ),
      });

      return true;
    }

    await channel.send(
      buildWelcomeMessage(
        buffer,
        config,
        member
      )
    );

    return true;
  } catch (err) {
    console.error(
      "[Greet] Welcome send error:",
      err
    );

    return false;
  }
}

function init(client) {
  if (!client) return;

  if (
    initializedClients.has(client)
  ) {
    return;
  }

  initializedClients.add(client);

  client.on(
    "guildMemberAdd",
    async member => {
      try {
        await sendWelcome(
          member
        );
      } catch (err) {
        console.error(
          "[Greet] guildMemberAdd error:",
          err
        );
      }
    }
  );

  console.log(
    "[Greet] Automatic member join listener enabled."
  );
}

async function execute({
  client,
  message,
  args = [],
}) {
  init(client);

  if (!message?.guild) {
    return message?.reply(
      "This command can only be used inside a server."
    );
  }

  const guild =
    message.guild;

  const member =
    message.member;

  const sub =
    String(args[0] || "")
      .toLowerCase();

  // +greet

  if (!sub) {
    const buffer =
      await generateGuideCard();

    const attachment =
      new AttachmentBuilder(
        buffer,
        {
          name: "zeechei-greet-guide.png",
        }
      );

    const sent =
      await message.channel.send({
        files: [
          attachment,
        ],
        embeds: [
          new EmbedBuilder()
            .setColor("#9b6cff")
            .setImage(
              "attachment://zeechei-greet-guide.png"
            )
            .setFooter({
              text:
                "Zeechei Greet System",
            }),
        ],
        components:
          buildGuideComponents(),
      });

    const collector =
      sent.createMessageComponentCollector({
        time: 300000,
      });

    collector.on(
      "collect",
      async interaction => {
        try {
          if (
            interaction.customId ===
            "greet:guide"
          ) {
            const newBuffer =
              await generateGuideCard();

            const file =
              new AttachmentBuilder(
                newBuffer,
                {
                  name:
                    "zeechei-greet-guide.png",
                }
              );

            await interaction.update({
              files: [file],
              embeds: [
                new EmbedBuilder()
                  .setColor(
                    "#9b6cff"
                  )
                  .setImage(
                    "attachment://zeechei-greet-guide.png"
                  )
                  .setFooter({
                    text:
                      "Zeechei Greet System",
                  }),
              ],
              components:
                buildGuideComponents(),
            });

            return;
          }

          if (
            interaction.customId ===
            "greet:config"
          ) {
            const cfg =
              getGuildConfig(
                guild.id
              );

            await interaction.update({
              content: null,
              files: [],
              embeds: [
                buildConfigEmbed(
                  guild,
                  cfg
                ),
              ],
              components:
                buildConfigButtons(),
            });

            return;
          }

          if (
            interaction.customId ===
            "greet:test"
          ) {
            const cfg =
              getGuildConfig(
                guild.id
              );

            if (
              !cfg.enabled ||
              !cfg.channelId
            ) {
              await interaction.reply({
                content:
                  "Greet system is not configured yet. Use `+greet set #channel`.",
                ephemeral: true,
              });

              return;
            }

            const buffer =
              await generateWelcomeCard(
                interaction.member
              );

            await interaction.reply({
              ...buildWelcomeMessage(
                buffer,
                cfg,
                interaction.member
              ),
              ephemeral: true,
            });

            return;
          }

          if (
            interaction.customId ===
            "greet:refresh"
          ) {
            const cfg =
              getGuildConfig(
                guild.id
              );

            await interaction.update({
              embeds: [
                buildConfigEmbed(
                  guild,
                  cfg
                ),
              ],
              components:
                buildConfigButtons(),
            });
          }
        } catch (err) {
          console.error(
            "[Greet] Button error:",
            err
          );
        }
      }
    );

    return;
  }

  // Permission for configuration commands

  const configurationCommands = [
    "create",
    "set",
    "delete",
    "config",
  ];

  if (
    configurationCommands.includes(
      sub
    ) &&
    !hasManageGuild(member)
  ) {
    return message.reply(
      "You need the **Manage Server** permission to configure the greet system."
    );
  }

  // +greet create #channel

  if (sub === "create") {
    const channel =
      message.mentions.channels.first();

    if (!channel) {
      return message.reply(
        "Usage: `+greet create #channel`"
      );
    }

    const cfg =
      getGuildConfig(
        guild.id
      );

    cfg.channelId =
      channel.id;

    cfg.enabled = true;
    cfg.card = true;
    cfg.updatedAt =
      Date.now();

    saveStore();

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#9b6cff")
          .setTitle(
            "Greet System Created"
          )
          .setDescription(
            `Automatic welcome cards are now enabled in ${channel}.`
          )
          .addFields(
            {
              name: "System",
              value:
                "Automatic Member + Bot Join",
              inline: true,
            },
            {
              name: "Card",
              value:
                "Enabled",
              inline: true,
            }
          )
          .setFooter({
            text:
              "Zeechei Greet System",
          })
          .setTimestamp(),
      ],
    });
  }

  // +greet set #channel

  if (sub === "set") {
    const channel =
      message.mentions.channels.first();

    if (!channel) {
      return message.reply(
        "Usage: `+greet set #channel`"
      );
    }

    const cfg =
      getGuildConfig(
        guild.id
      );

    cfg.channelId =
      channel.id;

    cfg.enabled = true;
    cfg.card = true;
    cfg.updatedAt =
      Date.now();

    saveStore();

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#9b6cff")
          .setTitle(
            "Welcome Card Activated"
          )
          .setDescription(
            `Zeechei will now automatically greet every **member and bot** joining ${channel}.`
          )
          .addFields(
            {
              name: "Server",
              value:
                guild.name,
              inline: true,
            },
            {
              name: "Channel",
              value:
                `${channel}`,
              inline: true,
            },
            {
              name: "Card",
              value:
                "Enabled",
              inline: true,
            }
          )
          .setFooter({
            text:
              "Zeechei Greet System",
          })
          .setTimestamp(),
      ],
    });
  }

  // +greet delete

  if (sub === "delete") {
    deleteGuildConfig(
      guild.id
    );

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff4f67")
          .setTitle(
            "Greet System Deleted"
          )
          .setDescription(
            "The automatic greeting configuration for this server has been removed."
          )
          .setFooter({
            text:
              "Zeechei Greet System",
          })
          .setTimestamp(),
      ],
    });
  }

  // +greet config

  if (sub === "config") {
    const action =
      String(args[1] || "")
        .toLowerCase();

    const cfg =
      getGuildConfig(
        guild.id
      );

    // +greet config

    if (!action) {
      return message.reply({
        embeds: [
          buildConfigEmbed(
            guild,
            cfg
          ),
        ],
        components:
          buildConfigButtons(),
      });
    }

    // +greet config channel #channel

    if (
      action === "channel"
    ) {
      const channel =
        message.mentions.channels.first();

      if (!channel) {
        return message.reply(
          "Usage: `+greet config channel #channel`"
        );
      }

      cfg.channelId =
        channel.id;

      cfg.enabled = true;
      cfg.updatedAt =
        Date.now();

      saveStore();

      return message.reply({
        embeds: [
          buildConfigEmbed(
            guild,
            cfg
          ),
        ],
      });
    }

    // +greet config message ...

    if (
      action === "message"
    ) {
      const newMessage =
        args
          .slice(2)
          .join(" ")
          .trim();

      if (!newMessage) {
        return message.reply(
          "Usage: `+greet config message Welcome {user} to {server}!`"
        );
      }

      cfg.message =
        newMessage;

      cfg.updatedAt =
        Date.now();

      saveStore();

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("#9b6cff")
            .setTitle(
              "Welcome Message Updated"
            )
            .setDescription(
              `\`${newMessage}\``
            )
            .addFields({
              name:
                "Available Variables",
              value:
                [
                  "`{user}`",
                  "`{username}`",
                  "`{displayname}`",
                  "`{server}`",
                  "`{membercount}`",
                  "`{id}`",
                  "`{channel}`",
                  "`{created}`",
                  "`{joined}`",
                ].join(" "),
            })
            .setFooter({
              text:
                "Zeechei Greet System",
            })
            .setTimestamp(),
        ],
      });
    }

    // +greet config card on/off

    if (
      action === "card"
    ) {
      const value =
        String(args[2] || "")
          .toLowerCase();

      if (
        ![
          "on",
          "off",
        ].includes(value)
      ) {
        return message.reply(
          "Usage: `+greet config card on` or `+greet config card off`"
        );
      }

      cfg.card =
        value === "on";

      cfg.updatedAt =
        Date.now();

      saveStore();

      return message.reply({
        embeds: [
          buildConfigEmbed(
            guild,
            cfg
          ),
        ],
      });
    }

    // +greet config enable/disable

    if (
      action === "enable" ||
      action === "disable"
    ) {
      cfg.enabled =
        action === "enable";

      cfg.updatedAt =
        Date.now();

      saveStore();

      return message.reply({
        embeds: [
          buildConfigEmbed(
            guild,
            cfg
          ),
        ],
      });
    }

    return message.reply(
      [
        "**Greet Config Commands**",
        "",
        "`+greet config`",
        "`+greet config channel #channel`",
        "`+greet config message <text>`",
        "`+greet config card on`",
        "`+greet config card off`",
        "`+greet config enable`",
        "`+greet config disable`",
      ].join("\n")
    );
  }

  // +greet test

  if (sub === "test") {
    const cfg =
      getGuildConfig(
        guild.id
      );

    if (
      !cfg.channelId
    ) {
      return message.reply(
        "Greet channel is not configured. Use `+greet set #channel` first."
      );
    }

    try {
      const buffer =
        await generateWelcomeCard(
          member
        );

      const payload =
        buildWelcomeMessage(
          buffer,
          cfg,
          member
        );

      await message.channel.send(
        payload
      );

      return;
    } catch (err) {
      console.error(
        "[Greet] Test error:",
        err
      );

      return message.reply(
        "I couldn't generate the welcome card."
      );
    }
  }

  return message.reply(
    [
      "**Zeechei Greet System**",
      "",
      "`+greet` — Open greet guide",
      "`+greet create #channel` — Create greet system",
      "`+greet set #channel` — Enable welcome card",
      "`+greet config` — View complete config",
      "`+greet test` — Test welcome card",
      "`+greet delete` — Delete greet system",
    ].join("\n")
  );
}

module.exports = {
  name: "greet",

  aliases: [
    "welcome",
    "welcomer",
  ],

  description:
    "Zeechei Greet System",

  category:
    "General",

  usage:
    "+greet [create|set|config|test|delete]",

  argsRequired: false,

  data: null,

  getSlashArgs() {
    return [];
  },

  execute,

  init,
};