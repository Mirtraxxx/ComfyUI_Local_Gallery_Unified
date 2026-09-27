// Shared chrome for both galleries: bars, buttons, pills, popovers and menus.
// Side sheets style their own content (cards, stacks, workspaces); anything a
// user sees on both tabs lives here so the two sides cannot drift apart.
export const CHROME_STYLES = `
.lg-root {
    --lg-bg: #08111a;
    --lg-surface: #0c1621;
    --lg-raised: #142232;
    --lg-hover: rgba(160, 190, 215, 0.08);
    --lg-line: rgba(147, 177, 199, 0.15);
    --lg-line-strong: rgba(159, 193, 215, 0.28);
    --lg-text: #e8eef3;
    --lg-muted: #8f9cab;
    --lg-faint: #627080;
    --lg-accent: #55dd7d;
    --lg-accent-soft: rgba(85, 221, 125, 0.13);
    --lg-accent-line: rgba(85, 221, 125, 0.42);
    --lg-danger: #ef6262;
    --lg-favorite: #ffd166;
    --lg-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
}

.lg-root .lg-shell {
    position: relative;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    color: var(--lg-text);
    background:
        radial-gradient(circle at 9% 2%, rgba(61, 197, 120, 0.075), transparent 29%),
        radial-gradient(circle at 96% 94%, rgba(48, 113, 180, 0.065), transparent 34%),
        linear-gradient(145deg, #09131d 0%, #08111a 55%, #09141e 100%);
    border: 1px solid rgba(147, 177, 199, 0.18);
    border-radius: 16px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.025), 0 18px 48px rgba(0,0,0,0.24);
}

/* Bars */
.lg-root .lg-bar {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 0 0 auto;
    min-height: 44px;
    padding: 0 8px;
    box-sizing: border-box;
    background: var(--lg-surface);
    color: var(--lg-text);
    z-index: 20;
}
.lg-root .lg-top { border-bottom: 1px solid var(--lg-line); }
.lg-root .lg-bottom { border-top: 1px solid var(--lg-line); }
.lg-root .lg-sep {
    flex: 0 0 auto;
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--lg-line);
}
.lg-root .lg-spacer { flex: 1 1 auto; min-width: 4px; }
.lg-root .lg-anchor { position: relative; display: inline-flex; flex: 0 0 auto; }
.lg-root .lg-icon { display: block; width: 16px; height: 16px; flex: 0 0 auto; }

/* Buttons */
.lg-root .lg-icon-btn,
.lg-root .lg-text-btn,
.lg-root .lg-count {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex: 0 0 auto;
    height: 30px;
    min-width: 30px;
    margin: 0;
    padding: 0 8px;
    box-sizing: border-box;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--lg-muted);
    font: inherit;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.lg-root .lg-icon-btn { width: 30px; padding: 0; }
.lg-root .lg-icon-btn:hover,
.lg-root .lg-text-btn:hover,
.lg-root .lg-count:hover { background: var(--lg-hover); color: var(--lg-text); }
.lg-root .lg-icon-btn:focus-visible,
.lg-root .lg-text-btn:focus-visible,
.lg-root .lg-count:focus-visible,
.lg-root .lg-pill:focus-visible,
.lg-root .lg-tab:focus-visible {
    outline: 2px solid var(--lg-accent-line);
    outline-offset: 1px;
}
.lg-root .lg-icon-btn.active,
.lg-root .lg-icon-btn[aria-expanded="true"],
.lg-root .lg-text-btn.active,
.lg-root .lg-text-btn[aria-expanded="true"] {
    background: var(--lg-accent-soft);
    color: var(--lg-accent);
}
.lg-root .lg-icon-btn.lg-favorite.active { background: rgba(255, 209, 102, 0.12); color: var(--lg-favorite); }
.lg-root .lg-icon-btn.lg-favorite.active .lg-icon { fill: currentColor; }
.lg-root .lg-icon-btn:disabled,
.lg-root .lg-text-btn:disabled { opacity: 0.4; cursor: default; background: transparent; }
.lg-root .lg-text-btn.danger:hover { background: rgba(239, 98, 98, 0.12); color: var(--lg-danger); }
.lg-root .lg-icon-btn[hidden],
.lg-root .lg-text-btn[hidden] { display: none; }

/* Active-stack count */
.lg-root .lg-count {
    padding: 0 9px 0 8px;
    border-color: var(--lg-line);
    font-variant-numeric: tabular-nums;
}
.lg-root .lg-count.empty { color: var(--lg-faint); }
.lg-root .lg-count:not(.empty) {
    border-color: var(--lg-accent-line);
    background: var(--lg-accent-soft);
    color: var(--lg-accent);
}
.lg-root .lg-count[aria-pressed="true"] { background: rgba(85, 221, 125, 0.22); }

/* Prompts | LoRAs switch */
.lg-root .lg-tabs {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 2px;
    padding: 2px;
    margin-right: 4px;
    border: 1px solid var(--lg-line);
    border-radius: 8px;
    background: var(--lg-bg);
}
.lg-root .lg-tab {
    appearance: none;
    height: 26px;
    margin: 0;
    padding: 0 11px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--lg-muted);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.lg-root .lg-tab:hover { color: var(--lg-text); }
.lg-root .lg-tab[aria-selected="true"] {
    background: var(--lg-raised);
    color: var(--lg-text);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 1px 2px rgba(0, 0, 0, 0.45);
    cursor: default;
}

/* Category / folder pills */
.lg-root .lg-strip {
    position: relative;
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
}
.lg-root .lg-pill {
    --pill: var(--category-color, var(--folder-color, var(--lg-faint)));
    appearance: none;
    display: inline-block;
    flex: 0 0 auto;
    max-width: 180px;
    height: 28px;
    margin: 0;
    padding: 0 10px;
    box-sizing: border-box;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--lg-muted);
    font: inherit;
    font-size: 12px;
    font-weight: 500;
    line-height: 26px;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    touch-action: none;
    transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.lg-root .lg-pill::before {
    content: "";
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 7px;
    border-radius: 50%;
    background: var(--pill);
    vertical-align: 1px;
}
.lg-root .lg-pill:hover { background: var(--lg-hover); color: var(--lg-text); }
.lg-root .lg-pill.active {
    border-color: color-mix(in srgb, var(--pill) 50%, transparent);
    background: color-mix(in srgb, var(--pill) 18%, transparent);
    color: var(--lg-text);
}
.lg-root .lg-pill.drag-over { border-color: var(--lg-accent-line); background: var(--lg-accent-soft); }
.lg-root .lg-pill.pinned-dragging { opacity: 0.45; }
.lg-root .lg-pill[hidden] { display: none; }

/* Popovers */
.lg-root .lg-popover {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    z-index: 80;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 272px;
    max-width: calc(100vw - 32px);
    max-height: 70vh;
    overflow-y: auto;
    padding: 12px;
    box-sizing: border-box;
    border: 1px solid var(--lg-line-strong);
    border-radius: 10px;
    background: var(--lg-surface);
    color: var(--lg-text);
    box-shadow: var(--lg-shadow);
    font-size: 12px;
    text-align: left;
}
.lg-root .lg-popover.lg-align-end { left: auto; right: 0; }
.lg-root .lg-popover.lg-drop { top: calc(100% + 4px); bottom: auto; left: auto; right: 8px; }
.lg-root .lg-popover[hidden],
.lg-root .lg-overflow[hidden] { display: none; }
.lg-root .lg-popover-head { display: flex; flex-direction: column; gap: 3px; }
.lg-root .lg-popover-title { font-size: 13px; font-weight: 600; color: var(--lg-text); }
.lg-root .lg-note { margin: 0; font-size: 11px; line-height: 1.4; color: var(--lg-muted); }
.lg-root .lg-section { display: flex; flex-direction: column; gap: 8px; }
.lg-root .lg-section + .lg-section { padding-top: 12px; border-top: 1px solid var(--lg-line); }
.lg-root .lg-label {
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--lg-faint);
}
.lg-root .lg-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.lg-root .lg-row > * { min-width: 0; }
.lg-root .lg-row > .lg-input { flex: 1 1 auto; }
.lg-root .lg-field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 0; color: var(--lg-muted); font-size: 11px; }
.lg-root .lg-field[hidden] { display: none; }
.lg-root .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.lg-root .lg-select,
.lg-root .lg-input {
    height: 28px;
    margin: 0;
    padding: 0 8px;
    box-sizing: border-box;
    border: 1px solid var(--lg-line-strong);
    border-radius: 6px;
    background: var(--lg-bg);
    color: var(--lg-text);
    font: inherit;
    font-size: 12px;
    min-width: 0;
}
.lg-root .lg-select:focus,
.lg-root .lg-input:focus { outline: none; border-color: var(--lg-accent-line); }
.lg-root .lg-range { flex: 1 1 auto; min-width: 0; margin: 0; accent-color: var(--lg-accent); }
.lg-root .lg-check {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--lg-text);
    font-size: 12px;
    cursor: pointer;
}
.lg-root .lg-check input { width: 14px; height: 14px; margin: 0; accent-color: var(--lg-accent); }
.lg-root textarea.lg-input { height: auto; min-height: 120px; padding: 6px 8px; line-height: 1.45; resize: vertical; }
.lg-root .lg-input[type="file"] { height: auto; padding: 3px; }
.lg-root .lg-input::file-selector-button {
    margin-right: 8px;
    padding: 4px 10px;
    border: 0;
    border-radius: 4px;
    background: var(--lg-raised);
    color: var(--lg-text);
    font: inherit;
    cursor: pointer;
}
.lg-root .lg-text-btn.primary { background: var(--lg-accent-soft); color: var(--lg-accent); border-color: var(--lg-accent-line); }
.lg-root .lg-text-btn.primary:hover { background: rgba(85, 221, 125, 0.2); }

/* Forms: workspace pages and dialogs */
.lg-root .lg-form { display: grid; gap: 12px; }
.lg-root .lg-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.lg-root .lg-actions { display: flex; justify-content: flex-end; gap: 6px; }
.lg-root .lg-status {
    padding: 8px 10px;
    border: 1px solid var(--lg-line);
    border-radius: 6px;
    background: var(--lg-bg);
    color: var(--lg-muted);
    font-size: 11px;
    white-space: pre-wrap;
}
.lg-root .lg-status.error { border-color: rgba(239, 98, 98, 0.35); color: var(--lg-danger); }
.lg-root .lg-status[hidden] { display: none; }
.lg-root .lg-callout {
    padding: 16px;
    border: 1px dashed var(--lg-line-strong);
    border-radius: 8px;
    color: var(--lg-muted);
    font-size: 12px;
    line-height: 1.45;
    text-align: center;
}
.lg-root .lg-callout strong:first-child { display: block; margin-bottom: 4px; color: var(--lg-text); font-size: 13px; }
.lg-root .lg-dialog {
    display: grid;
    gap: 12px;
    max-width: 90vw;
    padding: 16px;
    box-sizing: border-box;
    border: 1px solid var(--lg-line-strong);
    border-radius: 10px;
    background: var(--lg-surface);
    box-shadow: var(--lg-shadow);
    color: var(--lg-text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
}
.lg-root .lg-dialog-title { margin: 0; color: var(--lg-text); font-size: 14px; font-weight: 600; }

/* Full category / folder list under the top bar */
.lg-root .lg-overflow {
    position: absolute;
    top: calc(100% + 4px);
    left: 8px;
    right: 8px;
    z-index: 80;
    max-height: 360px;
    overflow-y: auto;
    padding: 10px;
    box-sizing: border-box;
    border: 1px solid var(--lg-line-strong);
    border-radius: 10px;
    background: var(--lg-surface);
    box-shadow: var(--lg-shadow);
}
.lg-root .lg-overflow > .lg-input { width: 100%; margin-bottom: 8px; }
.lg-root .lg-pill-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 2px;
}
.lg-root .lg-pill-grid .lg-pill { max-width: none; }
.lg-root .lg-empty { padding: 16px 4px; color: var(--lg-muted); font-size: 12px; text-align: center; }
.lg-root .lg-empty[hidden] { display: none; }

/* Active sidebar surface + header */
.lg-root .lg-side {
    background: rgba(12, 22, 33, 0.97);
    border: 1px solid var(--lg-line-strong);
    border-radius: 10px;
    box-shadow: var(--lg-shadow);
    backdrop-filter: blur(8px);
}
.lg-root .lg-side-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 6px 0 12px;
    box-sizing: border-box;
    border-bottom: 1px solid var(--lg-line);
}
.lg-root .lg-side-title { display: flex; align-items: baseline; gap: 8px; flex: 1 1 auto; min-width: 0; }
.lg-root .lg-side-title > :first-child { color: var(--lg-text); font-size: 12px; font-weight: 600; }
.lg-root .lg-side-title > :last-child { color: var(--lg-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.lg-root .lg-side-head .lg-text-btn { height: 26px; font-size: 11.5px; }

/* Operation status: silent while ready */
.lg-root .localgallery-operation-feedback {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: 0 1 auto;
    min-width: 0;
    max-width: min(280px, 45%);
    height: 26px;
    padding: 0 8px;
    box-sizing: border-box;
    border-radius: 6px;
    color: var(--lg-muted);
    font-size: 11px;
}
.lg-root .localgallery-operation-feedback[data-state="ready"] { display: none; }
.lg-root .localgallery-operation-feedback[data-state="pending"] { color: #9fd8ff; }
.lg-root .localgallery-operation-feedback[data-state="success"] { color: var(--lg-accent); }
.lg-root .localgallery-operation-feedback[data-state="warning"] { background: rgba(231, 181, 84, 0.12); color: #f3c969; }
.lg-root .localgallery-operation-feedback[data-state="error"] { background: rgba(239, 98, 98, 0.12); color: #ff9a9a; }
.lg-root .localgallery-operation-feedback-icon {
    flex: 0 0 auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
}
.lg-root .localgallery-operation-feedback[data-state="pending"] .localgallery-operation-feedback-icon {
    width: 9px;
    height: 9px;
    box-sizing: border-box;
    border: 1.5px solid currentColor;
    border-right-color: transparent;
    background: transparent;
    animation: lg-spin 0.7s linear infinite;
}
.lg-root .localgallery-operation-feedback-message { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lg-root .localgallery-operation-feedback-action {
    display: none;
    flex: 0 0 auto;
    padding: 2px 6px;
    border: 1px solid currentColor;
    border-radius: 5px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
.lg-root .localgallery-operation-feedback.has-action .localgallery-operation-feedback-action { display: inline-flex; }
@keyframes lg-spin { to { transform: rotate(360deg); } }

/* Auto-hide bottom bar: overlays the content and slides in from the edge */
.lg-root.auto-hide-toolbars .lg-bottom {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    transition: transform 0.18s ease;
}
.lg-root.auto-hide-toolbars .lg-bottom:not(.toolbar-revealed) { transform: translateY(100%); }
.lg-root.auto-hide-toolbars .lg-bottom:not(.toolbar-revealed)::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    height: 10px;
}
.lg-root.auto-hide-toolbars .lg-bottom:not(.toolbar-revealed) > .localgallery-operation-feedback:not([data-state="ready"]) {
    position: absolute;
    right: 10px;
    bottom: calc(100% + 8px);
    background: var(--lg-surface);
    box-shadow: var(--lg-shadow);
}

/* Right-click menu on pills */
.lg-menu {
    --lg-line: rgba(147, 177, 199, 0.15);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 190px;
    padding: 6px;
    box-sizing: border-box;
    border: 1px solid rgba(159, 193, 215, 0.28);
    border-radius: 10px;
    background: #0c1621;
    color: #e8eef3;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
    font-size: 12px;
}
.lg-menu .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 8px;
    border-radius: 6px;
    cursor: pointer;
}
.lg-menu .menu-item:hover { background: rgba(160, 190, 215, 0.08); }
.lg-menu .menu-item.disabled { opacity: 0.4; cursor: default; background: none; }
.lg-menu .menu-item.danger { color: #ef6262; }
.lg-menu .menu-item svg { width: 15px; height: 15px; }
.lg-menu .menu-divider { height: 1px; margin: 2px 0; background: var(--lg-line); }
.lg-menu .menu-header {
    padding: 4px 8px 0;
    color: #627080;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
}
.lg-menu .color-presets-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; padding: 4px 8px; }
.lg-menu .color-dot {
    width: 16px;
    height: 16px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
    cursor: pointer;
}
.lg-menu .color-dot:hover { transform: scale(1.12); }
.lg-menu .color-dot.active { border-color: #e8eef3; }
.lg-menu .color-picker-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 8px 4px; }
.lg-menu .custom-color-picker-label { display: flex; align-items: center; gap: 8px; color: #8f9cab; cursor: pointer; }
.lg-menu .custom-color-input { width: 20px; height: 20px; padding: 0; border: 0; background: none; cursor: pointer; }
.lg-menu .reset-color-btn {
    padding: 3px 8px;
    border: 1px solid rgba(159, 193, 215, 0.28);
    border-radius: 5px;
    background: transparent;
    color: #8f9cab;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
}
.lg-menu .reset-color-btn:hover { color: #e8eef3; }

@media (prefers-reduced-motion: reduce) {
    .lg-root .lg-bottom,
    .lg-root .localgallery-operation-feedback-icon { transition: none; animation: none; }
}
`;
