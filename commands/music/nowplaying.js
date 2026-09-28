const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

const { createProgressBar, formatDuration } = require("../../helpers/musicHelpers");
const emojis = require("../../utils/emojis");

const C2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;

function safeText(value, fallback = "Unknown") {
    const text = String(value ?? "").trim();
    return text || fallback;
}

function clean(value, max = 100) {
    const text = safeText(value);
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function errorContainer(text) {
    return new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${emojis.error} ${text}`)
        );
}

function getLoopLabel(player) {
    const loop = String(
        player?.loop ??
        player?.loopMode ??
        player?.repeatMode ??
        "OFF"
    ).toUpperCase();

    if (loop === "TRACK" || loop === "SINGLE") {
        return `${emojis.loopTrack} Track`;
    }

    if (loop === "QUEUE" || loop === "ALL") {
        return `${emojis.loopQueue} Queue`;
    }

    return `${emojis.loopOff} Off`;
}

function getAutoplay(player) {
    return Boolean(player?.autoplayEnabled);
}

function getRequester(track) {
    const requester = track?.info?.requester;

    if (!requester) return "Unknown";

    if (typeof requester === "string") {
        return requester;
    }

    return requester.username ||
        requester.displayName ||
        requester.tag ||
        "Unknown";
}

function getArtwork(track) {
    return (
        track?.info?.artworkUrl ||
        track?.info?.artworkURL ||
        track?.info?.image ||
        null
    );
}

function buildNowPlaying(player, track) {
    const title = clean(track.info.title, 100);
    const artist = clean(track.info.author, 90);
    const artwork = getArtwork(track);

    const isLive = Boolean(track.info.isStream);
    const duration = isLive
        ? "LIVE"
        : formatDuration(Number(track.info.length || 0));

    const position = isLive
        ? "LIVE"
        : formatDuration(Number(player.position || 0));

    const progress = isLive
        ? "`LIVE`"
        : createProgressBar(player);

    const queueSize = Number(player.queue?.size || 0);

    const container = new ContainerBuilder();

    if (artwork) {
        try {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems([
                    new MediaGalleryItemBuilder().setURL(artwork)
                ])
            );
        } catch {
            // Some Lavalink sources can return a malformed artwork URL.
            // The text panel below remains fully usable.
        }
    }

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${emojis.nowplaying} Now Playing\n**[${title}](${track.info.uri || "https://discord.com"})**`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${emojis.artist} **Artist:** ${artist}\n` +
            `${emojis.duration} **Duration:** \`${duration}\`\n` +
            `${emojis.progress} **Progress:** ${progress}\n` +
            `-# ${position} / ${duration}`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${emojis.loopQueue} **Loop:** ${getLoopLabel(player)}\n` +
            `${emojis.autoplay} **Autoplay:** ${getAutoplay(player) ? `${emojis.enabled} On` : `${emojis.disabled} Off`}\n` +
            `${emojis.volume} **Volume:** ${Number(player.volume ?? 100)}%\n` +
            `${emojis.queue} **Queue:** ${queueSize} track${queueSize === 1 ? "" : "s"}`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
            .setDivider(true)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# ${emojis.requester} Requested by **${clean(getRequester(track), 70)}**\n` +
            `-# loved bot`
        )
    );

    return container;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("Show the currently playing song"),

    async execute(interaction) {
        const { client, guild, member } = interaction;

        if (!guild) {
            return interaction.reply({
                components: [errorContainer("This command can only be used in a server.")],
                flags: C2 | EPHEMERAL,
            });
        }

        const player = client?.poru?.players?.get(guild.id);

        if (!player || !player.currentTrack) {
            return interaction.reply({
                components: [errorContainer("No music is currently playing!")],
                flags: C2 | EPHEMERAL,
            });
        }

        // If the user is in voice, keep the same-channel rule used by Zeechei's
        // existing music controls. If they are not in voice, NP can still be
        // viewed without exposing a control action.
        if (member?.voice?.channel && player.voiceChannel) {
            if (member.voice.channel.id !== player.voiceChannel) {
                return interaction.reply({
                    components: [
                        errorContainer("You must be in the same voice channel as the bot to view this player.")
                    ],
                    flags: C2 | EPHEMERAL,
                });
            }
        }

        try {
            const panel = buildNowPlaying(player, player.currentTrack);

            return interaction.reply({
                components: [panel],
                flags: C2,
            });
        } catch (error) {
            console.error("[Zeechei NowPlaying] Panel error:", error);

            return interaction.reply({
                components: [
                    errorContainer(
                        `Could not build the Now Playing panel: ${clean(error?.message || "Unknown error", 180)}`
                    )
                ],
                flags: C2 | EPHEMERAL,
            });
        }
    },
};
