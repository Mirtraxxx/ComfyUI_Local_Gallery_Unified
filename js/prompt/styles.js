import {
    ACTIVE_SIDEBAR_WIDTH_LARGE_DEFAULT,
    ACTIVE_SIDEBAR_WIDTH_LARGE_MAX,
    ACTIVE_SIDEBAR_WIDTH_LARGE_MIN,
    ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT,
    ACTIVE_SIDEBAR_WIDTH_NORMAL_MAX,
    ACTIVE_SIDEBAR_WIDTH_NORMAL_MIN,
} from "./constants.js";

export const PROMPT_STYLES = `
    .localprompt-container-wrapper {
        width: 100%;
        height: 100%;
    }
    .localprompt-container {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
    }

    /* Pull tab hanging from the bar's bottom edge, centered on
       the full top bar. Hidden until fit-measure finds
       categories off the strip. */
    .localprompt-pinned-category-pill {
        max-width: 128px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.2;
        cursor: pointer;
        flex: 0 1 auto;
    }

    .localprompt-meta-panel {
        left: auto;
        right: 0;
        width: min(300px, calc(100vw - 24px));
        max-width: calc(100vw - 24px);
        box-sizing: border-box;
        padding: 10px 12px;
    }
    .localprompt-meta-save-status {
        color: rgba(225, 237, 245, 0.5);
        font-size: 9px;
        line-height: 1.35;
        white-space: nowrap;
        min-width: 46px;
        text-align: right;
    }
    .localprompt-meta-save-status.saving {
        color: #aaa;
    }
    .localprompt-meta-save-status.saved {
        color: rgba(130, 220, 150, 0.85);
    }
    .localprompt-meta-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: min(340px, calc(100vh - 190px));
        overflow-y: auto;
        padding-right: 2px;
    }
    .localprompt-meta-row {
        display: grid;
        grid-template-columns: 12px 54px minmax(0, 1fr) 28px;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-bottom: none;
        background: rgba(20, 24, 30, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        transition: background 0.15s, border-color 0.15s;
    }
    .localprompt-meta-row:last-child {
        border-bottom: none;
    }
    .localprompt-meta-row:hover {
        background: rgba(26, 32, 40, 0.96);
        border-color: rgba(255, 255, 255, 0.18);
    }
    .localprompt-meta-row.pinned-dragging {
        opacity: 0.55;
        border-style: dashed;
    }
    .localprompt-meta-row.pinned-drop-target {
        border-color: #4a9eff !important;
        box-shadow: 0 0 0 1px rgba(74, 158, 255, 0.35);
    }
    .localprompt-meta-drag-handle {
        display: grid;
        grid-template-columns: repeat(2, 2px);
        grid-auto-rows: 2px;
        gap: 3px 2px;
        justify-content: center;
        align-content: center;
        width: 12px;
        height: 24px;
        cursor: grab;
        user-select: none;
        opacity: 0.45;
        transition: opacity 0.15s;
    }
    .localprompt-meta-drag-handle:hover {
        opacity: 0.9;
    }
    .localprompt-meta-drag-handle span {
        width: 2px;
        height: 2px;
        border-radius: 50%;
        background: rgba(225, 237, 245, 0.70);
    }
    .localprompt-meta-row:active .localprompt-meta-drag-handle {
        cursor: grabbing;
    }
    .localprompt-meta-toggle {
        height: 24px;
        min-width: 46px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid rgba(100, 100, 100, 0.6);
        background: linear-gradient(180deg, #3c3c3c 0%, #2a2a2a 100%);
        color: #d5d5d5;
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
    }
    .localprompt-meta-toggle.on {
        background: linear-gradient(180deg, #3a9b55 0%, #27723b 100%);
        border-color: rgba(90, 180, 100, 0.85);
        color: #fff;
        box-shadow: 0 0 12px rgba(90, 156, 90, 0.22);
    }
    .localprompt-meta-toggle.off {
        background: linear-gradient(180deg, #3c3c3c 0%, #2a2a2a 100%);
        border-color: rgba(100, 100, 100, 0.5);
        color: #e0e0e0;
    }
    .localprompt-meta-text {
        min-width: 0;
        width: 100%;
        height: 24px;
        background: rgba(10, 12, 16, 0.5);
        color: #e0e0e0;
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 5px;
        font-size: 11px;
        line-height: 16px;
        padding: 3px 8px;
        box-sizing: border-box;
        align-self: center;
        transition: border-color 0.15s, background 0.15s;
        resize: none;
        min-height: 24px;
        max-height: 110px;
        overflow: hidden;
    }
    .localprompt-meta-text::placeholder {
        color: rgba(225, 237, 245, 0.35);
    }
    .localprompt-meta-text:focus {
        border-color: rgba(174, 226, 255, 0.4);
        background: rgba(10, 12, 16, 0.75);
        outline: none;
    }
    @media (max-width: 520px) {
        .localprompt-meta-panel {
            width: min(280px, calc(100vw - 24px));
        }
        .localprompt-meta-save-status {
            margin-top: 3px;
            text-align: left;
        }
        .localprompt-meta-row {
            grid-template-columns: 54px minmax(0, 1fr) 28px;
        }
    }
    .localprompt-meta-empty {
        padding: 10px;
        border: 1px dashed rgba(255, 255, 255, 0.1);
        border-radius: 7px;
        color: rgba(225, 237, 245, 0.4);
        font-size: 11px;
        text-align: center;
    }
    .localprompt-workspace {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
    }
    .localprompt-top-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        position: relative;
        transition: border-bottom-color 0.2s ease;
    }
    .localprompt-body-shell {
        display: flex;
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
    }
    .localprompt-active-sidebar {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 130;
        width: min(clamp(${ACTIVE_SIDEBAR_WIDTH_NORMAL_MIN}px, var(--localprompt-active-sidebar-width, ${ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT}px), ${ACTIVE_SIDEBAR_WIDTH_NORMAL_MAX}px), calc(100% - 24px));
        min-width: min(330px, calc(100% - 24px));
        max-width: min(540px, calc(100% - 24px));
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
    .localprompt-active-sidebar.active {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateY(0) scaleY(1);
        transition:
            opacity 0.18s ease-out,
            transform 0.2s ease-out,
            visibility 0s;
    }
    .localprompt-active-sidebar.large-mode {
        width: min(clamp(${ACTIVE_SIDEBAR_WIDTH_LARGE_MIN}px, var(--localprompt-active-sidebar-width, ${ACTIVE_SIDEBAR_WIDTH_LARGE_DEFAULT}px), ${ACTIVE_SIDEBAR_WIDTH_LARGE_MAX}px), calc(100% - 24px));
        min-width: min(620px, calc(100% - 24px));
        max-width: min(840px, calc(100% - 24px));
    }
    .localprompt-active-sidebar-content {
        flex: 0 1 auto;
        min-height: 0;
        max-height: min(520px, calc(100vh - 300px));
        overflow-y: auto;
        padding: 13px 15px 15px;
        scrollbar-width: thin;
        scrollbar-color: #4a4a4a transparent;
    }
    .localprompt-active-sidebar .localprompt-chip-container {
        max-height: none;
        min-height: 0;
        padding-right: 1px;
    }
    .localprompt-active-sidebar .localprompt-chip-container.active-compact-mode {
        flex-direction: column;
        flex-wrap: nowrap;
        align-items: stretch;
        gap: 8px;
    }
    .localprompt-active-sidebar .localprompt-chip-container.active-thumbnail-mode {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: center;
        gap: 8px;
    }
    /* Match Prompt Builder: the slider sets a column minimum,
       then fractional tracks pack each row across the
       currently available sidebar width. */
    .localprompt-active-sidebar .localprompt-chip-container.localprompt-active-thumbnail-grid {
        display: grid;
        width: 100%;
        grid-template-columns: repeat(auto-fill, minmax(min(var(--localprompt-thumb-width), 100%), 1fr));
        align-content: start;
        align-items: start;
        gap: 8px;
    }
    .localprompt-active-sidebar .localprompt-chip-container.localprompt-active-thumbnail-grid .localprompt-chip-thumb.pinned-managed {
        width: 100%;
        height: auto;
        min-width: 0;
        aspect-ratio: 100 / 146;
        box-sizing: border-box;
    }
    .localprompt-active-sidebar .managed-thumb-media {
        cursor: pointer;
        transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb:hover .managed-thumb-media,
    .localprompt-active-sidebar .managed-thumb-media:focus-visible {
        transform: scale(1.03);
        box-shadow: 0 0 22px rgba(135, 231, 255, 0.22), 0 8px 18px rgba(0,0,0,0.28);
        outline: none;
    }
    .localprompt-library-pane {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        position: relative;
    }
    .localprompt-workspace-host {
        display: none;
        flex: 1;
        overflow: hidden;
    }
    .localprompt-workspace-host.active {
        display: flex;
        flex-direction: column;
    }
    .localprompt-library-shell {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
    }
    .localprompt-library-subnav {
        flex-wrap: wrap;
    }
    .localprompt-library-subnav-item {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
    }
    .localprompt-library-shell-content {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
    }
    .localprompt-library-shell-content > .localprompt-workspace-panel {
        padding: 0;
    }
    .localprompt-library-shell .localprompt-workspace-body {
        padding-top: 8px;
    }
    .localprompt-from-output-page.localprompt-workspace-page {
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
    }
    .localprompt-from-output-page .localprompt-workspace-body {
        padding-top: 8px;
    }
    .localprompt-from-output-page .localprompt-workspace-footer {
        background: transparent;
        border-top: 1px solid rgba(255,255,255,0.06);
    }
    .localprompt-from-output-page .localprompt-workspace-section {
        background: transparent;
        border: 0;
        border-radius: 0;
        padding: 0 0 14px;
        margin-bottom: 14px;
    }
    .localprompt-add-prompt-tabs {
        padding: 0 0 10px !important;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        margin-bottom: 12px !important;
    }
    .localprompt-workspace-panel {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        padding: 10px;
        overflow: hidden;
    }
    .localprompt-workspace-page {
        width: 100% !important;
        max-width: none !important;
        max-height: none !important;
        height: 100%;
        flex: 1;
        box-shadow: none !important;
        border-radius: 6px !important;
    }
    .localprompt-workspace-page {
        display: flex;
        flex-direction: column;
        min-height: 0;
        border: 1px solid rgba(255,255,255,0.09);
        color: #ddd;
        overflow: hidden;
    }
    .localprompt-workspace-body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 10px 14px;
    }
    .localprompt-workspace-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 8px 14px;
        background: rgba(255,255,255,0.025);
        border-top: 1px solid rgba(255,255,255,0.08);
        flex: 0 0 auto;
    }
    .localprompt-workspace-section {
        margin-bottom: 14px;
    }

    .localprompt-library-drawer {
        background: #141414;
        border-bottom: 0;
        display: none;
        flex: 0 1 auto;
        max-height: 100%;
        overflow: hidden;
        box-shadow: inset 0 4px 6px rgba(0,0,0,0.3);
    }
    .localprompt-library-drawer.active {
        display: flex;
        flex-direction: column;
        animation: slideDown 0.2s ease-out;
    }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

    .localprompt-library-drawer .localprompt-chip-container {
        max-height: none;
        /* Leave a small, deliberate buffer before the right-side
           scrollbar so card borders do not touch its track. */
        padding-right: 4px;
        padding-left: 0;
        flex: 0 1 auto;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #4a4a4a transparent;
    }
    .localprompt-chip-container {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        max-height: 180px;
        overflow-y: auto;
        padding-right: 0;
        scrollbar-width: thin;
        scrollbar-color: #4a4a4a transparent;
    }
    .localprompt-active-sidebar-content::-webkit-scrollbar,
    .localprompt-library-drawer .localprompt-chip-container::-webkit-scrollbar,
    .localprompt-chip-container::-webkit-scrollbar {
        width: 5px;
        height: 5px;
    }
    .localprompt-active-sidebar-content::-webkit-scrollbar-track,
    .localprompt-library-drawer .localprompt-chip-container::-webkit-scrollbar-track,
    .localprompt-chip-container::-webkit-scrollbar-track {
        background: transparent;
    }
    .localprompt-active-sidebar-content::-webkit-scrollbar-thumb,
    .localprompt-library-drawer .localprompt-chip-container::-webkit-scrollbar-thumb,
    .localprompt-chip-container::-webkit-scrollbar-thumb {
        background: #4a4a4a;
        border-radius: 999px;
    }
    .localprompt-active-sidebar-content::-webkit-scrollbar-thumb:hover,
    .localprompt-library-drawer .localprompt-chip-container::-webkit-scrollbar-thumb:hover,
    .localprompt-chip-container::-webkit-scrollbar-thumb:hover {
        background: #5a5a5a;
    }
    .localprompt-container-wrapper {
        --localprompt-thumb-height: 132px;
        --localprompt-thumb-width: 90px;
        --localprompt-thumb-label-size: 9px;
    }
    .localprompt-chip {
        width: auto;
        height: auto;
        padding: 4px 10px;
        border: 1px solid #444;
        font-size: 11px;
        color: #ddd;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
    }
    .localprompt-chip.selected { background: #1a2a3a; border: 2px solid #4a9eff; }
    .localprompt-chip.pinned-managed {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        min-width: 180px;
        padding: 10px;
        border-radius: 14px;
        white-space: normal;
    }
    .localprompt-chip.pinned-managed .managed-card-name {
        font-size: 11px;
        color: #f0f0f0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .localprompt-chip.pinned-managed .managed-card-controls {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .localprompt-chip.pinned-managed .managed-weight-val {
        min-width: 34px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.05);
        text-align: center;
        font-size: 11px;
        color: #ddd;
        cursor: ns-resize;
    }
    .localprompt-chip.pinned-managed .managed-weight-val:hover {
        background: rgba(0, 0, 0, 0.45);
        border-color: rgba(255, 255, 255, 0.15);
        color: #ffffff;
    }
    .localprompt-active-row {
        display: grid;
        grid-template-columns: 12px 64px minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 84px;
        padding: 9px 14px 9px 10px;
        box-sizing: border-box;
        border: 1px solid rgba(178, 224, 255, 0.32);
        border-radius: 13px;
        background:
            radial-gradient(circle at 6% 15%, color-mix(in srgb, var(--role-color, #77dfff) 18%, transparent), transparent 34%),
            linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.035) 44%, rgba(255,255,255,0.065)),
            rgba(24, 29, 37, 0.43);
        backdrop-filter: blur(12px) saturate(1.16);
        -webkit-backdrop-filter: blur(12px) saturate(1.16);
        color: #e7ecef;
        cursor: pointer;
        box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.08),
            0 10px 24px rgba(0,0,0,0.22),
            0 0 20px rgba(115, 222, 255, 0.10),
            0 0 28px rgba(170, 114, 255, 0.07);
    }
    .localprompt-active-row:hover {
        border-color: rgba(209, 239, 255, 0.54);
        background:
            radial-gradient(circle at 6% 15%, color-mix(in srgb, var(--role-color, #77dfff) 22%, transparent), transparent 34%),
            linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.045) 44%, rgba(255,255,255,0.08)),
            rgba(30, 36, 45, 0.48);
        box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.1),
            0 12px 28px rgba(0,0,0,0.24),
            0 0 24px rgba(128, 229, 255, 0.15),
            0 0 34px rgba(184, 123, 255, 0.11);
    }
    .localprompt-active-row.role-colored {
        border-color: color-mix(in srgb, var(--role-color, #78dfff) 22%, rgba(186, 225, 255, 0.42));
        box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.08),
            0 10px 24px rgba(0,0,0,0.22),
            0 0 18px color-mix(in srgb, var(--role-color, #78dfff) 14%, transparent),
            0 0 28px rgba(145, 123, 255, 0.08);
    }
    .localprompt-active-drag-handle {
        display: grid;
        grid-template-columns: repeat(2, 2px);
        grid-auto-rows: 2px;
        gap: 3px 2px;
        justify-content: center;
        align-content: center;
        width: 12px;
        height: 34px;
        cursor: grab;
        user-select: none;
        opacity: 0.75;
    }
    .localprompt-active-drag-handle span {
        width: 2px;
        height: 2px;
        border-radius: 50%;
        background: rgba(216, 232, 240, 0.58);
    }
    .localprompt-active-row:active .localprompt-active-drag-handle {
        cursor: grabbing;
    }
    .localprompt-active-row-thumb {
        width: 64px;
        height: 64px;
        border-radius: 9px;
        overflow: hidden;
        background: #0d1116;
        border: 1px solid rgba(198, 237, 255, 0.36);
        box-shadow:
            0 6px 16px rgba(0,0,0,0.30),
            0 0 18px rgba(127, 226, 255, 0.12);
        cursor: pointer;
        transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
    }
    .localprompt-active-row-thumb:hover,
    .localprompt-active-row-thumb:focus-visible {
        transform: scale(1.055);
        border-color: rgba(220, 247, 255, 0.72);
        box-shadow:
            0 8px 18px rgba(0,0,0,0.34),
            0 0 24px rgba(134, 232, 255, 0.24),
            0 0 30px rgba(184, 122, 255, 0.13);
        outline: none;
    }
    .localprompt-active-row-thumb img,
    .localprompt-active-row-thumb video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
    }
    .localprompt-active-row-thumb-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        box-sizing: border-box;
        color: color-mix(in srgb, var(--role-color, #9ab8ff) 72%, #ffffff);
        background:
            radial-gradient(circle at 50% 20%, color-mix(in srgb, var(--role-color, #2f89d8) 25%, transparent), transparent 46%),
            #121922;
        font-size: 9px;
        font-weight: 800;
        text-align: center;
        line-height: 1.1;
        overflow: hidden;
    }
    .localprompt-active-main {
        display: grid;
        grid-template-rows: 1fr auto;
        align-self: stretch;
        min-width: 0;
        gap: 8px;
        margin-left: 0;
        justify-content: center;
    }
    .localprompt-active-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        align-self: start;
        font-size: 13px;
        font-weight: 700;
        color: #f5fbff;
        padding-top: 2px;
        text-shadow: 0 1px 8px rgba(0,0,0,0.32);
    }
    .localprompt-active-controls {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }
    .localprompt-workflow-edit-button,
    .localprompt-workflow-revert-button,
    .localprompt-workflow-cancel-button,
    .localprompt-workflow-confirm-button,
    .localprompt-workflow-editor-close {
        border: 1px solid rgba(163, 220, 255, 0.34);
        border-radius: 6px;
        background: rgba(13, 25, 36, 0.74);
        color: #d8f2ff;
        cursor: pointer;
        font: inherit;
    }
    .localprompt-workflow-edit-button {
        min-height: 24px;
        padding: 3px 7px;
        font-size: 9px;
        line-height: 1.1;
        white-space: nowrap;
    }
    .localprompt-workflow-edit-button:hover,
    .localprompt-workflow-revert-button:hover,
    .localprompt-workflow-cancel-button:hover,
    .localprompt-workflow-editor-close:hover {
        background: rgba(44, 102, 137, 0.72);
        border-color: rgba(191, 237, 255, 0.7);
        color: #fff;
    }
    .localprompt-active-row {
        position: relative;
    }
    .localprompt-workflow-edited-badge {
        position: absolute;
        top: 7px;
        right: 8px;
        z-index: 5;
        padding: 2px 6px;
        border: 1px solid rgba(120, 225, 180, 0.56);
        border-radius: 999px;
        background: rgba(20, 92, 62, 0.84);
        color: #e0fff0;
        font-size: 9px;
        font-weight: 700;
        line-height: 1.1;
        pointer-events: none;
    }
    .localprompt-active-row .localprompt-active-name {
        padding-right: 48px;
    }
    .localprompt-active-row .localprompt-active-controls {
        gap: 6px;
        flex-wrap: wrap;
    }
    .localprompt-active-row .localprompt-workflow-edit-button {
        min-height: 20px;
        padding: 2px 5px;
        font-size: 8px;
    }
    .localprompt-workflow-editor-overlay {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: grid;
        place-items: stretch;
        padding: clamp(10px, 2.4vw, 32px);
        box-sizing: border-box;
        background: rgba(3, 8, 12, 0.88);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        cursor: default;
    }
    .localprompt-workflow-editor {
        min-width: 0;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        overflow: hidden;
        border: 1px solid rgba(163, 220, 255, 0.32);
        border-radius: 12px;
        background: #0d151c;
        color: #f4fbff;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.5);
    }
    .localprompt-workflow-editor-header,
    .localprompt-workflow-editor-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 16px 20px;
        background: #121d26;
    }
    .localprompt-workflow-editor-header {
        border-bottom: 1px solid rgba(163, 220, 255, 0.18);
    }
    .localprompt-workflow-editor-footer {
        border-top: 1px solid rgba(163, 220, 255, 0.18);
    }
    .localprompt-workflow-editor-heading {
        min-width: 0;
    }
    .localprompt-workflow-editor-heading h2 {
        margin: 0;
        color: #f5fbff;
        font: 700 clamp(17px, 2vw, 22px)/1.2 system-ui, sans-serif;
    }
    .localprompt-workflow-editor-heading p {
        margin: 4px 0 0;
        overflow: hidden;
        color: #a9bdc9;
        font: 12px/1.4 system-ui, sans-serif;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .localprompt-workflow-editor-close {
        width: 38px;
        height: 38px;
        flex: 0 0 38px;
        padding: 0;
        color: #d8e7ee;
        font: 26px/1 system-ui, sans-serif;
    }
    .localprompt-workflow-editor-body {
        min-width: 0;
        min-height: 0;
        padding: clamp(16px, 2.5vw, 28px);
    }
    .localprompt-workflow-editor-input-pane {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        display: grid;
        grid-template-rows: auto auto minmax(0, 1fr);
        gap: 8px;
    }
    .localprompt-workflow-editor-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .localprompt-workflow-editor-label {
        color: #c9dce6;
        font: 650 12px/1.3 system-ui, sans-serif;
    }
    .localprompt-workflow-inline-diff-status {
        color: #91a7b3;
        font: 10px/1.3 system-ui, sans-serif;
    }
    .localprompt-workflow-inline-diff-status.has-changes {
        color: #92e7b5;
    }
    .localprompt-workflow-original-reference {
        min-width: 0;
        overflow: hidden;
        border: 1px solid rgba(170, 213, 235, 0.18);
        border-radius: 7px;
        background: #0b151c;
    }
    .localprompt-workflow-original-reference summary {
        padding: 8px 11px;
        color: #a9c0cc;
        cursor: pointer;
        font: 650 10px/1.3 system-ui, sans-serif;
        user-select: none;
    }
    .localprompt-workflow-original-reference[open] summary {
        border-bottom: 1px solid rgba(170, 213, 235, 0.12);
    }
    .localprompt-workflow-original-reference pre {
        min-height: 74px;
        max-height: min(220px, 28vh);
        margin: 0;
        overflow: auto;
        box-sizing: border-box;
        padding: clamp(14px, 2vw, 22px);
        color: #dce8ee;
        font: clamp(14px, 1.3vw, 17px)/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        scrollbar-width: thin;
    }
    .localprompt-workflow-editor-input-wrap {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 180px;
        overflow: hidden;
        box-sizing: border-box;
        border: 1px solid rgba(170, 213, 235, 0.32);
        border-radius: 9px;
        background: #081017;
    }
    .localprompt-workflow-editor-input-wrap:focus-within {
        border-color: #70c8f2;
        box-shadow: 0 0 0 3px rgba(112, 200, 242, 0.18);
    }
    .localprompt-workflow-editor-text,
    .localprompt-workflow-editor-highlight {
        position: absolute;
        inset: 0;
        margin: 0;
        box-sizing: border-box;
        border: 0;
        outline: 0;
        font: clamp(14px, 1.3vw, 17px)/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        tab-size: 4;
        padding: clamp(14px, 2vw, 22px);
    }
    .localprompt-workflow-editor-highlight {
        z-index: 1;
        overflow: hidden;
        pointer-events: none;
        color: transparent;
    }
    .localprompt-workflow-diff-added {
        border-radius: 3px;
        background: rgba(42, 164, 99, 0.34);
        box-shadow: inset 0 -1px 0 #63d995;
        color: transparent;
        padding: 1px 0;
    }
    .localprompt-workflow-diff-removed {
        border-radius: 3px;
        background: rgba(199, 70, 70, 0.28);
        box-shadow: inset 0 -1px 0 #ef7777;
        color: #ffd0d0;
        padding: 1px 0;
        text-decoration: line-through;
        text-decoration-color: #ff8f8f;
    }
    .localprompt-workflow-editor-text {
        z-index: 2;
        width: 100%;
        height: 100%;
        min-height: 0;
        resize: none;
        overflow: auto;
        scrollbar-gutter: stable;
        background: transparent;
        color: #f4fbff;
        -webkit-text-fill-color: #f4fbff;
        caret-color: #f4fbff;
    }
    .localprompt-workflow-editor-text::selection {
        background: rgba(112, 200, 242, 0.32);
    }
    .localprompt-workflow-editor-status {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 9px;
        color: #9fb4c0;
        font: 11px/1.3 system-ui, sans-serif;
    }
    .localprompt-workflow-editor-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
    }
    .localprompt-workflow-revert-button,
    .localprompt-workflow-cancel-button,
    .localprompt-workflow-confirm-button {
        min-height: 38px;
        padding: 7px 14px;
        font: 650 12px/1 system-ui, sans-serif;
        white-space: nowrap;
    }
    .localprompt-workflow-revert-button {
        margin-right: auto;
        color: #c9e8f6;
    }
    .localprompt-chip-thumb.pinned-managed .localprompt-workflow-edit-button svg {
        width: 12px;
        height: 12px;
        stroke: currentColor;
    }
    .localprompt-chip-thumb.pinned-managed .localprompt-workflow-edit-button.is-edited {
        border-color: rgba(101, 232, 167, 0.88);
        background: rgba(20, 112, 72, 0.82);
        color: #effff6;
    }
    .localprompt-chip-thumb.pinned-managed .localprompt-workflow-edit-button.is-edited::after {
        content: "";
        position: absolute;
        top: -2px;
        right: -2px;
        width: 5px;
        height: 5px;
        border: 1px solid rgba(8, 23, 16, 0.95);
        border-radius: 50%;
        background: #7cf2aa;
        box-shadow: 0 0 5px rgba(124, 242, 170, 0.8);
    }
    .localprompt-workflow-confirm-button {
        border-color: #68c2ea;
        background: #167cac;
        color: #fff;
    }
    .localprompt-workflow-confirm-button:hover {
        border-color: #9cddfa;
        background: #2093c8;
    }
    .localprompt-workflow-editor-actions button:active,
    .localprompt-workflow-editor-close:active {
        transform: translateY(1px);
    }
    @media (max-width: 640px) {
        .localprompt-workflow-editor-overlay {
            padding: 0;
        }
        .localprompt-workflow-editor {
            border: 0;
            border-radius: 0;
        }
        .localprompt-workflow-editor-header,
        .localprompt-workflow-editor-footer {
            padding: 12px;
        }
        .localprompt-workflow-editor-footer {
            align-items: stretch;
            flex-direction: column;
        }
        .localprompt-workflow-editor-status {
            justify-content: space-between;
        }
        .localprompt-workflow-editor-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
        }
        .localprompt-workflow-revert-button {
            grid-column: 1 / -1;
            margin-right: 0;
        }
    }
    @media (prefers-reduced-transparency: reduce) {
        .localprompt-workflow-editor-overlay {
            background: #050b10;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
        }
    }
    .localprompt-active-row .managed-state-pill {
        position: static;
        height: 28px;
        min-width: 54px;
        padding: 0 13px;
        border-radius: 999px;
        font-size: 10px;
        letter-spacing: 0;
    }
    .localprompt-active-row .managed-state-pill.on {
        background: linear-gradient(180deg, #44b66a, #2e864d);
        border-color: #65cf82;
        color: #fff;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
    }
    .localprompt-active-row .managed-state-pill.off {
        background: linear-gradient(180deg, #444, #303030);
        border-color: #5a5a5a;
        color: #cfcfcf;
    }
    .localprompt-active-row .localprompt-inline-btn,
    .localprompt-active-row .localprompt-info-btn {
        width: 30px;
        height: 30px;
        min-width: 30px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
    }
    .localprompt-active-row .localprompt-inline-btn {
        background: rgba(12, 17, 23, 0.36);
        border: 1px solid rgba(202, 228, 242, 0.24);
        color: #d5dde4;
        font-size: 14px;
    }
    .localprompt-active-row .localprompt-inline-btn:hover {
        border-color: rgba(224, 244, 255, 0.5);
        background: rgba(255,255,255,0.09);
    }
    .localprompt-active-row .managed-weight-val {
        min-width: 38px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 6px;
        border-radius: 6px;
        background: rgba(12, 17, 23, 0.36);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e4e8eb;
        font-size: 14px;
        font-weight: 700;
        cursor: ns-resize;
    }
    .localprompt-active-row .managed-weight-val:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.25);
        color: #ffffff;
    }
    .localprompt-chip.pinned-draggable { cursor: grab; }
    .localprompt-chip.pinned-draggable:active { cursor: grabbing; }
    .localprompt-chip.pinned-dragging {
        opacity: 0.45;
        border-style: dashed;
    }
    .localprompt-chip.selected::before {
        content: '+';
        display: flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        background: #4a9eff;
        color: #fff;
        border-radius: 50%;
        font-size: 9px;
        font-weight: bold;
        flex-shrink: 0;
    }
    .localprompt-chip.role-colored {
        border-color: color-mix(in srgb, var(--role-color, #4c4c4c) 65%, #444);
        box-shadow: inset 3px 0 0 color-mix(in srgb, var(--role-color, #4c4c4c) 85%, transparent);
    }
    .localprompt-chip-thumb {
        width: var(--localprompt-thumb-width);
        height: var(--localprompt-thumb-height);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }
    .localprompt-chip-thumb.selected { border-width: 2px; }
    @keyframes border-zip {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    @keyframes border-zip-reverse {
        0% { transform: rotate(360deg); }
        100% { transform: rotate(0deg); }
    }
    .localprompt-chip-thumb.pinned-managed {
        width: var(--localprompt-thumb-width);
        height: var(--localprompt-thumb-height);
        border-width: 2px;
        border-color: rgba(255, 255, 255, 0.12);
        z-index: 5;
        position: relative;
        overflow: hidden;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }
    /*
     * Active border themes used to spin dual full-card conic layers
     * with live blur filters. That shared the GPU with sampling and
     * could tank it/s until a hard refresh. Keep the color themes as
     * a cheap static border/glow only — no continuous animation.
     */
    .localprompt-container-wrapper {
        --localprompt-zip-color-1: rgba(255, 255, 255, 0.85);
        --localprompt-zip-color-2: rgba(255, 255, 255, 0.35);
    }
    .localprompt-active-sidebar.active .localprompt-chip-thumb.pinned-managed {
        border-color: color-mix(in srgb, var(--localprompt-zip-color-1) 70%, rgba(255, 255, 255, 0.12));
        box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.3),
            0 0 0 1px color-mix(in srgb, var(--localprompt-zip-color-1) 45%, transparent),
            0 0 14px color-mix(in srgb, var(--localprompt-zip-color-1) 28%, transparent),
            0 0 18px color-mix(in srgb, var(--localprompt-zip-color-2) 18%, transparent);
    }
    .localprompt-chip-thumb.pinned-managed::before,
    .localprompt-chip-thumb.pinned-managed::after {
        content: none !important;
        animation: none !important;
        filter: none !important;
        will-change: auto !important;
    }

    /* Active border tracer themes (static colors only) */

    /* While Comfy is sampling, also drop panel blur / video decode. */
    .localprompt-container-wrapper.localprompt-sampling-quiet .localprompt-active-sidebar,
    .localprompt-container-wrapper.localprompt-sampling-quiet .localprompt-library-drawer {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
    }
    .localprompt-chip-thumb.pinned-managed .managed-thumb-media {
        position: absolute;
        inset: 2px;
        border-radius: 4px;
        overflow: hidden;
        z-index: 2;
    }
    .localprompt-chip-thumb.pinned-managed .thumb-label {
        left: 7px;
        right: 7px;
        bottom: 6px;
        padding: 2px 6px 3px;
        border-radius: 5px;
        background: rgba(8, 12, 16, 0.42);
        border: 1px solid rgba(255, 255, 255, 0.06);
        backdrop-filter: blur(5px) saturate(1.08);
        -webkit-backdrop-filter: blur(5px) saturate(1.08);
        text-shadow: 0 1px 2px rgba(0,0,0,0.72);
    }
    .localprompt-chip-thumb.pinned-managed.no-thumb {
        background:
            radial-gradient(circle at 50% 22%, color-mix(in srgb, var(--role-color, #4a9eff) 26%, transparent), transparent 42%),
            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015)),
            #111820;
    }
    .localprompt-chip-thumb.pinned-managed.no-thumb .managed-thumb-media {
        display: flex;
        align-items: stretch;
        justify-content: stretch;
    }
    .managed-thumb-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        height: 100%;
        padding: 32px 10px 52px;
        box-sizing: border-box;
        text-align: center;
        background:
            linear-gradient(135deg, color-mix(in srgb, var(--role-color, #4a9eff) 18%, transparent), transparent 48%),
            radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06), transparent 54%);
    }
    .managed-placeholder-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 9px;
        color: color-mix(in srgb, var(--role-color, #9ab8ff) 74%, #ffffff);
        background: color-mix(in srgb, var(--role-color, #4a9eff) 16%, rgba(255,255,255,0.04));
        border: 1px solid color-mix(in srgb, var(--role-color, #4a9eff) 44%, rgba(255,255,255,0.12));
        font-size: 14px;
        font-weight: 800;
        box-shadow: 0 8px 20px rgba(0,0,0,0.18);
    }
    .managed-placeholder-category {
        max-width: 100%;
        padding: 2px 7px;
        border-radius: 999px;
        color: color-mix(in srgb, var(--role-color, #9ab8ff) 70%, #ffffff);
        background: rgba(0,0,0,0.22);
        border: 1px solid color-mix(in srgb, var(--role-color, #4a9eff) 34%, rgba(255,255,255,0.12));
        font-size: 9px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .managed-placeholder-name {
        max-width: 100%;
        color: #f3f5f6;
        font-size: var(--localprompt-thumb-label-size);
        font-weight: 700;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }
    .localprompt-chip-thumb.pinned-managed.no-thumb .thumb-label {
        display: none;
    }
    .localprompt-chip-thumb.pinned-managed .managed-card-overlay {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 38px;
        width: max-content;
        height: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 4px 8px;
        background: rgba(18, 22, 28, 0.82);
        backdrop-filter: blur(12px) saturate(1.2);
        -webkit-backdrop-filter: blur(12px) saturate(1.2);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        overflow: visible;
        z-index: 4;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    }
    .localprompt-chip-thumb.pinned-managed .managed-card-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: auto;
        background: transparent;
        border: none;
        border-radius: 0;
        overflow: visible;
    }
    .localprompt-chip-thumb.pinned-managed .managed-weight-val {
        min-width: 40px;
        height: 26px;
        text-align: center;
        font-size: 12px;
        font-weight: 750;
        color: #f0f0f0;
        padding: 0 8px;
        background: rgba(20, 20, 20, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        backdrop-filter: none;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 4px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: ns-resize;
    }
    .localprompt-chip-thumb.pinned-managed .managed-weight-val:hover {
        background: rgba(30, 30, 30, 0.9);
        border-color: rgba(255, 255, 255, 0.3);
        color: #ffffff;
    }
    .localprompt-chip.pinned-managed .managed-weight-val,
    .localprompt-chip-thumb.pinned-managed .managed-weight-val,
    .localprompt-active-row .managed-weight-val {
        position: relative;
        z-index: 1;
        transform: scale(1);
        transform-origin: center;
        will-change: transform;
        transition:
            transform 0.14s ease-out,
            background-color 0.2s,
            border-color 0.2s,
            box-shadow 0.2s;
    }
    .localprompt-chip.pinned-managed .managed-weight-val:hover,
    .localprompt-chip-thumb.pinned-managed .managed-weight-val:hover,
    .localprompt-active-row .managed-weight-val:hover,
    .localprompt-chip.pinned-managed .managed-weight-val:focus-visible,
    .localprompt-chip-thumb.pinned-managed .managed-weight-val:focus-visible,
    .localprompt-active-row .managed-weight-val:focus-visible {
        z-index: 30;
        transform: scale(2);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.38);
    }
    .localprompt-chip.pinned-managed .managed-weight-val:hover,
    .localprompt-chip-thumb.pinned-managed .managed-weight-val:hover,
    .localprompt-active-row .managed-weight-val:hover {
        cursor: none;
    }
    .localprompt-chip-thumb.pinned-managed .managed-state-pill {
        min-width: 44px;
        height: 26px;
        padding: 0 10px;
        border: 1px solid transparent;
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        flex-shrink: 0;
    }
    .localprompt-chip-thumb.pinned-managed .managed-state-pill.on {
        background: linear-gradient(180deg, #10c791, #07835f);
        border-color: #3ce7b6;
        color: #fff;
    }
    .localprompt-chip-thumb.pinned-managed .managed-state-pill.off {
        background: linear-gradient(180deg, #4a4a4a, #303030);
        border-color: #5a5a5a;
        color: #d8d8d8;
    }
    .localprompt-chip-thumb.pinned-managed .localprompt-inline-btn {
        width: 20px;
        height: 20px;
        min-width: 20px;
        flex: 0 0 20px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        font-size: 11px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
        backdrop-filter: none;
        box-shadow: none;
    }
    .localprompt-chip-thumb.pinned-managed .localprompt-inline-btn:hover {
        background: rgba(255, 255, 255, 0.18);
        border-color: rgba(255, 255, 255, 0.3);
    }

    /* Active thumbnail actions mirror the Prompt Builder card treatment. */
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .localprompt-info-btn {
        background: rgba(20, 20, 20, 0.75);
        color: #e0e0e0;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        border-radius: 8px;
        width: 44px;
        height: 44px;
        left: 6px;
        top: 6px;
        opacity: 0.88;
        pointer-events: auto;
        transition: opacity 0.15s ease, all 0.15s;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .localprompt-info-btn:hover {
        background: rgba(40, 40, 40, 0.9);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.4);
        transform: scale(1.05);
        opacity: 1 !important;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .localprompt-info-btn svg {
        width: 24px;
        height: 24px;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .localprompt-workflow-edit-button {
        position: absolute;
        top: 6px;
        right: 6px;
        z-index: 10;
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        flex: 0 0 44px;
        border-radius: 8px;
        background: rgba(20, 20, 20, 0.75);
        color: #e0e0e0;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        opacity: 0.88;
        pointer-events: auto;
        transition: opacity 0.15s ease, all 0.15s;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .localprompt-workflow-edit-button:hover {
        background: rgba(40, 40, 40, 0.9);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.4);
        transform: scale(1.05);
        opacity: 1 !important;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .localprompt-workflow-edit-button svg {
        width: 24px;
        height: 24px;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .managed-state-pill {
        min-width: 44px;
        height: 26px;
        padding: 0 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
        border: 1px solid transparent;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        flex-shrink: 0;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .managed-state-pill.on {
        background: linear-gradient(180deg, #10c791, #07835f);
        border-color: #3ce7b6;
        color: #ffffff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .managed-state-pill.off {
        background: linear-gradient(180deg, #4a4a4a, #303030);
        border-color: #5a5a5a;
        color: #d8d8d8;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .managed-weight-val {
        min-width: 40px;
        height: 26px;
        font-size: 12px;
        font-weight: 750;
        color: #ffffff;
        padding: 0 8px;
        background: rgba(20, 20, 20, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 4px rgba(0,0,0,0.15);
        cursor: ns-resize;
        margin-left: 2px;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .managed-weight-val:hover {
        background: rgba(30, 30, 30, 0.9);
        border-color: rgba(255, 255, 255, 0.3);
        color: #ffffff;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .thumb-label {
        left: 6px;
        right: 6px;
        bottom: 6px;
        padding: 4px 8px;
        border-radius: 8px;
        background: rgba(16, 20, 26, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(12px) saturate(1.2);
        -webkit-backdrop-filter: blur(12px) saturate(1.2);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 10px rgba(0, 0, 0, 0.2);
        font-size: 11px;
        font-weight: 600;
        color: #f3f5f6;
        text-align: center;
        line-height: 1.25;
        letter-spacing: 0.01em;
    }
    .localprompt-active-sidebar.large-mode .localprompt-chip-thumb.pinned-managed .thumb-label {
        font-size: 11px;
        padding: 5px 10px;
        bottom: 8px;
        left: 8px;
        right: 8px;
    }
    .localprompt-active-sidebar .localprompt-chip-thumb.pinned-managed .managed-card-overlay {
        bottom: 38px;
        padding: 4px 8px;
        border-radius: 10px;
        background: rgba(18, 22, 28, 0.82);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    }
    .localprompt-active-sidebar.large-mode .localprompt-chip-thumb.pinned-managed .managed-card-overlay {
        bottom: 48px;
    }
    /* display rule is freed up now since selected badge uses :not(.pinned-managed) */
    .localprompt-info-btn,
    .localprompt-gallery-item .favorite-btn,
    .chip-pin-btn {
        position: absolute;
        top: 6px;
        width: 22px;
        height: 22px;
        background: rgba(20, 20, 20, 0.75);
        color: #e0e0e0;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        font-weight: bold;
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        backdrop-filter: blur(4px);
        transition: all 0.15s;
        line-height: 1;
        padding: 0;
    }
    /* Prompt Builder + gallery thumbnail cards: ~2x action buttons */
    .localprompt-chip-thumb .localprompt-info-btn,
    .localprompt-chip-thumb .chip-pin-btn,
    .localprompt-gallery-item .localprompt-info-btn,
    .localprompt-gallery-item .favorite-btn {
        width: 44px;
        height: 44px;
        border-radius: 8px;
        font-size: 16px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s ease, background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;
    }
    .localprompt-chip-thumb:hover .localprompt-info-btn,
    .localprompt-chip-thumb:focus-within .localprompt-info-btn,
    .localprompt-chip-thumb.selected .localprompt-info-btn,
    .localprompt-chip-thumb:hover .chip-pin-btn,
    .localprompt-chip-thumb:focus-within .chip-pin-btn,
    .localprompt-chip-thumb.selected .chip-pin-btn,
    .localprompt-gallery-item:hover .localprompt-info-btn,
    .localprompt-gallery-item:focus-within .localprompt-info-btn,
    .localprompt-gallery-item.selected .localprompt-info-btn,
    .localprompt-gallery-item:hover .favorite-btn,
    .localprompt-gallery-item:focus-within .favorite-btn,
    .localprompt-gallery-item.selected .favorite-btn {
        opacity: 0.88;
        pointer-events: auto;
    }
    .localprompt-info-btn svg,
    .localprompt-gallery-item .favorite-btn svg,
    .chip-pin-btn svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
    }
    .localprompt-chip-thumb .localprompt-info-btn svg,
    .localprompt-chip-thumb .chip-pin-btn svg,
    .localprompt-gallery-item .localprompt-info-btn svg,
    .localprompt-gallery-item .favorite-btn svg {
        width: 24px;
        height: 24px;
    }
    .localprompt-info-btn:hover,
    .localprompt-gallery-item .favorite-btn:hover,
    .chip-pin-btn:hover {
        background: rgba(40, 40, 40, 0.9);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.4);
        transform: scale(1.05);
        opacity: 1 !important;
    }
    .localprompt-info-btn {
        left: 6px;
    }
    .localprompt-chip-thumb .localprompt-info-btn::after,
    .localprompt-gallery-item .localprompt-info-btn::after {
        content: "";
        position: absolute;
        top: 0;
        right: -3px;
        bottom: -8px;
        left: -3px;
    }
    .localprompt-gallery-item .favorite-btn,
    .chip-pin-btn {
        right: 6px;
    }
    .localprompt-gallery-item .favorite-btn.favorited,
    .chip-pin-btn.favorited {
        color: #ffd700;
        border-color: rgba(255, 215, 0, 0.5);
        background: rgba(40, 35, 10, 0.85);
    }
    .localprompt-chip .localprompt-info-btn,
    .localprompt-chip .chip-pin-btn {
        position: static;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
    }
    .localprompt-chip .localprompt-info-btn {
        margin-right: 4px;
    }
    .localprompt-chip .chip-pin-btn {
        margin-left: auto;
    }
    .managed-state-pill {
        position: relative;
        top: auto;
        left: auto;
        z-index: 5;
        min-width: 34px;
        height: auto;
        padding: 5px 10px;
        border-radius: 0;
        border: none;
        background: rgba(60, 60, 60, 0.7);
        color: #d8d8d8;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
        flex-shrink: 0;
    }
    .managed-state-pill.on {
        background: rgba(46, 110, 62, 0.85);
        color: #fff;
    }
    .managed-state-pill.off {
        background: rgba(48, 48, 48, 0.88);
        color: #bdbdbd;
    }
    .localprompt-chip-thumb.pinned-draggable { cursor: grab; }
    .localprompt-chip-thumb.pinned-draggable:active { cursor: grabbing; }
    .localprompt-chip-thumb.pinned-dragging {
        opacity: 0.45;
        border-style: dashed;
    }
    .localprompt-chip-thumb.role-colored {
        border-color: var(--role-color, #4c4c4c);
    }
    .localprompt-chip-thumb.role-colored.pinned-managed {
        border-color: color-mix(in srgb, var(--role-color, #ffffff) 40%, rgba(255, 255, 255, 0.08));
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }
    .localprompt-active-sidebar.active .localprompt-chip-thumb.role-colored.pinned-managed {
        border-color: color-mix(in srgb, var(--role-color, #ffffff) 55%, var(--localprompt-zip-color-1, #ffffff));
        box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.3),
            0 0 0 1px color-mix(in srgb, var(--role-color, #ffffff) 35%, transparent),
            0 0 14px color-mix(in srgb, var(--role-color, #ffffff) 22%, transparent);
    }
    .localprompt-chip-thumb.role-colored.pinned-managed .managed-thumb-media::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 3;
        pointer-events: none;
        background: linear-gradient(180deg, color-mix(in srgb, var(--role-color, #4c4c4c) 12%, transparent) 0%, transparent 38%);
        border-radius: 4px;
    }
    .localprompt-chip-thumb img,
    .localprompt-chip-thumb video {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
    }
    .localprompt-chip-thumb .thumb-label {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        box-sizing: border-box;
        background: linear-gradient(180deg, rgba(0,0,0,0), rgba(6,10,14,0.74));
        font-size: var(--localprompt-thumb-label-size);
        color: #f4f8fb;
        padding: 20px 5px 5px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        z-index: 3;
        opacity: 0;
        transform: translateY(7px);
        pointer-events: none;
        text-shadow: 0 1px 8px rgba(0,0,0,0.78);
        transition: opacity 0.16s ease, transform 0.16s ease;
    }
    .localprompt-chip-thumb:hover .thumb-label,
    .localprompt-chip-thumb:focus-within .thumb-label,
    .localprompt-chip-thumb.selected .thumb-label {
        opacity: 1;
        transform: translateY(0);
    }
    .localprompt-library-drawer .localprompt-chip-label {
        display: inline-block;
        opacity: 0;
        transform: translateY(3px);
        transition: opacity 0.16s ease, transform 0.16s ease;
    }
    .localprompt-library-drawer .localprompt-chip:hover .localprompt-chip-label,
    .localprompt-library-drawer .localprompt-chip:focus-within .localprompt-chip-label,
    .localprompt-library-drawer .localprompt-chip.selected .localprompt-chip-label {
        opacity: 1;
        transform: translateY(0);
    }
    .localprompt-inline-btn {
        height: 26px;
        border-radius: 0;
        border: none;
        border-left: 1px solid rgba(255,255,255,0.08);
        background: rgba(255, 255, 255, 0.04);
        color: #f0f0f0;
        font-size: 14px;
        cursor: pointer;
        backdrop-filter: none;
        box-shadow: none;
        transition: background 0.15s;
    }
    .localprompt-inline-btn {
        min-width: 26px;
        padding: 0;
    }
    /* inline button overrides are handled in card overlay section */
    .localprompt-inline-btn:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .localprompt-bottom-bar {
        position: relative;
        z-index: 120;
        isolation: isolate;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 0;
        flex-shrink: 0;
        max-height: 220px;
        opacity: 1;
        overflow: visible;
        transition: max-height 0.18s ease, padding 0.18s ease, opacity 0.16s ease, transform 0.18s ease, margin 0.18s ease, background 0.18s ease, border-color 0.18s ease;
    }
    .localprompt-container-wrapper.auto-hide-toolbars .localprompt-bottom-bar > * {
        opacity: 1;
        transform: translateY(0);
        transition: opacity 0.16s ease, transform 0.18s ease;
    }
    .localprompt-bottom-bar .seed-input {
        width: 60px;
        background: transparent;
        border: none;
        color: #fff;
        font-family: inherit;
        font-size: 11px;
        text-align: right;
        outline: none;
        -moz-appearance: textfield;
        padding-right: 6px;
    }
    .localprompt-bottom-bar .seed-input::-webkit-inner-spin-button,
    .localprompt-bottom-bar .seed-input::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    .localprompt-chip.manual-order-draggable,
    .localprompt-chip-thumb.manual-order-draggable {
        cursor: grab;
        touch-action: none;
        user-select: none;
    }
    .localprompt-chip.manual-order-draggable:active,
    .localprompt-chip-thumb.manual-order-draggable:active {
        cursor: grabbing;
    }

    .localprompt-empty-state {
        padding: 20px;
        text-align: center;
        color: #666;
        font-size: 11px;
    }

    .localprompt-hover-preview {
        position: fixed;
        background: #151b21;
        border: 1px solid var(--role-color, #4a9eff);
        border-radius: 8px;
        padding: 0;
        z-index: 20000;
        width: min(300px, calc(100vw - 24px));
        max-width: 300px;
        box-shadow: 0 10px 28px rgba(0,0,0,0.72);
        pointer-events: none;
        display: block;
        opacity: 0;
        visibility: hidden;
        transform: translateY(6px);
        transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
        overflow: hidden;
    }
    .localprompt-hover-preview.active {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
        pointer-events: auto;
    }
    .localprompt-hover-preview .preview-media-button {
        width: 100%;
        padding: 0;
        margin: 0;
        border: 0;
        background: #0d1116;
        cursor: zoom-in;
        display: block;
    }
    .localprompt-hover-preview img, .localprompt-hover-preview video {
        width: 100%;
        max-height: 300px;
        object-fit: cover;
        display: block;
        background: #111;
        opacity: 1;
    }
    .localprompt-hover-preview .preview-media-button.image-preview img {
        width: 100%;
        max-width: 100%;
        height: auto;
        max-height: min(420px, 62vh);
        object-fit: cover;
        margin: 0 auto;
    }
    .localprompt-hover-preview .preview-meta {
        padding: 12px 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: rgba(13,17,22,0.98);
    }
    .localprompt-hover-preview .preview-name {
        font-size: 13px;
        font-weight: 700;
        color: #ececec;
        line-height: 1.35;
        text-align: center;
    }
    .localprompt-hover-preview .preview-pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: center;
    }
    .localprompt-hover-preview .preview-pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 8px;
        border-radius: 5px;
        background: rgba(255,255,255,0.04);
        color: rgba(225, 237, 245, 0.75);
        font-size: 10px;
        border: 1px solid rgba(255,255,255,0.08);
        line-height: 1;
        font-weight: 500;
    }
    .localprompt-hover-preview .preview-pill .category-color-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--role-color, #3f69a8);
        display: inline-block;
        margin-right: 6px;
        flex-shrink: 0;
    }
    .localprompt-hover-preview .preview-pill.category-pill {
        background: color-mix(in srgb, var(--role-color, #3f69a8) 15%, rgba(255,255,255,0.02));
        border-color: color-mix(in srgb, var(--role-color, #3f69a8) 35%, rgba(255,255,255,0.08));
        color: color-mix(in srgb, var(--role-color, #3f69a8) 85%, #fff);
    }
    .localprompt-hover-preview .preview-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: center;
    }
    .localprompt-hover-preview .preview-actions button {
        min-height: 24px;
        padding: 4px 10px;
        border-radius: 5px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
        color: #dce6ee;
        font-size: 10px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease, color 0.15s ease;
    }
    .localprompt-hover-preview .preview-actions button:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(174, 226, 255, 0.3);
        color: #fff;
    }
    .localprompt-hover-preview .preview-actions button:active {
        transform: scale(0.96);
        background: rgba(255,255,255,0.12);
    }
    .localprompt-hover-preview .preview-text {
        font-size: 11px;
        color: #c6ced5;
        background: #10151b;
        padding: 8px;
        border-radius: 5px;
        border: 1px solid rgba(255,255,255,0.08);
        max-height: 180px;
        overflow-y: auto;
        line-height: 1.45;
        white-space: pre-wrap;
        scrollbar-width: thin;
    }
    .localprompt-hover-preview .preview-text[hidden] {
        display: none;
    }
    .localprompt-preview-lightbox {
        position: fixed;
        inset: 0;
        z-index: 30000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 28px;
        box-sizing: border-box;
        background: rgba(0,0,0,0.82);
    }
    .localprompt-preview-lightbox-media {
        max-width: min(96vw, 1400px);
        max-height: 92vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .localprompt-preview-lightbox-media img,
    .localprompt-preview-lightbox-media video {
        max-width: 100%;
        max-height: 92vh;
        object-fit: contain;
        border-radius: 8px;
        background: #080a0d;
        box-shadow: 0 16px 48px rgba(0,0,0,0.65);
    }
    .localprompt-preview-lightbox-close {
        position: fixed;
        top: 14px;
        right: 14px;
        width: 32px;
        height: 32px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(20,24,28,0.9);
        color: #f1f4f5;
        cursor: pointer;
        font-size: 15px;
    }

    /* Modal styles */
    .localprompt-modal-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    .localprompt-modal {
        background: var(--lg-surface);
        border: 1px solid var(--lg-line-strong);
        border-radius: 10px;
        width: 700px;
        max-width: 90vw;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: var(--lg-shadow);
        color: var(--lg-text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px;
    }
    .localprompt-modal-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--lg-line);
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .localprompt-modal-header h3 { margin: 0; font-size: 14px; color: var(--lg-text); }
    .localprompt-modal-close {
        background: none;
        border: none;
        color: var(--lg-muted);
        font-size: 18px;
        cursor: pointer;
    }
    .localprompt-modal-close:hover { color: var(--lg-text); }
    .localprompt-modal-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
    }

    /* Gallery grid for modal */
    .localprompt-gallery-grid {
        display: grid;
        padding-bottom: 64px;
    }
    /* Card Manager fullscreen mode keeps the same controls while giving cards room to use their natural image ratio. */
    .localprompt-card-manager-fullscreen {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483000 !important;
        width: 100vw !important;
        height: 100vh !important;
        min-height: 0 !important;
        box-sizing: border-box;
        padding: 0 !important;
        overflow: hidden !important;
        isolation: isolate;
        opacity: 1 !important;
        background: #08111a !important;
    }
    .localprompt-card-manager-fullscreen.localprompt-modal-overlay {
        align-items: stretch;
        justify-content: stretch;
    }
    .localprompt-card-manager-fullscreen > .localprompt-modal {
        width: 100% !important;
        max-width: none !important;
        height: 100% !important;
        max-height: none !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        background: #08111a !important;
        opacity: 1 !important;
    }
    .localprompt-card-manager-fullscreen .localprompt-workspace-body,
    .localprompt-card-manager-fullscreen .localprompt-modal-content {
        background: #08111a !important;
    }
    /* Card Manager uses CSS fullscreen. Portaled Prompt
       surfaces must live under this high stacking context,
       otherwise body-level previews render behind it. */
    .localprompt-card-manager-surface-host {
        position: fixed;
        inset: 0;
        z-index: 2147483600;
        pointer-events: none;
    }
    .localprompt-card-manager-surface-host > * {
        pointer-events: auto;
    }
    body:has(> .localprompt-card-manager-fullscreen) > .localprompt-modal-overlay:not(.localprompt-card-manager-fullscreen) {
        z-index: 2147483500 !important;
    }
    .localprompt-card-manager-fullscreen .localprompt-gallery-grid {
        grid-template-columns: repeat(auto-fill, minmax(var(--localprompt-card-manager-fullscreen-card-width, 210px), 1fr));
        align-items: start;
        gap: 14px;
    }
    .localprompt-card-manager-fullscreen .localprompt-gallery-item .item-preview {
        width: 100%;
        height: auto;
        min-height: 0;
        aspect-ratio: 1.04 / 1;
    }
    .localprompt-card-manager-fullscreen .localprompt-gallery-item .item-preview:not(.no-img) {
        min-height: 0;
    }
    .localprompt-card-manager-fullscreen .localprompt-gallery-item .item-preview img,
    .localprompt-card-manager-fullscreen .localprompt-gallery-item .item-preview video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .localprompt-browse-page {
        position: relative;
    }
    .localprompt-browse-page .localprompt-workspace-body,
    .localprompt-browse-page .localprompt-modal-content {
        padding-bottom: 10px;
        /* Keep the Card Manager scrollbar on the right without
           changing text, grid placement, or controls. */
        padding-right: 4px;
    }
    .localprompt-browse-footer.localprompt-workspace-footer,
    .localprompt-browse-footer {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 40;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 6px 12px 8px;
        background: transparent;
        box-shadow: none;
        border-top: 0;
        pointer-events: none;
    }
    .localprompt-browse-pagination-pill {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        max-width: calc(100% - 24px);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 999px;
        overflow: hidden;
        pointer-events: auto;
    }
    .localprompt-browse-page-info {
        min-width: 68px;
        padding: 0 4px;
        color: #aab1b8;
        font-size: 11px;
        text-align: center;
        white-space: nowrap;
    }
    .localprompt-gallery-item {
        position: relative;
        cursor: pointer;
    }
    .localprompt-gallery-item.pinned-dragging {
        opacity: 0.55;
        border-style: dashed;
    }
    .localprompt-gallery-item.pinned-drop-target {
        border-color: #88c0ff !important;
        box-shadow: 0 0 0 1px rgba(136,192,255,0.35), 0 8px 18px rgba(0,0,0,0.25);
    }
    .localprompt-gallery-item.selected {
        position: relative;
    }
    .localprompt-gallery-item.selected::after {
        position: absolute;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: bold;
        z-index: 10;
    }
    .localprompt-gallery-item .item-preview {
        height: auto;
        aspect-ratio: 75 / 58;
        background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 42%, transparent 70%), #101720;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }
    .localprompt-gallery-item .item-preview img,
    .localprompt-gallery-item .item-preview video { width: 100%; height: 100%; object-fit: cover; }
    .localprompt-gallery-item .item-preview.no-img { font-size: 10px; color: #5f6975; }
    .localprompt-gallery-item .item-info {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 8;
        box-sizing: border-box;
        padding: 25px 10px 8px;
        pointer-events: none;
        transition: opacity 0.16s ease, transform 0.16s ease;
    }
    .localprompt-gallery-item:hover .item-info,
    .localprompt-gallery-item:focus-within .item-info,
    .localprompt-gallery-item.selected .item-info {
        opacity: 1;
        transform: translateY(0);
    }
    .localprompt-gallery-item .item-name {
        font-size: 12px;
        font-weight: 650;
        line-height: 1.15;
        color: #f4f8fb;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 0 1px 8px rgba(0,0,0,0.78);
    }
    .localprompt-gallery-item .item-category {
        margin-top: 3px;
        overflow: hidden;
        color: #aebbc4;
        font-size: 10px;
        line-height: 1.15;
        text-overflow: ellipsis;
        text-shadow: 0 1px 8px rgba(0,0,0,0.78);
        white-space: nowrap;
    }
    .localprompt-bulk-summary {
        margin-right: auto;
    }
    .localprompt-bulk-status {
        flex: 0 1 auto;
        min-height: 14px;
        color: #9dd8aa;
        font-size: 11px;
        white-space: nowrap;
    }
    .localprompt-gallery-item.manage-mode.bulk-selected {
        border-color: #58d66a;
        box-shadow: inset 0 0 0 2px rgba(88,214,106,0.45), 0 10px 22px rgba(0,0,0,0.2);
    }
    .localprompt-card-select-indicator {
        position: absolute;
        top: 7px;
        left: 7px;
        width: 22px;
        height: 22px;
        box-sizing: border-box;
        background: rgba(10,18,25,0.78);
        color: #fff;
        border: 2px solid rgba(230,239,244,0.82);
        border-radius: 7px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 800;
        z-index: 12;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        pointer-events: none;
    }
    .localprompt-gallery-item.manage-mode.bulk-selected .localprompt-card-select-indicator {
        background: #3aa954;
        border-color: #d8ffe0;
    }
    .localprompt-gallery-item.manage-mode.bulk-selected .localprompt-card-select-indicator::after {
        content: '✓';
    }
    .localprompt-gallery-item.manage-mode .item-info {
        padding-right: 56px;
        opacity: 1;
        transform: translateY(0);
    }
    .localprompt-gallery-item.manage-mode .localprompt-info-btn {
        top: auto;
        right: 6px;
        bottom: 6px;
        left: auto;
    }
    .localprompt-gallery-item.manage-mode:hover {
        transform: none;
    }
    .localprompt-bulk-move-overlay {
        z-index: 2147483500;
    }
    .localprompt-bulk-move-dialog {
        width: min(440px, calc(100vw - 32px));
        border: 1px solid rgba(88, 214, 106, 0.35);
        box-shadow: 0 24px 70px rgba(0,0,0,0.48);
    }
    .localprompt-bulk-move-dialog .localprompt-modal-header {
        background: linear-gradient(135deg, #1e2b33, #18222b);
    }
    .localprompt-bulk-move-dialog .localprompt-modal-header h3 {
        margin-bottom: 3px;
    }
    .localprompt-bulk-move-subtitle,
    .localprompt-bulk-move-preview {
        margin: 0;
        color: #aebbc4;
        font-size: 11px;
        line-height: 1.45;
    }
    .localprompt-bulk-move-content {
        display: grid;
        gap: 8px;
    }
    .localprompt-bulk-move-dialog .localprompt-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 10px 16px 14px;
        border-top: 1px solid rgba(255,255,255,0.08);
    }
    .localprompt-bulk-delete-overlay {
        z-index: 2147483500;
    }
    .localprompt-bulk-delete-dialog {
        width: min(620px, calc(100vw - 32px));
        border: 1px solid rgba(239,98,98,0.34);
        box-shadow: 0 24px 70px rgba(0,0,0,0.48);
    }
    .localprompt-bulk-delete-subtitle,
    .localprompt-bulk-delete-more,
    .localprompt-bulk-delete-warning {
        margin: 0;
        color: #aebbc4;
        font-size: 11px;
        line-height: 1.45;
    }
    .localprompt-bulk-delete-content {
        display: grid;
        gap: 12px;
    }
    .localprompt-bulk-delete-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 9px;
    }
    .localprompt-bulk-delete-card {
        min-width: 0;
    }
    .localprompt-bulk-delete-thumb {
        overflow: hidden;
        aspect-ratio: 75 / 58;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 7px;
        background: #101720;
    }
    .localprompt-bulk-delete-thumb img,
    .localprompt-bulk-delete-thumb video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .localprompt-bulk-delete-placeholder {
        display: grid;
        width: 100%;
        height: 100%;
        place-items: center;
        color: #71808b;
        font-size: 10px;
    }
    .localprompt-bulk-delete-name {
        margin-top: 5px;
        overflow: hidden;
        color: #e8eef3;
        font-size: 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .localprompt-bulk-delete-warning {
        padding: 9px 11px;
        border: 1px solid rgba(239,98,98,0.24);
        border-radius: 7px;
        background: rgba(118,47,50,0.18);
        color: #f3c4c4;
    }
    .localprompt-bulk-delete-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }
    @container (max-width: 520px) {
        .localprompt-bulk-delete-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }
    .localprompt-field-label {
        color: #e5edf1;
        font-size: 11px;
        font-weight: 650;
    }
    .localprompt-bulk-move-new-row {
        display: grid;
        gap: 8px;
        margin-top: 5px;
    }
    .localprompt-bulk-move-new-row[hidden] {
        display: none;
    }
    .localprompt-bulk-edit-overlay {
        z-index: 100011;
    }
    .localprompt-bulk-edit-dialog {
        width: min(680px, calc(100vw - 32px));
        max-height: min(820px, calc(100vh - 32px));
        border: 1px solid rgba(88, 214, 106, 0.35);
        box-shadow: 0 24px 70px rgba(0,0,0,0.48);
    }
    .localprompt-bulk-edit-dialog .localprompt-modal-content {
        overflow-y: auto;
    }
    .localprompt-bulk-edit-subtitle,
    .localprompt-bulk-edit-section label,
    .localprompt-bulk-edit-preview-heading span {
        color: #aebbc4;
        font-size: 11px;
        line-height: 1.45;
    }
    .localprompt-bulk-edit-section {
        display: grid;
        gap: 7px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .localprompt-bulk-edit-section h4,
    .localprompt-bulk-edit-preview h4 {
        margin: 0 0 2px;
        color: #e5edf1;
        font-size: 12px;
    }
    .localprompt-bulk-edit-inline {
        display: flex;
        align-items: center;
        gap: 7px;
    }
    .localprompt-bulk-edit-inline select {
        flex: 1 1 auto;
    }
    .localprompt-bulk-edit-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
        padding-left: 20px;
    }
    .localprompt-bulk-edit-fields[hidden] {
        display: none;
    }
    .localprompt-bulk-edit-fields input,
    .localprompt-bulk-edit-section select {
        min-width: 0;
        box-sizing: border-box;
        padding: 6px 8px;
        color: #e5edf1;
        background: #12181c;
        border: 1px solid #3b4a52;
        border-radius: 4px;
    }
    .localprompt-bulk-edit-preview {
        display: grid;
        gap: 8px;
    }
    .localprompt-bulk-edit-preview-heading {
        display: flex;
        align-items: baseline;
        gap: 10px;
        flex-wrap: wrap;
    }
    .localprompt-bulk-edit-samples {
        display: grid;
        gap: 6px;
        max-height: 220px;
        overflow-y: auto;
    }
    .localprompt-bulk-edit-sample {
        padding: 7px 9px;
        color: #c5d0d7;
        background: rgba(255,255,255,0.035);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 5px;
        font-size: 10px;
        line-height: 1.4;
    }
    .localprompt-bulk-edit-sample > strong {
        display: block;
        margin-bottom: 2px;
        color: #f0f5f7;
    }
    .localprompt-bulk-edit-more,
    .localprompt-bulk-edit-error {
        color: #e5c386;
        font-size: 11px;
    }
    .localprompt-bulk-edit-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }
    .localprompt-bulk-edit-error {
        flex: 1 1 100%;
        min-height: 14px;
    }
    .localprompt-card-insights-overlay {
        z-index: 2147483500;
        isolation: isolate;
    }
    .localprompt-card-insights-overlay > .localprompt-bulk-edit-overlay,
    .localprompt-card-insights-overlay > .localprompt-bulk-move-overlay {
        position: fixed;
        inset: 0;
        z-index: 100;
        overflow: auto;
        background: rgba(0,0,0,0.58);
    }
    .localprompt-card-insights-dialog {
        width: min(980px, calc(100vw - 32px));
        height: min(820px, calc(100vh - 32px));
    }
    .localprompt-card-insights-content {
        min-height: 0;
        overflow: auto !important;
    }
    .localprompt-card-insights-content [data-insights-panel] {
        display: grid;
        gap: 10px;
    }
    .localprompt-card-insights-content [data-insights-panel][hidden] {
        display: none;
    }
    .localprompt-card-insights-overview {
        display: grid;
        grid-template-columns: repeat(3, minmax(120px, 1fr));
        gap: 8px;
    }
    .localprompt-card-insights-overview > div {
        display: grid;
        gap: 3px;
        padding: 14px;
        color: #aebbc4;
        background: rgba(255,255,255,0.035);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        font-size: 11px;
    }
    .localprompt-card-insights-overview strong { color: #f3f8fa; font-size: 20px; }
    .localprompt-card-insights-categories {
        display: grid;
        gap: 7px;
        margin: 0;
        padding: 9px 11px;
        border: 1px solid rgba(88,214,106,0.25);
        border-radius: 8px;
    }
    .localprompt-card-insights-categories legend,
    .localprompt-card-insights-limit { color: #aebbc4; font-size: 11px; }
    .localprompt-card-insights-categories [data-insights-category-options] {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 12px;
    }
    .localprompt-card-insights-categories label { color: #dce5ea; font-size: 11px; }
    .localprompt-card-insights-categories label span { color: #82929e; }
    .localprompt-card-insights-limit { min-height: 14px; margin: 0; }
    .localprompt-stats-pagination {
        display: inline-flex;
        align-items: center;
        gap: 7px;
    }
    .localprompt-stats-pagination[hidden] {
        display: none;
    }
    @container (max-width: 520px) {
        .localprompt-card-insights-overview { grid-template-columns: 1fr; }
    }
    .localprompt-stats-subtitle,
    .localprompt-stats-note,
    .localprompt-stats-footer {
        color: #aebbc4;
        font-size: 11px;
    }
    .localprompt-stats-summary {
        color: #e5edf1;
        font-size: 12px;
        font-weight: 650;
    }
    .localprompt-stats-controls {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-wrap: wrap;
    }
    .localprompt-stats-tabs {
        display: flex;
        gap: 4px;
        flex: 1 1 auto;
    }
    .localprompt-stats-note {
        min-height: 16px;
        margin: 0;
    }
    .localprompt-stats-list {
        display: grid;
        gap: 5px;
        min-height: 0;
        overflow-y: auto;
    }
    .localprompt-stats-row {
        display: grid;
        grid-template-columns: minmax(180px, 1fr) auto;
        gap: 5px 12px;
        padding: 8px 10px;
        color: #dce5ea;
        background: rgba(255,255,255,0.035);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px;
    }
    .localprompt-stats-tag {
        overflow-wrap: anywhere;
    }
    .localprompt-stats-count {
        display: flex;
        align-items: baseline;
        gap: 7px;
        white-space: nowrap;
    }
    .localprompt-stats-count span,
    .localprompt-stats-categories {
        color: #94a4ae;
        font-size: 10px;
    }
    .localprompt-stats-categories {
        grid-column: 1 / -1;
    }
    .localprompt-stats-categories summary {
        cursor: pointer;
    }
    .localprompt-stats-categories div {
        display: flex;
        flex-wrap: wrap;
        gap: 5px 12px;
        padding-top: 6px;
    }
    .localprompt-stats-empty {
        padding: 24px;
        color: #94a4ae;
        text-align: center;
    }
    .localprompt-stats-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
    }
    .localprompt-gallery-item.manage-mode {
        cursor: pointer;
    }
    .localprompt-gallery-item.manage-mode.selected:not(.bulk-selected)::after {
        display: none;
    }
    .localprompt-gallery-item.manage-mode::before {
        content: '';
        position: absolute;
        inset: 0;
        border: 1px solid rgba(255,255,255,0.04);
        pointer-events: none;
    }

    /* Theme 1: Highlight Active (Dim Inactive cards when at least one card is active) */
    .contrast-dim-inactive .localprompt-library-drawer .localprompt-chip-container:has(.localprompt-chip.selected) .localprompt-chip:not(.selected) {
        opacity: 0.325;
        filter: grayscale(70%);
    }
    .contrast-dim-inactive .localprompt-library-drawer .localprompt-chip-container:has(.localprompt-chip-thumb.selected) .localprompt-chip-thumb:not(.selected) {
        opacity: 0.325;
        filter: grayscale(70%);
    }
    .contrast-dim-inactive .localprompt-gallery-grid:has(.localprompt-gallery-item.selected) .localprompt-gallery-item:not(.selected) {
        opacity: 0.65;
        filter: grayscale(35%);
    }
    .contrast-dim-inactive .localprompt-library-drawer .localprompt-chip-container:has(.localprompt-chip.selected) .localprompt-chip:not(.selected):hover {
        opacity: 0.95;
        filter: none;
    }
    .contrast-dim-inactive .localprompt-library-drawer .localprompt-chip-container:has(.localprompt-chip-thumb.selected) .localprompt-chip-thumb:not(.selected):hover {
        opacity: 0.95;
        filter: none;
    }
    .contrast-dim-inactive .localprompt-gallery-grid:has(.localprompt-gallery-item.selected) .localprompt-gallery-item:not(.selected):hover {
        opacity: 0.95;
        filter: none;
        transform: translateY(-2px);
    }

    /* Theme 2: Highlight Active/Hover (Dim by default, highlight on hover or selection) */
    .contrast-dim-by-default .localprompt-library-drawer .localprompt-chip {
        opacity: 0.375;
        filter: grayscale(70%);
    }
    .contrast-dim-by-default .localprompt-library-drawer .localprompt-chip:hover,
    .contrast-dim-by-default .localprompt-library-drawer .localprompt-chip.selected {
        opacity: 1.0;
        filter: none;
    }
    .contrast-dim-by-default .localprompt-library-drawer .localprompt-chip-thumb {
        opacity: 0.375;
        filter: grayscale(70%);
    }
    .contrast-dim-by-default .localprompt-library-drawer .localprompt-chip-thumb:hover,
    .contrast-dim-by-default .localprompt-library-drawer .localprompt-chip-thumb.selected {
        opacity: 1.0;
        filter: none;
    }
    .contrast-dim-by-default .localprompt-gallery-item {
        opacity: 0.75;
        filter: grayscale(35%);
    }
    .contrast-dim-by-default .localprompt-gallery-item:hover,
    .contrast-dim-by-default .localprompt-gallery-item.selected {
        opacity: 1.0;
        filter: none;
    }

    /* Category Context Menu & Drag highlights */

    /* Drag over visual drop indicator */
    .localprompt-pinned-category-pill.drag-over {
        box-shadow: inset 0 0 0 2px rgba(255,255,255,0.28) !important;
    }
    .localprompt-pinned-category-pill.pinned-dragging {
        opacity: 0.45;
    }
    /* Shared glass treatment for the Library workspace and its rails. */
    .localprompt-top-row {
        z-index: 200;
        overflow: visible !important;
    }
    .localprompt-library-shell {
        margin: 0;
        border: 0;
        border-radius: 0;
        overflow: hidden;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }
    .localprompt-library-shell-content {
        padding: 0;
    }
    .localprompt-library-shell .localprompt-workspace-page,
    .localprompt-library-shell .localprompt-modal.localprompt-workspace-page {
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
    }
    .localprompt-library-shell .localprompt-workspace-footer {
        border-top-color: rgba(183, 224, 248, 0.12);
    }
    .localprompt-body-shell {
        z-index: 1;
    }
    .localprompt-top-row,
    .localprompt-bottom-bar {
        border-color: var(--lg-line);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }
    .localprompt-top-row {
        border-bottom-color: var(--lg-line);
    }
    .localprompt-bottom-bar {
        border-top-color: var(--lg-line);
    }
    .localprompt-library-shell,
    .localprompt-workspace-host {
        background: var(--lg-bg);
    }
    .localprompt-library-shell .localprompt-workspace-page,
    .localprompt-library-shell .localprompt-modal.localprompt-workspace-page {
        background: transparent !important;
    }
    .localprompt-library-subnav,
    .localprompt-library-shell .localprompt-workspace-footer {
        background: var(--lg-surface);
        border-color: var(--lg-line);
    }
    .localprompt-pinned-category-pill,
    .localprompt-library-subnav-item {
        border-color: var(--lg-line);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.025);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }
    .localprompt-pinned-category-pill:hover,
    .localprompt-library-subnav-item:hover {
        border-color: var(--lg-line-strong);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
        transform: none;
    }
    .localprompt-pinned-category-pill.active,
    .localprompt-library-subnav-item.active {
        border-color: rgba(85, 221, 125, 0.50);
    }
    .localprompt-workspace-section {
        border-color: var(--lg-line);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.025);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
    }
    .localprompt-chip,
    .localprompt-chip-thumb,
    .localprompt-gallery-item {
        background: var(--lg-surface);
        border-color: var(--lg-line);
        border-radius: 6px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.025);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        transition: border-color 0.14s ease, background-color 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
    }
    .localprompt-chip:hover,
    .localprompt-chip-thumb:hover,
    .localprompt-gallery-item:hover {
        background: var(--lg-raised);
        border-color: var(--lg-line-strong);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), 0 4px 10px rgba(0,0,0,0.16);
        transform: none;
    }
    .localprompt-chip.selected,
    .localprompt-chip-thumb.selected,
    .localprompt-gallery-item.selected {
        background-color: #252b23;
        border-color: rgba(85, 221, 125, 0.68);
        box-shadow: inset 0 0 0 1px rgba(85, 221, 125, 0.14);
    }
    .localprompt-gallery-item.selected::after {
        content: '';
        top: 5px;
        left: 5px;
        width: 15px;
        height: 15px;
        border: 0;
        border-top: 2px solid var(--lg-accent);
        border-left: 2px solid var(--lg-accent);
        border-radius: 0;
        background: transparent;
        box-shadow: none;
    }
    .localprompt-gallery-item .item-info {
        opacity: 1;
        transform: none;
        background: linear-gradient(180deg, transparent, rgba(12, 14, 12, 0.92));
    }
    .localprompt-gallery-item .item-preview,
    .localprompt-chip-thumb {
        background-color: #121310;
    }
    .localprompt-chip-thumb.pinned-managed .managed-state-pill {
        border-radius: 3px;
    }
    .localprompt-chip.pinned-drop-target,
    .localprompt-chip-thumb.pinned-drop-target,
    .localprompt-gallery-item.pinned-drop-target {
        border-color: var(--lg-accent) !important;
        box-shadow: inset 3px 0 0 var(--lg-accent);
    }
    .localprompt-pinned-category-pill {
        min-height: calc(34px * var(--localprompt-bar-scale, 1)) !important;
        padding: 0 calc(11px * var(--localprompt-bar-scale, 1)) !important;
        font-size: calc(11px * var(--localprompt-bar-scale, 1)) !important;
    }
    /* Prompt Builder: a compact category rail and tactile card
       surface make scan, hover, and selected states distinct
       without changing the Card Manager or Active Stack. */
    .localprompt-pinned-category-pill {
        transition: transform 0.14s ease, border-color 0.14s ease, background-color 0.14s ease, box-shadow 0.14s ease;
    }
    .localprompt-library-pane .localprompt-library-drawer.active {
        padding: 12px 8px 0 6px;
        background: linear-gradient(180deg, rgba(255,255,255,0.025), transparent 84px), #171916;
        border-top: 1px solid var(--lg-line-strong);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), inset 0 14px 24px rgba(0,0,0,0.10);
    }
    .localprompt-library-drawer .localprompt-chip-container {
        padding-block: 2px 0;
    }
    .localprompt-library-drawer .localprompt-chip,
    .localprompt-library-drawer .localprompt-chip-thumb {
        border-radius: 7px;
        border-color: var(--lg-line);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), 0 5px 13px rgba(0,0,0,0.18);
        transition: transform 0.14s ease, border-color 0.14s ease, background-color 0.14s ease, box-shadow 0.14s ease, filter 0.14s ease;
    }
    .localprompt-library-drawer .localprompt-chip:hover,
    .localprompt-library-drawer .localprompt-chip-thumb:hover {
        transform: translateY(-2px);
        border-color: rgba(85, 221, 125, 0.54);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.055), 0 9px 18px rgba(0,0,0,0.24);
    }
    .localprompt-library-drawer .localprompt-chip.selected,
    .localprompt-library-drawer .localprompt-chip-thumb.selected {
        background-color: #2b3427;
        border-color: var(--lg-accent);
        box-shadow: inset 0 0 0 1px rgba(85, 221, 125, 0.20), inset 3px 0 0 var(--lg-accent), 0 8px 18px rgba(0,0,0,0.22);
    }
    .localprompt-library-drawer .localprompt-chip:focus-within,
    .localprompt-library-drawer .localprompt-chip-thumb:focus-within {
        outline: 2px solid var(--lg-accent);
        outline-offset: 2px;
    }
    .localprompt-library-drawer .localprompt-chip-thumb .thumb-label {
        padding: 8px 8px 4px;
        color: #f5f8f1;
        font-size: max(10px, var(--localprompt-thumb-label-size));
        font-weight: 650;
        letter-spacing: 0.01em;
        text-align: left;
        background: linear-gradient(180deg, rgba(15, 20, 15, 0) 0%, rgba(15, 20, 15, 0.32) 42%, rgba(15, 20, 15, 0.62) 100%);
    }
    .localprompt-library-drawer .localprompt-chip .localprompt-chip-label {
        color: #eef2e9;
        font-weight: 620;
        letter-spacing: 0.01em;
    }
    .localprompt-library-drawer .localprompt-chip.pinned-drop-target,
    .localprompt-library-drawer .localprompt-chip-thumb.pinned-drop-target {
        border-color: var(--lg-accent) !important;
        box-shadow: inset 3px 0 0 var(--lg-accent), 0 0 0 1px rgba(85, 221, 125, 0.26);
    }
    .localprompt-container :is(button, input, select, textarea, [role="button"], [tabindex="0"]):focus-visible {
        outline: 2px solid var(--lg-accent-line);
        outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
        .localprompt-container *,
        .localprompt-container *::before,
        .localprompt-container *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }
    }

    .localprompt-container-wrapper {
        container-type: inline-size;
        color-scheme: dark;
        overflow: hidden;
    }

    .localprompt-container {
        width: 100%;
        height: 100% !important;
    }

    .localprompt-container button,
    .localprompt-container input,
    .localprompt-container select,
    .localprompt-container textarea {
        font: inherit;
    }

    .localprompt-top-row {
        min-height: 50px;
        padding: 6px 10px;
        box-sizing: border-box;
        background: rgba(6, 13, 20, 0.48);
        border-bottom: 1px solid var(--lg-line);
        box-shadow: 0 10px 28px rgba(0,0,0,0.12);
    }

    .localprompt-pinned-category-pill {
        min-height: 34px;
        padding: 0 11px;
        box-sizing: border-box;
        color: #d7e0e7;
        background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)), #0b151f;
        border: 1px solid rgba(156, 188, 211, 0.17);
        border-left: 2px solid var(--category-color, rgba(156,188,211,0.28));
        border-radius: 6px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.025), 0 5px 13px rgba(0,0,0,0.14);
        font-size: 11px;
        font-weight: 520;
        letter-spacing: 0.005em;
    }

    .localprompt-pinned-category-pill:hover,
    .localprompt-pinned-category-pill.active {
        color: #f4f8fb;
        background: linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.02)), #0d1924;
        border-color: rgba(177, 210, 231, 0.28);
        box-shadow: 0 0 18px var(--category-color-glow, rgba(85,221,125,0.09)), inset 0 1px 0 rgba(255,255,255,0.035);
    }

    .localprompt-body-shell {
        background: linear-gradient(180deg, rgba(255,255,255,0.008), rgba(0,0,0,0.04));
    }

    .localprompt-library-pane,
    .localprompt-workspace-host,
    .localprompt-library-drawer {
        min-height: 0;
    }

    .localprompt-library-drawer {
        /* Keep the outer gutter compact; the right padding is the gap
           between the Prompt Builder content and the right-side
           scrollbar. */
        padding: 14px 4px 18px 10px;
    }

    .localprompt-library-drawer .localprompt-chip-container {
        gap: 12px;
        /* Compact Prompt Builder chips remain a wrapping flex list. */
        align-content: start;
    }
    .localprompt-library-drawer .localprompt-prompt-builder-grid {
        display: grid;
        width: 100%;
        gap: 12px;
        /* The saved thumbnail size is the column minimum. Fractional
           tracks distribute the remaining drawer width equally. */
        grid-template-columns: repeat(auto-fill, minmax(min(var(--localprompt-thumb-width), 100%), 1fr));
        align-content: start;
        direction: ltr;
    }
    .localprompt-library-drawer .localprompt-prompt-builder-grid .localprompt-chip-thumb {
        width: 100%;
        height: auto;
        aspect-ratio: 100 / 146;
        box-sizing: border-box;
    }
    .localprompt-gallery-grid {
        --localprompt-card-manager-card-width: 150px;
        --localprompt-card-manager-fullscreen-card-width: 210px;
        gap: 12px;
        grid-template-columns: repeat(auto-fill, minmax(min(var(--localprompt-card-manager-card-width), 100%), 1fr));
        align-content: start;
    }

    .localprompt-chip-thumb,
    .localprompt-gallery-item {
        border-radius: 8px;
        background: var(--lg-surface);
        border: 1px solid var(--lg-line);
        box-shadow: 0 9px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.02);
        overflow: hidden;
        transition: transform 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out, filter 180ms ease-out;
    }

    .localprompt-chip-thumb:hover,
    .localprompt-gallery-item:hover {
        transform: translateY(-2px);
        border-color: rgba(109, 224, 145, 0.34);
        box-shadow: 0 14px 32px rgba(0,0,0,0.25), 0 0 20px rgba(63, 205, 108, 0.075);
    }

    .localprompt-chip-thumb.selected,
    .localprompt-gallery-item.selected,
    .localprompt-gallery-item.bulk-selected {
        border-color: rgba(75, 225, 119, 0.78) !important;
        box-shadow: 0 0 0 1px rgba(73, 224, 118, 0.17), 0 0 23px rgba(61, 215, 106, 0.14), 0 14px 30px rgba(0,0,0,0.24) !important;
    }

    .localprompt-chip-thumb img,
    .localprompt-chip-thumb video,
    .localprompt-gallery-item img,
    .localprompt-gallery-item video {
        transition: transform 0.24s ease, filter 0.24s ease;
    }

    .localprompt-chip-thumb:hover img,
    .localprompt-chip-thumb:hover video,
    .localprompt-gallery-item:hover img,
    .localprompt-gallery-item:hover video {
        transform: scale(1.025);
    }

    .localprompt-bottom-bar {
        min-height: 50px;
        padding: 7px 10px;
        gap: 7px;
        box-sizing: border-box;
        background: rgba(7, 15, 23, 0.94);
        border-top: 1px solid var(--lg-line);
        box-shadow: 0 -14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.018);
        backdrop-filter: blur(18px) saturate(1.08);
    }

    .localprompt-library-shell,
    .localprompt-workspace-page,
    .localprompt-workspace-panel {
        background: transparent;
    }

    .localprompt-library-shell-content > .localprompt-workspace-panel,
    .localprompt-library-shell .localprompt-workspace-page,
    .localprompt-library-shell .localprompt-modal.localprompt-workspace-page {
        width: 100% !important;
        max-width: none !important;
        height: 100%;
        border: 0;
        border-radius: 0;
        box-shadow: none;
    }

    .localprompt-library-subnav {
        display: flex;
        align-items: stretch;
        gap: 0;
        min-height: 36px;
        padding: 0 14px;
        background: rgba(7, 15, 23, 0.38);
        border-top: 1px solid rgba(255,255,255,0.012);
        border-bottom: 1px solid var(--lg-line);
        overflow-x: auto;
        scrollbar-width: none;
    }

    .localprompt-library-subnav::-webkit-scrollbar { display: none; }

    .localprompt-library-subnav-item {
        position: relative;
        min-width: 74px;
        min-height: 36px;
        padding: 0 10px;
        color: #aab5c0;
        background: transparent;
        border: 0;
        border-radius: 0;
        font-size: 11px;
        font-weight: 520;
        cursor: pointer;
        transition: color 0.17s ease, background 0.17s ease;
    }

    .localprompt-library-subnav-item::after {
        content: "";
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: 0;
        height: 2px;
        border-radius: 999px 999px 0 0;
        background: var(--lg-accent);
        box-shadow: 0 0 12px rgba(85,221,125,0.55);
        opacity: 0;
        transform: scaleX(0.5);
        transition: opacity 0.17s ease, transform 0.17s ease;
    }

    .localprompt-library-subnav-item:hover {
        color: #dce7ed;
        background: rgba(255,255,255,0.018);
    }

    .localprompt-library-subnav-item.active {
        color: #7bea99;
        background: linear-gradient(180deg, transparent, rgba(65, 209, 111, 0.055));
        border: 0;
        box-shadow: none;
    }

    .localprompt-library-subnav-item.active::after {
        opacity: 1;
        transform: scaleX(1);
    }

    .localprompt-library-shell .localprompt-workspace-body {
        padding: 22px 24px 28px;
        background: transparent;
        scrollbar-color: rgba(132, 151, 169, 0.4) transparent;
    }

    .localprompt-workspace-section {
        padding: 0;
        background: transparent;
        border: 0;
        border-radius: 0;
    }

    .localprompt-library-shell .localprompt-workspace-footer {
        min-height: 56px;
        padding: 8px 18px;
        box-sizing: border-box;
        background: rgba(7, 15, 23, 0.86);
        border-top: 1px solid var(--lg-line);
        box-shadow: 0 -12px 28px rgba(0,0,0,0.13);
    }

    .localprompt-bulk-context {
        display: flex;
        align-items: center;
        gap: 5px;
        flex: 1 1 260px;
        min-width: 0;
    }

    .localprompt-bulk-summary {
        flex: 0 0 auto;
        min-height: 28px;
        box-sizing: border-box;
        padding: 6px 7px;
        color: #e6f1eb;
        background: rgba(109, 197, 132, 0.10);
        border: 1px solid rgba(109, 197, 132, 0.2);
        border-radius: 5px;
        font-size: 10px;
        font-weight: 650;
        line-height: 1.35;
        white-space: nowrap;
    }

    .localprompt-bulk-action-group {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        min-width: 0;
    }

    .localprompt-bulk-action-group + .localprompt-bulk-action-group {
        padding-left: 5px;
        border-left: 1px solid rgba(143, 177, 200, 0.14);
    }

    .localprompt-bulk-status:empty {
        display: none;
    }

    .localprompt-bulk-status:not(:empty) {
        flex: 0 1 auto;
        min-height: 0;
        padding: 6px 7px;
        color: #a9dfb5;
        background: rgba(109, 197, 132, 0.07);
        border-radius: 5px;
        font-size: 10px;
        line-height: 1.35;
        white-space: nowrap;
    }

    .localprompt-browse-pagination-pill {
        min-height: 28px;
        padding: 3px 6px;
        background: rgba(8, 17, 25, 0.92);
        border-color: rgba(143, 177, 200, 0.15);
        box-shadow: 0 12px 28px rgba(0,0,0,0.28);
    }

    .localprompt-browse-page.localprompt-workspace-page,
    .localprompt-library-shell .localprompt-browse-page.localprompt-workspace-page {
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
    }

    .localprompt-library-shell .localprompt-browse-page .localprompt-workspace-body {
        /* The right padding is the gap between the Card Manager content
           and the right-side scrollbar, not a normal outer inset. */
        padding: 8px 4px 0 10px;
    }

    .localprompt-library-shell:has(.localprompt-browse-page) .localprompt-library-shell-content {
        padding: 0;
    }

    .localprompt-browse-page .localprompt-gallery-grid {
        padding-bottom: 8px;
    }

    .localprompt-library-shell .localprompt-browse-footer.localprompt-workspace-footer,
    .localprompt-browse-page .localprompt-browse-footer {
        min-height: 0;
        padding: 0 0 6px;
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
    }

    /* Prompt Builder category overflow. Existing category colors stay
       as full-surface cues instead of narrow rails. */

    @container (max-width: 620px) {
        .localprompt-top-row { padding-inline: 8px; }
        .localprompt-pinned-category-pill { min-height: 32px; padding-inline: 9px; font-size: 10px; }
        .localprompt-library-subnav { padding: 0 6px; }
        .localprompt-library-subnav-item { min-width: 78px; padding-inline: 10px; font-size: 11px; }
        .localprompt-library-shell .localprompt-workspace-body { padding: 15px 12px 22px; }
        .localprompt-bulk-context {
            flex: 1 0 100%;
            flex-wrap: wrap;
        }
        .localprompt-bulk-action-group {
            flex-wrap: wrap;
        }
        .localprompt-bulk-action-group + .localprompt-bulk-action-group {
            padding-left: 0;
            border-left: 0;
        }
        .localprompt-bottom-bar { padding-inline: 8px; gap: 6px; overflow-x: auto; }
    }

    /* Library pages: form layout on top of the shared chrome controls */
    .localprompt-workspace-section h4 { margin: 0; color: var(--lg-text); font-size: 13px; font-weight: 600; }
    .localprompt-from-output-details { display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 16px; align-items: start; }
    .localprompt-from-output-preview { width: 116px; height: 116px; overflow: hidden; border: 1px solid var(--lg-line-strong); border-radius: 8px; background: var(--lg-bg); }
    .localprompt-from-output-preview img { display: block; width: 100%; height: 100%; object-fit: cover; }
    @container (max-width: 520px) {
        .localprompt-from-output-details { grid-template-columns: 1fr; }
        .localprompt-from-output-preview { width: 100%; height: 160px; }
    }
    .localprompt-presets-list { display: grid; gap: 6px; }
    .localprompt-preset-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto auto;
        align-items: center;
        gap: 4px;
        padding: 8px 8px 8px 12px;
        border: 1px solid var(--lg-line);
        border-radius: 8px;
        background: var(--lg-bg);
    }
    .localprompt-preset-name { overflow: hidden; color: var(--lg-text); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
    /* Card Manager toolbar on the shared chrome controls */
    .localprompt-browse-toolbar {
        position: sticky;
        top: 0;
        z-index: 40;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
        padding: 6px 8px;
        background: var(--lg-surface);
        border: 1px solid var(--lg-line);
        border-radius: 8px;
        transition: transform 0.16s ease, opacity 0.16s ease;
    }
    .localprompt-browse-toolbar.toolbar-hidden { transform: translateY(-8px); opacity: 0; pointer-events: none; }
    .localprompt-browse-toolbar-row { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
    .localprompt-browse-search { position: relative; display: flex; flex: 0 1 220px; min-width: 140px; }
    .localprompt-browse-search > svg { position: absolute; top: 50%; left: 8px; width: 14px; height: 14px; transform: translateY(-50%); fill: none; stroke: var(--lg-muted); stroke-width: 1.8; stroke-linecap: round; pointer-events: none; }
    .localprompt-browse-search .lg-input { flex: 1 1 auto; padding-left: 28px; }
    .localprompt-browse-select { flex: 0 1 190px; min-width: 120px; }
    .localprompt-browse-sort-select { flex: 0 1 130px; min-width: 110px; }
    .localprompt-browse-toolbar .lg-text-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    .localprompt-browse-category-actions { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; padding-left: 6px; border-left: 1px solid var(--lg-line); }
    .localprompt-bulk-toolbar {
        position: sticky;
        top: 50px;
        z-index: 39;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin: 0 0 8px;
        padding: 6px 8px;
        background: var(--lg-raised);
        border: 1px solid var(--lg-line-strong);
        border-radius: 8px;
    }
    .localprompt-bulk-toolbar[hidden] { display: none; }
    .localprompt-meta-action:hover { color: var(--lg-danger); background: rgba(239, 98, 98, 0.12); }
    .localprompt-wc-modal { width: 460px; }
    .localprompt-wc-list { display: grid; max-height: 320px; overflow-y: auto; padding: 4px; border: 1px solid var(--lg-line); border-radius: 8px; background: var(--lg-bg); }
    .localprompt-wc-row { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 6px; border-radius: 6px; }
    .localprompt-wc-row:hover { background: var(--lg-hover); }
    .localprompt-wc-name { flex: 1 1 auto; min-width: 0; }
    .localprompt-wc-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .localprompt-wc-update { color: var(--lg-muted); font-size: 11px; }
    .localprompt-wc-weight { display: inline-flex; align-items: center; gap: 2px; }
    .localprompt-wc-weight[hidden] { display: none; }
    .localprompt-wc-weight .lg-icon-btn { width: 24px; height: 24px; min-width: 24px; }
    .wc-weight { min-width: 26px; color: var(--lg-muted); font-size: 11px; font-variant-numeric: tabular-nums; text-align: center; }
    .lg-root textarea.localprompt-edit-prompt-text { min-height: 240px; font-family: "Cascadia Mono", Consolas, monospace; }
    .localprompt-edit-prompt-status { display: inline-flex; align-items: center; gap: 6px; }
    .localprompt-edit-prompt-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--lg-faint); }
    .localprompt-edit-prompt-dot.saved { background: var(--lg-accent); }
    .localprompt-container.workspace-focus .localprompt-top-row { display: none; }
    .localprompt-library-subnav .localprompt-library-shell-close { align-self: center; flex: 0 0 auto; margin-left: auto; }
    /* The paging pill floats over the grid; lift it clear of the edge, and ride
       above the auto-hide bar while that bar is slid in. */
    .localprompt-browse-page .localprompt-browse-footer { bottom: 8px; transition: transform 0.18s ease; }
    .lg-root.auto-hide-toolbars:has(.lg-bottom.toolbar-revealed) .localprompt-browse-footer { transform: translateY(-44px); }
`;
