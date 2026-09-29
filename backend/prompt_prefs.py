"""Prompt UI preferences and presets: defaults, normalization, and the cached prefs file."""

import copy
import os

from .prompt_store import (
    JsonDataError,
    PRESETS_FILE,
    UI_PREFS_FILE,
    json_file_lock,
    load_json_file,
    save_json_file,
)

_ui_prefs_cache = None
_ui_prefs_mtime = 0
UI_PREF_DEFAULTS = {
    "display_mode": "thumbnails",
    "cards_display_mode": "thumbnails",
    "active_display_mode": "compact",
    "library_tabs": ["pinned"],
    "thumbnail_size": "medium",
    "thumbnail_size_px": 96,
    "active_thumbnail_size_px": 110,
    "card_manager_card_size_px": 150,
    "pinned_categories": None,
    "pinned_order": [],
    "prompt_manual_orders": {},
    "category_colors": {},
    "active_sidebar_open": False,
    "active_sidebar_width": 420,
    "active_sidebar_hover_open": True,
    "auto_hide_toolbars": False,
    "prompt_sort_mode": "manual",
    "prompt_sort_modes": {},
    "wildcard_cycle_state": {},
    "last_created_category": "",
    "card_insights_categories": [],
    "from_last_output_name_default": "time",
    "promote_selected_prompts": True,
    "card_contrast_mode": "off",
    "active_card_size_mode": "default",
}
DISPLAY_MODES = {"compact", "thumbnails"}
SORT_MODES = {"manual", "newest", "oldest", "az", "za"}
CARD_CONTRAST_MODES = {"off", "dim_inactive", "dim_by_default"}


def _normalize_choice(value, allowed, fallback):
    return value if value in allowed else fallback


def _normalize_display_mode(value, fallback="compact"):
    if value == "text":
        return "compact"
    return _normalize_choice(value, DISPLAY_MODES, fallback)


def _normalize_int(value, fallback, min_value=None, max_value=None):
    try:
        normalized = int(value)
    except (TypeError, ValueError):
        normalized = fallback
    if min_value is not None:
        normalized = max(min_value, normalized)
    if max_value is not None:
        normalized = min(max_value, normalized)
    return normalized


def _normalize_str_list(value):
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if item]


def _normalize_nullable_str_list(value):
    if value is None:
        return None
    return _normalize_str_list(value)


def _normalize_manual_orders(value):
    manual_orders = value if isinstance(value, dict) else {}
    return {
        str(scope): _normalize_str_list(ids)
        for scope, ids in manual_orders.items()
        if scope and isinstance(ids, list)
    }


def _normalize_category_colors(value):
    color_map = value if isinstance(value, dict) else {}
    return {
        str(category): str(color)
        for category, color in color_map.items()
        if category and isinstance(color, str) and color.strip()
    }


def _normalize_sort_modes(value):
    sort_modes = value if isinstance(value, dict) else {}
    return {
        str(scope): mode
        for scope, mode in sort_modes.items()
        if scope and mode in SORT_MODES
    }


def _normalize_dict(value):
    return value if isinstance(value, dict) else {}


def _normalize_card_insights_categories(value):
    return _normalize_str_list(value)


UI_PREF_VALIDATORS = {
    "display_mode": lambda value, prefs: _normalize_display_mode(value, UI_PREF_DEFAULTS["display_mode"]),
    "cards_display_mode": lambda value, prefs: _normalize_display_mode(value, UI_PREF_DEFAULTS["cards_display_mode"]),
    "active_display_mode": lambda value, prefs: _normalize_display_mode(value, UI_PREF_DEFAULTS["active_display_mode"]),
    "library_tabs": lambda value, prefs: [tab for tab in _normalize_str_list(value) if tab != "most_used"],
    "thumbnail_size": lambda value, prefs: _normalize_choice(value, {"small", "medium", "large"}, UI_PREF_DEFAULTS["thumbnail_size"]),
    "thumbnail_size_px": lambda value, prefs: _normalize_int(value, UI_PREF_DEFAULTS["thumbnail_size_px"], 40, 320),
    "active_thumbnail_size_px": lambda value, prefs: _normalize_int(value, prefs.get("thumbnail_size_px", UI_PREF_DEFAULTS["active_thumbnail_size_px"]), 40, 320),
    "card_manager_card_size_px": lambda value, prefs: _normalize_int(value, UI_PREF_DEFAULTS["card_manager_card_size_px"], 100, 320),
    "pinned_categories": lambda value, prefs: _normalize_nullable_str_list(value),
    "pinned_order": lambda value, prefs: _normalize_str_list(value),
    "prompt_manual_orders": lambda value, prefs: _normalize_manual_orders(value),
    "category_colors": lambda value, prefs: _normalize_category_colors(value),
    "active_sidebar_open": lambda value, prefs: bool(value),
    "active_sidebar_width": lambda value, prefs: _normalize_int(value, UI_PREF_DEFAULTS["active_sidebar_width"], 220),
    "active_sidebar_hover_open": lambda value, prefs: bool(value),
    "auto_hide_toolbars": lambda value, prefs: bool(value),
    "prompt_sort_mode": lambda value, prefs: _normalize_choice(value, SORT_MODES, UI_PREF_DEFAULTS["prompt_sort_mode"]),
    "prompt_sort_modes": lambda value, prefs: _normalize_sort_modes(value),
    "wildcard_cycle_state": lambda value, prefs: _normalize_dict(value),
    "last_created_category": lambda value, prefs: str(value or ""),
    "card_insights_categories": lambda value, prefs: _normalize_card_insights_categories(value),
    "from_last_output_name_default": lambda value, prefs: _normalize_choice(value, {"time", "blank"}, UI_PREF_DEFAULTS["from_last_output_name_default"]),
    "promote_selected_prompts": lambda value, prefs: bool(value),
    "card_contrast_mode": lambda value, prefs: _normalize_choice(value, CARD_CONTRAST_MODES, UI_PREF_DEFAULTS["card_contrast_mode"]),
    "active_card_size_mode": lambda value, prefs: _normalize_choice(value, {"default", "large"}, UI_PREF_DEFAULTS["active_card_size_mode"]),
}


def normalize_ui_prefs(raw_prefs):
    source = raw_prefs if isinstance(raw_prefs, dict) else {}
    prefs = copy.deepcopy(UI_PREF_DEFAULTS)

    if "cards_display_mode" not in source and "display_mode" in source:
        source = {
            **source,
            "cards_display_mode": source.get("display_mode"),
        }

    for key, validator in UI_PREF_VALIDATORS.items():
        if key in source:
            prefs[key] = validator(source[key], prefs)

    legacy_thumbnail_sizes = {
        "small": 81,
        "medium": 96,
        "large": 115,
    }
    if "thumbnail_size_px" not in source:
        prefs["thumbnail_size_px"] = legacy_thumbnail_sizes.get(
            prefs.get("thumbnail_size"),
            UI_PREF_DEFAULTS["thumbnail_size_px"],
        )
    if "active_thumbnail_size_px" not in source:
        prefs["active_thumbnail_size_px"] = prefs.get(
            "thumbnail_size_px",
            UI_PREF_DEFAULTS["active_thumbnail_size_px"],
        )
    prefs["cards_display_mode"] = _normalize_display_mode(
        prefs.get("cards_display_mode"),
        UI_PREF_DEFAULTS["cards_display_mode"],
    )
    prefs["active_display_mode"] = _normalize_display_mode(
        prefs.get("active_display_mode"),
        UI_PREF_DEFAULTS["active_display_mode"],
    )
    prefs["display_mode"] = prefs["cards_display_mode"]
    return prefs


def load_ui_prefs():
    global _ui_prefs_cache, _ui_prefs_mtime
    with json_file_lock:
        try:
            current_mtime = os.path.getmtime(UI_PREFS_FILE) if os.path.exists(UI_PREFS_FILE) else 0
            if _ui_prefs_cache is not None and current_mtime == _ui_prefs_mtime:
                return copy.deepcopy(_ui_prefs_cache)
            prefs = load_json_file(UI_PREFS_FILE, UI_PREF_DEFAULTS)
        except Exception:
            prefs = copy.deepcopy(UI_PREF_DEFAULTS)
            current_mtime = 0
        normalized = normalize_ui_prefs(prefs)
        if normalized != prefs:
            save_json_file(normalized, UI_PREFS_FILE)
            current_mtime = os.path.getmtime(UI_PREFS_FILE) if os.path.exists(UI_PREFS_FILE) else 0
        _ui_prefs_cache = normalized
        _ui_prefs_mtime = current_mtime
        return copy.deepcopy(normalized)


def save_ui_prefs(data):
    global _ui_prefs_cache, _ui_prefs_mtime
    with json_file_lock:
        normalized = normalize_ui_prefs(data)
        save_json_file(normalized, UI_PREFS_FILE)
        _ui_prefs_cache = normalized
        _ui_prefs_mtime = os.path.getmtime(UI_PREFS_FILE) if os.path.exists(UI_PREFS_FILE) else 0


def cache_wildcard_cycle_state(cycle_state):
    """Update cycle progress in the in-memory prefs cache without writing to disk."""
    with json_file_lock:
        if _ui_prefs_cache is None:
            load_ui_prefs()
        _ui_prefs_cache["wildcard_cycle_state"] = cycle_state


def load_presets():
    presets = load_json_file(PRESETS_FILE, {}, strict=True)
    if not isinstance(presets, dict):
        raise JsonDataError(f"{PRESETS_FILE} must contain a JSON object")
    return presets


save_presets = lambda data: save_json_file(data, PRESETS_FILE)


def rename_category_prefs(old_category, new_category):
    prefs = load_ui_prefs()
    prefs_changed = False
    old_category_key = old_category.casefold()

    category_colors = prefs.get("category_colors", {})
    if isinstance(category_colors, dict):
        old_color = None
        cleaned_colors = {}
        for category, color in category_colors.items():
            if str(category).casefold() == old_category_key:
                if old_color is None and isinstance(color, str) and color.strip():
                    old_color = color
                prefs_changed = True
                continue
            cleaned_colors[category] = color
        category_colors = cleaned_colors
        if new_category not in category_colors and isinstance(old_color, str) and old_color.strip():
            category_colors[new_category] = old_color
            prefs_changed = True
        prefs["category_colors"] = category_colors

    library_tabs = prefs.get("library_tabs", [])
    if isinstance(library_tabs, list):
        updated_tabs = []
        seen_tabs = set()
        for tab in library_tabs:
            normalized_tab = new_category if str(tab).casefold() == old_category_key else tab
            if not normalized_tab or normalized_tab in seen_tabs:
                continue
            updated_tabs.append(normalized_tab)
            seen_tabs.add(normalized_tab)
        if updated_tabs != library_tabs:
            prefs["library_tabs"] = updated_tabs
            prefs_changed = True

    wildcard_cycle_state = prefs.get("wildcard_cycle_state", {})
    if isinstance(wildcard_cycle_state, dict):
        old_state = None
        cleaned_state = {}
        for category, state in wildcard_cycle_state.items():
            if str(category).casefold() == old_category_key:
                if old_state is None:
                    old_state = state
                prefs_changed = True
                continue
            cleaned_state[category] = state
        if old_state is not None:
            cleaned_state.setdefault(new_category, old_state)
        if cleaned_state != wildcard_cycle_state:
            prefs["wildcard_cycle_state"] = cleaned_state
            prefs_changed = True

    if prefs_changed:
        save_ui_prefs(prefs)

    return prefs_changed
