"""LoRA preview files next to the LoRA: discovery, copying from Comfy outputs, and Lora Manager sync."""

import os
import shutil
import urllib.parse

from PIL import Image
from PIL import ImageOps
import folder_paths

from .lora_json import load_json_file, save_json_file

VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi']
IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']


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


def write_lora_preview_target(source_path, target_handle, preview_type):
    """Write a canonical LoRA preview into an already-open temporary file."""
    if preview_type == "image":
        with Image.open(source_path) as source_image:
            image = ImageOps.exif_transpose(source_image)
            output_mode = "RGBA" if "A" in image.getbands() else "RGB"
            image.convert(output_mode).save(
                target_handle,
                format="WEBP",
                quality=90,
                method=6,
            )
        return

    with open(source_path, "rb") as source_file:
        shutil.copyfileobj(source_file, target_handle)


def sync_lora_manager_preview_metadata(lora_full_path, preview_path):
    """Repair LoRA Manager's adjacent cached preview path when it is present."""
    preview_base, _ = os.path.splitext(lora_full_path)
    manager_metadata_path = preview_base + ".metadata.json"
    if not os.path.exists(manager_metadata_path):
        return

    try:
        manager_metadata = load_json_file(manager_metadata_path, default_data=None)
        if not isinstance(manager_metadata, dict) or "preview_url" not in manager_metadata:
            return

        normalized_preview_path = os.path.abspath(preview_path).replace(os.sep, "/")
        if manager_metadata.get("preview_url") == normalized_preview_path:
            return

        manager_metadata["preview_url"] = normalized_preview_path
        save_json_file(manager_metadata, manager_metadata_path)
    except Exception as error:
        # Preview assignment should still succeed if a sibling extension changes
        # its metadata format or makes the cache temporarily unavailable.
        print(f"Local Lora Gallery: Could not refresh LoRA Manager preview metadata: {error}")
