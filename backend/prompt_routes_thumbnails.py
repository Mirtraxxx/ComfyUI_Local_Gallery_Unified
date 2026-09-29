"""Prompt thumbnail routes: upload, assign from outputs, and serving."""

import asyncio
import os
import time

from aiohttp import web
import server

from .card_thumbnails import RESIZABLE_EXTENSIONS, card_thumbnail_path, snap_card_width
from .comfy_queue import comfy_queue_busy
from .prompt_media import (
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    safe_thumbnail_path,
    assign_thumbnail_files,
    backup_and_remove_thumbnail,
    find_thumbnail_paths,
)
from .prompt_store import CARD_THUMBNAILS_DIR, MetadataTransaction, backup_json_file

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
            thumb_path = safe_thumbnail_path(prompt_id, ext)
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
        if comfy_queue_busy():
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
            thumb_path = safe_thumbnail_path(prompt_id, ext)
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
