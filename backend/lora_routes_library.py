"""LoRA library routes: browser listing, metadata edits, tags, presets, and UI state."""

from aiohttp import web
import folder_paths
import server

from .lora_library import (
    METADATA_LOCK,
    PRESETS_LOCK,
    UI_STATE_LOCK,
    get_lora_inventory,
    load_metadata,
    load_presets,
    load_ui_state,
    save_metadata,
    save_presets,
    save_ui_state,
)
from .lora_lookup import get_metadata_for_lora
from .value_utils import bounded_int

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
        
        with PRESETS_LOCK:
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
        
        with PRESETS_LOCK:
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
                "remember_strength": entry["remember_strength"],
                "saved_strength": entry["saved_strength"],
                "saved_strength_clip": entry["saved_strength_clip"],
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
        async with UI_STATE_LOCK:
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
        with METADATA_LOCK:
            metadata = load_metadata()
            lora_meta, _ = get_metadata_for_lora(metadata, lora_name, lora_full_path, ensure_hash=bool(lora_full_path), create_missing=True)

            if tags is not None:
                lora_meta['tags'] = [str(tag).strip() for tag in tags if str(tag).strip()]

            if trigger_words is not None:
                lora_meta['trigger_words'] = str(trigger_words)

            trigger_presets = data.get('trigger_presets')
            if trigger_presets is not None:
                lora_meta['trigger_presets'] = trigger_presets

            if download_url is not None:
                lora_meta['download_url'] = str(download_url)

            remember_strength = data.get('remember_strength')
            if remember_strength is not None:
                lora_meta['remember_strength'] = bool(remember_strength)

            saved_strength = data.get('saved_strength')
            if saved_strength is not None:
                lora_meta['saved_strength'] = float(saved_strength)

            saved_strength_clip = data.get('saved_strength_clip')
            if saved_strength_clip is not None:
                lora_meta['saved_strength_clip'] = float(saved_strength_clip)

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
