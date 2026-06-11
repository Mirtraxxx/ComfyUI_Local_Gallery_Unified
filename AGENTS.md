# Project Instructions

Before editing this repo, read these docs first:

1. `PROMPT_UI_TERMINOLOGY.md`
2. `AI_NODE_OVERVIEW.md`
3. `REFACTOR_REMAINING.md` when planning cleanup or refactors

## Prompt UI Naming

Identify the product area before editing prompt UI:

- Prompt Builder: category card picker used for normal prompt building. Current code mostly lives in `js/prompt/library.js` and uses `.localprompt-chip` / `.localprompt-chip-thumb`.
- Card Manager: browse/manage workspace for stored cards and categories. Current code mostly lives in `js/prompt/browse.js` and uses `.localprompt-gallery-item`.
- Active Stack: selected prompt sidebar. Current code lives in `js/prompt/activeSidebar.js`.
- Hidden Prompts: prompt text injected outside the visible active stack. Current code lives in `js/prompt/metaTags.js`.

Do not assume code terms match product terms. In particular, `library` usually means Prompt Builder, not Card Manager.

## Route And Data Rules

- Unified frontend code should call `/localgalleryunified/prompt/*` and `/localgalleryunified/lora/*`.
- Do not add new Unified frontend calls to `/localpromptgallery/*` or `/localloragallery/*`.
- Runtime prompt/LoRA data lives under `data/`; back it up before migrations or merges.

## Editing Guidance

- Keep prompt-side refactors feature or bug driven.
- Avoid renaming DOM ids, CSS classes, persisted preference keys, hidden widget names, or API fields unless doing a dedicated compatibility pass.
- When touching visually similar card UIs, verify whether the change targets Prompt Builder, Card Manager, Active Stack, or an older renderer path before editing.
