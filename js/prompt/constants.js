export const PER_PAGE = 10;

export const THUMBNAIL_SIZE_MIN = 40;
export const THUMBNAIL_SIZE_MAX = 320;
export const THUMBNAIL_SIZE_DEFAULT = 96;
export const THUMBNAIL_SIZE_LEGACY_PRESETS = {
    small: 81,
    medium: 96,
    large: 115,
};

// Card Manager is a separate workspace from Prompt Builder. Its card density
// deliberately has its own preference and limits.
export const CARD_MANAGER_CARD_SIZE_MIN = 100;
export const CARD_MANAGER_CARD_SIZE_MAX = 320;
export const CARD_MANAGER_CARD_SIZE_DEFAULT = 150;
export const CARD_MANAGER_FULLSCREEN_CARD_SIZE_DEFAULT = 210;

// How many categories a fresh node pins before the user picks their own.
export const INITIAL_PINNED_CATEGORY_COUNT = 5;

// The Active Stack sidebar is an overlay, so its width is mode-dependent:
// compact/text cards use a narrow shelf and large thumbnail cards need a wide
// one. These six numbers are the single source of truth shared by the drag
// handlers, the preference defaults, and the CSS clamp() in styles.js.
export const ACTIVE_SIDEBAR_WIDTH_NORMAL_MIN = 380;
export const ACTIVE_SIDEBAR_WIDTH_NORMAL_MAX = 480;
export const ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT = 420;
export const ACTIVE_SIDEBAR_WIDTH_LARGE_MIN = 640;
export const ACTIVE_SIDEBAR_WIDTH_LARGE_MAX = 740;
export const ACTIVE_SIDEBAR_WIDTH_LARGE_DEFAULT = 660;
