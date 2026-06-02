# ComfyUI Local Gallery Unified - AI Handoff

## Purpose

This custom node combines two existing ComfyUI gallery nodes into one workflow node:

- `LocalPromptGallery`: prompt library, prompt selection, wildcard/category prompt generation.
- `LocalLoraGallery`: LoRA browser, LoRA selection, strength settings, trigger words, and LoRA application.

The unified node is exposed as `LocalGalleryPromptLora` with display name **Local Gallery: Prompt + LoRA** in the **Asset Gallery** category.

## Files

- `__init__.py`
  - Registers the Python node mappings.
  - Exposes `WEB_DIRECTORY = "./js"` so ComfyUI loads the frontend extension.
- `Local_Gallery_Unified.py`
  - Defines the backend ComfyUI node.
  - Delegates actual prompt and LoRA processing to the legacy nodes.
- `js/Local_Gallery_Unified.js`
  - Defines the unified frontend UI.
  - Embeds prompt gallery UI and LoRA gallery UI into the same node.
  - Adds Prompt/LoRA tabs and hidden serialized widgets.

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

This node requires the legacy nodes to already be enabled in ComfyUI:

- `LocalLoraGallery`
- `LocalPromptGallery`

The Python backend looks these up from `nodes.NODE_CLASS_MAPPINGS`. If either mapping is missing, execution raises a runtime error explaining which legacy gallery is required.

## Backend Data Flow

1. The frontend stores LoRA choices in `lora_selection_data`.
2. The frontend stores prompt choices in `prompt_selection_data`.
3. On execution, `LocalGalleryPromptLora.process()` instantiates the legacy node classes.
4. LoRA processing runs first:
   - Calls `LocalLoraGallery.load_loras(model, clip, "unified-gallery", lora_selection_data)`.
   - Receives updated `model`, updated `clip`, and LoRA trigger words.
5. Prompt processing runs second:
   - Calls `LocalPromptGallery.process(seed, selection_data, wildcard_categories, wildcard_mode)`.
   - Extracts the first prompt result as `combined_prompt`.
6. Returns updated model/clip plus both text outputs.

## Change Detection

`IS_CHANGED()` returns a JSON string containing:

- legacy LoRA change signature, if `LocalLoraGallery.IS_CHANGED()` exists
- prompt selection data
- wildcard categories
- wildcard mode
- seed

This causes ComfyUI to re-run the node when selected assets, wildcard state, or seed changes.

## Frontend Architecture

`js/Local_Gallery_Unified.js` registers three ComfyUI extensions against `LocalGalleryPromptLora`:

- `LocalGalleryPromptLora.Tabs`
  - Adds a two-tab switcher: **Prompt Gallery** and **LoRA Gallery**.
  - Stores selected tab in hidden `active_tab`.
  - Shows one gallery DOM widget while hiding the other.
- `LocalGalleryPromptLora.LoraUI`
  - Ports/adapts the legacy LoRA gallery UI into the unified node.
  - Adds hidden `lora_selection_data`.
  - Adds a per-node `lora_gallery_unique_id`.
- `LocalGalleryPromptLora.PromptUI`
  - Ports/adapts the legacy prompt gallery UI into the unified node.
  - Adds hidden `prompt_selection_data`, `wildcard_mode`, and `wildcard_categories`.
  - Adds a per-node `prompt_gallery_unique_id`.
  - Tracks the last generated image/video from ComfyUI execution events for thumbnail/prompt creation features.

## LoRA UI Capabilities

The LoRA gallery side supports:

- Searching/filtering LoRAs by tag and folder.
- OR/AND tag filter modes.
- Pagination and large-list compact chooser.
- Card view and compact row view.
- Selecting multiple LoRAs into the workflow.
- Reordering selected LoRAs.
- Enabling/disabling selected LoRAs.
- Editing model strength and clip strength.
- Model-only mode awareness from node name checks.
- Trigger words display/editing.
- Metadata editing:
  - tags
  - trigger words
  - trigger presets
  - download URL
- Civitai metadata sync.
- Presets for LoRA selection stacks.
- Per-node UI state persistence via legacy LoRA gallery endpoints.

Primary backend endpoints expected from the legacy LoRA node:

- `GET /localloragallery/get_loras`
- `GET /localloragallery/get_all_tags`
- `GET /localloragallery/get_presets`
- `GET /localloragallery/get_ui_state`
- `POST /localloragallery/set_ui_state`
- `POST /localloragallery/update_metadata`
- `POST /localloragallery/sync_civitai`
- `POST /localloragallery/save_preset`
- `POST /localloragallery/delete_preset`

## Prompt UI Capabilities

The prompt gallery side supports:

- Prompt search/filtering.
- Category filtering.
- Active selected prompt list.
- Prompt library tabs:
  - active
  - most used
  - pinned/favorites
  - custom categories
- Category tab ordering and custom colors.
- Prompt selection ordering.
- Prompt editing and metadata updates.
- Prompt creation.
- Prompt creation from the last generated output.
- Thumbnail upload and assignment.
- Prompt deletion and bulk deletion.
- Category rename/delete.
- Favorite/pinned prompt handling.
- Most-used prompt tracking.
- Presets containing selected prompts plus wildcard settings.
- Prompt source node selection from compatible text/show-text nodes.
- Resizable active sidebar.
- UI preferences persisted through legacy prompt gallery endpoints.

Wildcard support:

- `wildcard_mode` controls whether wildcard/category generation is active.
- `wildcard_categories` stores selected categories and weights.
- Wildcard files can be uploaded/imported through the prompt UI.

Primary backend endpoints expected from the legacy prompt node:

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

## Serialized State

Important graph/prompt state is stored as ComfyUI node properties and hidden widgets:

- `lora_selection_data`
  - JSON array of selected LoRA entries.
  - Expected to include LoRA filename/name, enabled state, strengths, and preset/trigger settings.
- `prompt_selection_data`
  - JSON array of selected prompt entries.
  - Expected to include prompt identifiers/text plus per-selection controls.
- `wildcard_mode`
  - String state for wildcard generation.
- `wildcard_categories`
  - Serialized category selection data, including weights when enabled.
- `active_tab`
  - Frontend-only convenience state for restoring Prompt/LoRA tab visibility.
- `prompt_gallery_unique_id` and `lora_gallery_unique_id`
  - Per-node identifiers for persisted UI state.

## Important Design Detail

This is a unification wrapper, not a full standalone replacement for the legacy galleries.

The unified node depends on:

- legacy Python node classes for execution
- legacy HTTP routes for gallery data and metadata
- copied/adapted frontend logic for both gallery UIs

Any future AI or maintainer should avoid changing the serialized JSON shapes casually, because those shapes are consumed by the legacy `load_loras()` and `process()` methods.

## Maintenance Notes

- If the node fails at execution, first verify that `LocalLoraGallery` and `LocalPromptGallery` are loaded in ComfyUI.
- If the UI loads but gallery data is empty, inspect the legacy `/localloragallery/*` and `/localpromptgallery/*` routes.
- If workflows reload with missing selections, inspect hidden widget serialization for `lora_selection_data` and `prompt_selection_data`.
- If prompt output does not update, check `IS_CHANGED()` inputs, especially seed, wildcard settings, and prompt selection JSON.
- If LoRA output does not update, check whether legacy `LocalLoraGallery.IS_CHANGED()` is returning a stable signature for changed selection data.
- The JavaScript file is large because it contains both adapted gallery frontends. Refactoring should preserve extension registration order and widget names.
