"""Prompt UI preference and preset routes."""

import copy

from aiohttp import web
import server

from .prompt_prefs import (
    UI_PREF_DEFAULTS,
    UI_PREF_VALIDATORS,
    load_presets,
    load_ui_prefs,
    save_presets,
    save_ui_prefs,
)
from .prompt_store import json_file_lock

@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_ui_prefs")
async def get_ui_prefs_endpoint(request):
    """Get UI preferences"""
    try:
        prefs = load_ui_prefs()
        return web.json_response(prefs)
    except Exception as e:
        print(f"Error getting UI prefs: {e}")
        return web.json_response(copy.deepcopy(UI_PREF_DEFAULTS), status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/save_ui_prefs")
async def save_ui_prefs_endpoint(request):
    """Save UI preferences"""
    try:
        data = await request.json()
        prefs = load_ui_prefs()

        if not isinstance(data, dict):
            return web.json_response({"status": "error", "message": "UI prefs payload must be an object"}, status=400)

        for key, value in data.items():
            validator = UI_PREF_VALIDATORS.get(key)
            if validator:
                prefs[key] = validator(value, prefs)

        if "cards_display_mode" in data:
            prefs["display_mode"] = prefs["cards_display_mode"]
        elif "display_mode" in data:
            prefs["cards_display_mode"] = prefs["display_mode"]

        save_ui_prefs(prefs)
        return web.json_response({"status": "ok"})
    except Exception as e:
        print(f"Error saving UI prefs: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.get("/localgalleryunified/prompt/get_presets")
async def get_presets_endpoint(request):
    """Get all saved presets"""
    try:
        presets = load_presets()
        # Return as list of {name, ...} for frontend
        preset_list = [{"name": name, **data} for name, data in presets.items()]
        return web.json_response({"presets": preset_list})
    except Exception as e:
        print(f"Error getting presets: {e}")
        return web.json_response({"status": "error", "message": str(e), "presets": []}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/save_preset")
async def save_preset_endpoint(request):
    """Save a new preset or update existing"""
    try:
        data = await request.json()
        name = data.get("name", "").strip()

        if not name:
            return web.json_response({"status": "error", "message": "Preset name is required"}, status=400)

        with json_file_lock:
            presets = load_presets()
            presets[name] = {
                "selection": data.get("selection", []),
                "wildcard_mode": data.get("wildcard_mode", "off"),
                "wildcard_categories": data.get("wildcard_categories", []),
                "wildcard_auto_attach_thumbnail": data.get("wildcard_auto_attach_thumbnail", "off"),
            }
            save_presets(presets)

        return web.json_response({"status": "ok", "message": f"Preset '{name}' saved"})
    except Exception as e:
        print(f"Error saving preset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/load_preset")
async def load_preset_endpoint(request):
    """Load a specific preset by name"""
    try:
        data = await request.json()
        name = data.get("name", "").strip()

        if not name:
            return web.json_response({"status": "error", "message": "Preset name is required"}, status=400)

        presets = load_presets()

        if name not in presets:
            return web.json_response({"status": "error", "message": f"Preset '{name}' not found"}, status=404)

        preset = presets[name]
        return web.json_response({
            "status": "ok",
            "preset": {
                "name": name,
                "selection": preset.get("selection", []),
                "wildcard_mode": preset.get("wildcard_mode", "off"),
                "wildcard_categories": preset.get("wildcard_categories", []),
                "wildcard_auto_attach_thumbnail": preset.get("wildcard_auto_attach_thumbnail", "off"),
            }
        })
    except Exception as e:
        print(f"Error loading preset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)


@server.PromptServer.instance.routes.post("/localgalleryunified/prompt/delete_preset")
async def delete_preset_endpoint(request):
    """Delete a preset by name"""
    try:
        data = await request.json()
        name = data.get("name", "").strip()

        if not name:
            return web.json_response({"status": "error", "message": "Preset name is required"}, status=400)

        with json_file_lock:
            presets = load_presets()

            if name not in presets:
                return web.json_response({"status": "error", "message": f"Preset '{name}' not found"}, status=404)

            del presets[name]
            save_presets(presets)

        return web.json_response({"status": "ok", "message": f"Preset '{name}' deleted"})
    except Exception as e:
        print(f"Error deleting preset: {e}")
        return web.json_response({"status": "error", "message": str(e)}, status=500)
