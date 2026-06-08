# Remaining Refactor Work

This file summarizes what is still left after the baseline and cleanup commits.
It was refreshed on 2026-06-07 after several prompt-side feature additions.

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
- The backend caches unchanged LoRA stacks so prompt-only reruns do not reload identical LoRAs.
- The backend now includes wildcard RNG mode/shuffle nonce state and optional hidden/meta prompt text through `prompt_meta_tags`.
- A baseline tag/commit exists for fallback.

The main remaining risk is still file size and mixed responsibilities, especially in `js/prompt/ui.js`.

## Current Size Snapshot

Approximate current sizes:

| File | Lines | Size |
| --- | ---: | ---: |
| `js/Local_Gallery_Unified.js` | 15 | 611 bytes |
| `Local_Gallery_Unified.py` | 170 | 6.9 KB |
| `js/prompt/ui.js` | 5,578 | 284 KB |
| `js/lora/ui.js` | 1,721 | 114 KB |
| `js/prompt/library.js` | 471 | 22 KB |
| `js/prompt/settings.js` | 464 | 22 KB |
| `js/prompt/dialogs.js` | 558 | 29 KB |
| `js/prompt/activeSidebar.js` | 290 | 14 KB |

`js/prompt/ui.js` grew again because new prompt features landed there while the refactor was in progress.

## Biggest Remaining Hotspots

### 1. `js/prompt/ui.js`

This is still the largest risk.

It still contains many responsibilities:

- Prompt API wrapper methods around the extracted `promptApi` module.
- Node creation, hidden widget creation, and serialization setup.
- Large inline CSS and initial DOM shell markup.
- Prompt selection state syncing.
- Hidden/meta prompt tag state and renderer.
- Thin wrappers for extracted active sidebar, library, gallery, modal, preview, and context menu modules.
- Workspace mode and library workspace navigation.
- Toolbar dropdown behavior and auto-hide bottom toolbar behavior.
- Wildcard toggle, RNG mode, shuffle nonce, seed controls, and control-after-generate wiring.
- Thumbnail size and display-mode preference wiring.
- Category management wiring.
- Selected prompt list rendering and drag/reorder behavior.
- Many direct DOM event listeners.

Recommended next prompt-side extractions:

1. Extract prompt hidden widget/state setup into `js/prompt/stateWidgets.js`.
2. Extract hidden/meta prompt tag logic into `js/prompt/metaTags.js`.
3. Extract workspace shell/navigation into `js/prompt/workspace.js`.
4. Extract bottom toolbar, dropdown, size, and wildcard control wiring into `js/prompt/toolbar.js`.
5. Extract selected prompt list rendering into `js/prompt/selectedList.js`.

Avoid doing all of this in one pass.

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

Do this after the prompt side is smaller, unless a LoRA bug requires touching the file first.

### 3. Node Lifecycle Wrapping

The current frontend still has multiple setup wrappers:

- Tabs setup.
- LoRA UI setup.
- Prompt UI setup.

This works, but registration order matters.

Recommended future direction:

1. Keep current behavior until `js/prompt/ui.js` is smaller.
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
2. Fix any real behavior bugs before extracting more code.
3. Extract one prompt-side area at a time:
   - `stateWidgets.js`
   - `metaTags.js`
   - `workspace.js`
   - `toolbar.js`
   - `selectedList.js`
4. After each extraction:
   - run JS syntax checks
   - run Python compile check
   - smoke test in ComfyUI
   - commit separately
5. Once `js/prompt/ui.js` is much smaller, consider lifecycle unification.
6. After prompt lifecycle/state is stable, reduce `js/lora/ui.js`.

## Stop Point Recommendation

Do not chase perfect architecture forever.

A practical stopping point is:

- `js/prompt/ui.js` is no longer the place every prompt feature has to edit.
- Prompt hidden state, meta tags, workspace navigation, toolbar controls, selected-list rendering, gallery rendering, library rendering, and modals live in focused modules.
- LoRA UI has card/row/preset/metadata helpers extracted.
- The node passes real ComfyUI smoke tests.
- Future feature work can be done without editing a 5,000+ line file for every change.

At that point, the node should be safe enough to build on.

## Current Risk Estimate

Approximate status:

- Safety refactor: 65-75% complete.
- Prompt modularity: 45-55% complete.
- LoRA modularity: 30-40% complete.
- Lifecycle/state architecture: still mostly pending.

The remaining work is mostly about reducing the size of `js/prompt/ui.js`, keeping saved workflow compatibility, and avoiding future merge/edit confusion.

## Verification Already Run For This Snapshot

These checks passed while refreshing this document:

- `node --check js/Local_Gallery_Unified.js`
- `node --check js/prompt/ui.js`
- `node --check js/lora/ui.js`
- `node --check js/prompt/library.js`
- `python -m py_compile Local_Gallery_Unified.py`
