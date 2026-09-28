const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(
  process.cwd(),
  "data",
  "zeechei.json"
);

fs.mkdirSync(
  path.dirname(DB_PATH),
  { recursive: true }
);

let _data = null;

function load() {
  if (_data) return _data;

  try {
    _data = JSON.parse(
      fs.readFileSync(
        DB_PATH,
        "utf8"
      )
    );
  } catch {
    _data = {};
  }

  // Core
  if (!Array.isArray(_data.noprefix))
    _data.noprefix = [];

  if (!Array.isArray(_data.blacklist))
    _data.blacklist = [];

  if (!_data.timedBlacklist)
    _data.timedBlacklist = {};

  if (!_data.premium)
    _data.premium = {};

  if (!_data.guildSettings)
    _data.guildSettings = {};

  if (!_data.playlists)
    _data.playlists = {};

  if (!_data.warnings)
    _data.warnings = {};

  if (!_data.embedColors)
    _data.embedColors = {};

  if (!_data.mode247)
    _data.mode247 = {};

  if (!_data.sources)
    _data.sources = {};

  if (
    typeof _data.commandsUsed !==
    "number"
  ) {
    _data.commandsUsed = 0;
  }

  // Command statistics
  if (!_data.cmdStats) {
    _data.cmdStats = {
      global: {},
      guild: {},
      daily: {},
    };
  }

  if (!_data.cmdStats.global)
    _data.cmdStats.global = {};

  if (!_data.cmdStats.guild)
    _data.cmdStats.guild = {};

  if (!_data.cmdStats.daily)
    _data.cmdStats.daily = {};

  // Other systems
  if (!_data.musicWL)
    _data.musicWL = {};

  if (!_data.musicDisabled)
    _data.musicDisabled = {};

  if (!_data.afk) {
    _data.afk = {
      global: {},
      server: {},
    };
  }

  if (!_data.afk.global)
    _data.afk.global = {};

  if (!_data.afk.server)
    _data.afk.server = {};

  if (!_data.afkPings)
    _data.afkPings = {};

  if (!_data.spotify)
    _data.spotify = {};

  if (!_data.profiles)
    _data.profiles = {};

  if (!_data.afkCounts)
    _data.afkCounts = {};

  if (!_data.songPlays)
    _data.songPlays = {};

  if (!_data.customBadges)
    _data.customBadges = {};

  if (!_data.antiNuke)
    _data.antiNuke = {};

  if (!Array.isArray(_data.owners))
    _data.owners = [];

  // Main owner
  if (
    typeof _data.mainOwnerId !==
      "string" ||
    !_data.mainOwnerId
  ) {
    _data.mainOwnerId =
      _data.owners[0] || null;
  }

  // Developer system
  if (
    !_data.developers ||
    typeof _data.developers !==
      "object" ||
    Array.isArray(_data.developers)
  ) {
    _data.developers = {};
  }

  // User statistics
  if (!_data.userStats)
    _data.userStats = {};

  return _data;
}

function save() {
  try {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(
        _data,
        null,
        2
      )
    );
  } catch (err) {
    console.error(
      "[Database] Save error:",
      err
    );
  }
}

function ensureUserStats(userId) {
  const d = load();

  if (!d.userStats[userId]) {
    d.userStats[userId] = {
      messages: 0,
      commands: 0,
      lastMessage: 0,
      lastCommand: 0,
    };

    save();
  }

  return d.userStats[userId];
}

const Database = {

  // ═══════════════════════════════════════════════════════════════════════════
  // NO PREFIX
  // ═══════════════════════════════════════════════════════════════════════════

  isNoPrefix(userId) {
    return load().noprefix.includes(
      userId
    );
  },

  addNoPrefix(userId) {
    const d = load();

    if (
      !d.noprefix.includes(userId)
    ) {
      d.noprefix.push(userId);
      save();
    }
  },

  removeNoPrefix(userId) {
    const d = load();

    d.noprefix =
      d.noprefix.filter(
        id => id !== userId
      );

    save();
  },

  getAllNoPrefixUsers() {
    return [
      ...load().noprefix,
    ];
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLACKLIST
  // ═══════════════════════════════════════════════════════════════════════════

  isBlacklisted(userId) {
    const d = load();

    if (
      d.blacklist.includes(userId)
    ) {
      return true;
    }

    if (d.timedBlacklist[userId]) {
      if (
        Date.now() <
        d.timedBlacklist[userId]
      ) {
        return true;
      }

      delete d.timedBlacklist[userId];

      save();
    }

    return false;
  },

  addBlacklist(userId) {
    const d = load();

    if (
      !d.blacklist.includes(userId)
    ) {
      d.blacklist.push(userId);
      save();
    }
  },

  removeBlacklist(userId) {
    const d = load();

    d.blacklist =
      d.blacklist.filter(
        id => id !== userId
      );

    delete d.timedBlacklist[userId];

    save();
  },

  getBlacklist() {
    return [
      ...load().blacklist,
    ];
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMED BLACKLIST
  // ═══════════════════════════════════════════════════════════════════════════

  addTimedBlacklist(
    userId,
    durationMs
  ) {
    const d = load();

    const expiresAt =
      Date.now() +
      Number(durationMs);

    d.timedBlacklist[userId] =
      expiresAt;

    save();

    return expiresAt;
  },

  getTimedBlacklistExpiry(
    userId
  ) {
    return (
      load().timedBlacklist[
        userId
      ] || null
    );
  },

  getTimedBlacklist() {
    const d = load();
    const now = Date.now();

    return Object.entries(
      d.timedBlacklist || {}
    )
      .filter(
        ([, expiresAt]) =>
          expiresAt > now
      )
      .map(
        ([userId, expiresAt]) => ({
          userId,
          expiresAt,
        })
      );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PREMIUM
  // ═══════════════════════════════════════════════════════════════════════════

  isPremium(id) {
    return !!load().premium[id];
  },

  addPremium(id, data) {
    const d = load();

    d.premium[id] = data;

    save();
  },

  removePremium(id) {
    const d = load();

    delete d.premium[id];

    save();
  },

  getPremium() {
    return {
      ...load().premium,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GUILD SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  getSettings(guildId) {
    return (
      load().guildSettings[
        guildId
      ] || {}
    );
  },

  setDjRole(
    guildId,
    roleId
  ) {
    const d = load();

    if (
      !d.guildSettings[guildId]
    ) {
      d.guildSettings[guildId] =
        {};
    }

    d.guildSettings[guildId]
      .dj_role = roleId;

    save();
  },

  setAnnounceChannel(
    guildId,
    channelId
  ) {
    const d = load();

    if (
      !d.guildSettings[guildId]
    ) {
      d.guildSettings[guildId] =
        {};
    }

    d.guildSettings[guildId]
      .announce_ch = channelId;

    save();
  },

  getPrefix(guildId) {
    return (
      load().guildSettings[
        guildId
      ]?.prefix || null
    );
  },

  setPrefix(
    guildId,
    prefix
  ) {
    const d = load();

    if (
      !d.guildSettings[guildId]
    ) {
      d.guildSettings[guildId] =
        {};
    }

    d.guildSettings[guildId]
      .prefix = prefix;

    save();
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WARNINGS
  // ═══════════════════════════════════════════════════════════════════════════

  addWarning(
    guildId,
    userId,
    reason,
    moderatorId
  ) {
    const d = load();

    if (!d.warnings[guildId]) {
      d.warnings[guildId] = {};
    }

    if (
      !d.warnings[guildId][userId]
    ) {
      d.warnings[guildId][userId] =
        [];
    }

    const warnId = String(
      Math.floor(
        100000 +
        Math.random() *
          900000
      )
    );

    d.warnings[guildId][
      userId
    ].push({
      warnId,
      reason:
        reason ||
        "No reason provided",
      modId: moderatorId,
      created:
        Math.floor(
          Date.now() / 1000
        ),
    });

    save();

    return warnId;
  },

  getWarnings(
    guildId,
    userId
  ) {
    return dSafe(
      load().warnings[
        guildId
      ]?.[userId]
    )
      ? []
      : (
          load().warnings[
            guildId
          ]?.[userId] || []
        )
          .slice()
          .reverse();
  },

  clearWarnings(
    guildId,
    userId
  ) {
    const d = load();

    if (d.warnings[guildId]) {
      delete d.warnings[guildId][
        userId
      ];
    }

    save();
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 24/7
  // ═══════════════════════════════════════════════════════════════════════════

  get247(guildId) {
    return !!load().mode247[
      guildId
    ];
  },

  set247(
    guildId,
    enabled,
    voiceChannelId,
    textChannelId
  ) {
    const d = load();

    if (enabled) {
      d.mode247[guildId] = {
        voiceChannelId:
          voiceChannelId || null,

        textChannelId:
          textChannelId || null,
      };
    } else {
      delete d.mode247[guildId];
    }

    save();
  },

  getAll247Guilds() {
    return Object.keys(
      load().mode247 || {}
    );
  },

  getAll247GuildData() {
    return Object.entries(
      load().mode247 || {}
    ).map(
      ([guildId, data]) => ({
        guildId,

        voiceChannelId:
          typeof data === "object"
            ? data.voiceChannelId ||
              null
            : null,

        textChannelId:
          typeof data === "object"
            ? data.textChannelId ||
              null
            : null,
      })
    );
  },

  get247ChannelIds(
    guildId
  ) {
    const data =
      load().mode247[guildId];

    if (
      !data ||
      typeof data !==
        "object"
    ) {
      return {
        voiceChannelId: null,
        textChannelId: null,
      };
    }

    return {
      voiceChannelId:
        data.voiceChannelId ||
        null,

      textChannelId:
        data.textChannelId ||
        null,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOURCES
  // ═══════════════════════════════════════════════════════════════════════════

  getSource(guildId) {
    return (
      load().sources[guildId] ??
      null
    );
  },

  setSource(
    guildId,
    source
  ) {
    const d = load();

    d.sources[guildId] =
      source;

    save();
  },

  deleteSource(
    guildId
  ) {
    const d = load();

    delete d.sources[guildId];

    save();
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MUSIC
  // ═══════════════════════════════════════════════════════════════════════════

  isMusicEnabled(
    guildId
  ) {
    const d = load();

    if (!d.musicDisabled) {
      return true;
    }

    return !d.musicDisabled[
      guildId
    ];
  },

  setMusicEnabled(
    guildId,
    enabled
  ) {
    const d = load();

    if (!d.musicDisabled) {
      d.musicDisabled = {};
    }

    if (enabled) {
      delete d.musicDisabled[
        guildId
      ];
    } else {
      d.musicDisabled[
        guildId
      ] = true;
    }

    save();
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MUSIC WHITELIST
  // ═══════════════════════════════════════════════════════════════════════════

  getMusicWL(
    guildId
  ) {
    return [
      ...(load().musicWL[
        guildId
      ] || []),
    ];
  },

  isMusicWL(
    guildId,
    userId
  ) {
    return (
      load().musicWL[
        guildId
      ] || []
    ).includes(userId);
  },

  addMusicWL(
    guildId,
    userId
  ) {
    const d = load();

    if (!d.musicWL[guildId]) {
      d.musicWL[guildId] = [];
    }

    if (
      !d.musicWL[guildId].includes(
        userId
      )
    ) {
      d.musicWL[guildId].push(
        userId
      );

      save();

      return true;
    }

    return false;
  },

  removeMusicWL(
    guildId,
    userId
  ) {
    const d = load();

    if (!d.musicWL[guildId]) {
      return false;
    }

    const before =
      d.musicWL[guildId].length;

    d.musicWL[guildId] =
      d.musicWL[guildId].filter(
        id => id !== userId
      );

    save();

    return (
      d.musicWL[guildId].length <
      before
    );
  },

  clearMusicWL(
    guildId
  ) {
    const d = load();

    d.musicWL[guildId] = [];

    save();
  },

  canPlayMusic(
    guildId,
    userId
  ) {
    if (
      this.isMusicEnabled(
        guildId
      )
    ) {
      return true;
    }

    return this.isMusicWL(
      guildId,
      userId
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMAND STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  trackCommand(
    userId,
    guildId
  ) {
    const d = load();

    const gid =
      guildId || "dm";

    d.commandsUsed =
      Number(
        d.commandsUsed || 0
      ) + 1;

    if (!d.cmdStats.global) {
      d.cmdStats.global = {};
    }

    d.cmdStats.global[userId] =
      Number(
        d.cmdStats.global[
          userId
        ] || 0
      ) + 1;

    if (!d.cmdStats.guild) {
      d.cmdStats.guild = {};
    }

    if (!d.cmdStats.guild[gid]) {
      d.cmdStats.guild[gid] = {
        total: 0,
        byUser: {},
      };
    }

    d.cmdStats.guild[gid]
      .total++;

    d.cmdStats.guild[gid]
      .byUser[userId] =
      Number(
        d.cmdStats.guild[gid]
          .byUser[userId] || 0
      ) + 1;

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    if (!d.cmdStats.daily) {
      d.cmdStats.daily = {};
    }

    if (
      !d.cmdStats.daily[today]
    ) {
      d.cmdStats.daily[today] =
        {};
    }

    d.cmdStats.daily[today][
      userId
    ] =
      Number(
        d.cmdStats.daily[today][
          userId
        ] || 0
      ) + 1;

    const days =
      Object.keys(
        d.cmdStats.daily
      ).sort();

    while (days.length > 7) {
      delete d.cmdStats.daily[
        days.shift()
      ];
    }

    const stats =
      ensureUserStats(
        userId
      );

    stats.commands =
      Number(
        stats.commands || 0
      ) + 1;

    stats.lastCommand =
      Date.now();

    save();

    return stats;
  },

  getCommandsUsed() {
    return (
      load().commandsUsed || 0
    );
  },

  getUserGlobalTotal(
    userId
  ) {
    return (
      load().cmdStats.global?.[
        userId
      ] || 0
    );
  },

  getGuildTotal(
    guildId
  ) {
    return (
      load().cmdStats.guild?.[
        guildId
      ]?.total || 0
    );
  },

  getUserGuildTotal(
    userId,
    guildId
  ) {
    return (
      load().cmdStats.guild?.[
        guildId
      ]?.byUser?.[userId] || 0
    );
  },

  getDailyUserTotal(
    userId
  ) {
    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    return (
      load().cmdStats.daily?.[
        today
      ]?.[userId] || 0
    );
  },

  getGuildLeaderboard(
    guildId,
    limit = 10
  ) {
    const users =
      load().cmdStats.guild?.[
        guildId
      ]?.byUser || {};

    return Object.entries(
      users
    )
      .map(
        ([userId, count]) => ({
          userId,
          count: Number(count),
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, limit);
  },

  getDailyLeaderboard(
    limit = 10
  ) {
    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    return Object.entries(
      load().cmdStats.daily?.[
        today
      ] || {}
    )
      .map(
        ([userId, count]) => ({
          userId,
          count: Number(count),
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, limit);
  },

  getGlobalLeaderboard(
    limit = 10
  ) {
    return Object.entries(
      load().cmdStats.global ||
        {}
    )
      .map(
        ([userId, count]) => ({
          userId,
          count: Number(count),
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, limit);
  },

  incrementCommandsUsed() {
    return this.trackCommand(
      "system",
      "system"
    );
  },

  resetCommandsUsed() {
    const d = load();

    d.commandsUsed = 0;

    save();
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OWNER SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  isOwner(userId) {
    return load().owners.includes(
      userId
    );
  },

  addOwner(userId) {
    const d = load();

    if (
      !d.owners.includes(userId)
    ) {
      d.owners.push(userId);

      if (!d.mainOwnerId) {
        d.mainOwnerId = userId;
      }

      save();

      return true;
    }

    return false;
  },

  removeOwner(userId) {
    const d = load();

    const before =
      d.owners.length;

    d.owners =
      d.owners.filter(
        id => id !== userId
      );

    if (
      d.mainOwnerId === userId
    ) {
      d.mainOwnerId =
        d.owners[0] || null;
    }

    save();

    return (
      d.owners.length <
      before
    );
  },

  getOwners() {
    return [
      ...load().owners,
    ];
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN OWNER
  // ═══════════════════════════════════════════════════════════════════════════

  isMainOwner(userId) {
    const d = load();

    return (
      !!userId &&
      (
        d.mainOwnerId ||
        d.owners[0] ||
        null
      ) === userId
    );
  },

  getMainOwner() {
    const d = load();

    return (
      d.mainOwnerId ||
      d.owners[0] ||
      null
    );
  },

  setMainOwner(userId) {
    const d = load();

    if (!userId) {
      return false;
    }

    d.mainOwnerId = userId;

    if (
      !d.owners.includes(userId)
    ) {
      d.owners.unshift(userId);
    }

    save();

    return true;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEVELOPER SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  isDeveloper(userId) {
    const dev =
      load().developers?.[
        userId
      ];

    return !!(
      dev &&
      dev.enabled !== false
    );
  },

  addDeveloper(
    userId,
    addedBy
  ) {
    const d = load();

    if (!d.developers) {
      d.developers = {};
    }

    if (
      d.developers[userId]
    ) {
      return false;
    }

    d.developers[userId] = {
      enabled: true,

      permissions: {
        music: true,
        general: true,
        developer: false,
      },

      addedBy:
        addedBy || null,

      addedAt:
        Date.now(),
    };

    save();

    return true;
  },

  removeDeveloper(
    userId
  ) {
    const d = load();

    if (
      !d.developers?.[userId]
    ) {
      return false;
    }

    delete d.developers[
      userId
    ];

    save();

    return true;
  },

  getDeveloper(
    userId
  ) {
    const dev =
      load().developers?.[
        userId
      ];

    if (!dev) {
      return null;
    }

    return {
      ...dev,

      enabled:
        dev.enabled !== false,

      permissions: {
        music:
          dev.permissions?.music ===
          true,

        general:
          dev.permissions?.general ===
          true,

        developer:
          dev.permissions
            ?.developer ===
          true,
      },
    };
  },

  getDevelopers() {
    return Object.entries(
      load().developers || {}
    ).map(
      ([userId, data]) => ({
        userId,

        enabled:
          data?.enabled !== false,

        permissions: {
          music:
            data?.permissions
              ?.music === true,

          general:
            data?.permissions
              ?.general === true,

          developer:
            data?.permissions
              ?.developer === true,
        },

        addedBy:
          data?.addedBy ||
          null,

        addedAt:
          data?.addedAt ||
          null,
      })
    );
  },

  setDeveloperPermission(
    userId,
    permission,
    enabled
  ) {
    const d = load();

    if (
      !d.developers?.[userId]
    ) {
      return false;
    }

    if (
      !d.developers[userId]
        .permissions
    ) {
      d.developers[userId]
        .permissions = {
        music: true,
        general: true,
        developer: false,
      };
    }

    d.developers[userId]
      .permissions[
        permission
      ] = !!enabled;

    save();

    return true;
  },

  hasDeveloperPermission(
    userId,
    permission
  ) {
    const dev =
      load().developers?.[
        userId
      ];

    return !!(
      dev &&
      dev.enabled !== false &&
      dev.permissions?.[
        permission
      ] === true
    );
  },

  resetDeveloperPermissions(
    userId
  ) {
    const d = load();

    if (
      !d.developers?.[userId]
    ) {
      return false;
    }

    d.developers[userId]
      .permissions = {
      music: true,
      general: true,
      developer: false,
    };

    save();

    return true;
  },

  setDeveloperEnabled(
    userId,
    enabled
  ) {
    const d = load();

    if (
      !d.developers?.[userId]
    ) {
      return false;
    }

    d.developers[userId]
      .enabled = !!enabled;

    save();

    return true;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // USER MESSAGE / COMMAND STATS
  // ═══════════════════════════════════════════════════════════════════════════

  ensureUserStats(userId) {
    return ensureUserStats(
      userId
    );
  },

  trackMessage(userId) {
    const stats =
      ensureUserStats(userId);

    stats.messages =
      Number(
        stats.messages || 0
      ) + 1;

    stats.lastMessage =
      Date.now();

    save();

    return stats;
  },

  getUserStats(userId) {
    return (
      load().userStats?.[
        userId
      ] || {
        messages: 0,
        commands: 0,
        lastMessage: 0,
        lastCommand: 0,
      }
    );
  },

  getTopMessages(
    limit = 10
  ) {
    return Object.entries(
      load().userStats || {}
    )
      .map(
        ([userId, stats]) => ({
          userId,

          messages: Number(
            stats.messages || 0
          ),

          commands: Number(
            stats.commands || 0
          ),
        })
      )
      .sort(
        (a, b) =>
          b.messages -
          a.messages
      )
      .slice(0, limit);
  },

  getTopCommands(
    limit = 10
  ) {
    return Object.entries(
      load().userStats || {}
    )
      .map(
        ([userId, stats]) => ({
          userId,

          messages: Number(
            stats.messages || 0
          ),

          commands: Number(
            stats.commands || 0
          ),
        })
      )
      .sort(
        (a, b) =>
          b.commands -
          a.commands
      )
      .slice(0, limit);
  },

  getMessageRank(userId) {
    const users =
      this.getTopMessages(
        Object.keys(
          load().userStats || {}
        ).length || 1
      );

    const index =
      users.findIndex(
        user =>
          user.userId ===
          userId
      );

    return index === -1
      ? null
      : index + 1;
  },

  getCommandRank(userId) {
    const users =
      this.getTopCommands(
        Object.keys(
          load().userStats || {}
        ).length || 1
      );

    const index =
      users.findIndex(
        user =>
          user.userId ===
          userId
      );

    return index === -1
      ? null
      : index + 1;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AFK
  // ═══════════════════════════════════════════════════════════════════════════

  setAfkGlobal(
    userId,
    reason
  ) {
    const d = load();

    d.afk.global[userId] = {
      reason:
        reason ||
        "No reason provided",

      timestamp:
        Date.now(),
    };

    save();
  },

  setAfkServer(
    guildId,
    userId,
    reason
  ) {
    const d = load();

    if (
      !d.afk.server[guildId]
    ) {
      d.afk.server[guildId] =
        {};
    }

    d.afk.server[guildId][
      userId
    ] = {
      reason:
        reason ||
        "No reason provided",

      timestamp:
        Date.now(),
    };

    save();
  },

  removeAfk(
    guildId,
    userId
  ) {
    const d = load();

    let removed = false;

    if (
      d.afk.global[userId]
    ) {
      delete d.afk.global[
        userId
      ];

      removed = true;
    }

    if (
      d.afk.server[guildId]
        ?.[userId]
    ) {
      delete d.afk.server[
        guildId
      ][userId];

      removed = true;
    }

    if (removed) {
      save();
    }

    return removed;
  },

  getAfk(
    guildId,
    userId
  ) {
    const d = load();

    const global =
      d.afk.global[userId] ||
      null;

    const server =
      d.afk.server[guildId]
        ?.[userId] || null;

    if (global) {
      return {
        ...global,
        type: "global",
      };
    }

    if (server) {
      return {
        ...server,
        type: "server",
      };
    }

    return null;
  },

  isAfk(
    guildId,
    userId
  ) {
    const d = load();

    return !!(
      d.afk.global[userId] ||
      d.afk.server[guildId]
        ?.[userId]
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AFK PINGS
  // ═══════════════════════════════════════════════════════════════════════════

  addAfkPing(
    guildId,
    afkUserId,
    pingerId,
    pingerName,
    messageUrl
  ) {
    const d = load();

    const key =
      `${guildId}:${afkUserId}`;

    if (!d.afkPings[key]) {
      d.afkPings[key] = [];
    }

    const exists =
      d.afkPings[key].some(
        ping =>
          ping.messageUrl ===
          messageUrl
      );

    if (!exists) {
      d.afkPings[key].push({
        pingerId,
        pingerName,
        messageUrl,
        timestamp:
          Date.now(),
      });

      save();
    }
  },

  getAfkPings(
    guildId,
    afkUserId
  ) {
    return (
      load().afkPings?.[
        `${guildId}:${afkUserId}`
      ] || []
    );
  },

  clearAfkPings(
    guildId,
    afkUserId
  ) {
    const d = load();

    delete d.afkPings[
      `${guildId}:${afkUserId}`
    ];

    save();
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LIKED SONGS
  // ═══════════════════════════════════════════════════════════════════════════

  getLikedSongs(userId) {
    return (
      load().playlists[userId]
        ?.["Liked Songs"]
        ?.tracks || []
    );
  },

  addLikedSong(
    userId,
    url,
    title,
    author,
    duration
  ) {
    const d = load();

    if (!d.playlists[userId]) {
      d.playlists[userId] =
        {};
    }

    if (
      !d.playlists[userId]
        ["Liked Songs"]
    ) {
      d.playlists[userId]
        ["Liked Songs"] = {
        tracks: [],
        createdAt:
          Date.now(),
        isLiked: true,
      };
    }

    const tracks =
      d.playlists[userId]
        ["Liked Songs"]
        .tracks;

    if (
      tracks.some(
        track =>
          track.url === url
      )
    ) {
      return false;
    }

    tracks.push({
      url,
      title,

      author:
        author || "Unknown",

      duration:
        duration || 0,

      addedAt:
        Date.now(),
    });

    save();

    return true;
  },

  removeLikedSong(
    userId,
    url
  ) {
    const d = load();

    const playlist =
      d.playlists[userId]
        ?.["Liked Songs"];

    if (!playlist) {
      return false;
    }

    const before =
      playlist.tracks.length;

    playlist.tracks =
      playlist.tracks.filter(
        track =>
          track.url !== url
      );

    if (
      playlist.tracks.length <
      before
    ) {
      save();

      return true;
    }

    return false;
  },

  isLiked(
    userId,
    url
  ) {
    return !!(
      load()
        .playlists[userId]
        ?.["Liked Songs"]
        ?.tracks
        ?.some(
          track =>
            track.url === url
        )
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPOTIFY
  // ═══════════════════════════════════════════════════════════════════════════

  getSpotify(userId) {
    return (
      load().spotify[userId] ||
      null
    );
  },

  setSpotify(
    userId,
    data
  ) {
    const d = load();

    d.spotify[userId] = {
      ...data,
      connectedAt:
        Date.now(),
    };

    save();
  },

  removeSpotify(userId) {
    const d = load();

    delete d.spotify[userId];

    save();
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE
  // ═══════════════════════════════════════════════════════════════════════════

  getProfile(userId) {
    return (
      load().profiles[userId] ||
      null
    );
  },

  getBio(userId) {
    return (
      load().profiles[userId]
        ?.bio || null
    );
  },

  setBio(
    userId,
    bio
  ) {
    const d = load();

    if (!d.profiles[userId]) {
      d.profiles[userId] = {
        bio: null,
        badges: [],
        views: 0,
      };
    }

    d.profiles[userId].bio =
      bio || null;

    save();
  },

  getProfileViews(
    userId
  ) {
    return Number(
      load().profiles[userId]
        ?.views || 0
    );
  },

  incrementProfileViews(
    userId
  ) {
    const d = load();

    if (!d.profiles[userId]) {
      d.profiles[userId] = {
        bio: null,
        badges: [],
        views: 0,
      };
    }

    d.profiles[userId].views =
      Number(
        d.profiles[userId].views ||
          0
      ) + 1;

    save();

    return d.profiles[userId]
      .views;
  },

  getUserBadges(userId) {
    return (
      load().profiles[userId]
        ?.badges || []
    );
  },

  hasBadge(
    userId,
    badge
  ) {
    return (
      load().profiles[userId]
        ?.badges || []
    ).includes(badge);
  },

  addBadge(
    userId,
    badge
  ) {
    const d = load();

    if (!d.profiles[userId]) {
      d.profiles[userId] = {
        bio: null,
        badges: [],
        views: 0,
      };
    }

    if (
      !Array.isArray(
        d.profiles[userId]
          .badges
      )
    ) {
      d.profiles[userId]
        .badges = [];
    }

    if (
      !d.profiles[userId]
        .badges
        .includes(badge)
    ) {
      d.profiles[userId]
        .badges.push(badge);

      save();

      return true;
    }

    return false;
  },

  removeBadge(
    userId,
    badge
  ) {
    const d = load();

    if (
      !d.profiles[userId]
        ?.badges
    ) {
      return false;
    }

    const before =
      d.profiles[userId]
        .badges.length;

    d.profiles[userId].badges =
      d.profiles[userId]
        .badges.filter(
          badgeId =>
            badgeId !== badge
        );

    if (
      d.profiles[userId]
        .badges.length <
      before
    ) {
      save();

      return true;
    }

    return false;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOM BADGES
  // ═══════════════════════════════════════════════════════════════════════════

  getCustomBadges() {
    return (
      load().customBadges || {}
    );
  },

  getCustomBadge(key) {
    return (
      load().customBadges?.[
        key
      ] || null
    );
  },

  addCustomBadge(
    key,
    data
  ) {
    const d = load();

    d.customBadges[key] =
      data;

    save();
  },

  removeCustomBadge(key) {
    const d = load();

    delete d.customBadges[
      key
    ];

    save();
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADERBOARDS
  // ═══════════════════════════════════════════════════════════════════════════

  incrementAfkCount(
    userId
  ) {
    const d = load();

    d.afkCounts[userId] =
      Number(
        d.afkCounts[userId] ||
          0
      ) + 1;

    save();
  },

  getAfkLeaderboard(
    limit = 10
  ) {
    return Object.entries(
      load().afkCounts || {}
    )
      .map(
        ([userId, count]) => ({
          userId,
          count: Number(count),
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, limit);
  },

  incrementSongsPlayed(
    userId
  ) {
    const d = load();

    d.songPlays[userId] =
      Number(
        d.songPlays[userId] ||
          0
      ) + 1;

    save();
  },

  getSongsLeaderboard(
    limit = 10
  ) {
    return Object.entries(
      load().songPlays || {}
    )
      .map(
        ([userId, count]) => ({
          userId,
          count: Number(count),
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, limit);
  },

  getBadgeLeaderboard(
    limit = 10
  ) {
    return Object.entries(
      load().profiles || {}
    )
      .map(
        ([userId, profile]) => ({
          userId,

          count:
            (
              profile?.badges ||
              []
            ).length,
        })
      )
      .filter(
        item =>
          item.count > 0
      )
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, limit);
  },

  getLikedLeaderboard(
    limit = 10
  ) {
    return Object.entries(
      load().playlists || {}
    )
      .map(
        ([userId, playlists]) => ({
          userId,

          count:
            playlists?.[
              "Liked Songs"
            ]?.tracks?.length ||
            0,
        })
      )
      .filter(
        item =>
          item.count > 0
      )
      .sort(
        (a, b) =>
          b.count - a.count
      )
      .slice(0, limit);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EMBED COLORS
  // ═══════════════════════════════════════════════════════════════════════════

  getEmbedColor(
    guildId
  ) {
    return (
      load().embedColors[
        guildId
      ] ?? null
    );
  },

  setEmbedColor(
    guildId,
    color
  ) {
    const d = load();

    d.embedColors[guildId] =
      color;

    save();
  },

  deleteEmbedColor(
    guildId
  ) {
    const d = load();

    delete d.embedColors[
      guildId
    ];

    save();
  },

  getAllEmbedColors() {
    return (
      load().embedColors || {}
    );
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTI-NUKE
  // ═══════════════════════════════════════════════════════════════════════════

  getAntiNuke(
    guildId
  ) {
    return (
      load().antiNuke[
        guildId
      ] || {}
    );
  },

  setAntiNuke(
    guildId,
    settings
  ) {
    const d = load();

    d.antiNuke[guildId] = {
      ...(
        d.antiNuke[guildId] ||
        {}
      ),
      ...settings,
    };

    save();

    return d.antiNuke[
      guildId
    ];
  },

  deleteAntiNuke(
    guildId
  ) {
    const d = load();

    delete d.antiNuke[
      guildId
    ];

    save();
  },

  setAntiNukeEnabled(
    guildId,
    enabled
  ) {
    return this.setAntiNuke(
      guildId,
      {
        enabled: !!enabled,
      }
    );
  },

  setAntiNukePunishment(
    guildId,
    punishment
  ) {
    return this.setAntiNuke(
      guildId,
      {
        punishment,
      }
    );
  },

  setAntiNukeLogChannel(
    guildId,
    channelId
  ) {
    return this.setAntiNuke(
      guildId,
      {
        logChannelId:
          channelId || null,
      }
    );
  },

  setAntiNukeThreshold(
    guildId,
    action,
    value
  ) {
    const current =
      this.getAntiNuke(
        guildId
      );

    return this.setAntiNuke(
      guildId,
      {
        thresholds: {
          ...(current.thresholds ||
            {}),
          [action]:
            Number(value),
        },
      }
    );
  },

  addAntiNukeWhitelist(
    guildId,
    userId
  ) {
    const current =
      this.getAntiNuke(
        guildId
      );

    const whitelist =
      Array.isArray(
        current.whitelist
      )
        ? [
            ...current.whitelist,
          ]
        : [];

    if (
      !whitelist.includes(
        userId
      )
    ) {
      whitelist.push(userId);
    }

    return this.setAntiNuke(
      guildId,
      {
        whitelist,
      }
    );
  },

  removeAntiNukeWhitelist(
    guildId,
    userId
  ) {
    const current =
      this.getAntiNuke(
        guildId
      );

    const whitelist =
      (
        current.whitelist ||
        []
      ).filter(
        id =>
          id !== userId
      );

    return this.setAntiNuke(
      guildId,
      {
        whitelist,
      }
    );
  },

  getAntiNukeWhitelist(
    guildId
  ) {
    return [
      ...(
        this.getAntiNuke(
          guildId
        ).whitelist || []
      ),
    ];
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYLISTS
  // ═══════════════════════════════════════════════════════════════════════════

  createPlaylist(
    ownerId,
    name
  ) {
    const d = load();

    if (!d.playlists[ownerId]) {
      d.playlists[ownerId] =
        {};
    }

    if (
      d.playlists[ownerId][
        name
      ]
    ) {
      return false;
    }

    d.playlists[ownerId][
      name
    ] = {
      tracks: [],
      createdAt:
        Date.now(),
    };

    save();

    return true;
  },

  deletePlaylist(
    ownerId,
    name
  ) {
    const d = load();

    if (
      !d.playlists[ownerId]?.[
        name
      ]
    ) {
      return false;
    }

    delete d.playlists[ownerId][
      name
    ];

    save();

    return true;
  },

  getPlaylist(
    ownerId,
    name
  ) {
    return (
      load().playlists[
        ownerId
      ]?.[name] || null
    );
  },

  getUserPlaylists(
    ownerId
  ) {
    const playlists =
      load().playlists[
        ownerId
      ] || {};

    return Object.keys(
      playlists
    ).map(
      name => ({
        name,
        ...playlists[name],
      })
    );
  },

  addTrackToPlaylist(
    ownerId,
    name,
    url,
    title,
    author,
    duration
  ) {
    const d = load();

    if (
      !d.playlists[ownerId]?.[
        name
      ]
    ) {
      return false;
    }

    d.playlists[ownerId][
      name
    ].tracks.push({
      url,
      title,

      author:
        author || "Unknown",

      duration:
        duration || 0,

      addedAt:
        Date.now(),
    });

    save();

    return true;
  },

  addTracksToPlaylist(
    ownerId,
    name,
    tracks
  ) {
    const d = load();

    if (
      !d.playlists[ownerId]?.[
        name
      ]
    ) {
      return false;
    }

    for (
      const track of tracks
    ) {
      d.playlists[ownerId][
        name
      ].tracks.push({
        url: track.url,
        title: track.title,

        author:
          track.author ||
          "Unknown",

        duration:
          track.duration || 0,

        addedAt:
          Date.now(),
      });
    }

    save();

    return d.playlists[ownerId][
      name
    ].tracks.length;
  },

  removeTrackFromPlaylist(
    ownerId,
    name,
    index
  ) {
    const d = load();

    const playlist =
      d.playlists[ownerId]?.[
        name
      ];

    if (
      !playlist ||
      index < 0 ||
      index >=
        playlist.tracks.length
    ) {
      return null;
    }

    const [removed] =
      playlist.tracks.splice(
        index,
        1
      );

    save();

    return removed;
  },

  getPlaylistTracks(
    ownerId,
    name
  ) {
    return (
      load().playlists[
        ownerId
      ]?.[name]?.tracks || null
    );
  },

  renamePlaylist(
    ownerId,
    oldName,
    newName
  ) {
    const d = load();

    const playlists =
      d.playlists[ownerId];

    if (
      !playlists?.[oldName] ||
      playlists[newName]
    ) {
      return false;
    }

    playlists[newName] =
      playlists[oldName];

    delete playlists[oldName];

    save();

    return true;
  },

  getPlaylistCount(
    ownerId
  ) {
    return Object.keys(
      load().playlists[
        ownerId
      ] || {}
    ).length;
  },
};

function dSafe(value) {
  return (
    value === undefined ||
    value === null
  );
}

module.exports = Database;