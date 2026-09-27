import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const uiUrl = new URL("../js/lora/ui.js", import.meta.url);
const { getResponsiveLoraBrowserCardLayout } = await importModuleSource(
    new URL("../js/lora/browserCardLayout.js", import.meta.url),
);

test("LoRA Browser uses Prompt Builder-style fractional tracks with an explicit row height", async () => {
    const ui = await readFile(uiUrl, "utf8");

    assert.match(ui, /activeThumbnailSlider\.value = state\.active_thumbnail_size_px/);
    assert.match(ui, /cardThumbnailSlider\.value = state\.thumbnail_size_px/);
    assert.match(ui, /new ResizeObserver\(scheduleBrowserCardLayout\)/);
    assert.match(ui, /--lora-card-responsive-height/);
    assert.match(ui, /from "\.\/styles\.js"/);
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
