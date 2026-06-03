# ComfyUI Local Gallery Unified - AI Handoff

## Purpose

This custom node combines the legacy local prompt and LoRA galleries into one ComfyUI workflow node:

- `LocalPromptGallery`: prompt library, prompt selection, wildcard/category prompt generation, prompt metadata, prompt thumbnails, presets, and prompt UI preferences.
- `LocalLoraGallery`: LoRA browser, LoRA selection, strength settings, trigger words, metadata editing, Civitai sync, presets, and LoRA application.

The unified node is exposed as `LocalGalleryPromptLora` with display name **Local Gallery: Prompt + LoRA** in the **Asset Gallery** category.

This project is still a unification wrapper. It depends on the legacy Python node classes and legacy HTTP routes for the actual prompt and LoRA gallery data.

## Main Files

- `__init__.py`
  - Registers `LocalGalleryPromptLora`.
  - Exposes `WEB_DIRECTORY = "./js"` so ComfyUI loads the frontend.
- `Local_Gallery_Unified.py`
  - Defines the backend ComfyUI node.
  - Delegates LoRA loading to `LocalLoraGallery`.
  - Delegates prompt generation to `LocalPromptGallery`.
  - Caches unchanged LoRA outputs so prompt-only reruns do not reapply the same LoRA stack.
- `js/Local_Gallery_Unified.js`
  - Main frontend entrypoint.
  - Registers tab setup, LoRA UI, and Prompt UI.
- `js/tabs.js`
  - Adds the Prompt/LoRA tab switcher and stores the selected tab in `active_tab`.

## Prompt Frontend Modules

- `js/prompt/ui.js`
  - Main prompt UI registration and orchestration.
  - Owns node/widget setup, hidden widget binding, prompt selection state, wildcard controls, prompt source selection, pagination wiring, and callbacks passed to extracted modules.
- `js/prompt/constants.js`
  - Prompt UI constants such as page size, favorite colors, category palette, thumbnail bounds, and defaults.
- `js/prompt/helpers.js`
  - Pure prompt helpers for text extraction/normalization, color conversion, thumbnail sizing, active sidebar sizing math, pinned ordering, managed prompt control HTML, prompt preview HTML, and output preview URLs.
- `js/prompt/dialogs.js`
  - Add prompt, edit prompt, upload thumbnail, import wildcard file, and create-from-last-output dialogs.
- `js/prompt/contextMenus.js`
  - Prompt card/context action menus.
- `js/prompt/previews.js`
  - Hover/info preview show/hide helpers.
- `js/prompt/gallery.js`
  - Main prompt gallery card renderer and simple category/filter helpers.
- `js/prompt/library.js`
  - Prompt library tab bar, drawer data loading, and drawer renderer.
- `js/prompt/activeSidebar.js`
  - Active prompt sidebar renderer, open-state styling, width preference handling, and resize drag handling.
- `js/prompt/browse.js`
  - Browse modal.
- `js/prompt/presets.js`
  - Prompt preset modal.
- `js/prompt/settings.js`
  - Prompt settings modal.
- `js/prompt/wildcards.js`
  - Wildcard category selection modal.

## LoRA Frontend Modules

- `js/lora/ui.js`
  - Main LoRA UI registration, rendering, filtering, metadata editing, Civitai sync UI, presets, and selected LoRA workflow state.
- `js/lora/helpers.js`
  - Focused LoRA helpers, currently including selected-LoRA reorder logic.

## Shared Frontend Modules

- `js/api/promptApi.js`
  - Centralizes calls to legacy `/localpromptgallery/*` routes.
- `js/api/loraApi.js`
  - Centralizes calls to legacy `/localloragallery/*` routes.
- `js/shared/dom.js`
  - Shared DOM utilities such as HTML escaping.
- `js/shared/json.js`
  - Safe JSON parse/stringify helpers for hidden widget state.
- `js/shared/widgets.js`
  - ComfyUI widget hide/collapse helpers.

## Backend Node Contract

Class: `LocalGalleryPromptLora`

Inputs:

- Required:
  - `model`: `MODEL`
  - `clip`: `CLIP`
- Optional:
  - `seed`: `INT`
- Hidden/frontend-managed:
  - `lora_selection_data`: serialized JSON string, default `[]`
  - `prompt_selection_data`: serialized JSON string, default `[]`
  - `wildcard_categories`: serialized category/weight data
  - `wildcard_mode`: string, usually `off` or `on`
  - `active_tab`: string, `prompt` or `lora`

Outputs:

- `MODEL`: model after selected LoRAs are applied.
- `CLIP`: clip after selected LoRAs are applied.
- `lora_trigger_words`: combined trigger words returned by `LocalLoraGallery`.
- `combined_prompt`: prompt text returned by `LocalPromptGallery`.

## Runtime Dependencies

This node requires both legacy nodes to be enabled in ComfyUI:

- `LocalLoraGallery`
- `LocalPromptGallery`

The backend looks them up from `nodes.NODE_CLASS_MAPPINGS`. If either class is missing, execution raises a runtime error explaining which legacy gallery is required.

## Backend Data Flow

1. The frontend stores LoRA choices in `lora_selection_data`.
2. The frontend stores prompt choices in `prompt_selection_data`.
3. `LocalGalleryPromptLora.process()` resolves the legacy node classes.
4. LoRA processing runs first:
   - Builds a cache key from `id(model)`, `id(clip)`, and the legacy LoRA change signature.
   - Reuses cached LoRA outputs when the LoRA stack is unchanged.
   - Otherwise calls `LocalLoraGallery.load_loras(model, clip, "unified-gallery", lora_selection_data)`.
5. Prompt processing runs second:
   - Calls `LocalPromptGallery.process(seed, selection_data, wildcard_categories, wildcard_mode)`.
   - Extracts the first prompt result as `combined_prompt`.
6. Returns updated model/clip, LoRA trigger words, and combined prompt text.

## Change Detection

`IS_CHANGED()` returns a JSON string containing:

- legacy LoRA change signature, if `LocalLoraGallery.IS_CHANGED()` exists
- prompt selection data
- wildcard categories
- wildcard mode
- seed

`active_tab` is accepted by the backend contract but is not included in the change signature because switching the visible tab should not rerun generation.

Prompt seed/wildcard changes can rerun the unified node even when the selected LoRAs are unchanged. The LoRA cache prevents prompt-only reruns from reapplying the same LoRA stack.

## Frontend Registration

`js/Local_Gallery_Unified.js` registers:

- `LocalGalleryPromptLora.Tabs`
  - Adds the Prompt Gallery / LoRA Gallery tab switcher.
  - Stores selected tab in hidden `active_tab`.
  - Shows one gallery DOM widget while hiding the other.
- `registerLoraGalleryUi(app)`
  - Registers `LocalGalleryPromptLora.LoraUI`.
  - Adds hidden `lora_selection_data`.
  - Adds a per-node LoRA gallery id.
- `registerPromptGalleryUi(app, api)`
  - Registers `LocalGalleryPromptLora.PromptUI`.
  - Adds hidden `prompt_selection_data`, `wildcard_mode`, and `wildcard_categories`.
  - Adds a per-node prompt gallery id.
  - Tracks the last generated image/video from ComfyUI execution events for thumbnail and prompt creation features.

## LoRA UI Capabilities

The LoRA side supports:

- Searching/filtering LoRAs by tag and folder.
- OR/AND tag filter modes.
- Pagination and compact chooser flows.
- Card view and compact row view.
- Selecting multiple LoRAs into the workflow.
- Drag reordering selected LoRAs.
- Enabling/disabling selected LoRAs.
- Editing model and CLIP strengths.
- Model-only mode awareness from node name checks.
- Trigger words display/editing.
- Metadata editing for tags, trigger words, trigger presets, and download URL.
- Civitai metadata sync.
- Presets for LoRA selection stacks.
- Per-node UI state persistence through legacy LoRA gallery endpoints.

## Prompt UI Capabilities

The prompt side supports:

- Prompt search/filtering.
- Category filtering.
- Main gallery card rendering.
- Active selected prompt list and active sidebar.
- Prompt library tabs:
  - most used
  - pinned/favorites
  - custom categories
- Category tab ordering and category colors.
- Prompt selection ordering.
- Per-selection enable/disable and weight controls.
- Prompt editing and metadata updates.
- Prompt creation.
- Prompt creation from the last generated output.
- Thumbnail upload and assignment.
- Prompt deletion and bulk deletion.
- Category rename/delete.
- Favorite/pinned prompt handling.
- Pinned prompt ordering.
- Most-used prompt tracking.
- Presets containing selected prompts plus wildcard settings.
- Prompt source node selection from compatible text/show-text nodes.
- Resizable active sidebar.
- UI preferences persisted through legacy prompt gallery endpoints.

Wildcard support:

- `wildcard_mode` controls whether wildcard/category generation is active.
- `wildcard_categories` stores selected categories and weights.
- Wildcard files can be uploaded/imported through the prompt UI.

## Primary Legacy Prompt Routes

Expected from the legacy prompt node:

- `GET /localpromptgallery/get_prompts`
- `GET /localpromptgallery/get_prompt`
- `GET /localpromptgallery/get_categories`
- `GET /localpromptgallery/get_most_used`
- `GET /localpromptgallery/get_ui_prefs`
- `GET /localpromptgallery/get_presets`
- `POST /localpromptgallery/get_prompts_by_ids`
- `POST /localpromptgallery/update_metadata`
- `POST /localpromptgallery/create_prompt`
- `POST /localpromptgallery/create_prompt_from_output`
- `POST /localpromptgallery/delete_prompt`
- `POST /localpromptgallery/delete_prompts_bulk`
- `POST /localpromptgallery/upload_thumbnail`
- `POST /localpromptgallery/toggle_favorite`
- `POST /localpromptgallery/set_favorite_color`
- `POST /localpromptgallery/upload_wildcard_file`
- `POST /localpromptgallery/import_wildcard_file`
- `POST /localpromptgallery/delete_category`
- `POST /localpromptgallery/rename_category`
- `POST /localpromptgallery/save_ui_prefs`
- `POST /localpromptgallery/save_preset`
- `POST /localpromptgallery/load_preset`
- `POST /localpromptgallery/delete_preset`
- `POST /localpromptgallery/get_or_create_prompts`
- `POST /localpromptgallery/reset_usage_count`
- `POST /localpromptgallery/assign_thumbnail`

## Primary Legacy LoRA Routes

Expected from the legacy LoRA node:

- `GET /localloragallery/get_loras`
- `GET /localloragallery/get_all_tags`
- `GET /localloragallery/get_presets`
- `GET /localloragallery/get_ui_state`
- `POST /localloragallery/set_ui_state`
- `POST /localloragallery/update_metadata`
- `POST /localloragallery/sync_civitai`
- `POST /localloragallery/save_preset`
- `POST /localloragallery/delete_preset`

## Serialized State

Important graph/prompt state is stored as ComfyUI node properties and hidden widgets:

- `lora_selection_data`
  - JSON array of selected LoRA entries.
  - Read through a compatibility helper that also accepts future object-wrapped `items`.
  - Expected to include LoRA filename/name, enabled state, strengths, and preset/trigger settings.
- `prompt_selection_data`
  - JSON array of selected prompt entries.
  - Read through a compatibility helper that also accepts future object-wrapped `items`.
  - Expected to include prompt identifiers/text plus per-selection controls.
- `wildcard_mode`
  - String state for wildcard generation.
- `wildcard_categories`
  - Serialized category selection data, including weights when enabled.
- `active_tab`
  - Frontend convenience state for restoring Prompt/LoRA tab visibility.
- `prompt_gallery_unique_id` and `lora_gallery_unique_id`
  - Per-node identifiers for persisted UI state.

Avoid changing these JSON shapes casually. The legacy Python nodes and existing saved workflows depend on them.

## Maintenance Notes

- If the node fails at execution, first verify that `LocalLoraGallery` and `LocalPromptGallery` are loaded in ComfyUI.
- If the UI loads but gallery data is empty, inspect the legacy `/localloragallery/*` and `/localpromptgallery/*` routes.
- If workflows reload with missing selections, inspect hidden widget serialization for `lora_selection_data` and `prompt_selection_data`.
- If prompt output does not update, check `IS_CHANGED()` inputs, especially seed, wildcard settings, and prompt selection JSON.
- If LoRA output does not update, check whether legacy `LocalLoraGallery.IS_CHANGED()` is returning a changed signature for changed LoRA selection data.
- If prompt-only generations are slow, verify the LoRA cache key is stable for unchanged base model, CLIP, and LoRA selection data.
- After frontend refactors, smoke test workflow load, Prompt/LoRA tab switching, LoRA selected-list reorder, prompt library tabs, pinned drawer reorder, selected prompt reorder, active sidebar open/resize, context menus, and prompt creation from last output.
- Keep extension registration order simple: tabs setup first, then LoRA UI, then Prompt UI.
