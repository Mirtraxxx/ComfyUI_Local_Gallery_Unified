"""Pure card logic: display and wildcard ordering, metadata indexes, and response shaping."""

import math

def prompt_has_order(metadata, prompt_ids):
    return any(metadata.get(prompt_id, {}).get('wildcard_order') is not None for prompt_id in prompt_ids)


def sort_prompt_ids_for_wildcards(metadata, prompt_ids):
    if not prompt_has_order(metadata, prompt_ids):
        return list(prompt_ids)
    return sorted(
        prompt_ids,
        key=lambda prompt_id: (
            metadata.get(prompt_id, {}).get('wildcard_order') is None,
            metadata.get(prompt_id, {}).get('wildcard_order', 0),
            prompt_id,
        )
    )


def _prompt_created_at_value(prompt_id, data):
    for key in ("created_at", "date_added", "createdAt"):
        value = data.get(key)
        if value is None:
            continue
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                continue
            try:
                return float(stripped)
            except ValueError:
                pass
    return 0.0


def apply_manual_prompt_order(prompt_ids, manual_order=None):
    prompt_ids = list(prompt_ids)
    if not isinstance(manual_order, list) or not manual_order:
        return prompt_ids
    prompt_id_set = set(prompt_ids)
    ordered_ids = []
    seen = set()
    for prompt_id in manual_order:
        prompt_id = str(prompt_id)
        if prompt_id in prompt_id_set and prompt_id not in seen:
            ordered_ids.append(prompt_id)
            seen.add(prompt_id)
    ordered_ids.extend(prompt_id for prompt_id in prompt_ids if prompt_id not in seen)
    return ordered_ids


def get_prompt_manual_order_scope(category="", favorites_only=False):
    if favorites_only:
        return "favorites"
    category = str(category or "").strip()
    if category:
        return f"category:{category}"
    return "all"


def sort_prompt_ids_for_display(metadata, prompt_ids, sort_mode="manual", manual_order=None):
    sort_mode = str(sort_mode or "manual").strip().lower()
    prompt_ids = list(prompt_ids)
    if sort_mode in ("az", "a-z", "name_asc"):
        return sorted(prompt_ids, key=lambda prompt_id: (metadata.get(prompt_id, {}).get("name", prompt_id).lower(), prompt_id))
    if sort_mode in ("za", "z-a", "name_desc"):
        return sorted(prompt_ids, key=lambda prompt_id: (metadata.get(prompt_id, {}).get("name", prompt_id).lower(), prompt_id), reverse=True)
    if sort_mode in ("newest", "newest_first"):
        return sorted(prompt_ids, key=lambda prompt_id: (_prompt_created_at_value(prompt_id, metadata.get(prompt_id, {})), prompt_id), reverse=True)
    if sort_mode in ("oldest", "oldest_first"):
        return sorted(prompt_ids, key=lambda prompt_id: (_prompt_created_at_value(prompt_id, metadata.get(prompt_id, {})), prompt_id))
    return apply_manual_prompt_order(prompt_ids, manual_order)


def _wildcard_order_sort_value(prompt_data):
    """Return a finite wildcard import order, or None when it is unavailable."""
    value = prompt_data.get("wildcard_order")
    if isinstance(value, bool) or value is None:
        return None
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None
    return numeric_value if math.isfinite(numeric_value) else None


def build_sequential_rename_plan(metadata, prompt_ids):
    """Build zero-padded names in wildcard import order for explicit card IDs.

    Cards with a valid ``wildcard_order`` are placed first. Remaining cards use
    their stable creation timestamp and ID as a deterministic fallback.
    """
    def sort_key(prompt_id):
        prompt_data = metadata[prompt_id]
        wildcard_order = _wildcard_order_sort_value(prompt_data)
        created_at = _prompt_created_at_value(prompt_id, prompt_data)
        if not math.isfinite(created_at):
            created_at = 0
        return (
            wildcard_order is None,
            wildcard_order if wildcard_order is not None else 0,
            created_at,
            prompt_id,
        )

    ordered_ids = sorted(prompt_ids, key=sort_key)
    width = max(3, len(str(len(ordered_ids))))
    return [(prompt_id, str(index).zfill(width)) for index, prompt_id in enumerate(ordered_ids, start=1)]


def build_metadata_indexes(metadata):
    category_ids = {}
    favorite_ids = []
    name_to_id = {}
    searchable_text_by_id = {}

    for prompt_id, data in metadata.items():
        category = data.get('category', '')
        if category:
            category_ids.setdefault(category, []).append(prompt_id)

        if data.get('favorite', False):
            favorite_ids.append(prompt_id)

        name = data.get('name', '')
        if name:
            name_to_id[name.lower()] = prompt_id
        # Search retains the old Python lower()/substring semantics, but the
        # expensive normalization now happens once per metadata revision.
        searchable_text_by_id[prompt_id] = (
            str(name).lower(),
            str(data.get('prompt_text', '')).lower(),
        )

    wildcard_category_ids = {
        category: sort_prompt_ids_for_wildcards(metadata, prompt_ids)
        for category, prompt_ids in category_ids.items()
    }
    sort_by_name = lambda prompt_id: metadata.get(prompt_id, {}).get('name', prompt_id).lower()
    category_name_ids = {
        category: sorted(prompt_ids, key=sort_by_name)
        for category, prompt_ids in category_ids.items()
    }

    return {
        "category_ids": category_ids,
        "category_name_ids": category_name_ids,
        "wildcard_category_ids": wildcard_category_ids,
        "categories": sorted(category_ids.keys()),
        "favorite_ids": favorite_ids,
        "favorite_name_ids": sorted(favorite_ids, key=sort_by_name),
        "name_to_id": name_to_id,
        "searchable_text_by_id": searchable_text_by_id,
        "all_name_ids": sorted(metadata.keys(), key=sort_by_name),
    }


def prompt_response(prompt_id, data, include_usage=False):
    preview_type = data.get('preview_type')
    preview_url = None
    if preview_type:
        preview_version = data.get('preview_version', 0)
        preview_url = f"/localgalleryunified/prompt/thumbnail/{prompt_id}?v={preview_version}"

    response = {
        'id': prompt_id,
        'name': data.get('name', prompt_id),
        'prompt_text': data.get('prompt_text', ''),
        'category': data.get('category', ''),
        'created_at': data.get('created_at') or data.get('date_added') or data.get('createdAt'),
        'preview_type': preview_type,
        'preview_url': preview_url,
        'favorite': data.get('favorite', False),
        'favorite_color': data.get('favorite_color'),
    }
    response['category_favorites'] = data.get('category_favorites', [])
    # include_usage is ignored: card usage counting was removed.
    return response
