# Refactor Roadmap - ComfyUI Local Gallery Unified

## Purpose

This roadmap describes how to make the unified node safer to build on while preserving the current working behavior. It assumes the owner may not be a coder, so each phase explains the practical reason, the safest scope, and how to know the phase is complete.

The current baseline is `baseline-v1` at commit `ae99574`.

## Guiding Rule

Do not start by redesigning the node.

Start by making the existing behavior easier to understand, easier to move, and harder to accidentally break. This node is a merge of two feature-rich legacy nodes, so the safest refactor is incremental.

## Phase 0 - Protect The Baseline

Status: Done

Goal:

- Preserve the current working state before cleanup begins.

Already done:

- Local Git repository initialized inside the node folder.
- Baseline commit created.
- Baseline tag created: `baseline-v1`.
- Runtime cache files ignored through `.gitignore`.

Done means:

- `git log --oneline --decorate -1` shows the baseline commit/tag.
- `git status --short` is clean before starting new work.

## Phase 1 - Documentation And Risk Map

Status: Done

Goal:

- Make the current architecture understandable to future AI/developers.
- Identify known risk areas before changing code.

Artifacts:

- `AI_NODE_OVERVIEW.md`
- `MAINTAINABILITY_AUDIT.md`
- `REFACTOR_ROADMAP.md`

Done means:

- Another AI can understand what the node does without reading all 7,917 JS lines first.
- Risks are documented in plain English.
- Cleanup phases are listed in a practical order.

## Phase 2 - Add Shared Safety Helpers

Status: Done for first pass

Goal:

- Reduce repeated risky patterns before moving large code blocks.

Recommended scope:

- Add a small helper area or new module for:
  - safe JSON parsing
  - JSON serialization defaults
  - HTML escaping
  - safe text assignment
  - safe URL/media assignment
  - basic notification/confirmation wrappers

Implemented guardrails:

- Shared `escapeHtml()` helper in `js/shared/dom.js`.
- Shared JSON helpers in `js/shared/json.js`.
- Shared ComfyUI widget visibility/collapse helpers in `js/shared/widgets.js`.
- Escaping applied to selected high-risk metadata render spots:
  - synced LoRA preview URLs
  - LoRA card names
  - LoRA trigger text/title
  - selected prompt item name/title
- Hidden selection/wildcard JSON state now uses shared parse/stringify helpers in the main UI file.
- Hidden LoRA/prompt selection state now reads through shared compatibility helpers that accept both raw legacy arrays and future `{ "version": 1, "items": [] }` objects while still saving legacy arrays.
- Hidden/collapsed ComfyUI widgets now use shared helper functions instead of repeated inline `type`, `draw`, and `computeSize` assignments.

Suggested helpers:

```js
function parseJsonOr(value, fallback) {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function stringifyJsonOr(value, fallback = "[]") {
    try {
        return JSON.stringify(value);
    } catch {
        return fallback;
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
```

Important:

- Do not convert every `innerHTML` at once.
- Start with user/model metadata fields:
  - LoRA names
  - prompt names
  - trigger words
  - category names
  - URLs

Done means:

- Existing UI still looks and behaves the same.
- Invalid JSON does not silently destroy saved state without a warning.
- Metadata containing quotes or angle brackets does not break card rendering.

## Phase 3 - Split API Clients From UI

Status: Done for first pass

Goal:

- Separate "talking to backend routes" from "drawing the interface."

Suggested files:

- `js/api/loraApi.js`
- `js/api/promptApi.js`

Implemented:

- `js/api/loraApi.js`
  - centralizes legacy `/localloragallery/*` route calls used by the unified UI
- `js/api/promptApi.js`
  - centralizes legacy `/localpromptgallery/*` route calls used by the unified UI
- `js/Local_Gallery_Unified.js`
  - now calls `loraApi.*` and `promptApi.*` instead of embedding route URLs directly

Move these responsibilities:

- LoRA endpoints:
  - `getLoras`
  - `updateMetadata`
  - `setUiState`
  - `syncCivitai`
  - preset load/save/delete wrappers
- Prompt endpoints:
  - `getPrompts`
  - `getPrompt`
  - `getCategories`
  - metadata create/update/delete wrappers
  - preset load/save/delete wrappers
  - UI preference wrappers

Important:

- Keep function names close to the current names at first.
- Do not change route URLs yet.
- Do not change response formats yet.

Done means:

- UI code calls named API functions instead of directly calling `api.fetchApi()` everywhere.
- Route URLs are easier to audit in one or two files.
- Existing prompt and LoRA features still work.

## Phase 4 - Split The Frontend Into Coarse Modules

Status: Started

Goal:

- Break the 7,917-line frontend into understandable pieces.

Suggested first split:

- `js/Local_Gallery_Unified.js`
  - small entrypoint only
  - imports modules
  - registers the extension(s)
- `js/tabs.js`
  - Prompt/LoRA tab behavior
- `js/lora/ui.js`
  - LoRA UI setup and rendering
- `js/prompt/ui.js`
  - Prompt UI setup and rendering
- `js/shared/dom.js`
  - shared DOM helpers
- `js/shared/state.js`
  - hidden widget/property helpers
- `js/shared/modal.js`
  - modal/menu helpers

Important:

- Move code first; improve code second.
- After each file split, run a smoke test.
- Avoid changing behavior while moving code.

Implemented so far:

- `js/tabs.js`
  - extracted from `js/Local_Gallery_Unified.js`
  - main file still owns extension registration and calls `setupUnifiedGalleryTabs()`
- `js/lora/ui.js`
  - extracted from `js/Local_Gallery_Unified.js`
  - main file calls `registerLoraGalleryUi(app)` to preserve registration order
- `js/prompt/ui.js`
  - extracted from `js/Local_Gallery_Unified.js`
  - main file calls `registerPromptGalleryUi(app, api)` after the LoRA UI registration
- `js/prompt/constants.js`
  - extracted prompt UI constants such as pagination, favorite colors, category palette, and thumbnail bounds
- `js/prompt/helpers.js`
  - extracted pure prompt helpers for source-node text extraction, prompt text cleanup, color conversion, palette matching, thumbnail sizing, pinned ordering, library tab filtering, and last-output preview URLs
- `js/lora/helpers.js`
  - extracted pure LoRA helpers for selected-LoRA reorder behavior

Done means:

- The main JS file becomes a readable entrypoint.
- Prompt and LoRA work can be edited separately.
- ComfyUI still loads the node frontend.

## Phase 5 - Replace Chained Node Creation Hooks

Status: Not started

Goal:

- Make node setup happen in one known order.

Current risk:

- Tabs, LoRA UI, and Prompt UI each wrap `nodeType.prototype.onNodeCreated`.

Target shape:

```js
function setupUnifiedNode(nodeType, nodeData) {
    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;

    nodeType.prototype.onNodeCreated = function () {
        const result = originalOnNodeCreated?.apply(this, arguments);

        ensureUnifiedProperties(this);
        setupHiddenWidgets(this);
        setupLoraUi(this, nodeData);
        setupPromptUi(this, nodeData);
        setupTabs(this);
        initializePersistedState(this);

        return result;
    };
}
```

Important:

- This should happen after modules are split.
- Do not attempt it while everything is still in one huge closure unless necessary.

Done means:

- Only one place wraps `onNodeCreated`.
- Setup order is visible and intentional.
- Prompt/LoRA tab hiding still works.

## Phase 6 - Version The Saved State

Status: Not started

Goal:

- Make future workflow loading safer.

Current state:

- `lora_selection_data` is raw JSON.
- `prompt_selection_data` is raw JSON.
- Existing workflows probably expect arrays.

Target compatibility:

- Continue reading old raw arrays.
- Allow new versioned objects.
- Save new versioned objects only after testing migration thoroughly.
- Current helper state: `readSelectionArray()` already accepts both raw arrays and object-wrapped `items`; `writeSelectionArray()` still saves raw arrays for compatibility.

Migration reader idea:

```js
function readSelectionState(rawValue) {
    const parsed = parseJsonOr(rawValue, []);
    if (Array.isArray(parsed)) {
        return { version: 0, items: parsed };
    }
    if (parsed && Array.isArray(parsed.items)) {
        return { version: parsed.version || 1, items: parsed.items };
    }
    return { version: 0, items: [] };
}
```

Done means:

- Old workflows still load.
- Version-wrapped selection data can be read.
- Future data shape changes have a migration place.

## Phase 7 - Add A Smoke Test Checklist

Status: Not started

Goal:

- Give non-coder owner and future AI a repeatable way to verify changes.

Manual smoke checklist:

- ComfyUI starts without frontend console errors.
- Node appears as **Local Gallery: Prompt + LoRA** under **Asset Gallery**.
- Prompt Gallery tab is visible by default.
- LoRA Gallery tab opens when clicked.
- Prompt selection can be added.
- LoRA selection can be added.
- Workflow save/reload preserves both selections.
- Execution returns:
  - updated model
  - updated clip
  - LoRA trigger words
  - combined prompt
- Wildcard mode can be toggled without losing prompt selections.
- Prompt and LoRA presets still load.

Optional automated checks:

- Python syntax check for `Local_Gallery_Unified.py`.
- Basic import/load check if ComfyUI environment is available.
- JavaScript parse check with Node if browser-only imports are handled carefully.

Done means:

- Every future meaningful change has a known verification routine.
- Regressions are caught before building on top of them.

## Phase 8 - Only Then Add New Features

Status: Not started

Goal:

- Build from a safer base.

Feature work is safer after:

- API calls are separated.
- state helpers exist.
- modules are split.
- setup order is unified.
- saved state has migration support.

Good future feature examples:

- Better preset management.
- Unified search across prompt and LoRA assets.
- Import/export bundle for prompt + LoRA combinations.
- Better dependency diagnostics.
- Optional standalone backend adapter.

Avoid until after cleanup:

- Large UI redesigns.
- Changing saved JSON shapes.
- Removing legacy route compatibility.
- Combining prompt and LoRA presets into one new format without migration.

## Recommended Next Practical Step

The next safest implementation step is Phase 4:

Continue splitting the frontend into coarse UI modules. The tab switcher has already moved to `tabs.js`; the next useful target is a shared state/helper module before attempting the larger Prompt or LoRA UI sections.

The shared JSON and widget helper modules have also been added, both major UI sections now live in dedicated modules, and prompt constants/pure helpers have moved to `js/prompt/constants.js` and `js/prompt/helpers.js`. The next useful target is reducing the size of `js/prompt/ui.js` by extracting heavier prompt-side helpers, such as modal helpers or prompt state synchronization.
