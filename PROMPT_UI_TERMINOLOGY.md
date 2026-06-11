# Prompt UI Terminology

Updated: 2026-06-11

This file defines the product terms for the prompt side of `ComfyUI_Local_Gallery_Unified`.
Use these names when discussing features, bugs, or refactors so the UI intent stays clear.
For current backend/routes/data architecture, read `AI_NODE_OVERVIEW.md`.

## Product Areas

### Prompt Builder

The normal front-facing workflow for building a prompt selection.

This is the view used when clicking category pills in the top row. It should feel lightweight:
visual cards, card names, selection, active-card promotion, sort, and manual order. It is not meant
to expose every management action.

Current code mapping:

- Top category pills: `renderPinnedCategoryStrip()` in `js/prompt/ui.js`
- Opening a category: `openCategoryFromMenu()` in `js/prompt/ui.js`
- Prompt Builder card drawer: `renderLibraryDrawer()` in `js/prompt/library.js`
- Prompt Builder card container: `#<uniqueId>-library-drawer` / `#<uniqueId>-library-chips`
- The active category is tracked as `activeLibraryTab` in `js/prompt/ui.js`

Important note: despite the code name `library`, this path is the Prompt Builder in product language.

### Card Manager

The management hub for stored prompt cards.

This is opened from the Library/Cards workspace. It is used for browsing/searching all cards,
renaming or deleting categories, deleting cards, pinning, and other database/metadata tasks.
It can look similar to the Prompt Builder because both show cards, but it is not the primary
prompt-building workflow.

Current code mapping:

- Workspace entry: `showBrowseWorkspace()` in `js/prompt/ui.js`
- Modal/workspace renderer: `showBrowseModal()` in `js/prompt/browse.js`
- Card Manager grid container: `#browse-gallery-grid`
- Card Manager card class: `.localprompt-gallery-item`

Avoid native HTML drag/drop in this area because ComfyUI can interpret drops as workflow imports.

### Active Stack

The selected cards that will contribute to final prompt output.

This includes the active prompt sidebar and selected prompt state. Cards here can be reordered,
toggled on/off, and weighted. This is the actual prompt stack used for generation.

Current code mapping:

- Selection state: `node_instance.promptData` in `js/prompt/ui.js`
- Active sidebar renderer: `renderActiveSidebar()` in `js/prompt/activeSidebar.js`
- Selection save/load widget: `prompt_selection_data`

### Hidden Prompts

Prompt text injected into final output without appearing as active cards.

Current code mapping:

- State: `node_instance.metaTags`
- Hidden widget: `prompt_meta_tags`
- UI renderer: `renderMetaTags()` in `js/prompt/ui.js`
- Toolbar button: `#<uniqueId>-meta-tags-btn`

## Naming Guidance

Preferred product names:

- `Prompt Builder`: category-based card picker used during normal prompt building
- `Card Manager`: browse/manage workspace for stored cards and categories
- `Card`: a stored visual prompt entry, often with thumbnail plus a prompt string or prompt bundle
- `Active Stack`: selected cards that form the output prompt
- `Hidden Prompts`: injected prompt text outside the active stack

## Current Name vs Intended Name

Use this as the first-pass refactor map. The left side is what the code often says today.
The right side is what the code should say when it is safe to rename normal JS symbols.

| Current code term | Intended product/code term | Notes |
| --- | --- | --- |
| `library` when referring to category card picking | `promptBuilder` | This is the main confusing one. In product language, this is not the Card Manager. |
| `libraryDrawer` | `promptBuilderDrawer` | Current renderer is `renderLibraryDrawer()` in `js/prompt/library.js`. |
| `libraryTab` for category pills | `builderCategory` or `promptBuilderCategory` | Category pills in the top row open Prompt Builder card views. |
| `activeLibraryTab` | `activeBuilderCategory` | Tracks which Prompt Builder category/view is open. |
| `library-chips` / `localprompt-chip` concepts | `builderCards` / `cardChips` | DOM ids/classes can stay unchanged initially. |
| `browse` when referring to the Cards workspace | `cardManager` | Current renderer is `showBrowseModal()` in `js/prompt/browse.js`. |
| `browse-gallery-grid` | `cardManagerGrid` | Keep DOM id unchanged unless doing a larger selector refactor. |
| `prompt` when referring to stored visual entry | `card` | Prefer `card` for the stored thumbnail + prompt bundle concept. |
| `promptData` | `activeStack` or `activeCards` | Persisted widget/key should stay `prompt_selection_data`. |
| `metaTags` | `hiddenPrompts` | Persisted widget/key should stay `prompt_meta_tags`. |
| `gallery.js/renderGallery` | legacy/old gallery renderer | Verify if it is visible before editing. It is not the Prompt Builder shown after clicking category pills. |

Legacy/code names still present:

- `library`, `libraryDrawer`, `libraryTab`: usually means Prompt Builder category UI
- `browse`: usually means Card Manager
- `prompt`: often means a stored card or a selected active prompt, depending on context
- `gallery.js/renderGallery`: older/default gallery path; verify whether it is currently visible before editing

## Safe Rename Scope

Good first-pass targets:

- Local variables inside one module.
- Function names that are imported/exported through normal ES module imports.
- Callback parameter names.
- Comments and user-facing developer notes.
- New wrapper names that preserve old exports.

Suggested safe alias pattern:

```js
export async function renderPromptBuilderDrawer(args) {
    // existing implementation
}

export const renderLibraryDrawer = renderPromptBuilderDrawer;
```

This lets callers migrate gradually while keeping old imports working.

## Do Not Rename Yet

Leave these alone unless doing a dedicated compatibility pass:

- DOM ids such as `#<uniqueId>-library-drawer`, `#<uniqueId>-library-chips`, and `#browse-gallery-grid`.
- CSS classes such as `.localprompt-library-drawer`, `.localprompt-chip`, and `.localprompt-gallery-item`.
- Persisted UI preference keys such as `library_tabs`, `library_tab_layout`, `prompt_sort_modes`, and `prompt_manual_orders`.
- Hidden widget names such as `prompt_selection_data` and `prompt_meta_tags`.
- API routes and backend JSON fields.
- Module filenames such as `library.js` and `browse.js`, unless imports/cache tags are updated carefully.

## Refactor Notes

Renaming the code to match product terms is doable, but it should be staged.

Low-risk now:

- Keep this terminology file updated.
- Add comments at module boundaries when touching related files.
- Use product terms in future bug reports and implementation notes.

Moderate-risk:

- Rename local variables and callback parameters inside a single module, for example `activeLibraryTab`
  to `activeBuilderCategory`.
- Add wrapper/alias functions with product names while leaving old exports in place.

Higher-risk:

- Rename files/modules such as `library.js` to `builder.js` or `browse.js` to `cardManager.js`.
- Rename CSS classes and DOM ids.
- Rename persisted preference keys.

High-risk renames can break cached imports, event wiring, persisted prefs, CSS selectors, and external
references. Prefer doing them one module at a time with syntax checks and visual testing.

## Manual Card Ordering

The requested manual reorder feature belongs in the Prompt Builder, not Card Manager.

Target path:

- `renderLibraryDrawer()` in `js/prompt/library.js`
- Cards/chips inside `#<uniqueId>-library-chips`
- Scope should match the active builder category or favorites/pinned view

Avoid native browser drag/drop. Use pointer or mouse events so ComfyUI does not treat the action as a
workflow import/drop.
