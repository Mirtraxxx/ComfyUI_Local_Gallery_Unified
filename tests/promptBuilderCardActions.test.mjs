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
    // Text-mode chips stay compact while Active Stack thumbnails match Builder actions.
    assert.match(
        styles,
        /\.localprompt-chip \.localprompt-info-btn,[\s\S]*?\.localprompt-chip \.chip-pin-btn \{[\s\S]*?width: 18px;[\s\S]*?height: 18px;/,
    );
    assert.match(
        styles,
        /\.localprompt-active-sidebar \.localprompt-chip-thumb\.pinned-managed \.localprompt-info-btn \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/,
    );
    assert.match(
        styles,
        /\.localprompt-active-sidebar \.localprompt-chip-thumb\.pinned-managed \.localprompt-info-btn svg \{[\s\S]*?width: 24px;[\s\S]*?height: 24px;/,
    );
    assert.match(
        styles,
        /\.localprompt-active-sidebar \.localprompt-chip-thumb\.pinned-managed \.localprompt-workflow-edit-button \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/,
    );
    assert.match(
        styles,
        /\.localprompt-active-sidebar \.localprompt-chip-thumb\.pinned-managed \.localprompt-workflow-edit-button svg \{[\s\S]*?width: 24px;[\s\S]*?height: 24px;/,
    );
    assert.match(
        styles,
        /\.localprompt-active-sidebar \.localprompt-chip-thumb\.pinned-managed \.localprompt-info-btn \{[\s\S]*?background: rgba\(20, 20, 20, 0\.75\);[\s\S]*?color: #e0e0e0;[\s\S]*?border: 1px solid rgba\(255, 255, 255, 0\.2\);/,
    );
    assert.match(
        styles,
        /\.localprompt-active-sidebar \.localprompt-chip-thumb\.pinned-managed \.localprompt-workflow-edit-button \{[\s\S]*?background: rgba\(20, 20, 20, 0\.75\);[\s\S]*?color: #e0e0e0;[\s\S]*?border: 1px solid rgba\(255, 255, 255, 0\.2\);/,
    );
    assert.match(
        styles,
        /\.localprompt-active-sidebar \.localprompt-chip-thumb\.pinned-managed \.localprompt-workflow-edit-button:hover \{[\s\S]*?background: rgba\(40, 40, 40, 0\.9\);[\s\S]*?color: #fff;[\s\S]*?border-color: rgba\(255, 255, 255, 0\.4\);/,
    );
});
