import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const stylesUrl = new URL("../js/lora/styles.js", import.meta.url);
const uiUrl = new URL("../js/lora/ui.js", import.meta.url);
const entryUrl = new URL("../js/Local_Gallery_Unified.js", import.meta.url);
const { getResponsiveLoraBrowserCardLayout } = await importModuleSource(
    new URL("../js/lora/browserCardLayout.js", import.meta.url),
);

test("LoRA Browser uses Prompt Builder-style fractional tracks with an explicit row height", async () => {
    const [styles, ui, entry] = await Promise.all([
        readFile(stylesUrl, "utf8"),
        readFile(uiUrl, "utf8"),
        readFile(entryUrl, "utf8"),
    ]);

    assert.match(
        styles,
        /grid-template-columns: repeat\(auto-fill, minmax\(min\(var\(--lora-card-min-width\), 100%\), 1fr\)\);/,
    );
    assert.match(
        styles,
        /\.locallora-container\.cards-mode-thumbnails \.locallora-lora-card \{[\s\S]*?width: 100%;[\s\S]*?height: var\(--lora-card-responsive-height, var\(--lora-card-thumb-size\)\);/,
    );
    assert.doesNotMatch(
        styles,
        /\.locallora-container\.cards-mode-thumbnails \.locallora-lora-card \{[^}]*height: auto;/,
    );
    assert.match(
        styles,
        /\.locallora-container\.cards-mode-thumbnails \.locallora-media-container \{[\s\S]*?position: absolute;[\s\S]*?top: -1px;[\s\S]*?bottom: -1px;/,
    );
    assert.match(ui, /activeThumbnailSlider\.value = state\.active_thumbnail_size_px/);
    assert.match(ui, /cardThumbnailSlider\.value = state\.thumbnail_size_px/);
    assert.match(ui, /new ResizeObserver\(scheduleBrowserCardLayout\)/);
    assert.match(ui, /--lora-card-responsive-height/);
    assert.match(ui, /from "\.\/styles\.js"/);
    assert.match(entry, /\.\/lora\/ui\.js\?v=lora-stepped-browser-cards-20260724-4/);
});

test("LoRA Browser card size changes only when its auto-fill column count changes", () => {
    const rangeStart = getResponsiveLoraBrowserCardLayout({
        availableWidth: 800,
        minimumCardWidth: 130,
    });
    const sameRange = getResponsiveLoraBrowserCardLayout({
        availableWidth: 800,
        minimumCardWidth: 140,
    });
    const nextRange = getResponsiveLoraBrowserCardLayout({
        availableWidth: 800,
        minimumCardWidth: 150,
    });

    assert.equal(rangeStart.columns, 5);
    assert.deepEqual(sameRange, rangeStart);
    assert.equal(nextRange.columns, 4);
    assert.ok(nextRange.cardWidth > rangeStart.cardWidth);
    assert.ok(nextRange.cardHeight > rangeStart.cardHeight);
});

test("LoRA Browser card layout follows the real gallery width and remains portrait-shaped", () => {
    const layout = getResponsiveLoraBrowserCardLayout({
        availableWidth: 900,
        minimumCardWidth: 130,
    });

    assert.equal(layout.columns, 6);
    assert.ok(Math.abs(layout.cardHeight / layout.cardWidth - 50 / 39) < 0.0001);
    assert.equal(getResponsiveLoraBrowserCardLayout({ availableWidth: 0, minimumCardWidth: 130 }), null);
});
