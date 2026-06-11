import os
import threading
import json
import copy
import folder_paths
import server
from aiohttp import web
import urllib.parse
import hashlib
import uuid
import shutil
import time

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(NODE_DIR, "..", "data", "prompt_gallery"))
METADATA_FILE = os.path.join(DATA_DIR, "prompt_gallery_metadata.json")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
DELETED_THUMBNAILS_DIR = os.path.join(BACKUP_DIR, "deleted_thumbnails")
UI_STATE_FILE = os.path.join(DATA_DIR, "prompt_gallery_ui_state.json")
PRESETS_FILE = os.path.join(DATA_DIR, "prompt_gallery_presets.json")
UI_PREFS_FILE = os.path.join(DATA_DIR, "prompt_gallery_prefs.json")
THUMBNAILS_DIR = os.path.join(DATA_DIR, "prompt_thumbnails")
WILDCARDS_DIR = os.path.join(DATA_DIR, "wildcards")

# Module-level cache
_metadata_cache = None
_metadata_mtime = 0
_metadata_indexes_cache = None
_metadata_indexes_mtime = 0
_json_file_lock = threading.RLock()

# Deferred usage-count saving
_pending_usage = {}
_usage_flush_timer = None
_USAGE_FLUSH_DELAY = 30  # seconds

def _flush_usage_counts():
    """Merge pending usage counts into metadata and save to disk."""
    global _pending_usage, _usage_flush_timer
    if not _pending_usage:
        return
    try:
        with _json_file_lock:
            metadata = copy.deepcopy(load_metadata())
            for pid, count in _pending_usage.items():
                if pid in metadata:
                    metadata[pid]['usage_count'] = metadata[pid].get('usage_count', 0) + count
            save_metadata(metadata)
            _pending_usage = {}
    except Exception as e:
        print(f"LocalPromptGallery: failed to flush usage counts: {e}")
    finally:
        _usage_flush_timer = None

def _schedule_usage_flush():
    """Debounce: reset the timer each time so we only write once after activity stops."""
    global _usage_flush_timer
    if _usage_flush_timer is not None:
        _usage_flush_timer.cancel()
    _usage_flush_timer = threading.Timer(_USAGE_FLUSH_DELAY, _flush_usage_counts)
    _usage_flush_timer.daemon = True
    _usage_flush_timer.start()

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
    try:
        if not os.path.exists(METADATA_FILE):
            return {}
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
    save_json_file(data, METADATA_FILE)
    _metadata_cache = data
    _metadata_mtime = os.path.getmtime(METADATA_FILE)
    _metadata_indexes_cache = None
    _metadata_indexes_mtime = 0

def generate_unique_prompt_id(metadata, name):
    prompt_id = hashlib.md5(name.encode()).hexdigest()[:8]
    original_id = prompt_id
    counter = 1
    while prompt_id in metadata:
        prompt_id = f"{original_id}_{counter}"
        counter += 1
    return prompt_id

def find_thumbnail_paths(prompt_id):
    return [
        os.path.join(THUMBNAILS_DIR, f"{prompt_id}{ext}")
        for ext in IMAGE_EXTENSIONS + VIDEO_EXTENSIONS
        if os.path.exists(os.path.join(THUMBNAILS_DIR, f"{prompt_id}{ext}"))
    ]

def backup_and_remove_thumbnail(path):
    try:
        timestamp = time.strftime("%Y%m%d-%H%M%S") + f"-{int((time.time() % 1) * 1000):03d}"
        target = os.path.join(DELETED_THUMBNAILS_DIR, f"{timestamp}-{os.path.basename(path)}")
        shutil.move(path, target)
    except Exception as e:
        print(f"Error moving thumbnail backup {path}: {e}")

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

def build_metadata_indexes(metadata):
    category_ids = {}
    favorite_ids = []
    used_ids = []
    name_to_id = {}

    for prompt_id, data in metadata.items():
        category = data.get('category', '')
        if category:
            category_ids.setdefault(category, []).append(prompt_id)

        if data.get('favorite', False):
            favorite_ids.append(prompt_id)

        if data.get('usage_count', 0) > 0:
            used_ids.append(prompt_id)

        name = data.get('name', '')
        if name:
            name_to_id[name.lower()] = prompt_id

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
        "used_ids": used_ids,
        "name_to_id": name_to_id,
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
        preview_url = f"/localpromptgallery/thumbnail/{prompt_id}?v={preview_version}"

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
    if include_usage:
        response['usage_count'] = data.get('usage_count', 0)
    return response

def load_ui_prefs():
    defaults = {
        "display_mode": "thumbnails",
        "most_used_count": 10,
        "library_tabs": ["most_used", "pinned"],
        "library_tab_layout": "scroll",
        "thumbnail_size": "medium",
        "thumbnail_size_px": 96,
        "active_thumbnail_size_px": 96,
        "pinned_categories": None,
        "visible_pinned_category_count": 5,
        "pinned_order": [],
        "prompt_manual_orders": {},
        "category_colors": {},
        "active_sidebar_open": False,
        "active_sidebar_width": 392,
        "active_sidebar_hover_open": True,
        "auto_hide_toolbars": False,
        "show_most_used": True,
        "prompt_sort_mode": "manual",
        "prompt_sort_modes": {},
        "meta_tags_button_side": "right",
        "wildcard_cycle_state": {},
        "last_created_category": "",
        "from_last_output_name_default": "time",
        "active_border_theme": "default",
        "active_border_custom_1": "#ff0000",
        "active_border_custom_2": "#0000ff",
        "promote_selected_prompts": True,
        "card_contrast_mode": "off",
    }
    prefs = load_json_file(UI_PREFS_FILE, defaults)
    if not isinstance(prefs, dict):
        return defaults

    if "thumbnail_size_px" not in prefs:
        legacy_thumbnail_sizes = {
            "small": 81,
            "medium": 96,
            "large": 115,
        }
        prefs["thumbnail_size_px"] = legacy_thumbnail_sizes.get(prefs.get("thumbnail_size"), defaults["thumbnail_size_px"])
    if "active_thumbnail_size_px" not in prefs:
        prefs["active_thumbnail_size_px"] = prefs.get("thumbnail_size_px", defaults["active_thumbnail_size_px"])

    merged = {**defaults, **prefs}
    if merged != prefs:
        save_json_file(merged, UI_PREFS_FILE)
    return merged
save_ui_prefs = lambda data: save_json_file(data, UI_PREFS_FILE)
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

@server.PromptServer.instance.routes.get("/localpromptgallery/get_prompts")
async def get_prompts_endpoint(request):
    try:
        filter_name = request.query.get('filter_name', '')
        mode = request.query.get('mode', 'OR')
        category = request.query.get('category', '')
        sort_mode = request.query.get('sort', request.query.get('sort_mode', 'manual'))

        # Treat UI label as no filter
        if category == 'All Categories':
            category = ''

        favorites_only_raw = request.query.get('favorites_only', '0').lower()
        favorites_only = favorites_only_raw in ('1', 'true', 'yes', 'on')

        page = int(request.query.get('page', 1))
        per_page = int(request.query.get('per_page', 30))

        # Safety clamp
        if per_page < 1:
            per_page = 1
        if per_page > 200:
            per_page = 200

        selected_prompts = request.query.getall('selected_prompts', [])

        metadata = load_metadata()
        indexes = get_metadata_indexes()
        prefs = load_ui_prefs()
        manual_order_scope = get_prompt_manual_order_scope(category, favorites_only)
        prompt_manual_orders = prefs.get("prompt_manual_orders", {})
        manual_order = prompt_manual_orders.get(manual_order_scope, []) if isinstance(prompt_manual_orders, dict) else []
        if favorites_only:
            candidate_ids = list(indexes.get("favorite_ids", []))
        elif category:
            candidate_ids = list(indexes.get("category_ids", {}).get(category, []))
        else:
            candidate_ids = list(metadata.keys())

        ordered_candidate_ids = sort_prompt_ids_for_display(metadata, candidate_ids, sort_mode, manual_order)

        selected_set = set(selected_prompts)

        if not filter_name:
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

        prompts = []

        for prompt_id in candidate_ids:
            data = metadata.get(prompt_id)
            if not data:
                continue

            prompt_text = data.get('prompt_text', '')

            # Filter by name/prompt_text
            if filter_name:
                filter_lower = filter_name.lower()
                name_lower = data.get('name', '').lower()
                prompt_text_lower = prompt_text.lower()

                # Check if filter text is found in name or prompt_text
                if (filter_lower not in name_lower and 
                    filter_lower not in prompt_text_lower):
                    continue

            prompts.append(prompt_response(prompt_id, data, include_usage=True))

        prompts_by_id = {prompt['id']: prompt for prompt in prompts}
        ordered_filtered_ids = [
            prompt_id for prompt_id in ordered_candidate_ids
            if prompt_id in prompts_by_id
        ]
        if selected_set:
            selected_ids = [prompt_id for prompt_id in ordered_filtered_ids if prompt_id in selected_set]
            ordered_filtered_ids = selected_ids + [
                prompt_id for prompt_id in ordered_filtered_ids
                if prompt_id not in selected_set
            ]
        prompts = [prompts_by_id[prompt_id] for prompt_id in ordered_filtered_ids]

        # Pagination
        total_prompts = len(prompts)
        total_pages = max(1, (total_prompts + per_page - 1) // per_page)
        page = max(1, min(page, total_pages))
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_prompts = prompts[start_idx:end_idx]

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

@server.PromptServer.instance.routes.get("/localpromptgallery/get_prompt")
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
            preview_url = f"/localpromptgallery/thumbnail/{prompt_id}?v={preview_version}"
            
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
            'usage_count': data.get('usage_count', 0)
        }
        return web.json_response({"status": "ok", "prompt": prompt})

    except Exception as e:
        print(f"Error in get_prompt_endpoint: {e}")
        return web.json_response({'status': 'error', 'message': str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/get_prompts_by_ids")
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

@server.PromptServer.instance.routes.get("/localpromptgallery/get_categories")
async def get_categories_endpoint(request):
    try:
        indexes = get_metadata_indexes()
        return web.json_response({'categories': indexes.get("categories", [])})
    except Exception as e:
        print(f"Error getting categories: {e}")
        return web.json_response({'status': 'error', 'message': str(e), 'categories': []}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/update_metadata")
async def update_metadata_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        
        metadata = copy.deepcopy(load_metadata())

        if prompt_id not in metadata:
            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
        
        if 'name' in data:
            metadata[prompt_id]['name'] = data['name']
        if 'prompt_text' in data:
            metadata[prompt_id]['prompt_text'] = data['prompt_text']
        if 'category' in data:
            metadata[prompt_id]['category'] = data['category']
        
        save_metadata(metadata)
        return web.json_response({
            "status": "ok",
            "prompt": prompt_response(prompt_id, metadata[prompt_id], include_usage=True)
        })
    
    except Exception as e:
        print(f"Error updating metadata: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localpromptgallery/rename_category")
async def rename_category_endpoint(request):
    try:
        data = await request.json()
        old_category = str(data.get('old_category', '')).strip()
        new_category = str(data.get('new_category', '')).strip()

        if not old_category or not new_category:
            return web.json_response({"status": "error", "message": "Both old_category and new_category are required"}, status=400)

        if old_category == new_category:
            return web.json_response({"status": "ok", "message": "Category name unchanged", "renamed_count": 0})

        metadata = copy.deepcopy(load_metadata())
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

        save_metadata(metadata)
        _rename_category_prefs(old_category, new_category)

        return web.json_response({
            "status": "ok",
            "message": f"Moved {renamed_count} prompt(s) from '{old_category}' to '{new_category}'",
            "renamed_count": renamed_count,
        })

    except Exception as e:
        print(f"Error renaming category: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/create_prompt")
async def create_prompt_endpoint(request):
    try:
        data = await request.json()
        name = data.get('name', '')
        prompt_text = data.get('prompt_text', '')
        category = data.get('category', '')
        
        if not name:
            return web.json_response({"status": "error", "message": "Name is required"}, status=400)
        
        with _json_file_lock:
            metadata = copy.deepcopy(load_metadata())
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
            save_metadata(metadata)

        return web.json_response({
            "status": "ok",
            "prompt_id": prompt_id,
            "prompt": prompt_response(prompt_id, prompt_data, include_usage=True),
        })
    
    except Exception as e:
        print(f"Error creating prompt: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/create_prompt_from_output")
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

        with _json_file_lock:
            metadata = copy.deepcopy(load_metadata())
            prompt_id = generate_unique_prompt_id(metadata, name)
            target_path = os.path.join(THUMBNAILS_DIR, f"{prompt_id}{ext}")
            temp_target_path = f"{target_path}.{int(time.time() * 1000)}.tmp"

            try:
                shutil.copy2(source_path, temp_target_path)
                os.replace(temp_target_path, target_path)
                metadata[prompt_id] = prompt_data
                save_metadata(metadata)
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

@server.PromptServer.instance.routes.post("/localpromptgallery/delete_prompt")
async def delete_prompt_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        
        metadata = copy.deepcopy(load_metadata())

        if prompt_id in metadata:
            thumbnail_paths = find_thumbnail_paths(prompt_id)
            del metadata[prompt_id]
            save_metadata(metadata)
            for thumb_path in thumbnail_paths:
                backup_and_remove_thumbnail(thumb_path)
            return web.json_response({"status": "ok"})
        
        return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
    
    except Exception as e:
        print(f"Error deleting prompt: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/delete_prompts_bulk")
async def delete_prompts_bulk_endpoint(request):
    try:
        data = await request.json()
        prompt_ids = data.get('prompt_ids', [])

        if not isinstance(prompt_ids, list) or not prompt_ids:
            return web.json_response({"status": "error", "message": "prompt_ids must be a non-empty list"}, status=400)

        metadata = copy.deepcopy(load_metadata())
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

        save_metadata(metadata)
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

@server.PromptServer.instance.routes.post("/localpromptgallery/upload_thumbnail")
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
        
        metadata = copy.deepcopy(load_metadata())

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
        thumb_path = os.path.join(THUMBNAILS_DIR, f"{prompt_id}{ext}")
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
            save_metadata(metadata)
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

@server.PromptServer.instance.routes.post("/localpromptgallery/assign_thumbnail")
async def assign_thumbnail_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        filename = data.get('filename')
        subfolder = data.get('subfolder', '')
        folder_type = data.get('type', 'output') # output or temp
        
        if not prompt_id or not filename:
            return web.json_response({"status": "error", "message": "Missing data"}, status=400)

        metadata = copy.deepcopy(load_metadata())
        if prompt_id not in metadata:
            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)

        source_path, filename = resolve_comfy_output_path(filename, subfolder, folder_type)

        # Determine file extension and type
        ext = os.path.splitext(filename)[1].lower()
        if ext in IMAGE_EXTENSIONS:
            preview_type = 'image'
        elif ext in VIDEO_EXTENSIONS:
            preview_type = 'video'
        else:
            return web.json_response({"status": "error", "message": "Unsupported file type"}, status=400)

        # Copy new thumbnail
        old_thumbnail_paths = find_thumbnail_paths(prompt_id)
        target_path = os.path.join(THUMBNAILS_DIR, f"{prompt_id}{ext}")
        temp_target_path = f"{target_path}.{int(time.time() * 1000)}.tmp"
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
            save_metadata(metadata)
        except Exception:
            try:
                if os.path.exists(temp_target_path):
                    os.remove(temp_target_path)
            except Exception:
                pass
            raise
        
        return web.json_response({"status": "ok", "preview_type": preview_type})

    except Exception as e:
        print(f"Error assigning thumbnail: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/localpromptgallery/thumbnail/{prompt_id}")
async def serve_thumbnail(request):
    try:
        prompt_id = request.match_info['prompt_id']
        
        for ext in IMAGE_EXTENSIONS + VIDEO_EXTENSIONS:
            thumb_path = os.path.join(THUMBNAILS_DIR, f"{prompt_id}{ext}")
            if os.path.exists(thumb_path):
                return web.FileResponse(thumb_path)
        
        return web.Response(status=404)
    
    except Exception as e:
        print(f"Error serving thumbnail: {e}")
        return web.Response(status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/delete_category")
async def delete_category_endpoint(request):
    """Delete all prompts in a category"""
    try:
        data = await request.json()
        category = data.get('category')
        
        if not category:
            return web.json_response({"status": "error", "message": "Category is required"}, status=400)
        
        metadata = copy.deepcopy(load_metadata())

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

        save_metadata(metadata)
        for thumb_path in thumbnail_paths:
            backup_and_remove_thumbnail(thumb_path)
        return web.json_response({
            "status": "ok", 
            "message": f"Deleted {deleted_count} prompts from category '{category}'"
        })
    
    except Exception as e:
        print(f"Error deleting category: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/toggle_favorite")
async def toggle_favorite_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        category = data.get('category')
        
        metadata = copy.deepcopy(load_metadata())

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
                save_metadata(metadata)
                return web.json_response({"status": "ok", "favorite": is_fav, "category": category})
            else:
                current_favorite = metadata[prompt_id].get('favorite', False)
                metadata[prompt_id]['favorite'] = not current_favorite
                save_metadata(metadata)
                return web.json_response({"status": "ok", "favorite": not current_favorite})
        
        return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
    except Exception as e:
        print(f"Error toggling favorite: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/set_favorite_color")
async def set_favorite_color_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        color = data.get('color')  # hex string like "#ff6b6b" or None to clear
        
        metadata = copy.deepcopy(load_metadata())

        if prompt_id in metadata:
            if color:
                metadata[prompt_id]['favorite_color'] = color
            elif 'favorite_color' in metadata[prompt_id]:
                del metadata[prompt_id]['favorite_color']
            save_metadata(metadata)
            return web.json_response({"status": "ok", "color": color})
        
        return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
    except Exception as e:
        print(f"Error setting favorite color: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/localpromptgallery/get_most_used")
async def get_most_used_endpoint(request):
    """Get the most frequently used prompts"""
    try:
        count = int(request.query.get('count', 10))
        count = max(1, min(count, 50))  # Clamp between 1 and 50
        
        metadata = load_metadata()
        indexes = get_metadata_indexes()
        
        # Merge any pending (not-yet-flushed) usage counts for accurate reading
        pending_snapshot = dict(_pending_usage)
        
        # Get all prompts with their usage counts
        prompts_with_usage = []
        candidate_ids = set(indexes.get("used_ids", [])) | set(pending_snapshot.keys())
        for prompt_id in candidate_ids:
            data = metadata.get(prompt_id)
            if not data:
                continue
            usage_count = data.get('usage_count', 0) + pending_snapshot.get(prompt_id, 0)
            if usage_count > 0:  # Only include prompts that have been used
                prompt = prompt_response(prompt_id, data, include_usage=False)
                prompt['usage_count'] = usage_count
                prompts_with_usage.append(prompt)
        
        # Sort by usage count descending
        prompts_with_usage.sort(key=lambda p: p['usage_count'], reverse=True)
        
        # Return top N
        return web.json_response({'prompts': prompts_with_usage[:count]})
    except Exception as e:
        print(f"Error getting most used prompts: {e}")
        return web.json_response({'status': 'error', 'message': str(e), 'prompts': []}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/reset_usage_count")
async def reset_usage_count_endpoint(request):
    """Reset usage count for a prompt to 0"""
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        
        if not prompt_id:
            return web.json_response({"status": "error", "message": "prompt_id is required"}, status=400)
        
        metadata = copy.deepcopy(load_metadata())

        if prompt_id not in metadata:
            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
        
        metadata[prompt_id]['usage_count'] = 0
        save_metadata(metadata)
        
        return web.json_response({"status": "ok", "message": "Usage count reset"})
    except Exception as e:
        print(f"Error resetting usage count: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/localpromptgallery/get_ui_prefs")
async def get_ui_prefs_endpoint(request):
    """Get UI preferences"""
    try:
        prefs = load_ui_prefs()
        return web.json_response(prefs)
    except Exception as e:
        print(f"Error getting UI prefs: {e}")
        return web.json_response({
            "display_mode": "thumbnails",
            "most_used_count": 10,
            "library_tabs": ["most_used", "pinned"],
            "library_tab_layout": "scroll",
            "thumbnail_size": "medium",
            "thumbnail_size_px": 96,
            "active_thumbnail_size_px": 96,
            "pinned_categories": None,
            "visible_pinned_category_count": 5,
            "pinned_order": [],
            "prompt_manual_orders": {},
            "category_colors": {},
            "active_sidebar_open": False,
            "active_sidebar_hover_open": True,
            "auto_hide_toolbars": False,
            "prompt_sort_mode": "manual",
            "prompt_sort_modes": {},
            "meta_tags_button_side": "right",
            "from_last_output_name_default": "time",
        }, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/save_ui_prefs")
async def save_ui_prefs_endpoint(request):
    """Save UI preferences"""
    try:
        data = await request.json()
        prefs = load_ui_prefs()
        
        # Update only provided fields
        if 'display_mode' in data:
            prefs['display_mode'] = data['display_mode']
        if 'most_used_count' in data:
            prefs['most_used_count'] = int(data['most_used_count'])
        if 'show_most_used' in data:
            prefs['show_most_used'] = data['show_most_used']
        if 'library_tabs' in data:
            prefs['library_tabs'] = data['library_tabs']
        if 'library_tab_layout' in data:
            prefs['library_tab_layout'] = data['library_tab_layout'] if data['library_tab_layout'] in ('scroll', 'wrap') else 'scroll'
        if 'thumbnail_size' in data:
            prefs['thumbnail_size'] = data['thumbnail_size'] if data['thumbnail_size'] in ('small', 'medium', 'large') else 'medium'
        if 'thumbnail_size_px' in data:
            try:
                prefs['thumbnail_size_px'] = max(70, min(180, int(data['thumbnail_size_px'])))
            except (TypeError, ValueError):
                prefs['thumbnail_size_px'] = 96
        if 'active_thumbnail_size_px' in data:
            try:
                prefs['active_thumbnail_size_px'] = max(70, min(180, int(data['active_thumbnail_size_px'])))
            except (TypeError, ValueError):
                prefs['active_thumbnail_size_px'] = prefs.get('thumbnail_size_px', 96)
        if 'pinned_categories' in data:
            pinned_categories = data['pinned_categories'] if isinstance(data['pinned_categories'], list) else []
            prefs['pinned_categories'] = [str(item) for item in pinned_categories if item]
        if 'visible_pinned_category_count' in data:
            try:
                prefs['visible_pinned_category_count'] = max(1, min(20, int(data['visible_pinned_category_count'])))
            except (TypeError, ValueError):
                prefs['visible_pinned_category_count'] = 5
        if 'pinned_order' in data:
            prefs['pinned_order'] = [str(item) for item in data['pinned_order'] if item]
        if 'prompt_manual_orders' in data:
            manual_orders = data['prompt_manual_orders'] if isinstance(data['prompt_manual_orders'], dict) else {}
            prefs['prompt_manual_orders'] = {
                str(scope): [str(item) for item in ids if item]
                for scope, ids in manual_orders.items()
                if scope and isinstance(ids, list)
            }
        if 'category_colors' in data:
            color_map = data['category_colors'] if isinstance(data['category_colors'], dict) else {}
            prefs['category_colors'] = {
                str(category): str(color)
                for category, color in color_map.items()
                if category and isinstance(color, str) and color.strip()
            }
        if 'active_sidebar_open' in data:
            prefs['active_sidebar_open'] = bool(data['active_sidebar_open'])
        if 'active_sidebar_width' in data:
            try:
                prefs['active_sidebar_width'] = max(220, int(data['active_sidebar_width']))
            except (TypeError, ValueError):
                prefs['active_sidebar_width'] = 392
        if 'active_sidebar_hover_open' in data:
            prefs['active_sidebar_hover_open'] = data['active_sidebar_hover_open']
        if 'auto_hide_toolbars' in data:
            prefs['auto_hide_toolbars'] = bool(data['auto_hide_toolbars'])
        if 'promote_selected_prompts' in data:
            prefs['promote_selected_prompts'] = data['promote_selected_prompts']
        if 'prompt_sort_mode' in data:
            prefs['prompt_sort_mode'] = (
                data['prompt_sort_mode']
                if data['prompt_sort_mode'] in ('manual', 'newest', 'oldest', 'az', 'za')
                else 'manual'
            )
        if 'prompt_sort_modes' in data:
            sort_modes = data['prompt_sort_modes'] if isinstance(data['prompt_sort_modes'], dict) else {}
            prefs['prompt_sort_modes'] = {
                str(scope): mode
                for scope, mode in sort_modes.items()
                if scope and mode in ('manual', 'newest', 'oldest', 'az', 'za')
            }
        if 'meta_tags_button_side' in data:
            prefs['meta_tags_button_side'] = (
                data['meta_tags_button_side']
                if data['meta_tags_button_side'] in ('left', 'right')
                else 'right'
            )
        if 'from_last_output_name_default' in data:
            prefs['from_last_output_name_default'] = (
                data['from_last_output_name_default']
                if data['from_last_output_name_default'] in ('time', 'blank')
                else 'time'
            )
        if 'active_border_theme' in data:
            theme = data['active_border_theme']
            if theme in ('default', 'cyberpunk', 'sunset', 'aurora', 'ice', 'fire-ice', 'golden-mint', 'rainbow-sync', 'rainbow-split', 'custom'):
                prefs['active_border_theme'] = theme
        if 'active_border_custom_1' in data:
            color = str(data['active_border_custom_1']).strip()
            if color.startswith('#') and len(color) in (4, 7, 9):
                prefs['active_border_custom_1'] = color
        if 'active_border_custom_2' in data:
            color = str(data['active_border_custom_2']).strip()
            if color.startswith('#') and len(color) in (4, 7, 9):
                prefs['active_border_custom_2'] = color
        if 'card_contrast_mode' in data:
            mode = data['card_contrast_mode']
            if mode in ('off', 'dim_inactive', 'dim_by_default'):
                prefs['card_contrast_mode'] = mode
 
        save_ui_prefs(prefs)
        return web.json_response({"status": "ok"})
    except Exception as e:
        print(f"Error saving UI prefs: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

# ========== PRESET ENDPOINTS ==========

@server.PromptServer.instance.routes.get("/localpromptgallery/get_presets")
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

@server.PromptServer.instance.routes.post("/localpromptgallery/save_preset")
async def save_preset_endpoint(request):
    """Save a new preset or update existing"""
    try:
        data = await request.json()
        name = data.get("name", "").strip()
        
        if not name:
            return web.json_response({"status": "error", "message": "Preset name is required"}, status=400)
        
        presets = load_presets()
        presets[name] = {
            "selection": data.get("selection", []),
            "wildcard_mode": data.get("wildcard_mode", "off"),
            "wildcard_categories": data.get("wildcard_categories", [])
        }
        save_presets(presets)
        
        return web.json_response({"status": "ok", "message": f"Preset '{name}' saved"})
    except Exception as e:
        print(f"Error saving preset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/load_preset")
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
                "wildcard_categories": preset.get("wildcard_categories", [])
            }
        })
    except Exception as e:
        print(f"Error loading preset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/delete_preset")
async def delete_preset_endpoint(request):
    """Delete a preset by name"""
    try:
        data = await request.json()
        name = data.get("name", "").strip()
        
        if not name:
            return web.json_response({"status": "error", "message": "Preset name is required"}, status=400)
        
        presets = load_presets()
        
        if name not in presets:
            return web.json_response({"status": "error", "message": f"Preset '{name}' not found"}, status=404)
        
        del presets[name]
        save_presets(presets)
        
        return web.json_response({"status": "ok", "message": f"Preset '{name}' deleted"})
    except Exception as e:
        print(f"Error deleting preset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/upload_wildcard_file")
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

@server.PromptServer.instance.routes.post("/localpromptgallery/import_wildcard_file")
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
            
        metadata = copy.deepcopy(load_metadata())
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
            
        save_metadata(metadata)
        
        return web.json_response({"status": "ok", "message": f"Imported {count} prompts into '{category}'."})
        
    except Exception as e:
        print(f"Error importing wildcard file: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localpromptgallery/get_or_create_prompts")
async def get_or_create_prompts_endpoint(request):
    try:
        data = await request.json()
        prompts = data.get('prompts', [])
        
        if not prompts or not isinstance(prompts, list):
            return web.json_response({"status": "error", "message": "List of prompts is required"}, status=400)
            
        metadata = copy.deepcopy(load_metadata())
        indexes = get_metadata_indexes()
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
            save_metadata(metadata)
            
        return web.json_response({"status": "ok", "prompts": results})
        
    except Exception as e:
        print(f"Error in get_or_create_prompts: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

class LocalPromptGallery:
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
        **kwargs,
    ):
        return json.dumps(
            {
                "seed": seed,
                "selection_data": selection_data,
                "wildcard_categories": wildcard_categories,
                "wildcard_mode": wildcard_mode,
                "wildcard_rng_mode": wildcard_rng_mode,
                "wildcard_shuffle_nonce": wildcard_shuffle_nonce,
                "fresh_wildcard_nonce": time.time() if wildcard_mode != "off" and wildcard_rng_mode == "fresh" else "",
            },
            sort_keys=True,
        )
    
    def process(self, **kwargs):
        wildcard_categories = kwargs.get("wildcard_categories", "")
        wildcard_mode = kwargs.get("wildcard_mode", "off")
        wildcard_rng_mode = str(kwargs.get("wildcard_rng_mode", "seed_stable") or "seed_stable")
        wildcard_shuffle_nonce = str(kwargs.get("wildcard_shuffle_nonce", "0") or "0")
        seed = kwargs.get("seed", 0)
        try:
            seed_int = int(seed)
        except (TypeError, ValueError):
            seed_int = 0
        selection_data_str = kwargs.get("selection_data", "[]")

        try:
            selection_data = json.loads(selection_data_str)
        except:
            selection_data = []

        metadata = load_metadata()
        indexes = get_metadata_indexes()
        prefs = load_ui_prefs()
        wildcard_cycle_state = prefs.get("wildcard_cycle_state", {})
        wildcard_cycle_state_changed = False
        used_prompt_ids = []  # Track which prompts were used for usage counting

        # Start with manual selections (always processed)
        combined_parts = []
        for item in selection_data:
            if not item.get('on', True):
                continue

            prompt_id = item.get('prompt_id')
            weight = item.get('weight', 1.0)
            prompt_text = ""

            if prompt_id in metadata:
                prompt_text = metadata[prompt_id].get('prompt_text', '')
                if prompt_text:
                    used_prompt_ids.append(prompt_id)  # Track usage
            else:
                # Presets store a prompt name alongside the id. If an id went stale
                # after metadata recovery, use that stored text instead of silently
                # dropping the prompt from the generated output.
                prompt_text = str(item.get('prompt_text') or item.get('name') or '').strip()
                if prompt_text:
                    print(f"LocalPromptGallery: missing prompt id {prompt_id!r}; using preset fallback text")

            if prompt_text:
                try:
                    weight = float(weight)
                except (TypeError, ValueError):
                    weight = 1.0
                if weight != 1.0:
                    combined_parts.append(f"({prompt_text}:{weight:.1f})")
                else:
                    combined_parts.append(prompt_text)

        # If wildcard mode is enabled AND categories are set, add wildcard prompts
        if wildcard_mode != "off" and wildcard_categories:
            try:
                # Try to parse as JSON first (new format)
                parsed = json.loads(wildcard_categories)
                if isinstance(parsed, list):
                    if all(isinstance(x, str) for x in parsed):
                        categories_data = [{"category": cat, "weight": 1.0} for cat in parsed]
                    else:
                        categories_data = parsed
                else:
                    categories_data = []
            except (json.JSONDecodeError, TypeError):
                # Fallback to comma-separated string (old format)
                categories_data = [{"category": cat.strip(), "weight": 1.0} for cat in wildcard_categories.split(',') if cat.strip()]

            wildcard_prompts = []

            for cat_info in categories_data:
                category = cat_info.get("category", "")
                weight = cat_info.get("weight", 1.0)
                
                if not category:
                    continue

                category_prompt_ids = indexes.get("wildcard_category_ids", {}).get(category, [])

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

                    wildcard_cycle_state[category] = {
                        "last_seed": seed_int,
                        "last_index": current_index,
                        "mode": wildcard_rng_mode,
                    }
                    if wildcard_rng_mode == "shuffle":
                        wildcard_cycle_state[category]["shuffle_nonce"] = wildcard_shuffle_nonce
                    wildcard_cycle_state_changed = True
                    selected_prompt_id = ordered_prompt_ids[current_index]
                    selected_prompt = metadata.get(selected_prompt_id, {})

                    used_prompt_ids.append(selected_prompt_id)  # Track usage
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
        
        # Defer usage count updates (avoids writing 15MB JSON on every execution)
        if used_prompt_ids:
            for prompt_id in used_prompt_ids:
                _pending_usage[prompt_id] = _pending_usage.get(prompt_id, 0) + 1
            _schedule_usage_flush()

        if wildcard_cycle_state_changed:
            prefs["wildcard_cycle_state"] = wildcard_cycle_state
            save_ui_prefs(prefs)
        
        return {"ui": {"text": [combined_prompt]}, "result": (combined_prompt,)}

NODE_CLASS_MAPPINGS = {
    "LocalPromptGallery": LocalPromptGallery
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LocalPromptGallery": "Local Prompt Gallery"
}
