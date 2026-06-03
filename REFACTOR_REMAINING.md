# Remaining Refactor Work

This file summarizes what is still left after the baseline and cleanup commits.

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
- The add/import/edit/upload prompt dialogs now live in `js/prompt/dialogs.js`.
- The prompt context menu bodies now live in `js/prompt/contextMenus.js`.
- The backend caches unchanged LoRA stacks so prompt-only reruns do not reload identical LoRAs.
- A baseline tag/commit exists for fallback.

The main remaining risk is still file size and mixed responsibilities.

## Biggest Remaining Hotspots

### 1. `js/prompt/ui.js`

This is still the largest risk.

Current approximate size:

- Around 3,930 lines.
- Around 212 KB.

It still contains many responsibilities:

- Prompt gallery rendering.
- Active sidebar rendering.
- Library bar and library drawer logic.
- Context menu wrappers remain in `js/prompt/ui.js`, but menu bodies live in `js/prompt/contextMenus.js`.
- From-last-output dialog.
- Wildcard toggle/seed controls.
- Preset modal is now extracted to `js/prompt/presets.js`.
- Browse modal is now extracted to `js/prompt/browse.js`.
- Settings modal is now extracted to `js/prompt/settings.js`.
- Many direct DOM event listeners.

Recommended next steps:

1. Extract modal/dialog helpers only after another smoke test.
2. Split prompt library drawer logic into its own module.
3. Extract the from-last-output dialog when its source-node and preview dependencies are ready to move cleanly.
4. Continue splitting wildcard UI only if the remaining toggle/seed controls need changes.
5. Keep pure helpers in `js/prompt/helpers.js` when they do not need DOM or node state.

Avoid doing all of this in one pass.

### 2. `js/lora/ui.js`

This is less risky than prompt UI, but still large.

Current approximate size:

- Around 1,800 lines.
- Around 110 KB.

It still contains:

- Gallery card rendering.
- Compact row rendering.
- Preset controls.
- Metadata editor.
- Civitai sync UI updates.
- Tag/folder/preset loading.

Recommended next steps:

1. Extract LoRA card/row HTML builders.
2. Extract preset control helpers.
3. Extract metadata editor helpers.
4. Keep reorder logic in `js/lora/helpers.js`.

### 3. Node Lifecycle Wrapping

The current frontend has multiple setup wrappers:

- Tabs setup.
- LoRA UI setup.
- Prompt UI setup.

This works, but registration order matters.

Recommended future direction:

1. Keep current behavior until the UI modules are smaller.
2. Later, move toward one clearer initializer that calls setup steps in order.
3. Do not attempt this at the same time as major UI extraction.

### 4. Saved State Migration

Current state is intentionally conservative:

- Old raw array selection data is still saved.
- Compatibility helpers can read old arrays and future object-wrapped `items`.

Recommended future direction:

1. Keep saving old arrays for now.
2. Add runtime smoke tests before changing saved workflow format.
3. If versioned state is introduced, support both:
   - `[]`
   - `{ "version": 1, "items": [] }`

Do not abruptly change saved JSON shapes.

## Suggested Order From Here

Best next safe sequence:

1. Test the current node in ComfyUI.
2. Fix any real behavior bugs first.
3. Extract one prompt-side UI area at a time:
   - library drawer
4. After each extraction:
   - run JS syntax checks
   - run Python compile check
   - smoke test in ComfyUI
   - commit separately

## Stop Point Recommendation

Do not chase perfect architecture forever.

A practical stopping point is:

- Prompt UI is split into a few focused modules.
- LoRA UI has card/row/preset helpers extracted.
- The node passes real ComfyUI smoke tests.
- Future feature work can be done without editing a 5,000+ line file for every change.

At that point, the node should be safe enough to build on.

## Current Risk Estimate

Approximate status:

- Safety refactor: 60-70% complete.
- Full modular architecture: 45-55% complete.

The remaining work is mostly about reducing the size of `js/prompt/ui.js` and avoiding future merge/edit confusion.
