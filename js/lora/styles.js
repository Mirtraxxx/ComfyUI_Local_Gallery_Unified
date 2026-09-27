export const LORA_STYLES = `
    /* --- Core Container Shell --- */
    .locallora-container-wrapper {
        width: 100%;
        height: 100%;
    }

    .locallora-root .locallora-container {
        --lora-card-thumb-size: 168px;
        --lora-card-min-width: 132px;
        --lora-active-thumb-size: 96px;
        --lora-active-card-width: 115px;
        --lora-active-card-height: 144px;
        --lora-active-large-card-width: 136px;
        --lora-active-large-card-height: 187px;
        --lora-active-grid-gap: 10px;
        --lora-active-card-control-scale: 1;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        position: relative;
    }

    /* --- Body Shell Layout --- */
    .locallora-root .locallora-body-shell {
        display: flex;
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
    }

    .locallora-root .locallora-gallery-pane {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        height: 100%;
    }

    /* --- Resizable Active Sidebar --- */
    .locallora-root .locallora-active-sidebar {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 130;
        width: min(clamp(300px, var(--locallora-active-sidebar-width, 450px), 720px), calc(100% - 24px));
        min-width: min(300px, calc(100% - 24px));
        max-width: min(720px, calc(100% - 24px));
        max-height: calc(100% - 24px);
        box-sizing: border-box;
        opacity: 0;
        visibility: hidden;
        overflow: hidden;
        pointer-events: none;
        transform: translateY(-10px) scaleY(0.92);
        transform-origin: top left;
        transition:
            opacity 0.18s ease-out,
            transform 0.2s ease-out,
            visibility 0s linear 0.2s,
            border-color 0.18s ease-out,
            box-shadow 0.18s ease-out;
    }

    .locallora-root .locallora-container.active-stack-open .locallora-active-sidebar {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateY(0) scaleY(1);
        transition:
            opacity 0.18s ease-out,
            transform 0.2s ease-out,
            visibility 0s;
    }

    .locallora-root .locallora-active-sidebar-content {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 12px;
        scrollbar-width: thin;
    }

    /* --- Sidebar Resizing Splitter --- */
    .locallora-root .locallora-active-splitter {
        position: absolute;
        top: 0;
        right: 0;
        width: 4px;
        height: 100%;
        cursor: ew-resize;
        z-index: 140;
        background: rgba(255, 255, 255, 0.03);
        transition: background-color 0.2s ease, width 0.2s ease;
    }
    .locallora-root .locallora-active-splitter:hover,
    .locallora-root .locallora-active-splitter.dragging {
        background-color: var(--lg-accent-line);
        width: 6px;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-splitter {
        display: none;
    }

    /* Persistent "more folders" toggle at the strip end.
       Hidden until folders overflow the strip. */

    .locallora-root .folder-filter-select {
        display: none;
    }

    /* --- LoRA Discovery Gallery --- */
    .locallora-root .locallora-gallery {
        flex-grow: 1;
        overflow-y: auto;
        background-color: #121212;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(var(--lora-card-min-width), 100%), 1fr));
        align-content: start;
        scrollbar-width: thin;
    }

    /* --- Custom Webkit Scrollbars --- */
    .locallora-root .locallora-gallery::-webkit-scrollbar,
    .locallora-root .locallora-active-sidebar-content::-webkit-scrollbar {
        width: 6px;
    }
    .locallora-root .locallora-gallery::-webkit-scrollbar-track,
    .locallora-root .locallora-active-sidebar-content::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.15);
    }
    .locallora-root .locallora-gallery::-webkit-scrollbar-thumb,
    .locallora-root .locallora-active-sidebar-content::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.18);
        border-radius: 3px;
    }
    .locallora-root .locallora-gallery::-webkit-scrollbar-thumb:hover,
    .locallora-root .locallora-active-sidebar-content::-webkit-scrollbar-thumb:hover {
        background-color: rgba(255, 255, 255, 0.3);
    }

    /* --- LoRA Discovery Card --- */
    .locallora-root .locallora-lora-card {
        cursor: pointer;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    .locallora-root .locallora-container.cards-mode-thumbnails .locallora-lora-card {
        width: 100%;
        height: var(--lora-card-responsive-height, var(--lora-card-thumb-size));
        box-sizing: border-box;
    }

    .locallora-root .locallora-lora-card.preset-open,
    .locallora-root .locallora-lora-item.preset-open {
        overflow: visible;
        z-index: 60;
    }

    .locallora-root .locallora-media-container {
        width: 100%;
        height: var(--lora-card-thumb-size);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .locallora-root .locallora-container.cards-mode-thumbnails .locallora-media-container {
        position: absolute;
        top: -1px;
        left: -1px;
        right: -1px;
        bottom: -1px;
        width: auto;
        height: auto;
        z-index: 1;
    }

    .locallora-root .locallora-media-container img,
    .locallora-root .locallora-media-container video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
    }

    .locallora-root .locallora-lora-card-info {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 8;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 4px;
        opacity: 0;
        transform: translateY(8px);
        pointer-events: none;
        transition: opacity 0.16s ease, transform 0.16s ease;
    }

    .locallora-root .locallora-lora-card:hover .locallora-lora-card-info,
    .locallora-root .locallora-lora-card:focus-within .locallora-lora-card-info,
    .locallora-root .locallora-lora-card.selected-flow .locallora-lora-card-info,
    .locallora-root .locallora-lora-card.selected-edit .locallora-lora-card-info {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
    }

    .locallora-root .locallora-lora-card p {
        font-size: 11px;
        font-weight: 700;
        line-height: 1.15;
        margin: 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #f4f8fb;
        text-shadow: 0 1px 8px rgba(0,0,0,0.82);
    }

    .locallora-root .lora-card-triggers {
        font-size: 10px;
        color: rgba(230, 238, 245, 0.72);
        padding: 0;
        text-align: left;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-height: 13px;
    }

    /* --- Card Action Buttons --- */
    .locallora-root .card-btn {
        position: absolute;
        width: 24px;
        height: 24px;
        color: white;
        border: 1px solid rgba(255,255,255,0.22);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.16s ease;
        opacity: 0;
        pointer-events: none;
        text-decoration: none;
        z-index: 10;
    }

    /* Thumbnail browser: ~2x action buttons for easier targeting */
    .locallora-root .locallora-container.cards-mode-thumbnails .card-btn {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        font-size: 16px;
    }

    .locallora-root .locallora-lora-card:hover .card-btn,
    .locallora-root .locallora-lora-card:focus-within .card-btn,
    .locallora-root .locallora-lora-card.selected-flow .card-btn,
    .locallora-root .locallora-lora-card.selected-edit .card-btn {
        opacity: 0.82;
        pointer-events: auto;
    }

    .locallora-root .card-btn:hover {
        opacity: 1 !important;
    }

    .locallora-root .card-btn svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        display: block;
    }

    .locallora-root .locallora-container.cards-mode-thumbnails .card-btn svg {
        width: 24px;
        height: 24px;
    }

    /* Top-right stack: Civitai link, then edit metadata below it */
    .locallora-root .lora-card-link-btn { top: 4px; right: 4px; }
    .locallora-root .edit-tags-btn { top: 4px; right: 4px; }
    .locallora-root .locallora-lora-card:has(.lora-card-link-btn) .edit-tags-btn {
        top: calc(4px + 24px + 4px);
    }
    .locallora-root .locallora-container.cards-mode-thumbnails .locallora-lora-card:has(.lora-card-link-btn) .edit-tags-btn {
        top: calc(4px + 44px + 4px);
    }
    .locallora-root .sync-civitai-btn { top: 4px; left: 4px; }
    .locallora-root .sync-civitai-btn.loading { animation: spin 1s linear infinite; pointer-events: none; background-color: var(--lg-accent); }
    .locallora-root .sync-civitai-btn.error { background-color: #8e2f38; border-color: #c85a64; color: #fff; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    /* --- Metadata Editor --- */
    .locallora-root .locallora-metadata-editor {
        display: none;
        position: absolute;
        top: calc(100% + 7px);
        right: 10px;
        z-index: 180;
        width: min(720px, calc(100% - 20px));
        max-height: 320px;
        flex-direction: column;
        gap: 9px;
        padding: 10px;
        box-sizing: border-box;
        margin: 0;
        overflow-x: hidden;
        overflow-y: auto;
        transform-origin: top right;
    }

    .locallora-root .locallora-metadata-editor.visible {
        display: flex;
        animation: loraMetadataPopoverIn 0.14s ease-out;
    }

    @keyframes loraMetadataPopoverIn {
        from { opacity: 0; transform: translateY(-5px) scaleY(0.97); }
        to { opacity: 1; transform: translateY(0) scaleY(1); }
    }

    .locallora-root .lora-metadata-editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(147, 177, 199, 0.14);
    }

    .locallora-root .lora-metadata-editor-heading {
        display: grid;
        min-width: 0;
        gap: 2px;
    }

    .locallora-root .lora-metadata-editor-selection {
        color: rgba(183, 200, 211, 0.68);
        font-size: 9px;
    }

    .locallora-root .lora-metadata-editor-title {
        overflow: hidden;
        color: #eef4f7;
        font-size: 12px;
        font-weight: 650;
        line-height: 1.25;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .locallora-root .lora-metadata-editor-actions {
        display: flex;
        align-items: flex-start;
        flex: 0 0 auto;
        gap: 6px;
    }

    .locallora-root .lora-thumbnail-editor-action {
        display: grid;
        justify-items: end;
        flex: 0 0 auto;
        gap: 4px;
    }

    .locallora-root .lora-thumbnail-action-status {
        display: none;
        max-width: 170px;
        overflow: hidden;
        color: rgba(199, 214, 223, 0.76);
        font-size: 9px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .locallora-root .lora-thumbnail-action-status.is-visible {
        display: block;
    }

    .locallora-root .lora-metadata-editor-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 8px;
    }

    .locallora-root .lora-metadata-field {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        min-width: 0;
    }

    .locallora-root .lora-metadata-field-label {
        display: grid;
        gap: 2px;
    }

    .locallora-root .trigger-preset-editor-row {
        padding-top: 8px;
        border-top: 1px solid rgba(147, 177, 199, 0.12);
    }

    .locallora-root .lora-trigger-preset-editor-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        min-height: 30px;
        padding: 3px 6px;
        color: inherit;
        background: transparent;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        text-align: left;
    }

    .locallora-root .lora-trigger-preset-editor-toggle:hover {
        background: rgba(130, 151, 164, 0.08);
    }

    .locallora-root .lora-trigger-preset-count {
        font-size: 9px;
        font-weight: 500;
    }

    .locallora-root .lora-trigger-preset-content {
        display: grid;
        gap: 5px;
    }

    .locallora-root .lora-trigger-preset-content[hidden] {
        display: none;
    }

    .locallora-root .trigger-preset-list {
        display: grid;
        gap: 4px;
    }

    .locallora-root .lora-trigger-preset-form {
        display: grid;
        grid-template-columns: minmax(90px, 0.35fr) minmax(0, 1fr) auto;
        gap: 5px;
    }

    .locallora-root .strength-memory-editor-row {
        padding-top: 8px;
        border-top: 1px solid rgba(147, 177, 199, 0.12);
        gap: 6px;
    }

    .locallora-root .strength-memory-controls {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }

    .locallora-root .strength-memory-control {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    @media (prefers-reduced-motion: reduce) {
        .locallora-root .locallora-metadata-editor.visible {
            animation: none;
        }
    }

    @container (max-width: 620px) {
        .locallora-root .locallora-metadata-editor {
            right: 8px;
            width: calc(100% - 16px);
            max-height: 280px;
        }
        .locallora-root .lora-metadata-editor-header {
            align-items: center;
        }
        .locallora-root .lora-thumbnail-editor-action {
            justify-items: end;
        }
        .locallora-root .lora-thumbnail-action-status {
            max-width: none;
        }
        .locallora-root .lora-metadata-editor-grid {
            grid-template-columns: 1fr;
        }
        .locallora-root .lora-trigger-preset-form {
            grid-template-columns: 1fr;
        }
    }

    /* --- Active Sidebar Items --- */
    .locallora-root .locallora-active-chips {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
    }

    .locallora-root .locallora-lora-item {
        position: relative;
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 84px;
        padding: 9px 14px 9px 10px;
        box-sizing: border-box;
        border: 1px solid rgba(85, 221, 125, 0.32);
        color: #e7ecef;
        cursor: grab;
    }

    .locallora-root .locallora-lora-item.disabled {
        opacity: 0.58;
        filter: grayscale(30%);
    }

    .locallora-root .locallora-lora-item.disabled.preset-open {
        opacity: 1;
        filter: none;
    }

    .locallora-root .locallora-selected-thumb {
        width: 64px;
        height: 64px;
        border-radius: 9px;
        overflow: hidden;
        background: #0d1116;
        border: 1px solid rgba(85, 221, 125, 0.36);
        box-shadow:
            0 6px 16px rgba(0,0,0,0.30),
            0 0 18px rgba(85, 221, 125, 0.12);
        cursor: pointer;
        transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
    }

    .locallora-root .locallora-selected-thumb:hover {
        transform: scale(1.055);
        border-color: rgba(255, 145, 40, 0.72);
        box-shadow:
            0 8px 18px rgba(0,0,0,0.34),
            0 0 24px rgba(255, 145, 40, 0.24);
    }

    .locallora-root .locallora-selected-thumb:active {
        cursor: grabbing;
    }

    .locallora-root .locallora-selected-thumb img,
    .locallora-root .locallora-selected-thumb video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
    }

    .locallora-root .locallora-selected-main {
        display: flex;
        flex-direction: column;
        min-width: 0;
        gap: 6px;
    }

    .locallora-root .locallora-selected-name {
        min-width: 0;
        overflow: hidden;
        font-size: 12px;
        font-weight: 700;
        color: #f5fbff;
        text-shadow: 0 1px 8px rgba(0,0,0,0.32);
    }

    .locallora-root .locallora-selected-name span {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .locallora-root .locallora-selected-controls {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        flex-wrap: wrap;
    }

    .locallora-root .lora-selected-toggle-pill {
        height: 24px;
        min-width: 46px;
        padding: 0 10px;
        border: 1px solid rgba(255,255,255,0.14);
        color: #fff;
        font-size: 9px;
        font-weight: 800;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
    }

    .locallora-root .lora-selected-toggle-pill.off {
        background: linear-gradient(180deg, #4a4a4a, #303030);
        border-color: #5a5a5a;
        color: #d8d8d8;
    }

    /* --- Scrollable Strength Value Adjusters --- */
    .locallora-root .lora-strength-chip {
        height: 24px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 0 8px;
        border-radius: 6px;
        background: rgba(12, 17, 23, 0.36);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e4e8eb;
        font-size: 11px;
        font-weight: 700;
        cursor: ns-resize;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
        transition: background-color 0.2s, border-color 0.2s;
    }

    .locallora-root .lora-strength-chip:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.25);
    }

    .locallora-root .lora-strength-chip .lora-strength-label {
        color: var(--lg-accent);
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
    }

    .locallora-root .lora-strength-chip .managed-weight-val {
        color: #e4e8eb;
        outline: none;
    }

    .locallora-root .lora-strength-chip.label-hidden {
        min-width: 32px;
        justify-content: center;
    }

    .locallora-root .locallora-lora-item button.remove-lora-btn {
        width: 24px;
        height: 24px;
        border: 1px solid rgba(255,255,255,0.13);
        border-radius: 50%;
        background: rgba(20, 24, 30, 0.72);
        color: #fff;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        flex-shrink: 0;
        transition: background 0.15s, border-color 0.15s;
    }

    .locallora-root .locallora-lora-item button.remove-lora-btn:hover {
        background: #8e2f38;
        border-color: #c85a64;
    }

    .locallora-root .locallora-selected-preset {
        min-width: 0;
        margin-top: 2px;
    }

    /* --- Reorder / Dragging Helpers --- */
    .locallora-root .locallora-lora-item.dragging {
        opacity: 0.45;
        border-style: dashed;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item.drag-over,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item.drag-over:hover {
        transform: scale(1.025) !important;
    }

    /* --- Compact Mode for Active Sidebar --- */
    .locallora-root .locallora-container.active-mode-compact .locallora-lora-item {
        grid-template-columns: minmax(0, 1fr);
        min-height: 64px;
        padding: 6px 12px 6px 8px;
    }

    .locallora-root .locallora-container.active-mode-compact .locallora-selected-thumb {
        display: none;
    }

    /* --- Compact Mode for Discovery Cards --- */
    .locallora-root .locallora-container.cards-mode-compact .locallora-gallery {
        grid-template-columns: repeat(auto-fill, minmax(188px, 1fr));
    }

    .locallora-root .locallora-container.cards-mode-compact .locallora-lora-card {
        min-height: 68px;
        display: grid;
        grid-template-columns: 64px minmax(0, 1fr);
        grid-template-rows: auto;
    }

    .locallora-root .locallora-container.cards-mode-compact .locallora-media-container {
        width: 64px;
        height: 64px;
    }

    .locallora-root .locallora-container.cards-mode-compact .locallora-lora-card-info {
        position: static;
        padding: 7px 8px;
        opacity: 1;
        transform: none;
        pointer-events: auto;
        background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015));
    }

    .locallora-root .locallora-container.cards-mode-compact .lora-trigger-preset-picker {
        display: none;
    }

    .locallora-root .locallora-container.cards-mode-compact .edit-tags-btn {
        top: auto;
        bottom: 4px;
        right: 4px;
    }
    .locallora-root .locallora-container.cards-mode-compact .locallora-lora-card:has(.lora-card-link-btn) .edit-tags-btn {
        top: auto;
    }
    .locallora-root .locallora-container.cards-mode-compact .card-btn {
        opacity: 0.82;
        pointer-events: auto;
    }

    /* --- Card Contrast Themes --- */
    .locallora-root .locallora-container.contrast-dim-inactive .locallora-gallery:has(.locallora-lora-card.selected-flow) .locallora-lora-card:not(.selected-flow) {
        opacity: 0.65;
        filter: grayscale(35%);
    }

    .locallora-root .locallora-container.contrast-dim-inactive .locallora-gallery:has(.locallora-lora-card.selected-flow) .locallora-lora-card:not(.selected-flow):hover {
        opacity: 0.95;
        filter: none;
        transform: translateY(-2px);
    }

    /* --- Preset Picker Options --- */

    .locallora-root .lora-trigger-preset-picker {
        position: relative;
        width: 100%;
        min-width: 0;
    }

    .locallora-root .locallora-lora-card .lora-trigger-preset-picker {
        width: calc(100% - 32px);
    }

    .locallora-root .lora-card-preset-select,
    .locallora-root .lora-card-preset-checklist {
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 1px;
        height: 1px;
        overflow: hidden;
    }

    .locallora-root .lora-trigger-preset-button {
        position: relative;
        width: 100%;
        min-width: 0;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 0 7px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(8, 10, 14, 0.58);
        color: #f0f4f7;
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
    }

    .locallora-root .lora-trigger-preset-button.has-selection {
        border-color: rgba(16, 199, 145, 0.72);
        background: rgba(16, 92, 74, 0.48);
        color: #eafff7;
    }

    .locallora-root .lora-trigger-preset-button:hover,
    .locallora-root .lora-trigger-preset-picker.open .lora-trigger-preset-button {
        border-color: rgba(255, 145, 40, 0.62);
        background: rgba(26, 23, 20, 0.86);
    }

    .locallora-root .lora-trigger-preset-picker.has-selection .lora-trigger-preset-button,
    .locallora-root .lora-trigger-preset-picker.stacking .lora-trigger-preset-button {
        border-color: rgba(16, 199, 145, 0.72);
        background: rgba(16, 92, 74, 0.48);
    }

    .locallora-root .lora-trigger-preset-picker.has-selection .lora-trigger-preset-button:hover,
    .locallora-root .lora-trigger-preset-picker.stacking .lora-trigger-preset-button:hover {
        border-color: rgba(67, 231, 182, 0.92);
        background: rgba(16, 112, 88, 0.64);
    }

    .locallora-root .lora-trigger-preset-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .locallora-root .lora-trigger-preset-count {
        min-width: 0;
        color: #95e8ca;
    }

    .locallora-root .lora-trigger-preset-arrow {
        color: rgba(230,238,245,0.62);
        font-size: 9px;
    }

    .locallora-root .lora-trigger-preset-popover {
        position: absolute;
        left: 0;
        bottom: calc(100% + 6px);
        display: none;
        z-index: 5000;
        width: min(260px, 76vw);
        max-height: 240px;
        overflow: hidden;
        padding: 8px;
        border: 1px solid rgba(159, 193, 215, 0.28);
        border-radius: 10px;
        background: #0c1621;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
    }

    .locallora-root .locallora-lora-card .lora-trigger-preset-popover {
        bottom: auto;
        top: calc(100% + 6px);
    }

    .locallora-root .lora-trigger-preset-picker.open .lora-trigger-preset-popover {
        display: block;
    }

    .locallora-root .lora-trigger-preset-search {
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 6px;
        background: #1d2229;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 7px;
        color: #eaf1f5;
        font-size: 11px;
        padding: 5px 7px;
        outline: none;
    }

    .locallora-root .lora-trigger-preset-options {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-height: 172px;
        overflow-y: auto;
    }

    .locallora-root .lora-trigger-preset-option {
        position: relative;
        width: 100%;
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(72px, 0.65fr) minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        padding: 6px 27px 6px 7px;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: #dce6eb;
        text-align: left;
        cursor: pointer;
    }

    .locallora-root .lora-trigger-preset-option:hover {
        background: rgba(255,255,255,0.07);
    }

    .locallora-root .lora-trigger-preset-option.selected {
        background: rgba(16, 199, 145, 0.3);
        border-color: rgba(67, 231, 182, 0.78);
        color: #fff;
    }

    .locallora-root .lora-trigger-preset-option.selected::after {
        content: "✓";
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: #76f0c8;
        font-size: 13px;
        font-weight: 900;
    }

    .locallora-root .lora-trigger-preset-option-name,
    .locallora-root .lora-trigger-preset-option-preview {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .locallora-root .lora-trigger-preset-option-name {
        font-size: 11px;
        font-weight: 750;
    }

    .locallora-root .lora-trigger-preset-option-preview {
        color: rgba(226, 238, 245, 0.62);
        font-size: 10px;
    }

    .locallora-root .lora-card-preset-stack-label {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #dbe6eb;
        font-size: 10px;
        margin-top: 7px;
        padding: 6px 7px 2px;
        border-top: 1px solid rgba(255,255,255,0.1);
        cursor: pointer;
    }

    .locallora-root .lora-card-preset-stack-checkbox {
        margin: 0;
    }

    .locallora-root .lora-card-preset-stack-label:has(.lora-card-preset-stack-checkbox:checked) {
        color: #95e8ca;
        background: rgba(16, 199, 145, 0.12);
        border-radius: 6px;
    }

    /* Active-stack menus are portaled to the viewport so a narrow node/sidebar
       cannot clip them or force them off the left edge. */
    .lora-trigger-preset-popover-portal {
        position: fixed;
        display: none;
        z-index: 50000;
        width: min(260px, 76vw);
        max-height: 240px;
        overflow: hidden;
        box-sizing: border-box;
        padding: 8px;
        border: 1px solid rgba(159, 193, 215, 0.28);
        border-radius: 10px;
        background: #0c1621;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
    }

    .lora-trigger-preset-popover-portal.open {
        display: block;
    }

    .lora-trigger-preset-popover-portal-active {
        width: 178px;
        max-height: 190px;
        padding: 6px;
        background: rgba(18, 22, 28, 0.92);
        backdrop-filter: blur(14px) saturate(1.2);
        -webkit-backdrop-filter: blur(14px) saturate(1.2);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        box-shadow: 0 18px 40px rgba(0,0,0,0.72);
    }

    .lora-trigger-preset-popover-portal .lora-trigger-preset-search {
        width: 100%;
        box-sizing: border-box;
        margin-bottom: 6px;
        background: #1d2229;
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 7px;
        color: #eaf1f5;
        font-size: 11px;
        padding: 5px 7px;
        outline: none;
    }

    .lora-trigger-preset-popover-portal .lora-trigger-preset-options {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-height: 172px;
        overflow-y: auto;
    }

    .lora-trigger-preset-popover-portal-active .lora-trigger-preset-options {
        max-height: 128px;
    }

    .lora-trigger-preset-popover-portal .lora-trigger-preset-option {
        position: relative;
        width: 100%;
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(72px, 0.65fr) minmax(0, 1fr);
        gap: 8px;
        align-items: center;
        padding: 6px 27px 6px 7px;
        border: 1px solid transparent;
        border-radius: 7px;
        background: transparent;
        color: #dce6eb;
        text-align: left;
        cursor: pointer;
    }

    .lora-trigger-preset-popover-portal-active .lora-trigger-preset-option {
        grid-template-columns: minmax(0, 1fr);
        gap: 0;
        padding: 7px 8px;
    }

    .lora-trigger-preset-popover-portal .lora-trigger-preset-option:hover {
        background: rgba(255,255,255,0.07);
    }

    .lora-trigger-preset-popover-portal .lora-trigger-preset-option.selected {
        background: rgba(16, 199, 145, 0.3);
        border-color: rgba(67, 231, 182, 0.78);
        color: #fff;
    }

    .lora-trigger-preset-popover-portal .lora-trigger-preset-option.selected::after {
        content: "✓";
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: #76f0c8;
        font-size: 13px;
        font-weight: 900;
    }

    .lora-trigger-preset-popover-portal .lora-trigger-preset-option-name,
    .lora-trigger-preset-popover-portal .lora-trigger-preset-option-preview {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .lora-trigger-preset-popover-portal .lora-trigger-preset-option-name {
        font-size: 11px;
        font-weight: 750;
    }

    .lora-trigger-preset-popover-portal .lora-trigger-preset-option-preview {
        color: rgba(226, 238, 245, 0.62);
        font-size: 10px;
    }

    .lora-trigger-preset-popover-portal-active .lora-trigger-preset-option-preview {
        display: none;
    }

    .lora-trigger-preset-popover-portal .lora-card-preset-stack-label {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #dbe6eb;
        font-size: 10px;
        margin-top: 7px;
        padding: 6px 7px 2px;
        border-top: 1px solid rgba(255,255,255,0.1);
        cursor: pointer;
    }

    .lora-trigger-preset-popover-portal .lora-card-preset-stack-checkbox {
        margin: 0;
    }

    .lora-trigger-preset-popover-portal .lora-card-preset-stack-label:has(.lora-card-preset-stack-checkbox:checked) {
        color: #95e8ca;
        background: rgba(16, 199, 145, 0.12);
        border-radius: 6px;
    }

    /* --- Thumbnails-centric Active Stack Grid Styles --- */
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-chips {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--lora-active-grid-gap);
        width: 100%;
        box-sizing: border-box;
    }

    .locallora-root .lora-preset-tag-icon {
        display: none;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        width: 100%;
        height: var(--lora-active-card-height);
        padding: 0;
        box-sizing: border-box;
        border: 1px solid rgba(255, 255, 255, 0.08);
        overflow: hidden;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item.disabled {
        opacity: 0.72;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item.disabled:hover {
        transform: translateY(-2px);
        border-color: rgba(85, 221, 125, 0.45);
        box-shadow: 0 12px 24px rgba(0,0,0,0.4), 0 0 10px rgba(85, 221, 125, 0.15);
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item:not(.disabled):hover {
        transform: translateY(-2px);
        border-color: rgba(16, 199, 145, 0.75);
        box-shadow: 0 12px 24px rgba(0,0,0,0.4), 0 0 18px rgba(16, 199, 145, 0.25);
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-thumb {
        position: absolute;
        top: -1px;
        left: -1px;
        right: -1px;
        bottom: -1px;
        width: auto;
        height: auto;
        border: none;
        border-radius: 0;
        box-shadow: none;
        z-index: 1;
        cursor: grab;
        overflow: hidden;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item.dragging .locallora-selected-thumb {
        cursor: grabbing;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-thumb img,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-thumb video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-active-preview-btn {
        position: absolute;
        top: clamp(6px, calc(6px * var(--lora-active-card-control-scale)), 10px);
        left: clamp(6px, calc(6px * var(--lora-active-card-control-scale)), 10px);
        z-index: 70;
        display: flex;
        align-items: center;
        justify-content: center;
        width: clamp(28px, calc(28px * var(--lora-active-card-control-scale)), 38px);
        height: clamp(28px, calc(28px * var(--lora-active-card-control-scale)), 38px);
        padding: 0;
        border-radius: 4px;
        border: 1px solid var(--lg-line-strong);
        background: rgba(20, 21, 19, 0.88);
        color: white;
        box-shadow: none;
        cursor: pointer;
        opacity: 0.88;
        pointer-events: auto;
        transition: opacity 0.16s ease, all 0.16s ease;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-active-preview-btn:hover {
        background: #30332e;
        border-color: rgba(85, 221, 125, 0.52);
        color: white;
        opacity: 1 !important;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-active-preview-btn svg {
        width: clamp(15px, calc(15px * var(--lora-active-card-control-scale)), 20px);
        height: clamp(15px, calc(15px * var(--lora-active-card-control-scale)), 20px);
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset {
        position: absolute;
        top: clamp(6px, calc(6px * var(--lora-active-card-control-scale)), 10px);
        right: clamp(6px, calc(6px * var(--lora-active-card-control-scale)), 10px);
        z-index: 70;
        width: auto;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item.preset-open {
        overflow: visible;
        z-index: 90;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-trigger-preset-picker {
        width: auto;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-button {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: clamp(28px, calc(28px * var(--lora-active-card-control-scale)), 38px);
        height: clamp(28px, calc(28px * var(--lora-active-card-control-scale)), 38px);
        padding: 0;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px) saturate(1.2);
        -webkit-backdrop-filter: blur(12px) saturate(1.2);
        color: #fff;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        opacity: 0.88;
        pointer-events: auto;
        transition: opacity 0.16s ease, background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-button:hover {
        background: rgba(255, 255, 255, 0.18);
        border-color: rgba(255, 255, 255, 0.3);
        color: #fff;
        opacity: 1 !important;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item:hover .lora-active-preview-btn,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item:focus-within .lora-active-preview-btn,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item:hover .locallora-selected-preset .lora-trigger-preset-button,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item:focus-within .locallora-selected-preset .lora-trigger-preset-button,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item.preset-open .locallora-selected-preset .lora-trigger-preset-button,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-picker.has-selection .lora-trigger-preset-button,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-picker.stacking .lora-trigger-preset-button {
        opacity: 0.88;
        pointer-events: auto;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-picker.has-selection .lora-trigger-preset-button,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-picker.stacking .lora-trigger-preset-button,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-button.has-selection {
        background: rgba(16, 92, 74, 0.82);
        border-color: rgba(67, 231, 182, 0.92);
        box-shadow: 0 0 0 1px rgba(67, 231, 182, 0.35), 0 4px 12px rgba(0, 0, 0, 0.35);
        color: #eafff7;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-button .lora-preset-tag-icon {
        width: clamp(15px, calc(15px * var(--lora-active-card-control-scale)), 20px);
        height: clamp(15px, calc(15px * var(--lora-active-card-control-scale)), 20px);
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-button .lora-trigger-preset-label,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-button .lora-trigger-preset-arrow {
        display: none;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-button .lora-trigger-preset-count {
        position: absolute;
        top: -4px;
        right: -4px;
        background: var(--lg-accent);
        color: #08111a;
        font-size: 8px;
        font-weight: 800;
        border-radius: 50%;
        width: 14px;
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #12161d;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-button .lora-trigger-preset-count:empty {
        display: none;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-trigger-preset-popover {
        top: calc(100% + 6px);
        right: 0;
        bottom: auto;
        left: auto;
        width: 178px;
        max-height: 190px;
        padding: 6px;
        z-index: 120;
        background: rgba(18, 22, 28, 0.82);
        backdrop-filter: blur(14px) saturate(1.2);
        -webkit-backdrop-filter: blur(14px) saturate(1.2);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        box-shadow: 0 18px 40px rgba(0,0,0,0.72);
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-trigger-preset-options {
        max-height: 128px;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-trigger-preset-option {
        grid-template-columns: minmax(0, 1fr);
        gap: 0;
        padding: 7px 8px;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-trigger-preset-option-preview {
        display: none;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-card-preset-stack-label {
        margin-top: 5px;
        padding: 6px 7px 1px;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-overlay-capsule {
        position: absolute;
        bottom: clamp(38px, calc(38px * var(--lora-active-card-control-scale)), 54px);
        left: 50%;
        right: auto;
        transform: translateX(-50%);
        width: max-content;
        max-width: calc(100% - clamp(12px, calc(12px * var(--lora-active-card-control-scale)), 20px));
        z-index: 5;
        display: flex;
        flex-flow: row wrap;
        align-items: center;
        justify-content: center;
        gap: 4px clamp(6px, calc(6px * var(--lora-active-card-control-scale)), 9px);
        height: auto;
        padding: clamp(4px, calc(5px * var(--lora-active-card-control-scale)), 7px) clamp(6px, calc(7px * var(--lora-active-card-control-scale)), 10px);
        background: rgba(18, 22, 28, 0.82);
        backdrop-filter: blur(12px) saturate(1.2);
        -webkit-backdrop-filter: blur(12px) saturate(1.2);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
        box-sizing: border-box;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-overlay-capsule .lora-selected-toggle-pill {
        height: clamp(26px, calc(26px * var(--lora-active-card-control-scale)), 34px);
        min-width: clamp(44px, calc(44px * var(--lora-active-card-control-scale)), 56px);
        padding: 0 clamp(8px, calc(9px * var(--lora-active-card-control-scale)), 13px);
        border-radius: 6px;
        border: 1px solid transparent;
        font-size: clamp(11px, calc(11px * var(--lora-active-card-control-scale)), 13px);
        font-weight: 800;
        line-height: 1;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-overlay-capsule .lora-selected-toggle-pill.on {
        background: linear-gradient(180deg, #10c791, #07835f);
        border-color: #3ce7b6;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-overlay-capsule .lora-selected-toggle-pill.off {
        background: linear-gradient(180deg, #4a4a4a, #303030);
        border-color: #5a5a5a;
        color: #d8d8d8;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-overlay-capsule .lora-strength-chip {
        height: clamp(26px, calc(26px * var(--lora-active-card-control-scale)), 34px);
        min-width: clamp(40px, calc(42px * var(--lora-active-card-control-scale)), 52px);
        padding: 0 clamp(8px, calc(8px * var(--lora-active-card-control-scale)), 12px);
        font-size: clamp(12px, calc(12px * var(--lora-active-card-control-scale)), 14px);
        font-weight: 750;
        border-radius: 6px;
        gap: 0;
        background: rgba(20, 20, 20, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 4px rgba(0,0,0,0.15);
    }

    .locallora-root .locallora-container.active-mode-thumbnails .lora-strength-chips-row {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-name {
        position: absolute;
        bottom: clamp(6px, calc(6px * var(--lora-active-card-control-scale)), 10px);
        left: 50%;
        right: auto;
        transform: translateX(-50%);
        width: max-content;
        max-width: calc(100% - clamp(12px, calc(12px * var(--lora-active-card-control-scale)), 20px));
        height: clamp(26px, calc(26px * var(--lora-active-card-control-scale)), 34px);
        z-index: 4;
        background: rgba(18, 22, 28, 0.78);
        backdrop-filter: blur(12px) saturate(1.2);
        -webkit-backdrop-filter: blur(12px) saturate(1.2);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: clamp(8px, calc(8px * var(--lora-active-card-control-scale)), 11px);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 10px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: clamp(11px, calc(11px * var(--lora-active-card-control-scale)), 13px);
        padding: 0 clamp(8px, calc(9px * var(--lora-active-card-control-scale)), 12px);
        box-sizing: border-box;
        color: #e4e8eb;
        pointer-events: none;
        text-align: left;
        overflow: hidden;
        font-weight: 600;
        line-height: 1.2;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-name span {
        max-width: 100%;
        text-align: left;
    }

    /* --- Hover Zoom & Cursor Hiding for weight adjustment --- */
    .locallora-root .locallora-lora-item .managed-weight-val {
        position: relative;
        z-index: 1;
        transform: scale(1);
        transform-origin: center;
        will-change: transform;
        transition: transform 0.14s ease-out, background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
        display: inline-block;
        outline: none;
    }

    .locallora-root .locallora-lora-item .managed-weight-val:hover,
    .locallora-root .locallora-lora-item .managed-weight-val:focus-visible {
        z-index: 30;
        transform: scale(1.8);
        background: rgba(10, 12, 16, 0.94);
        border: 1px solid rgba(85, 221, 125, 0.52);
        border-radius: 6px;
        padding: 0 4px;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45), 0 0 8px rgba(85, 221, 125, 0.22);
        cursor: none;
    }

    /* Folder Context Menu & Drag highlights */

    /* Drag over visual drop indicator */

    /* --- Fixed three-column Active Sidebar sizing --- */
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-sidebar {
        width: min(calc(var(--lora-active-card-width) + var(--lora-active-card-width) + var(--lora-active-card-width) + var(--lora-active-grid-gap) + var(--lora-active-grid-gap) + 24px), calc(100% - 24px)) !important;
        min-width: min(calc(var(--lora-active-card-width) + var(--lora-active-card-width) + var(--lora-active-card-width) + var(--lora-active-grid-gap) + var(--lora-active-grid-gap) + 24px), calc(100% - 24px)) !important;
        max-width: min(calc(var(--lora-active-card-width) + var(--lora-active-card-width) + var(--lora-active-card-width) + var(--lora-active-grid-gap) + var(--lora-active-grid-gap) + 24px), calc(100% - 24px)) !important;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-sidebar.large-mode {
        width: min(calc(var(--lora-active-large-card-width) + var(--lora-active-large-card-width) + var(--lora-active-large-card-width) + var(--lora-active-grid-gap) + var(--lora-active-grid-gap) + 24px), calc(100% - 24px)) !important;
        min-width: min(calc(var(--lora-active-large-card-width) + var(--lora-active-large-card-width) + var(--lora-active-large-card-width) + var(--lora-active-grid-gap) + var(--lora-active-grid-gap) + 24px), calc(100% - 24px)) !important;
        max-width: min(calc(var(--lora-active-large-card-width) + var(--lora-active-large-card-width) + var(--lora-active-large-card-width) + var(--lora-active-grid-gap) + var(--lora-active-grid-gap) + 24px), calc(100% - 24px)) !important;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-sidebar.large-mode .locallora-active-sidebar-content {
        max-height: calc(var(--lora-active-large-card-height) + var(--lora-active-large-card-height) + var(--lora-active-grid-gap) + 24px);
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-sidebar.large-mode .locallora-active-chips {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-sidebar.large-mode .locallora-lora-item {
        height: var(--lora-active-large-card-height) !important;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-selected-preset .lora-trigger-preset-button .lora-preset-tag-icon {
        display: block;
    }

    .locallora-root .locallora-container.active-mode-thumbnails .locallora-active-sidebar.large-mode .locallora-selected-preset .lora-trigger-preset-button .lora-trigger-preset-count {
        top: -5px !important;
        right: -5px !important;
        width: 16px !important;
        height: 16px !important;
        font-size: 9px !important;
    }

    .locallora-root .locallora-lora-card,
    .locallora-root .locallora-lora-item,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item {
        background: var(--lg-surface);
        border-color: var(--lg-line);
        border-radius: 6px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.025);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        transition: border-color 0.14s ease, background-color 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
    }
    .locallora-root .locallora-lora-card:hover,
    .locallora-root .locallora-lora-item:hover,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item:hover {
        background: var(--lg-raised);
        border-color: var(--lg-line-strong);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), 0 4px 10px rgba(0,0,0,0.16);
        transform: none;
    }
    .locallora-root .locallora-media-container {
        background: #121310;
    }
    .locallora-root .locallora-lora-card-info {
        padding: 32px 8px 8px;
        background: linear-gradient(180deg, transparent, rgba(12, 14, 12, 0.94));
        /* Keep default hidden; reveal only on hover / focus / selection */
    }
    .locallora-root .card-btn {
        background: rgba(20, 21, 19, 0.88);
        border-color: var(--lg-line-strong);
        border-radius: 4px;
        box-shadow: none;
    }
    .locallora-root .card-btn:hover {
        background: #30332e;
        border-color: rgba(85, 221, 125, 0.52);
    }
    .locallora-root .locallora-lora-item:not(.disabled),
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item:not(.disabled) {
        border-color: rgba(85, 221, 125, 0.30);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
    }
    .locallora-root .locallora-lora-item.drag-over,
    .locallora-root .locallora-container.active-mode-thumbnails .locallora-lora-item.drag-over {
        border-color: var(--lg-accent) !important;
        box-shadow: inset 3px 0 0 var(--lg-accent) !important;
    }
    .locallora-root .lora-selected-toggle-pill,
    .locallora-root .locallora-active-overlay-capsule,
    .locallora-root .locallora-selected-name,
    .locallora-root .lora-trigger-preset-button {
        border-radius: 4px;
    }
    .locallora-root .lora-selected-toggle-pill.on {
        background: linear-gradient(180deg, #10c791, #07835f);
        border-color: #3ce7b6;
    }
    /* --- Bar size presets: discrete steps; Normal is the base geometry above --- */

    @media (prefers-reduced-motion: reduce) {
        .locallora-root .locallora-container *,
        .locallora-root .locallora-container *::before,
        .locallora-root .locallora-container *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
    }

    .locallora-container-wrapper {
        overflow: hidden;
    }
    .locallora-root {
        container-type: inline-size;
        color-scheme: dark;
        width: 100%;
        height: 100% !important;
    }
    :where(.locallora-root .locallora-container) :where(button, input, select, textarea) { font: inherit; }
    .locallora-root .lora-execution-mode-btn[data-mode="stack"] .lora-execution-mode-icon[data-mode="compare"],
    .locallora-root .lora-execution-mode-btn[data-mode="compare"] .lora-execution-mode-icon[data-mode="stack"] { display: none; }
    .locallora-root .lora-execution-mode-icon { display: inline-flex; }
    .locallora-root .lora-compare-strengths-input { width: 96px; }
    .locallora-root .preset-dropdown { display: flex; flex-direction: column; gap: 2px; max-height: 240px; overflow-y: auto; }
    .locallora-root .lora-preset-row { display: flex; align-items: center; gap: 2px; }
    .locallora-root .lora-preset-load {
        flex: 1 1 auto;
        min-width: 0;
        height: 28px;
        padding: 0 8px;
        overflow: hidden;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--lg-text);
        font-size: 12px;
        text-align: left;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
    }
    .locallora-root .lora-preset-load:hover { background: var(--lg-hover); }
    .locallora-root .lora-preset-load.active { background: var(--lg-accent-soft); color: var(--lg-accent); }
    .locallora-root .locallora-body-shell {
        background: linear-gradient(180deg, rgba(255,255,255,0.008), rgba(0,0,0,0.04));
    }
    .locallora-root .locallora-gallery {
        gap: 12px;
        /* The browser keeps its native right-side scrollbar. Limit the
           adjacent content inset to a deliberate, compact clearance. */
        padding: 14px 4px 18px 16px;
        background: transparent;
        scrollbar-color: rgba(132, 151, 169, 0.4) transparent;
    }
    .locallora-root .locallora-lora-card {
        border-radius: 12px;
        background: #0c1721;
        border: 1px solid rgba(150, 184, 207, 0.16);
        box-shadow: 0 9px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.02);
        overflow: hidden;
        transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    }
    .locallora-root .locallora-lora-card:hover {
        transform: translateY(-2px);
        border-color: rgba(109, 224, 145, 0.34);
        box-shadow: 0 14px 32px rgba(0,0,0,0.25), 0 0 20px rgba(63, 205, 108, 0.075);
    }
    .locallora-root .locallora-lora-card.selected {
        border-color: rgba(75, 225, 119, 0.78);
        box-shadow: 0 0 0 1px rgba(73, 224, 118, 0.17), 0 0 23px rgba(61, 215, 106, 0.14), 0 14px 30px rgba(0,0,0,0.24);
    }
    .locallora-root .locallora-lora-card img,
    .locallora-root .locallora-lora-card video { transition: transform 0.24s ease, filter 0.24s ease; }
    .locallora-root .locallora-lora-card:hover img,
    .locallora-root .locallora-lora-card:hover video { transform: scale(1.025); }
    .locallora-root .locallora-metadata-editor {
        color: var(--lg-text);
        background: var(--lg-surface);
        border: 1px solid var(--lg-line-strong);
        border-radius: 10px;
        box-shadow: var(--lg-shadow);
    }
    @container (max-width: 620px) {
        .locallora-root .locallora-gallery { padding: 10px; gap: 9px; }
    }
    .locallora-root .lora-trigger-preset-row { display: flex; align-items: center; gap: 4px; min-width: 0; }
    .locallora-root .lora-trigger-preset-row-name { flex: 0 0 80px; overflow: hidden; color: var(--lg-text); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .locallora-root .lora-trigger-preset-row-value { flex: 1 1 auto; min-width: 0; overflow: hidden; color: var(--lg-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .locallora-root .lora-trigger-preset-row .lg-text-btn { height: 24px; }
    .locallora-root .lora-trigger-preset-row .lg-icon-btn { width: 24px; height: 24px; min-width: 24px; }
    .locallora-root .use-last-output-thumbnail-btn.success { background: var(--lg-accent-soft); color: var(--lg-accent); }
    .locallora-root .lora-metadata-field > span,
    .locallora-root .lora-metadata-field-label > span,
    .locallora-root .strength-memory-control > span { color: var(--lg-muted); font-size: 11px; font-weight: 500; }
    .locallora-root .lora-metadata-field > small,
    .locallora-root .lora-metadata-field-label > small { color: var(--lg-faint); font-size: 10.5px; line-height: 1.35; }
    .locallora-root .lora-trigger-preset-toggle-icon { display: inline-flex; color: var(--lg-muted); transition: transform 0.14s ease; }
    /* Same selected treatment as a Prompt card */
    .locallora-root .locallora-lora-card.selected-flow {
        border-width: 2px;
        border-color: rgba(75, 225, 119, 0.78);
        box-shadow: 0 0 0 1px rgba(73, 224, 118, 0.17), 0 0 23px rgba(61, 215, 106, 0.14), 0 14px 30px rgba(0,0,0,0.24);
    }
`;
