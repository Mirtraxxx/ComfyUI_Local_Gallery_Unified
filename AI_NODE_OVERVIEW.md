# ComfyUI Local Gallery Unified - Current Architecture

Updated: 2026-06-15

## Purpose

`ComfyUI_Local_Gallery_Unified` provides one ComfyUI node for building prompt-card selections and LoRA stacks together.

The main node is:

- Class: `LocalGalleryPromptLora`
- Display name: `Local Gallery: Prompt + LoRA`
- Category: `Asset Gallery`

The node now owns its runtime backend routes and data paths. Legacy standalone Prompt Gallery and LoRA Gallery installs can still exist beside it, but Unified no longer depends on their HTTP routes or node-class registrations for normal operation.

## Backend Shape

Important files:

- `__init__.py`
  - Registers the unified node.
  - Always imports bundled Prompt and LoRA backend modules so Unified-owned HTTP routes are registered.
  - Only exposes bundled standalone `LocalPromptGallery` / `LocalLoraGallery` node mappings when the legacy sibling folders are absent, avoiding duplicate node names.
- `Local_Gallery_Unified.py`
  - Defines `LocalGalleryPromptLora`.
  - Imports bundled `LocalPromptGallery` and `LocalLoraGallery` directly.
  - Applies LoRAs first, then builds the combined prompt.
  - Caches unchanged LoRA outputs so prompt-only changes do not reload the same LoRA stack.
- `backend/Local_Prompt_Gallery.py`
  - Bundled prompt backend, data access, prompt execution, and Prompt UI routes.
- `backend/Local_Lora_Gallery.py`
  - Bundled LoRA backend, LoRA loading, metadata access, and LoRA UI routes.

Unified-owned routes:

- Prompt routes: `/localgalleryunified/prompt/*`
- LoRA routes: `/localgalleryunified/lora/*`

The old standalone route families may still exist if the legacy nodes are installed, but Unified frontend code should use only the namespaced routes above.

## Runtime Data

Unified runtime data lives inside this package:

- `data/prompt_gallery/`
- `data/lora_gallery/`

These folders contain user/runtime data such as metadata JSON, thumbnails, presets, preferences, UI state, wildcards, and backups. They are intentionally not treated as normal source files.

Important prompt prefs file:

- `data/prompt_gallery/prompt_gallery_prefs.json`

Prompt UI preferences are loaded and saved through:

- `GET /localgalleryunified/prompt/get_ui_prefs`
- `POST /localgalleryunified/prompt/save_ui_prefs`

The backend owns the canonical preference schema in `backend/Local_Prompt_Gallery.py` through `UI_PREF_DEFAULTS`, validators, and normalization.

## Frontend Entry Points

- `js/Local_Gallery_Unified.js`
  - Small frontend entrypoint.
  - Registers tabs, LoRA UI, and Prompt UI.
- `js/tabs.js`
  - Prompt/LoRA tab switcher.
  - Persists visible tab through `active_tab`.
- `js/api/promptApi.js`
  - All Prompt API calls.
  - Should call `/localgalleryunified/prompt/*`.
- `js/api/loraApi.js`
  - All LoRA API calls.
  - Should call `/localgalleryunified/lora/*`.

## Prompt Frontend Map

Use product names from `PROMPT_UI_TERMINOLOGY.md` when discussing prompt UI work.

- Prompt UI coordinator: `js/prompt/ui.js`
- Prompt Builder card drawer: `js/prompt/library.js`
- Prompt Builder thumbnail cards: `.localprompt-chip-thumb`
- Prompt Builder compact cards: `.localprompt-chip`
- Card Manager workspace/modal: `js/prompt/browse.js`
- Card Manager cards: `.localprompt-gallery-item`
- Active Stack sidebar: `js/prompt/activeSidebar.js`
- Hidden Prompts/meta tags: `js/prompt/metaTags.js`
- Prompt settings: `js/prompt/settings.js`
- Prompt preferences frontend helpers: `js/prompt/preferences.js`
- Prompt shell markup: `js/prompt/template.js`
- Prompt stylesheet: `js/prompt/styles.js`
- Prompt dialogs: `js/prompt/dialogs.js`
- Prompt context menus: `js/prompt/contextMenus.js`
- Prompt hover/info previews: `js/prompt/previews.js`
- Prompt presets: `js/prompt/presets.js`
- Wildcard modal: `js/prompt/wildcards.js`
- Prompt workspace navigation: `js/prompt/workspace.js`
- Hidden widget setup: `js/prompt/stateWidgets.js`
- Prompt constants: `js/prompt/constants.js`
- Prompt UI & DOM helpers: `js/prompt/helpers.js`

Important naming trap:

- Code term `library` usually means product area `Prompt Builder`.
- Product area `Card Manager` is mostly code term `browse`.
- `js/prompt/gallery.js` is an older renderer path. Verify it is visible before editing it.

## LoRA Frontend Map

- Main LoRA UI: `js/lora/ui.js`
- LoRA helpers: `js/lora/helpers.js`

## Shared Frontend Map

- Shared DOM utilities: `js/shared/dom.js`
- Shared JSON utilities: `js/shared/json.js`
- Shared ComfyUI widget controllers: `js/shared/widgets.js`

`js/lora/ui.js` is still large and is the best target for future behavior-preserving modular cleanup.

## Backend Node Contract

Inputs:

- `model`: `MODEL`
- `clip`: `CLIP`
- `seed`: optional `INT`

Hidden/frontend-managed state:

- `lora_selection_data`
- `prompt_selection_data`
- `prompt_meta_tags`
- `wildcard_categories`
- `wildcard_mode`
- `wildcard_rng_mode`
- `wildcard_shuffle_nonce`
- `active_tab`

Outputs:

- `MODEL`
- `CLIP`
- `lora_trigger_words`
- `combined_prompt`

Do not change hidden widget names or saved JSON shapes casually. Existing workflows depend on them.

## Prompt Preferences

Preference handling is intentionally centralized:

- Backend defaults and validation: `backend/Local_Prompt_Gallery.py`
- Frontend normalization helpers: `js/prompt/preferences.js`
- Frontend API calls: `js/api/promptApi.js`

Display-mode fields:

- `cards_display_mode`: Prompt Builder/Card display mode.
- `display_mode`: legacy mirror of `cards_display_mode`.
- `active_display_mode`: Active Stack display mode.
- `card_contrast_mode`: contrast behavior for card surfaces.

Settings should write `cards_display_mode` and mirrored `display_mode`, but should not overwrite `active_display_mode`.

## Practical Verification

After backend changes:

- Restart ComfyUI.
- Confirm Unified routes are available through the UI.
- Confirm Prompt Builder cards load.
- Confirm Card Manager loads.
- Confirm LoRA list loads.
- Change Prompt display prefs, press `F5`, and confirm they persist.
- Add/remove a prompt card and confirm `combined_prompt` changes.
- Add/remove a LoRA and confirm model/clip outputs update.

Static checks:

```powershell
python -m py_compile Local_Gallery_Unified.py __init__.py backend\Local_Prompt_Gallery.py backend\Local_Lora_Gallery.py
node --check js\Local_Gallery_Unified.js
node --check js\prompt\ui.js
node --check js\prompt\styles.js
node --check js\lora\ui.js
node --check js\api\promptApi.js
node --check js\api\loraApi.js
```

## Future AI Notes

- Read `PROMPT_UI_TERMINOLOGY.md` before editing prompt UI.
- Do not assume `library` means Card Manager.
- Do not add new calls to `/localpromptgallery/*` or `/localloragallery/*` from Unified frontend code.
- Keep legacy standalone installs working by avoiding duplicate standalone node registrations.
- Keep runtime data under `data/` backed up before migrations or merges.
- Prefer focused UI patches over broad prompt-side refactors.
