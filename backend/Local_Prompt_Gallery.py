import os
import threading
import json
import copy
import asyncio
import folder_paths
import server
from aiohttp import web
import urllib.parse
import hashlib
import uuid
import shutil
import time
import math
from contextlib import AbstractContextManager

try:
    from .value_utils import bounded_int, finite_float, parse_json_list
    from .prompt_stats import build_prompt_stats, query_prompt_stats
    from .card_thumbnails import RESIZABLE_EXTENSIONS, card_thumbnail_path, remove_card_thumbnails, snap_card_width
except ImportError:
    from value_utils import bounded_int, finite_float, parse_json_list
    from prompt_stats import build_prompt_stats, query_prompt_stats
    from card_thumbnails import RESIZABLE_EXTENSIONS, card_thumbnail_path, remove_card_thumbnails, snap_card_width

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(NODE_DIR, "..", "data", "prompt_gallery"))
METADATA_FILE = os.path.join(DATA_DIR, "prompt_gallery_metadata.json")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
DELETED_THUMBNAILS_DIR = os.path.join(BACKUP_DIR, "deleted_thumbnails")
UI_STATE_FILE = os.path.join(DATA_DIR, "prompt_gallery_ui_state.json")
PRESETS_FILE = os.path.join(DATA_DIR, "prompt_gallery_presets.json")
UI_PREFS_FILE = os.path.join(DATA_DIR, "prompt_gallery_prefs.json")
THUMBNAILS_DIR = os.path.join(DATA_DIR, "prompt_thumbnails")
CARD_THUMBNAILS_DIR = os.path.join(DATA_DIR, "card_thumbnail_cache")
WILDCARDS_DIR = os.path.join(DATA_DIR, "wildcards")

# Module-level cache
_metadata_cache = None
_metadata_mtime = 0
_metadata_indexes_cache = None
_metadata_indexes_mtime = 0
_ui_prefs_cache = None
_ui_prefs_mtime = 0
_json_file_lock = threading.RLock()
_prompt_stats_cache = {}

# Deferred wildcard cycle-state prefs (updated every execution with wildcards)
_pending_wildcard_cycle_state = None
_cycle_state_flush_timer = None
_cycle_state_flush_generation = 0
_CYCLE_STATE_FLUSH_DELAY = 5  # seconds
_CYCLE_STATE_BUSY_RETRY_DELAY = 10  # seconds

def _load_metadata_from_disk_locked(update_cache=True):
    """Read the metadata file while the process-wide JSON lock is held.

    Mutation paths must not start from the in-memory cache: another request
    may have changed the file since the cache was populated. Keeping this
    small read helper separate also makes the load/modify/save transaction
    boundary explicit.
    """
    global _metadata_cache, _metadata_mtime
    metadata = load_json_file(METADATA_FILE, {}, strict=True)
    if not isinstance(metadata, dict):
        raise JsonDataError(f"{METADATA_FILE} must contain a JSON object")
    # Transactions receive this newly parsed object exclusively while holding
    # the lock.  Do not publish it until their atomic save succeeds: otherwise
    # a failed mutation could leak uncommitted edits through the read cache.
    if update_cache:
        _metadata_cache = metadata
        _metadata_mtime = os.path.getmtime(METADATA_FILE) if os.path.exists(METADATA_FILE) else 0
    return metadata


class MetadataTransaction(AbstractContextManager):
    """Serialize one prompt metadata load/modify/save operation.

    The transaction owns the JSON lock for its entire lifetime. A caller must
    call :meth:`commit` after making a mutation; leaving without a commit
    performs no write.
    """

    def __init__(self):
        self.metadata = None
        self._committed = False

    def __enter__(self):
        _json_file_lock.acquire()
        try:
            # json.loads already returned a fresh object.  Avoiding a second
            # full deep copy is significant for large metadata libraries while
            # retaining the transaction's all-or-nothing cache visibility.
            self.metadata = _load_metadata_from_disk_locked(update_cache=False)
            return self
        except Exception:
            _json_file_lock.release()
            raise

    def commit(self):
        if self._committed:
            return
        save_metadata(self.metadata)
        self._committed = True

    def __exit__(self, exc_type, exc_value, traceback):
        _json_file_lock.release()
        return False


def _comfy_queue_busy():
    """True when Comfy has a running job or pending queue items."""
    try:
        prompt_queue = getattr(server.PromptServer.instance, "prompt_queue", None)
        if prompt_queue is None:
            return False
        # Prefer the cheap volatile read — get_current_queue() deep-copies the
        # full queue and is marked slow in ComfyUI itself.
        getter = getattr(prompt_queue, "get_current_queue_volatile", None)
        if callable(getter):
            running, pending = getter()
        else:
            running, pending = prompt_queue.get_current_queue()
        return bool(running) or bool(pending)
    except Exception:
        return False


def _flush_wildcard_cycle_state(generation=None):
    """Merge the latest wildcard cycle state into current prefs and save once."""
    global _pending_wildcard_cycle_state, _cycle_state_flush_timer
    try:
        with _json_file_lock:
            pending = _pending_wildcard_cycle_state
            if pending is None:
                return
            if generation is not None and generation != _cycle_state_flush_generation:
                return

        if _comfy_queue_busy():
            # Keep pending state; retry once the queue is idle.
            _schedule_wildcard_cycle_state_flush(pending, delay=_CYCLE_STATE_BUSY_RETRY_DELAY)
            return

        # Merge under the JSON lock over a fresh disk read so concurrent UI
        # prefs saves are not clobbered by a stale snapshot. Clear the pending
        # record only after the save returns so a failed write keeps its state.
        with _json_file_lock:
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
        with _json_file_lock:
            if generation is None or generation == _cycle_state_flush_generation:
                _cycle_state_flush_timer = None


def _schedule_wildcard_cycle_state_flush(cycle_state, delay=None):
    """Debounce cycle-state prefs writes across rapid sequential executions."""
    global _pending_wildcard_cycle_state, _cycle_state_flush_timer, _cycle_state_flush_generation
    flush_delay = _CYCLE_STATE_FLUSH_DELAY if delay is None else max(1.0, float(delay))
    with _json_file_lock:
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


VIDEO_EXTENSIONS = ('.mp4', '.webm', '.mov', '.avi')
IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.gif')

os.makedirs(THUMBNAILS_DIR, exist_ok=True)
os.makedirs(WILDCARDS_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(DELETED_THUMBNAILS_DIR, exist_ok=True)

def resolve_comfy_output_path(filename, subfolder='', folder_type='output'):
    filename = os.path.basename(str(filename or ''))
    subfolder = os.path.normpath(str(subfolder or ''))
    if not filename or os.path.isabs(subfolder) or subfolder.startswith(".."):
        raise ValueError("Invalid source path")

    if folder_type == 'temp':
        base_dir = folder_paths.get_temp_directory()
    else:
        base_dir = folder_paths.get_output_directory()

    base_dir_abs = os.path.abspath(base_dir)
    source_path = os.path.abspath(os.path.join(base_dir_abs, subfolder, filename))
    if os.path.commonpath([base_dir_abs, source_path]) != base_dir_abs:
        raise ValueError("Invalid source path")

    if not os.path.exists(source_path):
        source_path = os.path.abspath(os.path.join(base_dir_abs, filename))
        if not os.path.exists(source_path):
            raise FileNotFoundError(f"Source file not found at {source_path}")

    return source_path, filename

class JsonDataError(RuntimeError):
    pass

def backup_json_file(filepath):
    if not os.path.exists(filepath):
        return None
    basename = os.path.basename(filepath)
    timestamp = time.strftime("%Y%m%d-%H%M%S") + f"-{int((time.time() % 1) * 1000):03d}"
    backup_path = os.path.join(BACKUP_DIR, f"{basename}.{timestamp}.bak")
    shutil.copy2(filepath, backup_path)

    try:
        backups = sorted(
            (
                os.path.join(BACKUP_DIR, name)
                for name in os.listdir(BACKUP_DIR)
                if name.startswith(f"{basename}.") and name.endswith(".bak")
            ),
            key=os.path.getmtime,
            reverse=True,
        )
        for old_backup in backups[20:]:
            try:
                os.remove(old_backup)
            except Exception as cleanup_error:
                print(f"Error pruning old backup {old_backup}: {cleanup_error}")
    except Exception as e:
        print(f"Error pruning backups for {filepath}: {e}")

    return backup_path

def load_json_file(filepath, default_data, strict=False):
    if not os.path.exists(filepath):
        return default_data
    try:
        with _json_file_lock:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                if not content:
                    if strict:
                        raise JsonDataError(f"{filepath} is empty")
                    return default_data
                return json.loads(content)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        if strict:
            raise JsonDataError(f"Could not load {filepath}: {e}") from e
        return default_data

def save_json_file(data, filepath):
    temp_filepath = f"{filepath}.{int(time.time() * 1000)}.{threading.get_ident()}.tmp"
    try:
        with _json_file_lock:
            with open(temp_filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            backup_json_file(filepath)
            os.replace(temp_filepath, filepath)
    except Exception as e:
        print(f"Error saving {filepath}: {e}")
        try:
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
        except Exception:
            pass
        raise

def load_metadata():
    global _metadata_cache, _metadata_mtime
    with _json_file_lock:
        try:
            if not os.path.exists(METADATA_FILE):
                _metadata_cache = {}
                _metadata_mtime = 0
                return _metadata_cache
            current_mtime = os.path.getmtime(METADATA_FILE)
            if _metadata_cache is None or current_mtime > _metadata_mtime:
                _metadata_cache = load_json_file(METADATA_FILE, {}, strict=True)
                if not isinstance(_metadata_cache, dict):
                    raise JsonDataError(f"{METADATA_FILE} must contain a JSON object")
                _metadata_mtime = current_mtime
            return _metadata_cache
        except Exception as e:
            print(f"Error in cached load_metadata: {e}")
            raise

def save_metadata(data):
    global _metadata_cache, _metadata_mtime, _metadata_indexes_cache, _metadata_indexes_mtime
    if not isinstance(data, dict):
        raise JsonDataError("metadata must be a JSON object")
    with _json_file_lock:
        save_json_file(data, METADATA_FILE)
        _metadata_cache = data
        _metadata_mtime = os.path.getmtime(METADATA_FILE)
        _metadata_indexes_cache = None
        _metadata_indexes_mtime = 0


def metadata_revision():
    """Return a cheap optimistic-concurrency token for bulk edit previews."""
    try:
        stat = os.stat(METADATA_FILE)
        return f"{stat.st_mtime_ns}:{stat.st_size}"
    except FileNotFoundError:
        return "missing:0"


def generate_unique_prompt_id(metadata, name):
    prompt_id = hashlib.md5(name.encode()).hexdigest()[:8]
    original_id = prompt_id
    counter = 1
    while prompt_id in metadata:
        prompt_id = f"{original_id}_{counter}"
        counter += 1
    return prompt_id

def _safe_thumbnail_path(prompt_id, ext):
    """Resolve a thumbnail path inside THUMBNAILS_DIR; None if it would escape."""
    prompt_id = str(prompt_id or "")
    if not prompt_id or any(ch in prompt_id for ch in ("/", "\\", ":")):
        return None
    base = os.path.abspath(THUMBNAILS_DIR)
    path = os.path.abspath(os.path.join(base, f"{prompt_id}{ext}"))
    try:
        if os.path.commonpath([base, path]) != base:
            return None
    except ValueError:
        return None
    return path

def find_thumbnail_paths(prompt_id):
    return [
        path
        for ext in IMAGE_EXTENSIONS + VIDEO_EXTENSIONS
        if (path := _safe_thumbnail_path(prompt_id, ext)) is not None and os.path.exists(path)
    ]

def backup_and_remove_thumbnail(path):
    try:
        timestamp = time.strftime("%Y%m%d-%H%M%S") + f"-{int((time.time() % 1) * 1000):03d}"
        target = os.path.join(DELETED_THUMBNAILS_DIR, f"{timestamp}-{os.path.basename(path)}")
        shutil.move(path, target)
        remove_card_thumbnails(CARD_THUMBNAILS_DIR, path)
    except Exception as e:
        print(f"Error moving thumbnail backup {path}: {e}")


def assign_thumbnail_files(metadata, prompt_id, filename, subfolder='', folder_type='output'):
    """Copy a Comfy output into the gallery thumbnail store and update metadata.

    Mutates *metadata* in place. Returns the preview type string.
    """
    if prompt_id not in metadata:
        raise KeyError(f"Prompt not found: {prompt_id}")

    source_path, filename = resolve_comfy_output_path(filename, subfolder, folder_type)
    ext = os.path.splitext(filename)[1].lower()
    if ext in IMAGE_EXTENSIONS:
        preview_type = 'image'
    elif ext in VIDEO_EXTENSIONS:
        preview_type = 'video'
    else:
        raise ValueError(f"Unsupported file type: {ext or '(none)'}")

    old_thumbnail_paths = find_thumbnail_paths(prompt_id)
    target_path = _safe_thumbnail_path(prompt_id, ext)
    if target_path is None:
        raise ValueError(f"Unsafe thumbnail path for prompt: {prompt_id}")
    temp_target_path = f"{target_path}.{int(time.time() * 1000)}.{threading.get_ident()}.tmp"
    try:
        shutil.copy2(source_path, temp_target_path)
        for old_path in old_thumbnail_paths:
            if old_path != target_path:
                backup_and_remove_thumbnail(old_path)
            elif os.path.exists(old_path):
                backup_json_file(old_path)
        os.replace(temp_target_path, target_path)

        metadata[prompt_id]['preview_type'] = preview_type
        metadata[prompt_id]['preview_version'] = int(time.time())
        return preview_type
    except Exception:
        try:
            if os.path.exists(temp_target_path):
                os.remove(temp_target_path)
        except Exception:
            pass
        raise


def _prompt_has_order(metadata, prompt_ids):
    return any(metadata.get(prompt_id, {}).get('wildcard_order') is not None for prompt_id in prompt_ids)

def _sort_prompt_ids_for_wildcards(metadata, prompt_ids):
    if not _prompt_has_order(metadata, prompt_ids):
        return list(prompt_ids)
    return sorted(
        prompt_ids,
        key=lambda prompt_id: (
            metadata.get(prompt_id, {}).get('wildcard_order') is None,
            metadata.get(prompt_id, {}).get('wildcard_order', 0),
            prompt_id,
        )
    )

def get_comfy_wildcards_dir():
    return os.path.join(folder_paths.base_path, "wildcards")

def _sanitize_wildcard_relpath(filename):
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
    if _prompt_has_order(metadata, prompt_ids):
        return _sort_prompt_ids_for_wildcards(metadata, prompt_ids)
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
        category: _sort_prompt_ids_for_wildcards(metadata, prompt_ids)
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

def get_metadata_indexes():
    global _metadata_indexes_cache, _metadata_indexes_mtime
    metadata = load_metadata()
    if _metadata_indexes_cache is None or _metadata_indexes_mtime != _metadata_mtime:
        _metadata_indexes_cache = build_metadata_indexes(metadata)
        _metadata_indexes_mtime = _metadata_mtime
    return _metadata_indexes_cache

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
    with _json_file_lock:
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
    with _json_file_lock:
        normalized = normalize_ui_prefs(data)
        save_json_file(normalized, UI_PREFS_FILE)
        _ui_prefs_cache = normalized
        _ui_prefs_mtime = os.path.getmtime(UI_PREFS_FILE) if os.path.exists(UI_PREFS_FILE) else 0
def load_presets():
    presets = load_json_file(PRESETS_FILE, {}, strict=True)
    if not isinstance(presets, dict):
        raise JsonDataError(f"{PRESETS_FILE} must contain a JSON object")
    return presets
save_presets = lambda data: save_json_file(data, PRESETS_FILE)


def _replace_category_refs(values, old_category, new_category):
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


def _rename_category_prefs(old_category, new_category):
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

@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_prompts")
async def get_prompts_endpoint(request):
    try:
        filter_name = request.query.get('filter_name', '')
        mode = request.query.get('mode', 'OR')
        category = request.query.get('category', '')
        categories = list(dict.fromkeys(
            str(value).strip() for value in request.query.getall('categories', [])
            if str(value).strip()
        ))
        sort_mode = request.query.get('sort', request.query.get('sort_mode', 'manual'))

        # Treat UI label as no filter
        if category == 'All Categories':
            category = ''

        favorites_only_raw = request.query.get('favorites_only', '0').lower()
        favorites_only = favorites_only_raw in ('1', 'true', 'yes', 'on')

        page = bounded_int(request.query.get('page', 1), 1, 1, 1_000_000)
        per_page = bounded_int(request.query.get('per_page', 30), 30, 1, 200)

        # Safety clamp
        if per_page < 1:
            per_page = 1
        if per_page > 200:
            per_page = 200

        selected_prompts = request.query.getall('selected_prompts', [])

        metadata = load_metadata()
        indexes = get_metadata_indexes()
        prefs = load_ui_prefs()
        effective_category = category if not categories else (categories[0] if len(categories) == 1 else "")
        manual_order_scope = get_prompt_manual_order_scope(effective_category, favorites_only)
        prompt_manual_orders = prefs.get("prompt_manual_orders", {})
        manual_order = prompt_manual_orders.get(manual_order_scope, []) if isinstance(prompt_manual_orders, dict) else []
        if categories:
            scoped_ids = set()
            for scoped_category in categories:
                scoped_ids.update(indexes.get("category_ids", {}).get(scoped_category, []))
            candidate_ids = [prompt_id for prompt_id in metadata if prompt_id in scoped_ids]
            if favorites_only:
                favorite_ids = set(indexes.get("favorite_ids", []))
                candidate_ids = [prompt_id for prompt_id in candidate_ids if prompt_id in favorite_ids]
        elif favorites_only:
            candidate_ids = list(indexes.get("favorite_ids", []))
        elif category:
            candidate_ids = list(indexes.get("category_ids", {}).get(category, []))
        else:
            candidate_ids = list(metadata.keys())

        selected_set = set(selected_prompts)

        if not filter_name:
            ordered_candidate_ids = sort_prompt_ids_for_display(metadata, candidate_ids, sort_mode, manual_order)
            if selected_set:
                selected_ids = [prompt_id for prompt_id in ordered_candidate_ids if prompt_id in selected_set]
                ordered_candidate_ids = selected_ids + [
                    prompt_id for prompt_id in ordered_candidate_ids
                    if prompt_id not in selected_set
                ]

            total_prompts = len(ordered_candidate_ids)
            total_pages = max(1, (total_prompts + per_page - 1) // per_page)
            page = max(1, min(page, total_pages))
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_ids = ordered_candidate_ids[start_idx:end_idx]
            paginated_prompts = [
                prompt_response(prompt_id, metadata[prompt_id], include_usage=True)
                for prompt_id in paginated_ids
                if prompt_id in metadata
            ]

            return web.json_response({
                'prompts': paginated_prompts,
                'total_pages': total_pages,
                'current_page': page,
                'total_prompts': total_prompts
            })

        filter_lower = filter_name.lower()
        filtered_candidate_ids = []

        for prompt_id in candidate_ids:
            data = metadata.get(prompt_id)
            if not data:
                continue

            name_lower, prompt_text_lower = indexes.get("searchable_text_by_id", {}).get(
                prompt_id,
                (str(data.get('name', '')).lower(), str(data.get('prompt_text', '')).lower()),
            )

            # Check if filter text is found in name or prompt_text
            if filter_lower not in name_lower and filter_lower not in prompt_text_lower:
                continue

            filtered_candidate_ids.append(prompt_id)

        ordered_filtered_ids = sort_prompt_ids_for_display(metadata, filtered_candidate_ids, sort_mode, manual_order)
        if selected_set:
            selected_ids = [prompt_id for prompt_id in ordered_filtered_ids if prompt_id in selected_set]
            ordered_filtered_ids = selected_ids + [
                prompt_id for prompt_id in ordered_filtered_ids
                if prompt_id not in selected_set
            ]

        # Pagination
        total_prompts = len(ordered_filtered_ids)
        total_pages = max(1, (total_prompts + per_page - 1) // per_page)
        page = max(1, min(page, total_pages))
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_ids = ordered_filtered_ids[start_idx:end_idx]
        paginated_prompts = [
            prompt_response(prompt_id, metadata[prompt_id], include_usage=True)
            for prompt_id in paginated_ids
            if prompt_id in metadata
        ]

        return web.json_response({
            'prompts': paginated_prompts,
            'total_pages': total_pages,
            'current_page': page,
            'total_prompts': total_prompts
        })

    except Exception as e:
        print(f"Error in get_prompts_endpoint: {e}")
        return web.json_response({
            'status': 'error',
            'message': str(e),
            'prompts': [],
            'total_pages': 1,
            'current_page': 1,
            'total_prompts': 0,
        }, status=500)

@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_prompt")
async def get_prompt_endpoint(request):
    try:
        prompt_id = request.query.get('prompt_id')
        if not prompt_id:
            return web.json_response({"status": "error", "message": "Missing prompt_id"}, status=400)

        metadata = load_metadata()
        if prompt_id not in metadata:
            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)

        data = metadata[prompt_id]
        preview_type = data.get('preview_type')
        preview_url = None
        if preview_type:
            preview_version = data.get('preview_version', 0)
            preview_url = f"/localgalleryunified/prompt/thumbnail/{prompt_id}?v={preview_version}"

        prompt = {
            'id': prompt_id,
            'name': data.get('name', prompt_id),
            'prompt_text': data.get('prompt_text', ''),
            'category': data.get('category', ''),
            'preview_type': preview_type,
            'preview_url': preview_url,
            'favorite': data.get('favorite', False),
            'favorite_color': data.get('favorite_color'),
            'category_favorites': data.get('category_favorites', []),
        }
        return web.json_response({"status": "ok", "prompt": prompt})

    except Exception as e:
        print(f"Error in get_prompt_endpoint: {e}")
        return web.json_response({'status': 'error', 'message': str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/get_prompts_by_ids")
async def get_prompts_by_ids_endpoint(request):
    try:
        data = await request.json()
        prompt_ids = data.get('prompt_ids', [])
        if not isinstance(prompt_ids, list):
            return web.json_response({"status": "error", "message": "prompt_ids must be a list"}, status=400)

        metadata = load_metadata()
        prompts = []
        for prompt_id in prompt_ids:
            prompt_id = str(prompt_id)
            prompt_data = metadata.get(prompt_id)
            if prompt_data:
                prompts.append(prompt_response(prompt_id, prompt_data, include_usage=True))

        return web.json_response({"status": "ok", "prompts": prompts})
    except Exception as e:
        print(f"Error in get_prompts_by_ids_endpoint: {e}")
        return web.json_response({'status': 'error', 'message': str(e), 'prompts': []}, status=500)

@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_categories")
async def get_categories_endpoint(request):
    try:
        indexes = get_metadata_indexes()
        category_ids = indexes.get("category_ids", {})
        category_counts = {
            category: len(prompt_ids)
            for category, prompt_ids in category_ids.items()
        }
        return web.json_response({
            'categories': indexes.get("categories", []),
            'category_counts': category_counts,
            'total_count': len(indexes.get("all_name_ids", [])),
        })
    except Exception as e:
        print(f"Error getting categories: {e}")
        return web.json_response({
            'status': 'error',
            'message': str(e),
            'categories': [],
            'category_counts': {},
            'total_count': 0,
        }, status=500)

@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_prompt_stats")
async def get_prompt_stats_endpoint(request):
    """Return comma-delimited prompt tag frequencies for Card Manager."""
    try:
        category_supplied = "category" in request.query
        category = request.query.get("category", "") if category_supplied else None
        categories = [str(value) for value in request.query.getall("categories", []) if str(value)]
        # Compatibility with clients that send one comma-delimited value.
        if len(categories) == 1 and "," in categories[0]:
            categories = [value.strip() for value in categories[0].split(",") if value.strip()]
        categories = list(dict.fromkeys(categories))
        group = request.query.get("group", "all")
        if group not in {"all", "characters", "franchises", "other"}:
            group = "all"
        search = request.query.get("search", "")
        sort_mode = request.query.get("sort", "count")
        if sort_mode not in {"count", "name"}:
            sort_mode = "count"
        page = bounded_int(request.query.get("page", 1), 1, 1, 1_000_000)
        per_page = bounded_int(request.query.get("per_page", 100), 100, 20, 200)

        revision = metadata_revision()
        cache_key = (revision, tuple(categories) if categories else category)
        aggregate = _prompt_stats_cache.get(cache_key)
        if aggregate is None:
            metadata = load_metadata()
            aggregate = build_prompt_stats(metadata, category=category, categories=categories or None)
            _prompt_stats_cache.clear()
            _prompt_stats_cache[cache_key] = aggregate

        result = query_prompt_stats(
            aggregate,
            group=group,
            search=search,
            sort=sort_mode,
            page=page,
            per_page=per_page,
        )
        return web.json_response({
            "status": "ok",
            "scope": "categories" if categories else ("category" if category_supplied else "all"),
            "category": category,
            "categories": categories,
            "group": group,
            **result,
        })
    except Exception as e:
        print(f"Error getting prompt stats: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/update_metadata")
async def update_metadata_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            if prompt_id not in metadata:
                return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)

            if 'name' in data:
                metadata[prompt_id]['name'] = data['name']
            if 'prompt_text' in data:
                metadata[prompt_id]['prompt_text'] = data['prompt_text']
            if 'category' in data:
                metadata[prompt_id]['category'] = data['category']

            transaction.commit()
            prompt = prompt_response(prompt_id, metadata[prompt_id], include_usage=True)

        return web.json_response({"status": "ok", "prompt": prompt})

    except Exception as e:
        print(f"Error updating metadata: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


def _normalize_bulk_ids(raw_ids):
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


def _resolve_bulk_selection(metadata, selection):
    """Resolve an explicit or filtered selection without returning card data."""
    if not isinstance(selection, dict):
        raise ValueError("selection must be an object")

    selection_type = selection.get("type", "ids")
    if selection_type == "ids":
        return _normalize_bulk_ids(selection.get("ids", selection.get("prompt_ids", [])))
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
    excluded = set(_normalize_bulk_ids(selection.get("exclusions", [])))
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
    prompt_ids = _resolve_bulk_selection(metadata, selection)
    if not prompt_ids:
        raise ValueError("The selected cards no longer match any results")
    return prompt_ids


def _normalize_bulk_operations(raw_operations):
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


def _apply_bulk_operations(prompt_data, operations):
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


def _bulk_diff(prompt_id, before, after):
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


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/bulk_edit")
async def bulk_edit_endpoint(request):
    """Preview or atomically apply server-side card transformations."""
    try:
        data = await request.json()
        selection = data.get("selection", {})
        operations = _normalize_bulk_operations(data.get("operations", {}))
        preview = bool(data.get("preview", True))
        sample_limit = bounded_int(data.get("sample_limit", 10), 10, 0, 20)
        active_prompt_ids = _normalize_bulk_ids(data.get("active_prompt_ids", []))

        if preview:
            metadata = load_metadata()
            revision = metadata_revision()
            prompt_ids = _resolve_bulk_selection(metadata, selection)
            missing_ids = [prompt_id for prompt_id in prompt_ids if prompt_id not in metadata]
            changed_count = 0
            unchanged_count = 0
            samples = []
            for prompt_id in prompt_ids:
                prompt_data = metadata.get(prompt_id)
                if not isinstance(prompt_data, dict):
                    continue
                working = copy.deepcopy(prompt_data)
                before, changed = _apply_bulk_operations(working, operations)
                if changed:
                    changed_count += 1
                    if len(samples) < sample_limit:
                        samples.append(_bulk_diff(prompt_id, before, working))
                else:
                    unchanged_count += 1
            return web.json_response({
                "status": "ok",
                "preview": True,
                "revision": revision,
                "selected_count": len(prompt_ids),
                "changed_count": changed_count,
                "unchanged_count": unchanged_count,
                "missing_count": len(missing_ids),
                "missing_ids": missing_ids[:100],
                "samples": samples,
            })

        base_revision = str(data.get("base_revision", "")).strip()
        if not base_revision:
            return web.json_response({
                "status": "error",
                "message": "base_revision is required when applying a bulk edit",
            }, status=400)

        with MetadataTransaction() as transaction:
            current_revision = metadata_revision()
            if base_revision != current_revision:
                return web.json_response({
                    "status": "conflict",
                    "message": "The card library changed after the preview. Refresh the preview and try again.",
                    "revision": current_revision,
                }, status=409)

            metadata = transaction.metadata
            prompt_ids = _resolve_bulk_selection(metadata, selection)
            missing_ids = [prompt_id for prompt_id in prompt_ids if prompt_id not in metadata]
            updated_count = 0
            updated_active_prompts = []
            samples = []
            for prompt_id in prompt_ids:
                prompt_data = metadata.get(prompt_id)
                if not isinstance(prompt_data, dict):
                    continue
                before, changed = _apply_bulk_operations(prompt_data, operations)
                if changed:
                    updated_count += 1
                    if len(samples) < sample_limit:
                        samples.append(_bulk_diff(prompt_id, before, prompt_data))

            if updated_count:
                transaction.commit()

            for prompt_id in active_prompt_ids:
                prompt_data = metadata.get(prompt_id)
                if isinstance(prompt_data, dict):
                    updated_active_prompts.append(prompt_response(prompt_id, prompt_data))

            result_revision = metadata_revision()

        return web.json_response({
            "status": "ok",
            "preview": False,
            "revision": result_revision,
            "selected_count": len(prompt_ids),
            "changed_count": updated_count,
            "unchanged_count": max(0, len(prompt_ids) - updated_count - len(missing_ids)),
            "missing_count": len(missing_ids),
            "missing_ids": missing_ids[:100],
            "active_prompts": updated_active_prompts,
            "samples": samples,
        })
    except ValueError as error:
        return web.json_response({"status": "error", "message": str(error)}, status=400)
    except Exception as error:
        print(f"Error in bulk edit: {error}")
        return web.json_response({"status": "error", "message": str(error)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/rename_prompts_sequential")
async def rename_prompts_sequential_endpoint(request):
    """Preview or atomically rename selected cards to 001, 002, ... ."""
    try:
        try:
            data = await request.json()
        except Exception:
            return web.json_response({
                "status": "error",
                "message": "Request body must be valid JSON",
            }, status=400)
        preview = data.get("preview", True) if isinstance(data, dict) else True
        if not isinstance(preview, bool):
            raise ValueError("preview must be a boolean")
        active_prompt_ids = _normalize_bulk_ids(data.get("active_prompt_ids", []))

        if preview:
            metadata = load_metadata()
            prompt_ids = resolve_sequential_rename_ids(metadata, data)
            missing_ids = [prompt_id for prompt_id in prompt_ids if not isinstance(metadata.get(prompt_id), dict)]
            if missing_ids:
                return web.json_response({
                    "status": "error",
                    "message": "One or more selected cards no longer exist",
                    "missing_ids": missing_ids[:100],
                }, status=404)
            return web.json_response({
                "status": "ok",
                "preview": True,
                "revision": metadata_revision(),
                "selected_count": len(prompt_ids),
                "ordering": "wildcard_order first; remaining cards by created time and card ID",
            })

        base_revision = str(data.get("base_revision", "")).strip()
        if not base_revision:
            raise ValueError("base_revision is required when applying a sequential rename")

        with MetadataTransaction() as transaction:
            current_revision = metadata_revision()
            if base_revision != current_revision:
                return web.json_response({
                    "status": "conflict",
                    "message": "The card library changed after confirmation. Review the selection and try again.",
                    "revision": current_revision,
                }, status=409)

            metadata = transaction.metadata
            prompt_ids = resolve_sequential_rename_ids(metadata, data)
            missing_ids = [prompt_id for prompt_id in prompt_ids if not isinstance(metadata.get(prompt_id), dict)]
            if missing_ids:
                return web.json_response({
                    "status": "error",
                    "message": "One or more selected cards no longer exist",
                    "missing_ids": missing_ids[:100],
                }, status=404)

            rename_plan = build_sequential_rename_plan(metadata, prompt_ids)
            renamed_count = 0
            for prompt_id, name in rename_plan:
                if metadata[prompt_id].get("name") != name:
                    metadata[prompt_id]["name"] = name
                    renamed_count += 1
            if renamed_count:
                transaction.commit()

            active_prompts = []
            for prompt_id in active_prompt_ids:
                prompt_data = metadata.get(prompt_id)
                if isinstance(prompt_data, dict):
                    active_prompts.append(prompt_response(prompt_id, prompt_data, include_usage=True))
            result_revision = metadata_revision()

        return web.json_response({
            "status": "ok",
            "preview": False,
            "revision": result_revision,
            "selected_count": len(prompt_ids),
            "renamed_count": renamed_count,
            "active_prompts": active_prompts,
            "ordering": "wildcard_order first; remaining cards by created time and card ID",
        })
    except ValueError as error:
        return web.json_response({"status": "error", "message": str(error)}, status=400)
    except Exception as error:
        print(f"Error renaming prompts sequentially: {error}")
        return web.json_response({"status": "error", "message": str(error)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/move_prompts_bulk")
async def move_prompts_bulk_endpoint(request):
    """Move a set of cards to one category with a single metadata write."""
    try:
        data = await request.json()
        prompt_ids = data.get('prompt_ids', [])
        if not isinstance(prompt_ids, list) or not prompt_ids:
            return web.json_response({
                "status": "error",
                "message": "prompt_ids must be a non-empty list",
            }, status=400)
        if 'category' not in data or not isinstance(data.get('category'), str):
            return web.json_response({
                "status": "error",
                "message": "category must be a string",
            }, status=400)

        category = data.get('category', '').strip()
        # Empty category is the supported Uncategorized destination.
        normalized_ids = []
        seen_ids = set()
        for prompt_id in prompt_ids:
            prompt_id = str(prompt_id).strip()
            if prompt_id and prompt_id not in seen_ids:
                normalized_ids.append(prompt_id)
                seen_ids.add(prompt_id)
        if not normalized_ids:
            return web.json_response({
                "status": "error",
                "message": "prompt_ids must contain at least one valid id",
            }, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            missing_ids = [prompt_id for prompt_id in normalized_ids if prompt_id not in metadata]
            updated_ids = []
            for prompt_id in normalized_ids:
                prompt_data = metadata.get(prompt_id)
                if not prompt_data:
                    continue
                if prompt_data.get('category', '') != category:
                    prompt_data['category'] = category
                    updated_ids.append(prompt_id)
            if updated_ids:
                transaction.commit()

        return web.json_response({
            "status": "ok",
            "category": category,
            "updated_ids": updated_ids,
            "moved_count": len(updated_ids),
            "missing_ids": missing_ids,
        })
    except Exception as e:
        print(f"Error moving prompts in bulk: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/rename_category")
async def rename_category_endpoint(request):
    try:
        data = await request.json()
        old_category = str(data.get('old_category', '')).strip()
        new_category = str(data.get('new_category', '')).strip()

        if not old_category or not new_category:
            return web.json_response({"status": "error", "message": "Both old_category and new_category are required"}, status=400)

        if old_category == new_category:
            return web.json_response({"status": "ok", "message": "Category name unchanged", "renamed_count": 0})

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            renamed_count = 0

            for prompt_data in metadata.values():
                if prompt_data.get('category', '') == old_category:
                    prompt_data['category'] = new_category
                    renamed_count += 1

                if 'category_favorites' in prompt_data:
                    updated_favorites = _replace_category_refs(
                        prompt_data.get('category_favorites', []),
                        old_category,
                        new_category,
                    )
                    if updated_favorites != prompt_data.get('category_favorites', []):
                        prompt_data['category_favorites'] = updated_favorites

            if renamed_count == 0:
                return web.json_response({"status": "error", "message": f"No prompts found in category '{old_category}'"}, status=404)

            transaction.commit()
            _rename_category_prefs(old_category, new_category)

        return web.json_response({
            "status": "ok",
            "message": f"Moved {renamed_count} prompt(s) from '{old_category}' to '{new_category}'",
            "renamed_count": renamed_count,
        })

    except Exception as e:
        print(f"Error renaming category: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/create_prompt")
async def create_prompt_endpoint(request):
    try:
        data = await request.json()
        name = data.get('name', '')
        prompt_text = data.get('prompt_text', '')
        category = data.get('category', '')

        if not name:
            return web.json_response({"status": "error", "message": "Name is required"}, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            prompt_id = generate_unique_prompt_id(metadata, name)
            prompt_data = {
                'name': name,
                'prompt_text': prompt_text,
                'category': category,
                'created_at': time.time(),
                'preview_type': None,
                'favorite': False
            }
            metadata[prompt_id] = prompt_data
            transaction.commit()

        return web.json_response({
            "status": "ok",
            "prompt_id": prompt_id,
            "prompt": prompt_response(prompt_id, prompt_data, include_usage=True),
        })

    except Exception as e:
        print(f"Error creating prompt: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/create_prompt_from_output")
async def create_prompt_from_output_endpoint(request):
    try:
        data = await request.json()
        name = data.get('name', '')
        prompt_text = data.get('prompt_text', '')
        category = data.get('category', '')
        last_output = data.get('last_output') or {}

        if not name:
            return web.json_response({"status": "error", "message": "Name is required"}, status=400)
        if not prompt_text:
            return web.json_response({"status": "error", "message": "Prompt text is required"}, status=400)

        source_path, safe_filename = resolve_comfy_output_path(
            last_output.get('filename'),
            last_output.get('subfolder', ''),
            last_output.get('type', 'output'),
        )

        ext = os.path.splitext(safe_filename)[1].lower()
        if ext in IMAGE_EXTENSIONS:
            preview_type = 'image'
        elif ext in VIDEO_EXTENSIONS:
            preview_type = 'video'
        else:
            return web.json_response({"status": "error", "message": "Unsupported file type"}, status=400)

        preview_version = int(time.time())
        prompt_data = {
            'name': name,
            'prompt_text': prompt_text,
            'category': category,
            'created_at': time.time(),
            'preview_type': preview_type,
            'preview_version': preview_version,
            'favorite': False
        }

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            prompt_id = generate_unique_prompt_id(metadata, name)
            target_path = os.path.join(THUMBNAILS_DIR, f"{prompt_id}{ext}")
            temp_target_path = f"{target_path}.{int(time.time() * 1000)}.tmp"

            try:
                shutil.copy2(source_path, temp_target_path)
                os.replace(temp_target_path, target_path)
                metadata[prompt_id] = prompt_data
                transaction.commit()
            except Exception:
                for cleanup_path in (temp_target_path, target_path):
                    try:
                        if os.path.exists(cleanup_path):
                            os.remove(cleanup_path)
                    except Exception:
                        pass
                raise

        return web.json_response({
            "status": "ok",
            "prompt_id": prompt_id,
            "prompt": prompt_response(prompt_id, prompt_data, include_usage=True),
        })

    except Exception as e:
        print(f"Error creating prompt from output: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/delete_prompt")
async def delete_prompt_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            if prompt_id in metadata:
                thumbnail_paths = find_thumbnail_paths(prompt_id)
                del metadata[prompt_id]
                transaction.commit()
                for thumb_path in thumbnail_paths:
                    backup_and_remove_thumbnail(thumb_path)
                return web.json_response({"status": "ok"})

            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)

    except Exception as e:
        print(f"Error deleting prompt: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/delete_prompts_bulk")
async def delete_prompts_bulk_endpoint(request):
    try:
        data = await request.json()
        prompt_ids = data.get('prompt_ids', [])

        if not isinstance(prompt_ids, list) or not prompt_ids:
            return web.json_response({"status": "error", "message": "prompt_ids must be a non-empty list"}, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            deleted_count = 0
            missing_ids = []
            thumbnail_paths = []

            for prompt_id in prompt_ids:
                if prompt_id not in metadata:
                    missing_ids.append(prompt_id)
                    continue

                thumbnail_paths.extend(find_thumbnail_paths(prompt_id))
                del metadata[prompt_id]
                deleted_count += 1

            if deleted_count:
                transaction.commit()
            for thumb_path in thumbnail_paths:
                backup_and_remove_thumbnail(thumb_path)
        return web.json_response({
            "status": "ok",
            "deleted_count": deleted_count,
            "missing_ids": missing_ids,
        })

    except Exception as e:
        print(f"Error bulk deleting prompts: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/upload_thumbnail")
async def upload_thumbnail_endpoint(request):
    try:
        reader = await request.multipart()
        prompt_id = None
        file_data = None
        filename = None

        async for field in reader:
            if field.name == 'prompt_id':
                prompt_id = (await field.read()).decode('utf-8')
            elif field.name == 'file':
                filename = field.filename
                file_data = await field.read()

        if not prompt_id or not file_data:
            return web.json_response({"status": "error", "message": "Missing data"}, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata

            if prompt_id not in metadata:
                return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)

            # Determine file extension
            ext = os.path.splitext(filename)[1].lower()
            if ext in IMAGE_EXTENSIONS:
                preview_type = 'image'
            elif ext in VIDEO_EXTENSIONS:
                preview_type = 'video'
            else:
                return web.json_response({"status": "error", "message": "Unsupported file type"}, status=400)

            old_thumbnail_paths = find_thumbnail_paths(prompt_id)

            # Save new thumbnail
            thumb_path = _safe_thumbnail_path(prompt_id, ext)
            if thumb_path is None:
                return web.json_response({"status": "error", "message": "Invalid prompt id"}, status=400)
            temp_thumb_path = f"{thumb_path}.{int(time.time() * 1000)}.tmp"
            try:
                with open(temp_thumb_path, 'wb') as f:
                    f.write(file_data)
                    f.flush()
                    os.fsync(f.fileno())
                for old_path in old_thumbnail_paths:
                    if old_path != thumb_path:
                        backup_and_remove_thumbnail(old_path)
                    elif os.path.exists(old_path):
                        backup_json_file(old_path)
                os.replace(temp_thumb_path, thumb_path)

                metadata[prompt_id]['preview_type'] = preview_type
                metadata[prompt_id]['preview_version'] = int(time.time())
                transaction.commit()
            except Exception:
                try:
                    if os.path.exists(temp_thumb_path):
                        os.remove(temp_thumb_path)
                except Exception:
                    pass
                raise

        return web.json_response({"status": "ok", "preview_type": preview_type})

    except Exception as e:
        print(f"Error uploading thumbnail: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/assign_thumbnail")
async def assign_thumbnail_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        filename = data.get('filename')
        subfolder = data.get('subfolder', '')
        folder_type = data.get('type', 'output') # output or temp

        if not prompt_id or not filename:
            return web.json_response({"status": "error", "message": "Missing data"}, status=400)

        with MetadataTransaction() as transaction:
            try:
                preview_type = assign_thumbnail_files(
                    transaction.metadata,
                    prompt_id,
                    filename,
                    subfolder,
                    folder_type,
                )
            except KeyError:
                return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
            except ValueError as e:
                return web.json_response({"status": "error", "message": str(e)}, status=400)
            transaction.commit()

        return web.json_response({"status": "ok", "preview_type": preview_type})

    except Exception as e:
        print(f"Error assigning thumbnail: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


def _assign_thumbnails_batch_sync(by_prompt_id):
    """Run batch thumbnail assignment off the asyncio event loop."""
    results = []
    attached_count = 0
    with MetadataTransaction() as transaction:
        for prompt_id, item in by_prompt_id.items():
            try:
                preview_type = assign_thumbnail_files(
                    transaction.metadata,
                    prompt_id,
                    item["filename"],
                    item["subfolder"],
                    item["type"],
                )
                results.append({
                    "prompt_id": prompt_id,
                    "status": "ok",
                    "preview_type": preview_type,
                })
                attached_count += 1
            except KeyError:
                results.append({
                    "prompt_id": prompt_id,
                    "status": "error",
                    "message": "Prompt not found",
                })
            except FileNotFoundError as e:
                results.append({
                    "prompt_id": prompt_id,
                    "status": "error",
                    "message": str(e),
                })
            except ValueError as e:
                results.append({
                    "prompt_id": prompt_id,
                    "status": "error",
                    "message": str(e),
                })
            except Exception as e:
                results.append({
                    "prompt_id": prompt_id,
                    "status": "error",
                    "message": str(e),
                })

        if attached_count > 0:
            transaction.commit()

    return {
        "status": "ok",
        "attached_count": attached_count,
        "results": results,
    }


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/assign_thumbnails_batch")
async def assign_thumbnails_batch_endpoint(request):
    """Assign many thumbnails in one metadata transaction.

    Used by deferred wildcard auto-attach so long sequential queues do one
    large metadata rewrite at the end instead of one per image.
    Heavy disk work runs in a worker thread so the PromptServer event loop
    (and sampling progress) are not blocked.
    """
    try:
        data = await request.json()
        assignments = data.get("assignments")
        if not isinstance(assignments, list) or not assignments:
            return web.json_response({"status": "error", "message": "assignments list is required"}, status=400)

        # Latest assignment wins per prompt card.
        by_prompt_id = {}
        for item in assignments:
            if not isinstance(item, dict):
                continue
            prompt_id = str(item.get("prompt_id") or "").strip()
            filename = item.get("filename")
            if not prompt_id or not filename:
                continue
            by_prompt_id[prompt_id] = {
                "prompt_id": prompt_id,
                "filename": filename,
                "subfolder": item.get("subfolder", "") or "",
                "type": item.get("type", "output") or "output",
            }

        if not by_prompt_id:
            return web.json_response({"status": "error", "message": "No valid assignments"}, status=400)

        # Refuse to thrash the 30MB metadata file while a generation is active.
        if _comfy_queue_busy():
            return web.json_response({
                "status": "busy",
                "message": "ComfyUI queue is active; try again when idle",
                "attached_count": 0,
                "results": [],
            }, status=503)

        try:
            payload = await asyncio.to_thread(_assign_thumbnails_batch_sync, by_prompt_id)
        except AttributeError:
            # Python < 3.9 fallback (Comfy commonly ships 3.10+, but be safe).
            loop = asyncio.get_event_loop()
            payload = await loop.run_in_executor(None, _assign_thumbnails_batch_sync, by_prompt_id)

        return web.json_response(payload)

    except Exception as e:
        print(f"Error batch assigning thumbnails: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/thumbnail/{prompt_id}")
async def serve_thumbnail(request):
    try:
        prompt_id = request.match_info['prompt_id']
        width = snap_card_width(request.query.get('w'))
        for ext in IMAGE_EXTENSIONS + VIDEO_EXTENSIONS:
            thumb_path = _safe_thumbnail_path(prompt_id, ext)
            if thumb_path is not None and os.path.exists(thumb_path):
                if width and ext in RESIZABLE_EXTENSIONS:
                    try:
                        thumb_path = await asyncio.to_thread(card_thumbnail_path, thumb_path, CARD_THUMBNAILS_DIR, width)
                    except (OSError, ValueError) as e:
                        print(f"Error resizing thumbnail {thumb_path}, serving original: {e}")
                return web.FileResponse(thumb_path)

        return web.Response(status=404)

    except Exception as e:
        print(f"Error serving thumbnail: {e}")
        return web.Response(status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/delete_category")
async def delete_category_endpoint(request):
    """Delete all prompts in a category"""
    try:
        data = await request.json()
        category = data.get('category')

        if not category:
            return web.json_response({"status": "error", "message": "Category is required"}, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata

            # Find all prompts in this category
            prompts_to_delete = [
                prompt_id for prompt_id, prompt_data in metadata.items()
                if prompt_data.get('category', '') == category
            ]

            if not prompts_to_delete:
                return web.json_response({"status": "error", "message": "No prompts found in this category"}, status=404)

            deleted_count = 0
            thumbnail_paths = []
            for prompt_id in prompts_to_delete:
                thumbnail_paths.extend(find_thumbnail_paths(prompt_id))
                del metadata[prompt_id]
                deleted_count += 1

            transaction.commit()
            for thumb_path in thumbnail_paths:
                backup_and_remove_thumbnail(thumb_path)
        return web.json_response({
            "status": "ok",
            "message": f"Deleted {deleted_count} prompts from category '{category}'"
        })

    except Exception as e:
        print(f"Error deleting category: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/toggle_favorite")
async def toggle_favorite_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        category = data.get('category')

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata

            if prompt_id in metadata:
                if category:
                    cat_favs = metadata[prompt_id].get('category_favorites', [])
                    if category in cat_favs:
                        cat_favs.remove(category)
                        is_fav = False
                    else:
                        cat_favs.append(category)
                        is_fav = True
                    metadata[prompt_id]['category_favorites'] = cat_favs
                    transaction.commit()
                    return web.json_response({"status": "ok", "favorite": is_fav, "category": category})
                else:
                    current_favorite = metadata[prompt_id].get('favorite', False)
                    metadata[prompt_id]['favorite'] = not current_favorite
                    transaction.commit()
                    return web.json_response({"status": "ok", "favorite": not current_favorite})

            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
    except Exception as e:
        print(f"Error toggling favorite: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/set_favorite_color")
async def set_favorite_color_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        color = data.get('color')  # hex string like "#ff6b6b" or None to clear

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata

            if prompt_id in metadata:
                if color:
                    metadata[prompt_id]['favorite_color'] = color
                elif 'favorite_color' in metadata[prompt_id]:
                    del metadata[prompt_id]['favorite_color']
                transaction.commit()
                return web.json_response({"status": "ok", "color": color})

            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
    except Exception as e:
        print(f"Error setting favorite color: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_ui_prefs")
async def get_ui_prefs_endpoint(request):
    """Get UI preferences"""
    try:
        prefs = load_ui_prefs()
        return web.json_response(prefs)
    except Exception as e:
        print(f"Error getting UI prefs: {e}")
        return web.json_response(copy.deepcopy(UI_PREF_DEFAULTS), status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/save_ui_prefs")
async def save_ui_prefs_endpoint(request):
    """Save UI preferences"""
    try:
        data = await request.json()
        prefs = load_ui_prefs()

        if not isinstance(data, dict):
            return web.json_response({"status": "error", "message": "UI prefs payload must be an object"}, status=400)

        for key, value in data.items():
            validator = UI_PREF_VALIDATORS.get(key)
            if validator:
                prefs[key] = validator(value, prefs)

        if "cards_display_mode" in data:
            prefs["display_mode"] = prefs["cards_display_mode"]
        elif "display_mode" in data:
            prefs["cards_display_mode"] = prefs["display_mode"]

        save_ui_prefs(prefs)
        return web.json_response({"status": "ok"})
    except Exception as e:
        print(f"Error saving UI prefs: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

# ========== PRESET ENDPOINTS ==========

@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_presets")
async def get_presets_endpoint(request):
    """Get all saved presets"""
    try:
        presets = load_presets()
        # Return as list of {name, ...} for frontend
        preset_list = [{"name": name, **data} for name, data in presets.items()]
        return web.json_response({"presets": preset_list})
    except Exception as e:
        print(f"Error getting presets: {e}")
        return web.json_response({"status": "error", "message": str(e), "presets": []}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/save_preset")
async def save_preset_endpoint(request):
    """Save a new preset or update existing"""
    try:
        data = await request.json()
        name = data.get("name", "").strip()

        if not name:
            return web.json_response({"status": "error", "message": "Preset name is required"}, status=400)

        with _json_file_lock:
            presets = load_presets()
            presets[name] = {
                "selection": data.get("selection", []),
                "wildcard_mode": data.get("wildcard_mode", "off"),
                "wildcard_categories": data.get("wildcard_categories", []),
                "wildcard_auto_attach_thumbnail": data.get("wildcard_auto_attach_thumbnail", "off"),
            }
            save_presets(presets)

        return web.json_response({"status": "ok", "message": f"Preset '{name}' saved"})
    except Exception as e:
        print(f"Error saving preset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/load_preset")
async def load_preset_endpoint(request):
    """Load a specific preset by name"""
    try:
        data = await request.json()
        name = data.get("name", "").strip()

        if not name:
            return web.json_response({"status": "error", "message": "Preset name is required"}, status=400)

        presets = load_presets()

        if name not in presets:
            return web.json_response({"status": "error", "message": f"Preset '{name}' not found"}, status=404)

        preset = presets[name]
        return web.json_response({
            "status": "ok",
            "preset": {
                "name": name,
                "selection": preset.get("selection", []),
                "wildcard_mode": preset.get("wildcard_mode", "off"),
                "wildcard_categories": preset.get("wildcard_categories", []),
                "wildcard_auto_attach_thumbnail": preset.get("wildcard_auto_attach_thumbnail", "off"),
            }
        })
    except Exception as e:
        print(f"Error loading preset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/delete_preset")
async def delete_preset_endpoint(request):
    """Delete a preset by name"""
    try:
        data = await request.json()
        name = data.get("name", "").strip()

        if not name:
            return web.json_response({"status": "error", "message": "Preset name is required"}, status=400)

        with _json_file_lock:
            presets = load_presets()

            if name not in presets:
                return web.json_response({"status": "error", "message": f"Preset '{name}' not found"}, status=404)

            del presets[name]
            save_presets(presets)

        return web.json_response({"status": "ok", "message": f"Preset '{name}' deleted"})
    except Exception as e:
        print(f"Error deleting preset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/upload_wildcard_file")
async def upload_wildcard_file_endpoint(request):
    try:
        reader = await request.multipart()
        file_data = None
        filename = None

        async for field in reader:
            if field.name == 'file':
                filename = field.filename
                file_data = await field.read()

        if not file_data or not filename:
            return web.json_response({"status": "error", "message": "No file uploaded"}, status=400)

        # Security check: filename
        filename = os.path.basename(filename)
        if not filename:
            return web.json_response({"status": "error", "message": "Invalid filename"}, status=400)
        save_path = os.path.join(WILDCARDS_DIR, filename)

        temp_save_path = f"{save_path}.{int(time.time() * 1000)}.tmp"
        try:
            with open(temp_save_path, 'wb') as f:
                f.write(file_data)
                f.flush()
                os.fsync(f.fileno())
            backup_json_file(save_path)
            os.replace(temp_save_path, save_path)
        except Exception:
            try:
                if os.path.exists(temp_save_path):
                    os.remove(temp_save_path)
            except Exception:
                pass
            raise

        return web.json_response({"status": "ok", "filename": filename})

    except Exception as e:
        print(f"Error uploading wildcard file: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/import_wildcard_file")
async def import_wildcard_file_endpoint(request):
    try:
        data = await request.json()
        filename = data.get('filename')
        category = data.get('category', 'Imported')

        if not filename:
             return web.json_response({"status": "error", "message": "Filename required"}, status=400)

        filename = os.path.basename(filename)
        file_path = os.path.join(WILDCARDS_DIR, filename)
        if not os.path.exists(file_path):
            return web.json_response({"status": "error", "message": "File not found"}, status=404)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            count = 0

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
            except UnicodeDecodeError:
                 with open(file_path, 'r', encoding='latin-1') as f:
                    lines = f.readlines()

            for line_index, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue

                # Generate ID
                prompt_id = str(uuid.uuid4())

                # Generate Name (first 5 words)
                words = line.split()
                name = " ".join(words[:5])
                if len(words) > 5:
                    name += "..."

                metadata[prompt_id] = {
                    'name': name,
                    'prompt_text': line,
                    'category': category,
                    'created_at': time.time(),
                    'wildcard_order': line_index,
                    'preview_type': None,
                    'favorite': False
                }
                count += 1

            transaction.commit()

        return web.json_response({"status": "ok", "message": f"Imported {count} prompts into '{category}'."})

    except Exception as e:
        print(f"Error importing wildcard file: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/export_wildcard_category")
async def export_wildcard_category_endpoint(request):
    try:
        data = await request.json()
        category = str(data.get("category", "")).strip()
        filename = data.get("filename", "")
        destination = str(data.get("destination", "comfy") or "comfy").strip().lower()

        if not category:
            return web.json_response({"status": "error", "message": "Category required"}, status=400)

        metadata = load_metadata()
        indexes = get_metadata_indexes()
        if category not in indexes.get("category_ids", {}):
            return web.json_response({"status": "error", "message": f"Category '{category}' not found"}, status=404)

        prefs = load_ui_prefs()
        lines = build_wildcard_export_lines(metadata, prefs, category)
        if not lines:
            return web.json_response({"status": "error", "message": f"Category '{category}' has no exportable prompts"}, status=400)

        rel_path = _sanitize_wildcard_relpath(filename or category)
        if not rel_path:
            return web.json_response({"status": "error", "message": "Invalid wildcard filename"}, status=400)

        content = "\n".join(lines) + "\n"
        wildcard_token = f"__{rel_path}__"

        if destination == "download":
            return web.json_response({
                "status": "ok",
                "category": category,
                "filename": f"{rel_path}.txt",
                "wildcard_token": wildcard_token,
                "line_count": len(lines),
                "content": content,
            })

        wildcards_dir = os.path.abspath(get_comfy_wildcards_dir())
        os.makedirs(wildcards_dir, exist_ok=True)
        save_path = os.path.abspath(os.path.join(wildcards_dir, f"{rel_path.replace('/', os.sep)}.txt"))
        try:
            contained = os.path.commonpath([wildcards_dir, save_path]) == wildcards_dir
        except ValueError:
            contained = False
        if not contained:
            return web.json_response({"status": "error", "message": "Invalid wildcard filename"}, status=400)
        save_dir = os.path.dirname(save_path)
        if save_dir:
            os.makedirs(save_dir, exist_ok=True)

        temp_save_path = f"{save_path}.{int(time.time() * 1000)}.tmp"
        try:
            with open(temp_save_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            backup_json_file(save_path)
            os.replace(temp_save_path, save_path)
        except Exception:
            try:
                if os.path.exists(temp_save_path):
                    os.remove(temp_save_path)
            except Exception:
                pass
            raise

        return web.json_response({
            "status": "ok",
            "message": f"Exported {len(lines)} lines to {save_path}",
            "category": category,
            "filename": f"{rel_path}.txt",
            "save_path": save_path,
            "wildcard_token": wildcard_token,
            "line_count": len(lines),
        })
    except Exception as e:
        print(f"Error exporting wildcard category: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/get_or_create_prompts")
async def get_or_create_prompts_endpoint(request):
    try:
        data = await request.json()
        prompts = data.get('prompts', [])

        if not prompts or not isinstance(prompts, list):
            return web.json_response({"status": "error", "message": "List of prompts is required"}, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            indexes = build_metadata_indexes(metadata)
            name_to_id = dict(indexes.get("name_to_id", {}))

            results = []
            needs_save = False

            for prompt_name in prompts:
                prompt_name_clean = prompt_name.strip()
                if not prompt_name_clean:
                    continue

                prompt_name_lower = prompt_name_clean.lower()

                if prompt_name_lower in name_to_id:
                    # Exists
                    prompt_id = name_to_id[prompt_name_lower]
                    prompt_data = metadata[prompt_id]
                    results.append({
                        "id": prompt_id,
                        "prompt_id": prompt_id,
                        "name": prompt_data.get('name', prompt_name_clean),
                        "prompt_text": prompt_data.get('prompt_text', prompt_name_clean),
                        "category": prompt_data.get('category', '')
                    })
                else:
                    # Create it
                    prompt_text = prompt_name_clean
                    prompt_id = hashlib.md5(prompt_name_clean.encode()).hexdigest()[:8]

                    # Ensure unique ID
                    counter = 1
                    original_id = prompt_id
                    while prompt_id in metadata:
                        prompt_id = f"{original_id}_{counter}"
                        counter += 1

                    metadata[prompt_id] = {
                        'name': prompt_name_clean,
                        'prompt_text': prompt_text,
                        'category': 'Combo',
                        'created_at': time.time(),
                        'preview_type': None,
                        'favorite': False
                    }

                    name_to_id[prompt_name_lower] = prompt_id
                    needs_save = True

                    results.append({
                        "id": prompt_id,
                        "prompt_id": prompt_id,
                        "name": prompt_name_clean,
                        "prompt_text": prompt_text,
                        "category": 'Combo'
                    })

            if needs_save:
                transaction.commit()

        return web.json_response({"status": "ok", "prompts": results})

    except Exception as e:
        print(f"Error in get_or_create_prompts: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

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
        global _ui_prefs_cache

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
            with _json_file_lock:
                if _ui_prefs_cache is None:
                    load_ui_prefs()
                _ui_prefs_cache["wildcard_cycle_state"] = wildcard_cycle_state
            _schedule_wildcard_cycle_state_flush(wildcard_cycle_state)

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
