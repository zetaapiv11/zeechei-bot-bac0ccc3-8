const {
  MessageFlags
} = require("discord.js");

const VoiceMasterInteractions = require("../utils/VoiceMasterInteractions");

module.exports = {
  name: "interactionCreate",

  async execute(client, interaction) {
    try {
      // VoiceMaster buttons + modals
      if (
        (interaction.isButton() || interaction.isModalSubmit()) &&
        typeof interaction.customId === "string" &&
        (interaction.customId.startsWith("vm:") || interaction.customId.startsWith("vm_modal:"))
      ) {
        return VoiceMasterInteractions.handle(client, interaction);
      }

      /*
       * ============================================================
       * COMPONENT INTERACTIONS
       * ============================================================
       *
       * Help system ke interactions:
       * zeechei_help:...
       *
       * Inko yahan handle MAT karo.
       * events/helpInteractions.js inhe handle karega.
       */
      if (interaction.isMessageComponent()) {
        if (
          typeof interaction.customId === "string" &&
          interaction.customId.startsWith("zeechei_help:")
        ) {
          return;
        }
      }

      /*
       * ============================================================
       * AUTOCOMPLETE
       * ============================================================
       */
      if (interaction.isAutocomplete()) {
        const commandName = interaction.commandName;

        const command = client.commands?.get(commandName);

        if (!command) {
          try {
            return await interaction.respond([]);
          } catch {
            return;
          }
        }

        if (typeof command.autocomplete !== "function") {
          try {
            return await interaction.respond([]);
          } catch {
            return;
          }
        }

        try {
          if (command.__zeecheiPoruMusic) {
            return await command.autocomplete(interaction);
          }
          return await command.autocomplete({
            client,
            interaction
          });
        } catch (error) {
          console.error(
            `[Autocomplete] ${commandName}`,
            error
          );

          try {
            if (!interaction.responded) {
              await interaction.respond([]);
            }
          } catch {}

          return;
        }
      }

      /*
       * ============================================================
       * SLASH COMMANDS
       * ============================================================
       */
      if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName;

        const command = client.commands?.get(commandName);

        if (!command) {
          console.warn(
            `[Interaction] Slash command not found: /${commandName}`
          );

          if (!interaction.replied && !interaction.deferred) {
            try {
              await interaction.reply({
                content: "This command is no longer available.",
                flags: MessageFlags.Ephemeral
              });
            } catch {}
          }

          return;
        }

        /*
         * ----------------------------------------------------------
         * HELP COMMAND
         * ----------------------------------------------------------
         *
         * Help V2 message ko directly reply karega.
         * Isliye yahan deferReply nahi karna.
         */
        const isHelpCommand =
          commandName === "help" ||
          command.name === "help";

        if (!isHelpCommand && !command.noDefer) {
          try {
            await interaction.deferReply();
          } catch (error) {
            console.error(
              `[Interaction] Failed to defer /${commandName}`,
              error
            );

            return;
          }
        }

        /*
         * ----------------------------------------------------------
         * SLASH OPTIONS -> ARGS
         * ----------------------------------------------------------
         */
        let args = [];

        try {
          if (typeof command.getSlashArgs === "function") {
            args = await command.getSlashArgs(interaction);
          } else {
            args = buildSlashArgs(interaction);
          }
        } catch (error) {
          console.error(
            `[Interaction] Failed to build args for /${commandName}`,
            error
          );

          args = buildSlashArgs(interaction);
        }

        /*
         * ----------------------------------------------------------
         * EXECUTE
         * ----------------------------------------------------------
         */
        try {
          if (command.__zeecheiPoruMusic && !client.poru && !client.lavalink) {
            await interaction.reply({
              content: "Fitur musik belum aktif (Lavalink belum dikonfigurasi).",
              ephemeral: true,
            }).catch(() => {});
            return;
          }

          if (command.__zeecheiPoruMusic) {
            // LEO/Zeechei music commands expect the real Interaction object.
            // They handle their own defer/reply lifecycle.
            await command.execute(interaction);
          } else {
            const message = createInteractionMessage(
              client,
              interaction,
              args
            );

            await command.execute({
              client,
              message,
              args,
              interaction
            });
          }
        } catch (error) {
          console.error(
            `[Interaction] /${commandName}`,
            error
          );

          await handleInteractionError(
            interaction,
            error
          );
        }

        return;
      }

      /*
       * ============================================================
       * BUTTONS / SELECT MENUS / OTHER COMPONENTS
       * ============================================================
       *
       * Help ke alawa baaki component interactions yahan aa sakte hain.
       * Agar kisi command/event ne custom interaction handler banaya
       * hua hai to usko apne event file se handle karne diya jayega.
       */
      if (interaction.isButton()) {
        return;
      }

      if (interaction.isStringSelectMenu()) {
        return;
      }

      if (interaction.isUserSelectMenu()) {
        return;
      }

      if (interaction.isRoleSelectMenu()) {
        return;
      }

      if (interaction.isChannelSelectMenu()) {
        return;
      }

      if (interaction.isMentionableSelectMenu()) {
        return;
      }
    } catch (error) {
      console.error(
        "[InteractionCreate] Unhandled error:",
        error
      );

      await handleInteractionError(
        interaction,
        error
      );
    }
  }
};


/* =================================================================
 * SLASH ARG BUILDER
 * ================================================================= */

function buildSlashArgs(interaction) {
  const args = [];

  if (!interaction.options) {
    return args;
  }

  for (const option of interaction.options.data ?? []) {
    if (!option) continue;

    /*
     * Nested subcommand/group handling
     */
    if (
      option.type === 1 ||
      option.type === 2
    ) {
      continue;
    }

    if (
      option.value !== undefined &&
      option.value !== null
    ) {
      args.push(String(option.value));
    }
  }

  return args;
}


/* =================================================================
 * INTERACTION MESSAGE ADAPTER
 * ================================================================= */

function createInteractionMessage(
  client,
  interaction,
  args
) {
  const author = interaction.user;

  const message = {
    id: interaction.id,

    interaction,

    client,

    author,

    user: author,

    member: interaction.member,

    guild: interaction.guild,

    guildId: interaction.guildId,

    channel: interaction.channel,

    channelId: interaction.channelId,

    args,

    content:
      interaction.commandName
        ? `/${interaction.commandName}${args.length ? ` ${args.join(" ")}` : ""}`
        : "",

    createdTimestamp: Date.now(),

    /*
     * --------------------------------------------------------------
     * reply()
     * --------------------------------------------------------------
     */
    reply: async (payload) => {
      if (
        interaction.replied ||
        interaction.deferred
      ) {
        return interaction.editReply(payload);
      }

      return interaction.reply(payload);
    },

    /*
     * --------------------------------------------------------------
     * editReply()
     * --------------------------------------------------------------
     */
    editReply: async (payload) => {
      return interaction.editReply(payload);
    },

    /*
     * --------------------------------------------------------------
     * followUp()
     * --------------------------------------------------------------
     */
    followUp: async (payload) => {
      return interaction.followUp(payload);
    },

    /*
     * --------------------------------------------------------------
     * react()
     * --------------------------------------------------------------
     */
    react: async (...args) => {
      if (
        interaction.message &&
        typeof interaction.message.react === "function"
      ) {
        return interaction.message.react(...args);
      }

      return null;
    },

    /*
     * --------------------------------------------------------------
     * delete()
     * --------------------------------------------------------------
     */
    delete: async () => {
      if (
        interaction.message &&
        typeof interaction.message.delete === "function"
      ) {
        return interaction.message.delete();
      }

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        return interaction.deleteReply();
      }

      return null;
    }
  };

  return message;
}


/* =================================================================
 * ERROR HANDLER
 * ================================================================= */

async function handleInteractionError(
  interaction,
  error
) {
  const errorMessage =
    "An error occurred while executing this command.";

  console.error(error);

  try {
    /*
     * Already acknowledged
     */
    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction.editReply({
        content: errorMessage
      });

      return;
    }

    /*
     * Not acknowledged yet
     */
    await interaction.reply({
      content: errorMessage,
      flags: MessageFlags.Ephemeral
    });
  } catch (replyError) {
    console.error(
      "[InteractionCreate] Failed to send error response:",
      replyError
    );
  }
}