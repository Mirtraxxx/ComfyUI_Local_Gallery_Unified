const DISPLAY_MODES = new Set(["thumbnails", "compact"]);
const CONTRAST_MODES = new Set(["off", "dim_inactive"]);
const SORT_MODES = new Set(["az", "za", "newest", "oldest"]);

export const LORA_DISPLAY_LIMITS = Object.freeze({
    activeThumbnailMin: 72,
    activeThumbnailMax: 156,
    cardThumbnailMin: 112,
    cardThumbnailMax: 260,
    sidebarMin: 300,
    sidebarMax: 720,
});

function normalizeChoice(value, allowed, fallback) {
    const normalized = String(value || "");
    return allowed.has(normalized) ? normalized : fallback;
}

export function clampInteger(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
}

export function normalizeLoraDisplayMode(value) {
    return normalizeChoice(value, DISPLAY_MODES, "thumbnails");
}

export function normalizeLoraContrastMode(value) {
    // "dim_by_default" was a third mode before the setting became a checkbox.
    return value === "dim_by_default" ? "dim_inactive" : normalizeChoice(value, CONTRAST_MODES, "off");
}

export function normalizeLoraSortMode(value) {
    return normalizeChoice(value, SORT_MODES, "az");
}

export function getLoraActiveCardControlScale(value) {
    const thumbnailSize = clampInteger(
        value,
        LORA_DISPLAY_LIMITS.activeThumbnailMin,
        LORA_DISPLAY_LIMITS.activeThumbnailMax,
        96,
    );
    return Math.min(1.5, Math.max(1, thumbnailSize / 96));
}

export function normalizeLoraDisplayState(uiState = {}) {
    return {
        active_display_mode: normalizeLoraDisplayMode(uiState.active_display_mode),
        cards_display_mode: normalizeLoraDisplayMode(uiState.cards_display_mode),
        card_contrast_mode: normalizeLoraContrastMode(uiState.card_contrast_mode),
        sort_mode: normalizeLoraSortMode(uiState.sort_mode),
        active_thumbnail_size_px: clampInteger(
            uiState.active_thumbnail_size_px,
            LORA_DISPLAY_LIMITS.activeThumbnailMin,
            LORA_DISPLAY_LIMITS.activeThumbnailMax,
            96,
        ),
        thumbnail_size_px: clampInteger(
            uiState.thumbnail_size_px,
            LORA_DISPLAY_LIMITS.cardThumbnailMin,
            LORA_DISPLAY_LIMITS.cardThumbnailMax,
            168,
        ),
        active_sidebar_width: clampInteger(
            uiState.active_sidebar_width,
            LORA_DISPLAY_LIMITS.sidebarMin,
            LORA_DISPLAY_LIMITS.sidebarMax,
            450,
        ),
        move_active_loras_to_top: uiState.move_active_loras_to_top !== false,
        active_card_size_mode: uiState.active_card_size_mode === "large" ? "large" : "default",
        show_clip_weights: uiState.show_clip_weights !== false,
        auto_hide_toolbars: uiState.auto_hide_toolbars === true,
    };
}
