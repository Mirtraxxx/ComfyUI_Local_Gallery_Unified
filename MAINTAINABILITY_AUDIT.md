# Maintainability Audit - ComfyUI Local Gallery Unified

## Purpose

This document reviews the current node as a future-building baseline. It is written for a non-coder owner and for any future AI/developer who needs to modify the node without turning the merged Prompt Gallery + LoRA Gallery implementation into fragile spaghetti.

The short version: the node is a useful working merge, but the current shape is risky for long-term feature work because most of the behavior lives in one very large JavaScript file and relies on copied legacy behavior, hidden JSON state, and chained ComfyUI lifecycle hooks.

## Current Baseline

Baseline checkpoint:

- Commit: `ae99574`
- Tag: `baseline-v1`
- Message: `Baseline unified gallery node`

Tracked files at the baseline:

- `.gitignore`
- `AI_NODE_OVERVIEW.md`
- `Local_Gallery_Unified.py`
- `__init__.py`
- `js/Local_Gallery_Unified.js`

## Size And Complexity Snapshot

Current file sizes:

| File | Lines | Size |
| --- | ---: | ---: |
| `Local_Gallery_Unified.py` | 119 | 3,784 bytes |
| `__init__.py` | 9 | 276 bytes |
| `AI_NODE_OVERVIEW.md` | 249 | 9,966 bytes |
| `js/Local_Gallery_Unified.js` | 19 | 575 bytes |
| `js/prompt/ui.js` | 5,837 | 309,728 bytes |
| `js/prompt/constants.js` | 28 | 882 bytes |
| `js/lora/ui.js` | 1,794 | 110,407 bytes |
| `js/tabs.js` | 53 | 3,030 bytes |
| `js/api/loraApi.js` | 77 | 2,718 bytes |
| `js/api/promptApi.js` | 249 | 8,900 bytes |
| `js/shared/dom.js` | 8 | 239 bytes |
| `js/shared/json.js` | 19 | 400 bytes |
| `js/shared/widgets.js` | 27 | 981 bytes |

Important pattern counts across the frontend modules:

| Pattern | Count | Why It Matters |
| --- | ---: | --- |
| `app.registerExtension` | 3 | Three separate ComfyUI extension registrations target the same node. |
| `nodeType.prototype.onNodeCreated` | 6 matches | The node creation lifecycle is wrapped multiple times. |
| `fetchApi(` | 36 | Frontend talks directly to many legacy backend routes. |
| `innerHTML =` | 65 | Dynamic UI is often built from raw HTML strings. |
| `JSON.parse` | 5 | Saved workflow state is manually decoded. |
| `JSON.stringify` | 29 | Saved workflow state and API bodies are manually encoded. |
| `setTimeout(` | 19 | Initialization and UI timing partly depend on delays. |
| `addEventListener(` | 210 | Many event listeners are attached by hand. |
| `document.body.appendChild` | 17 | Many modals/popups are created globally. |
| `confirm(` | 14 | Destructive actions rely on browser confirmation dialogs. |
| `alert(` | 49 | Error handling/user messages are scattered. |

These counts do not mean the node is bad. They mean future feature work should be careful, because the file is doing many jobs at once.

## Architecture Summary

The backend Python file is intentionally thin:

- It exposes `LocalGalleryPromptLora`.
- It requires `LocalLoraGallery` and `LocalPromptGallery` to already exist in ComfyUI.
- It calls legacy LoRA logic first.
- It calls legacy prompt logic second.
- It returns updated `MODEL`, updated `CLIP`, `lora_trigger_words`, and `combined_prompt`.

The frontend JavaScript is the true merge:

- `js/tabs.js` adds the Prompt/LoRA tab switcher.
- `js/lora/ui.js` embeds/adapts the old LoRA Gallery UI.
- `js/prompt/ui.js` embeds/adapts the old Prompt Gallery UI.
- It manages hidden widgets and node properties used by the backend.
- It calls many legacy HTTP routes from both old nodes.

## Main Risks

### Risk 1 - Large UI Modules

Severity: High

`js/Local_Gallery_Unified.js` is now a small frontend entrypoint. Prompt UI lives in `js/prompt/ui.js`, prompt constants live in `js/prompt/constants.js`, LoRA UI lives in `js/lora/ui.js`, tab setup lives in `js/tabs.js`, API route calls live in `js/api/`, and shared DOM/JSON/widget helpers live under `js/shared/`. The remaining size risk is concentrated mostly in `js/prompt/ui.js`.

Why this is risky:

- A small prompt-side change can still accidentally affect a far-away prompt feature.
- Search results inside `js/prompt/ui.js` are still noisy because many prompt concepts live in the same module.
- Reusing logic is hard because much of it is trapped in local functions.
- Future AI edits may patch the nearest matching code instead of the right code.
- Merge conflicts will be painful if two changes touch the file at once.

What to do:

- Continue splitting large UI modules by responsibility before adding many new features.
- Keep the current baseline as the fallback point.
- Move code in behavior-preserving steps, not as a visual redesign.

### Risk 2 - Multiple `onNodeCreated` Wrappers

Severity: High

The tab UI, LoRA UI, and prompt UI each wrap `nodeType.prototype.onNodeCreated`.

Why this is risky:

- Registration order matters.
- If one wrapper throws, later setup may not finish.
- A future ComfyUI change could alter lifecycle assumptions.
- Another extension touching the same node lifecycle could interfere.

What to do:

- Move toward one unified node initializer.
- That initializer should call setup steps in a clear order:
  1. Ensure properties/defaults.
  2. Create hidden widgets.
  3. Create DOM widgets.
  4. Build prompt UI.
  5. Build LoRA UI.
  6. Attach tabs.
  7. Load persisted UI state.

### Risk 3 - Hidden JSON State Has No Version

Severity: High

The important workflow state is saved in hidden widgets/properties:

- `lora_selection_data`
- `prompt_selection_data`
- `wildcard_mode`
- `wildcard_categories`
- `active_tab`
- gallery unique IDs

Why this is risky:

- If the selected LoRA/prompt data shape changes, old workflows may silently break.
- There is no schema marker to tell future code what version of saved data it is reading.
- Invalid JSON often resets to empty selection, which can look like data loss.

What to do:

- Add a lightweight state schema/version wrapper for future changes.
- Keep backwards compatibility with the current raw arrays.
- Add safe parse helpers that return both data and parse errors.

Recommended future shape:

```json
{
  "version": 1,
  "items": []
}
```

Do not switch abruptly. Support both old `[]` and new `{ "version": 1, "items": [] }` for at least one full migration period.

### Risk 4 - Frontend Depends On Legacy Backend Routes

Severity: High

The unified frontend calls both route families:

- `/localloragallery/*`
- `/localpromptgallery/*`

The backend Python also depends on legacy classes:

- `LocalLoraGallery`
- `LocalPromptGallery`

Why this is risky:

- This node is not fully standalone.
- If either legacy node changes API routes, method names, or JSON formats, the unified node may break.
- Troubleshooting can be confusing because the failure may be in another custom node.

What to do:

- Document exact route expectations.
- Add startup/runtime diagnostics that clearly say which dependency is missing.
- Eventually consider a backend adapter layer so the unified node talks to its own stable interface.

### Risk 5 - Dynamic HTML Is Built From Raw Strings

Severity: Medium-High

The UI often uses `innerHTML` with values like LoRA names, trigger words, prompt names, categories, and URLs.

Why this is risky:

- A name containing quotes or angle brackets can break the UI.
- Metadata synced from external sources can create unexpected markup.
- It increases the chance of UI injection bugs.

What to do:

- Prefer `textContent` for user/model metadata.
- Use a shared `escapeHtml()` helper when HTML strings are unavoidable.
- Use safe URL assignment through DOM properties instead of string interpolation.

### Risk 6 - UI State Is Split Across Several Places

Severity: Medium-High

State currently lives in:

- `node.properties`
- hidden ComfyUI widgets
- local JS variables
- DOM input values
- legacy backend UI preferences
- legacy backend presets

Why this is risky:

- It can become unclear which value is authoritative.
- Saving one state but not another can create reload bugs.
- A UI control may show one value while execution uses another.

What to do:

- Define one "source of truth" per state type.
- Write small sync functions with clear names.
- Avoid direct property edits spread across distant code.

### Risk 7 - Initialization Uses Timing Delays

Severity: Medium

There are multiple `setTimeout()` calls used to wait for widgets or DOM elements.

Why this is risky:

- Timing can differ across machines, browsers, and ComfyUI versions.
- Race conditions can appear only sometimes.
- Hidden tab sizing can become flaky.

What to do:

- Replace timing-based initialization with explicit setup phases where possible.
- When timing is unavoidable, centralize it and explain why it exists.

### Risk 8 - Event Listeners Are Numerous And Mostly Manual

Severity: Medium

The JS file has around 210 `addEventListener()` matches.

Why this is risky:

- Re-rendered elements can accumulate listeners if cleanup is missed.
- Global listeners can outlive the node if not removed.
- Debugging double-click/double-save behavior can be hard.

What to do:

- Prefer event delegation for repeated list/card elements.
- Keep cleanup functions for global listeners.
- Track document/body listeners in one disposable registry per node.

### Risk 9 - Modal/Popup Creation Is Scattered

Severity: Medium

Many overlays, menus, dialogs, and popovers are appended directly to `document.body`.

Why this is risky:

- Z-index and positioning issues become common as features grow.
- Cleanup can be missed.
- Modals from prompt and LoRA sides can conflict.

What to do:

- Add a small modal helper.
- Ensure all modals have predictable cleanup.
- Use one overlay class/style system instead of many inline styles.

### Risk 10 - Browser Alerts Are Scattered

Severity: Low-Medium

There are many `alert()` and `confirm()` calls.

Why this is risky:

- Messages are inconsistent.
- Browser dialogs interrupt workflows.
- It is hard to upgrade UX later because messaging is scattered.

What to do:

- Eventually centralize notifications and confirmations.
- Keep destructive confirmations, but route them through a helper.

## What Is Good About The Current Design

This is not a disaster. Some choices are practical and useful:

- The Python backend is small and easy to understand.
- The node delegates to working legacy behavior instead of reimplementing everything.
- The current baseline is now committed and tagged.
- The AI overview explains the dependency model.
- Hidden widgets preserve ComfyUI workflow compatibility.
- The UI already has many real features that users expect.

The goal should be to stabilize and modularize, not to throw it all away.

## Suggested Direction

The safest path is a staged cleanup:

1. Document the current behavior and risks.
2. Add helper functions around risky patterns.
3. Split the JavaScript file into modules without changing behavior.
4. Add state schema/version handling.
5. Add small smoke checks for future edits.
6. Only then add bigger new features.

## Future AI Instructions

When modifying this node:

- Do not change serialized state shapes without migration support.
- Do not remove legacy compatibility unless explicitly asked.
- Do not rewrite both prompt and LoRA UI in the same change.
- Prefer small, verifiable moves.
- Preserve `baseline-v1` as the known-good historical reference.
- After each meaningful refactor, run a manual ComfyUI smoke test:
  - node appears in **Asset Gallery**
  - Prompt Gallery tab opens
  - LoRA Gallery tab opens
  - selections persist after workflow reload
  - execution returns model, clip, trigger words, and combined prompt
