// ============================================================
// ZEECHEI STATS — FULL REPLACEABLE VERSION
// File: commands/general/stats.js
// ============================================================

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require("discord.js");

const Database = require("../../database/Database");
const config = require("../../config");

// ============================================================
// ZEECHEI EMOJIS
// ============================================================

const EMOJIS = {
  home: "<:HOME:1550824288917913722>",
  profile: "<:requester_avon:1550748053890277376>",
  calendar: "<a:SR_CALANDER:1550820972603383822>",
  server: "<:servers:1550821293899915267>",
  badge: "<a:badges:1550821461068091446>",

  music: "<:n_musicc:1550822088216940645>",
  play: "<a:playing1:1550512277910978611>",
  liked: "<:favorite:1550530747977302127>",
  duration: "<:duration:1550746694734454855>",

  message: "<:Message:1550822755815923772>",
  command: "<:command:1550822897403170892>",
  eye: "<a:eyes1:1550822967322345492>",

  enabled: "<:enabled:1550823547633537166>",
  disabled: "<:dh_disabled:1550823552117252116>",

  refresh: "<:refresh:1550824820797607997>",
  info: "<:info2:1550792669008240681>",
  warning: "<:warning:1550824858516979884>",

  member: "<:member2:1550825886436171857>",
  chats: "<a:Chats:1550825888671604766>",
  vc: "<:vc:1550826113889206273>",
  roles: "<:Roles:1550826271678931024>",
  emojis: "<a:emojis:1550826143320514600>",
};

// ============================================================
// ZEECHEI BADGE EMOJIS
// ============================================================

const BADGE_EMOJIS = {
  owner: "<:ZeecheiCrown:1543432949796704266>",
  developer: "<:AlexDev:1543454890288873544>",
  staff: "<:ZeecheiStaff:1543454950418555021>",
  premium: "<:Premium:1543453885149093898>",
  supporter: "<:Zeecheisupporter:1543455077036064888>",
  partner: "<:ZeecheiPartner:1543455210943291492>",
  vip: "<:VIP:1543454438151299193>",
  verified: "<:ZeecheiVerified:1543455282749775922>",
  tester: "<:ZeecheiBetaTester:1543455393488052236>",
  bug_hunter: "<:ZeecheiBughunter:1543455512186585169>",
  og: "<:ogusers:1543454810685050971>",
};

const STATS_ID = "zeechei_stats_v3";

const MENU_OPTIONS = [
  {
    value: "home",
    label: "Overview",
    emoji: EMOJIS.home,
    description: "Profile overview and account information",
  },
  {
    value: "profile",
    label: "Profile Card",
    emoji: EMOJIS.profile,
    description: "Clean Discord profile card",
  },
  {
    value: "music",
    label: "Music Stats",
    emoji: EMOJIS.music,
    description: "Songs played and liked songs",
  },
  {
    value: "badges",
    label: "Badges",
    emoji: EMOJIS.badge,
    description: "Zeechei badges assigned to this user",
  },
  {
    value: "noprefix",
    label: "No Prefix",
    emoji: EMOJIS.command,
    description: "Current Zeechei No Prefix status",
  },
  {
    value: "server",
    label: "Server Stats",
    emoji: EMOJIS.server,
    description: "Current Discord server information",
  },
];

// ============================================================
// HELPERS
// ============================================================

function number(value) {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US")
    : "0";
}

function safeText(value, fallback = "Unknown") {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  return String(value)
    .replace(/@everyone/gi, "@ everyone")
    .replace(/@here/gi, "@ here")
    .replace(/`/g, "'")
    .replace(/\r?\n/g, " ")
    .trim()
    .slice(0, 300);
}

function timestamp(ms) {
  const value = Number(ms);

  if (!Number.isFinite(value) || value <= 0) {
    return "Unknown";
  }

  return `<t:${Math.floor(value / 1000)}:D>`;
}

function relativeTimestamp(ms) {
  const value = Number(ms);

  if (!Number.isFinite(value) || value <= 0) {
    return "Unknown";
  }

  return `<t:${Math.floor(value / 1000)}:R>`;
}

function duration(ms) {
  const value = Number(ms);

  if (!Number.isFinite(value) || value <= 0) {
    return "00:00";
  }

  const total = Math.floor(value / 1000);

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return [
      hours,
      minutes,
      seconds,
    ]
      .map(v => String(v).padStart(2, "0"))
      .join(":");
  }

  return [
    minutes,
    seconds,
  ]
    .map(v => String(v).padStart(2, "0"))
    .join(":");
}

// ============================================================
// SAFE DATABASE CALL
// ============================================================

function callDatabase(methodNames, ...args) {
  for (const name of methodNames) {
    try {
      if (typeof Database?.[name] === "function") {
        return Database[name](...args);
      }
    } catch (error) {
      console.error(
        `[Zeechei Stats] Database.${name}:`,
        error?.message || error
      );
    }
  }

  return null;
}

// ============================================================
// USER STATS
// ============================================================

function getUserStats(userId) {
  const result = callDatabase(
    [
      "getUserStats",
      "getStats",
      "getUserStatistics",
    ],
    userId
  );

  if (!result || typeof result !== "object") {
    return {
      messages: 0,
      commands: 0,
    };
  }

  return {
    ...result,

    messages: Number(
      result.messages ??
      result.messageCount ??
      0
    ) || 0,

    commands: Number(
      result.commands ??
      result.commandCount ??
      0
    ) || 0,
  };
}

// ============================================================
// LIKED SONGS
// ============================================================

function getLikedSongs(userId) {
  const result = callDatabase(
    [
      "getLikedSongs",
      "getFavorites",
      "getFavoriteSongs",
      "getUserFavorites",
    ],
    userId
  );

  return Array.isArray(result)
    ? result
    : [];
}

// ============================================================
// SONGS PLAYED
// ============================================================

function getSongsPlayed(userId) {
  try {
    if (
      typeof Database?.getSongsLeaderboard ===
      "function"
    ) {
      const rows =
        Database.getSongsLeaderboard(1000000);

      if (Array.isArray(rows)) {
        const row = rows.find(
          item =>
            String(item?.userId) ===
            String(userId)
        );

        if (row) {
          return Math.max(
            0,
            Number(row.count) || 0
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "[Zeechei Stats] Songs Played:",
      error?.message || error
    );
  }

  const stats =
    getUserStats(userId);

  const fallback = Number(
    stats.songsPlayed ??
    stats.songPlayed ??
    stats.songs ??
    stats.musicPlayed ??
    0
  );

  return Number.isFinite(fallback) &&
    fallback >= 0
    ? fallback
    : 0;
}

// ============================================================
// BADGES
// ============================================================

function normalizeBadgeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function getBadgeEmoji(name) {
  const value =
    normalizeBadgeName(name);

  if (value.includes("owner"))
    return BADGE_EMOJIS.owner;

  if (
    value.includes("developer") ||
    value === "dev" ||
    value.includes("dev")
  )
    return BADGE_EMOJIS.developer;

  if (value.includes("staff"))
    return BADGE_EMOJIS.staff;

  if (value.includes("premium"))
    return BADGE_EMOJIS.premium;

  if (value.includes("support"))
    return BADGE_EMOJIS.supporter;

  if (value.includes("partner"))
    return BADGE_EMOJIS.partner;

  if (value.includes("vip"))
    return BADGE_EMOJIS.vip;

  if (value.includes("verified"))
    return BADGE_EMOJIS.verified;

  if (
    value.includes("tester") ||
    value.includes("beta")
  )
    return BADGE_EMOJIS.tester;

  if (
    value.includes("bug") ||
    value.includes("hunter")
  )
    return BADGE_EMOJIS.bug_hunter;

  if (
    value === "og" ||
    value.includes("oguser") ||
    value.includes("early")
  )
    return BADGE_EMOJIS.og;

  return EMOJIS.badge;
}

function getBadgeRegistry() {
  try {
    const badgeUtils =
      require("../../utils/badges");

    if (
      typeof badgeUtils.getAllBadges ===
      "function"
    ) {
      const registry =
        badgeUtils.getAllBadges();

      if (
        registry &&
        typeof registry === "object" &&
        !Array.isArray(registry)
      ) {
        return registry;
      }
    }
  } catch (error) {
    console.error(
      "[Zeechei Stats] Badge Registry:",
      error?.message || error
    );
  }

  return {};
}

function getUserBadges(userId) {
  let badges = [];

  const result = callDatabase(
    [
      "getUserBadges",
      "getBadges",
      "getAssignedBadges",
      "getBadgesForUser",
    ],
    userId
  );

  if (Array.isArray(result)) {
    badges = result;
  } else if (
    result &&
    typeof result === "object"
  ) {
    if (Array.isArray(result.badges)) {
      badges = result.badges;
    } else if (
      Array.isArray(result[userId])
    ) {
      badges = result[userId];
    }
  }

  const registry =
    getBadgeRegistry();

  return badges
    .map(badge => {
      let key = null;
      let data = null;

      if (typeof badge === "string") {
        key = badge;
        data = registry[badge] || null;
      } else if (
        badge &&
        typeof badge === "object"
      ) {
        key =
          badge.key ||
          badge.id ||
          badge.name ||
          badge.label;

        data = badge;
      }

      if (!key && !data) {
        return null;
      }

      const finalKey = String(
        key ||
        data?.key ||
        data?.id ||
        data?.name ||
        ""
      );

      const registryData =
        registry[finalKey] || {};

      const name =
        data?.label ||
        data?.name ||
        registryData?.label ||
        registryData?.name ||
        finalKey ||
        "Badge";

      const emoji =
        data?.emoji ||
        registryData?.emoji ||
        getBadgeEmoji(name);

      return {
        key: finalKey,
        name,
        emoji,
      };
    })
    .filter(Boolean);
}

// ============================================================
// OWNER BADGE
// ============================================================

function addOwnerBadge(
  userId,
  badges
) {
  try {
    const ids = [];

    const direct = [
      config?.mainOwnerId,
      config?.ownerId,
      config?.OWNER_ID,
    ];

    const arrays = [
      config?.ownerIds,
      config?.OWNERS,
      config?.OWNER_IDS,
    ];

    for (const id of direct) {
      if (id) {
        ids.push(String(id));
      }
    }

    for (const source of arrays) {
      if (Array.isArray(source)) {
        ids.push(...source.map(String));
      }
    }

    if (
      ids.includes(String(userId)) &&
      !badges.some(
        b =>
          normalizeBadgeName(
            b.name
          ).includes("owner")
      )
    ) {
      badges.unshift({
        key: "owner",
        name: "Zeechei Owner",
        emoji: BADGE_EMOJIS.owner,
      });
    }
  } catch (error) {
    console.error(
      "[Zeechei Stats] Owner Badge:",
      error?.message || error
    );
  }

  return badges;
}

// ============================================================
// NO PREFIX
// ============================================================

function isNoPrefix(userId) {
  try {
    return Boolean(
      Database.isNoPrefix?.(userId)
    );
  } catch (error) {
    console.error(
      "[Zeechei Stats] No Prefix:",
      error?.message || error
    );

    return false;
  }
}

// ============================================================
// SELECT MENU
// ============================================================

function createMenu(selected) {
  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        `${STATS_ID}:menu`
      )
      .setPlaceholder(
        "Select stats section..."
      )
      .setMinValues(1)
      .setMaxValues(1);

  for (
    const option of MENU_OPTIONS
  ) {
    menu.addOptions({
      label: option.label,
      description:
        option.description.slice(
          0,
          100
        ),
      value: option.value,
      emoji: option.emoji,
      default:
        option.value === selected,
    });
  }

  return new ActionRowBuilder()
    .addComponents(menu);
}

// ============================================================
// NAVIGATION
// ============================================================

function navigation(user) {
  const avatarUrl =
    user.displayAvatarURL({
      extension: "png",
      size: 256,
    });

  return new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()
        .setCustomId(
          `${STATS_ID}:home`
        )
        .setLabel("Overview")
        .setEmoji(EMOJIS.home)
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          `${STATS_ID}:refresh`
        )
        .setLabel("Refresh")
        .setEmoji(EMOJIS.refresh)
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setLabel("Avatar")
        .setEmoji(EMOJIS.profile)
        .setStyle(
          ButtonStyle.Link
        )
        .setURL(avatarUrl)
    );
}

function payload(container) {
  return {
    components: [container],
    flags:
      MessageFlags.IsComponentsV2,
  };
}

function finish(
  container,
  user,
  selected = "home"
) {
  return container
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(
          SeparatorSpacingSize.Small
        )
    )
    .addActionRowComponents(
      createMenu(selected)
    )
    .addActionRowComponents(
      navigation(user)
    );
}

// ============================================================
// HOME
// ============================================================

function buildHome(
  user,
  member
) {
  const stats =
    getUserStats(user.id);

  const songs =
    getSongsPlayed(user.id);

  const liked =
    getLikedSongs(user.id);

  const badges =
    addOwnerBadge(
      user.id,
      getUserBadges(user.id)
    );

  const badgeText =
    badges.length
      ? badges
          .slice(0, 12)
          .map(
            b =>
              `${b.emoji} ${safeText(
                b.name,
                "Badge"
              )}`
          )
          .join("  ")
      : `${EMOJIS.badge} No badges`;

  return finish(
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              `# ${EMOJIS.profile} **${safeText(
                user.globalName ||
                  user.username,
                "User"
              )}**`,

              `> ${
                user.bot
                  ? "<a:bots:1550791562928070696> Bot Account"
                  : "<:requester_avon:1550748053890277376> User Account"
              }`,

              "",

              `**${EMOJIS.calendar} Account Created**`,

              `${timestamp(
                user.createdTimestamp
              )} • ${relativeTimestamp(
                user.createdTimestamp
              )}`,

              "",

              `**${EMOJIS.server} Joined This Server**`,

              member?.joinedTimestamp
                ? `${timestamp(
                    member.joinedTimestamp
                  )} • ${relativeTimestamp(
                    member.joinedTimestamp
                  )}`
                : "Not available",

              "",

              `**${EMOJIS.badge} Badges**`,

              badgeText,

              "",

              `**${EMOJIS.message} Messages**  \`${number(
                stats.messages
              )}\``,

              `**${EMOJIS.command} Commands**  \`${number(
                stats.commands
              )}\``,

              `**${EMOJIS.music} Songs Played**  \`${number(
                songs
              )}\``,

              `**${EMOJIS.liked} Liked Songs**  \`${number(
                liked.length
              )}\``,

              "",

              `**${EMOJIS.info} Profile ID:** \`${user.id}\``,
            ].join("\n")
          )
      ),
    user,
    "home"
  );
}

// ============================================================
// PROFILE CARD
// ============================================================

function buildProfile(
  user,
  member
) {
  const badges =
    addOwnerBadge(
      user.id,
      getUserBadges(user.id)
    );

  const badgeLine =
    badges.length
      ? badges
          .slice(0, 8)
          .map(
            b =>
              `${b.emoji} ${safeText(
                b.name
              )}`
          )
          .join("  ")
      : `${EMOJIS.badge} No badges`;

  const banner =
    typeof user.bannerURL ===
    "function"
      ? user.bannerURL({
          extension: "png",
          size: 1024,
        })
      : null;

  const lines = [
    `# ${EMOJIS.profile} **PROFILE**`,

    `### ${safeText(
      user.globalName ||
        user.username,
      "User"
    )}`,

    `> @${safeText(
      user.username,
      "user"
    )}`,

    "",

    `**${EMOJIS.calendar} Created**  ${timestamp(
      user.createdTimestamp
    )} • ${relativeTimestamp(
      user.createdTimestamp
    )}`,

    `**${EMOJIS.server} Joined**  ${
      member?.joinedTimestamp
        ? `${timestamp(
            member.joinedTimestamp
          )} • ${relativeTimestamp(
            member.joinedTimestamp
          )}`
        : "Not available"
    }`,

    "",

    `**${EMOJIS.badge} Badges**`,

    badgeLine,

    "",

    banner
      ? `${EMOJIS.info} **Profile banner available**`
      : `${EMOJIS.info} **No Discord profile banner set**`,

    "",

    `**ID**  \`${user.id}\``,
  ];

  const cardImage =
    banner ||
    user.displayAvatarURL({
      extension: "png",
      size: 1024,
    });

  const container =
    new ContainerBuilder();

  try {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder()
        .addItems(
          new MediaGalleryItemBuilder()
            .setURL(cardImage)
        )
    );
  } catch (error) {
    console.error(
      "[Zeechei Stats] Profile Image:",
      error?.message || error
    );
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(
        lines.join("\n")
      )
  );

  return finish(
    container,
    user,
    "profile"
  );
}

// ============================================================
// MUSIC
// ============================================================

function buildMusic(user) {
  const stats =
    getUserStats(user.id);

  const songs =
    getSongsPlayed(user.id);

  const liked =
    getLikedSongs(user.id);

  const likedDuration =
    liked.reduce(
      (total, song) =>
        total +
        Number(
          song?.duration ||
          song?.length ||
          0
        ),
      0
    );

  const recent =
    liked
      .slice(-5)
      .reverse()
      .map(
        (song, index) =>
          `${index + 1}. ${EMOJIS.music} **${safeText(
            song?.title ||
              song?.name ||
              "Unknown Track"
          )}**`
      );

  return finish(
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              `# ${EMOJIS.music} **MUSIC STATS**`,

              `### ${safeText(
                user.globalName ||
                  user.username
              )}`,

              "",

              `**${EMOJIS.play} Songs Played**  \`${number(
                songs
              )}\``,

              `**${EMOJIS.liked} Liked Songs**  \`${number(
                liked.length
              )}\``,

              `**${EMOJIS.duration} Liked Music Duration**  \`${duration(
                likedDuration
              )}\``,

              "",

              `**${EMOJIS.message} Messages**  \`${number(
                stats.messages
              )}\``,

              `**${EMOJIS.command} Commands Used**  \`${number(
                stats.commands
              )}\``,

              "",

              recent.length
                ? [
                    "**Recently Liked**",
                    ...recent,
                  ].join("\n")
                : `${EMOJIS.liked} No liked songs found.`,
            ].join("\n")
          )
      ),
    user,
    "music"
  );
}

// ============================================================
// BADGES PAGE
// ============================================================

function buildBadges(user) {
  const badges =
    addOwnerBadge(
      user.id,
      getUserBadges(user.id)
    );

  const lines =
    badges.length
      ? badges.map(
          (badge, index) =>
            `${index + 1}. ${badge.emoji} **${safeText(
              badge.name,
              "Badge"
            )}**`
        )
      : [
          `${EMOJIS.badge} No badges are currently assigned.`,
        ];

  return finish(
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              `# ${EMOJIS.badge} **BADGES**`,

              `### ${safeText(
                user.globalName ||
                  user.username
              )}`,

              "",

              ...lines,

              "",

              `**Total Badges:** \`${number(
                badges.length
              )}\``,
            ].join("\n")
          )
      ),
    user,
    "badges"
  );
}

// ============================================================
// NO PREFIX
// ============================================================

function buildNoPrefix(user) {
  const enabled =
    isNoPrefix(user.id);

  return finish(
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              `# ${EMOJIS.command} **NO PREFIX**`,

              `### ${safeText(
                user.globalName ||
                  user.username
              )}`,

              "",

              `**Status:** ${
                enabled
                  ? `${EMOJIS.enabled} Enabled`
                  : `${EMOJIS.disabled} Disabled`
              }`,

              "",

              enabled
                ? `${EMOJIS.enabled} You can use Zeechei commands without the configured prefix.`
                : `${EMOJIS.disabled} You must use Zeechei's configured prefix before commands.`,

              "",

              `**Source:** Zeechei Database`,
            ].join("\n")
          )
      ),
    user,
    "noprefix"
  );
}

// ============================================================
// SERVER
// ============================================================

function buildServer(
  guild,
  member,
  user
) {
  const textChannels =
    guild.channels.cache.filter(
      channel =>
        channel.isTextBased?.() &&
        !channel.isVoiceBased?.()
    ).size;

  const voiceChannels =
    guild.channels.cache.filter(
      channel =>
        channel.isVoiceBased?.()
    ).size;

  const roles =
    Math.max(
      0,
      guild.roles.cache.size - 1
    );

  const emojiCount =
    guild.emojis.cache.size;

  return finish(
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            [
              `# ${EMOJIS.server} **SERVER STATS**`,

              `### ${safeText(
                guild.name
              )}`,

              "",

              `**${EMOJIS.member} Members**  \`${number(
                guild.memberCount
              )}\``,

              `**${EMOJIS.chats} Text Channels**  \`${number(
                textChannels
              )}\``,

              `**${EMOJIS.vc} Voice Channels**  \`${number(
                voiceChannels
              )}\``,

              `**${EMOJIS.roles} Roles**  \`${number(
                roles
              )}\``,

              `**${EMOJIS.emojis} Emojis**  \`${number(
                emojiCount
              )}\``,

              "",

              `**${EMOJIS.calendar} Server Created**`,

              `${timestamp(
                guild.createdTimestamp
              )} • ${relativeTimestamp(
                guild.createdTimestamp
              )}`,

              "",

              `**${EMOJIS.profile} You Joined**`,

              member?.joinedTimestamp
                ? `${timestamp(
                    member.joinedTimestamp
                  )} • ${relativeTimestamp(
                    member.joinedTimestamp
                  )}`
                : "Not available",
            ].join("\n")
          )
      ),
    user,
    "server"
  );
}

// ============================================================
// PAGE ROUTER
// ============================================================

function buildPage(
  page,
  user,
  member,
  guild
) {
  switch (page) {
    case "profile":
      return buildProfile(
        user,
        member
      );

    case "music":
      return buildMusic(
        user
      );

    case "badges":
      return buildBadges(
        user
      );

    case "noprefix":
      return buildNoPrefix(
        user
      );

    case "server":
      return buildServer(
        guild,
        member,
        user
      );

    case "home":
    default:
      return buildHome(
        user,
        member
      );
  }
}

// ============================================================
// COMMAND
// ============================================================

module.exports = {
  name: "stats",

  aliases: [
    "statistics",
    "stat",
    "mystats",
  ],

  description:
    "View Zeechei profile, music statistics, badges, No Prefix and server information.",

  category:
    "information",

  usage:
    ".stats [@user]",

  data:
    new SlashCommandBuilder()
      .setName("stats")
      .setDescription(
        "View Zeechei statistics and profile information."
      )
      .addUserOption(
        option =>
          option
            .setName("user")
            .setDescription(
              "User whose statistics you want to view."
            )
            .setRequired(false)
      ),

  getSlashArgs(options) {
    const user =
      options.getUser("user");

    return user
      ? [user.id]
      : [];
  },

  async execute(
    context,
    maybeArgs,
    maybeClient
  ) {
    let message = null;

    try {
      let client;
      let args;

      if (
        context &&
        typeof context === "object" &&
        context.message &&
        context.client
      ) {
        client =
          context.client;

        message =
          context.message;

        args =
          context.args || [];
      } else if (
        context &&
        typeof context.reply ===
          "function"
      ) {
        message = context;

        args =
          Array.isArray(maybeArgs)
            ? maybeArgs
            : [];

        client =
          maybeClient ||
          message.client;
      } else if (
        context?.message &&
        typeof context.message.reply ===
          "function"
      ) {
        message =
          context.message;

        args =
          Array.isArray(context.args)
            ? context.args
            : Array.isArray(
                maybeArgs
              )
            ? maybeArgs
            : [];

        client =
          context.client ||
          maybeClient ||
          message.client;
      }

      if (
        !client ||
        !message ||
        !message.guild
      ) {
        console.error(
          "[Zeechei Stats] Invalid command context."
        );

        return null;
      }

      let user =
        message.author;

      let member =
        message.member;

      const mentioned =
        message.mentions?.users?.first?.();

      const raw =
        Array.isArray(args)
          ? args[0]
          : null;

      let targetId =
        mentioned?.id ||
        null;

      if (
        !targetId &&
        raw
      ) {
        const cleaned =
          String(raw)
            .replace(
              /[<@!>]/g,
              ""
            )
            .replace(
              /\D/g,
              ""
            );

        if (cleaned) {
          targetId =
            cleaned;
        }
      }

      if (targetId) {
        const fetched =
          await client.users
            .fetch(targetId)
            .catch(
              () => null
            );

        if (!fetched) {
          return message.reply(
            payload(
              new ContainerBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder()
                    .setContent(
                      `${EMOJIS.warning} **User not found.**`
                    )
                )
                .addActionRowComponents(
                  navigation(
                    message.author
                  )
                )
            )
          );
        }

        user =
          fetched;

        member =
          message.guild.members.cache.get(
            user.id
          ) ||
          await message.guild.members
            .fetch(user.id)
            .catch(
              () => null
            );
      }

      let currentPage =
        "home";

      const sent =
        await message.reply(
          payload(
            buildPage(
              currentPage,
              user,
              member,
              message.guild
            )
          )
        );

      if (
        !sent ||
        typeof sent.createMessageComponentCollector !==
          "function"
      ) {
        return sent;
      }

      const collector =
        sent.createMessageComponentCollector({
          time:
            10 * 60 * 1000,

          filter:
            interaction =>
              interaction.user.id ===
              message.author.id,
        });

      collector.on(
        "collect",
        async interaction => {
          try {
            if (
              interaction.customId ===
              `${STATS_ID}:menu`
            ) {
              const selected =
                interaction.values?.[0];

              if (!selected) {
                return;
              }

              currentPage =
                selected;

              return interaction.update(
                payload(
                  buildPage(
                    currentPage,
                    user,
                    member,
                    message.guild
                  )
                )
              );
            }

            if (
              interaction.customId ===
              `${STATS_ID}:home`
            ) {
              currentPage =
                "home";

              return interaction.update(
                payload(
                  buildPage(
                    "home",
                    user,
                    member,
                    message.guild
                  )
                )
              );
            }

            if (
              interaction.customId ===
              `${STATS_ID}:refresh`
            ) {
              return interaction.update(
                payload(
                  buildPage(
                    currentPage,
                    user,
                    member,
                    message.guild
                  )
                )
              );
            }
          } catch (error) {
            console.error(
              "[Zeechei Stats UI]",
              error?.stack ||
                error?.message ||
                error
            );

            if (
              !interaction.replied &&
              !interaction.deferred
            ) {
              await interaction
                .reply({
                  content:
                    "Stats panel could not be updated.",
                  flags:
                    MessageFlags.Ephemeral,
                })
                .catch(
                  () => {}
                );
            }
          }
        }
      );

      return sent;

    } catch (error) {
      console.error(
        "[Zeechei Stats]",
        error?.stack ||
          error?.message ||
          error
      );

      if (
        message &&
        typeof message.reply ===
          "function"
      ) {
        return message
          .reply(
            `${EMOJIS.warning} Stats command failed. Check the console for the exact error.`
          )
          .catch(
            () => null
          );
      }

      return null;
    }
  },
};