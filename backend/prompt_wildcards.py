"""Wildcard support: text-file export ordering and the debounced cycle-state flush."""

import copy
import os
import threading

import folder_paths

from .comfy_queue import comfy_queue_busy
from .prompt_cards import (
    prompt_has_order,
    sort_prompt_ids_for_wildcards,
    get_prompt_manual_order_scope,
    sort_prompt_ids_for_display,
)
from .prompt_prefs import load_ui_prefs, save_ui_prefs
from .prompt_store import json_file_lock, get_metadata_indexes

# Deferred wildcard cycle-state prefs (updated every execution with wildcards)
_pending_wildcard_cycle_state = None
_cycle_state_flush_timer = None
_cycle_state_flush_generation = 0
_CYCLE_STATE_FLUSH_DELAY = 5  # seconds
_CYCLE_STATE_BUSY_RETRY_DELAY = 10  # seconds


def _flush_wildcard_cycle_state(generation=None):
    """Merge the latest wildcard cycle state into current prefs and save once."""
    global _pending_wildcard_cycle_state, _cycle_state_flush_timer
    try:
        with json_file_lock:
            pending = _pending_wildcard_cycle_state
            if pending is None:
                return
            if generation is not None and generation != _cycle_state_flush_generation:
                return

        if comfy_queue_busy():
            # Keep pending state; retry once the queue is idle.
            schedule_wildcard_cycle_state_flush(pending, delay=_CYCLE_STATE_BUSY_RETRY_DELAY)
            return

        # Merge under the JSON lock over a fresh disk read so concurrent UI
        # prefs saves are not clobbered by a stale snapshot. Clear the pending
        # record only after the save returns so a failed write keeps its state.
        with json_file_lock:
            pending = _pending_wildcard_cycle_state
            if pending is None:
                return
            if generation is not None and generation != _cycle_state_flush_generation:
                return
            prefs = load_ui_prefs()
            prefs["wildcard_cycle_state"] = pending
            save_ui_prefs(prefs)
            _pending_wildcard_cycle_state = None
    except Exception as e:
        print(f"LocalPromptGallery: failed to flush wildcard cycle state: {e}")
    finally:
        with json_file_lock:
            if generation is None or generation == _cycle_state_flush_generation:
                _cycle_state_flush_timer = None


def schedule_wildcard_cycle_state_flush(cycle_state, delay=None):
    """Debounce cycle-state prefs writes across rapid sequential executions."""
    global _pending_wildcard_cycle_state, _cycle_state_flush_timer, _cycle_state_flush_generation
    flush_delay = _CYCLE_STATE_FLUSH_DELAY if delay is None else max(1.0, float(delay))
    with json_file_lock:
        _pending_wildcard_cycle_state = copy.deepcopy(cycle_state)
        _cycle_state_flush_generation += 1
        generation = _cycle_state_flush_generation
        if _cycle_state_flush_timer is not None:
            _cycle_state_flush_timer.cancel()
        _cycle_state_flush_timer = threading.Timer(
            flush_delay, _flush_wildcard_cycle_state, args=(generation,)
        )
        _cycle_state_flush_timer.daemon = True
        _cycle_state_flush_timer.start()


def get_comfy_wildcards_dir():
    return os.path.join(folder_paths.base_path, "wildcards")


def sanitize_wildcard_relpath(filename):
    normalized = str(filename or "").strip().replace("\\", "/")
    if not normalized:
        return None
    parts = []
    for part in normalized.split("/"):
        part = part.strip()
        if not part or part in (".", ".."):
            return None
        if ":" in part:
            return None
        parts.append(part)
    return "/".join(parts)


def get_prompt_ids_for_wildcard_export(metadata, prefs, category):
    indexes = get_metadata_indexes()
    prompt_ids = list(indexes.get("category_ids", {}).get(category, []))
    if not prompt_ids:
        return []
    if prompt_has_order(metadata, prompt_ids):
        return sort_prompt_ids_for_wildcards(metadata, prompt_ids)
    manual_order_scope = get_prompt_manual_order_scope(category)
    prompt_manual_orders = prefs.get("prompt_manual_orders", {})
    manual_order = prompt_manual_orders.get(manual_order_scope, []) if isinstance(prompt_manual_orders, dict) else []
    return sort_prompt_ids_for_display(metadata, prompt_ids, "manual", manual_order)


def build_wildcard_export_lines(metadata, prefs, category):
    lines = []
    for prompt_id in get_prompt_ids_for_wildcard_export(metadata, prefs, category):
        prompt_text = str(metadata.get(prompt_id, {}).get("prompt_text", "")).strip()
        if prompt_text:
            lines.append(prompt_text)
    return lines
