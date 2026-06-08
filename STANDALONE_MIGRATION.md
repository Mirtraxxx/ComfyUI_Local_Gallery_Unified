# Standalone Migration Notes

Updated: 2026-06-08

## Goal

Make `ComfyUI_Local_Gallery_Unified` capable of running without the legacy sibling folders:

- `Local_Prompt_Gallery`
- `ComfyUI_Local_Lora_Gallery`

The unified frontend still uses the existing route names for compatibility:

- `/localpromptgallery/*`
- `/localloragallery/*`

Keeping those route names avoids a frontend/backend rename pass while the migration is being tested.

## Current Implementation

The unified node now bundles copies of the legacy backend modules:

- `backend/Local_Prompt_Gallery.py`
- `backend/Local_Lora_Gallery.py`

`__init__.py` keeps the current installed setup safe:

- If the old Prompt Gallery folder exists, the unified node does not import its bundled Prompt backend.
- If the old LoRA Gallery folder exists, the unified node does not import its bundled LoRA backend.
- If either old folder is renamed/removed, the unified node imports the matching bundled backend and exposes its node classes/routes.

This avoids double-registering routes while both the old and unified folders are installed.

## Unified-Owned Runtime Data

Runtime data now lives under ignored local folders:

- `data/prompt_gallery/`
- `data/lora_gallery/`

Prompt data copied into `data/prompt_gallery/`:

- `prompt_gallery_metadata.json`
- `prompt_gallery_prefs.json`
- `prompt_gallery_presets.json`
- `prompt_thumbnails/`
- `wildcards/`
- `backups/`
- orphan-thumbnail maintenance reports/artifacts

LoRA data copied into `data/lora_gallery/`:

- `lora_gallery_metadata.json`
- `lora_gallery_presets.json`
- `lora_gallery_ui_state.json`
- existing `.bak` backup files

These files are ignored by git because they are runtime/user data and can be very large.

## Standalone Test Procedure

Do not delete the old folders for the first test.

1. Stop ComfyUI.
2. Rename:
   - `Local_Prompt_Gallery` to `Local_Prompt_Gallery.disabled`
   - `ComfyUI_Local_Lora_Gallery` to `ComfyUI_Local_Lora_Gallery.disabled`
3. Start ComfyUI normally.
4. Confirm the unified node loads without missing-node errors.
5. Confirm Prompt Gallery data loads:
   - categories
   - thumbnails
   - presets
   - wildcard import/selection
6. Confirm LoRA Gallery data loads:
   - LoRA list
   - tags/folders
   - presets
   - metadata editor
7. Run a basic workflow using `Local Gallery: Prompt + LoRA`.

If anything fails, stop ComfyUI and rename the old folders back.

## Verification Notes

Code syntax checks pass for:

- `__init__.py`
- `Local_Gallery_Unified.py`
- `backend/Local_Prompt_Gallery.py`
- `backend/Local_Lora_Gallery.py`

A direct Python import test from this shell is not a reliable full ComfyUI proof because importing ComfyUI's `server` module initializes the local ComfyUI/PyTorch runtime. In this environment, one interpreter is missing `torch`, and another reaches local runtime dependencies before custom-node loading can be isolated.

To verify the migration logic without starting the full ComfyUI runtime, a stubbed import check was run with the old folders temporarily renamed. That check confirmed:

- `LocalGalleryPromptLora`, `LocalPromptGallery`, `LocalLoraGallery`, and `LocalLoraGalleryModelOnly` are exposed by the unified package when the old folders are absent.
- 27 `/localpromptgallery/*` routes are registered from the bundled Prompt backend.
- 10 `/localloragallery/*` routes are registered from the bundled LoRA backend.
- The bundled backend metadata, thumbnail, wildcard, preset, preference, and UI-state paths all resolve inside `ComfyUI_Local_Gallery_Unified`.

A second stubbed import check was run with the old folders present. That check confirmed:

- Only `LocalGalleryPromptLora` is exposed by the unified package in the current installed setup.
- No bundled legacy routes are registered while the old folders are present.

The remaining real-world verification is starting ComfyUI normally after the old folders have been renamed.
