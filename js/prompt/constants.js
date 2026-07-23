export const PER_PAGE = 10;

export const FAVORITE_COLORS = [
    { name: "Red", value: "#ff6b6b" },
    { name: "Orange", value: "#ffa94d" },
    { name: "Yellow", value: "#ffd43b" },
    { name: "Green", value: "#69db7c" },
    { name: "Blue", value: "#74c0fc" },
    { name: "Purple", value: "#b197fc" },
    { name: "Pink", value: "#f783ac" },
    { name: "None", value: null },
];

export const CATEGORY_ROLE_PALETTE = [
    "#e03131", "#f76707", "#f08c00", "#e9c46a", "#74b816",
    "#2f9e44", "#12b886", "#0ca678", "#15aabf", "#1c7ed6",
    "#4263eb", "#5f3dc4", "#862e9c", "#c2255c", "#d6336c",
    "#b08968", "#8d99ae", "#6c757d", "#495057", "#adb5bd",
];

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

export const BARS_SIZE_SCALE_MIN = 60;
export const BARS_SIZE_SCALE_MAX = 160;
export const BARS_SIZE_SCALE_DEFAULT = 100;
