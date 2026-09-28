// ── Central Emoji Registry ───────────────────────────────────────────────────
// Edit ONLY this file to update every emoji across the bot instantly.

function p(str) {
  return str;
}

/** Button emoji objects — pass to .setEmoji(BTN.xxx) */
const BTN = {
  // Now Playing — Row 1
  np_prev:         p("⏮️"),
  np_pause:        p("⏸️"),
  np_resume:       p("▶️"),
  np_skip:         p("⏭️"),   // zeecheinext~1 variant
  np_loop_off:     p("🔁"),
  np_loop_track:   p("🔂"),
  np_shuffle:      p("🔀"),

  // Now Playing — Row 2
  np_voldown:      p("🔉"),
  np_queue:        p("📋"),
  np_volup:        p("🔊"),
  np_stop:         p("⏹️"),
  np_autoplay_on:  p("▶️"),
  np_autoplay_off: p("▶️"),
  np_rewind:       p("⏮️"),
  np_delete:       p("🗑️"),
  np_allcmds:      p("📄"),

  // Navigation buttons
  nav_first: p("⏮️"),
  nav_prev:  p("⏮️"),
  nav_close: p("🔹"),
  nav_next:  p("➡️"),
  nav_last:  p("⏭️"),

  // Confirm / Cancel
  btn_delete:   p("🗑️"),
  btn_cancel_x: p("❌"),
  btn_confirm:  p("✅"),

  // Link buttons
  link_invite:  p("🔗"),
  link_support: p("🆘"),
  link_website: p("🌐"),
};

/** Inline text strings — used in embed/message content */
const TXT = {
  // Status
  tick:      "<:ZeecheiTick:1543286654905618493>",
  cross:     "<:ZeecheiCross:1543286900914393099>",
  warning:   "<:ZeecheiWarn:1543288252444844132>",
  enable:    "<:ZeecheiTick:1543286654905618493>",
  disable:   "<:ZeecheiCross:1543286900914393099>",
  process:   "<a:Loading:1543442724018192414>",

  // Navigation / bullets
  rightsort: "<:whitearrowright:1551224628800913549>",
  arrow:     "<:wickarrow:1548664217471680583>",
  dot:       "•",
  space:     "<:1spacer:1543441829058453614>",

  // Music
  music:     "<:Music:1543298091678179389>",
  queue:     "📋",
  volume:    "🔊",
  addsong:   "🎶",
  duration:  "⏱️",
  request:   "📝",
  search:    "🔎",

  // Bot identity
  zeechei:     "<a:bots:1550791562928070696>",
  home:      "🏠",
  spacer:    "▫️",
  wick_arrow:"<:ZeecheiArrow:1547069882649022535>",

  // Help category icons
  cat_music:       "🎵",
  cat_filter:      "⚙️",
  cat_playlist:    "📜",
  cat_moderation:  "🛡️",
  cat_information: "ℹ️",
  cat_settings:    "⚙️",
  cat_fun:         "🎮",
  cat_general:     "🌐",
  cat_customize:   "🛠️",
  cat_home:        "🏠",
  cat_all:         "📄",
};

/** Dropdown placeholder strings */
const PH = {
  filter: "Select an audio filter...",
  help:   "📄 Browse a category...",
};

/** NP hint line — shown below now-playing artwork */
const NP_HINT =
  `-# ⏮️ Prev  `
  + `⏸️/▶️ Pause  `
  + `⏭️ Skip  `
  + `🔁 Loop  `
  + `🔀 Shuffle  •  `
  + `🔉/🔊 Vol  `
  + `📋 Queue  `
  + `⏹️ Stop  `
  + `▶️ Autoplay`;

const LEO_MUSIC_EMOJIS = {
    music: '<a:nowplaying:1550429430071951440>',
    playing: '<a:music:1550746404459126894>',
    pause: '<:pause:1519708701315960912>',
    resume: '<:play:1521038588735914160>',
    play: '<:play:1521038588735914160>',
    skip: '<:stop:1550512849732894751>',
    stop: '<a:stop:1551223401933316136>',
    queue: '<:queue:1520715888469344256>',
    loop: '<:loop:1520718129058152539>',
    loopTrack: '<:loop:1437436886305083563>',
    volume: '<:vup:1520114819683057684>',
    volumeDown: '<:vdown:1520114948393402480>',
    shuffle: '<:shuffle:1520719720028831744>',
    back: '<:Backward:1550514529581142106>',
    filter: '<:filter:1550514690172526665>',
    remove: '<:remove:1550530441105244330>',
    clear: '<:remove:1550530441105244330>',
    lyrics: '<:lyrics:1550530542947016885>',
    favorite: '<:favorite:1550530747977302127>',
    download: '<:white_download:1550530967217901588>',
    seek: '<:skip:1550512785820221540>',
    error: '<:cross:1550532309894045846>',
    success: '<:tick:1550532417788317766>',
    autoplay: '<:autoplay:1550534822647169165>',
    next: '<:next:1550531968297345049>',
    prev: '<:Backward:1550514529581142106>',
    move: '<:move:1520782330359316540>',
    playlist: '<:playlist:1520782383274528930>',
    live: '<:live:1520788293824938196>',
    info: '<:info:1520789808740307084> ',
    nowplaying: '<a:music:1550746404459126894>',
    artist: '<:artists:1550746399463710750>',
    duration: '<:duration:1550746694734454855>',
    progress: '<a:loading:1550747459137830955>',
    loopQueue: '<:queueicon:1550748066695618581>',
    loopOff: '<:loopoff:1550749152776953950>',
    enabled: '<a:enable:1550533286294462587>',
    disabled: '<a:disabled1:1550533140282482739>',
    requester: '<:requester_avon:1550748053890277376>',
    delete: '<:delete:1520822758140022834>',
    edit: '<:edit:1520824814439501914>',
    prevPage: '<:backward:1437492770830028810>',
    nextPage: '<:next:1437438990721482752>',
    nightcore: '<:moon:1521020038554062928>',
    vaporwave: '<:wave:1521020091893026896>',
    tremolo: '<:tremolo:1521024839559938049>',
    bassboost: '<:bassboost:1521024935533871104>',
    eightD: '<:eightd:1521024994661109770>',
    karaoke: '<:karaoke:1521046074528104560>',
    vibrato: '<:vibrate:1521028129592971291>',
    slowed: '<:slowed:1521035064639623268>',
    distortion: '<:distortion:1521035154666164375>',
    pop: '<:pop:1521035422820733059> ',
    soft: '<:soft:1521035487668736060>',
    playlistIcon: '<:playlisticon:1521035561555726376>',
    queueIcon: '<:queueicon:1521035619986575370>',
    dots: '<:dots:1521035705436864512>',
};

module.exports = { BTN, TXT, PH, NP_HINT, p, ...LEO_MUSIC_EMOJIS };
