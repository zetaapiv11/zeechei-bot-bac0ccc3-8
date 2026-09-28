const {
  MessageFlags
} = require("discord.js");

const HelpBuilder =
  require("../utils/HelpBuilder");

module.exports = {
  name: "interactionCreate",

  async execute(client, interaction) {
    if (!interaction.isMessageComponent()) {
      return;
    }

    const customId =
      interaction.customId || "";

    if (
      !customId.startsWith(
        "zeechei_help:"
      )
    ) {
      return;
    }

    try {
      /*
       * ==========================================================
       * OWNER CHECK
       * ==========================================================
       */

      const parts =
        customId.split(":");

      const ownerId =
        parts[2];

      if (
        ownerId &&
        ownerId !== interaction.user.id
      ) {
        if (
          !interaction.replied &&
          !interaction.deferred
        ) {
          await interaction.reply({
            content:
              "This Help panel belongs to another user.",
            flags:
              MessageFlags.Ephemeral
          });
        }

        return;
      }

      /*
       * ==========================================================
       * ACKNOWLEDGE IMMEDIATELY
       * ==========================================================
       *
       * Ye sabse important fix hai.
       * Discord interaction ko 3 seconds ke andar acknowledge
       * karna padta hai.
       */

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.deferUpdate();
      }

      /*
       * ==========================================================
       * BUILD NEW HELP PAGE
       * ==========================================================
       */

      const payload =
        HelpBuilder.handleInteraction(
          client,
          interaction
        );

      if (!payload) {
        return;
      }

      /*
       * ==========================================================
       * EDIT ORIGINAL HELP MESSAGE
       * ==========================================================
       */

      await interaction.message.edit({
        components:
          payload.components,

        files:
          payload.files || [],

        flags:
          MessageFlags.IsComponentsV2
      });
    } catch (error) {
      console.error(
        "[Zeechei Help] Interaction error:",
        error
      );
    }
  }
};