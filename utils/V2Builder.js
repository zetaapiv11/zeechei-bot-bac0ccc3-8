const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} = require("discord.js");

const V2_FLAGS = MessageFlags.IsComponentsV2;
const V2_EPH = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

class V2Builder {
  constructor(color) {
    this.color = color || "#ff0000";
    this._container = new ContainerBuilder();
  }

  text(content) {
    this._container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(String(content ?? ""))
    );

    return this;
  }

  section(content, thumbnailUrl) {
    const section = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(String(content ?? ""))
    );

    if (thumbnailUrl) {
      try {
        section.setThumbnailAccessory(
          new ThumbnailBuilder().setURL(String(thumbnailUrl))
        );
      } catch (_) {}
    }

    this._container.addSectionComponents(section);

    return this;
  }

  media(url) {
    if (!url) return this;

    try {
      const gallery = new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(String(url))
      );

      this._container.addMediaGalleryComponents(gallery);
    } catch (_) {}

    return this;
  }

  sep(
    divider = true,
    spacing = SeparatorSpacingSize.Small
  ) {
    this._container.addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(Boolean(divider))
        .setSpacing(spacing)
    );

    return this;
  }

  row(...rows) {
    for (const row of rows.flat()) {
      if (row) {
        this._container.addActionRowComponents(row);
      }
    }

    return this;
  }

  build(files) {
    this._container
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Developed by zeechei Devs✓"
        )
      );

    const output = {
      components: [this._container],
      flags: V2_FLAGS,
    };

    if (files?.length) {
      output.files = files;
    }

    return output;
  }

  buildEphemeral(files) {
    this._container
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Developed by zeechei Devs✓"
        )
      );

    const output = {
      components: [this._container],
      flags: V2_EPH,
    };

    if (files?.length) {
      output.files = files;
    }

    return output;
  }

  get container() {
    return this._container;
  }
}

function v2msg(color, content) {
  return new V2Builder(color)
    .text(content)
    .build();
}

function v2eph(color, content) {
  return new V2Builder(color)
    .text(content)
    .buildEphemeral();
}

function v2section(color, content, thumbnailUrl) {
  return new V2Builder(color)
    .section(content, thumbnailUrl)
    .build();
}

/*
 * IMPORTANT:
 * Export class directly AND also expose named properties.
 * This makes BOTH of these work:
 *
 * const V2Builder = require("../../utils/V2Builder");
 *
 * const { V2Builder } = require("../../utils/V2Builder");
 */

module.exports = V2Builder;

module.exports.V2Builder = V2Builder;
module.exports.v2msg = v2msg;
module.exports.v2eph = v2eph;
module.exports.v2section = v2section;
module.exports.V2_FLAGS = V2_FLAGS;
module.exports.V2_EPH = V2_EPH;