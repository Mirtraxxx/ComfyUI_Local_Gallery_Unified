# Remaining Work

Updated: 2026-07-21

This file is the current practical work queue. Older baseline audits and migration plans were removed because they described pre-standalone architecture and stale legacy-route assumptions.

## Current State

The project is now in a usable modular shape:

- Unified owns namespaced Prompt and LoRA routes.
- Unified imports bundled Prompt and LoRA backend classes directly.
- Legacy standalone Prompt/LoRA installs can remain installed beside Unified.
- Prompt frontend code has been split into focused modules.
- Prompt UI preferences have a backend schema plus frontend normalization helpers.
- Prompt Builder, Card Manager, Active Stack, and Hidden Prompts are documented in `PROMPT_UI_TERMINOLOGY.md`.
- LoRA Browser, LoRA Stack, LoRA Filters, LoRA Metadata, and LoRA Presets are documented in `LORA_UI_TERMINOLOGY.md`.

Approximate current frontend sizes:

| File | Lines | Notes |
| --- | ---: | --- |
| `js/prompt/styles.js` | 4604 | Largest prompt file; CSS-only, but easy to patch the wrong surface. |
| `js/prompt/ui.js` | 2905 | Prompt coordinator; still important but no longer carries every prompt feature. |
| `js/lora/ui.js` | 1539 | LoRA coordinator after Active Stack extraction. |
| `js/lora/activeStackController.js` | 396 | LoRA Stack rendering, controls, and pointer reorder. |
| `js/lora/styles.js` | 2459 | LoRA CSS-only file; large enough to deserve careful surface checks. |
| `js/prompt/library.js` | 762 | Prompt Builder card drawer. |
| `js/prompt/dialogs.js` | 741 | Prompt dialogs using shared surface primitives. |
| `js/prompt/settings.js` | 618 | Settings UI. |
| `js/prompt/browse.js` | 799 | Card Manager. |
| `js/prompt/preferences.js` | 107 | Frontend preference helpers. |

## Current LoRA Cleanup State

### `js/lora/ui.js`

This is now a coordinator. Further extraction should be tied to a feature or concrete maintenance
problem rather than line-count reduction.

Completed extractions include card HTML builders, selected LoRA Stack rendering and interactions,
preset controls, metadata editing, folder management, Civitai sync, selection serialization, and
display-state normalization.

Reorder logic lives in `js/lora/activeStackController.js`; pure swap and hydration behavior lives
in `js/lora/activeStackState.js`.

## Prompt-Side Guidance

Do not do broad prompt refactors just to reduce line count.

Prompt-side work should be feature or bug driven. Before editing prompt UI, identify the product area:

- Prompt Builder: `js/prompt/library.js`, `.localprompt-chip`, `.localprompt-chip-thumb`.
- Card Manager: `js/prompt/browse.js`, `.localprompt-gallery-item`.
- Active Stack: `js/prompt/activeSidebar.js`.
- Hidden Prompts: `js/prompt/metaTags.js`.
- Settings: `js/prompt/settings.js`.

The most common failure mode is patching a visually similar but wrong surface. Check `PROMPT_UI_TERMINOLOGY.md` first.

## Cleanup Status

### 1. Lifecycle Setup Cleanup (Completed 2026-07-21)

Tabs, Prompt UI, and LoRA UI now register through one extension in
`js/Local_Gallery_Unified.js`. Prompt and LoRA expose lifecycle factories, and the entrypoint
composes tab, LoRA, and Prompt node setup in a fixed order.

### 2. LoRA UI Modularization (Baseline Completed 2026-07-21)

Extract one area at a time and smoke test after each extraction.

Recommended next step: keep further LoRA extraction feature-driven and prioritize the shared
modal/notification helpers below rather than splitting the coordinator solely by line count.

### 3. Shared Modal/Notification Helpers (Completed 2026-07-21)

Native alerts and confirmations route through `js/shared/nativeDialogs.js`. Reusable overlay,
workspace-panel, backdrop-dismiss, and centered-dialog behavior lives in
`js/shared/modalSurfaces.js`. Specialized bulk-edit and feature-specific surfaces remain with their
owners. Context-menu and preview document listeners now have explicit cleanup on replacement and
node removal.

Optional product work:

- Replace native alert presentation with a lightweight notification layer when product behavior is
  defined; keep the shared wrapper as the compatibility entry point.

### 4. Saved State Versioning (Completed 2026-07-21)

New saves use `{ "version": 1, "items": [] }`. JavaScript and Python readers accept both this
envelope and legacy raw arrays. Existing workflows therefore load unchanged and migrate when their
selection state is next saved. Migration coverage exists in JavaScript and Python tests.

No additional behavior-preserving refactor is currently queued. Further coordinator extraction
should be driven by a feature, bug, or measured maintenance problem.

## Known Cautions

- Runtime prompt/LoRA data lives under `data/`; back it up before migrations.
- The standalone legacy Prompt Gallery may still have its own separate root data. If recent prompts appear missing, compare/merge data rather than assuming deletion.
- Frontend route calls from Unified should use `/localgalleryunified/prompt/*` and `/localgalleryunified/lora/*`.
- Old route names in external legacy nodes are fine; old route names in Unified frontend code are suspicious.
- `js/prompt/gallery.js` is not the normal Prompt Builder path. Verify visibility before editing.

## Verification Habit

For JS-only prompt UI changes:

```powershell
node --check js\prompt\styles.js
node --check js\prompt\ui.js
node --check js\prompt\library.js
node --check js\prompt\browse.js
```

For backend or route changes:

```powershell
python -m py_compile Local_Gallery_Unified.py __init__.py backend\Local_Prompt_Gallery.py backend\Local_Lora_Gallery.py
node --check js\api\promptApi.js
node --check js\api\loraApi.js
```

Manual smoke test:

- Restart ComfyUI after Python/backend changes.
- Confirm Prompt Builder opens from category pills.
- Confirm Card Manager opens from the Cards/Library workspace.
- Confirm Active Stack updates after selecting cards.
- Confirm display prefs survive `F5`.
- Confirm LoRA selection and prompt output still execute.
