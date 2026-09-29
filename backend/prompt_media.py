"""Prompt card thumbnails on disk: paths, backups, and assigning Comfy outputs as thumbnails."""

import os
import shutil
import threading
import time

import folder_paths

from .card_thumbnails import remove_card_thumbnails
from .prompt_store import CARD_THUMBNAILS_DIR, DELETED_THUMBNAILS_DIR, THUMBNAILS_DIR, backup_json_file

VIDEO_EXTENSIONS = ('.mp4', '.webm', '.mov', '.avi')
IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.gif')


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


def safe_thumbnail_path(prompt_id, ext):
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
        if (path := safe_thumbnail_path(prompt_id, ext)) is not None and os.path.exists(path)
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
    target_path = safe_thumbnail_path(prompt_id, ext)
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
