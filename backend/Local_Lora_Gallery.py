import os
import json
import glob
import folder_paths
import server
from aiohttp import web
from nodes import LoraLoader, LoraLoaderModelOnly
import urllib.parse
import hashlib
import aiohttp
import asyncio
import copy
import shutil
import tempfile
import time

try:
    from .value_utils import bounded_int, finite_float, parse_json_list
except ImportError:
    from value_utils import bounded_int, finite_float, parse_json_list
from urllib.parse import urlparse

NunchakuFluxLoraLoader = None
NunchakuQwenLoraLoader = None
is_nunchaku_flux_available = False
is_nunchaku_qwen_available = False

try:
    from nodes import NODE_CLASS_MAPPINGS
    
    if "NunchakuFluxLoraLoader" in NODE_CLASS_MAPPINGS:
        NunchakuFluxLoraLoader = NODE_CLASS_MAPPINGS["NunchakuFluxLoraLoader"]
        is_nunchaku_flux_available = True
        print("✅ Local Lora Gallery: Nunchaku Flux integration enabled.")
        
    if "NunchakuQwenImageLoraLoader" in NODE_CLASS_MAPPINGS:
        NunchakuQwenLoraLoader = NODE_CLASS_MAPPINGS["NunchakuQwenImageLoraLoader"]
        is_nunchaku_qwen_available = True
        print("✅ Local Lora Gallery: Nunchaku Qwen Image integration enabled.")
        
except Exception as e:
    print(f"INFO: Local Lora Gallery - Nunchaku nodes not found or failed to load. Running in standard mode. Error: {e}")

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(NODE_DIR, "..", "data", "lora_gallery"))
METADATA_FILE = os.path.join(DATA_DIR, "lora_gallery_metadata.json")
UI_STATE_FILE = os.path.join(DATA_DIR, "lora_gallery_ui_state.json")
PRESETS_FILE = os.path.join(DATA_DIR, "lora_gallery_presets.json")
PREVIEW_BACKUP_DIR = os.path.join(DATA_DIR, "preview_backups")
VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi']
IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
CIVITAI_API_BASE_URL = "https://civitai.com"
CIVITAI_WEB_BASE_URL = os.environ.get("LOCAL_LORA_GALLERY_CIVITAI_WEB_BASE_URL", "https://civitai.red").rstrip("/")
JSON_LOAD_FAILED_FILES = set()
MAX_JSON_BACKUPS = 10
# Derived, process-local browser state. It is never the source of truth and can
# always be rebuilt from the LoRA roots and metadata JSON.
_LORA_INVENTORY_CACHE = None
_EXECUTION_METADATA_CACHE = {"signature": None, "data": None}
_UI_STATE_LOCK = asyncio.Lock()
INVENTORY_FAST_CHECK_SECONDS = 0.75
INVENTORY_DEEP_CHECK_SECONDS = 5.0

def calculate_sha256(filepath):
    """Calculates the SHA256 hash of a file efficiently."""
    if not os.path.exists(filepath):
        return None
    hash_sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()

def default_json_data(default_data):
    return copy.deepcopy(default_data)

def backup_path_for(file_path):
    return f"{file_path}.bak"

def timestamped_backup_path_for(file_path):
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    millis = int((time.time() % 1) * 1000)
    return f"{file_path}.bak-{timestamp}-{millis:03d}"

def corrupt_path_for(file_path):
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    return f"{file_path}.corrupt-{timestamp}"

def prune_json_backups(file_path):
    backups = sorted(glob.glob(f"{file_path}.bak-*"), key=os.path.getmtime, reverse=True)
    for old_backup in backups[MAX_JSON_BACKUPS:]:
        try:
            os.remove(old_backup)
        except Exception as e:
            print(f"Error pruning old JSON backup {old_backup}: {e}")

def backup_existing_json_file(file_path):
    if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
        return

    shutil.copy2(file_path, backup_path_for(file_path))
    shutil.copy2(file_path, timestamped_backup_path_for(file_path))
    prune_json_backups(file_path)

def load_json_file(file_path, default_data=None):
    if default_data is None:
        default_data = {}

    if not os.path.exists(file_path):
        JSON_LOAD_FAILED_FILES.discard(file_path)
        return default_json_data(default_data)

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if not content:
                raise ValueError("File is empty")
            JSON_LOAD_FAILED_FILES.discard(file_path)
            return json.loads(content)
    except Exception as e:
        print(f"Error loading {file_path}: {e}")

        backup_path = backup_path_for(file_path)
        try:
            if os.path.exists(file_path):
                shutil.copy2(file_path, corrupt_path_for(file_path))
        except Exception as backup_error:
            print(f"Error preserving corrupt JSON file {file_path}: {backup_error}")

        if os.path.exists(backup_path):
            try:
                with open(backup_path, 'r', encoding='utf-8') as f:
                    restored_data = json.load(f)
                JSON_LOAD_FAILED_FILES.discard(file_path)
                print(f"Loaded backup JSON file for {file_path}.")
                return restored_data
            except Exception as backup_error:
                print(f"Error loading backup JSON file {backup_path}: {backup_error}")

        JSON_LOAD_FAILED_FILES.add(file_path)
        return default_json_data(default_data)

def save_json_file(data, file_path):
    if file_path in JSON_LOAD_FAILED_FILES:
        print(f"Refusing to save {file_path} because it failed to load and no usable backup was found.")
        return

    temp_path = None
    try:
        directory = os.path.dirname(file_path)
        os.makedirs(directory, exist_ok=True)

        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=directory, delete=False) as f:
            temp_path = f.name
            json.dump(data, f, indent=4, ensure_ascii=False)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())

        backup_existing_json_file(file_path)

        os.replace(temp_path, file_path)
    except Exception as e:
        print(f"Error saving {file_path}: {e}")
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

def _file_signature(file_path):
    try:
        stat = os.stat(file_path)
        return (stat.st_mtime_ns, stat.st_size)
    except OSError:
        return None

def invalidate_lora_inventory():
    global _LORA_INVENTORY_CACHE
    _LORA_INVENTORY_CACHE = None

def load_metadata():
    return load_json_file(METADATA_FILE)

def load_execution_metadata():
    """Read metadata once per on-disk revision for execution and change checks."""
    signature = _file_signature(METADATA_FILE)
    if _EXECUTION_METADATA_CACHE["signature"] != signature:
        _EXECUTION_METADATA_CACHE["data"] = load_metadata()
        _EXECUTION_METADATA_CACHE["signature"] = signature
    return _EXECUTION_METADATA_CACHE["data"] or {}

def save_metadata(data):
    save_json_file(data, METADATA_FILE)
    _EXECUTION_METADATA_CACHE["signature"] = _file_signature(METADATA_FILE)
    _EXECUTION_METADATA_CACHE["data"] = data
    invalidate_lora_inventory()

load_ui_state = lambda: load_json_file(UI_STATE_FILE)
save_ui_state = lambda data: save_json_file(data, UI_STATE_FILE)
load_presets = lambda: load_json_file(PRESETS_FILE)
save_presets = lambda data: save_json_file(data, PRESETS_FILE)

def lora_basename(lora_name):
    return os.path.basename(lora_name.replace("\\", os.sep).replace("/", os.sep)).lower()

def find_metadata_key_by_hash(metadata, model_hash, current_key=None):
    if not model_hash:
        return None

    for key, value in metadata.items():
        if key == current_key or not isinstance(value, dict):
            continue
        if value.get("hash") == model_hash:
            return key

    return None

def find_unique_metadata_key_by_basename(metadata, lora_name):
    basename = lora_basename(lora_name)
    matches = [
        key for key, value in metadata.items()
        if key != lora_name and isinstance(value, dict) and lora_basename(key) == basename
    ]
    return matches[0] if len(matches) == 1 else None

def build_metadata_basename_index(metadata):
    basename_index = {}
    duplicates = set()

    for key, value in metadata.items():
        if not isinstance(value, dict):
            continue

        basename = lora_basename(key)
        if basename in basename_index:
            duplicates.add(basename)
        else:
            basename_index[basename] = key

    for basename in duplicates:
        basename_index[basename] = None

    return basename_index

def find_unique_metadata_key_by_basename_index(basename_index, lora_name):
    old_key = basename_index.get(lora_basename(lora_name))
    return old_key if old_key != lora_name else None

def get_metadata_for_lora(
    metadata,
    lora_name,
    lora_full_path=None,
    migrate=True,
    ensure_hash=False,
    create_missing=False,
    allow_hash_lookup=False,
    basename_index=None,
):
    lora_meta = metadata.get(lora_name)
    metadata_changed = False

    if not isinstance(lora_meta, dict):
        lora_meta = None

    model_hash = lora_meta.get("hash") if lora_meta else None

    if lora_full_path and lora_meta is not None and ensure_hash:
        model_hash = calculate_sha256(lora_full_path)

    if lora_meta is None:
        if basename_index is not None:
            old_key = find_unique_metadata_key_by_basename_index(basename_index, lora_name)
        else:
            old_key = find_unique_metadata_key_by_basename(metadata, lora_name)

        if old_key is None and lora_full_path and (ensure_hash or allow_hash_lookup):
            model_hash = calculate_sha256(lora_full_path)
            old_key = find_metadata_key_by_hash(metadata, model_hash, lora_name)

        if old_key is not None:
            lora_meta = metadata[old_key]
            if migrate:
                metadata[lora_name] = lora_meta
                del metadata[old_key]
                if basename_index is not None:
                    basename_index[lora_basename(lora_name)] = lora_name
                metadata_changed = True
        else:
            lora_meta = {}
            if migrate and create_missing:
                metadata[lora_name] = lora_meta
                metadata_changed = True

    if model_hash and lora_meta.get("hash") != model_hash:
        lora_meta["hash"] = model_hash
        metadata_changed = True

    return lora_meta, metadata_changed

def get_lora_preview_asset_info(lora_name):
    """Finds a preview asset (image or video) for a given LoRA and returns its info."""
    lora_path = folder_paths.get_full_path("loras", lora_name)
    if lora_path is None:
        return None, "none"
    base_name, _ = os.path.splitext(lora_path)

    for ext in IMAGE_EXTENSIONS + VIDEO_EXTENSIONS:
        preview_path = base_name + ext
        if os.path.exists(preview_path):
            preview_filename = os.path.basename(preview_path)
            encoded_lora_name = urllib.parse.quote_plus(lora_name)
            encoded_filename = urllib.parse.quote_plus(preview_filename)
            preview_revision = os.stat(preview_path).st_mtime_ns
            url = (
                f"/localgalleryunified/lora/preview?filename={encoded_filename}"
                f"&lora_name={encoded_lora_name}&v={preview_revision}"
            )
            
            preview_type = "none"
            if ext.lower() in VIDEO_EXTENSIONS:
                preview_type = "video"
            elif ext.lower() in IMAGE_EXTENSIONS:
                preview_type = "image"
            
            return url, preview_type

    return None, "none"

def resolve_comfy_preview_source(filename, subfolder='', folder_type='output'):
    """Resolve a Comfy output while keeping the request inside output or temp."""
    filename = os.path.basename(str(filename or ''))
    subfolder = os.path.normpath(str(subfolder or ''))
    if not filename or os.path.isabs(subfolder) or subfolder.startswith(".."):
        raise ValueError("Invalid source path")

    base_dir = (
        folder_paths.get_temp_directory()
        if folder_type == 'temp'
        else folder_paths.get_output_directory()
    )
    base_dir_abs = os.path.abspath(base_dir)
    source_path = os.path.abspath(os.path.join(base_dir_abs, subfolder, filename))
    if os.path.commonpath([base_dir_abs, source_path]) != base_dir_abs:
        raise ValueError("Invalid source path")

    if not os.path.exists(source_path):
        source_path = os.path.abspath(os.path.join(base_dir_abs, filename))
        if not os.path.exists(source_path):
            raise FileNotFoundError(f"Source file not found at {source_path}")

    return source_path, filename

def assign_lora_preview_file(lora_name, filename, subfolder='', folder_type='output'):
    """Copy the latest Comfy result beside a LoRA and back up replaced previews."""
    lora_full_path = folder_paths.get_full_path("loras", lora_name)
    if not lora_full_path:
        raise KeyError(f"LoRA not found: {lora_name}")

    source_path, resolved_filename = resolve_comfy_preview_source(
        filename,
        subfolder,
        folder_type,
    )
    extension = os.path.splitext(resolved_filename)[1].lower()
    if extension in IMAGE_EXTENSIONS:
        preview_type = "image"
    elif extension in VIDEO_EXTENSIONS:
        preview_type = "video"
    else:
        raise ValueError(f"Unsupported file type: {extension or '(none)'}")

    preview_base, _ = os.path.splitext(lora_full_path)
    target_path = preview_base + extension
    existing_paths = [
        preview_base + candidate_extension
        for candidate_extension in IMAGE_EXTENSIONS + VIDEO_EXTENSIONS
        if os.path.exists(preview_base + candidate_extension)
    ]
    temp_target = None
    moved_backups = []
    try:
        with tempfile.NamedTemporaryFile(
            "wb",
            dir=os.path.dirname(lora_full_path),
            delete=False,
        ) as temp_file:
            temp_target = temp_file.name
            with open(source_path, "rb") as source_file:
                shutil.copyfileobj(source_file, temp_file)
            temp_file.flush()
            os.fsync(temp_file.fileno())

        timestamp = time.strftime("%Y%m%d-%H%M%S") + f"-{int((time.time() % 1) * 1000):03d}"
        os.makedirs(PREVIEW_BACKUP_DIR, exist_ok=True)
        for index, existing_path in enumerate(existing_paths):
            backup_name = f"{timestamp}-{index}-{os.path.basename(existing_path)}"
            backup_path = os.path.join(PREVIEW_BACKUP_DIR, backup_name)
            shutil.move(existing_path, backup_path)
            moved_backups.append((existing_path, backup_path))

        os.replace(temp_target, target_path)
        temp_target = None
        invalidate_lora_inventory()
        preview_url, _ = get_lora_preview_asset_info(lora_name)
        return preview_url, preview_type
    except Exception:
        if temp_target and os.path.exists(temp_target):
            os.remove(temp_target)
        for original_path, backup_path in reversed(moved_backups):
            if os.path.exists(backup_path) and not os.path.exists(original_path):
                shutil.move(backup_path, original_path)
        raise

def _lora_root_signature(roots):
    return tuple((os.path.normcase(os.path.abspath(root)), _file_signature(root)) for root in roots)

def _build_lora_inventory(lora_files, lora_roots, generation):
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
        "metadata_signature": _file_signature(METADATA_FILE),
    }

def get_lora_inventory():
    """Return normalized browser data, rebuilding only when its source changes.

    Root/list checks are intentionally cheap. A periodic conservative rebuild also
    catches nested asset and preview changes that do not update a root directory mtime.
    """
    global _LORA_INVENTORY_CACHE
    now = time.monotonic()
    cache = _LORA_INVENTORY_CACHE
    if cache and cache["metadata_signature"] == _file_signature(METADATA_FILE) and now - cache["checked_at"] < INVENTORY_FAST_CHECK_SECONDS:
        return cache
    lora_files = folder_paths.get_filename_list("loras")
    lora_roots = folder_paths.get_folder_paths("loras")
    generation = (tuple(lora_files), _lora_root_signature(lora_roots))
    if not cache or cache["generation"] != generation or cache["metadata_signature"] != _file_signature(METADATA_FILE):
        _LORA_INVENTORY_CACHE = _build_lora_inventory(lora_files, lora_roots, generation)
        return _LORA_INVENTORY_CACHE
    cache["checked_at"] = now
    if now - cache["deep_checked_at"] >= INVENTORY_DEEP_CHECK_SECONDS:
        _LORA_INVENTORY_CACHE = _build_lora_inventory(lora_files, lora_roots, generation)
    return _LORA_INVENTORY_CACHE

@server.PromptServer.instance.routes.post("/localgalleryunified/lora/sync_civitai")
async def sync_civitai_metadata(request):
    try:
        data = await request.json()
        lora_name = data.get("lora_name")
        if not lora_name:
            return web.json_response({"status": "error", "message": "Missing lora_name"}, status=400)

        lora_full_path = folder_paths.get_full_path("loras", lora_name)
        if not lora_full_path:
            return web.json_response({"status": "error", "message": "LoRA file not found"}, status=404)

        metadata = load_metadata()
        lora_meta, metadata_changed = get_metadata_for_lora(metadata, lora_name, lora_full_path, ensure_hash=True, create_missing=True)
        
        model_hash = lora_meta.get('hash')
        if not model_hash:
            print(f"Local Lora Gallery: Calculating hash for {lora_name}...")
            model_hash = calculate_sha256(lora_full_path)
            if model_hash:
                lora_meta['hash'] = model_hash
                metadata_changed = True
            else:
                 return web.json_response({"status": "error", "message": "Failed to calculate hash"}, status=500)

        if metadata_changed:
            save_metadata(metadata)

        civitai_version_url = f"{CIVITAI_API_BASE_URL}/api/v1/model-versions/by-hash/{model_hash}"
        async with aiohttp.ClientSession() as session:
            async with session.get(civitai_version_url) as response:
                if response.status != 200:
                    return web.json_response({"status": "error", "message": f"Civitai API (version) returned {response.status}. Model not found or API error."}, status=response.status)
                
                civitai_version_data = await response.json()
                model_id = civitai_version_data.get('modelId')
                if not model_id:
                    return web.json_response({"status": "error", "message": "Could not find modelId in Civitai API response."}, status=500)

            # civitai_model_url = f"{CIVITAI_API_BASE_URL}/api/v1/models/{model_id}"
            # async with session.get(civitai_model_url) as response:
            #     if response.status != 200:
            #         print(f"Local Lora Gallery: Warning - Could not fetch model details for tags. Status: {response.status}")
            #         civitai_model_data = {}
            #     else:
            #         civitai_model_data = await response.json()

            images = civitai_version_data.get('images', [])
            if not images:
                print("Local Lora Gallery: No preview images found on Civitai, but will save other metadata.")
            else:
                preview_media = next((img for img in images if img.get('type') == 'image'), images[0])
                preview_url = preview_media.get('url')
                is_video = preview_media.get('type') == 'video'

                try:
                    if is_video:
                        if '/original=true/' in preview_url:
                            temp_url = preview_url.replace('/original=true/', '/transcode=true,width=450,optimized=true/')
                            final_url = os.path.splitext(temp_url)[0] + '.webm'
                        else:
                            url_obj = urlparse(preview_url)
                            path_parts = url_obj.path.split('/')
                            filename = path_parts.pop()
                            filename_base = os.path.splitext(filename)[0]
                            new_path = f"{'/'.join(path_parts)}/transcode=true,width=450,optimized=true/{filename_base}.webm"
                            final_url = url_obj._replace(path=new_path).geturl()
                        file_ext = '.webm'
                    else:
                        if '/original=true/' in preview_url:
                           final_url = preview_url.replace('/original=true/', '/width=450/')
                        else:
                            final_url = preview_url.replace('/width=\d+/', '/width=450/') if '/width=' in preview_url else preview_url.replace(urlparse(preview_url).path, f"/width=450{urlparse(preview_url).path}")

                        path = urlparse(final_url).path
                        file_ext = os.path.splitext(path)[1]
                        if not file_ext or file_ext.lower() not in IMAGE_EXTENSIONS:
                            file_ext = '.jpg'
                except Exception as e:
                    print(f"Local Lora Gallery: Failed to parse or modify URL '{preview_url}'. Error: {e}")
                    final_url = preview_url
                    file_ext = '.jpg' if not is_video else '.mp4'

                lora_dir = os.path.dirname(lora_full_path)
                lora_basename = os.path.splitext(os.path.basename(lora_full_path))[0]
                save_path = os.path.join(lora_dir, lora_basename + file_ext)

                async with session.get(final_url) as download_response:
                    if download_response.status != 200:
                        print(f"Local Lora Gallery: Warning - Failed to download preview from {final_url}. Proceeding without preview.")
                    else:
                        temp_preview_path = None
                        try:
                            with tempfile.NamedTemporaryFile('wb', dir=lora_dir, delete=False) as f:
                                temp_preview_path = f.name
                                while True:
                                    chunk = await download_response.content.read(8192)
                                    if not chunk:
                                        break
                                    f.write(chunk)
                                f.flush()
                                os.fsync(f.fileno())
                            os.replace(temp_preview_path, save_path)
                            temp_preview_path = None
                        finally:
                            if temp_preview_path and os.path.exists(temp_preview_path):
                                os.remove(temp_preview_path)
                        print(f"Local Lora Gallery: Successfully downloaded preview to '{save_path}'")

            trained_words = civitai_version_data.get('trainedWords', [])
            # Network and download operations above may take long enough for a user to
            # edit metadata concurrently. Reload before saving so sync only merges its
            # own fields instead of overwriting the newer file with a stale snapshot.
            metadata = load_metadata()
            lora_meta, _ = get_metadata_for_lora(
                metadata,
                lora_name,
                lora_full_path,
                ensure_hash=False,
                create_missing=True,
            )
            lora_meta['hash'] = model_hash
            if trained_words:
                lora_meta['trigger_words'] = ", ".join(trained_words)
            
            lora_meta['download_url'] = f"{CIVITAI_WEB_BASE_URL}/models/{model_id}"

            # tags = set(lora_meta.get('tags', []))
            # if 'tags' in civitai_model_data:
            #     for tag in civitai_model_data['tags']:
            #         tags.add(tag)
            # lora_meta['tags'] = sorted(list(tags))
            
            save_metadata(metadata)
            
            new_local_url, new_preview_type = get_lora_preview_asset_info(lora_name)
            
            return web.json_response({
                "status": "ok", 
                "metadata": { "preview_url": new_local_url, "preview_type": new_preview_type, **lora_meta }
            })

    except Exception as e:
        import traceback
        print(f"Error in sync_civitai_metadata: {traceback.format_exc()}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/localgalleryunified/lora/get_presets")
async def get_presets(request):
    presets = load_presets()
    return web.json_response(presets)

@server.PromptServer.instance.routes.post("/localgalleryunified/lora/save_preset")
async def save_preset(request):
    try:
        data = await request.json()
        preset_name = data.get("name")
        preset_data = data.get("data")
        if not preset_name or not preset_data:
            return web.json_response({"status": "error", "message": "Missing preset name or data"}, status=400)
        
        presets = load_presets()
        presets[preset_name] = preset_data
        save_presets(presets)
        return web.json_response({"status": "ok", "presets": presets})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/lora/delete_preset")
async def delete_preset(request):
    try:
        data = await request.json()
        preset_name = data.get("name")
        if not preset_name:
            return web.json_response({"status": "error", "message": "Missing preset name"}, status=400)
        
        presets = load_presets()
        if preset_name in presets:
            del presets[preset_name]
            save_presets(presets)
        return web.json_response({"status": "ok", "presets": presets})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/localgalleryunified/lora/get_loras")
async def get_loras_endpoint(request):
    try:
        filter_tags_str = request.query.get('filter_tag', '').strip().lower()
        filter_tags = [tag.strip() for tag in filter_tags_str.split(',') if tag.strip()]
        filter_mode = request.query.get('mode', 'OR').upper()
        filter_folder = request.query.get('folder', '').strip()
        selected_loras = request.query.getall('selected_loras', [])
        sort_mode = request.query.get('sort', request.query.get('sort_mode', 'az')).strip().lower()
        if sort_mode not in ('az', 'za', 'newest', 'oldest'):
            sort_mode = 'az'
        
        page = bounded_int(request.query.get('page', 1), 1, 1, 1_000_000)
        per_page = bounded_int(request.query.get('per_page', 50), 50, 1, 200)

        inventory = get_lora_inventory()
        filtered_entries = []
        for entry in inventory["entries"]:
            if filter_folder and filter_folder != entry["folder"]:
                continue
            tags = [str(tag).lower() for tag in entry["tags"]]
            if filter_tags and not (
                all(tag in tags for tag in filter_tags) if filter_mode == "AND"
                else any(tag in tags for tag in filter_tags)
            ):
                continue
            filtered_entries.append(entry)

        selected_order = {name: index for index, name in enumerate(selected_loras)}
        pinned_items = [entry for entry in filtered_entries if entry["name"] in selected_order]
        pinned_items.sort(key=lambda entry: selected_order[entry["name"]])
        remaining_items = [entry for entry in filtered_entries if entry["name"] not in selected_order]
        if sort_mode == "za":
            remaining_items.sort(key=lambda entry: (entry["name_sort"], entry["name"]), reverse=True)
        elif sort_mode == "newest":
            remaining_items.sort(key=lambda entry: (entry["mtime"], entry["name_sort"]), reverse=True)
        elif sort_mode == "oldest":
            remaining_items.sort(key=lambda entry: (entry["mtime"], entry["name_sort"]))
        else:
            remaining_items.sort(key=lambda entry: (entry["name_sort"], entry["name"]))
        final_lora_list = pinned_items + remaining_items

        total_loras = len(final_lora_list)
        total_pages = (total_loras + per_page - 1) // per_page
        start_index = (page - 1) * per_page
        end_index = start_index + per_page
        paginated_loras = final_lora_list[start_index:end_index]

        lora_info_list = []
        for entry in paginated_loras:
            lora_info_list.append({
                "name": entry["name"],
                "preview_url": entry["preview_url"],
                "preview_type": entry["preview_type"],
                "tags": entry["tags"],
                "trigger_words": entry["trigger_words"],
                "trigger_presets": entry["trigger_presets"],
                "download_url": entry["download_url"],
            })
        
        return web.json_response({
            "loras": lora_info_list, 
            "folders": inventory["folders"],
            "total_pages": total_pages,
            "current_page": page
        })
    except Exception as e:
        import traceback
        print(f"Error in get_loras_endpoint: {traceback.format_exc()}")
        return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/localgalleryunified/lora/preview")
async def get_preview_image(request):
    filename = request.query.get('filename')
    lora_name = request.query.get('lora_name')

    if not filename or not lora_name or ".." in filename or "/" in filename or "\\" in filename:
        return web.Response(status=403)
    
    try:
        lora_name_decoded = urllib.parse.unquote_plus(lora_name)
        filename_decoded = urllib.parse.unquote_plus(filename)

        lora_full_path = folder_paths.get_full_path("loras", lora_name_decoded)
        if not lora_full_path:
            return web.Response(status=404, text=f"Lora '{lora_name_decoded}' not found.")
        
        image_path = os.path.join(os.path.dirname(lora_full_path), filename_decoded)
        if os.path.exists(image_path):
            return web.FileResponse(image_path)
        else:
            return web.Response(status=404, text=f"Preview '{filename_decoded}' not found.")
            
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/lora/assign_thumbnail")
async def assign_lora_thumbnail(request):
    try:
        data = await request.json()
        lora_name = data.get("lora_name")
        filename = data.get("filename")
        subfolder = data.get("subfolder", "")
        folder_type = data.get("type", "output")

        if not lora_name or not filename:
            return web.json_response(
                {"status": "error", "message": "Missing LoRA name or output filename"},
                status=400,
            )

        try:
            preview_url, preview_type = await asyncio.to_thread(
                assign_lora_preview_file,
                lora_name,
                filename,
                subfolder,
                folder_type,
            )
        except KeyError as error:
            return web.json_response({"status": "error", "message": str(error)}, status=404)
        except (ValueError, FileNotFoundError) as error:
            return web.json_response({"status": "error", "message": str(error)}, status=400)

        return web.json_response({
            "status": "ok",
            "preview_url": preview_url,
            "preview_type": preview_type,
        })
    except Exception as e:
        print(f"Error assigning LoRA thumbnail: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/lora/set_ui_state")
async def set_ui_state(request):
    try:
        data = await request.json()
        node_id = str(data.get("node_id"))
        gallery_id = data.get("gallery_id")
        state = data.get("state", {})

        if not gallery_id: return web.Response(status=400)

        node_key = f"{gallery_id}_{node_id}"
        # Multiple node instances can persist at once. Serialize the read/merge/write
        # transaction so atomic replacement cannot still lose a sibling's update.
        async with _UI_STATE_LOCK:
            ui_states = load_ui_state()
            if node_key not in ui_states:
                ui_states[node_key] = {}
            ui_states[node_key].update(state)
            save_ui_state(ui_states)
        return web.json_response({"status": "ok"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/localgalleryunified/lora/get_ui_state")
async def get_ui_state(request):
    try:
        node_id = request.query.get('node_id')
        gallery_id = request.query.get('gallery_id')

        if not node_id or not gallery_id:
            return web.json_response({"error": "node_id or gallery_id is required"}, status=400)

        node_key = f"{gallery_id}_{node_id}"
        ui_states = load_ui_state()
        node_state = ui_states.get(node_key, {"is_collapsed": False})
        return web.json_response(node_state)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/localgalleryunified/lora/update_metadata")
async def update_lora_metadata(request):
    try:
        data = await request.json()
        lora_name = data.get("lora_name")
        tags = data.get("tags")
        trigger_words = data.get("trigger_words")
        download_url = data.get("download_url")

        if not lora_name:
            return web.json_response({"status": "error", "message": "Missing lora_name"}, status=400)
        
        lora_full_path = folder_paths.get_full_path("loras", lora_name)
        metadata = load_metadata()
        lora_meta, _ = get_metadata_for_lora(metadata, lora_name, lora_full_path, ensure_hash=bool(lora_full_path), create_missing=True)
        
        if tags is not None:
            lora_meta['tags'] = [str(tag).strip() for tag in tags if str(tag).strip()]
        
        if trigger_words is not None:
            lora_meta['trigger_words'] = str(trigger_words)
            
        trigger_presets = data.get("trigger_presets")
        if trigger_presets is not None:
            lora_meta['trigger_presets'] = trigger_presets

        if download_url is not None:
            lora_meta['download_url'] = str(download_url)

        save_metadata(metadata)
        return web.json_response({"status": "ok"})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)
    
@server.PromptServer.instance.routes.get("/localgalleryunified/lora/get_all_tags")
async def get_all_tags(request):
    try:
        metadata = load_metadata()
        all_tags = set(
            tag
            for item_meta in metadata.values()
            if isinstance(item_meta, dict) and isinstance(item_meta.get("tags"), list)
            for tag in item_meta["tags"]
        )
        return web.json_response({"tags": sorted(list(all_tags), key=lambda s: s.lower())})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)

class BaseLoraGallery:
    """Base class for common functionality."""

    @staticmethod
    def _get_selected_trigger_preset_names(config):
        selected_presets = config.get('selected_presets')
        if isinstance(selected_presets, list):
            names = [name for name in selected_presets if isinstance(name, str) and name]
            # Empty list must fall through to selected_preset (single-select path).
            if names:
                return names

        selected_preset = config.get('selected_preset')
        if isinstance(selected_preset, str) and selected_preset:
            return [selected_preset]
        if selected_preset and not isinstance(selected_preset, (list, dict)):
            return [str(selected_preset)]

        return []

    @classmethod
    def _get_trigger_words_for_config(cls, lora_meta, config):
        triggers = lora_meta.get('trigger_words', '').strip()
        preset_names = cls._get_selected_trigger_preset_names(config)
        if not preset_names:
            return triggers

        presets = lora_meta.get('trigger_presets', {})
        preset_triggers = [
            presets[preset_name].strip()
            for preset_name in preset_names
            if preset_name in presets and isinstance(presets[preset_name], str) and presets[preset_name].strip()
        ]
        return ", ".join(preset_triggers) if preset_triggers else triggers

    @staticmethod
    def _parse_selection_data(selection_data):
        return parse_json_list(selection_data)

    @staticmethod
    def _float_config_value(config, key, fallback):
        return finite_float(config.get(key, fallback), fallback)

    @classmethod
    def MODEL_CHANGED(cls, selection_data, **kwargs):
        model_state = []
        for config in cls._parse_selection_data(selection_data):
            if not isinstance(config, dict) or not config.get('on', True) or not config.get('lora'):
                continue

            strength_model = cls._float_config_value(config, 'strength', 1.0)
            strength_clip = cls._float_config_value(config, 'strength_clip', strength_model)
            if strength_model == 0 and strength_clip == 0:
                continue

            model_state.append({
                "lora": str(config.get('lora')),
                "strength": strength_model,
                "strength_clip": strength_clip,
            })

        return json.dumps(model_state, sort_keys=True)

    @classmethod
    def get_trigger_words_for_selection(cls, selection_data):
        all_metadata = load_execution_metadata()
        trigger_words_list = []

        for config in cls._parse_selection_data(selection_data):
            if not isinstance(config, dict) or not config.get('on', True) or not config.get('lora'):
                continue

            lora_name = config['lora']
            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
            if metadata_changed:
                save_metadata(all_metadata)

            triggers = cls._get_trigger_words_for_config(lora_meta, config)
            if triggers:
                trigger_words_list.append(triggers)

        return ", ".join(trigger_words_list)
    
    @classmethod
    def IS_CHANGED(cls, selection_data, **kwargs):
        lora_configs = cls._parse_selection_data(selection_data)

        all_metadata = load_execution_metadata()
        trigger_state = ""

        for config in lora_configs:
            if not config.get('on', True) or not config.get('lora'):
                continue
            lora_name = config['lora']
            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
            if metadata_changed:
                save_metadata(all_metadata)
            
            triggers = cls._get_trigger_words_for_config(lora_meta, config)
                    
            trigger_state += triggers

        if trigger_state:
            m = hashlib.sha256()
            m.update((selection_data + trigger_state).encode('utf-8'))
            return m.hexdigest()

        return selection_data

    def _get_nunchaku_model_type(self, model):
        """Checks if the model is a Nunchaku-accelerated model and returns its type."""
        if not (is_nunchaku_flux_available or is_nunchaku_qwen_available):
            return 'none'
        
        if not hasattr(model.model, 'diffusion_model'):
            return 'none'
            
        wrapper_class_name = model.model.diffusion_model.__class__.__name__
        
        if wrapper_class_name == 'ComfyFluxWrapper' and is_nunchaku_flux_available:
            return 'flux'
        elif wrapper_class_name == 'ComfyQwenImageWrapper' and is_nunchaku_qwen_available:
            return 'qwen'
        
        return 'none'

class LocalLoraGallery(BaseLoraGallery):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"model": ("MODEL",), "clip": ("CLIP",)}, 
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "selection_data": ("STRING", {"default": "[]", "multiline": True, "forceInput": True})
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "trigger_words")

    FUNCTION = "load_loras"
    CATEGORY = "📜Asset Gallery/Loras"

    @staticmethod
    def _parse_compare_strengths(strengths):
        if isinstance(strengths, (list, tuple)):
            raw_values = strengths
        else:
            raw_values = str(strengths or "").split(",")

        parsed = []
        for value in raw_values:
            text = str(value).strip()
            if not text:
                continue
            try:
                strength = float(text)
            except (TypeError, ValueError):
                continue
            if strength != strength or strength in (float("inf"), float("-inf")):
                continue
            parsed.append(strength)
        return parsed or [1.0]

    def load_loras_independently(self, model, clip, selection_data="[]", strengths="1.0"):
        """Build independent base-model variants for every enabled LoRA/strength pair."""
        lora_configs = self._parse_selection_data(selection_data)
        compare_strengths = self._parse_compare_strengths(strengths)
        all_metadata = load_execution_metadata()
        nunchaku_model_type = self._get_nunchaku_model_type(model)

        if nunchaku_model_type == 'flux':
            loader_instance = NunchakuFluxLoraLoader()
            print("LocalLoraGallery: Using NunchakuFluxLoraLoader for comparison.")
        elif nunchaku_model_type == 'qwen':
            loader_instance = NunchakuQwenLoraLoader()
            print("LocalLoraGallery: Using NunchakuQwenImageLoraLoader for comparison.")
        else:
            loader_instance = LoraLoader()
            print("LocalLoraGallery: Using standard LoraLoader for comparison.")

        models_output = []
        clips_output = []
        trigger_words_output = []
        metadata_output = []
        enabled_count = 0

        for config in lora_configs:
            if not isinstance(config, dict) or not config.get('on', True) or not config.get('lora'):
                continue

            enabled_count += 1
            lora_name = config['lora']
            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
            if metadata_changed:
                save_metadata(all_metadata)
            triggers = self._get_trigger_words_for_config(lora_meta, config)
            metadata_name = os.path.splitext(os.path.basename(lora_name))[0]

            for strength in compare_strengths:
                try:
                    # Every variant deliberately starts from the original inputs.
                    if nunchaku_model_type in ['flux', 'qwen']:
                        (variant_model,) = loader_instance.load_lora(model, lora_name, strength)
                        variant_clip = clip
                    else:
                        variant_model, variant_clip = loader_instance.load_lora(
                            model,
                            clip,
                            lora_name,
                            strength,
                            strength,
                        )

                    models_output.append(variant_model)
                    clips_output.append(variant_clip)
                    trigger_words_output.append(triggers)
                    metadata_output.append(f"{metadata_name}_strength_{strength:g}")
                except Exception as e:
                    print(
                        f"LocalLoraGallery: Failed comparison variant "
                        f"'{lora_name}' at strength {strength:g}: {e}"
                    )

        if not models_output:
            if enabled_count:
                raise ValueError("LocalLoraGallery: No LoRA comparison variants could be loaded.")
            return ([model], [clip], [""], ["base_model"])

        print(f"LocalLoraGallery: Built {len(models_output)} independent comparison variants.")
        return (models_output, clips_output, trigger_words_output, metadata_output)

    def load_loras(self, model, clip, unique_id, selection_data="[]", **kwargs):
        lora_configs = self._parse_selection_data(selection_data)

        all_metadata = load_execution_metadata()
        trigger_words_list = []

        current_model, current_clip = model, clip
        applied_count = 0

        nunchaku_model_type = self._get_nunchaku_model_type(model)
        loader_instance = None
        
        if nunchaku_model_type == 'flux':
            loader_instance = NunchakuFluxLoraLoader()
            print("LocalLoraGallery: Using NunchakuFluxLoraLoader.")
        elif nunchaku_model_type == 'qwen':
            loader_instance = NunchakuQwenLoraLoader()
            print("LocalLoraGallery: Using NunchakuQwenImageLoraLoader.")
        else:
            loader_instance = LoraLoader()
            print("LocalLoraGallery: Using standard LoraLoader.")

        for config in lora_configs:
            if not isinstance(config, dict):
                continue
            if not config.get('on', True) or not config.get('lora'):
                continue

            lora_name = config['lora']

            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
            if metadata_changed:
                save_metadata(all_metadata)
            triggers = self._get_trigger_words_for_config(lora_meta, config)
                    
            if triggers:
                trigger_words_list.append(triggers)

            try:
                strength_model = self._float_config_value(config, 'strength', 1.0)
                strength_clip = self._float_config_value(config, 'strength_clip', strength_model)

                if strength_model == 0 and strength_clip == 0:
                    continue

                if nunchaku_model_type in ['flux', 'qwen']:
                    (current_model,) = loader_instance.load_lora(current_model, lora_name, strength_model)
                else:
                    current_model, current_clip = loader_instance.load_lora(current_model, current_clip, lora_name, strength_model, strength_clip)

                applied_count += 1
            except Exception as e:
                print(f"LocalLoraGallery: Failed to load LoRA '{lora_name}': {e}")

        print(f"LocalLoraGallery: Applied {applied_count} LoRAs.")

        trigger_words_string = ", ".join(trigger_words_list)
        return (current_model, current_clip, trigger_words_string)

class LocalLoraGalleryModelOnly(BaseLoraGallery):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"model": ("MODEL",)}, 
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "selection_data": ("STRING", {"default": "[]", "multiline": True, "forceInput": True})
            }
        }

    RETURN_TYPES = ("MODEL", "STRING")
    RETURN_NAMES = ("MODEL", "trigger_words")

    FUNCTION = "load_loras"
    CATEGORY = "📜Asset Gallery/Loras"

    def load_loras(self, model, unique_id, selection_data="[]", **kwargs):
        lora_configs = self._parse_selection_data(selection_data)

        all_metadata = load_execution_metadata()
        trigger_words_list = []

        current_model = model
        applied_count = 0

        nunchaku_model_type = self._get_nunchaku_model_type(model)
        loader_instance = None

        if nunchaku_model_type == 'flux':
            loader_instance = NunchakuFluxLoraLoader()
            print("LocalLoraGalleryModelOnly: Using NunchakuFluxLoraLoader.")
        elif nunchaku_model_type == 'qwen':
            loader_instance = NunchakuQwenLoraLoader()
            print("LocalLoraGalleryModelOnly: Using NunchakuQwenImageLoraLoader.")
        else:
            loader_instance = LoraLoaderModelOnly()
            print("LocalLoraGalleryModelOnly: Using standard LoraLoaderModelOnly.")

        for config in lora_configs:
            if not isinstance(config, dict):
                continue
            if not config.get('on', True) or not config.get('lora'):
                continue

            lora_name = config['lora']

            lora_full_path = folder_paths.get_full_path("loras", lora_name)
            lora_meta, metadata_changed = get_metadata_for_lora(all_metadata, lora_name, lora_full_path)
            if metadata_changed:
                save_metadata(all_metadata)
            triggers = self._get_trigger_words_for_config(lora_meta, config)
                    
            if triggers:
                trigger_words_list.append(triggers)

            try:
                strength_model = self._float_config_value(config, 'strength', 1.0)
                if strength_model == 0:
                    continue

                if nunchaku_model_type in ['flux', 'qwen']:
                    (current_model,) = loader_instance.load_lora(current_model, lora_name, strength_model)
                else:
                    (current_model,) = loader_instance.load_lora_model_only(current_model, lora_name, strength_model)

                applied_count += 1
            except Exception as e:
                print(f"LocalLoraGalleryModelOnly: Failed to load LoRA '{lora_name}': {e}")

        print(f"LocalLoraGalleryModelOnly: Applied {applied_count} LoRAs.")

        trigger_words_string = ", ".join(trigger_words_list)
        return (current_model, trigger_words_string)

NODE_CLASS_MAPPINGS = {
    "LocalLoraGallery": LocalLoraGallery,
    "LocalLoraGalleryModelOnly": LocalLoraGalleryModelOnly
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LocalLoraGallery": "Local Lora Gallery",
    "LocalLoraGalleryModelOnly": "Local Lora Gallery (Model Only)"
}
