# Agent Guide

## Project

- One primary ComfyUI node: `LocalGalleryPromptLora` (`Local Gallery: Prompt + LoRA`).
- The node applies selected LoRAs, builds the visible prompt, then appends enabled hidden prompts.
- Backend entrypoints: `Local_Gallery_Unified.py`, `backend/Local_Prompt_Gallery.py` (a thin facade that
  imports the Prompt route modules and node), and `backend/Local_Lora_Gallery.py` (the same for LoRA).
- Prompt backend modules (`backend/`): `prompt_store.py` (paths, JSON IO, metadata cache and
  `MetadataTransaction`), `prompt_prefs.py` (UI prefs and presets), `prompt_cards.py` and `prompt_bulk.py`
  (pure ordering, indexing and bulk-edit logic), `prompt_media.py` (thumbnail files),
  `prompt_wildcards.py` (export ordering, debounced cycle-state flush), `comfy_queue.py`,
  `prompt_routes_{query,edit,thumbnails,settings,wildcards}.py` (one route group each), and
  `prompt_node.py` (the `LocalPromptGallery` node). Module-level caches rebound with `global` live only in
  the module that owns them; other modules go through that module's functions.
  `backend/card_thumbnails.py` serves downscaled WebP card thumbnails (`/prompt/thumbnail/{id}?w=`),
  cached in `data/prompt_gallery/card_thumbnail_cache/`.
- LoRA backend modules (`backend/`): `lora_json.py` (guarded JSON IO and backups), `lora_lookup.py` (pure
  metadata matching by hash or basename), `lora_previews.py` (preview files), `lora_library.py` (data paths,
  metadata/UI-state/preset storage, and the inventory cache), `lora_routes_{previews,civitai,library}.py`
  (route groups), and `lora_nodes.py` (`LocalLoraGallery`, `LocalLoraGalleryModelOnly`, Nunchaku detection).
  The tests in `tests/` patch names on the module that uses them, not on the facade.
- Frontend entrypoint: `js/Local_Gallery_Unified.js`; Prompt and LoRA tabs are coordinated by
  `js/prompt/ui.js` and `js/lora/ui.js`. `js/tabs.js` mounts the Prompts | LoRAs switch at the
  start of each gallery's top bar.
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

## Shared Chrome

- Anything a user sees on both tabs (bars, buttons, pills, popovers, sidebar surface, forms,
  dialogs, menus) is styled once in `js/shared/chrome.js` as `lg-*` classes and `--lg-*` tokens,
  scoped under `.lg-root`. Side sheets (`js/prompt/styles.js`, `js/lora/styles.js`) style only
  their own content (cards, stacks, workspace pages) and must use the `--lg-*` tokens.
- Overlays and menus mounted on `document.body` sit outside the node, so they carry `lg-root`
  themselves (`createCenteredOverlay`, prompt context menus, Card Manager dialogs).
- The LoRA sheet is inserted after the chrome sheet, so `.locallora-root .x` rules beat chrome
  rules of equal specificity: delete conflicting visual properties instead of overriding them.
- Shared behavior helpers: `popovers.js`, `autoHideBar.js`, `pillStrip.js`, `pillMenu.js`,
  `icons.js` (one stroke icon set).

## Prompt UI Map

Confirm the visible surface before editing; several card UIs look alike.

- **Prompt Builder** — normal category card picker: `js/prompt/library.js`,
  `.localprompt-chip`, `.localprompt-chip-thumb`.
- **Card Manager** — browse/manage stored cards: `js/prompt/browse.js`,
  `.localprompt-gallery-item`.
- **Active Stack** — selected prompt sidebar: `js/prompt/activeSidebar.js` and
  `js/prompt/activeStackController.js`.
- **Hidden Prompts** — injected text outside the visible stack: `js/prompt/metaTags.js`.
- **Library Workspace** — management shell/navigation: `js/prompt/workspace.js`; pages come from
  `browse.js` (Cards), `presets.js`, and `dialogs.js` (Add, Import, Export, Upload, Edit).
- **Category strip** — pinned pills, overflow list, and pill drag: `js/prompt/categoryStripController.js`.
- Shared Prompt state and API wrappers (plus the wildcard auto-attach queue):
  `js/prompt/galleryNode.js`; per-scope sort modes and manual orders: `js/prompt/sortOrder.js`.
- `library` in older code usually means **Prompt Builder**, while `browse` usually means
  **Card Manager**.
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
node --input-type=module --check < <changed-js-file>   # plain --check misses ESM errors
node --test tests\*.test.mjs
python -m py_compile Local_Gallery_Unified.py __init__.py backend\*.py
python -m unittest discover -s tests -p 'test_*.py'
git diff --check
```

Restart ComfyUI after Python/backend changes. For UI changes, smoke-test the exact surface changed,
workflow reload, and preference persistence after `F5`.
