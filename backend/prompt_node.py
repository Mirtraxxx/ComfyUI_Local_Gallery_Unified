"""The Local Prompt Gallery node: composes the visible prompt from card and wildcard selections."""

import hashlib
import json
import time
import uuid

from .prompt_prefs import cache_wildcard_cycle_state, load_ui_prefs
from .prompt_store import get_metadata_indexes, load_metadata
from .prompt_wildcards import schedule_wildcard_cycle_state_flush
from .value_utils import finite_float, parse_json_list

class LocalPromptGallery:
    @staticmethod
    def _has_wildcard_categories(wildcard_categories):
        if not wildcard_categories:
            return False
        if isinstance(wildcard_categories, str):
            value = wildcard_categories.strip()
            return bool(value and value not in ("[]", "{}"))
        return True

    @classmethod
    def INPUT_TYPES(cls):
        return {
                "required": {},
                "optional": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "hidden": {
                "selection_data": "STRING",
                "wildcard_categories": "STRING",
                "wildcard_mode": "STRING",
                "wildcard_rng_mode": "STRING",
                "wildcard_shuffle_nonce": "STRING",
                "wildcard_auto_attach_thumbnail": "STRING",
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("combined_prompt",)
    FUNCTION = "process"
    CATEGORY = "prompt"

    @classmethod
    def IS_CHANGED(
        cls,
        seed=0,
        selection_data="[]",
        wildcard_categories="",
        wildcard_mode="off",
        wildcard_rng_mode="seed_stable",
        wildcard_shuffle_nonce="0",
        wildcard_auto_attach_thumbnail="off",
        **kwargs,
    ):
        uses_wildcards = (wildcard_mode or "off") != "off" and cls._has_wildcard_categories(wildcard_categories)

        return json.dumps(
            {
                "seed": seed if uses_wildcards else "",
                "selection_data": selection_data,
                "wildcard_categories": wildcard_categories,
                "wildcard_mode": wildcard_mode,
                "wildcard_rng_mode": wildcard_rng_mode,
                "wildcard_shuffle_nonce": wildcard_shuffle_nonce,
                "wildcard_auto_attach_thumbnail": wildcard_auto_attach_thumbnail,
                "fresh_wildcard_nonce": time.time() if uses_wildcards and wildcard_rng_mode == "fresh" else "",
            },
            sort_keys=True,
        )

    def process(self, **kwargs):
        wildcard_categories = kwargs.get("wildcard_categories", "")
        wildcard_mode = kwargs.get("wildcard_mode", "off")
        wildcard_rng_mode = str(kwargs.get("wildcard_rng_mode", "seed_stable") or "seed_stable")
        wildcard_shuffle_nonce = str(kwargs.get("wildcard_shuffle_nonce", "0") or "0")
        wildcard_auto_attach_thumbnail = str(
            kwargs.get("wildcard_auto_attach_thumbnail", "off") or "off"
        ).lower() in ("on", "true", "1", "yes")
        seed = kwargs.get("seed", 0)
        try:
            seed_int = int(seed)
        except (TypeError, ValueError):
            seed_int = 0
        selection_data_str = kwargs.get("selection_data", "[]")

        selection_data = parse_json_list(selection_data_str)

        uses_wildcards = (
            (wildcard_mode or "off") != "off"
            and self._has_wildcard_categories(wildcard_categories)
        )

        # Manual card stacks only need id→text lookup. Skip index rebuild and
        # prefs deepcopy/load unless wildcards actually run.
        metadata = load_metadata()
        indexes = get_metadata_indexes() if uses_wildcards else {}
        prefs = load_ui_prefs() if uses_wildcards else {}
        wildcard_cycle_state = prefs.get("wildcard_cycle_state", {}) if uses_wildcards else {}
        wildcard_cycle_state_changed = False
        wildcard_prompt_ids = []  # IDs selected by wildcard mode for optional thumbnail attachment

        # Start with manual selections (always processed)
        combined_parts = []
        for item in selection_data:
            if not isinstance(item, dict):
                continue
            if not item.get('on', True):
                continue

            prompt_id = item.get('prompt_id')
            weight = item.get('weight', 1.0)
            prompt_text = ""
            workflow_override = item.get('prompt_text_override')
            if isinstance(workflow_override, str):
                workflow_override = workflow_override.strip()
            else:
                workflow_override = ""

            if workflow_override:
                # A selection can carry a workflow-local text override.  It is
                # intentionally kept out of card metadata so editing a card in
                # one workflow never changes the stored library card or other
                # workflows that use it.
                prompt_text = workflow_override
            elif prompt_id in metadata:
                prompt_text = metadata[prompt_id].get('prompt_text', '')
            else:
                # Presets may store inline prompt text or a prompt name alongside the
                # id. If an id went stale after metadata recovery, use that stored
                # text instead of silently dropping the prompt from the output.
                prompt_text = str(item.get('prompt_text') or item.get('prompt') or item.get('name') or '').strip()
                if prompt_text:
                    print(f"LocalPromptGallery: missing prompt id {prompt_id!r}; using preset fallback text")

            if prompt_text:
                weight = finite_float(weight, 1.0)
                if weight != 1.0:
                    combined_parts.append(f"({prompt_text}:{weight:.1f})")
                else:
                    combined_parts.append(prompt_text)

        # If wildcard mode is enabled AND categories are set, add wildcard prompts
        if uses_wildcards:
            try:
                # Try to parse as JSON first (new format)
                parsed = json.loads(wildcard_categories)
                if isinstance(parsed, list):
                    if all(isinstance(x, str) for x in parsed):
                        categories_data = [{"category": cat, "weight": 1.0} for cat in parsed]
                    else:
                        categories_data = [item for item in parsed if isinstance(item, dict)]
                else:
                    categories_data = []
            except (json.JSONDecodeError, TypeError):
                # Fallback to comma-separated string (old format)
                categories_data = [{"category": cat.strip(), "weight": 1.0} for cat in wildcard_categories.split(',') if cat.strip()]

            wildcard_prompts = []

            for cat_info in categories_data:
                if not isinstance(cat_info, dict):
                    continue
                category = cat_info.get("category", "")
                weight = finite_float(cat_info.get("weight", 1.0), 1.0)

                if not category:
                    continue

                category_prompt_ids = indexes.get("wildcard_category_ids", {}).get(category, [])
                auto_attach_category = cat_info.get("auto_attach", False)
                if isinstance(auto_attach_category, str):
                    auto_attach_category = auto_attach_category.lower() not in ("off", "false", "0", "no")

                if category_prompt_ids:
                    state = wildcard_cycle_state.get(category, {})
                    last_seed = state.get("last_seed")
                    last_index = state.get("last_index")
                    ordered_prompt_ids = category_prompt_ids
                    state_mode = state.get("mode")

                    if wildcard_rng_mode == "shuffle":
                        shuffle_key = f"{category}:{wildcard_shuffle_nonce}"
                        ordered_prompt_ids = sorted(
                            category_prompt_ids,
                            key=lambda prompt_id: hashlib.md5(f"{shuffle_key}:{prompt_id}".encode()).hexdigest()
                        )
                        same_shuffle_order = (
                            state_mode == "shuffle"
                            and state.get("shuffle_nonce") == wildcard_shuffle_nonce
                        )
                        if same_shuffle_order and last_seed == seed_int and isinstance(last_index, int):
                            current_index = last_index % len(ordered_prompt_ids)
                        elif (
                            same_shuffle_order
                            and isinstance(last_seed, int)
                            and isinstance(last_index, int)
                            and seed_int > last_seed
                            and (seed_int - last_seed) <= 32
                        ):
                            current_index = (last_index + 1) % len(ordered_prompt_ids)
                        else:
                            cat_hash = int(hashlib.md5(category.encode()).hexdigest(), 16)
                            current_index = (seed_int + cat_hash) % len(ordered_prompt_ids)
                    elif wildcard_rng_mode == "fresh":
                        selection_key = f"{seed_int}:{category}:{time.time()}:{uuid.uuid4()}"
                        current_index = int(hashlib.md5(selection_key.encode()).hexdigest(), 16) % len(category_prompt_ids)
                    else:
                        if last_seed == seed_int and isinstance(last_index, int):
                            current_index = last_index % len(category_prompt_ids)
                        elif (
                            isinstance(last_seed, int)
                            and isinstance(last_index, int)
                            and seed_int > last_seed
                            and (seed_int - last_seed) <= 32
                        ):
                            # Treat small forward seed changes as "next wildcard"
                            # so upstream seed strides do not skip entries.
                            current_index = (last_index + 1) % len(category_prompt_ids)
                        else:
                            # Fall back to deterministic seed mapping for first use,
                            # large jumps, or backward seed changes.
                            cat_hash = int(hashlib.md5(category.encode()).hexdigest(), 16)
                            current_index = (seed_int + cat_hash) % len(category_prompt_ids)

                    next_cycle_state = {
                        "last_seed": seed_int,
                        "last_index": current_index,
                        "mode": wildcard_rng_mode,
                    }
                    if wildcard_rng_mode == "shuffle":
                        next_cycle_state["shuffle_nonce"] = wildcard_shuffle_nonce
                    if state != next_cycle_state:
                        wildcard_cycle_state[category] = next_cycle_state
                        wildcard_cycle_state_changed = True
                    selected_prompt_id = ordered_prompt_ids[current_index]
                    selected_prompt = metadata.get(selected_prompt_id, {})

                    if wildcard_auto_attach_thumbnail and auto_attach_category:
                        wildcard_prompt_ids.append(selected_prompt_id)

                    prompt_text = selected_prompt.get('prompt_text', '')
                    if prompt_text:
                        if weight != 1.0:
                            wildcard_prompts.append(f"({prompt_text}:{weight:.1f})")
                        else:
                            wildcard_prompts.append(prompt_text)

            # Add wildcard prompts to the combined parts
            combined_parts.extend(wildcard_prompts)

        # Combine everything
        combined_prompt = ", ".join(combined_parts)

        if wildcard_cycle_state_changed:
            # Keep cycle progress in the in-memory prefs cache immediately, but
            # debounce the disk write so long sequential queues do not thrash prefs I/O.
            # Merge only the cycle state so prefs saved during the run are kept.
            cache_wildcard_cycle_state(wildcard_cycle_state)
            schedule_wildcard_cycle_state_flush(wildcard_cycle_state)

        return {
            "ui": {
                "text": [combined_prompt],
                "wildcard_prompt_ids": list(dict.fromkeys(wildcard_prompt_ids)),
            },
            "result": (combined_prompt,),
        }


NODE_CLASS_MAPPINGS = {
    "LocalPromptGallery": LocalPromptGallery
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LocalPromptGallery": "Local Prompt Gallery"
}
