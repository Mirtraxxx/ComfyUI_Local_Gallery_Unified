# Remaining Refactor Work

This file summarizes what is still left after the baseline and cleanup commits.
It was refreshed on 2026-06-08 after the prompt-side extraction pass.

## Current State

The node is much safer than the original merged file:

- `js/Local_Gallery_Unified.js` is now a small frontend entrypoint.
- Prompt and LoRA UI code live in separate modules.
- API calls live in `js/api/`.
- Shared DOM, JSON, widget, selection-state, and reorder helpers exist.
- Prompt constants and many pure prompt helpers have been extracted.
- The wildcard category selection modal now lives in `js/prompt/wildcards.js`.
- The prompt settings modal now lives in `js/prompt/settings.js`.
- The prompt presets modal now lives in `js/prompt/presets.js`.
- The prompt browse modal now lives in `js/prompt/browse.js`.
- The add/import/edit/upload/from-last-output prompt dialogs now live in `js/prompt/dialogs.js`.
- The prompt context menu bodies now live in `js/prompt/contextMenus.js`.
- The prompt hover/info preview helpers now live in `js/prompt/previews.js`.
- The main prompt gallery renderer and simple gallery filter helpers now live in `js/prompt/gallery.js`.
- The library tab bar, drawer data loading, drawer renderer, sorting, and selected-prompt promotion now live in `js/prompt/library.js`.
- The active sidebar renderer, open-state styling, width preference, and resize handling now live in `js/prompt/activeSidebar.js`.
- The large inline CSS stylesheet has been extracted from `js/prompt/ui.js` into `js/prompt/styles.js`.
- The prompt HTML shell has been extracted from `js/prompt/ui.js` into `js/prompt/template.js`.
- The prompt hidden widgets and state setup have been extracted from `js/prompt/ui.js` into `js/prompt/stateWidgets.js`.
- The prompt hidden/meta tag logic has been extracted from `js/prompt/ui.js` into `js/prompt/metaTags.js`.
- The prompt workspace shell/navigation logic has been extracted from `js/prompt/ui.js` into `js/prompt/workspace.js`.
- Unreachable legacy selected-list rendering code was removed from `js/prompt/ui.js`; the active prompt list is rendered by `js/prompt/activeSidebar.js`.
- The backend caches unchanged LoRA stacks so prompt-only reruns do not reload identical LoRAs.
- The backend now includes wildcard RNG mode/shuffle nonce state and optional hidden/meta prompt text through `prompt_meta_tags`.
- The unified node now bundles legacy Prompt/LoRA backend modules for standalone testing; runtime data has been copied under ignored `data/prompt_gallery/` and `data/lora_gallery/` folders. See `STANDALONE_MIGRATION.md`.
- A baseline tag/commit exists for fallback.

The prompt-side refactor is now good enough to pause unless a real feature or bug requires more cleanup. The main remaining risk has shifted toward LoRA UI size, lifecycle wrapping, and scattered popup/event behavior.

## Current Size Snapshot

Approximate current sizes:

| File | Lines | Size |
| --- | ---: | ---: |
| `js/Local_Gallery_Unified.js` | 15 | 614 bytes |
| `Local_Gallery_Unified.py` | 170 | 6.9 KB |
| `js/prompt/ui.js` | 2,454 | 129 KB |
| `js/prompt/styles.js` | 2,849 | 134 KB |
| `js/lora/ui.js` | 1,721 | 114 KB |
| `js/prompt/library.js` | 586 | 28 KB |
| `js/prompt/settings.js` | 478 | 23 KB |
| `js/prompt/dialogs.js` | 558 | 29 KB |
| `js/prompt/activeSidebar.js` | 290 | 14 KB |
| `js/prompt/template.js` | 172 | 17 KB |
| `js/prompt/metaTags.js` | 158 | 7 KB |
| `js/prompt/stateWidgets.js` | 141 | 6 KB |
| `js/prompt/workspace.js` | 133 | 6 KB |

`js/prompt/ui.js` is still a coordination hub, but it is no longer carrying the stylesheet, initial HTML shell, hidden widget setup, meta-tag controller, workspace shell, or dead selected-list renderer.

## Biggest Remaining Hotspots

### 1. `js/prompt/ui.js`

This is still important, but it is no longer the largest file-size risk.

It still contains many responsibilities:

- Prompt API wrapper methods around the extracted `promptApi` module.
- Node creation and main coordination.
- Prompt selection state syncing and count updates.
- Thin wrappers for extracted active sidebar, library, gallery, modal, preview, and context menu modules.
- Toolbar dropdown behavior and auto-hide bottom toolbar behavior.
- Wildcard toggle, RNG mode, shuffle nonce, seed controls, and control-after-generate wiring.
- Thumbnail size and display-mode preference wiring.
- Category management wiring.
- Many direct DOM event listeners.

Recommended prompt-side stance:

1. Do not extract more prompt code just to reduce line count.
2. If a prompt bug or feature touches toolbar/wildcard controls, consider extracting that area into `js/prompt/toolbar.js` first.
3. Do not create `js/prompt/selectedList.js` unless a new visible selected-list UI is intentionally reintroduced; current active prompt rows live in `js/prompt/activeSidebar.js`.
4. Require dependency checklists before future extractions. Recent regressions came from missing closure dependencies and popup anchoring assumptions.

Avoid doing broad prompt extraction passes for now.

### 2. `js/lora/ui.js`

This is less risky than prompt UI, but still large.

Current approximate size:

- Around 1,720 lines.
- Around 114 KB.

It still contains:

- Gallery card rendering.
- Compact row rendering.
- Selected LoRA list rendering.
- Preset controls.
- Metadata editor.
- Civitai sync UI updates.
- Tag/folder/preset loading.

Recommended next LoRA-side steps:

1. Extract LoRA card/row HTML builders.
2. Extract selected LoRA list rendering.
3. Extract preset control helpers.
4. Extract metadata editor helpers.
5. Keep reorder logic in `js/lora/helpers.js`.

This is now the best refactor target if the goal is continued cleanup.

### 3. Node Lifecycle Wrapping

The current frontend still has multiple setup wrappers:

- Tabs setup.
- LoRA UI setup.
- Prompt UI setup.

This works, but registration order matters.

Recommended future direction:

1. Keep current behavior until there is a quiet testing window.
2. Later, move toward one clearer initializer that calls setup steps in order.
3. Do not attempt lifecycle unification at the same time as a major UI extraction.

### 4. Saved State Migration

Current state is intentionally conservative:

- Old raw array selection data is still saved.
- Compatibility helpers can read old arrays and future object-wrapped `items`.
- Newer state fields include `prompt_meta_tags`, `wildcard_rng_mode`, `wildcard_shuffle_nonce`, and `active_sidebar_width`.

Recommended future direction:

1. Keep saving old arrays for now.
2. Add runtime smoke tests before changing saved workflow format.
3. If versioned state is introduced, support both:
   - `[]`
   - `{ "version": 1, "items": [] }`

Do not abruptly change saved JSON shapes.

### 5. Scattered Modal, Alert, Confirm, And Event Wiring

Many modules still create overlays with `document.body.appendChild`, attach direct listeners, and use browser `alert()`/`confirm()`.

This is acceptable for now, but future cleanup should consider:

- A shared modal/overlay helper.
- A shared confirmation helper.
- A lightweight notification helper.
- Event delegation for repeated card/list rows.
- Cleanup helpers for document/window listeners.

Do this after the major prompt module extractions, because moving UI bodies first will make shared helpers easier to apply safely.

## Suggested Order From Here

Best next safe sequence:

1. Smoke test the current node in ComfyUI.
2. Fix real behavior bugs before extracting more code.
3. Treat prompt-side refactoring as paused unless a specific feature/bug requires touching it.
4. If continuing cleanup, work on one LoRA-side area at a time:
   - card/row builders
   - selected LoRA list rendering
   - preset controls
   - metadata editor
5. After each extraction:
   - run JS syntax checks
   - run Python compile check
   - smoke test in ComfyUI
   - commit separately
6. Consider lifecycle unification only after the UI modules have stayed stable for a while.

## Stop Point Recommendation

Do not chase perfect architecture forever.

A practical stopping point is:

- `js/prompt/ui.js` is no longer the place every prompt feature has to edit.
- Prompt hidden state, meta tags, workspace navigation, CSS, template, gallery rendering, library rendering, active sidebar rendering, and modals live in focused modules.
- LoRA UI has card/row/preset/metadata helpers extracted.
- The node passes real ComfyUI smoke tests.
- Future prompt feature work can be done without editing a 5,000+ line file for every change.

For prompt-side work, this stopping point has mostly been reached. Further prompt cleanup should be driven by real changes, not architecture chasing.

## Current Risk Estimate

Approximate status:

- Safety refactor: 65-75% complete.
- Prompt modularity: 70-80% complete.
- LoRA modularity: 30-40% complete.
- Lifecycle/state architecture: still mostly pending.

The remaining work is mostly about LoRA UI modularity, eventual lifecycle unification, keeping saved workflow compatibility, and avoiding future merge/edit confusion.

## Known Minor Quirks

- The active prompt count badge can be visually stale in some interaction paths until a refresh, even though the underlying selection and active sidebar still work. This is cosmetic and can be fixed later if it becomes annoying.
- Wildcard and prompt preference behavior has not been exhaustively tested after every extraction. Treat future wildcard bugs as possible refactor fallout and fix them in focused patches.

## Future Extraction Safety Rule

Before moving any closure-heavy function, list every external variable/function it reads or calls. After editing, verify each dependency is imported, passed as an argument, or still available in the original closure. Also compare changed function call signatures against target function definitions. Syntax checks alone are not enough.

## Verification Already Run For This Snapshot

These checks passed while refreshing this document:

- `node --check js/Local_Gallery_Unified.js`
- `node --check js/prompt/ui.js`
- `node --check js/lora/ui.js`
- `node --check js/prompt/library.js`
- `python -m py_compile Local_Gallery_Unified.py`
