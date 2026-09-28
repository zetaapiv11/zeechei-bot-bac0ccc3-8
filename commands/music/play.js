const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags
} = require("discord.js");

const config = require("../../music/leoConfig");
const emojis = require("../../utils/emojis");

const box = text => new ContainerBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(text)
);

const errorBox = text => box(`${emojis.error} ${text}`);

async function resolveMusic(client, query, requester) {
    if (!client?.poru?.resolve) throw new Error("Music resolver is unavailable.");

    let last;
    for (let i = 0; i < 3; i++) {
        try {
            const result = await client.poru.resolve({
                query: String(query),
                source: /^https?:\/\//i.test(query)
                    ? undefined
                    : (config?.MUSIC?.DEFAULT_PLATFORM || "ytsearch"),
                requester
            });

            if (!result || typeof result !== "object") {
                throw new Error("Invalid music response.");
            }
            return result;
        } catch (err) {
            last = err;
            if (i < 2) await new Promise(r => setTimeout(r, 900 * (i + 1)));
        }
    }
    throw last || new Error("Music resolve failed.");
}

function playable(track) {
    return track?.info &&
        !track.info.isStream &&
        Number(track.info.length || 0) >= 45000;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song or add it to the queue")
        .addStringOption(option =>
            option.setName("search")
                .setDescription("Song title or URL")
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const query = interaction.options.getFocused();
        if (!query?.trim() || !interaction.client?.poru) {
            return interaction.respond([]);
        }

        try {
            if (/^https?:\/\//i.test(query)) {
                const name = query.length > 90 ? `${query.slice(0, 87)}...` : query;
                return interaction.respond([{ name: `Play: ${name}`, value: query }]);
            }

            const result = await interaction.client.poru.resolve({
                query,
                source: config?.MUSIC?.DEFAULT_PLATFORM || "ytsearch",
                requester: interaction.user
            });

            if (!result?.tracks?.length) return interaction.respond([]);

            return interaction.respond(
                result.tracks
                    .filter(t => t?.info)
                    .slice(0, config?.MUSIC?.AUTOCOMPLETE_LIMIT || 10)
                    .map(track => {
                        const title = String(track.info.title || "Unknown");
                        return {
                            name: title.length > 90 ? `${title.slice(0, 87)}...` : title,
                            value: track.info.uri || title
                        };
                    })
            );
        } catch {
            return interaction.respond([]);
        }
    },

    async execute(interaction) {
        const { client, member, guild, channel } = interaction;

        if (!member?.voice?.channel) {
            return interaction.reply({
                components: [errorBox("You need to be in a voice channel to play music!")],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const query = interaction.options.getString("search", true).trim();
        if (!query) {
            return interaction.reply({
                components: [errorBox("Please provide a song name or URL.")],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply();

        let result;
        try {
            result = await resolveMusic(client, query, interaction.user);
        } catch (err) {
            console.error("[PLAY] Resolve:", err);
            return interaction.editReply({
                components: [errorBox(
                    String(err?.message || "").includes("502")
                        ? "Music server is temporarily unavailable. Try again in a few seconds."
                        : /no nodes|not connected|unavailable|ECONN|ENOTFOUND|timeout/i.test(String(err?.message || ""))
                            ? "Music server (Lavalink) is not connected. Check the Lavalink settings or try another node."
                            : "Music search failed. Please try again."
                )],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (result.loadType === "empty" || !result.tracks?.length) {
            return interaction.editReply({
                components: [errorBox("No results found.")],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (result.loadType === "error") {
            return interaction.editReply({
                components: [errorBox(`Failed to load: ${result.exception?.message || "Unknown error"}`)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const isPlaylist =
            result.loadType === "playlist" ||
            result.loadType === "PLAYLIST_LOADED";

        const tracks = (isPlaylist ? result.tracks : [result.tracks[0]]).filter(playable);

        if (!tracks.length) {
            return interaction.editReply({
                components: [errorBox("No playable tracks found.")],
                flags: MessageFlags.IsComponentsV2
            });
        }

        let player = client.poru.players?.get(guild.id);

        try {
            if (!player) {
                player = client.poru.createConnection({
                    guildId: guild.id,
                    voiceChannel: member.voice.channel.id,
                    textChannel: channel.id,
                    deaf: true
                });
            } else if (typeof player.setTextChannel === "function") {
                player.setTextChannel(channel.id);
            }
        } catch (err) {
            console.error("[PLAY] Player:", err);
            return interaction.editReply({
                components: [errorBox("Could not connect to your voice channel.")],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (player.autoplayEnabled === undefined) player.autoplayEnabled = false;

        for (const track of tracks) {
            track.info.requester = interaction.user;
            player.queue.add(track);
        }

        const wasIdle = !player.isPlaying && !player.currentTrack;

        if (wasIdle && player.isConnected) {
            try {
                await player.play();
            } catch (err) {
                console.error("[PLAY] Playback:", err);
                return interaction.editReply({
                    components: [errorBox("Could not start playback.")],
                    flags: MessageFlags.IsComponentsV2
                });
            }
        }

        if (isPlaylist) {
            return interaction.editReply({
                components: [
                    box(
                        `## ${emojis.music} Playlist ${result.playlistInfo?.name || "Playlist"}\n` +
                        `Added **${tracks.length}** tracks to the queue!`
                    )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const track = tracks[0];
        const title = track.info.title || "Unknown Track";
        const uri = track.info.uri || "";
        const author = track.info.author || "Unknown Artist";
        const queueSize = player.queue?.size || 0;

        return interaction.editReply({
            components: [
                box([
                    wasIdle ? `## ${emojis.playing} Now Playing` : `## ${emojis.success} Added to Queue`,
                    `**[${title}](${uri})**`,
                    `-# ${author}${queueSize ? ` • **Up Next:** \`#${queueSize}\`` : ""}`
                ].join("\n"))
            ],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
