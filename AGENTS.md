# Agent Guide

## Project

- One primary ComfyUI node: `LocalGalleryPromptLora` (`Local Gallery: Prompt + LoRA`).
- The node applies selected LoRAs, builds the visible prompt, then appends enabled hidden prompts.
- Backend entrypoints: `Local_Gallery_Unified.py`, `backend/Local_Prompt_Gallery.py`, and
  `backend/Local_Lora_Gallery.py`.
- Frontend entrypoint: `js/Local_Gallery_Unified.js`; Prompt and LoRA tabs are coordinated by
  `js/prompt/ui.js` and `js/lora/ui.js`.
- Prefer the smallest feature-owning module. Keep refactors feature- or bug-driven.

## Non-Negotiable Contracts

- Unified frontend routes must use `/localgalleryunified/prompt/*` or
  `/localgalleryunified/lora/*`. Do not add calls to legacy `/localpromptgallery/*` or
  `/localloragallery/*` routes.
- `data/prompt_gallery/` and `data/lora_gallery/` contain user/runtime data. Back them up before
  migrations, merges, or destructive cleanup.
- Preserve DOM ids/classes, API fields, preference keys, hidden widget names, and saved JSON shapes
  unless the task explicitly includes a compatibility migration.
- Compatibility-sensitive widgets include `prompt_selection_data`, `prompt_meta_tags`,
  `lora_selection_data`, `wildcard_categories`, `active_tab`,
  `prompt_gallery_unique_id_widget`, and `lora_gallery_unique_id_widget`.
- Selection readers accept legacy raw arrays and versioned `{ "version": 1, "items": [] }`
  envelopes. Do not break either form.
- Bundled Prompt and LoRA routes register unconditionally. Bundled standalone node mappings are
  exposed only when the matching legacy sibling installation is absent; preserve this behavior.

## Prompt UI Map

Confirm the visible surface before editing; several card UIs look alike.

- **Prompt Builder** — normal category card picker: `js/prompt/library.js`,
  `.localprompt-chip`, `.localprompt-chip-thumb`.
- **Card Manager** — browse/manage stored cards: `js/prompt/browse.js`,
  `.localprompt-gallery-item`.
- **Active Stack** — selected prompt sidebar: `js/prompt/activeSidebar.js` and
  `js/prompt/activeStackController.js`.
- **Hidden Prompts** — injected text outside the visible stack: `js/prompt/metaTags.js`.
- **Library Workspace** — management shell/navigation: `js/prompt/workspace.js`.
- `library` in older code usually means **Prompt Builder**, while `browse` usually means
  **Card Manager**.
- `js/prompt/gallery.js` is a separate older renderer path; verify that it is actually the surface
  being changed.
- Avoid native HTML drag/drop in card surfaces because ComfyUI may treat drops as workflow imports.

## LoRA UI Map

- **LoRA Browser** — discovery/filtering: `js/lora/ui.js` plus focused browser, folder, metadata,
  preset, and Civitai modules.
- **LoRA Stack** — selected LoRAs: `js/lora/activeStackController.js` and
  `js/lora/activeStackState.js`.
- State widgets: `js/lora/stateWidgets.js`; pure markup helpers: `js/lora/renderers.js`;
  API wrapper: `js/api/loraApi.js`.
- `lora_selection_data` items depend on fields including `lora`, `on`, `strength`,
  `strength_clip`, `selected_preset`, `selected_presets`, and `stack_trigger_presets`.
- Browser-only preview/metadata fields should not be persisted into the compact selection payload.
- `view_mode` is legacy compatibility state. Current display controls use `cards_display_mode` and
  `active_display_mode`.

## Verification

Run checks proportional to the change:

```powershell
node --check <changed-js-files>
node --test tests\*.test.mjs
python -m py_compile Local_Gallery_Unified.py __init__.py backend\Local_Prompt_Gallery.py backend\Local_Lora_Gallery.py
python -m unittest discover -s tests -p 'test_*.py'
git diff --check
```

Restart ComfyUI after Python/backend changes. For UI changes, smoke-test the exact surface changed,
workflow reload, and preference persistence after `F5`.
