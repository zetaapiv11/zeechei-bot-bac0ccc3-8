const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");

const { createCanvas } = require("@napi-rs/canvas");

const config = require("../config");
const Database = require("../database/Database");
const WebhookLogger = require("../logger/WebhookLogger");
const { sendUsage } = require("../utils/sendUsage");
const MessageContext = require("../music/MessageContext");

// ============================================================
// MESSAGE STATS
// ============================================================

let messageStats = null;

try {
  messageStats = require("../commands/general/message.js");
} catch (error) {
  console.warn(
    "[Message Stats] Unable to load message command:",
    error?.message || error
  );
}

// ============================================================
// COOLDOWN / SPAM TRACKING
// ============================================================

const cooldowns = new Map();

const COOLDOWN_MS = 2000;

const spamBurst = new Map();

const SPAM_WINDOW_MS = 60_000;
const SPAM_MAX_CMDS = 10;

const AUTO_BL_DURATION =
  24 * 60 * 60 * 1000;

// ============================================================
// HELPERS
// ============================================================

function isOwner(userId) {
  return (
    config.ownerIds?.includes(userId) ||
    userId === config.ownerId ||
    Database.isOwner(userId)
  );
}

function isMainOwner(userId) {
  return userId === config.mainOwnerId;
}

function relTime(ts) {
  return `<t:${Math.floor(ts / 1000)}:R>`;
}

function truncate(text, max = 90) {
  const value = String(text ?? "");

  if (value.length <= max) {
    return value;
  }

  return value.slice(0, max - 3) + "...";
}

function getColor(client, guildId) {
  try {
    const color = client.getColor(guildId);

    if (typeof color === "number") {
      return `#${color
        .toString(16)
        .padStart(6, "0")}`;
    }

    if (color) {
      return color;
    }
  } catch {}

  return "#ff0000";
}

// ============================================================
// NO PREFIX CHECK
// ============================================================

function hasNoPrefixAccess(userId) {
  try {
    if (!userId) {
      return false;
    }

    if (
      typeof Database.isNoPrefix ===
      "function"
    ) {
      return Boolean(
        Database.isNoPrefix(
          String(userId)
        )
      );
    }
  } catch (error) {
    console.error(
      "[No Prefix Check Error]",
      error?.message || error
    );
  }

  return false;
}

// ============================================================
// COMMAND RESOLVER
// ============================================================

function resolveCommand(
  client,
  commandName
) {
  if (!client || !commandName) {
    return null;
  }

  const name = String(
    commandName
  )
    .toLowerCase()
    .trim();

  if (!name) {
    return null;
  }

  // Direct command
  const direct =
    client.commands?.get(name);

  if (direct) {
    return direct;
  }

  // Alias
  const alias =
    client.aliases?.get(name);

  if (!alias) {
    return null;
  }

  if (typeof alias === "string") {
    return (
      client.commands?.get(
        alias
      ) || null
    );
  }

  if (
    typeof alias === "object" &&
    typeof alias.execute ===
      "function"
  ) {
    return alias;
  }

  return null;
}

// ============================================================
// PREMIUM BANNER GENERATOR
// ============================================================

function createBanner({
  title,
  subtitle = "",
  lines = [],
  color = "#ff0000",
  width = 1100,
  height = 500,
}) {
  const canvas =
    createCanvas(
      width,
      height
    );

  const ctx =
    canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#050505";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  // Outer panel
  ctx.fillStyle = "#0c0c0c";

  ctx.fillRect(
    24,
    24,
    width - 48,
    height - 48
  );

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.strokeRect(
    24,
    24,
    width - 48,
    height - 48
  );

  // Accent
  ctx.fillStyle = color;

  ctx.fillRect(
    24,
    24,
    width - 48,
    7
  );

  // Inner line
  ctx.strokeStyle =
    "#1d1d1d";

  ctx.lineWidth = 1;

  ctx.strokeRect(
    42,
    42,
    width - 84,
    height - 84
  );

  // Accent square
  ctx.fillStyle = color;

  ctx.fillRect(
    60,
    65,
    10,
    10
  );

  // Title
  ctx.font =
    "bold 38px Arial";

  ctx.fillStyle =
    "#ffffff";

  ctx.fillText(
    truncate(
      title,
      42
    ),
    85,
    80
  );

  // Subtitle
  if (subtitle) {
    ctx.font =
      "20px Arial";

    ctx.fillStyle =
      "#8d8d8d";

    ctx.fillText(
      truncate(
        subtitle,
        90
      ),
      85,
      116
    );
  }

  // Divider
  ctx.strokeStyle =
    "#242424";

  ctx.lineWidth = 1;

  ctx.beginPath();

  ctx.moveTo(
    60,
    145
  );

  ctx.lineTo(
    width - 60,
    145
  );

  ctx.stroke();

  let y = 185;

  for (const line of lines) {
    if (
      y >
      height - 90
    ) {
      break;
    }

    if (!line) {
      y += 18;
      continue;
    }

    if (
      typeof line ===
      "string"
    ) {
      ctx.font =
        "bold 21px Arial";

      ctx.fillStyle =
        "#ffffff";

      ctx.fillText(
        truncate(
          line,
          88
        ),
        70,
        y
      );

      y += 39;
      continue;
    }

    ctx.font =
      "bold 18px Arial";

    ctx.fillStyle =
      color;

    ctx.fillText(
      truncate(
        line.label || "",
        28
      ),
      70,
      y
    );

    ctx.font =
      "19px Arial";

    ctx.fillStyle =
      "#dddddd";

    ctx.fillText(
      truncate(
        line.value || "",
        72
      ),
      335,
      y
    );

    y += 39;
  }

  // Footer
  ctx.font =
    "15px Arial";

  ctx.fillStyle =
    "#555555";

  ctx.fillText(
    "ZEECHEI MUSIC • PREMIUM EXPERIENCE",
    60,
    height - 55
  );

  return canvas.toBuffer(
    "image/png"
  );
}

// ============================================================
// BANNER RESPONSE
// ============================================================

function createBannerResponse(
  client,
  guildId,
  {
    title,
    subtitle,
    lines = [],
    height = 500,
    buttons = [],
    footer = "Zeechei Music",
  }
) {
  const color =
    getColor(
      client,
      guildId
    );

  const buffer =
    createBanner({
      title,
      subtitle,
      lines,
      color,
      height,
    });

  const attachment =
    new AttachmentBuilder(
      buffer,
      {
        name:
          "zeechei-response.png",
      }
    );

  const components = [];

  components.push({
    type: 12,
    items: [
      {
        media: {
          url:
            "attachment://zeechei-response.png",
        },
      },
    ],
  });

  if (footer) {
    components.push({
      type: 10,
      content:
        `-# ${footer}`,
    });
  }

  if (buttons.length) {
    components.push(
      new ActionRowBuilder().addComponents(
        ...buttons
      )
    );
  }

  return {
    components,
    files: [
      attachment,
    ],
    flags:
      MessageFlags.IsComponentsV2,
  };
}

// ============================================================
// SEND BANNER
// ============================================================

async function sendBanner(
  client,
  message,
  guildId,
  data
) {
  try {
    return await message.reply(
      createBannerResponse(
        client,
        guildId,
        data
      )
    );
  } catch (error) {
    console.error(
      "[Banner Response Error]",
      error?.message || error
    );

    return null;
  }
}

// ============================================================
// CHECK IF MESSAGE IS A REPLY TO ZEECHEI
// ============================================================

async function isReplyToZeechei(
  message,
  client
) {
  try {
    if (
      !message.reference?.messageId
    ) {
      return false;
    }

    const botId =
      client.user?.id;

    if (!botId) {
      return false;
    }

    // If Discord already supplied the resolved message
    if (
      message.mentions?.repliedUser?.id
    ) {
      return (
        message.mentions
          .repliedUser.id ===
        botId
      );
    }

    // Fetch referenced message if needed
    const referenced =
      await message.channel.messages
        .fetch(
          message.reference.messageId
        )
        .catch(
          () => null
        );

    if (!referenced) {
      return false;
    }

    return (
      referenced.author?.id ===
      botId
    );
  } catch (error) {
    return false;
  }
}

// ============================================================
// MODULE
// ============================================================

module.exports = {
  name:
    "messageCreate",

  once: false,

  async execute(
    client,
    message
  ) {
    // ========================================================
    // BASIC MESSAGE CHECK
    // ========================================================

    if (!message) {
      return;
    }

    if (!message.author) {
      return;
    }

    if (
      message.author.bot
    ) {
      return;
    }

    if (!message.guild) {
      return;
    }

    const userId =
      String(
        message.author.id
      );

    const guildId =
      String(
        message.guild.id
      );

    // ========================================================
    // LIVE MESSAGE STATISTICS
    // ========================================================

    try {
      if (
        messageStats &&
        typeof messageStats.recordMessage ===
          "function"
      ) {
        messageStats.recordMessage({
          guildId,
          userId,
          username:
            message.author.username,
        });
      }
    } catch (error) {
      console.error(
        "[Message Stats]",
        error?.message || error
      );
    }

    // ========================================================
    // COLOR
    // ========================================================

    const color =
      getColor(
        client,
        guildId
      );

    // ========================================================
    // AFK — MENTION DETECTION
    // ========================================================

    if (
      message.mentions?.users?.size
    ) {
      const notifs = [];

      for (
        const [, user] of
          message.mentions.users
      ) {
        if (
          user.bot ||
          user.id === userId
        ) {
          continue;
        }

        const afkData =
          Database.getAfk(
            guildId,
            user.id
          );

        if (!afkData) {
          continue;
        }

        const reason =
          afkData.reason ||
          "No reason provided";

        const scope =
          afkData.type ===
          "global"
            ? "Global"
            : "This server";

        const messageUrl =
          `https://discord.com/channels/${guildId}/${message.channel.id}/${message.id}`;

        Database.addAfkPing(
          guildId,
          user.id,
          userId,
          message.author.username,
          messageUrl
        );

        notifs.push({
          user,
          reason,
          scope,
          timestamp:
            afkData.timestamp,
          messageUrl,
        });

        // ----------------------------------------------------
        // DM AFK USER
        // ----------------------------------------------------

        try {
          const dmPayload =
            createBannerResponse(
              client,
              guildId,
              {
                title:
                  "YOU WERE MENTIONED",

                subtitle:
                  `${message.author.username} mentioned you while you were AFK`,

                lines: [
                  {
                    label:
                      "Mentioned By",
                    value:
                      message.author.username,
                  },
                  {
                    label:
                      "Server",
                    value:
                      message.guild.name,
                  },
                  {
                    label:
                      "Channel",
                    value:
                      `#${message.channel.name}`,
                  },
                  {
                    label:
                      "AFK Reason",
                    value:
                      reason,
                  },
                  {
                    label:
                      "AFK Since",
                    value:
                      relTime(
                        afkData.timestamp
                      ),
                  },
                ],

                height:
                  500,

                footer:
                  "Zeechei AFK System",
              }
            );

          dmPayload.components.push(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel(
                  "Jump to Message"
                )
                .setURL(
                  messageUrl
                )
                .setStyle(
                  ButtonStyle.Link
                )
            )
          );

          await user
            .send(
              dmPayload
            )
            .catch(
              () => {}
            );
        } catch (_) {}
      }

      // ------------------------------------------------------
      // SEND AFK RESPONSE
      // ------------------------------------------------------

      if (
        notifs.length
      ) {
        const first =
          notifs[0];

        const mentionLines =
          notifs
            .slice(0, 8)
            .map(
              item => ({
                label:
                  `@${item.user.username}`,
                value:
                  item.reason,
              })
            );

        const extra =
          notifs.length > 8
            ? [
                {
                  label:
                    "More",
                  value:
                    `${notifs.length - 8} more AFK users`,
                },
              ]
            : [];

        await sendBanner(
          client,
          message,
          guildId,
          {
            title:
              notifs.length === 1
                ? "USER IS AFK"
                : "USERS ARE AFK",

            subtitle:
              notifs.length === 1
                ? `${first.user.username} is currently away`
                : `${notifs.length} mentioned users are currently away`,

            lines: [
              ...mentionLines,
              ...extra,
              {
                label:
                  "AFK Status",
                value:
                  "Your message was recorded",
              },
            ],

            height:
              notifs.length > 4
                ? 560
                : 500,

            footer:
              "Zeechei AFK System",
          }
        );
      }
    }

    // ========================================================
    // AFK — AUTO REMOVE
    // ========================================================

    const userAfk =
      Database.getAfk(
        guildId,
        userId
      );

    if (userAfk) {
      const removed =
        Database.removeAfk(
          guildId,
          userId
        );

      if (removed) {
        const wasGlobal =
          userAfk.type ===
          "global";

        const pings =
          Database.getAfkPings(
            guildId,
            userId
          );

        Database.clearAfkPings(
          guildId,
          userId
        );

        const lines = [
          {
            label:
              "Status",
            value:
              "AFK status removed",
          },
          {
            label:
              "Scope",
            value:
              wasGlobal
                ? "Global"
                : "This server",
          },
          {
            label:
              "Previous Reason",
            value:
              userAfk.reason ||
              "No reason provided",
          },
        ];

        if (
          pings.length > 0
        ) {
          lines.push({
            label:
              "Mentions",
            value:
              `${pings.length} time${
                pings.length !== 1
                  ? "s"
                  : ""
              } while AFK`,
          });

          pings
            .slice(-5)
            .forEach(
              p => {
                lines.push({
                  label:
                    p.pingerName,
                  value:
                    "Mentioned you",
                });
              }
            );
        }

        await sendBanner(
          client,
          message,
          guildId,
          {
            title:
              "WELCOME BACK",

            subtitle:
              `${message.author.username}, your AFK status has been removed`,

            lines,

            height:
              pings.length > 0
                ? 570
                : 460,

            footer:
              "Zeechei AFK System",
          }
        );
      }
    }

    // ========================================================
    // BLACKLIST
    // ========================================================

    if (
      Database.isBlacklisted(
        userId
      )
    ) {
      return;
    }

    // ========================================================
    // IMPORTANT:
    // REPLY TO ZEECHEI IS NOT A BOT MENTION COMMAND
    // ========================================================

    const replyingToZeechei =
      await isReplyToZeechei(
        message,
        client
      );

    // ========================================================
    // ZEECHEI DIRECT MENTION
    // ONLY WHEN IT IS ACTUALLY A MENTION
    // AND NOT A REPLY TO ZEECHEI
    // ========================================================

    const botId =
      client.user?.id;

    const directlyMentioned =
      Boolean(
        botId &&
        message.mentions?.users?.has(
          botId
        )
      );

    if (
      directlyMentioned &&
      !replyingToZeechei
    ) {
      const prefix =
        Database.getPrefix(
          guildId
        ) ||
        config.prefix ||
        ".";

      // ------------------------------------------------------
      // CLEAN PREFIX EMBED
      // ------------------------------------------------------

      const embed =
        new EmbedBuilder()
          .setColor(color)
          .setDescription(
            [
              `${message.author}: **bot's prefix** for this **server** is \`${prefix}\``,
              `-# <:AD_Reply:1550932812968763524> **Set a new prefix using** \`setprefix\``,
            ].join("\n")
          );

      try {
        await message.channel.send({
          embeds: [
            embed,
          ],

          allowedMentions: {
            users: [],
            repliedUser:
              false,
          },
        });

        try {
          await WebhookLogger.botPinged(
            message.author.tag,
            message.guild.name
          );
        } catch (_) {}
      } catch (error) {
        console.error(
          "[Zeechei Mention Error]",
          error?.message ||
            error
        );
      }

      return;
    }

    // ========================================================
    // PREFIX
    // ========================================================

    const prefix =
      Database.getPrefix(
        guildId
      ) ||
      config.prefix ||
      ".";

    const raw =
      String(
        message.content || ""
      ).trim();

    if (!raw) {
      return;
    }

    // ========================================================
    // PREFIX / NO PREFIX
    // ========================================================

    const hasPrefix =
      Boolean(
        prefix &&
        raw.startsWith(
          prefix
        )
      );

    const noPrefix =
      hasNoPrefixAccess(
        userId
      );

    // Normal user without prefix
    if (
      !hasPrefix &&
      !noPrefix
    ) {
      return;
    }

    // ========================================================
    // GET COMMAND CONTENT
    // ========================================================

    let content;

    if (hasPrefix) {
      content =
        raw
          .slice(
            prefix.length
          )
          .trim();
    } else {
      content =
        raw.trim();
    }

    if (!content) {
      return;
    }

    // ========================================================
    // PARSE COMMAND
    // ========================================================

    const parts =
      content.split(
        /\s+/
      );

    const cmdName =
      String(
        parts.shift() || ""
      )
        .toLowerCase()
        .trim();

    if (!cmdName) {
      return;
    }

    const args =
      parts;

    // ========================================================
    // RESOLVE COMMAND
    // ========================================================

    const command =
      resolveCommand(
        client,
        cmdName
      );

    if (!command) {
      return;
    }

    // ========================================================
    // SPAM BURST
    // ========================================================

    if (
      !isOwner(userId)
    ) {
      const now =
        Date.now();

      const burst =
        spamBurst.get(
          userId
        ) || {
          count:
            0,
          windowStart:
            now,
        };

      if (
        now -
          burst.windowStart >
        SPAM_WINDOW_MS
      ) {
        burst.count =
          0;

        burst.windowStart =
          now;
      }

      burst.count++;

      spamBurst.set(
        userId,
        burst
      );

      // ------------------------------------------------------
      // AUTO BLACKLIST
      // ------------------------------------------------------

      if (
        burst.count >
        SPAM_MAX_CMDS
      ) {
        const expiresAt =
          Database.addTimedBlacklist(
            userId,
            AUTO_BL_DURATION
          );

        spamBurst.delete(
          userId
        );

        cooldowns.delete(
          userId
        );

        const userTag =
          message.author.tag;

        const guildName =
          message.guild.name;

        try {
          await WebhookLogger.autoBlacklist(
            userTag,
            userId,
            guildName,
            burst.count,
            SPAM_WINDOW_MS / 1000,
            expiresAt
          );
        } catch (_) {}

        // ----------------------------------------------------
        // OWNER ALERT
        // ----------------------------------------------------

        client.users
          .fetch(
            config.mainOwnerId
          )
          .then(
            async owner => {
              if (!owner) {
                return;
              }

              const ownerPayload =
                createBannerResponse(
                  client,
                  guildId,
                  {
                    title:
                      "AUTO-BLACKLIST ALERT",

                    subtitle:
                      "Command spam protection triggered",

                    lines: [
                      {
                        label:
                          "User",
                        value:
                          userTag,
                      },
                      {
                        label:
                          "User ID",
                        value:
                          userId,
                      },
                      {
                        label:
                          "Server",
                        value:
                          guildName,
                      },
                      {
                        label:
                          "Commands",
                        value:
                          `${burst.count} commands / 1 minute`,
                      },
                      {
                        label:
                          "Expires",
                        value:
                          relTime(
                            expiresAt
                          ),
                      },
                    ],

                    height:
                      500,

                    footer:
                      "Zeechei Security System",
                  }
                );

              await owner
                .send(
                  ownerPayload
                )
                .catch(
                  () => {}
                );
            }
          )
          .catch(
            () => {}
          );

        // ----------------------------------------------------
        // USER RESPONSE
        // ----------------------------------------------------

        await sendBanner(
          client,
          message,
          guildId,
          {
            title:
              "AUTO-BLACKLISTED",

            subtitle:
              "Command spam protection has been triggered",

            lines: [
              {
                label:
                  "Status",
                value:
                  "Blacklisted",
              },
              {
                label:
                  "Commands",
                value:
                  `${burst.count} commands in 1 minute`,
              },
              {
                label:
                  "Expires",
                value:
                  relTime(
                    expiresAt
                  ),
              },
              {
                label:
                  "Reason",
                value:
                  "Command spam",
              },
              {
                label:
                  "Help",
                value:
                  "Contact a bot owner if this was a mistake",
              },
            ],

            height:
              520,

            footer:
              "Zeechei Security System",
          }
        );

        return;
      }
    } else {
      spamBurst.delete(
        userId
      );
    }

    // ========================================================
    // COOLDOWN
    // ========================================================

    if (
      !isOwner(userId)
    ) {
      const now =
        Date.now();

      const last =
        cooldowns.get(
          userId
        ) || 0;

      const diff =
        now - last;

      if (
        diff <
        COOLDOWN_MS
      ) {
        const left =
          (
            (
              COOLDOWN_MS -
              diff
            ) /
            1000
          ).toFixed(1);

        try {
          await WebhookLogger.rateLimit(
            message.author.tag,
            message.guild.name,
            cmdName
          );
        } catch (_) {}

        const cooldownMessage =
          await sendBanner(
            client,
            message,
            guildId,
            {
              title:
                "SLOW DOWN",

              subtitle:
                "Zeechei needs a moment before your next command",

              lines: [
                {
                  label:
                    "Command",
                  value:
                    `${prefix}${cmdName}`,
                },
                {
                  label:
                    "Cooldown",
                  value:
                    `${left}s remaining`,
                },
                {
                  label:
                    "Tip",
                  value:
                    "Please wait before sending another command",
                },
              ],

              height:
                400,

              footer:
                "Zeechei Rate Limit",
            }
          );

        if (
          cooldownMessage
        ) {
          setTimeout(
            () => {
              cooldownMessage
                .delete()
                .catch(
                  () => {}
                );
            },
            2500
          );
        }

        return;
      }

      cooldowns.set(
        userId,
        now
      );

      if (
        cooldowns.size >
        10_000
      ) {
        const threshold =
          now -
          COOLDOWN_MS *
            10;

        for (
          const [k, v] of
            cooldowns
        ) {
          if (
            v <
            threshold
          ) {
            cooldowns.delete(
              k
            );
          }
        }
      }
    }

    // ========================================================
    // MAIN OWNER ONLY
    // ========================================================

    if (
      command.mainOwnerOnly &&
      !isMainOwner(
        userId
      )
    ) {
      await sendBanner(
        client,
        message,
        guildId,
        {
          title:
            "ACCESS DENIED",

          subtitle:
            "This command is restricted",

          lines: [
            {
              label:
                "Permission",
              value:
                "Main Bot Owner",
            },
            {
              label:
                "Command",
              value:
                `${prefix}${command.name}`,
            },
            {
              label:
                "Status",
              value:
                "You do not have access",
            },
          ],

          height:
            400,

          footer:
            "Zeechei Permission System",
        }
      );

      return;
    }

    // ========================================================
    // OWNER ONLY
    // ========================================================

    if (
      command.ownerOnly &&
      !isOwner(userId)
    ) {
      await sendBanner(
        client,
        message,
        guildId,
        {
          title:
            "OWNER ONLY",

          subtitle:
            "You don't have permission to use this command",

          lines: [
            {
              label:
                "Command",
              value:
                `${prefix}${command.name}`,
            },
            {
              label:
                "Required",
              value:
                "Bot Owner",
            },
            {
              label:
                "Status",
              value:
                "Access denied",
            },
          ],

          height:
            400,

          footer:
            "Zeechei Permission System",
        }
      );

      return;
    }

    // ========================================================
    // COMMAND SETUP
    // ========================================================

    message.prefix =
      prefix;

    message.noPrefix =
      Boolean(
        !hasPrefix &&
        noPrefix
      );

    // ========================================================
    // ARGS REQUIRED
    // ========================================================

    if (
      command.argsRequired &&
      !args.length
    ) {
      return sendUsage(
        client,
        message,
        command
      );
    }

    // ========================================================
    // COMMAND LOG
    // ========================================================

    try {
      await WebhookLogger.commandUsed(
        message.author.tag,
        message.guild.name,
        `${
          hasPrefix
            ? prefix
            : "[NO PREFIX] "
        }${command.name}${
          args.length
            ? ` ${args.join(" ")}`
            : ""
        }`
      );
    } catch (_) {}

    // ========================================================
    // EXECUTE COMMAND
    // ========================================================

    try {
      if (command.__zeecheiPoruMusic && !client.poru && !client.lavalink) {
        await message.reply(
          "Fitur musik belum aktif (Lavalink belum dikonfigurasi)."
        ).catch(() => {});
        return;
      }

      // ------------------------------------------------------
      // ZEECHEI PORU MUSIC
      // ------------------------------------------------------

      if (
        command.__zeecheiPoruMusic
      ) {
        const musicContext =
          new MessageContext(
            message,
            args,
            command
          );

        musicContext.prefix =
          prefix;

        await command.execute(
          musicContext
        );
      }

      // ------------------------------------------------------
      // NORMAL COMMAND
      // ------------------------------------------------------

      else {
        await command.execute({
          client,
          message,
          args,
        });
      }

      // ------------------------------------------------------
      // TRACK COMMAND
      // ------------------------------------------------------

      try {
        Database.trackCommand(
          userId,
          guildId
        );
      } catch (_) {}
    } catch (err) {
      console.error(
        `[Command Error] ${command.name}:`,
        err
      );

      await sendBanner(
        client,
        message,
        guildId,
        {
          title:
            "COMMAND ERROR",

          subtitle:
            `Something went wrong while running ${prefix}${command.name}`,

          lines: [
            {
              label:
                "Command",
              value:
                `${prefix}${command.name}`,
            },
            {
              label:
                "Mode",
              value:
                hasPrefix
                  ? "Prefix"
                  : "No-Prefix",
            },
            {
              label:
                "Status",
              value:
                "Execution failed",
            },
            {
              label:
                "Error",
              value:
                truncate(
                  err?.message ||
                    "Unknown error",
                  75
                ),
            },
            {
              label:
                "Action",
              value:
                "Please try again later",
            },
          ],

          height:
            520,

          footer:
            "Zeechei Error System",
        }
      );
    }
  },
};