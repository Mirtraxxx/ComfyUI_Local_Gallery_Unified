const DISPLAY_MODES = new Set(["thumbnails", "compact"]);
const CONTRAST_MODES = new Set(["off", "dim_inactive", "dim_by_default"]);
const SORT_MODES = new Set(["az", "za", "newest", "oldest"]);

export const LORA_DISPLAY_LIMITS = Object.freeze({
    activeThumbnailMin: 72,
    activeThumbnailMax: 156,
    cardThumbnailMin: 112,
    cardThumbnailMax: 260,
    sidebarMin: 300,
    sidebarMax: 720,
    // Kept identical to the Prompt gallery's visible_pinned_category_count
    // window (see js/prompt/constants.js): same knob, same reach.
    visibleFolderMin: 1,
    visibleFolderMax: 20,
});

// Discrete top/bottom bar size steps. `bars_size_scale` stores the nominal
// step value; the matching CSS class carries the per-step geometry.
export const LORA_BAR_SIZE_PRESETS = Object.freeze([75, 100, 125, 150]);
export const LORA_BAR_SIZE_DEFAULT = 100;
export const LORA_BAR_SIZE_CLASSES = Object.freeze({
    75: "bars-compact",
    100: "",
    125: "bars-large",
    150: "bars-xl",
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
    return normalizeChoice(value, CONTRAST_MODES, "off");
}

export function normalizeLoraSortMode(value) {
    return normalizeChoice(value, SORT_MODES, "az");
}

export function normalizeVisiblePinnedFolderCount(value) {
    return clampInteger(
        value,
        LORA_DISPLAY_LIMITS.visibleFolderMin,
        LORA_DISPLAY_LIMITS.visibleFolderMax,
        8,
    );
}

export function normalizeBarsSizeScale(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return LORA_BAR_SIZE_DEFAULT;
    let nearest = LORA_BAR_SIZE_DEFAULT;
    for (const preset of LORA_BAR_SIZE_PRESETS) {
        if (Math.abs(preset - number) < Math.abs(nearest - number)) nearest = preset;
    }
    return nearest;
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
        bars_size_scale: normalizeBarsSizeScale(uiState.bars_size_scale),
        move_active_loras_to_top: uiState.move_active_loras_to_top !== false,
        active_card_size_mode: uiState.active_card_size_mode === "large" ? "large" : "default",
        show_clip_weights: uiState.show_clip_weights !== false,
    };
}
