# ComfyUI Local Gallery Unified - Current Architecture

Updated: 2026-06-18

## Purpose

`ComfyUI_Local_Gallery_Unified` provides one ComfyUI node for building prompt-card selections and LoRA stacks together.

The main node is:

- Class: `LocalGalleryPromptLora`
- Display name: `Local Gallery: Prompt + LoRA`
- Category: `Asset Gallery`

The node now owns its runtime backend routes and data paths. Legacy standalone Prompt Gallery and LoRA Gallery installs can still exist beside it, but Unified no longer depends on their HTTP routes or node-class registrations for normal operation.

## Quick AI Orientation

- Start with `PROMPT_UI_TERMINOLOGY.md` for prompt-side product names and `LORA_UI_TERMINOLOGY.md` for LoRA-side product names.
- The visible node is `LocalGalleryPromptLora`; its frontend is split into Prompt and LoRA tabs.
- Backend route families are namespaced under `/localgalleryunified/prompt/*` and `/localgalleryunified/lora/*`.
- Runtime JSON, thumbnails, presets, wildcards, and backups live under `data/`; treat them as user data, not source.
- Prefer editing the smallest owner module instead of patching the large coordinators first.

## Backend Shape

Important files:

- `__init__.py`
  - Registers the unified node.
  - Always imports bundled Prompt and LoRA backend modules so Unified-owned HTTP routes are registered.
  - Only exposes bundled standalone `LocalPromptGallery` / `LocalLoraGallery` node mappings when the legacy sibling folders are absent, avoiding duplicate node names.
  - The legacy sibling folder checks are exactly `Local_Prompt_Gallery` and `ComfyUI_Local_Lora_Gallery`.
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

Registration rule:

- Bundled backend modules are imported unconditionally, so Unified routes register whether or not standalone legacy nodes are installed.
- Standalone bundled node classes are exported only when their legacy sibling folder is absent. This avoids duplicate node names while keeping Unified self-contained.

## Runtime Data

Unified runtime data lives inside this package:

- `data/prompt_gallery/`
- `data/lora_gallery/`

These folders contain user/runtime data such as metadata JSON, thumbnails, presets, preferences, UI state, wildcards, and backups. They are intentionally not treated as normal source files.

Important prompt prefs file:

- `data/prompt_gallery/prompt_gallery_prefs.json`

Other important prompt data:

- `data/prompt_gallery/prompt_gallery_metadata.json`
- `data/prompt_gallery/prompt_gallery_presets.json`
- `data/prompt_gallery/prompt_thumbnails/`
- `data/prompt_gallery/wildcards/`
- `data/prompt_gallery/backups/`

Important LoRA data:

- `data/lora_gallery/lora_gallery_metadata.json`
- `data/lora_gallery/lora_gallery_presets.json`
- `data/lora_gallery/lora_gallery_ui_state.json`

Prompt UI preferences are loaded and saved through:

- `GET /localgalleryunified/prompt/get_ui_prefs`
- `POST /localgalleryunified/prompt/save_ui_prefs`

The backend owns the canonical preference schema in `backend/Local_Prompt_Gallery.py` through `UI_PREF_DEFAULTS`, validators, and normalization.

Prompt route groups:

- Card listing/details/categories: `get_prompts`, `get_prompt`, `get_prompts_by_ids`, `get_categories`, `get_most_used`.
- Card mutation: `create_prompt`, `create_prompt_from_output`, `update_metadata`, `bulk_edit`, `move_prompts_bulk`, `delete_prompt`, `delete_prompts_bulk`, `rename_category`, `delete_category`, `toggle_favorite`, `set_favorite_color`, `reset_usage_count`.
- Media/wildcards/presets/preferences: `thumbnail/{prompt_id}`, `upload_thumbnail`, `assign_thumbnail`, `upload_wildcard_file`, `import_wildcard_file`, `export_wildcard_category`, `get_presets`, `save_preset`, `load_preset`, `delete_preset`, `get_ui_prefs`, `save_ui_prefs`, `get_or_create_prompts`.

LoRA route groups:

- Browser/metadata: `get_loras`, `preview`, `update_metadata`, `get_all_tags`, `sync_civitai`.
- UI state/presets: `get_ui_state`, `set_ui_state`, `get_presets`, `save_preset`, `delete_preset`.
- Civitai web URLs use `LOCAL_LORA_GALLERY_CIVITAI_WEB_BASE_URL` when set, otherwise the backend defaults to `https://civitai.red`.
- The LoRA backend optionally integrates with Nunchaku loaders when `NunchakuFluxLoraLoader` or `NunchakuQwenImageLoraLoader` are present in ComfyUI's node registry.

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

- Prompt UI coordinator/integration layer: `js/prompt/ui.js`
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
- Hidden widget setup and serialization: `js/prompt/stateWidgets.js`
- Prompt constants: `js/prompt/constants.js`
- Prompt UI & DOM helpers: `js/prompt/helpers.js`

Important naming trap:

- Code term `library` usually means product area `Prompt Builder`.
- Product area `Card Manager` is mostly code term `browse`.
- `js/prompt/gallery.js` is a still-wired older renderer path used by the current Prompt UI wrapper. It is distinct from Card Manager and from the Prompt Builder drawer opened by category pills.

Prompt UI call graph:

- `registerPromptGalleryUi()` in `js/prompt/ui.js` installs the node UI and orchestrates smaller modules.
- Prompt Builder rendering delegates to `renderPromptBuilderBar()` and `renderPromptBuilderDrawer()` in `js/prompt/library.js`; old `renderLibrary*` names are aliases.
- Card Manager delegates to `showCardManagerModal()` in `js/prompt/browse.js`; old `showBrowseModal()` is an alias.
- Hidden Prompts are owned by `createMetaTagsController()` in `js/prompt/metaTags.js`; `ui.js` wires the controller into the toolbar and node state.
- Persisted prompt widgets such as `prompt_selection_data`, `prompt_meta_tags`, `prompt_gallery_unique_id_widget`, and `active_sidebar_width` are set up in `js/prompt/stateWidgets.js`.

## LoRA Frontend Map

Use product names from `LORA_UI_TERMINOLOGY.md` when discussing LoRA UI work.

- Main LoRA UI: `js/lora/ui.js`
- LoRA state widgets: `js/lora/stateWidgets.js`
- (Note: `js/lora/helpers.js` was deleted - only contained unused old reorder helper)
- LoRA render helpers: `js/lora/renderers.js`
- LoRA stylesheet: `js/lora/styles.js`

The LoRA frontend is gallery-first. The old top-level `view_mode` (retired list/compact list mode) has been removed from active maintenance code (setViewMode etc.); the key may still appear in loaded saved UI state for old workflow compat.
Current display choices use `cards_display_mode` and `active_display_mode` (thumbnails/compact).
This does not mean compact layouts are gone: 
`cards_display_mode` and `active_display_mode`.

LoRA UI state is keyed by node identity plus the hidden `lora_gallery_unique_id_widget`, so per-node
browser state can survive reloads without being confused with execution state.

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
- `wildcard_auto_attach_thumbnail`
- `active_tab`

Additional hidden DOM/widget helpers:

- `prompt_gallery_unique_id_widget`: prompt-side per-node UI identity.
- `lora_gallery_unique_id_widget`: LoRA-side per-node UI identity.
- `active_sidebar_width`: prompt-side Active Stack width preference.

Processing order:

1. Apply the selected LoRA stack to `model` and `clip`.
2. Build the visible prompt from `prompt_selection_data` and wildcard state.
3. Append enabled `prompt_meta_tags` text after the generated prompt.

`active_tab` is serialized so the UI can reopen the same tab, but it is not used by backend execution logic.

Outputs:

- `MODEL`
- `CLIP`
- `lora_trigger_words`
- `combined_prompt`

Do not change hidden widget names or saved JSON shapes casually. Existing workflows depend on them.

Selection JSON shape notes:

- `prompt_selection_data` is a JSON array. Backend execution reads entries by `prompt_id` when possible, respects `on: false`, applies numeric `weight`, and may fall back to inline `prompt_text`/`prompt`/`name` fields.
- `prompt_meta_tags` is a JSON array of hidden prompt objects. Enabled entries are ordered by `order` or `index`, then appended to `combined_prompt`.
- `wildcard_categories` can be JSON category data or a legacy comma-separated string; category weights are supported by the prompt backend.
- `lora_selection_data` is a JSON array of selected LoRA entries. Important fields include `lora`, `on`, `strength`, `strength_clip`, `selected_preset`, `selected_presets`, and `stack_trigger_presets`.
- LoRA runtime objects may be enriched with preview/metadata fields in the browser, but persistence should keep the workflow payload compact and compatibility-shaped.

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
The backend normalizes and mirrors legacy display values when preferences are read or saved.

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
node --check js\lora\stateWidgets.js
node --check js\lora\renderers.js
node --check js\api\promptApi.js
node --check js\api\loraApi.js
```

## Future AI Notes

- Read `PROMPT_UI_TERMINOLOGY.md` before editing prompt UI.
- Read `LORA_UI_TERMINOLOGY.md` before editing LoRA UI.
- Do not assume `library` means Card Manager.
- Do not add new calls to `/localpromptgallery/*` or `/localloragallery/*` from Unified frontend code.
- Keep legacy standalone installs working by avoiding duplicate standalone node registrations.
- Keep runtime data under `data/` backed up before migrations or merges.
- Prefer focused UI patches over broad prompt-side refactors.
