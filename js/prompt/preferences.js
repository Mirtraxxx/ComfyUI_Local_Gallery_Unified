import {
    ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT,
    CARD_MANAGER_CARD_SIZE_DEFAULT,
    CARD_MANAGER_CARD_SIZE_MAX,
    CARD_MANAGER_CARD_SIZE_MIN,
    THUMBNAIL_SIZE_DEFAULT,
    THUMBNAIL_SIZE_LEGACY_PRESETS,
    THUMBNAIL_SIZE_MAX,
    THUMBNAIL_SIZE_MIN,
} from "./constants.js";
import {
    getActiveThumbnailSizePx as resolveActiveThumbnailSizePx,
    getThumbnailSizePx as resolveThumbnailSizePx,
} from "./helpers.js";

export const DEFAULT_PROMPT_UI_PREFS = {
    display_mode: "thumbnails",
    cards_display_mode: "thumbnails",
    active_display_mode: "compact",
    thumbnail_size: "medium",
    thumbnail_size_px: THUMBNAIL_SIZE_DEFAULT,
    active_thumbnail_size_px: 110,
    card_manager_card_size_px: CARD_MANAGER_CARD_SIZE_DEFAULT,
    library_tabs: ["pinned"],
    pinned_categories: null,
    pinned_order: [],
    prompt_manual_orders: {},
    category_colors: {},
    active_sidebar_open: false,
    active_sidebar_width: ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT,
    active_sidebar_hover_open: true,
    auto_hide_toolbars: false,
    promote_selected_prompts: true,
    prompt_sort_mode: "manual",
    prompt_sort_modes: {},
    card_contrast_mode: "off",
    active_card_size_mode: "default",
};

export function normalizeDisplayMode(mode, fallback = "compact") {
    const normalized = String(mode || "").toLowerCase();
    if (normalized === "thumbnails") return "thumbnails";
    if (normalized === "compact" || normalized === "text") return "compact";
    return fallback;
}

export function getCardsDisplayMode(uiPrefs = {}) {
    return normalizeDisplayMode(
        uiPrefs?.cards_display_mode ?? uiPrefs?.display_mode,
        DEFAULT_PROMPT_UI_PREFS.cards_display_mode
    );
}

export function getActiveDisplayMode(uiPrefs = {}) {
    return normalizeDisplayMode(
        uiPrefs?.active_display_mode,
        DEFAULT_PROMPT_UI_PREFS.active_display_mode
    );
}

export function getThumbnailSizePx(uiPrefs = {}) {
    return resolveThumbnailSizePx(uiPrefs, {
        legacyPresets: THUMBNAIL_SIZE_LEGACY_PRESETS,
        defaultSize: THUMBNAIL_SIZE_DEFAULT,
        minSize: THUMBNAIL_SIZE_MIN,
        maxSize: THUMBNAIL_SIZE_MAX,
    });
}

export function getActiveThumbnailSizePx(uiPrefs = {}) {
    return resolveActiveThumbnailSizePx(uiPrefs, getThumbnailSizePx(uiPrefs), {
        minSize: THUMBNAIL_SIZE_MIN,
        maxSize: THUMBNAIL_SIZE_MAX,
    });
}

export function getCardManagerCardSizePx(uiPrefs = {}) {
    const raw = Number(uiPrefs?.card_manager_card_size_px ?? CARD_MANAGER_CARD_SIZE_DEFAULT);
    if (!Number.isFinite(raw)) return CARD_MANAGER_CARD_SIZE_DEFAULT;
    return Math.max(CARD_MANAGER_CARD_SIZE_MIN, Math.min(CARD_MANAGER_CARD_SIZE_MAX, Math.round(raw)));
}

export function normalizeUiPrefs(uiPrefs = {}) {
    const source = uiPrefs && typeof uiPrefs === "object" ? uiPrefs : {};
    const hasCardsDisplayMode = Object.prototype.hasOwnProperty.call(source, "cards_display_mode");
    const hasActiveDisplayMode = Object.prototype.hasOwnProperty.call(source, "active_display_mode");
    const merged = {
        ...DEFAULT_PROMPT_UI_PREFS,
        ...source,
    };

    merged.cards_display_mode = normalizeDisplayMode(
        hasCardsDisplayMode ? source.cards_display_mode : source.display_mode,
        DEFAULT_PROMPT_UI_PREFS.cards_display_mode
    );
    merged.active_display_mode = normalizeDisplayMode(
        hasActiveDisplayMode ? source.active_display_mode : DEFAULT_PROMPT_UI_PREFS.active_display_mode,
        DEFAULT_PROMPT_UI_PREFS.active_display_mode
    );
    merged.display_mode = merged.cards_display_mode;
    merged.active_card_size_mode = source.active_card_size_mode === "large" ? "large" : "default";
    merged.thumbnail_size_px = getThumbnailSizePx(merged);
    merged.active_thumbnail_size_px = getActiveThumbnailSizePx(merged);
    merged.card_manager_card_size_px = getCardManagerCardSizePx(merged);

    return merged;
}

export function mergeUiPrefs(existing = {}, loaded = {}) {
    return normalizeUiPrefs({
        ...(existing && typeof existing === "object" ? existing : {}),
        ...(loaded && typeof loaded === "object" ? loaded : {}),
    });
}
