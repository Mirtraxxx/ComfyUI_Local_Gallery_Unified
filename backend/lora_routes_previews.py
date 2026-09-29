"""LoRA preview routes: serving previews and assigning a Comfy output as the preview."""

import asyncio
import os
import shutil
import tempfile
import time

from aiohttp import web
import folder_paths
import server

from .lora_library import PREVIEW_BACKUP_DIR, invalidate_lora_inventory
from .lora_previews import (
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    get_lora_preview_asset_info,
    resolve_comfy_preview_source,
    sync_lora_manager_preview_metadata,
    write_lora_preview_target,
)

def assign_lora_preview_file(lora_name, filename, subfolder='', folder_type='output'):
    """Store the latest Comfy result beside a LoRA and back up replaced previews."""
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
        extension = ".webp"
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
            "w+b",
            dir=os.path.dirname(lora_full_path),
            delete=False,
        ) as temp_file:
            temp_target = temp_file.name
            write_lora_preview_target(source_path, temp_file, preview_type)
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
        sync_lora_manager_preview_metadata(lora_full_path, target_path)
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


@server.PromptServer.instance.routes.get("/localgalleryunified/lora/preview")
async def get_preview_image(request):
    filename = request.query.get('filename')
    lora_name = request.query.get('lora_name')

    if not filename or not lora_name:
        return web.Response(status=403)

    try:
        # aiohttp already percent-decodes query params; decoding again would
        # destroy filenames that legitimately contain "%20" (Civitai downloads).
        lora_name_decoded = lora_name
        filename_decoded = filename

        if not filename_decoded or os.path.isabs(filename_decoded):
            return web.Response(status=403)
        if "/" in filename_decoded or "\\" in filename_decoded:
            return web.Response(status=403)
        if any(segment == ".." for segment in filename_decoded.split("/")):
            return web.Response(status=403)

        lora_full_path = folder_paths.get_full_path("loras", lora_name_decoded)
        if not lora_full_path:
            return web.Response(status=404, text=f"Lora '{lora_name_decoded}' not found.")

        lora_dir = os.path.dirname(os.path.abspath(lora_full_path))
        image_path = os.path.abspath(os.path.join(lora_dir, filename_decoded))
        try:
            contained = os.path.commonpath([lora_dir, image_path]) == lora_dir
        except ValueError:
            contained = False
        if not contained:
            return web.Response(status=403)

        # Known previews are the LoRA's own base name with a media extension.
        preview_base, _ = os.path.splitext(os.path.basename(lora_full_path))
        stem, ext = os.path.splitext(filename_decoded)
        if stem != preview_base or ext.lower() not in IMAGE_EXTENSIONS + VIDEO_EXTENSIONS:
            return web.Response(status=404, text=f"Preview '{filename_decoded}' not found.")

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
