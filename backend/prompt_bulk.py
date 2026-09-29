"""Pure helpers for bulk selection, bulk edit operations, and sequential renames."""

import copy

def normalize_bulk_ids(raw_ids):
    normalized = []
    seen = set()
    if not isinstance(raw_ids, list):
        return normalized
    for raw_id in raw_ids:
        prompt_id = str(raw_id).strip()
        if prompt_id and prompt_id not in seen:
            normalized.append(prompt_id)
            seen.add(prompt_id)
    return normalized


def resolve_bulk_selection(metadata, selection):
    """Resolve an explicit or filtered selection without returning card data."""
    if not isinstance(selection, dict):
        raise ValueError("selection must be an object")

    selection_type = selection.get("type", "ids")
    if selection_type == "ids":
        return normalize_bulk_ids(selection.get("ids", selection.get("prompt_ids", [])))
    if selection_type != "query":
        raise ValueError("selection.type must be ids or query")

    filter_name = str(selection.get("filter_name", "")).strip().casefold()
    category = str(selection.get("category", "")).strip()
    categories = []
    seen_categories = set()
    for raw_category in selection.get("categories", []) if isinstance(selection.get("categories", []), list) else []:
        normalized_category = str(raw_category or "").strip()
        if normalized_category and normalized_category not in seen_categories:
            categories.append(normalized_category)
            seen_categories.add(normalized_category)
    category_scope = set(categories)
    if category == "All Categories":
        category = ""
    favorites_only = bool(selection.get("favorites_only", False))
    uncategorized_only = bool(selection.get("uncategorized_only", False))
    excluded = set(normalize_bulk_ids(selection.get("exclusions", [])))
    resolved = []

    for prompt_id, prompt_data in metadata.items():
        if prompt_id in excluded or not isinstance(prompt_data, dict):
            continue
        prompt_category = str(prompt_data.get("category", "") or "")
        if category_scope and prompt_category not in category_scope:
            continue
        if category and prompt_category != category:
            continue
        if uncategorized_only and prompt_category:
            continue
        if favorites_only and not prompt_data.get("favorite", False):
            continue
        if filter_name:
            name = str(prompt_data.get("name", ""))
            prompt_text = str(prompt_data.get("prompt_text", ""))
            if filter_name not in name.casefold() and filter_name not in prompt_text.casefold():
                continue
        resolved.append(str(prompt_id))
    return resolved


def _sequential_rename_selection_from_request(data):
    """Validate an explicit-ID or complete query-selection snapshot."""
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object")

    has_prompt_ids = "prompt_ids" in data
    has_selection = "selection" in data
    if has_prompt_ids == has_selection:
        raise ValueError("Provide exactly one of prompt_ids or selection")

    if has_prompt_ids:
        raw_prompt_ids = data.get("prompt_ids")
        if not isinstance(raw_prompt_ids, list) or not raw_prompt_ids:
            raise ValueError("prompt_ids must be a non-empty list of card IDs")
        prompt_ids = []
        seen_ids = set()
        for raw_prompt_id in raw_prompt_ids:
            if not isinstance(raw_prompt_id, str):
                raise ValueError("prompt_ids must contain only non-empty string card IDs")
            prompt_id = raw_prompt_id.strip()
            if not prompt_id or prompt_id in seen_ids:
                raise ValueError("prompt_ids must contain unique non-empty card IDs")
            prompt_ids.append(prompt_id)
            seen_ids.add(prompt_id)
        return {"type": "ids", "ids": prompt_ids}

    selection = data.get("selection")
    if not isinstance(selection, dict) or selection.get("type") != "query":
        raise ValueError("selection must be a query selection object")

    required_fields = {
        "type", "filter_name", "category", "categories",
        "favorites_only", "uncategorized_only", "exclusions",
    }
    missing_fields = required_fields - set(selection)
    unknown_fields = set(selection) - required_fields
    if missing_fields:
        raise ValueError(f"Query selection is missing {sorted(missing_fields)[0]}")
    if unknown_fields:
        raise ValueError(f"Query selection contains unsupported field {sorted(unknown_fields)[0]}")
    if not isinstance(selection["filter_name"], str) or not isinstance(selection["category"], str):
        raise ValueError("Query filter_name and category must be strings")
    if not isinstance(selection["favorites_only"], bool) or not isinstance(selection["uncategorized_only"], bool):
        raise ValueError("Query selection flags must be booleans")

    categories = selection["categories"]
    exclusions = selection["exclusions"]
    if not isinstance(categories, list) or any(not isinstance(value, str) or not value.strip() for value in categories):
        raise ValueError("Query categories must contain only non-empty strings")
    if not isinstance(exclusions, list) or any(not isinstance(value, str) or not value.strip() for value in exclusions):
        raise ValueError("Query exclusions must contain only non-empty string card IDs")

    normalized_categories = [value.strip() for value in categories]
    normalized_exclusions = [value.strip() for value in exclusions]
    if len(set(normalized_categories)) != len(normalized_categories):
        raise ValueError("Query categories must be unique")
    if len(set(normalized_exclusions)) != len(normalized_exclusions):
        raise ValueError("Query exclusions must be unique")

    category = selection["category"].strip()
    if category and normalized_categories:
        raise ValueError("Query selection cannot combine category and categories")
    if selection["uncategorized_only"] and (category or normalized_categories):
        raise ValueError("Uncategorized query selection cannot include category filters")

    return {
        "type": "query",
        "filter_name": selection["filter_name"].strip(),
        "category": category,
        "categories": normalized_categories,
        "favorites_only": selection["favorites_only"],
        "uncategorized_only": selection["uncategorized_only"],
        "exclusions": normalized_exclusions,
    }


def resolve_sequential_rename_ids(metadata, data):
    """Resolve the validated selection through the authoritative bulk resolver."""
    selection = _sequential_rename_selection_from_request(data)
    prompt_ids = resolve_bulk_selection(metadata, selection)
    if not prompt_ids:
        raise ValueError("The selected cards no longer match any results")
    return prompt_ids


def normalize_bulk_operations(raw_operations):
    if not isinstance(raw_operations, dict) or not raw_operations:
        raise ValueError("At least one operation is required")

    operations = {}
    allowed_fields = {"category", "prompt_text", "name", "favorite"}
    unknown_fields = set(raw_operations) - allowed_fields
    if unknown_fields:
        raise ValueError(f"Unsupported bulk operation: {sorted(unknown_fields)[0]}")

    for field in ("prompt_text", "name"):
        operation = raw_operations.get(field)
        if operation is None:
            continue
        if not isinstance(operation, dict):
            raise ValueError(f"{field} operation must be an object")
        mode = operation.get("mode")
        if mode not in {"find_replace", "prepend", "append"}:
            raise ValueError(f"Unsupported {field} operation mode")
        if mode == "find_replace" and str(operation.get("find", "")) == "":
            raise ValueError(f"{field} find value cannot be empty")
        if mode in {"prepend", "append"} and field == "name":
            raise ValueError("Card names support find and replace only")
        operations[field] = {
            "mode": mode,
            "find": str(operation.get("find", "")),
            "replace": str(operation.get("replace", "")),
            "value": str(operation.get("value", "")),
            "case_sensitive": bool(operation.get("case_sensitive", False)),
        }

    category_operation = raw_operations.get("category")
    if category_operation is not None:
        if not isinstance(category_operation, dict) or category_operation.get("mode") != "set":
            raise ValueError("Category operation must set a string value")
        value = category_operation.get("value", "")
        if not isinstance(value, str):
            raise ValueError("Category value must be a string")
        operations["category"] = {"mode": "set", "value": value.strip()}

    favorite_operation = raw_operations.get("favorite")
    if favorite_operation is not None:
        if not isinstance(favorite_operation, dict) or favorite_operation.get("mode") != "set":
            raise ValueError("Pin operation must set true or false")
        value = favorite_operation.get("value")
        if not isinstance(value, bool):
            raise ValueError("Pin value must be true or false")
        operations["favorite"] = {"mode": "set", "value": value}

    if not operations:
        raise ValueError("At least one valid operation is required")
    return operations


def _apply_bulk_text_operation(current, operation):
    current = str(current or "")
    mode = operation["mode"]
    if mode == "prepend":
        return operation["value"] + current
    if mode == "append":
        return current + operation["value"]

    find = operation["find"]
    replacement = operation["replace"]
    if operation["case_sensitive"]:
        return current.replace(find, replacement)

    lowered = current.casefold()
    lowered_find = find.casefold()
    if not lowered_find:
        return current
    # Map each folded position back to its original offset so a match whose
    # folded length differs from the source span (e.g. "ß" -> "ss") replaces
    # exactly the matched characters.
    origin = []
    for offset, char in enumerate(current):
        origin.extend([offset] * max(1, len(char.casefold())))
    result = []
    fold_cursor = 0
    orig_cursor = 0
    while True:
        match_index = lowered.find(lowered_find, fold_cursor)
        if match_index < 0:
            result.append(current[orig_cursor:])
            return "".join(result)
        result.append(current[orig_cursor:origin[match_index]])
        result.append(replacement)
        orig_cursor = origin[match_index + len(lowered_find) - 1] + 1
        fold_cursor = match_index + len(lowered_find)


def apply_bulk_operations(prompt_data, operations):
    before = copy.deepcopy(prompt_data)
    for field in ("name", "prompt_text"):
        operation = operations.get(field)
        if operation:
            prompt_data[field] = _apply_bulk_text_operation(prompt_data.get(field, ""), operation)

    category_operation = operations.get("category")
    if category_operation:
        prompt_data["category"] = category_operation["value"]

    favorite_operation = operations.get("favorite")
    if favorite_operation:
        prompt_data["favorite"] = favorite_operation["value"]

    return before, prompt_data != before


def bulk_diff(prompt_id, before, after):
    diff = {"id": prompt_id, "name": after.get("name", prompt_id)}
    for field in ("name", "category", "prompt_text", "favorite"):
        default = False if field == "favorite" else ""
        previous = before.get(field, default)
        current = after.get(field, default)
        if previous != current:
            if field == "prompt_text":
                previous = str(previous)[:240]
                current = str(current)[:240]
            diff[field] = {"before": previous, "after": current}
    return diff


def replace_category_refs(values, old_category, new_category):
    """Replace one category label inside a stored list of category names."""
    if not isinstance(values, list):
        return values

    updated = []
    seen = set()
    for value in values:
        normalized = new_category if value == old_category else value
        if not normalized or normalized in seen:
            continue
        updated.append(normalized)
        seen.add(normalized)
    return updated
