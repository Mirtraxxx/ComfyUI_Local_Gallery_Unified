"""LoRA gallery JSON files: backups, corrupt-file quarantine, and guarded loading and saving."""

import copy
import glob
import json
import os
import shutil
import tempfile
import time

JSON_LOAD_FAILED_FILES = set()
MAX_JSON_BACKUPS = 10


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
        raise RuntimeError(f"Refusing to save {file_path} because it failed to load and no usable backup was found.")

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
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        raise RuntimeError(f"Error saving {file_path}: {e}") from e


def file_signature(file_path):
    try:
        stat = os.stat(file_path)
        return (stat.st_mtime_ns, stat.st_size)
    except OSError:
        return None
