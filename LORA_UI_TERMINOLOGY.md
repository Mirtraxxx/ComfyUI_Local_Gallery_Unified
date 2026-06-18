# LoRA UI Terminology

Updated: 2026-06-18

This file defines product terms for the LoRA side of `ComfyUI_Local_Gallery_Unified`.
Use these names when discussing LoRA work so future refactors do not inherit the old
single-file ambiguity from `js/lora/ui.js`.

For backend/routes/data architecture, also read `AI_NODE_OVERVIEW.md`.

## Product Areas

### LoRA Browser

The main LoRA discovery and selection surface inside the Unified node.

Current code mapping:

- Main UI coordinator: `js/lora/ui.js`
- Gallery grid/cards: `.locallora-gallery` / `.locallora-lora-card`
- Active drawer cards: `.locallora-lora-item` (inside `.locallora-active-chips` / `#...-active-chips` in the sidebar)
- API wrapper: `js/api/loraApi.js`
- Pure card/list HTML helpers: `js/lora/renderers.js`
- Hidden widget setup: `js/lora/stateWidgets.js`
- Stylesheet: `js/lora/styles.js`

The LoRA Browser currently owns filtering, paging, preview cards, active drawer cards,
metadata-edit entry points, trigger preset controls, selection changes, folder pin/order/color
management, display controls, stack preset actions, Civitai sync, and collapse/resize behavior.
Future cleanup should split these implementation details without changing user-visible behavior.

### LoRA Stack

The selected LoRAs that will be applied to the model/clip outputs.

Current code mapping:

- Serialized workflow widget/key: `lora_selection_data`
- Frontend runtime state: `node_instance.loraData`
- Selected list container: `.locallora-active-chips` (id: `#...-active-chips`)
- Active drawer item: `.locallora-lora-item`
- Reorder: inline pointer-based drag in `js/lora/ui.js` (bindMouseReorderHandle)

Do not change the saved `lora_selection_data` array shape casually. Existing workflows
depend on fields such as `on`, `lora`, `strength`, `strength_clip`, `selected_preset`,
`selected_presets`, and `stack_trigger_presets`.

The frontend runtime objects can be richer than the serialized stack. Browser entries may carry
`preview_url`, `preview_type`, `tags`, `trigger_words`, `trigger_presets`, and `download_url`, but
selection persistence intentionally strips preview/metadata fields before writing
`lora_selection_data`.

### LoRA Filters

The browser controls used to narrow visible LoRAs.

Current code mapping:

- Tag filter: `filter_tag`
- Filter mode: `filter_mode`
- Folder filter: `filter_folder`
- View mode: `view_mode` is kept only in loaded UI state for old workflow compatibility.
  The active implementation uses `active_display_mode` and `cards_display_mode`.
  (The old `setViewMode`/`currentViewMode` maintenance code has been removed.)
- Current display choices: `cards_display_mode` for browser cards and `active_display_mode`
  for the selected LoRA Stack.
- Transient UI state routes: `/localgalleryunified/lora/get_ui_state` and
  `/localgalleryunified/lora/set_ui_state`

These values are UI state, not execution state. Keep them separate from
`lora_selection_data`.

### LoRA Metadata

The editable per-LoRA metadata used by the browser and trigger-word output.

Current code mapping:

- Runtime data file: `data/lora_gallery/lora_gallery_metadata.json`
- Backend route: `/localgalleryunified/lora/update_metadata`
- Current metadata fields: `hash`, `tags`, `trigger_words`, `trigger_presets`,
  and `download_url`
- Runtime/card preview fields: `preview_url` and `preview_type`
- Preview route: `/localgalleryunified/lora/preview`

Be careful with metadata migrations. Some read paths currently normalize or migrate
metadata keys as they browse the LoRA folder.

Backend sync can use Civitai metadata and preview data, while the frontend may use those preview
fields without saving them into the selected stack payload.

### LoRA Presets

Saved LoRA stack configurations and per-LoRA trigger preset controls.

Current code mapping:

- Stack presets data file: `data/lora_gallery/lora_gallery_presets.json`
- Stack preset routes: `/localgalleryunified/lora/get_presets`,
  `/localgalleryunified/lora/save_preset`, and `/localgalleryunified/lora/delete_preset`
- Per-LoRA trigger presets: `trigger_presets` in LoRA metadata

## Naming Guidance

Preferred product names:

- `LoRA Browser`: the main LoRA browsing and selection surface.
- `LoRA Stack`: selected LoRAs that affect execution.
- `LoRA Filters`: tag, folder, mode, and view controls.
- `LoRA Metadata`: editable per-LoRA stored metadata.
- `LoRA Presets`: saved stacks and trigger preset choices.

## Do Not Rename Yet

Leave these alone unless doing a dedicated compatibility pass:

- Persisted widget/key names such as `lora_selection_data`.
- UI state keys such as `filter_tag`, `filter_mode`, `filter_folder`, `is_collapsed`,
  and (legacy only) `view_mode`.
- DOM classes such as `.locallora-gallery`, `.locallora-lora-card`,
  `.locallora-lora-item`, and `.locallora-active-chips`.
- API routes and backend JSON fields.
- Runtime files under `data/lora_gallery/`.

## Refactor Notes

Safe first-pass cleanup:

- Extract state/widget setup out of `js/lora/ui.js`.
- Extract pure HTML/render helpers for cards, active drawer cards, trigger preset controls,
  and metadata editor sections.
- Reorder logic lives in `js/lora/ui.js` (bindMouseReorderHandle). `js/lora/helpers.js` was removed (contained only unused moveSelectedLora).
- Keep route calls under `/localgalleryunified/lora/*`.

Higher-risk cleanup:

- Changing the `lora_selection_data` shape.
- Reworking metadata key migration.
- Moving preview assets or changing preview filename conventions.
- Unifying LoRA and Prompt preference schemas without migration testing.
