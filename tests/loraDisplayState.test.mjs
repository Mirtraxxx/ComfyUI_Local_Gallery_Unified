import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const {
    LORA_DISPLAY_LIMITS,
    clampInteger,
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

test("integer helpers round, clamp, and use their fallback for non-numeric input", () => {
    assert.equal(clampInteger("12.6", 1, 25, 8), 13);
    assert.equal(clampInteger("invalid", 1, 25, 8), 8);
    assert.equal(normalizeVisiblePinnedFolderCount(0), 1);
    assert.equal(normalizeVisiblePinnedFolderCount(99), 25);
});
