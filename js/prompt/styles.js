export function getPromptStyles(uniqueId) {
    return `
                <style>
                    .localprompt-container-wrapper {
                        width: 100%;
                        height: 100%;
                    }
                    .localprompt-container {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        background: #1a1a1a;
                        border-radius: 8px;
                        overflow: hidden;
                        position: relative;
                    }
                    .localprompt-btn {
                        padding: 5px 10px;
                        background: #3a3a3a;
                        color: #ddd;
                        border: 1px solid #555;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 11px;
                        white-space: nowrap;
                        transition: background 0.15s;
                    }
                    .localprompt-btn:hover { background: #4a4a4a; }
                    .localprompt-btn.active { background: #4a7c4a; border-color: #5a9c5a; }
                    .localprompt-clear-btn:hover { background: #6a3a3a !important; border-color: #8a4a4a !important; }
                    .localprompt-icon-btn {
                        width: 32px;
                        height: 28px;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        flex: 0 0 auto;
                    }
                    .localprompt-icon-btn svg {
                        width: 15px;
                        height: 15px;
                        display: block;
                        stroke: currentColor;
                    }
                    .localprompt-toolbar {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        width: 100%;
                        min-width: 0;
                    }
                    .localprompt-pinned-categories {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 1 1 auto;
                        min-width: 0;
                        overflow: visible;
                    }
                    .localprompt-pinned-category-strip {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                        overflow: hidden;
                        flex: 1 1 auto;
                    }
                    .localprompt-pinned-category-pill {
                        max-width: 128px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        border-radius: 999px;
                        padding: 5px 10px;
                        font-size: 11px;
                        line-height: 1;
                        background: #2a2a2a;
                        color: #ddd;
                        border: 1px solid #444;
                        cursor: pointer;
                        flex: 0 1 auto;
                    }
                    .localprompt-pinned-category-pill:hover,
                    .localprompt-pinned-category-pill.active {
                        color: #fff;
                        filter: brightness(1.1);
                    }

                    .localprompt-category-grid-button svg {
                        width: 15px;
                        height: 15px;
                        display: block;
                        stroke: currentColor;
                    }
                    .localprompt-more-category-group {
                        position: relative;
                        flex: 0 0 auto;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .localprompt-more-category-group.align-right {
                        margin-left: auto;
                    }
                    .localprompt-more-category-group.align-left {
                        margin-left: 0;
                    }
                    .localprompt-more-category-group.hidden {
                        display: none;
                    }
                    .localprompt-toolbar-shortcuts {
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        margin-left: auto;
                        flex: 0 0 auto;
                    }
                    .localprompt-toolbar-group {
                        position: relative;
                        flex: 0 0 auto;
                    }
                    .localprompt-toolbar-button {
                        height: 28px;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 0 10px;
                        border-radius: 8px;
                        background: #292929;
                        border: 1px solid #444;
                        color: #ddd;
                        font-size: 11px;
                        cursor: pointer;
                    }
                    .localprompt-toolbar-button:hover,
                    .localprompt-toolbar-button.active {
                        background: #344a34;
                        border-color: #5a9c5a;
                        color: #fff;
                    }
                    .localprompt-toolbar-button.localprompt-icon-btn {
                        padding: 0;
                        width: 32px;
                    }
                    .localprompt-toolbar-button.localprompt-icon-btn.has-enabled {
                        border-color: rgba(90, 196, 120, 0.45);
                        box-shadow:
                            0 9px 22px rgba(0,0,0,0.28),
                            inset 0 0 0 1px rgba(90, 196, 120, 0.15);
                    }
                    .localprompt-toolbar-button .chevron {
                        color: #888;
                        font-size: 9px;
                        line-height: 1;
                    }
                    .localprompt-dropdown-panel {
                        position: absolute;
                        top: calc(100% + 6px);
                        left: 0;
                        display: none;
                        z-index: 2000;
                        min-width: 220px;
                        max-width: min(520px, 92vw);
                        box-sizing: border-box;
                        background:
                            radial-gradient(circle at 5% 8%, rgba(146, 238, 255, 0.10), transparent 40%),
                            radial-gradient(circle at 95% 2%, rgba(190, 132, 255, 0.08), transparent 40%),
                            linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025) 45%, rgba(255,255,255,0.05)),
                            rgba(16, 20, 26, 0.72);
                        backdrop-filter: blur(20px) saturate(1.2);
                        -webkit-backdrop-filter: blur(20px) saturate(1.2);
                        border: 1px solid rgba(174, 226, 255, 0.28);
                        border-radius: 14px;
                        box-shadow:
                            0 16px 48px rgba(0,0,0,0.45),
                            0 0 0 1px rgba(255,255,255,0.06) inset,
                            0 0 24px rgba(109, 220, 255, 0.10),
                            0 0 32px rgba(177, 112, 255, 0.06);
                        padding: 14px 16px;
                    }
                    .localprompt-dropdown-panel.open {
                        display: block;
                    }
                    #${uniqueId}-categories-panel {
                        width: min(600px, calc(100vw - 24px));
                        max-width: min(600px, calc(100vw - 24px));
                        right: 0;
                        left: auto;
                        padding: 14px 16px;
                        position: absolute;
                    }
                    .localprompt-more-category-group.align-left #${uniqueId}-categories-panel {
                        left: 0;
                        right: auto;
                    }
                    .localprompt-more-category-group.align-right #${uniqueId}-categories-panel {
                        left: auto;
                        right: 0;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-bar-container {
                        display: block;
                        padding-top: 0;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-bar-container::before {
                        display: none;
                        content: none;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-tab-strip {
                        display: block;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-tabs-scroll {
                        display: flex;
                        flex-wrap: wrap;
                        overflow: visible;
                        gap: 9px 10px;
                        padding: 0 34px 0 0;
                        max-height: 230px;
                        overflow-y: auto;
                        align-items: center;
                        align-content: flex-start;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-add-tab {
                        display: none;
                    }
                    .localprompt-category-sort-row {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin: 0 34px 12px 0;
                        padding: 7px 9px;
                        background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015));
                        border: 1px solid rgba(255,255,255,0.1);
                        border-radius: 9px;
                    }
                    .localprompt-category-sort-row label {
                        color: rgba(225, 237, 245, 0.7);
                        font-size: 11px;
                        font-weight: 600;
                        white-space: nowrap;
                    }
                    .localprompt-sort-select {
                        min-height: 28px;
                        min-width: 136px;
                        padding: 5px 8px;
                        background: rgba(255, 255, 255, 0.04);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 7px;
                        color: #ddd;
                        font-size: 11px;
                        transition: border-color 0.15s;
                    }
                    .localprompt-sort-select:focus {
                        border-color: rgba(174, 226, 255, 0.3);
                        outline: none;
                    }
                    .localprompt-sort-select option {
                        background: #1a1e24;
                        color: #ddd;
                    }
                    .localprompt-category-palette-item {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        min-width: 0;
                        max-width: 180px;
                    }
                    .localprompt-category-palette-item .localprompt-library-tab {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .localprompt-dropdown-note {
                        color: rgba(225, 237, 245, 0.55);
                        font-size: 10px;
                        line-height: 1.45;
                        padding: 4px 2px 10px;
                    }
                    .localprompt-category-list {
                        display: none;
                    }
                    .localprompt-dropdown-divider {
                        height: 1px;
                        background: rgba(255,255,255,0.1);
                        margin: 10px 0;
                    }
                    #${uniqueId}-categories-panel .localprompt-dropdown-divider {
                        display: none;
                    }
                    .localprompt-category-popover-footer {
                        position: absolute;
                        top: 12px;
                        right: 14px;
                        z-index: 1;
                    }
                    .localprompt-category-manage-icon {
                        width: 26px;
                        height: 26px;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(255, 255, 255, 0.04);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        border-radius: 6px;
                        color: rgba(180, 200, 230, 0.6);
                        cursor: pointer;
                        transition: background 0.15s, color 0.15s, border-color 0.15s;
                    }
                    .localprompt-category-manage-icon:hover {
                        color: rgba(200, 220, 255, 0.9);
                        background: rgba(255, 255, 255, 0.1);
                        border-color: rgba(255, 255, 255, 0.16);
                    }
                    .localprompt-meta-panel {
                        left: auto;
                        right: 0;
                        width: min(300px, calc(100vw - 24px));
                        max-width: calc(100vw - 24px);
                        box-sizing: border-box;
                        padding: 10px 12px;
                    }
                    .localprompt-more-category-group.align-left .localprompt-meta-panel {
                        left: 0;
                        right: auto;
                    }
                    .localprompt-more-category-group.align-right .localprompt-meta-panel {
                        left: auto;
                        right: 0;
                    }
                    .localprompt-meta-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 10px;
                        padding-bottom: 4px;
                        border-bottom: 1px solid rgba(255,255,255,0.08);
                        margin-bottom: 6px;
                    }
                    .localprompt-meta-title {
                        font-size: 10px;
                        font-weight: 700;
                        color: #fff;
                        opacity: 0.95;
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
                        background: rgba(10, 12, 16, 0.5);
                        color: #e0e0e0;
                        border: 1px solid rgba(255, 255, 255, 0.10);
                        border-radius: 5px;
                        font-size: 11px;
                        padding: 5px 8px;
                        box-sizing: border-box;
                        transition: border-color 0.15s, background 0.15s;
                        resize: none;
                        min-height: 24px;
                        max-height: 110px;
                        line-height: 1.35;
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
                    .localprompt-meta-action {
                        width: 28px;
                        height: 24px;
                        padding: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(255, 80, 80, 0.12);
                        border: 1px solid rgba(255, 80, 80, 0.2) !important;
                        color: rgba(255, 120, 120, 0.7);
                        border-radius: 5px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: background 0.15s, border-color 0.15s, color 0.15s;
                    }
                    .localprompt-meta-action:hover {
                        background: rgba(255, 80, 80, 0.22);
                        border-color: rgba(255, 80, 80, 0.35) !important;
                        color: #ff9090;
                    }
                    @media (max-width: 520px) {
                        .localprompt-meta-panel {
                            width: min(280px, calc(100vw - 24px));
                        }
                        .localprompt-meta-header {
                            display: block;
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
                    .localprompt-meta-add-btn {
                        width: 100%;
                        padding: 8px 10px;
                        background: rgba(46, 110, 62, 0.22) !important;
                        border: 1px solid rgba(68, 170, 136, 0.28) !important;
                        color: rgba(130, 220, 150, 0.8);
                        border-radius: 8px;
                        font-size: 11px;
                        cursor: pointer;
                        transition: background 0.15s, border-color 0.15s, color 0.15s;
                    }
                    .localprompt-meta-add-btn:hover {
                        background: rgba(46, 110, 62, 0.38) !important;
                        border-color: rgba(68, 170, 136, 0.45) !important;
                        color: #8f8;
                    }
                    .localprompt-section {
                        padding: 8px 10px;
                        border-bottom: 1px solid #333;
                        overflow: hidden;
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
                        background: #1e1e1e;
                        padding: 8px 10px;
                        border-bottom: 1px solid #333;
                        overflow: visible;
                    }
                    .localprompt-top-controls {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 6px;
                        flex: 0 0 auto;
                    }
                    .localprompt-library-bar-container {
                        position: relative;
                        padding-top: 10px;
                    }
                    .localprompt-library-bar-container::before {
                        content: 'Categories';
                        position: absolute;
                        top: -2px;
                        left: 0;
                        font-size: 9px;
                        font-weight: 700;
                        color: #929292;
                        text-transform: uppercase;
                        letter-spacing: 0.12em;
                        pointer-events: none;
                    }
                    .localprompt-utility-bar {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        flex: 0 0 auto;
                        align-self: flex-start;
                        padding-top: 0;
                        position: static;
                    }
                    .localprompt-utility-buttons {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        padding: 1px;
                        background: transparent;
                        border: 0;
                        border-radius: 0;
                        box-shadow: none;
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
                        width: min(clamp(380px, var(--localprompt-active-sidebar-width, 420px), 480px), calc(100% - 24px));
                        min-width: min(330px, calc(100% - 24px));
                        max-width: min(540px, calc(100% - 24px));
                        max-height: calc(100% - 24px);
                        box-sizing: border-box;
                        background:
                            radial-gradient(circle at 2% 6%, rgba(146, 238, 255, 0.18), transparent 34%),
                            radial-gradient(circle at 98% 0%, rgba(190, 132, 255, 0.16), transparent 34%),
                            linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.035) 42%, rgba(255,255,255,0.07)),
                            rgba(16, 20, 26, 0.54);
                        backdrop-filter: blur(24px) saturate(1.24);
                        -webkit-backdrop-filter: blur(24px) saturate(1.24);
                        border: 1px solid rgba(174, 226, 255, 0.44);
                        border-radius: 14px;
                        box-shadow:
                            0 24px 60px rgba(0,0,0,0.44),
                            0 0 0 1px rgba(255,255,255,0.075) inset,
                            0 0 34px rgba(109, 220, 255, 0.18),
                            0 0 44px rgba(177, 112, 255, 0.12);
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
                    .localprompt-active-sidebar-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        flex: 0 0 auto;
                        padding: 14px 16px 11px;
                        border-bottom: 1px solid rgba(255,255,255,0.13);
                        background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.015));
                    }
                    .localprompt-active-sidebar-header .localprompt-clear-btn {
                        background: rgba(80, 48, 64, 0.38) !important;
                        border-color: rgba(255, 196, 224, 0.28) !important;
                        color: #f6edf2;
                        border-radius: 9px;
                        box-shadow:
                            inset 0 0 0 1px rgba(255,255,255,0.055),
                            0 6px 16px rgba(0,0,0,0.20);
                    }
                    .localprompt-active-sidebar-header .localprompt-clear-btn:hover {
                        background: rgba(116, 56, 76, 0.48) !important;
                        border-color: rgba(255, 206, 229, 0.46) !important;
                    }
                    .localprompt-active-sidebar-title {
                        display: flex;
                        align-items: baseline;
                        gap: 8px;
                        min-width: 0;
                    }
                    .localprompt-active-sidebar-title span:first-child {
                        font-size: 11px;
                        font-weight: 700;
                        color: #f5fbff;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        text-shadow: 0 0 12px rgba(180, 235, 255, 0.22);
                    }
                    .localprompt-active-sidebar-title span:last-child {
                        font-size: 10px;
                        color: rgba(225, 237, 245, 0.68);
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
                    }
                    .localprompt-active-sidebar .managed-thumb-media.localprompt-active-preview-target {
                        cursor: pointer;
                        transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
                    }
                    .localprompt-active-sidebar .managed-thumb-media.localprompt-active-preview-target:hover,
                    .localprompt-active-sidebar .managed-thumb-media.localprompt-active-preview-target:focus-visible {
                        transform: scale(1.045);
                        box-shadow: 0 0 22px rgba(135, 231, 255, 0.22), 0 8px 18px rgba(0,0,0,0.28);
                        outline: none;
                    }
                    .localprompt-library-pane {
                        display: flex;
                        flex-direction: column;
                        flex: 1;
                        min-width: 0;
                        min-height: 0;
                        position: relative;
                    }
                    .localprompt-active-side-tab,
                    .localprompt-category-grid-button,
                    .localprompt-favorite-toggle-btn,
                    .localprompt-toolbar-button.localprompt-icon-btn,
                    .localprompt-bottom-bar .localprompt-icon-btn {
                        position: relative;
                        z-index: 55;
                        width: 32px;
                        height: 28px;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        box-sizing: border-box;
                        flex: 0 0 auto;
                        border: 1px solid rgba(210, 235, 255, 0.22);
                        border-radius: 8px;
                        background:
                            linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.045)),
                            rgba(24, 28, 32, 0.52);
                        color: #e8ecef;
                        box-shadow:
                            0 9px 22px rgba(0,0,0,0.28),
                            inset 0 0 0 1px rgba(255,255,255,0.07);
                        backdrop-filter: blur(10px) saturate(1.18);
                        -webkit-backdrop-filter: blur(10px) saturate(1.18);
                        cursor: pointer;
                        opacity: 0.96;
                        transition: opacity 0.14s ease, border-color 0.14s ease, background 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease;
                    }
                    .localprompt-active-side-tab:hover,
                    .localprompt-active-side-tab.active,
                    .localprompt-category-grid-button:hover,
                    .localprompt-category-grid-button.active,
                    .localprompt-favorite-toggle-btn:hover,
                    .localprompt-favorite-toggle-btn.active,
                    .localprompt-toolbar-button.localprompt-icon-btn:hover,
                    .localprompt-toolbar-button.localprompt-icon-btn.active,
                    .localprompt-bottom-bar .localprompt-icon-btn:hover,
                    .localprompt-bottom-bar .localprompt-icon-btn.active {
                        border-color: rgba(178, 233, 255, 0.58);
                        background:
                            linear-gradient(135deg, rgba(255,255,255,0.26), rgba(255,255,255,0.07)),
                            rgba(31, 38, 44, 0.62);
                        box-shadow:
                            0 10px 26px rgba(0,0,0,0.32),
                            0 0 24px rgba(125, 226, 255, 0.2),
                            inset 0 0 0 1px rgba(255,255,255,0.1);
                        color: #fff;
                        opacity: 1;
                    }
                    .localprompt-favorite-toggle-btn:hover,
                    .localprompt-favorite-toggle-btn.active {
                        border-color: rgba(255, 215, 0, 0.58);
                        background:
                            linear-gradient(135deg, rgba(255,255,255,0.26), rgba(255,255,255,0.07)),
                            rgba(45, 40, 20, 0.62);
                        box-shadow:
                            0 10px 26px rgba(0,0,0,0.32),
                            0 0 24px rgba(255, 215, 0, 0.22),
                            inset 0 0 0 1px rgba(255,255,255,0.1);
                        color: #ffd700;
                    }
                    .localprompt-active-side-tab svg,
                    .localprompt-favorite-toggle-btn svg,
                    .localprompt-category-grid-button svg,
                    .localprompt-toolbar-button.localprompt-icon-btn svg {
                        width: 15px;
                        height: 15px;
                        display: block;
                        stroke: currentColor;
                    }
                    .localprompt-active-side-tab.active:not(.empty) {
                        opacity: 1;
                        pointer-events: auto;
                        transform: none;
                    }
                    .localprompt-active-side-tab.empty {
                        opacity: 0.52;
                        color: #9da4aa;
                    }
                    .localprompt-active-side-tab-count {
                        min-width: 0;
                        height: auto;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        box-sizing: border-box;
                        border: 0;
                        border-radius: 0;
                        background: transparent;
                        color: #dfe4e8;
                        font-size: 11px;
                        font-weight: 700;
                        line-height: 1;
                        text-shadow: 0 1px 6px rgba(255,255,255,0.18);
                    }
                    .localprompt-active-side-tab.empty .localprompt-active-side-tab-count {
                        color: #a3a9ae;
                    }
                    .localprompt-workspace-host {
                        display: none;
                        flex: 1;
                        min-height: 0;
                        overflow: hidden;
                        background: #151515;
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
                        background: radial-gradient(circle at 20% 0%, rgba(69, 125, 85, 0.08), transparent 34%), #111820;
                    }
                    .localprompt-library-subnav {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        gap: 5px;
                        padding: 0 14px 8px;
                    }
                    .localprompt-library-subnav-item {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 24px;
                        padding: 4px 9px;
                        border: 1px solid rgba(255,255,255,0.09);
                        border-radius: 999px;
                        background: rgba(255,255,255,0.035);
                        color: #c7ccd2;
                        font-size: 11px;
                        line-height: 1;
                        cursor: pointer;
                    }
                    .localprompt-library-subnav-item:hover {
                        background: rgba(255,255,255,0.075);
                        color: #fff;
                    }
                    .localprompt-library-subnav-item.active {
                        background: rgba(75, 181, 99, 0.18);
                        border-color: rgba(94, 210, 118, 0.32);
                        color: #7df08f;
                        box-shadow: inset 0 0 0 1px rgba(92, 219, 111, 0.22);
                    }
                    .localprompt-library-shell-content {
                        display: flex;
                        flex-direction: column;
                        min-width: 0;
                        min-height: 0;
                        padding: 0 8px 8px;
                        overflow: hidden;
                    }
                    .localprompt-library-shell-content > .localprompt-workspace-panel {
                        padding: 0;
                    }
                    .localprompt-library-shell .localprompt-workspace-page,
                    .localprompt-library-shell .localprompt-modal.localprompt-workspace-page {
                        background: transparent !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                    .localprompt-library-shell .localprompt-workspace-header {
                        border-bottom: 0;
                    }
                    .localprompt-workspace-back {
                        display: none !important;
                    }
                    .localprompt-library-shell .localprompt-workspace-body {
                        padding-top: 8px;
                    }
                    .localprompt-library-shell .localprompt-workspace-footer {
                        background: transparent;
                        border-top: 1px solid rgba(255,255,255,0.06);
                    }
                    .localprompt-settings-page.localprompt-workspace-page {
                        background: transparent !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                    .localprompt-settings-page .localprompt-workspace-header {
                        border-bottom: 0;
                    }
                    .localprompt-settings-page .localprompt-workspace-title p {
                        display: none;
                    }
                    .localprompt-settings-page .localprompt-workspace-body {
                        padding-top: 8px;
                    }
                    .localprompt-settings-page .localprompt-workspace-footer {
                        background: transparent;
                        border-top: 1px solid rgba(255,255,255,0.06);
                    }
                    .localprompt-from-output-page.localprompt-workspace-page {
                        background: transparent !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                    .localprompt-from-output-page .localprompt-workspace-header {
                        border-bottom: 0;
                        padding: 8px 14px 6px;
                    }
                    .localprompt-from-output-page .localprompt-workspace-title p {
                        display: none;
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
                    .localprompt-from-output-page .localprompt-from-output-details {
                        grid-template-columns: 116px minmax(0, 1fr) !important;
                        gap: 16px !important;
                        align-items: stretch !important;
                        padding-bottom: 18px;
                        border-bottom: 1px solid rgba(255,255,255,0.07);
                    }
                    .localprompt-from-output-page .localprompt-from-output-preview-wrap,
                    .localprompt-from-output-page .localprompt-from-output-preview {
                        width: 116px !important;
                    }
                    .localprompt-from-output-page .localprompt-from-output-preview {
                        height: 116px !important;
                        border: 1px solid rgba(255,255,255,0.12) !important;
                        border-radius: 7px !important;
                        background: rgba(255,255,255,0.04) !important;
                        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
                    }
                    .localprompt-from-output-page label {
                        color: #dfe5e2 !important;
                        font-size: 11px !important;
                    }
                    .localprompt-from-output-page input,
                    .localprompt-from-output-page select,
                    .localprompt-from-output-page textarea {
                        background: rgba(0,0,0,0.18) !important;
                        border: 1px solid rgba(255,255,255,0.12) !important;
                        border-radius: 6px !important;
                        color: #f2f4f3 !important;
                    }
                    .localprompt-from-output-page select option {
                        background: #11171d;
                        color: #f2f4f3;
                    }
                    .localprompt-from-output-page select option:disabled {
                        color: #808892;
                    }
                    .localprompt-from-output-page input:focus,
                    .localprompt-from-output-page select:focus,
                    .localprompt-from-output-page textarea:focus {
                        border-color: rgba(93, 207, 105, 0.55) !important;
                        box-shadow: 0 0 0 1px rgba(93, 207, 105, 0.18);
                        outline: none;
                    }
                    .localprompt-from-output-page textarea {
                        min-height: 150px;
                    }
                    .localprompt-from-output-page .localprompt-from-output-source {
                        color: #9ba5ad !important;
                    }
                    .localprompt-from-output-page #from-last-output-cancel,
                    .localprompt-from-output-page #from-last-output-save {
                        min-height: 28px;
                        padding: 5px 14px !important;
                        border-radius: 6px !important;
                    }
                    .localprompt-from-output-page #from-last-output-cancel {
                        background: rgba(255,255,255,0.05) !important;
                        border-color: rgba(255,255,255,0.14) !important;
                    }
                    .localprompt-from-output-page #from-last-output-save {
                        background: rgba(70, 134, 73, 0.9) !important;
                        border-color: rgba(105, 190, 111, 0.7) !important;
                    }
                    @container (max-width: 520px) {
                        .localprompt-from-output-page .localprompt-from-output-details {
                            grid-template-columns: 1fr !important;
                        }
                        .localprompt-from-output-page .localprompt-from-output-preview-wrap,
                        .localprompt-from-output-page .localprompt-from-output-preview {
                            width: 100% !important;
                        }
                        .localprompt-from-output-page .localprompt-from-output-preview {
                            height: 160px !important;
                        }
                    }
                    .localprompt-workspace-panel {
                        display: flex;
                        flex-direction: column;
                        flex: 1;
                        min-height: 0;
                        padding: 10px;
                        overflow: hidden;
                    }
                    .localprompt-workspace-page,
                    .localprompt-workspace-card {
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
                        background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015));
                        border: 1px solid rgba(255,255,255,0.09);
                        color: #ddd;
                        overflow: hidden;
                    }
                    .localprompt-workspace-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        padding: 10px 14px 6px;
                        background: transparent;
                        border-bottom: 1px solid rgba(255,255,255,0.07);
                    }
                    .localprompt-workspace-title {
                        min-width: 0;
                    }
                    .localprompt-workspace-title h3 {
                        margin: 0;
                        color: #f3f5f4;
                        font-size: 17px;
                        line-height: 1.2;
                    }
                    .localprompt-workspace-title p {
                        margin: 4px 0 0;
                        color: #a8afb8;
                        font-size: 11px;
                        line-height: 1.4;
                    }
                    .localprompt-library-shell .localprompt-workspace-title p {
                        display: none;
                    }
                    .localprompt-workspace-back {
                        display: none !important;
                        min-height: 26px;
                        padding: 4px 9px;
                        border-radius: 999px;
                        background: rgba(255,255,255,0.04);
                        border: 1px solid rgba(255,255,255,0.13);
                        color: #e5e7ea;
                        cursor: pointer;
                        font-size: 11px;
                        line-height: 1;
                        flex: 0 0 auto;
                    }
                    .localprompt-workspace-back:hover {
                        background: rgba(255,255,255,0.08);
                        color: #fff;
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
                        padding: 14px;
                        margin-bottom: 14px;
                        background: rgba(255,255,255,0.025);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 8px;
                    }
                    .localprompt-workspace-section h4 {
                        margin: 0 0 10px;
                        color: #e8e8e8;
                        font-size: 12px;
                    }
                    .localprompt-presets-list {
                        max-height: 300px;
                        overflow-y: auto;
                        background: rgba(8, 13, 19, 0.42);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 9px;
                        padding: 6px;
                    }
                    .localprompt-preset-row {
                        display: grid;
                        grid-template-columns: 28px minmax(0, 1fr) auto auto auto;
                        align-items: center;
                        gap: 8px;
                        padding: 8px;
                        background: rgba(255,255,255,0.025);
                        border-bottom: 1px solid rgba(255,255,255,0.06);
                    }
                    .localprompt-preset-row:last-child {
                        border-bottom: 0;
                    }
                    .localprompt-preset-icon {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 22px;
                        height: 22px;
                        border-radius: 6px;
                        background: rgba(155, 98, 255, 0.15);
                        border: 1px solid rgba(155, 98, 255, 0.28);
                        color: #b58cff;
                        font-size: 11px;
                        font-weight: 700;
                    }
                    .localprompt-preset-load {
                        background: rgba(72, 174, 94, 0.13) !important;
                        border-color: rgba(89, 210, 115, 0.3) !important;
                        color: #83e896 !important;
                    }
                    .localprompt-preset-edit {
                        background: rgba(79, 147, 255, 0.13) !important;
                        border-color: rgba(79, 147, 255, 0.32) !important;
                        color: #7fb0ff !important;
                    }
                    .localprompt-preset-delete {
                        background: rgba(220, 68, 68, 0.12) !important;
                        border-color: rgba(220, 68, 68, 0.34) !important;
                        color: #ff7777 !important;
                    }
                    .localprompt-workspace-card .localprompt-modal-content {
                        min-height: 0;
                    }
                    .localprompt-library-landing {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
                        gap: 14px;
                    }
                    .localprompt-library-choice {
                        position: relative;
                        min-height: 152px;
                        padding: 22px;
                        text-align: left;
                        border-radius: 9px;
                        background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
                        border: 1px solid rgba(255,255,255,0.1);
                        color: #ddd;
                        cursor: pointer;
                        overflow: hidden;
                    }
                    .localprompt-library-choice:hover {
                        background: linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035));
                        border-color: rgba(255,255,255,0.2);
                        transform: translateY(-1px);
                    }
                    .localprompt-library-choice::after {
                        content: '>';
                        position: absolute;
                        right: 18px;
                        top: 50%;
                        color: #f4f7f5;
                        font-size: 22px;
                        transform: translateY(-50%);
                    }
                    .localprompt-library-choice::before {
                        content: '';
                        position: absolute;
                        inset: auto 0 0;
                        height: 3px;
                        background: var(--library-accent, #58d66a);
                        opacity: 0.9;
                    }
                    .localprompt-library-choice-icon {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 42px;
                        height: 42px;
                        margin-bottom: 24px;
                        border-radius: 9px;
                        background: color-mix(in srgb, var(--library-accent, #58d66a) 18%, transparent);
                        border: 1px solid color-mix(in srgb, var(--library-accent, #58d66a) 48%, transparent);
                        color: var(--library-accent, #58d66a);
                        font-size: 21px;
                    }
                    .localprompt-library-choice strong {
                        display: block;
                        margin-bottom: 8px;
                        color: #f0f0f0;
                        font-size: 18px;
                    }
                    .localprompt-library-choice span {
                        display: block;
                        max-width: 210px;
                        color: #a9b0b8;
                        font-size: 13px;
                        line-height: 1.45;
                    }
                    .localprompt-library-bar-container {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 1;
                        min-width: 0;
                    }
                    .localprompt-library-bar-container.wrap-mode {
                        align-items: flex-start;
                    }
                    .localprompt-library-tab-strip {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 1;
                        min-width: 0;
                    }
                    .localprompt-library-tab-strip.wrap-mode {
                        align-items: flex-start;
                    }
                    .localprompt-library-tabs-scroll {
                        display: flex;
                        gap: 6px;
                        overflow-x: auto;
                        flex: 1;
                        padding-bottom: 2px;
                        min-width: 0;
                    }
                    .localprompt-library-tabs-scroll.wrap-mode {
                        flex-wrap: wrap;
                        overflow-x: visible;
                        padding-bottom: 0;
                    }
                    .localprompt-library-tabs-scroll.wrap-mode::-webkit-scrollbar {
                        display: none;
                    }
                    .localprompt-library-tabs-scroll::-webkit-scrollbar { height: 4px; }
                    .localprompt-library-tabs-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
                    
                    .localprompt-library-tab {
                        padding: 4px 10px;
                        background: #2a2a2a;
                        color: #aaa;
                        border-radius: 12px;
                        font-size: 11px;
                        cursor: pointer;
                        white-space: nowrap;
                        user-select: none;
                        transition: all 0.15s ease;
                        border: 1px solid #333;
                    }
                    .localprompt-library-tab:hover { background: #333; color: #ddd; }
                    .localprompt-library-tab.active { background: #3a5a3a; color: #fff; border-color: #5a9c5a; box-shadow: 0 0 8px rgba(90, 156, 90, 0.4); }
                    .localprompt-utility-tab {
                        background: rgba(255,255,255,0.05);
                        color: #d7d7d7;
                        border-color: rgba(255,255,255,0.12);
                        border-radius: 999px;
                        font-size: 15px;
                        font-weight: 700;
                        letter-spacing: 0;
                        padding: 0;
                        width: 28px;
                        height: 28px;
                        min-height: 28px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .localprompt-utility-tab:hover {
                        background: rgba(255,255,255,0.12);
                        color: #fff;
                        border-color: rgba(255,255,255,0.2);
                    }
                    .localprompt-utility-tab.active {
                        background: linear-gradient(180deg, rgba(62, 84, 62, 0.78) 0%, rgba(44, 66, 44, 0.82) 100%);
                        color: #fff;
                        border-color: #5a9c5a;
                        box-shadow: 0 0 8px rgba(90, 156, 90, 0.2);
                    }
                    
                    .localprompt-library-add-tab {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 28px;
                        height: 28px;
                        background: #242424;
                        color: #b0b0b0;
                        border: 1px solid #3a3a3a;
                        border-radius: 999px;
                        font-size: 18px;
                        line-height: 1;
                        cursor: pointer;
                        padding: 0;
                        margin-left: auto;
                        flex: 0 0 auto;
                        transition: color 0.15s, background 0.15s, border-color 0.15s;
                    }
                    .localprompt-library-add-tab:hover { color: #fff; background: #313131; border-color: #4e4e4e; }
                    
                    .localprompt-library-drawer {
                        background: #141414;
                        border-bottom: 0;
                        padding: 8px 2px 8px 8px;
                        display: none;
                        flex: 0 1 auto;
                        min-height: 0;
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
                        padding-right: 0;
                        flex: 0 1 auto;
                        min-height: 0;
                        overflow-y: auto;
                        align-content: flex-start;
                        scrollbar-width: thin;
                        scrollbar-color: #4a4a4a transparent;
                    }
                    .localprompt-section-header {
                        font-size: 10px;
                        font-weight: bold;
                        color: #888;
                        margin-bottom: 6px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
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
                        container-type: inline-size;
                    }
                    .localprompt-thumbnail-size-control {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                        width: 100%;
                        transition: opacity 0.15s, filter 0.15s;
                    }
                    .localprompt-thumbnail-size-control input[type="range"] {
                        width: 100%;
                        min-width: 90px;
                        accent-color: #8ab4f8;
                        cursor: ew-resize;
                    }
                    .localprompt-thumbnail-size-control.disabled {
                        opacity: 0.42;
                        filter: grayscale(0.9);
                        cursor: not-allowed;
                    }
                    .localprompt-thumbnail-size-control.disabled input[type="range"] {
                        cursor: not-allowed;
                        pointer-events: none;
                        accent-color: #666;
                    }
                    .localprompt-thumbnail-size-control span {
                        color: #888;
                        font-size: 10px;
                        line-height: 1;
                    }
                    .localprompt-thumbnail-size-control .size-label {
                        min-width: 30px;
                        color: #aaa;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .localprompt-chip {
                        width: auto;
                        height: auto;
                        padding: 4px 10px;
                        background: #2d2d2d;
                        border: 1px solid #444;
                        border-radius: 12px;
                        font-size: 11px;
                        color: #ddd;
                        cursor: pointer;
                        transition: all 0.15s;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        white-space: nowrap;
                    }
                    .localprompt-chip:hover { background: #3a3a3a; border-color: #666; }
                    .localprompt-chip.selected { background: #1a2a3a; border: 2px solid #4a9eff; box-shadow: 0 0 8px rgba(74, 158, 255, 0.4); }
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
                        text-align: center;
                        font-size: 11px;
                        color: #ddd;
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
                    .localprompt-active-row-thumb img {
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
                        min-width: 34px;
                        height: 28px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0 2px;
                        border-radius: 0;
                        background: transparent;
                        border: 0;
                        color: #e4e8eb;
                        font-size: 14px;
                        font-weight: 700;
                    }
                    .localprompt-chip.pinned-draggable { cursor: grab; }
                    .localprompt-chip.pinned-draggable:active { cursor: grabbing; }
                    .localprompt-chip.pinned-dragging {
                        opacity: 0.45;
                        border-style: dashed;
                    }
                    .localprompt-chip.pinned-drop-target {
                        border-color: #88c0ff;
                        box-shadow: 0 0 0 2px rgba(136, 192, 255, 0.35);
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
                    .localprompt-chip .usage-count {
                        font-size: 9px;
                        color: #888;
                        background: #222;
                        padding: 1px 4px;
                        border-radius: 8px;
                        margin-left: 4px;
                    }
                    .localprompt-chip-thumb {
                        width: var(--localprompt-thumb-width);
                        height: var(--localprompt-thumb-height);
                        border-radius: 6px;
                        background: #151515;
                        border: 1px solid #444;
                        cursor: pointer;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        transition: all 0.15s;
                    }
                    .localprompt-chip-thumb:hover { border-color: #666; }
                    .localprompt-chip-thumb.selected { border-width: 2px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.02); }
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
                    .localprompt-chip-thumb.pinned-managed::before {
                        content: '';
                        position: absolute;
                        top: -50%;
                        left: -50%;
                        width: 200%;
                        height: 200%;
                        background: conic-gradient(from 0deg, transparent 0%, var(--localprompt-zip-color-1, #ffffff) 3%, transparent 6%, transparent 100%);
                        animation: border-zip 4s linear infinite;
                        z-index: 1;
                        filter: blur(2.5px);
                    }
                    .localprompt-chip-thumb.pinned-managed::after {
                        content: '';
                        position: absolute;
                        top: -50%;
                        left: -50%;
                        width: 200%;
                        height: 200%;
                        background: conic-gradient(from 0deg, transparent 0%, var(--localprompt-zip-color-2, #ffffff) 3%, transparent 6%, transparent 100%);
                        animation: border-zip-reverse 4s linear infinite;
                        z-index: 1;
                        filter: blur(2.5px);
                    }

                    /* Active border tracer themes */
                    .localprompt-container-wrapper.zip-theme-cyberpunk {
                        --localprompt-zip-color-1: #00f0ff;
                        --localprompt-zip-color-2: #ff007f;
                    }
                    .localprompt-container-wrapper.zip-theme-sunset {
                        --localprompt-zip-color-1: #007cff;
                        --localprompt-zip-color-2: #ff7b00;
                    }
                    .localprompt-container-wrapper.zip-theme-aurora {
                        --localprompt-zip-color-1: #00ff87;
                        --localprompt-zip-color-2: #9b51e0;
                    }
                    .localprompt-container-wrapper.zip-theme-ice {
                        --localprompt-zip-color-1: #00d2ff;
                        --localprompt-zip-color-2: #ff758c;
                    }
                    .localprompt-container-wrapper.zip-theme-fire-ice {
                        --localprompt-zip-color-1: #00f5ff;
                        --localprompt-zip-color-2: #ff3333;
                    }
                    .localprompt-container-wrapper.zip-theme-golden-mint {
                        --localprompt-zip-color-1: #00ffaa;
                        --localprompt-zip-color-2: #ffdd00;
                    }

                    /* Rainbow Cycle animations */
                    @keyframes rainbow-cycle-1 {
                        0% { filter: blur(2.5px) hue-rotate(0deg); }
                        100% { filter: blur(2.5px) hue-rotate(360deg); }
                    }
                    @keyframes rainbow-cycle-2 {
                        0% { filter: blur(2.5px) hue-rotate(180deg); }
                        100% { filter: blur(2.5px) hue-rotate(540deg); }
                    }

                    .localprompt-container-wrapper.zip-theme-rainbow-sync {
                        --localprompt-zip-color-1: #ff0055;
                        --localprompt-zip-color-2: #ff0055;
                    }
                    .localprompt-container-wrapper.zip-theme-rainbow-sync .localprompt-chip-thumb.pinned-managed::before {
                        animation: border-zip 4s linear infinite, rainbow-cycle-1 6s linear infinite;
                    }
                    .localprompt-container-wrapper.zip-theme-rainbow-sync .localprompt-chip-thumb.pinned-managed::after {
                        animation: border-zip-reverse 4s linear infinite, rainbow-cycle-1 6s linear infinite;
                    }

                    .localprompt-container-wrapper.zip-theme-rainbow-split {
                        --localprompt-zip-color-1: #ff0055;
                        --localprompt-zip-color-2: #ff0055;
                    }
                    .localprompt-container-wrapper.zip-theme-rainbow-split .localprompt-chip-thumb.pinned-managed::before {
                        animation: border-zip 4s linear infinite, rainbow-cycle-1 6s linear infinite;
                    }
                    .localprompt-container-wrapper.zip-theme-rainbow-split .localprompt-chip-thumb.pinned-managed::after {
                        animation: border-zip-reverse 4s linear infinite, rainbow-cycle-2 6s linear infinite;
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-thumb-media {
                        position: absolute;
                        inset: 2px;
                        border-radius: 4px;
                        overflow: hidden;
                        z-index: 2;
                    }
                    .localprompt-chip-thumb.pinned-managed .thumb-label {
                        bottom: 2px;
                        left: 2px;
                        right: 2px;
                        border-bottom-left-radius: 4px;
                        border-bottom-right-radius: 4px;
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
                        left: 6px;
                        right: 6px;
                        bottom: 32px;
                        height: auto;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 4px 5px;
                        background: rgba(18, 22, 28, 0.65);
                        backdrop-filter: blur(12px) saturate(1.2);
                        -webkit-backdrop-filter: blur(12px) saturate(1.2);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        border-radius: 10px;
                        overflow: visible;
                        z-index: 4;
                        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-card-controls {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 4px;
                        width: 100%;
                        background: transparent;
                        border: none;
                        border-radius: 0;
                        overflow: visible;
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-weight-val {
                        min-width: 24px;
                        height: 20px;
                        text-align: center;
                        font-size: 10px;
                        font-weight: 600;
                        color: #f0f0f0;
                        padding: 0 4px;
                        background: rgba(0, 0, 0, 0.45);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        border-radius: 10px;
                        backdrop-filter: none;
                        box-shadow: none;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-state-pill {
                        min-width: 28px;
                        height: 20px;
                        padding: 0 6px;
                        border-radius: 6px;
                        border: none;
                        font-size: 8px;
                        font-weight: 700;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: background 0.15s ease, color 0.15s ease;
                        flex-shrink: 0;
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-state-pill.on {
                        background: #00c882;
                        color: #fff;
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-state-pill.off {
                        background: rgba(255, 255, 255, 0.08);
                        color: rgba(255, 255, 255, 0.7);
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
                    /* display rule is freed up now since selected badge uses :not(.pinned-managed) */
                    .localprompt-info-btn,
                    .localprompt-favorite-star,
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
                    .localprompt-info-btn svg,
                    .localprompt-favorite-star svg,
                    .localprompt-gallery-item .favorite-btn svg,
                    .chip-pin-btn svg {
                        width: 14px;
                        height: 14px;
                        stroke: currentColor;
                    }
                    .localprompt-info-btn:hover,
                    .localprompt-favorite-star:hover,
                    .localprompt-gallery-item .favorite-btn:hover,
                    .chip-pin-btn:hover {
                        background: rgba(40, 40, 40, 0.9);
                        color: #fff;
                        border-color: rgba(255, 255, 255, 0.4);
                        transform: scale(1.05);
                    }
                    .localprompt-info-btn {
                        left: 6px;
                    }
                    .localprompt-favorite-star,
                    .localprompt-gallery-item .favorite-btn,
                    .chip-pin-btn {
                        right: 6px;
                    }
                    .localprompt-favorite-star.favorited,
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
                    .localprompt-chip-thumb.pinned-drop-target {
                        border-color: #88c0ff;
                        box-shadow: 0 0 0 2px rgba(136, 192, 255, 0.45);
                    }
                    .localprompt-chip-thumb.selected:not(.pinned-managed)::after {
                        content: '+';
                        position: absolute;
                        top: 4px;
                        left: 4px;
                        width: 16px;
                        height: 16px;
                        background: #4a9eff;
                        color: #fff;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        font-weight: bold;
                        z-index: 10;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    }
                    .localprompt-chip-thumb.role-colored {
                        border-color: var(--role-color, #4c4c4c);
                    }
                    .localprompt-chip-thumb.role-colored.pinned-managed {
                        border-color: color-mix(in srgb, var(--role-color, #ffffff) 40%, rgba(255, 255, 255, 0.08));
                        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                    }
                    .localprompt-chip-thumb.role-colored.pinned-managed::before {
                        background: conic-gradient(
                            from 0deg,
                            transparent 0%,
                            var(--localprompt-zip-color-1, color-mix(in srgb, var(--role-color, #ffffff) 80%, #ffffff)) 3%,
                            transparent 6%,
                            transparent 100%
                        );
                    }
                    .localprompt-chip-thumb.role-colored.pinned-managed::after {
                        background: conic-gradient(
                            from 0deg,
                            transparent 0%,
                            var(--localprompt-zip-color-2, color-mix(in srgb, var(--role-color, #ffffff) 80%, #ffffff)) 3%,
                            transparent 6%,
                            transparent 100%
                        );
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
                    .localprompt-role-badge {
                        position: absolute;
                        top: 6px;
                        right: 6px;
                        z-index: 5;
                        max-width: calc(100% - 52px);
                        padding: 2px 8px;
                        border-radius: 999px;
                        background: color-mix(in srgb, var(--role-color, #444) 90%, rgba(17,17,17,0.92));
                        color: #fff;
                        font-size: 9px;
                        font-weight: 700;
                        line-height: 1.4;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
                    }
                    .localprompt-chip-thumb img { width: 100%; height: 100%; object-fit: cover; }
                    .localprompt-chip-thumb .thumb-label {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: rgba(0,0,0,0.75);
                        font-size: var(--localprompt-thumb-label-size);
                        color: #ddd;
                        padding: 3px 4px;
                        text-align: center;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        z-index: 3;
                    }
                    .localprompt-inline-btn {
                        height: 26px;
                        border-radius: 0;
                        border: none;
                        border-left: 1px solid rgba(255,255,255,0.08);
                        background: rgba(255, 255, 255, 0.04);
                        color: #f0f0f0;
                        font-size: 14px;
                        padding: 0 10px;
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
                    .localprompt-section.pinned-unified-hidden {
                        display: none;
                    }
                    
                    .localprompt-selected-list {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                        align-content: flex-start;
                        padding-bottom: 4px;
                        padding-right: 4px;
                    }
                    .localprompt-selected-item {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 4px 6px;
                        background: #252525;
                        border: 1px solid #444;
                        border-radius: 16px;
                        cursor: grab;
                        user-select: none;
                        transition: all 0.2s;
                        width: auto;
                    }
                    .localprompt-selected-item:active { cursor: grabbing; }
                    .localprompt-selected-item.dragging { opacity: 0.5; background: #333; border-style: dashed; }
                    .localprompt-selected-item .item-name {
                        flex: 0 1 auto;
                        font-size: 11px;
                        color: #ddd;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 200px;
                    }
                    .localprompt-selected-item .item-controls {
                        display: flex;
                        align-items: center;
                        gap: 3px;
                    }
                    .localprompt-selected-item .weight-btn {
                        width: 24px;
                        height: 24px;
                        padding: 0;
                        background: #333;
                        border: 1px solid #555;
                        border-radius: 4px;
                        color: #ddd;
                        cursor: pointer;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.15s;
                    }
                    .localprompt-selected-item .weight-btn:hover { background: #4a4a4a; border-color: #777; }
                    .localprompt-selected-item .weight-btn:active { background: #555; }
                    .localprompt-selected-item .weight-val {
                        font-size: 11px;
                        color: #ccc;
                        min-width: 26px;
                        text-align: center;
                    }
                    .localprompt-selected-item .remove-btn {
                        width: 24px;
                        height: 24px;
                        background: #5a3030;
                        border: 1px solid #7a4040;
                        border-radius: 4px;
                        color: #ddd;
                        cursor: pointer;
                        font-size: 11px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-left: 2px;
                        transition: background 0.15s;
                    }
                    .localprompt-selected-item .remove-btn:hover { background: #8a3a3a; border-color: #aa4a4a; }
                    .localprompt-selected-item .toggle-btn {
                        padding: 4px 8px;
                        font-size: 10px;
                        font-weight: bold;
                        border-radius: 12px;
                        border: none;
                        cursor: pointer;
                        transition: opacity 0.15s;
                    }
                    .localprompt-selected-item .toggle-btn:hover { opacity: 0.8; }
                    .localprompt-selected-item .toggle-btn.on { background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; }
                    .localprompt-selected-item .toggle-btn.off { background: #7c4a4a; color: #fff; border: 1px solid #9c5a5a; }
                    
                    .localprompt-bottom-bar {
                        position: relative;
                        z-index: 120;
                        isolation: isolate;
                        padding: 8px 10px;
                        background: #252525;
                        border-top: 1px solid #333;
                        display: flex;
                        align-items: center;
                        gap: 6px;
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
                    .localprompt-container-wrapper.auto-hide-toolbars .localprompt-bottom-bar:not(.toolbar-revealed):not(.toolbar-pinned) {
                        height: 0;
                        max-height: 0;
                        min-height: 0;
                        padding: 0;
                        padding-top: 0;
                        padding-bottom: 0;
                        margin-top: 0;
                        border: 0;
                        opacity: 1;
                        overflow: visible;
                        transform: none;
                        background: transparent !important;
                        border-top-color: transparent;
                    }
                    .localprompt-container-wrapper.auto-hide-toolbars .localprompt-bottom-bar:not(.toolbar-revealed):not(.toolbar-pinned) > * {
                        opacity: 0;
                        transform: translateY(8px);
                        pointer-events: none;
                    }
                    .localprompt-container-wrapper.auto-hide-toolbars .localprompt-bottom-bar:not(.toolbar-revealed):not(.toolbar-pinned)::before {
                        content: '';
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        height: 7px;
                        background: transparent;
                        border: 0;
                        pointer-events: auto;
                    }
                    .localprompt-container-wrapper.auto-hide-toolbars .localprompt-bottom-bar:not(.toolbar-revealed):not(.toolbar-pinned):hover {
                        background: transparent;
                    }
                    .localprompt-bottom-spacer {
                        flex: 1 1 auto;
                        min-width: 10px;
                    }
                    .localprompt-action-bar {
                        margin-bottom: 0;
                        padding-bottom: 4px;
                    }
                    .localprompt-config-bar {
                        display: flex;
                        flex: 1 1 auto;
                        flex-wrap: wrap;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                        max-width: 100%;
                        margin: 0;
                        border-top: none;
                        padding: 0;
                        background: transparent;
                    }
                    .localprompt-config-bar.collapsed {
                        display: none;
                    }
                    .localprompt-display-options-anchor {
                        position: relative;
                        display: inline-flex;
                        flex: 0 0 auto;
                    }
                    .localprompt-display-options-popover {
                        position: absolute;
                        left: 0;
                        bottom: calc(100% + 8px);
                        z-index: 2600;
                        isolation: isolate;
                        width: 204px;
                        max-width: calc(100vw - 24px);
                        box-sizing: border-box;
                    }
                    .localprompt-wildcard-row {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 0 1 auto;
                        min-width: 0;
                        margin-left: 0 !important;
                    }
                    .localprompt-display-options-panel {
                        display: grid;
                        grid-template-columns: 1fr;
                        gap: 7px;
                        padding: 7px;
                        background: rgb(27, 31, 36);
                        border: 1px solid #3a4148;
                        border-radius: 8px;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.28);
                    }
                    .localprompt-size-row {
                        display: grid;
                        grid-template-columns: repeat(2, minmax(148px, 1fr));
                        gap: 8px;
                        flex: 0 1 360px;
                        min-width: min(100%, 300px);
                        max-width: 430px;
                        padding: 8px;
                        background: #1b1f24;
                        border: 1px solid #3a4148;
                        border-radius: 8px;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.28);
                    }
                    .localprompt-display-section {
                        display: grid;
                        gap: 6px;
                        min-width: 0;
                    }
                    .localprompt-display-section-title {
                        color: #9ea9b2;
                        font-size: 9px;
                        font-weight: 800;
                        letter-spacing: 0.08em;
                    }
                    .localprompt-display-mode-select {
                        width: 100%;
                        min-height: 26px;
                        padding: 4px 7px;
                        background: #111820;
                        border: 1px solid #3b4652;
                        border-radius: 6px;
                        color: #e8ecef;
                        font-size: 11px;
                    }
                    .localprompt-display-mode-select option {
                        background: #111820;
                        color: #e8ecef;
                    }
                    @container (max-width: 430px) {
                        .localprompt-display-options-panel,
                        .localprompt-size-row {
                            grid-template-columns: 1fr;
                            flex-basis: 100%;
                        }
                    }
                    .localprompt-bottom-bar .seed-group {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-left: 0 !important;
                    }
                    .localprompt-bottom-bar .comfyui-seed-style {
                        display: flex;
                        align-items: center;
                        background: #252525;
                        border: 1px solid #454545;
                        border-radius: 12px;
                        height: 22px;
                        font-family: Arial, sans-serif;
                        overflow: hidden;
                    }
                    .localprompt-bottom-bar .seed-btn {
                        background: transparent;
                        border: none;
                        color: #aaa;
                        font-size: 10px;
                        cursor: pointer;
                        padding: 0 8px;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background-color 0.15s, color 0.15s;
                    }
                    .localprompt-bottom-bar .seed-btn:hover {
                        background: #333;
                        color: #fff;
                    }
                    .localprompt-bottom-bar .seed-label {
                        color: #aaa;
                        font-size: 11px;
                        padding: 0 2px 0 6px;
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
                    .localprompt-wildcard-rng-control {
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        color: #aeb6bd;
                        font-size: 11px;
                        white-space: nowrap;
                    }
                    .localprompt-wildcard-rng-control select {
                        min-height: 24px;
                        padding: 4px 7px;
                        background: #1a1a1a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        color: #ddd;
                        font-size: 11px;
                    }
                    .localprompt-wildcard-rng-control select option {
                        background: #11171d;
                        color: #e8ecef;
                    }
                    .localprompt-wildcard-shuffle-btn {
                        width: 28px;
                        height: 26px;
                        min-height: 26px;
                        padding: 0;
                        align-items: center;
                        justify-content: center;
                        border-radius: 6px;
                    }
                    .localprompt-wildcard-shuffle-btn svg {
                        width: 15px;
                        height: 15px;
                        stroke: currentColor;
                    }
                    .localprompt-item.manual-order-draggable,
                    .localprompt-chip.manual-order-draggable,
                    .localprompt-chip-thumb.manual-order-draggable {
                        cursor: grab;
                        touch-action: none;
                        user-select: none;
                    }
                    .localprompt-item.manual-order-draggable:active,
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
                        background: #2a2a2a;
                        border: 1px solid #555;
                        border-radius: 8px;
                        width: 700px;
                        max-width: 90vw;
                        max-height: 80vh;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    }
                    .localprompt-modal-header {
                        padding: 12px 16px;
                        background: #333;
                        border-bottom: 1px solid #444;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-radius: 8px 8px 0 0;
                    }
                    .localprompt-modal-header h3 { margin: 0; font-size: 14px; color: #ddd; }
                    .localprompt-modal-close {
                        background: none;
                        border: none;
                        color: #888;
                        font-size: 18px;
                        cursor: pointer;
                    }
                    .localprompt-modal-close:hover { color: #ddd; }
                    .localprompt-modal-content {
                        flex: 1;
                        overflow-y: auto;
                        padding: 16px;
                    }
                    .localprompt-edit-prompt-overlay {
                        background: rgba(0, 0, 0, 0.78) !important;
                        padding: 24px;
                        box-sizing: border-box;
                    }
                    .localprompt-edit-prompt-dialog {
                        width: min(88vw, 900px);
                        max-height: min(88vh, 820px);
                        background: linear-gradient(145deg, rgba(33, 38, 43, 0.97), rgba(18, 22, 26, 0.98));
                        border: 1px solid rgba(162, 178, 190, 0.42);
                        border-radius: 12px;
                        box-shadow: 0 18px 60px rgba(0,0,0,0.62);
                        color: #e8edf0;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    .localprompt-edit-prompt-header {
                        display: flex;
                        align-items: flex-start;
                        justify-content: space-between;
                        gap: 16px;
                        padding: 28px 32px 14px;
                    }
                    .localprompt-edit-prompt-title {
                        display: flex;
                        align-items: flex-start;
                        gap: 14px;
                    }
                    .localprompt-edit-prompt-title h3 {
                        margin: 0;
                        color: #f3f6f8;
                        font-size: 26px;
                        line-height: 1.1;
                    }
                    .localprompt-edit-prompt-title p {
                        margin: 10px 0 0;
                        color: #b7bdc4;
                        font-size: 14px;
                    }
                    .localprompt-edit-prompt-icon {
                        width: 24px;
                        height: 24px;
                        margin-top: 3px;
                        color: #65c66f;
                    }
                    .localprompt-edit-prompt-icon svg {
                        width: 100%;
                        height: 100%;
                        stroke: currentColor;
                        stroke-width: 1.9;
                        stroke-linecap: round;
                        stroke-linejoin: round;
                    }
                    .localprompt-edit-prompt-close {
                        border: 0;
                        background: transparent;
                        color: #aeb5bb;
                        font-size: 34px;
                        line-height: 1;
                        cursor: pointer;
                        padding: 4px 6px;
                    }
                    .localprompt-edit-prompt-close:hover {
                        color: #f1f4f6;
                    }
                    .localprompt-edit-prompt-body {
                        flex: 1;
                        min-height: 0;
                        padding: 0 32px 22px;
                        display: flex;
                        flex-direction: column;
                        gap: 18px;
                    }
                    .localprompt-edit-prompt-field {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        margin: 0;
                        min-height: 0;
                    }
                    .localprompt-edit-prompt-field > span {
                        color: #d9dde2;
                        font-size: 13px;
                        font-weight: 700;
                    }
                    .localprompt-edit-prompt-field input,
                    .localprompt-edit-prompt-field textarea {
                        width: 100%;
                        box-sizing: border-box;
                        background: rgba(10, 13, 16, 0.58);
                        color: #f3f5f7;
                        border: 1px solid rgba(171, 185, 197, 0.34);
                        border-radius: 8px;
                        outline: none;
                    }
                    .localprompt-edit-prompt-field input {
                        height: 42px;
                        padding: 0 14px;
                        font-size: 15px;
                    }
                    .localprompt-edit-prompt-field input:focus,
                    .localprompt-edit-prompt-field textarea:focus {
                        border-color: rgba(110, 183, 255, 0.72);
                        box-shadow: 0 0 0 2px rgba(70, 140, 220, 0.14);
                    }
                    .localprompt-edit-prompt-text-field {
                        flex: 1;
                    }
                    .localprompt-edit-prompt-field textarea {
                        flex: 1;
                        min-height: 280px;
                        max-height: 46vh;
                        padding: 18px 22px;
                        resize: vertical;
                        overflow: auto;
                        font-family: "Cascadia Mono", "Consolas", monospace;
                        font-size: 15px;
                        line-height: 1.55;
                        white-space: pre-wrap;
                    }
                    .localprompt-edit-prompt-footer {
                        border-top: 1px solid rgba(255,255,255,0.12);
                        padding: 16px 32px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 18px;
                        background: rgba(10, 13, 16, 0.3);
                    }
                    .localprompt-edit-prompt-status,
                    .localprompt-edit-prompt-actions {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .localprompt-edit-prompt-status {
                        min-width: 0;
                        color: #aeb5bb;
                        font-size: 13px;
                    }
                    .localprompt-edit-prompt-dot {
                        width: 10px;
                        height: 10px;
                        border-radius: 999px;
                        background: #6a737c;
                        flex: 0 0 auto;
                    }
                    .localprompt-edit-prompt-dot.saved {
                        background: #63c36c;
                    }
                    .localprompt-edit-prompt-divider {
                        width: 1px;
                        height: 18px;
                        background: rgba(255,255,255,0.18);
                    }
                    .localprompt-edit-prompt-actions button {
                        min-width: 116px;
                        height: 40px;
                        padding: 0 18px;
                        border-radius: 7px;
                        color: #f2f5f7;
                        font-size: 14px;
                        font-weight: 700;
                        cursor: pointer;
                    }
                    .localprompt-edit-prompt-secondary {
                        background: rgba(255,255,255,0.08);
                        border: 1px solid rgba(210, 220, 228, 0.32);
                    }
                    .localprompt-edit-prompt-secondary:hover {
                        background: rgba(255,255,255,0.14);
                    }
                    .localprompt-edit-prompt-primary {
                        background: linear-gradient(180deg, #69b871, #478f4f);
                        border: 1px solid rgba(139, 224, 148, 0.72);
                    }
                    .localprompt-edit-prompt-primary:hover {
                        background: linear-gradient(180deg, #74c87c, #4fa257);
                    }
                    @media (max-width: 720px) {
                        .localprompt-edit-prompt-overlay {
                            padding: 12px;
                        }
                        .localprompt-edit-prompt-dialog {
                            width: 100%;
                            max-height: 92vh;
                        }
                        .localprompt-edit-prompt-header,
                        .localprompt-edit-prompt-body,
                        .localprompt-edit-prompt-footer {
                            padding-left: 18px;
                            padding-right: 18px;
                        }
                        .localprompt-edit-prompt-title h3 {
                            font-size: 22px;
                        }
                        .localprompt-edit-prompt-footer {
                            align-items: stretch;
                            flex-direction: column;
                        }
                        .localprompt-edit-prompt-actions {
                            justify-content: flex-end;
                        }
                    }
                    
                    /* Gallery grid for modal */
                    .localprompt-gallery-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
                        gap: 12px;
                        padding-bottom: 64px;
                    }
                    .localprompt-browse-toolbar {
                        display: flex;
                        flex-wrap: nowrap;
                        align-items: center;
                        gap: 6px;
                        position: sticky;
                        top: 0;
                        z-index: 40;
                        margin-bottom: 8px;
                        padding: 5px 6px;
                        background: rgb(17, 23, 29);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 9px;
                        box-shadow: 0 10px 22px rgba(0,0,0,0.24);
                        transition: transform 0.16s ease, opacity 0.16s ease;
                        max-height: 48px;
                        overflow: hidden;
                    }
                    .localprompt-browse-toolbar.toolbar-hidden {
                        transform: translateY(-8px);
                        opacity: 0;
                        pointer-events: none;
                    }
                    .localprompt-browse-toolbar .localprompt-browse-input,
                    .localprompt-browse-toolbar .localprompt-browse-select,
                    .localprompt-browse-toolbar .localprompt-browse-sort-select {
                        min-height: 30px;
                        padding: 5px 9px;
                        background: #111820;
                        border: 1px solid #3b4652;
                        border-radius: 7px;
                        color: #ddd;
                        font-size: 11px;
                        min-width: 0;
                    }
                    .localprompt-browse-toolbar .localprompt-browse-input {
                        flex: 1 1 150px;
                    }
                    .localprompt-browse-toolbar .localprompt-browse-select {
                        flex: 1 1 130px;
                    }
                    .localprompt-browse-toolbar .localprompt-browse-sort-select {
                        flex: 1 1 128px;
                        min-width: 112px;
                    }
                    .localprompt-browse-toolbar-btn {
                        flex: 0 0 auto;
                        min-height: 30px;
                        padding: 5px 10px !important;
                        white-space: nowrap;
                        font-size: 11px;
                    }
                    @container (max-width: 620px) {
                        .localprompt-browse-toolbar {
                            flex-wrap: wrap;
                            max-height: 86px;
                        }
                    }
                    .localprompt-browse-page {
                        position: relative;
                    }
                    .localprompt-browse-page .localprompt-workspace-body,
                    .localprompt-browse-page .localprompt-modal-content {
                        padding-bottom: 10px;
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
                        padding: 5px 8px;
                        border: 1px solid rgba(255,255,255,0.12);
                        border-radius: 999px;
                        background: rgb(16, 20, 24);
                        box-shadow: 0 10px 28px rgba(0,0,0,0.32);
                        overflow: hidden;
                        pointer-events: auto;
                    }
                    .localprompt-browse-pagination-pill .localprompt-btn {
                        min-height: 24px;
                        padding: 4px 10px;
                        border-radius: 999px;
                        font-size: 11px;
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
                        background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02));
                        border: 1px solid rgba(255,255,255,0.13);
                        border-radius: 10px;
                        overflow: hidden;
                        cursor: pointer;
                        transition: all 0.15s;
                        box-shadow: 0 10px 22px rgba(0,0,0,0.14);
                    }
                    .localprompt-gallery-item:hover { border-color: rgba(255,255,255,0.24); transform: translateY(-2px); }
                    .localprompt-item.pinned-dragging,
                    .localprompt-gallery-item.pinned-dragging {
                        opacity: 0.55;
                        border-style: dashed;
                    }
                    .localprompt-item.pinned-drop-target,
                    .localprompt-gallery-item.pinned-drop-target {
                        border-color: #88c0ff !important;
                        box-shadow: 0 0 0 1px rgba(136,192,255,0.35), 0 8px 18px rgba(0,0,0,0.25);
                    }
                    .localprompt-gallery-item.selected { 
                        border-color: #4a9eff; 
                        box-shadow: 0 0 10px rgba(74, 158, 255, 0.4); 
                        position: relative;
                    }
                    .localprompt-gallery-item.selected::after {
                        content: '+';
                        position: absolute;
                        top: 4px;
                        left: 4px;
                        width: 16px;
                        height: 16px;
                        background: #4a9eff;
                        color: #fff;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        font-weight: bold;
                        z-index: 10;
                    }
                    .localprompt-gallery-item .item-preview {
                        height: 116px;
                        background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 42%, transparent 70%), #101720;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .localprompt-gallery-item .item-preview img { width: 100%; height: 100%; object-fit: cover; }
                    .localprompt-gallery-item .item-preview.no-img { font-size: 10px; color: #5f6975; }
                    .localprompt-gallery-item .item-info { padding: 9px 10px 10px; }
                    .localprompt-gallery-item .item-name { font-size: 12px; color: #f0f2f3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .localprompt-bulk-toolbar {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-wrap: wrap;
                        margin-top: 10px;
                        padding: 8px 10px;
                        background: #1b1b1b;
                        border: 1px solid #343434;
                        border-radius: 8px;
                    }
                    .localprompt-bulk-summary {
                        font-size: 11px;
                        color: #b9b9b9;
                        margin-right: auto;
                    }
                    .localprompt-gallery-item.manage-mode {
                        cursor: pointer;
                    }
                    .localprompt-gallery-item.manage-mode::before {
                        content: '';
                        position: absolute;
                        inset: 0;
                        border: 1px solid rgba(255,255,255,0.04);
                        pointer-events: none;
                    }
                </style>
    `;
}
