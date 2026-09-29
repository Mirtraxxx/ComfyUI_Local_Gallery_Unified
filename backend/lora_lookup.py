"""Pure LoRA metadata lookup: match a LoRA file to its metadata entry by hash or basename."""

import hashlib
import os

def calculate_sha256(filepath):
    """Calculates the SHA256 hash of a file efficiently."""
    if not os.path.exists(filepath):
        return None
    hash_sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()


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
