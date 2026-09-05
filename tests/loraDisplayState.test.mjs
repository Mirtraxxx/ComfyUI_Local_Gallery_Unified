import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const {
    LORA_DISPLAY_LIMITS,
    LORA_BAR_SIZE_PRESETS,
    clampInteger,
    getLoraActiveCardControlScale,
    normalizeBarsSizeScale,
    normalizeLoraDisplayState,
    normalizeVisiblePinnedFolderCount,
} = await importModuleSource(new URL("../js/lora/displayState.js", import.meta.url));

test("normalizeLoraDisplayState applies compatibility defaults", () => {
    assert.deepEqual(normalizeLoraDisplayState(), {
        active_display_mode: "thumbnails",
        cards_display_mode: "thumbnails",
        card_contrast_mode: "off",
        sort_mode: "az",
        active_thumbnail_size_px: 96,
        thumbnail_size_px: 168,
        active_sidebar_width: 450,
        bars_size_scale: 100,
        move_active_loras_to_top: true,
        active_card_size_mode: "default",
        show_clip_weights: true,
    });
});

test("normalizeLoraDisplayState preserves valid values and clamps numeric ranges", () => {
    assert.deepEqual(normalizeLoraDisplayState({
        active_display_mode: "compact",
        cards_display_mode: "compact",
        card_contrast_mode: "dim_inactive",
        sort_mode: "newest",
        active_thumbnail_size_px: 999,
        thumbnail_size_px: 100,
        active_sidebar_width: 512.4,
        bars_size_scale: 130,
        active_card_size_mode: "large",
        show_clip_weights: false,
    }), {
        active_display_mode: "compact",
        cards_display_mode: "compact",
        card_contrast_mode: "dim_inactive",
        sort_mode: "newest",
        active_thumbnail_size_px: LORA_DISPLAY_LIMITS.activeThumbnailMax,
        thumbnail_size_px: LORA_DISPLAY_LIMITS.cardThumbnailMin,
        active_sidebar_width: 512,
        bars_size_scale: 125,
        move_active_loras_to_top: true,
        active_card_size_mode: "large",
        show_clip_weights: false,
    });
});

test("invalid display choices fall back without leaking legacy view_mode", () => {
    const state = normalizeLoraDisplayState({
        active_display_mode: "list",
        cards_display_mode: "grid",
        card_contrast_mode: "maximum",
        sort_mode: "random",
        view_mode: "compact",
    });

    assert.equal(state.active_display_mode, "thumbnails");
    assert.equal(state.cards_display_mode, "thumbnails");
    assert.equal(state.card_contrast_mode, "off");
    assert.equal(state.sort_mode, "az");
    assert.equal("view_mode" in state, false);
});

test("move active LoRAs preference defaults on and preserves an explicit opt-out", () => {
    assert.equal(normalizeLoraDisplayState().move_active_loras_to_top, true);
    assert.equal(normalizeLoraDisplayState({ move_active_loras_to_top: false }).move_active_loras_to_top, false);
});

test("integer helpers round, clamp, and use their fallback for non-numeric input", () => {
    assert.equal(clampInteger("12.6", 1, 25, 8), 13);
    assert.equal(clampInteger("invalid", 1, 25, 8), 8);
    assert.equal(normalizeVisiblePinnedFolderCount(0), 1);
    assert.equal(normalizeVisiblePinnedFolderCount(99), 25);
});

test("bars_size_scale snaps to the nearest discrete preset instead of free scaling", () => {
    assert.deepEqual(LORA_BAR_SIZE_PRESETS, [75, 100, 125, 150]);
    assert.equal(normalizeBarsSizeScale(60), 75);
    assert.equal(normalizeBarsSizeScale(85), 75);
    assert.equal(normalizeBarsSizeScale(90), 100);
    assert.equal(normalizeBarsSizeScale(130), 125);
    assert.equal(normalizeBarsSizeScale(160), 150);
    assert.equal(normalizeBarsSizeScale(150), 150);
    assert.equal(normalizeBarsSizeScale("bogus"), 100);
    assert.equal(normalizeLoraDisplayState({ bars_size_scale: 137 }).bars_size_scale, 125);
});

test("active card control scale follows thumbnail size without shrinking below usable controls", () => {
    assert.equal(getLoraActiveCardControlScale(LORA_DISPLAY_LIMITS.activeThumbnailMin), 1);
    assert.equal(getLoraActiveCardControlScale(96), 1);
    assert.equal(getLoraActiveCardControlScale(LORA_DISPLAY_LIMITS.activeThumbnailMax), 1.5);
    assert.equal(getLoraActiveCardControlScale(999), 1.5);
});
