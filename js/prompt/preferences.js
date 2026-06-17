import {
    THUMBNAIL_SIZE_DEFAULT,
    THUMBNAIL_SIZE_LEGACY_PRESETS,
    THUMBNAIL_SIZE_MAX,
    THUMBNAIL_SIZE_MIN,
} from "./constants.js";
import {
    getActiveThumbnailSizePx as resolveActiveThumbnailSizePx,
    getThumbnailSizePx as resolveThumbnailSizePx,
} from "./helpers.js?v=unified-icons-20260606";

export const DEFAULT_PROMPT_UI_PREFS = {
    display_mode: "thumbnails",
    cards_display_mode: "thumbnails",
    active_display_mode: "compact",
    most_used_count: 10,
    library_tab_layout: "scroll",
    thumbnail_size: "medium",
    thumbnail_size_px: THUMBNAIL_SIZE_DEFAULT,
    active_thumbnail_size_px: 110,
    library_tabs: ["most_used", "pinned"],
    pinned_categories: null,
    visible_pinned_category_count: 5,
    pinned_order: [],
    prompt_manual_orders: {},
    category_colors: {},
    active_sidebar_open: false,
    active_sidebar_width: 300,
    active_sidebar_hover_open: true,
    auto_hide_toolbars: false,
    show_most_used: true,
    promote_selected_prompts: true,
    prompt_sort_mode: "manual",
    prompt_sort_modes: {},
    meta_tags_button_side: "right",
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

    return merged;
}

export function mergeUiPrefs(existing = {}, loaded = {}) {
    return normalizeUiPrefs({
        ...(existing && typeof existing === "object" ? existing : {}),
        ...(loaded && typeof loaded === "object" ? loaded : {}),
    });
}
