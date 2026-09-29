"""Wildcard file routes: upload, import, and export."""

import os
import time
import uuid

from aiohttp import web
import server

from .prompt_prefs import load_ui_prefs
from .prompt_store import (
    MetadataTransaction,
    WILDCARDS_DIR,
    backup_json_file,
    get_metadata_indexes,
    load_metadata,
)
from .prompt_wildcards import sanitize_wildcard_relpath, build_wildcard_export_lines, get_comfy_wildcards_dir

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

        rel_path = sanitize_wildcard_relpath(filename or category)
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
