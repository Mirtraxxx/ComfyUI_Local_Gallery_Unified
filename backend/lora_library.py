"""LoRA gallery storage and inventory: data paths, metadata, UI state and preset files, and the browser inventory cache."""

import asyncio
import copy
import os
import threading
import time

import folder_paths

from .lora_json import file_signature, load_json_file, save_json_file
from .lora_lookup import build_metadata_basename_index, get_metadata_for_lora
from .lora_previews import get_lora_preview_asset_info

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(NODE_DIR, "..", "data", "lora_gallery"))
METADATA_FILE = os.path.join(DATA_DIR, "lora_gallery_metadata.json")
UI_STATE_FILE = os.path.join(DATA_DIR, "lora_gallery_ui_state.json")
PRESETS_FILE = os.path.join(DATA_DIR, "lora_gallery_presets.json")
PREVIEW_BACKUP_DIR = os.path.join(DATA_DIR, "preview_backups")
# Derived, process-local browser state. It is never the source of truth and can
# always be rebuilt from the LoRA roots and metadata JSON.
_LORA_INVENTORY_CACHE = None
_EXECUTION_METADATA_CACHE = {"signature": None, "data": None}
UI_STATE_LOCK = asyncio.Lock()
# Metadata and preset files are read/modified/saved from both async routes and
# synchronous node execution, so a reentrant threading lock serializes both.
METADATA_LOCK = threading.RLock()
PRESETS_LOCK = threading.RLock()
INVENTORY_FAST_CHECK_SECONDS = 0.75
INVENTORY_DEEP_CHECK_SECONDS = 5.0


def invalidate_lora_inventory():
    global _LORA_INVENTORY_CACHE
    _LORA_INVENTORY_CACHE = None


def load_metadata():
    return load_json_file(METADATA_FILE)


def load_execution_metadata():
    """Read metadata once per on-disk revision for execution and change checks."""
    signature = file_signature(METADATA_FILE)
    if _EXECUTION_METADATA_CACHE["signature"] != signature:
        _EXECUTION_METADATA_CACHE["data"] = load_metadata()
        _EXECUTION_METADATA_CACHE["signature"] = signature
    return _EXECUTION_METADATA_CACHE["data"] or {}


def save_metadata(data):
    save_json_file(data, METADATA_FILE)
    _EXECUTION_METADATA_CACHE["signature"] = file_signature(METADATA_FILE)
    _EXECUTION_METADATA_CACHE["data"] = data
    invalidate_lora_inventory()


load_ui_state = lambda: load_json_file(UI_STATE_FILE)
save_ui_state = lambda data: save_json_file(data, UI_STATE_FILE)
load_presets = lambda: load_json_file(PRESETS_FILE)
save_presets = lambda data: save_json_file(data, PRESETS_FILE)


def _lora_root_signature(roots):
    return tuple((os.path.normcase(os.path.abspath(root)), file_signature(root)) for root in roots)


def _build_lora_inventory(lora_files, lora_roots, generation):
    with METADATA_LOCK:
        metadata = load_metadata()
        basename_index = build_metadata_basename_index(metadata)
        metadata_changed = False
        folders = set()
        entries = []
        normalized_roots = [(root, os.path.normcase(os.path.abspath(root))) for root in lora_roots]

        for lora in lora_files:
            lora_full_path = folder_paths.get_full_path("loras", lora)
            if not lora_full_path:
                continue
            normalized_path = os.path.normcase(os.path.abspath(lora_full_path))
            root = next((candidate for candidate, normalized_root in normalized_roots
                         if normalized_path.startswith(normalized_root + os.sep) or normalized_path == normalized_root), None)
            if root is None:
                continue
            relative_path = os.path.relpath(os.path.dirname(lora_full_path), root)
            folder = "." if relative_path == "." else relative_path
            folders.add(folder)
            lora_meta, changed = get_metadata_for_lora(
                metadata, lora, lora_full_path, basename_index=basename_index,
            )
            metadata_changed = metadata_changed or changed
            try:
                file_stat = os.stat(lora_full_path)
                mtime = file_stat.st_mtime
                file_revision = (file_stat.st_mtime_ns, file_stat.st_size)
            except OSError:
                mtime = 0
                file_revision = None
            preview_url, preview_type = get_lora_preview_asset_info(lora)
            entries.append({
                "name": lora,
                "folder": folder,
                "name_sort": lora.lower(),
                "mtime": mtime,
                "file_revision": file_revision,
                "preview_url": preview_url or "",
                "preview_type": preview_type,
                "tags": list(lora_meta.get("tags", [])),
                "trigger_words": lora_meta.get("trigger_words", ""),
                "trigger_presets": copy.deepcopy(lora_meta.get("trigger_presets", {})),
                "download_url": lora_meta.get("download_url", ""),
                "remember_strength": bool(lora_meta.get("remember_strength", False)),
                "saved_strength": float(lora_meta.get("saved_strength", 1.0)),
                "saved_strength_clip": float(lora_meta.get("saved_strength_clip", lora_meta.get("saved_strength", 1.0))),
            })
        if metadata_changed:
            save_metadata(metadata)
    now = time.monotonic()
    return {
        "generation": generation,
        "checked_at": now,
        "deep_checked_at": now,
        "entries": entries,
        "folders": sorted(folders, key=lambda value: value.lower()),
        "metadata_signature": file_signature(METADATA_FILE),
    }


def get_lora_inventory():
    """Return normalized browser data, rebuilding only when its source changes.

    Root/list checks are intentionally cheap. A periodic conservative rebuild also
    catches nested asset and preview changes that do not update a root directory mtime.
    """
    global _LORA_INVENTORY_CACHE
    now = time.monotonic()
    cache = _LORA_INVENTORY_CACHE
    if cache and cache["metadata_signature"] == file_signature(METADATA_FILE) and now - cache["checked_at"] < INVENTORY_FAST_CHECK_SECONDS:
        return cache
    lora_files = folder_paths.get_filename_list("loras")
    lora_roots = folder_paths.get_folder_paths("loras")
    generation = (tuple(lora_files), _lora_root_signature(lora_roots))
    if not cache or cache["generation"] != generation or cache["metadata_signature"] != file_signature(METADATA_FILE):
        _LORA_INVENTORY_CACHE = _build_lora_inventory(lora_files, lora_roots, generation)
        return _LORA_INVENTORY_CACHE
    cache["checked_at"] = now
    if now - cache["deep_checked_at"] >= INVENTORY_DEEP_CHECK_SECONDS:
        _LORA_INVENTORY_CACHE = _build_lora_inventory(lora_files, lora_roots, generation)
    return _LORA_INVENTORY_CACHE
