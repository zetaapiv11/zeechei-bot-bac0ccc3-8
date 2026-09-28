const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const VM = require("../../utils/VoiceMaster");

// ============================================================
// ZEECHEI VOICEMASTER EMOJIS
// ============================================================

const EMOJIS = Object.freeze({
  voice: "<:Voicechat:1551257386243727360>",
  settings: "<:settings:1551257489713008690>",

  lock: "<:Locked:1551257823332270080>",
  unlock: "<:unlocked:1551257861718278144>",
  hide: "<:hide:1551258255295119415>",
  unhide: "<:unhide:1551258262450737204>",

  rename: "<:rename:1551258316540346378>",
  limit: "<:limit:1551258324782284842>",
  region: "<:Region:1551258870737932510>",
  bitrate: "<:bitrate:1551259022584184862>",

  mute: "<:mute21:1551259257096241252>",
  unmute: "<:unmuted:1551259271600148490>",
  deafen: "<:deafen:1551259732709212181>",
  undeafen: "<:undeafen:1551259743345971250>",

  permit: "<:permit:1551259958945906788>",
  ban: "<:banwhite:1551260260985995328>",
  kick: "<:tts_kick_white:1551260273497604206>",

  transfer: "<:transfer:1551260698049519716>",
  claim: "<:Claim:1551260809554956359>",
  info: "<:info2:1550792669008240681>",

  success: "<:check:1550872076104245271>",
  error: "<:cross:1550532309894045846>",
  warning: "<:warning:1550824858516979884>",
  reset: "<a:reset:1551261380588474498>",
  setup: "<:setup1:1551261743458685058>",
});

const WHITE = 0xffffff;
const PREFIX_FALLBACK = ".";

function prefixOf(message) {
  return (
    message?.prefix ||
    message?.client?.config?.PREFIX ||
    PREFIX_FALLBACK
  );
}

// ============================================================
// EMBED
// ============================================================

function embed(client, guildId, title, description, type = "info") {
  const icon = EMOJIS[type] || EMOJIS.info;

  return new EmbedBuilder()
    .setColor(WHITE)
    .setTitle(`${icon} ${title}`)
    .setDescription(description)
    .setFooter({
      text: "Zeechei • VoiceMaster",
    });
}

// ============================================================
// COMPACT VOICEMASTER INTERFACE
// ============================================================

function panelEmbed(client, guild) {
  return new EmbedBuilder()
    .setColor(WHITE)
    .setTitle(`${EMOJIS.voice} VoiceMaster`)
    .setDescription(
      [
        `${EMOJIS.lock} **Lock** — Lock your voice channel`,
        `${EMOJIS.unlock} **Unlock** — Unlock your voice channel`,
        `${EMOJIS.hide} **Hide** — Hide your voice channel`,
        `${EMOJIS.unhide} **Unhide** — Show your voice channel`,
        `${EMOJIS.rename} **Rename** — Change channel name`,
        `${EMOJIS.limit} **User Limit** — Set member limit`,
        `${EMOJIS.region} **Region** — Change voice region`,
        `${EMOJIS.bitrate} **Bitrate** — Change voice bitrate`,
        `${EMOJIS.mute} **Mute** — Server-mute a member`,
        `${EMOJIS.unmute} **Unmute** — Remove server mute`,
        `${EMOJIS.deafen} **Deafen** — Server-deafen a member`,
        `${EMOJIS.undeafen} **Undeafen** — Remove server deafen`,
        `${EMOJIS.permit} **Permit** — Allow a member`,
        `${EMOJIS.ban} **Ban** — Block a member`,
        `${EMOJIS.kick} **Kick** — Remove a member`,
        `${EMOJIS.transfer} **Transfer** — Transfer ownership`,
        `${EMOJIS.claim} **Claim** — Claim abandoned channel`,
        `${EMOJIS.info} **My Channel** — View channel information`,
      ].join("\n")
    )
    .setFooter({
      text: `${guild.name} • Zeechei VoiceMaster`,
    });
}

// ============================================================
// BUTTON BUILDER
// ============================================================

function button(
  id,
  label,
  emoji,
  style = ButtonStyle.Secondary
) {
  return new ButtonBuilder()
    .setCustomId(`vm:${id}`)
    .setLabel(label)
    .setEmoji(emoji)
    .setStyle(style);
}

// ============================================================
// COMPACT BUTTON ROWS
// Discord allows maximum 5 buttons per row.
// ============================================================

function buildPanel(client, guild) {
  return {
    embeds: [panelEmbed(client, guild)],

    components: [
      // ROW 1
      new ActionRowBuilder().addComponents(
        button("lock", "Lock", EMOJIS.lock),
        button("unlock", "Unlock", EMOJIS.unlock),
        button("hide", "Hide", EMOJIS.hide),
        button("unhide", "Unhide", EMOJIS.unhide),
        button("rename", "Rename", EMOJIS.rename)
      ),

      // ROW 2
      new ActionRowBuilder().addComponents(
        button("limit", "Limit", EMOJIS.limit),
        button("region", "Region", EMOJIS.region),
        button("bitrate", "Bitrate", EMOJIS.bitrate),
        button("permit", "Permit", EMOJIS.permit),
        button("ban", "Ban", EMOJIS.ban)
      ),

      // ROW 3
      new ActionRowBuilder().addComponents(
        button("mute", "Mute", EMOJIS.mute),
        button("unmute", "Unmute", EMOJIS.unmute),
        button("deafen", "Deafen", EMOJIS.deafen),
        button("undeafen", "Undeafen", EMOJIS.undeafen),
        button("kick", "Kick", EMOJIS.kick)
      ),

      // ROW 4
      new ActionRowBuilder().addComponents(
        button("transfer", "Transfer", EMOJIS.transfer),
        button("claim", "Claim", EMOJIS.claim),
        button("info", "My Channel", EMOJIS.info)
      ),
    ],
  };
}

// ============================================================
// MODALS
// ============================================================

function buildModal(action) {
  const definitions = {
    rename: [
      "Channel Name",
      "Enter the new channel name.",
      "value",
      100,
    ],

    limit: [
      "User Limit",
      "0 = unlimited, maximum 99.",
      "value",
      2,
    ],

    region: [
      "Voice Region",
      "Example: singapore, us-east, europe. Use auto for automatic.",
      "value",
      30,
    ],

    bitrate: [
      "Bitrate",
      "Enter bitrate in kbps.",
      "value",
      4,
    ],

    permit: [
      "Member",
      "Mention a member or enter their user ID.",
      "member",
      25,
    ],

    ban: [
      "Member",
      "Mention a member or enter their user ID.",
      "member",
      25,
    ],

    kick: [
      "Member",
      "Mention a member or enter their user ID.",
      "member",
      25,
    ],

    mute: [
      "Member",
      "Mention a member or enter their user ID.",
      "member",
      25,
    ],

    unmute: [
      "Member",
      "Mention a member or enter their user ID.",
      "member",
      25,
    ],

    deafen: [
      "Member",
      "Mention a member or enter their user ID.",
      "member",
      25,
    ],

    undeafen: [
      "Member",
      "Mention a member or enter their user ID.",
      "member",
      25,
    ],

    transfer: [
      "New Owner",
      "Mention the member or enter their user ID.",
      "member",
      25,
    ],
  };

  const def = definitions[action];

  if (!def) return null;

  const input = new TextInputBuilder()
    .setCustomId(def[2])
    .setLabel(def[0])
    .setPlaceholder(def[1])
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(def[3]);

  return new ModalBuilder()
    .setCustomId(`vm_modal:${action}`)
    .setTitle(`VoiceMaster • ${def[0]}`)
    .addComponents(
      new ActionRowBuilder().addComponents(input)
    );
}

// ============================================================
// SEND EMBED
// ============================================================

async function send(
  client,
  message,
  title,
  description,
  type = "info"
) {
  return message.reply({
    embeds: [
      embed(
        client,
        message.guild.id,
        title,
        description,
        type
      ),
    ],
  });
}

// ============================================================
// SETUP SYSTEM
// ============================================================

async function setupSystem(client, guild) {
  const data = await VM.setup(guild);

  const channel = guild.channels.cache.get(
    data.interfaceChannelId
  );

  if (!channel) return data;

  const panel = buildPanel(client, guild);

  let panelMessage = data.interfaceMessageId
    ? await channel.messages
        .fetch(data.interfaceMessageId)
        .catch(() => null)
    : null;

  if (panelMessage) {
    await panelMessage.edit(panel);
  } else {
    panelMessage = await channel.send(panel);

    data.interfaceMessageId = panelMessage.id;

    VM.set(guild.id, data);
  }

  return data;
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
  name: "voicemaster",
  aliases: ["vm", "voice"],
  category: "VoiceMaster",

  description:
    "Manage Zeechei temporary voice channels.",

  usage:
    ".voicemaster <setup|buttons|config|reset>",

  EMOJIS,

  buildPanel,
  buildModal,

  data: new SlashCommandBuilder()
    .setName("voicemaster")
    .setDescription("Manage Zeechei VoiceMaster.")

    .addSubcommand((s) =>
      s
        .setName("setup")
        .setDescription(
          "Create the VoiceMaster system."
        )
    )

    .addSubcommand((s) =>
      s
        .setName("buttons")
        .setDescription(
          "Post the VoiceMaster control panel."
        )
    )

    .addSubcommand((s) =>
      s
        .setName("config")
        .setDescription(
          "Show VoiceMaster configuration."
        )
    )

    .addSubcommand((s) =>
      s
        .setName("reset")
        .setDescription(
          "Remove VoiceMaster configuration."
        )
    )

    .addSubcommand((s) =>
      s
        .setName("lock")
        .setDescription(
          "Lock your temporary channel."
        )
    )

    .addSubcommand((s) =>
      s
        .setName("unlock")
        .setDescription(
          "Unlock your temporary channel."
        )
    )

    .addSubcommand((s) =>
      s
        .setName("hide")
        .setDescription(
          "Hide your temporary channel."
        )
    )

    .addSubcommand((s) =>
      s
        .setName("unhide")
        .setDescription(
          "Unhide your temporary channel."
        )
    )

    .addSubcommand((s) =>
      s
        .setName("claim")
        .setDescription(
          "Claim an abandoned temporary channel."
        )
    ),

  // ==========================================================
  // PREFIX EXECUTION
  // ==========================================================

  async execute({ client, message, args }) {
    const guild = message.guild;
    const member = message.member;

    if (!guild || !member) return;

    const prefix = prefixOf(message);

    const action = String(
      args?.[0] || ""
    ).toLowerCase();

    // ========================================================
    // HELP
    // ========================================================

    if (!action) {
      return message.reply({
        embeds: [
          embed(
            client,
            guild.id,
            "VoiceMaster",
            [
              `${EMOJIS.setup} \`${prefix}voicemaster setup\` — Setup`,
              `${EMOJIS.settings} \`${prefix}voicemaster buttons\` — Panel`,
              `${EMOJIS.info} \`${prefix}voicemaster config\` — Config`,
              `${EMOJIS.reset} \`${prefix}voicemaster reset\` — Reset`,
              `${EMOJIS.claim} \`${prefix}voicemaster claim\` — Claim`,
            ].join("\n"),
            "voice"
          ),
        ],
      });
    }

    // ========================================================
    // ADMIN ACTIONS
    // ========================================================

    if (
      ["setup", "buttons", "config", "reset"].includes(
        action
      ) &&
      !member.permissions.has(
        PermissionFlagsBits.ManageGuild
      )
    ) {
      return send(
        client,
        message,
        "Permission Required",
        "You need **Manage Server** permission for this action.",
        "error"
      );
    }

    // ========================================================
    // SETUP
    // ========================================================

    if (action === "setup") {
      const data = await setupSystem(
        client,
        guild
      );

      return send(
        client,
        message,
        "Setup Complete",
        [
          `${EMOJIS.settings} Category: <#${data.categoryId}>`,
          `${EMOJIS.voice} Join channel: <#${data.lobbyId}>`,
          `${EMOJIS.info} Interface: <#${data.interfaceChannelId}>`,
        ].join("\n"),
        "success"
      );
    }

    // ========================================================
    // BUTTONS
    // ========================================================

    if (action === "buttons") {
      const data = VM.get(guild.id);

      if (!data?.interfaceChannelId) {
        return send(
          client,
          message,
          "Not Configured",
          `Run \`${prefix}voicemaster setup\` first.`,
          "warning"
        );
      }

      const channel =
        guild.channels.cache.get(
          data.interfaceChannelId
        );

      if (
        !channel ||
        channel.type !== ChannelType.GuildText
      ) {
        return send(
          client,
          message,
          "Interface Missing",
          "Run setup again to recreate the interface channel.",
          "error"
        );
      }

      const panel = buildPanel(
        client,
        guild
      );

      const sent =
        await channel.send(panel);

      data.interfaceMessageId =
        sent.id;

      VM.set(
        guild.id,
        data
      );

      return send(
        client,
        message,
        "Panel Posted",
        `${EMOJIS.success} VoiceMaster controls have been posted in ${channel}.`,
        "success"
      );
    }

    // ========================================================
    // CONFIG
    // ========================================================

    if (action === "config") {
      const data = VM.get(guild.id);

      if (!data) {
        return send(
          client,
          message,
          "No Configuration",
          `Run \`${prefix}voicemaster setup\` first.`,
          "warning"
        );
      }

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(WHITE)
            .setTitle(
              `${EMOJIS.settings} VoiceMaster Configuration`
            )
            .addFields(
              {
                name: "Category",
                value: data.categoryId
                  ? `<#${data.categoryId}>`
                  : "Not set",
                inline: true,
              },
              {
                name: "Join to Create",
                value: data.lobbyId
                  ? `<#${data.lobbyId}>`
                  : "Not set",
                inline: true,
              },
              {
                name: "Interface",
                value:
                  data.interfaceChannelId
                    ? `<#${data.interfaceChannelId}>`
                    : "Not set",
                inline: true,
              },
              {
                name: "Room Name",
                value: `\`${data.channelName || "{user}'s Room"}\``,
                inline: true,
              },
              {
                name: "Default Limit",
                value: String(
                  data.userLimit ?? 0
                ),
                inline: true,
              },
              {
                name: "Temporary Rooms",
                value: String(
                  Object.keys(
                    data.channels || {}
                  ).length
                ),
                inline: true,
              }
            )
            .setFooter({
              text: "Zeechei • VoiceMaster",
            }),
        ],
      });
    }

    // ========================================================
    // RESET
    // ========================================================

    if (action === "reset") {
      const data = VM.get(guild.id);

      if (!data) {
        return send(
          client,
          message,
          "Nothing To Reset",
          "VoiceMaster is not configured here.",
          "warning"
        );
      }

      for (
        const channelId of Object.keys(
          data.channels || {}
        )
      ) {
        const ch =
          guild.channels.cache.get(
            channelId
          );

        if (ch) {
          await ch
            .delete("VoiceMaster reset")
            .catch(() => {});
        }
      }

      for (
        const id of [
          data.interfaceChannelId,
          data.lobbyId,
        ]
      ) {
        const ch = id
          ? guild.channels.cache.get(id)
          : null;

        if (ch) {
          await ch
            .delete("VoiceMaster reset")
            .catch(() => {});
        }
      }

      const category =
        data.categoryId
          ? guild.channels.cache.get(
              data.categoryId
            )
          : null;

      if (category) {
        await category
          .delete("VoiceMaster reset")
          .catch(() => {});
      }

      VM.remove(guild.id);

      return send(
        client,
        message,
        "Reset Complete",
        `${EMOJIS.reset} VoiceMaster configuration and created channels were removed.`,
        "reset"
      );
    }

    // ========================================================
    // USER MUST BE IN VC
    // ========================================================

    const voice =
      member.voice?.channel;

    if (!voice) {
      return send(
        client,
        message,
        "Join A Voice Channel",
        `${EMOJIS.voice} Join your Zeechei temporary voice channel first.`,
        "warning"
      );
    }

    // ========================================================
    // MANAGED CHANNEL CHECK
    // ========================================================

    if (
      !VM.isManagedChannel(
        guild.id,
        voice.id
      )
    ) {
      return send(
        client,
        message,
        "Not A VoiceMaster Room",
        `${EMOJIS.warning} This voice channel is not managed by Zeechei VoiceMaster.`,
        "warning"
      );
    }

    const owner =
      VM.ownerId(
        guild.id,
        voice.id
      );

    // ========================================================
    // CLAIM
    // ========================================================

    if (action === "claim") {
      try {
        const result =
          await VM.claim(
            voice,
            member
          );

        return send(
          client,
          message,
          "Channel Claimed",
          `${EMOJIS.claim} ${result}`,
          "claim"
        );
      } catch (e) {
        return send(
          client,
          message,
          "Cannot Claim",
          e.message,
          "error"
        );
      }
    }

    // ========================================================
    // OWNER CHECK
    // ========================================================

    if (
      !owner ||
      owner !== member.id
    ) {
      return send(
        client,
        message,
        "Access Denied",
        `${EMOJIS.error} Only the current channel owner can use VoiceMaster controls.`,
        "error"
      );
    }

    // ========================================================
    // LOCK / UNLOCK / HIDE / UNHIDE
    // ========================================================

    if (
      [
        "lock",
        "unlock",
        "hide",
        "unhide",
      ].includes(action)
    ) {
      try {
        const result =
          await VM.applyChannelAction(
            voice,
            action
          );

        return send(
          client,
          message,
          "Channel Updated",
          `${EMOJIS.success} ${result}`,
          "success"
        );
      } catch (e) {
        return send(
          client,
          message,
          "Action Failed",
          e.message,
          "error"
        );
      }
    }

    // ========================================================
    // RENAME
    // ========================================================

    if (action === "rename") {
      const name = args
        .slice(1)
        .join(" ")
        .trim()
        .slice(0, 100);

      if (!name) {
        return send(
          client,
          message,
          "Missing Name",
          `Usage: \`${prefix}voicemaster rename <name>\``,
          "warning"
        );
      }

      await voice.setName(
        name,
        "VoiceMaster owner rename"
      );

      return send(
        client,
        message,
        "Renamed",
        `${EMOJIS.rename} Your channel is now **${name}**.`,
        "rename"
      );
    }

    // ========================================================
    // USER LIMIT
    // ========================================================

    if (action === "limit") {
      const amount =
        Number(args[1]);

      if (
        !Number.isInteger(amount) ||
        amount < 0 ||
        amount > 99
      ) {
        return send(
          client,
          message,
          "Invalid Limit",
          "Use a number from **0 to 99**.",
          "error"
        );
      }

      await voice.setUserLimit(
        amount,
        "VoiceMaster owner limit"
      );

      return send(
        client,
        message,
        "Limit Updated",
        `${EMOJIS.limit} User limit is now **${
          amount === 0
            ? "Unlimited"
            : amount
        }**.`,
        "limit"
      );
    }

    // ========================================================
    // MEMBER ACTIONS
    // ========================================================

    if (
      action === "transfer" ||
      [
        "mute",
        "unmute",
        "deafen",
        "undeafen",
        "permit",
        "ban",
        "kick",
      ].includes(action)
    ) {
      const target =
        message.mentions.members.first();

      if (!target) {
        return send(
          client,
          message,
          "Member Required",
          `Mention a member.\nExample: \`${prefix}voicemaster ${action} @user\``,
          "warning"
        );
      }

      try {
        const result =
          action === "transfer"
            ? await VM.transfer(
                voice,
                owner,
                target
              )
            : await VM.applyMemberAction(
                voice,
                target,
                action
              );

        return send(
          client,
          message,
          "VoiceMaster Updated",
          `${EMOJIS.success} ${result}`,
          "success"
        );
      } catch (e) {
        return send(
          client,
          message,
          "Action Failed",
          e.message,
          "error"
        );
      }
    }

    // ========================================================
    // UNKNOWN ACTION
    // ========================================================

    return send(
      client,
      message,
      "Unknown Action",
      `Use \`${prefix}voicemaster\` to see the available VoiceMaster controls.`,
      "warning"
    );
  },
};
