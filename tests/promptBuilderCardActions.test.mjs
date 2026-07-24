import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);

test("Prompt Builder and gallery thumbnail cards use larger action buttons", async () => {
    const styles = await readFile(stylesUrl, "utf8");

    assert.match(
        styles,
        /\.localprompt-chip-thumb \.localprompt-info-btn,[\s\S]*?\.localprompt-gallery-item \.favorite-btn \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/,
    );
    assert.match(
        styles,
        /\.localprompt-chip-thumb \.localprompt-info-btn svg,[\s\S]*?\.localprompt-gallery-item \.favorite-btn svg \{[\s\S]*?width: 24px;[\s\S]*?height: 24px;/,
    );
    // Text-mode chips and active-stack overrides keep compact control sizes.
    assert.match(
        styles,
        /\.localprompt-chip \.localprompt-info-btn,[\s\S]*?\.localprompt-chip \.chip-pin-btn \{[\s\S]*?width: 18px;[\s\S]*?height: 18px;/,
    );
    assert.match(
        styles,
        /\.localprompt-active-sidebar \.localprompt-chip-thumb\.pinned-managed \.localprompt-info-btn \{[\s\S]*?width: 20px;[\s\S]*?height: 20px;/,
    );
});
