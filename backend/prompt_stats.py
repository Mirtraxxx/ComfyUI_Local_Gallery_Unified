import re
from collections import defaultdict


_CHARACTER_TAG_RE = re.compile(r"^(.+?)\s*\\\((.+?)\\\)$")
_WEIGHTED_TAG_RE = re.compile(r"^\((.+):\s*-?(?:\d+(?:\.\d*)?|\.\d+)\)$")
_TRAILING_WEIGHT_RE = re.compile(r"^(.+):\s*-?(?:\d+(?:\.\d*)?|\.\d+)$")
_NON_FRANCHISE_QUALIFIERS = {"artist", "style", "medium"}


def split_prompt_tags(prompt_text):
    """Split a tag-style prompt on unescaped commas, including attention groups."""
    text = str(prompt_text or "")
    tags = []
    current = []
    escaped = False

    for character in text:
        if escaped:
            current.append(character)
            escaped = False
            continue
        if character == "\\":
            current.append(character)
            escaped = True
            continue
        if character == ",":
            tag = normalize_prompt_tag("".join(current))
            if tag:
                tags.append(tag)
            current = []
            continue
        current.append(character)

    tag = normalize_prompt_tag("".join(current))
    if tag:
        tags.append(tag)
    return tags


def normalize_prompt_tag(value):
    tag = " ".join(str(value or "").strip().split())
    weighted_match = _WEIGHTED_TAG_RE.fullmatch(tag)
    if weighted_match:
        tag = weighted_match.group(1).strip()
    else:
        # Attention groups frequently wrap a whole comma-delimited prompt, so
        # the first and last tags can carry unmatched grouping punctuation.
        tag = tag.lstrip("([{").strip()
        while tag and tag[-1] in ")]}" and not _is_escaped(tag, len(tag) - 1):
            tag = tag[:-1].rstrip()
        trailing_weight = _TRAILING_WEIGHT_RE.fullmatch(tag)
        if trailing_weight:
            tag = trailing_weight.group(1).strip()
    return tag


def _is_escaped(text, index):
    slash_count = 0
    index -= 1
    while index >= 0 and text[index] == "\\":
        slash_count += 1
        index -= 1
    return slash_count % 2 == 1


def classify_prompt_tag(tag):
    """Return the explicit character/franchise encoding, when present."""
    match = _CHARACTER_TAG_RE.fullmatch(tag)
    if not match:
        return None
    character = normalize_prompt_tag(match.group(1))
    franchise = normalize_prompt_tag(match.group(2))
    if not character or not franchise or franchise.casefold() in _NON_FRANCHISE_QUALIFIERS:
        return None
    return character, franchise


def _record_tag(stats, group, label, category):
    key = label.casefold()
    entry = stats[group].setdefault(key, {
        "tag": label,
        "count": 0,
        "categories": defaultdict(int),
    })
    entry["count"] += 1
    entry["categories"][category] += 1


def build_prompt_stats(metadata, category=None):
    """Aggregate distinct-per-card prompt tag usage for a category or all cards."""
    stats = {group: {} for group in ("all", "characters", "franchises", "other")}
    card_count = 0

    for prompt_data in metadata.values():
        if not isinstance(prompt_data, dict):
            continue
        card_category = str(prompt_data.get("category", "") or "")
        if category is not None and card_category != category:
            continue
        card_count += 1
        per_card = {group: {} for group in stats}
        for tag in split_prompt_tags(prompt_data.get("prompt_text", "")):
            per_card["all"].setdefault(tag.casefold(), tag)
            classification = None if "artist" in card_category.casefold() else classify_prompt_tag(tag)
            if classification:
                character, franchise = classification
                per_card["characters"].setdefault(character.casefold(), character)
                per_card["franchises"].setdefault(franchise.casefold(), franchise)
            else:
                per_card["other"].setdefault(tag.casefold(), tag)

        for group, labels in per_card.items():
            for label in labels.values():
                _record_tag(stats, group, label, card_category)

    return {"card_count": card_count, "groups": stats}


def query_prompt_stats(aggregate, group="all", search="", sort="count", page=1, per_page=100):
    entries = list(aggregate["groups"].get(group, {}).values())
    search_key = str(search or "").strip().casefold()
    if search_key:
        entries = [entry for entry in entries if search_key in entry["tag"].casefold()]

    if sort == "name":
        entries.sort(key=lambda entry: entry["tag"].casefold())
    else:
        entries.sort(key=lambda entry: (-entry["count"], entry["tag"].casefold()))

    total_tags = len(entries)
    total_pages = max(1, (total_tags + per_page - 1) // per_page)
    page = max(1, min(page, total_pages))
    start = (page - 1) * per_page
    result_entries = []
    for entry in entries[start:start + per_page]:
        categories = sorted(
            entry["categories"].items(),
            key=lambda item: (-item[1], item[0].casefold()),
        )
        result_entries.append({
            "tag": entry["tag"],
            "count": entry["count"],
            "categories": [
                {"category": category, "count": count}
                for category, count in categories
            ],
        })

    return {
        "card_count": aggregate["card_count"],
        "unique_tag_count": len(aggregate["groups"].get(group, {})),
        "matching_tag_count": total_tags,
        "page": page,
        "total_pages": total_pages,
        "entries": result_entries,
    }
