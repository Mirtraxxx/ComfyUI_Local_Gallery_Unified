"""Prompt gallery storage: data paths, JSON file IO, and the metadata cache with its transaction."""

from contextlib import AbstractContextManager
import hashlib
import json
import os
import shutil
import threading
import time

from .prompt_cards import build_metadata_indexes

NODE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(NODE_DIR, "..", "data", "prompt_gallery"))
METADATA_FILE = os.path.join(DATA_DIR, "prompt_gallery_metadata.json")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
DELETED_THUMBNAILS_DIR = os.path.join(BACKUP_DIR, "deleted_thumbnails")
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
json_file_lock = threading.RLock()


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
        with json_file_lock:
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
        with json_file_lock:
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
        json_file_lock.acquire()
        try:
            # json.loads already returned a fresh object.  Avoiding a second
            # full deep copy is significant for large metadata libraries while
            # retaining the transaction's all-or-nothing cache visibility.
            self.metadata = _load_metadata_from_disk_locked(update_cache=False)
            return self
        except Exception:
            json_file_lock.release()
            raise

    def commit(self):
        if self._committed:
            return
        save_metadata(self.metadata)
        self._committed = True

    def __exit__(self, exc_type, exc_value, traceback):
        json_file_lock.release()
        return False


def load_metadata():
    global _metadata_cache, _metadata_mtime
    with json_file_lock:
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
    with json_file_lock:
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


def get_metadata_indexes():
    global _metadata_indexes_cache, _metadata_indexes_mtime
    metadata = load_metadata()
    if _metadata_indexes_cache is None or _metadata_indexes_mtime != _metadata_mtime:
        _metadata_indexes_cache = build_metadata_indexes(metadata)
        _metadata_indexes_mtime = _metadata_mtime
    return _metadata_indexes_cache


def generate_unique_prompt_id(metadata, name):
    prompt_id = hashlib.md5(name.encode()).hexdigest()[:8]
    original_id = prompt_id
    counter = 1
    while prompt_id in metadata:
        prompt_id = f"{original_id}_{counter}"
        counter += 1
    return prompt_id
