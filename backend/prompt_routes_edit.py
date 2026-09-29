"""Prompt routes that create, change, move, or delete cards and categories."""

import copy
import hashlib
import os
import shutil
import time

from aiohttp import web
import server

from .prompt_bulk import (
    apply_bulk_operations,
    bulk_diff,
    normalize_bulk_ids,
    normalize_bulk_operations,
    replace_category_refs,
    resolve_bulk_selection,
    resolve_sequential_rename_ids,
)
from .prompt_cards import build_metadata_indexes, build_sequential_rename_plan, prompt_response
from .prompt_media import (
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    backup_and_remove_thumbnail,
    find_thumbnail_paths,
    resolve_comfy_output_path,
)
from .prompt_prefs import rename_category_prefs
from .prompt_store import (
    MetadataTransaction,
    THUMBNAILS_DIR,
    generate_unique_prompt_id,
    load_metadata,
    metadata_revision,
)
from .value_utils import bounded_int

@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/update_metadata")
async def update_metadata_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            if prompt_id not in metadata:
                return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)

            if 'name' in data:
                metadata[prompt_id]['name'] = data['name']
            if 'prompt_text' in data:
                metadata[prompt_id]['prompt_text'] = data['prompt_text']
            if 'category' in data:
                metadata[prompt_id]['category'] = data['category']

            transaction.commit()
            prompt = prompt_response(prompt_id, metadata[prompt_id], include_usage=True)

        return web.json_response({"status": "ok", "prompt": prompt})

    except Exception as e:
        print(f"Error updating metadata: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/bulk_edit")
async def bulk_edit_endpoint(request):
    """Preview or atomically apply server-side card transformations."""
    try:
        data = await request.json()
        selection = data.get("selection", {})
        operations = normalize_bulk_operations(data.get("operations", {}))
        preview = bool(data.get("preview", True))
        sample_limit = bounded_int(data.get("sample_limit", 10), 10, 0, 20)
        active_prompt_ids = normalize_bulk_ids(data.get("active_prompt_ids", []))

        if preview:
            metadata = load_metadata()
            revision = metadata_revision()
            prompt_ids = resolve_bulk_selection(metadata, selection)
            missing_ids = [prompt_id for prompt_id in prompt_ids if prompt_id not in metadata]
            changed_count = 0
            unchanged_count = 0
            samples = []
            for prompt_id in prompt_ids:
                prompt_data = metadata.get(prompt_id)
                if not isinstance(prompt_data, dict):
                    continue
                working = copy.deepcopy(prompt_data)
                before, changed = apply_bulk_operations(working, operations)
                if changed:
                    changed_count += 1
                    if len(samples) < sample_limit:
                        samples.append(bulk_diff(prompt_id, before, working))
                else:
                    unchanged_count += 1
            return web.json_response({
                "status": "ok",
                "preview": True,
                "revision": revision,
                "selected_count": len(prompt_ids),
                "changed_count": changed_count,
                "unchanged_count": unchanged_count,
                "missing_count": len(missing_ids),
                "missing_ids": missing_ids[:100],
                "samples": samples,
            })

        base_revision = str(data.get("base_revision", "")).strip()
        if not base_revision:
            return web.json_response({
                "status": "error",
                "message": "base_revision is required when applying a bulk edit",
            }, status=400)

        with MetadataTransaction() as transaction:
            current_revision = metadata_revision()
            if base_revision != current_revision:
                return web.json_response({
                    "status": "conflict",
                    "message": "The card library changed after the preview. Refresh the preview and try again.",
                    "revision": current_revision,
                }, status=409)

            metadata = transaction.metadata
            prompt_ids = resolve_bulk_selection(metadata, selection)
            missing_ids = [prompt_id for prompt_id in prompt_ids if prompt_id not in metadata]
            updated_count = 0
            updated_active_prompts = []
            samples = []
            for prompt_id in prompt_ids:
                prompt_data = metadata.get(prompt_id)
                if not isinstance(prompt_data, dict):
                    continue
                before, changed = apply_bulk_operations(prompt_data, operations)
                if changed:
                    updated_count += 1
                    if len(samples) < sample_limit:
                        samples.append(bulk_diff(prompt_id, before, prompt_data))

            if updated_count:
                transaction.commit()

            for prompt_id in active_prompt_ids:
                prompt_data = metadata.get(prompt_id)
                if isinstance(prompt_data, dict):
                    updated_active_prompts.append(prompt_response(prompt_id, prompt_data))

            result_revision = metadata_revision()

        return web.json_response({
            "status": "ok",
            "preview": False,
            "revision": result_revision,
            "selected_count": len(prompt_ids),
            "changed_count": updated_count,
            "unchanged_count": max(0, len(prompt_ids) - updated_count - len(missing_ids)),
            "missing_count": len(missing_ids),
            "missing_ids": missing_ids[:100],
            "active_prompts": updated_active_prompts,
            "samples": samples,
        })
    except ValueError as error:
        return web.json_response({"status": "error", "message": str(error)}, status=400)
    except Exception as error:
        print(f"Error in bulk edit: {error}")
        return web.json_response({"status": "error", "message": str(error)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/rename_prompts_sequential")
async def rename_prompts_sequential_endpoint(request):
    """Preview or atomically rename selected cards to 001, 002, ... ."""
    try:
        try:
            data = await request.json()
        except Exception:
            return web.json_response({
                "status": "error",
                "message": "Request body must be valid JSON",
            }, status=400)
        preview = data.get("preview", True) if isinstance(data, dict) else True
        if not isinstance(preview, bool):
            raise ValueError("preview must be a boolean")
        active_prompt_ids = normalize_bulk_ids(data.get("active_prompt_ids", []))

        if preview:
            metadata = load_metadata()
            prompt_ids = resolve_sequential_rename_ids(metadata, data)
            missing_ids = [prompt_id for prompt_id in prompt_ids if not isinstance(metadata.get(prompt_id), dict)]
            if missing_ids:
                return web.json_response({
                    "status": "error",
                    "message": "One or more selected cards no longer exist",
                    "missing_ids": missing_ids[:100],
                }, status=404)
            return web.json_response({
                "status": "ok",
                "preview": True,
                "revision": metadata_revision(),
                "selected_count": len(prompt_ids),
                "ordering": "wildcard_order first; remaining cards by created time and card ID",
            })

        base_revision = str(data.get("base_revision", "")).strip()
        if not base_revision:
            raise ValueError("base_revision is required when applying a sequential rename")

        with MetadataTransaction() as transaction:
            current_revision = metadata_revision()
            if base_revision != current_revision:
                return web.json_response({
                    "status": "conflict",
                    "message": "The card library changed after confirmation. Review the selection and try again.",
                    "revision": current_revision,
                }, status=409)

            metadata = transaction.metadata
            prompt_ids = resolve_sequential_rename_ids(metadata, data)
            missing_ids = [prompt_id for prompt_id in prompt_ids if not isinstance(metadata.get(prompt_id), dict)]
            if missing_ids:
                return web.json_response({
                    "status": "error",
                    "message": "One or more selected cards no longer exist",
                    "missing_ids": missing_ids[:100],
                }, status=404)

            rename_plan = build_sequential_rename_plan(metadata, prompt_ids)
            renamed_count = 0
            for prompt_id, name in rename_plan:
                if metadata[prompt_id].get("name") != name:
                    metadata[prompt_id]["name"] = name
                    renamed_count += 1
            if renamed_count:
                transaction.commit()

            active_prompts = []
            for prompt_id in active_prompt_ids:
                prompt_data = metadata.get(prompt_id)
                if isinstance(prompt_data, dict):
                    active_prompts.append(prompt_response(prompt_id, prompt_data, include_usage=True))
            result_revision = metadata_revision()

        return web.json_response({
            "status": "ok",
            "preview": False,
            "revision": result_revision,
            "selected_count": len(prompt_ids),
            "renamed_count": renamed_count,
            "active_prompts": active_prompts,
            "ordering": "wildcard_order first; remaining cards by created time and card ID",
        })
    except ValueError as error:
        return web.json_response({"status": "error", "message": str(error)}, status=400)
    except Exception as error:
        print(f"Error renaming prompts sequentially: {error}")
        return web.json_response({"status": "error", "message": str(error)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/move_prompts_bulk")
async def move_prompts_bulk_endpoint(request):
    """Move a set of cards to one category with a single metadata write."""
    try:
        data = await request.json()
        prompt_ids = data.get('prompt_ids', [])
        if not isinstance(prompt_ids, list) or not prompt_ids:
            return web.json_response({
                "status": "error",
                "message": "prompt_ids must be a non-empty list",
            }, status=400)
        if 'category' not in data or not isinstance(data.get('category'), str):
            return web.json_response({
                "status": "error",
                "message": "category must be a string",
            }, status=400)

        category = data.get('category', '').strip()
        # Empty category is the supported Uncategorized destination.
        normalized_ids = []
        seen_ids = set()
        for prompt_id in prompt_ids:
            prompt_id = str(prompt_id).strip()
            if prompt_id and prompt_id not in seen_ids:
                normalized_ids.append(prompt_id)
                seen_ids.add(prompt_id)
        if not normalized_ids:
            return web.json_response({
                "status": "error",
                "message": "prompt_ids must contain at least one valid id",
            }, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            missing_ids = [prompt_id for prompt_id in normalized_ids if prompt_id not in metadata]
            updated_ids = []
            for prompt_id in normalized_ids:
                prompt_data = metadata.get(prompt_id)
                if not prompt_data:
                    continue
                if prompt_data.get('category', '') != category:
                    prompt_data['category'] = category
                    updated_ids.append(prompt_id)
            if updated_ids:
                transaction.commit()

        return web.json_response({
            "status": "ok",
            "category": category,
            "updated_ids": updated_ids,
            "moved_count": len(updated_ids),
            "missing_ids": missing_ids,
        })
    except Exception as e:
        print(f"Error moving prompts in bulk: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/rename_category")
async def rename_category_endpoint(request):
    try:
        data = await request.json()
        old_category = str(data.get('old_category', '')).strip()
        new_category = str(data.get('new_category', '')).strip()

        if not old_category or not new_category:
            return web.json_response({"status": "error", "message": "Both old_category and new_category are required"}, status=400)

        if old_category == new_category:
            return web.json_response({"status": "ok", "message": "Category name unchanged", "renamed_count": 0})

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            renamed_count = 0

            for prompt_data in metadata.values():
                if prompt_data.get('category', '') == old_category:
                    prompt_data['category'] = new_category
                    renamed_count += 1

                if 'category_favorites' in prompt_data:
                    updated_favorites = replace_category_refs(
                        prompt_data.get('category_favorites', []),
                        old_category,
                        new_category,
                    )
                    if updated_favorites != prompt_data.get('category_favorites', []):
                        prompt_data['category_favorites'] = updated_favorites

            if renamed_count == 0:
                return web.json_response({"status": "error", "message": f"No prompts found in category '{old_category}'"}, status=404)

            transaction.commit()
            rename_category_prefs(old_category, new_category)

        return web.json_response({
            "status": "ok",
            "message": f"Moved {renamed_count} prompt(s) from '{old_category}' to '{new_category}'",
            "renamed_count": renamed_count,
        })

    except Exception as e:
        print(f"Error renaming category: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/create_prompt")
async def create_prompt_endpoint(request):
    try:
        data = await request.json()
        name = data.get('name', '')
        prompt_text = data.get('prompt_text', '')
        category = data.get('category', '')

        if not name:
            return web.json_response({"status": "error", "message": "Name is required"}, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
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
            transaction.commit()

        return web.json_response({
            "status": "ok",
            "prompt_id": prompt_id,
            "prompt": prompt_response(prompt_id, prompt_data, include_usage=True),
        })

    except Exception as e:
        print(f"Error creating prompt: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/create_prompt_from_output")
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

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            prompt_id = generate_unique_prompt_id(metadata, name)
            target_path = os.path.join(THUMBNAILS_DIR, f"{prompt_id}{ext}")
            temp_target_path = f"{target_path}.{int(time.time() * 1000)}.tmp"

            try:
                shutil.copy2(source_path, temp_target_path)
                os.replace(temp_target_path, target_path)
                metadata[prompt_id] = prompt_data
                transaction.commit()
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


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/delete_prompt")
async def delete_prompt_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            if prompt_id in metadata:
                thumbnail_paths = find_thumbnail_paths(prompt_id)
                del metadata[prompt_id]
                transaction.commit()
                for thumb_path in thumbnail_paths:
                    backup_and_remove_thumbnail(thumb_path)
                return web.json_response({"status": "ok"})

            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)

    except Exception as e:
        print(f"Error deleting prompt: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/delete_prompts_bulk")
async def delete_prompts_bulk_endpoint(request):
    try:
        data = await request.json()
        prompt_ids = data.get('prompt_ids', [])

        if not isinstance(prompt_ids, list) or not prompt_ids:
            return web.json_response({"status": "error", "message": "prompt_ids must be a non-empty list"}, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
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

            if deleted_count:
                transaction.commit()
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


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/delete_category")
async def delete_category_endpoint(request):
    """Delete all prompts in a category"""
    try:
        data = await request.json()
        category = data.get('category')

        if not category:
            return web.json_response({"status": "error", "message": "Category is required"}, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata

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

            transaction.commit()
            for thumb_path in thumbnail_paths:
                backup_and_remove_thumbnail(thumb_path)
        return web.json_response({
            "status": "ok",
            "message": f"Deleted {deleted_count} prompts from category '{category}'"
        })

    except Exception as e:
        print(f"Error deleting category: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/toggle_favorite")
async def toggle_favorite_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        category = data.get('category')

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata

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
                    transaction.commit()
                    return web.json_response({"status": "ok", "favorite": is_fav, "category": category})
                else:
                    current_favorite = metadata[prompt_id].get('favorite', False)
                    metadata[prompt_id]['favorite'] = not current_favorite
                    transaction.commit()
                    return web.json_response({"status": "ok", "favorite": not current_favorite})

            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
    except Exception as e:
        print(f"Error toggling favorite: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/set_favorite_color")
async def set_favorite_color_endpoint(request):
    try:
        data = await request.json()
        prompt_id = data.get('prompt_id')
        color = data.get('color')  # hex string like "#ff6b6b" or None to clear

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata

            if prompt_id in metadata:
                if color:
                    metadata[prompt_id]['favorite_color'] = color
                elif 'favorite_color' in metadata[prompt_id]:
                    del metadata[prompt_id]['favorite_color']
                transaction.commit()
                return web.json_response({"status": "ok", "color": color})

            return web.json_response({"status": "error", "message": "Prompt not found"}, status=404)
    except Exception as e:
        print(f"Error setting favorite color: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/get_or_create_prompts")
async def get_or_create_prompts_endpoint(request):
    try:
        data = await request.json()
        prompts = data.get('prompts', [])

        if not prompts or not isinstance(prompts, list):
            return web.json_response({"status": "error", "message": "List of prompts is required"}, status=400)

        with MetadataTransaction() as transaction:
            metadata = transaction.metadata
            indexes = build_metadata_indexes(metadata)
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
                transaction.commit()

        return web.json_response({"status": "ok", "prompts": results})

    except Exception as e:
        print(f"Error in get_or_create_prompts: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)
