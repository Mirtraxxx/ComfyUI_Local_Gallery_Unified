export function getLoraStyles(uniqueId) {
    return `
                <style>
                    /* --- Core Container Shell --- */
                    .locallora-container-wrapper {
                        width: 100%;
                        height: 100%;
                    }
                    
                    #${uniqueId} .locallora-container {
                        --lora-card-thumb-size: 168px;
                        --lora-card-min-width: 132px;
                        --lora-active-thumb-size: 96px;
                        --lora-active-card-size: 125px;
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        font-family: sans-serif;
                        background: #1a1a1a;
                        border-radius: 8px;
                        overflow: hidden;
                        position: relative;
                    }
                    
                    /* --- Body Shell Layout --- */
                    #${uniqueId} .locallora-body-shell {
                        display: flex;
                        flex: 1;
                        min-height: 0;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    #${uniqueId} .locallora-gallery-pane {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        min-width: 0;
                        height: 100%;
                    }

                    /* --- Resizable Active Sidebar --- */
                    #${uniqueId} .locallora-active-sidebar {
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
                        background:
                            radial-gradient(circle at 2% 6%, rgba(255, 122, 0, 0.14), transparent 34%),
                            radial-gradient(circle at 98% 0%, rgba(255, 158, 217, 0.12), transparent 34%),
                            linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 42%, rgba(255,255,255,0.06)),
                            rgba(16, 18, 22, 0.94);
                        backdrop-filter: blur(20px) saturate(1.1);
                        -webkit-backdrop-filter: blur(20px) saturate(1.1);
                        border: 1px solid rgba(255, 122, 0, 0.32);
                        border-radius: 14px;
                        box-shadow:
                            0 24px 60px rgba(0,0,0,0.52),
                            0 0 0 1px rgba(255,255,255,0.06) inset,
                            0 0 28px rgba(255, 122, 0, 0.14),
                            0 0 34px rgba(255, 158, 217, 0.08);
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
                    
                    #${uniqueId} .locallora-container.active-stack-open .locallora-active-sidebar {
                        opacity: 1;
                        visibility: visible;
                        pointer-events: auto;
                        transform: translateY(0) scaleY(1);
                        transition:
                            opacity 0.18s ease-out,
                            transform 0.2s ease-out,
                            visibility 0s;
                    }
                    
                    #${uniqueId} .locallora-active-sidebar-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        flex: 0 0 auto;
                        padding: 12px 14px;
                        border-bottom: 1px solid rgba(255,255,255,0.1);
                        background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01));
                    }
                    
                    #${uniqueId} .locallora-active-sidebar-title {
                        display: flex;
                        align-items: baseline;
                        gap: 8px;
                        min-width: 0;
                    }
                    
                    #${uniqueId} .locallora-active-sidebar-title span:first-child {
                        font-size: 11px;
                        font-weight: 800;
                        color: #f4f8fb;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        text-shadow: 0 0 10px rgba(255, 122, 0, 0.2);
                    }
                    
                    #${uniqueId} .locallora-active-sidebar-title span:last-child {
                        font-size: 10px;
                        color: rgba(230, 239, 245, 0.66);
                    }
                    
                    #${uniqueId} .locallora-active-sidebar-content {
                        flex: 1 1 auto;
                        min-height: 0;
                        overflow-y: auto;
                        padding: 12px;
                        scrollbar-width: thin;
                    }
                    
                    /* --- Sidebar Resizing Splitter --- */
                    #${uniqueId} .locallora-active-splitter {
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
                    #${uniqueId} .locallora-active-splitter:hover,
                    #${uniqueId} .locallora-active-splitter.dragging {
                        background-color: rgba(255, 122, 0, 0.42);
                        width: 6px;
                    }
                    
                    /* --- Controls / Toolbar Header --- */
                    #${uniqueId} .locallora-controls {
                        display: flex;
                        flex-direction: column;
                        padding: 6px 8px;
                        gap: 6px;
                        flex-shrink: 0;
                        background: #1f1f1f;
                        border-bottom: 1px solid #2d2d2d;
                        position: relative;
                        overflow: visible;
                        transition: border-bottom-color 0.2s ease;
                    }
                    
                    #${uniqueId} .locallora-controls:has(.lora-folder-overflow.open) {
                        border-bottom-color: transparent;
                    }
                    
                    #${uniqueId} .locallora-controls-row {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                    }
                    
                    #${uniqueId} .locallora-primary-controls {
                        z-index: 10;
                    }
                    
                    #${uniqueId} .locallora-hidden-filters {
                        display: none;
                    }
                    
                    #${uniqueId} .lora-active-stack-btn {
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
                        border: 1px solid rgba(255, 122, 0, 0.22);
                        border-radius: 8px;
                        background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.015)), #1c1c1f;
                        color: #e8ecef;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.06);
                        cursor: pointer;
                        opacity: 0.96;
                        transition: opacity 0.14s ease, border-color 0.14s ease, background 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease;
                    }
                    
                    #${uniqueId} .lora-active-stack-btn:hover,
                    #${uniqueId} .lora-active-stack-btn.open {
                        border-color: rgba(255, 145, 40, 0.52);
                        background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02)), #2b2521;
                        box-shadow: 0 3px 8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.09);
                        color: #fff;
                        opacity: 1;
                    }
                    
                    #${uniqueId} .lora-active-stack-btn.has-active {
                        opacity: 1;
                    }
                    
                    #${uniqueId} .lora-active-stack-btn.empty {
                        opacity: 0.52;
                        color: #9da4aa;
                        border-color: rgba(255,255,255,0.13);
                    }
                    
                    #${uniqueId} .lora-active-stack-count {
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
                    
                    #${uniqueId} .lora-active-clear-btn {
                        height: 22px;
                        padding: 0 9px;
                        border: 1px solid rgba(255, 255, 255, 0.18);
                        border-radius: 999px;
                        background: rgba(255, 255, 255, 0.08);
                        color: #fff;
                        font-size: 10px;
                        font-weight: 700;
                        cursor: pointer;
                        transition: background-color 0.15s, border-color 0.15s;
                    }
                    
                    #${uniqueId} .lora-active-clear-btn:hover {
                        background: rgba(142, 47, 56, 0.72);
                        border-color: rgba(200, 90, 100, 0.72);
                    }
                    
                    /* --- Folder Navigation --- */
                    #${uniqueId} .lora-folder-nav {
                        --lora-folder-pull-tab-center-offset: 19px;
                        --lora-folder-pull-tab-edge-offset: 8px;
                        flex: 1 1 auto;
                        min-width: 0;
                    }
                    
                    #${uniqueId} .lora-folder-first-row {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                    }
                    
                    #${uniqueId} .lora-folder-strip {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 1 1 auto;
                        min-width: 0;
                        overflow: hidden;
                    }
                    
                    #${uniqueId} .lora-folder-pill {
                        max-width: 128px;
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        border-radius: 4px;
                        padding: 5px 10px 5px 8px;
                        font-size: 11px;
                        line-height: 1.2;
                        background: #1a1a1c;
                        color: #ccc;
                        border: 1px solid rgba(255,255,255,0.06);
                        border-left: 3px solid var(--folder-color, transparent);
                        cursor: pointer;
                        flex: 0 1 auto;
                        transition: all 0.15s ease;
                        box-sizing: border-box;
                    }
                    
                    #${uniqueId} .lora-folder-pill:hover {
                        color: #fff;
                        background: #2a2a2d;
                        border-color: rgba(255,255,255,0.12);
                        border-left-color: var(--folder-color, rgba(255,255,255,0.26));
                    }
                    
                    #${uniqueId} .lora-folder-pill.active {
                        color: #fff;
                        background: #2d2d30;
                        border-color: rgba(255,255,255,0.12);
                        border-left-color: var(--folder-color, #ff7a00);
                        box-shadow: 0 0 8px var(--folder-glow, rgba(255,122,0,0.22));
                    }
                    
                    #${uniqueId} .lora-folder-overflow-wrapper {
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        z-index: 4200;
                        pointer-events: none;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    
                    #${uniqueId} .lora-folder-overflow {
                        position: relative;
                        width: 100%;
                        background: #1f1f1f;
                        margin-top: -1px;
                        border-bottom: 1px solid transparent;
                        border-top: none;
                        border-left: none;
                        border-right: none;
                        border-radius: 0 0 8px 8px;
                        padding: 0 10px;
                        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.55);
                        clip-path: inset(0px -30px -30px -30px);
                        box-sizing: border-box;
                        pointer-events: auto;
                        max-height: 0;
                        overflow: hidden;
                        transition: opacity 0.2s ease, transform 0.2s ease, max-height 0.2s ease, padding 0.2s ease, border-color 0.2s ease;
                        display: block !important;
                        opacity: 0;
                        transform: translateY(-4px);
                    }
                    
                    #${uniqueId} .lora-folder-overflow.open {
                        opacity: 1;
                        transform: translateY(0);
                        max-height: 250px;
                        padding: 14px 10px;
                        border-bottom-color: #2d2d2d;
                        overflow-y: auto;
                    }
                    
                    #${uniqueId} .lora-folder-overflow-chips {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                        gap: 8px 10px;
                        width: 100%;
                    }
                    
                    #${uniqueId} .lora-folder-overflow-chips::-webkit-scrollbar {
                        width: 4px;
                    }
                    
                    #${uniqueId} .lora-folder-overflow-chips::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.15);
                        border-radius: 2px;
                    }

                    #${uniqueId} .lora-folder-overflow-chips .lora-folder-pill {
                        width: 100%;
                        max-width: none;
                        text-align: left;
                    }
                    
                    #${uniqueId} .lora-folder-pull-tab {
                        display: none;
                        align-items: center;
                        justify-content: center;
                        position: absolute;
                        top: 100%;
                        margin-top: -1px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 4201;
                        width: 60px;
                        height: 16px;
                        padding: 0;
                        background: #1f1f1f;
                        border: 1px solid #2d2d2d;
                        border-top: none;
                        border-radius: 0 0 6px 6px;
                        cursor: pointer;
                        color: #aaa;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        pointer-events: auto;
                        transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
                    }
                    
                    #${uniqueId} .lora-folder-pull-tab::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: -1px;
                        right: -1px;
                        height: 1px;
                        background: #1f1f1f;
                        z-index: 4203;
                        transition: background-color 0.16s ease;
                    }
                    
                    #${uniqueId} .lora-folder-pull-tab:hover::before,
                    #${uniqueId} .lora-folder-pull-tab.open::before {
                        background: #1f1f1f;
                    }
                    
                    #${uniqueId} .lora-folder-pull-tab svg {
                        width: 10px;
                        height: 10px;
                        stroke: currentColor;
                        transition: transform 0.16s ease, color 0.16s ease;
                    }

                    #${uniqueId} .lora-folder-pull-tab.open svg {
                        transform: rotate(180deg);
                        color: #ccc;
                    }

                    #${uniqueId} .lora-folder-pull-tab:hover svg {
                        color: #ff7a00;
                    }
                    
                    #${uniqueId} .lora-folder-pull-tab:hover,
                    #${uniqueId} .lora-folder-pull-tab.open {
                        background: #1f1f1f;
                        color: #ccc;
                        border-color: #2d2d2d;
                    }
                    
                    #${uniqueId} .folder-filter-select {
                        display: none;
                    }

                    /* --- LoRA Discovery Gallery --- */
                    #${uniqueId} .locallora-gallery {
                        flex-grow: 1;
                        overflow-y: auto;
                        background-color: #121212;
                        padding: 12px;
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(var(--lora-card-min-width), 1fr));
                        gap: 10px;
                        align-content: start;
                        scrollbar-width: thin;
                    }
                    
                    /* --- Custom Webkit Scrollbars --- */
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar,
                    #${uniqueId} .locallora-active-sidebar-content::-webkit-scrollbar {
                        width: 6px;
                    }
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar-track,
                    #${uniqueId} .locallora-active-sidebar-content::-webkit-scrollbar-track {
                        background: rgba(0, 0, 0, 0.15);
                    }
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar-thumb,
                    #${uniqueId} .locallora-active-sidebar-content::-webkit-scrollbar-thumb {
                        background-color: rgba(255, 255, 255, 0.18);
                        border-radius: 3px;
                    }
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar-thumb:hover,
                    #${uniqueId} .locallora-active-sidebar-content::-webkit-scrollbar-thumb:hover {
                        background-color: rgba(255, 255, 255, 0.3);
                    }

                    /* --- Bottom Action Bar --- */
                    #${uniqueId} .locallora-bottom-bar {
                        position: relative;
                        z-index: 120;
                        isolation: isolate;
                        padding: 8px 10px;
                        background: #202020;
                        border-top: 1px solid #2d2d2d;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex-wrap: wrap;
                        flex-shrink: 0;
                        overflow: visible;
                    }
                    
                    #${uniqueId} .lora-action-btn {
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
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        border-radius: 8px;
                        background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.015)), #181c20;
                        color: #e8ecef;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.06);
                        cursor: pointer;
                        opacity: 0.96;
                        transition: opacity 0.14s ease, border-color 0.14s ease, background 0.14s ease, transform 0.14s ease, box-shadow 0.14s ease;
                    }
                    
                    #${uniqueId} .lora-action-btn:hover,
                    #${uniqueId} .lora-action-btn.active,
                    #${uniqueId} .lora-action-btn.has-preset {
                        border-color: rgba(255, 122, 0, 0.52);
                        background: linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02)), #252321;
                        box-shadow: 0 3px 8px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.09);
                        color: #fff;
                        opacity: 1;
                    }
                    
                    #${uniqueId} .lora-action-btn.has-preset {
                        border-color: rgba(255, 122, 0, 0.58);
                        color: #ffd2a1;
                    }
                    
                    #${uniqueId} .lora-action-btn svg {
                        width: 16px;
                        height: 16px;
                        stroke: currentColor;
                    }

                    /* --- Display Options Popover --- */
                    #${uniqueId} .lora-display-options-anchor {
                        position: relative;
                        display: inline-flex;
                        flex: 0 0 auto;
                    }
                    
                    #${uniqueId} .lora-display-options-popover {
                        position: absolute;
                        left: 0;
                        bottom: calc(100% + 8px);
                        z-index: 5200;
                        isolation: isolate;
                        width: 228px;
                        max-width: calc(100vw - 24px);
                        box-sizing: border-box;
                    }
                    
                    #${uniqueId} .lora-display-options-panel {
                        display: grid;
                        grid-template-columns: 1fr;
                        gap: 7px;
                        padding: 7px;
                        background: rgb(27, 31, 36);
                        border: 1px solid #3a4148;
                        border-radius: 8px;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.28);
                    }
                    
                    #${uniqueId} .lora-display-section {
                        display: grid;
                        gap: 6px;
                        min-width: 0;
                    }
                    
                    #${uniqueId} .lora-display-section-title {
                        color: #9ea9b2;
                        font-size: 9px;
                        font-weight: 800;
                        letter-spacing: 0.08em;
                    }
                    
                    #${uniqueId} .lora-display-mode-select {
                        width: 100%;
                        min-height: 26px;
                        padding: 4px 7px;
                        background: #111820;
                        border: 1px solid #3b4652;
                        border-radius: 6px;
                        color: #e8ecef;
                        font-size: 11px;
                    }
                    
                    #${uniqueId} .lora-display-mode-select option {
                        background: #111820;
                        color: #e8ecef;
                    }
                    
                    #${uniqueId} .lora-thumbnail-size-control {
                        display: grid;
                        grid-template-columns: 10px minmax(0, 1fr) 10px;
                        align-items: center;
                        gap: 5px;
                        color: #9ea9b2;
                        font-size: 10px;
                    }
                    
                    #${uniqueId} .lora-thumbnail-size-control.disabled {
                        opacity: 0.42;
                    }
                    
                    #${uniqueId} .lora-thumbnail-size-control input[type=range] {
                        width: 100%;
                        min-width: 0;
                        accent-color: #ff7a00;
                    }
                    
                    /* --- LoRA Discovery Card --- */
                    #${uniqueId} .locallora-lora-card {
                        cursor: pointer;
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        border-radius: 8px;
                        background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
                        transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
                        display: flex;
                        flex-direction: column;
                        position: relative;
                        overflow: hidden;
                        box-shadow: 0 8px 18px rgba(0,0,0,0.22);
                    }

                    #${uniqueId} .locallora-container.cards-mode-thumbnails .locallora-lora-card {
                        height: var(--lora-card-thumb-size);
                    }
                    
                    #${uniqueId} .locallora-lora-card.preset-open {
                        overflow: visible;
                        z-index: 60;
                    }
                    
                    #${uniqueId} .locallora-lora-card:hover {
                        transform: translateY(-2px);
                        border-color: rgba(255, 122, 0, 0.62);
                        box-shadow: 0 12px 24px rgba(0,0,0,0.28), 0 0 10px rgba(255,122,0,0.2);
                    }
                    
                    #${uniqueId} .locallora-lora-card.selected-flow {
                        border-color: #ff7a00;
                        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10), 0 0 0 1px rgba(255,122,0,0.42), 0 0 14px rgba(255, 122, 0, 0.42);
                    }
                    
                    #${uniqueId} .locallora-media-container {
                        width: 100%;
                        height: var(--lora-card-thumb-size);
                        background: radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 44%, transparent 70%), #0d1116;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    #${uniqueId} .locallora-container.cards-mode-thumbnails .locallora-media-container {
                        position: absolute;
                        top: -1px;
                        left: -1px;
                        right: -1px;
                        bottom: -1px;
                        width: auto;
                        height: auto;
                        z-index: 1;
                    }
                    
                    #${uniqueId} .locallora-media-container img, 
                    #${uniqueId} .locallora-media-container video {
                        width: 100%;
                        height: 100%;
                        display: block;
                        object-fit: cover;
                    }
                    
                    #${uniqueId} .locallora-lora-card-info {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 8;
                        box-sizing: border-box;
                        padding: 34px 7px 7px;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                        background: linear-gradient(180deg, rgba(0,0,0,0), rgba(6,10,14,0.85));
                        opacity: 0;
                        transform: translateY(8px);
                        pointer-events: none;
                        transition: opacity 0.16s ease, transform 0.16s ease;
                    }
                    
                    #${uniqueId} .locallora-lora-card:hover .locallora-lora-card-info,
                    #${uniqueId} .locallora-lora-card:focus-within .locallora-lora-card-info,
                    #${uniqueId} .locallora-lora-card.selected-flow .locallora-lora-card-info {
                        opacity: 1;
                        transform: translateY(0);
                        pointer-events: auto;
                    }
                    
                    #${uniqueId} .locallora-lora-card p {
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
                    
                    #${uniqueId} .lora-card-triggers {
                        font-size: 10px;
                        color: rgba(230, 238, 245, 0.72);
                        padding: 0;
                        text-align: left;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        min-height: 13px;
                    }
                    
                    #${uniqueId} .lora-card-tags {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 3px;
                        padding-top: 2px;
                    }
                    
                    #${uniqueId} .lora-card-tags .tag {
                        background: rgba(255, 122, 0, 0.22);
                        border: 1px solid rgba(255, 122, 0, 0.32);
                        color: #ffd8b3;
                        padding: 1px 5px;
                        font-size: 10px;
                        border-radius: 999px;
                        cursor: pointer;
                    }
                    
                    #${uniqueId} .lora-card-tags .tag:hover {
                        background: rgba(255, 122, 0, 0.4);
                        color: #fff;
                    }
                    
                    /* --- Card Action Buttons --- */
                    #${uniqueId} .card-btn {
                        position: absolute;
                        width: 24px;
                        height: 24px;
                        background: rgba(10, 12, 15, 0.62);
                        color: white;
                        border: 1px solid rgba(255,255,255,0.22);
                        border-radius: 7px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        cursor: pointer;
                        transition: all 0.16s ease;
                        opacity: 0;
                        text-decoration: none;
                        z-index: 10;
                    }
                    
                    #${uniqueId} .locallora-lora-card:hover .card-btn {
                        opacity: 0.82;
                    }
                    
                    #${uniqueId} .card-btn:hover {
                        opacity: 1 !important;
                        background: rgba(10, 12, 15, 0.86);
                        border-color: rgba(255, 145, 40, 0.62);
                    }
                    
                    #${uniqueId} .card-btn svg {
                        width: 14px;
                        height: 14px;
                        stroke: currentColor;
                        display: block;
                    }
                    
                    #${uniqueId} .lora-card-link-btn { top: 4px; right: 4px; }
                    #${uniqueId} .edit-tags-btn { bottom: 4px; right: 4px; }
                    #${uniqueId} .sync-civitai-btn { top: 4px; left: 4px; }
                    #${uniqueId} .sync-civitai-btn.loading { animation: spin 1s linear infinite; pointer-events: none; background-color: #ff7a00; }
                    #${uniqueId} .sync-civitai-btn.error { background-color: #8e2f38; border-color: #c85a64; color: #fff; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

                    /* --- Metadata Editor --- */
                    #${uniqueId} .locallora-metadata-editor {
                        display: none;
                        flex-direction: column;
                        gap: 5px;
                        padding: 8px;
                        background: #151515;
                        border: 1px solid #333;
                        border-radius: 8px;
                        margin-top: 6px;
                    }
                    
                    #${uniqueId} .locallora-metadata-editor.visible {
                        display: flex;
                    }
                    
                    #${uniqueId} .tag-editor-list .tag .remove-tag {
                        margin-left: 4px;
                        color: #fdd;
                        cursor: pointer;
                        font-weight: bold;
                    }

                    /* --- Active Sidebar Items --- */
                    #${uniqueId} .locallora-active-chips {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        width: 100%;
                    }
                    
                    #${uniqueId} .locallora-lora-item {
                        position: relative;
                        display: grid;
                        grid-template-columns: 12px 64px minmax(0, 1fr);
                        align-items: center;
                        gap: 12px;
                        width: 100%;
                        min-height: 84px;
                        padding: 9px 14px 9px 10px;
                        box-sizing: border-box;
                        border: 1px solid rgba(255, 122, 0, 0.32);
                        border-radius: 13px;
                        background:
                            radial-gradient(circle at 6% 15%, rgba(255, 122, 0, 0.16), transparent 34%),
                            linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.035) 44%, rgba(255,255,255,0.065)),
                            rgba(24, 25, 29, 0.43);
                        backdrop-filter: blur(12px) saturate(1.16);
                        -webkit-backdrop-filter: blur(12px) saturate(1.16);
                        color: #e7ecef;
                        cursor: pointer;
                        box-shadow:
                            inset 0 0 0 1px rgba(255,255,255,0.08),
                            0 10px 24px rgba(0,0,0,0.22),
                            0 0 20px rgba(255, 122, 0, 0.10);
                        transition: border-color 0.15s, box-shadow 0.15s;
                    }
                    
                    #${uniqueId} .locallora-lora-item:hover {
                        border-color: rgba(255, 145, 40, 0.54);
                        background:
                            radial-gradient(circle at 6% 15%, rgba(255, 145, 40, 0.22), transparent 34%),
                            linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.045) 44%, rgba(255,255,255,0.08)),
                            rgba(30, 31, 35, 0.48);
                        box-shadow:
                            inset 0 0 0 1px rgba(255,255,255,0.1),
                            0 12px 28px rgba(0,0,0,0.24),
                            0 0 24px rgba(255, 145, 40, 0.15);
                    }
                    
                    #${uniqueId} .locallora-lora-item.disabled {
                        opacity: 0.58;
                        filter: grayscale(30%);
                    }

                    #${uniqueId} .locallora-active-drag-handle {
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
                    
                    #${uniqueId} .locallora-active-drag-handle span {
                        width: 2px;
                        height: 2px;
                        border-radius: 50%;
                        background: rgba(255, 122, 0, 0.6);
                    }
                    
                    #${uniqueId} .locallora-lora-item:active .locallora-active-drag-handle {
                        cursor: grabbing;
                    }
                    
                    #${uniqueId} .locallora-selected-thumb {
                        width: 64px;
                        height: 64px;
                        border-radius: 9px;
                        overflow: hidden;
                        background: #0d1116;
                        border: 1px solid rgba(255, 122, 0, 0.36);
                        box-shadow:
                            0 6px 16px rgba(0,0,0,0.30),
                            0 0 18px rgba(255, 122, 0, 0.12);
                        cursor: pointer;
                        transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
                    }
                    
                    #${uniqueId} .locallora-selected-thumb:hover {
                        transform: scale(1.055);
                        border-color: rgba(255, 145, 40, 0.72);
                        box-shadow:
                            0 8px 18px rgba(0,0,0,0.34),
                            0 0 24px rgba(255, 145, 40, 0.24);
                    }
                    
                    #${uniqueId} .locallora-selected-thumb img,
                    #${uniqueId} .locallora-selected-thumb video {
                        width: 100%;
                        height: 100%;
                        display: block;
                        object-fit: cover;
                    }
                    
                    #${uniqueId} .locallora-selected-main {
                        display: flex;
                        flex-direction: column;
                        min-width: 0;
                        gap: 6px;
                    }
                    
                    #${uniqueId} .locallora-selected-name {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        font-size: 12px;
                        font-weight: 700;
                        color: #f5fbff;
                        text-shadow: 0 1px 8px rgba(0,0,0,0.32);
                    }
                    
                    #${uniqueId} .locallora-selected-controls {
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        min-width: 0;
                        flex-wrap: wrap;
                    }
                    
                    #${uniqueId} .lora-selected-toggle-pill {
                        height: 24px;
                        min-width: 46px;
                        padding: 0 10px;
                        border-radius: 999px;
                        border: 1px solid rgba(255,255,255,0.14);
                        color: #fff;
                        font-size: 9px;
                        font-weight: 800;
                        cursor: pointer;
                        transition: background 0.15s, border-color 0.15s;
                    }
                    
                    #${uniqueId} .lora-selected-toggle-pill.on {
                        background: linear-gradient(180deg, #10c791, #07835f);
                        border-color: #3ce7b6;
                    }
                    
                    #${uniqueId} .lora-selected-toggle-pill.off {
                        background: linear-gradient(180deg, #4a4a4a, #303030);
                        border-color: #5a5a5a;
                        color: #d8d8d8;
                    }
                    
                    /* --- Scrollable Strength Value Adjusters --- */
                    #${uniqueId} .lora-strength-chip {
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
                    
                    #${uniqueId} .lora-strength-chip:hover {
                        background: rgba(255, 255, 255, 0.08);
                        border-color: rgba(255, 255, 255, 0.25);
                        color: #ffffff;
                    }
                    
                    #${uniqueId} .lora-strength-chip span {
                        color: #ff7a00;
                        font-size: 9px;
                        font-weight: 800;
                        text-transform: uppercase;
                    }
                    
                    #${uniqueId} .lora-strength-chip .managed-weight-val {
                        outline: none;
                    }

                    #${uniqueId} .locallora-lora-item button.remove-lora-btn {
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
                    
                    #${uniqueId} .locallora-lora-item button.remove-lora-btn:hover {
                        background: #8e2f38;
                        border-color: #c85a64;
                    }
                    
                    #${uniqueId} .locallora-selected-preset {
                        min-width: 0;
                        margin-top: 2px;
                    }

                    /* --- Reorder / Dragging Helpers --- */
                    #${uniqueId} .locallora-lora-item.dragging {
                        opacity: 0.45;
                        border-style: dashed;
                    }
                    
                    #${uniqueId} .locallora-lora-item.drag-over {
                        border-color: #ff7a00 !important;
                        box-shadow: 0 0 14px rgba(255, 122, 0, 0.52) !important;
                    }
                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-lora-item.drag-over,
                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-lora-item.drag-over:hover {
                        transform: scale(1.025) !important;
                    }
                    
                    /* --- Compact Mode for Active Sidebar --- */
                    #${uniqueId} .locallora-container.active-mode-compact .locallora-lora-item {
                        grid-template-columns: 12px minmax(0, 1fr);
                        min-height: 64px;
                        padding: 6px 12px 6px 8px;
                    }
                    
                    #${uniqueId} .locallora-container.active-mode-compact .locallora-selected-thumb {
                        display: none;
                    }

                    /* --- Compact Mode for Discovery Cards --- */
                    #${uniqueId} .locallora-container.cards-mode-compact .locallora-gallery {
                        grid-template-columns: repeat(auto-fill, minmax(188px, 1fr));
                    }
                    
                    #${uniqueId} .locallora-container.cards-mode-compact .locallora-lora-card {
                        min-height: 68px;
                        display: grid;
                        grid-template-columns: 64px minmax(0, 1fr);
                        grid-template-rows: auto;
                    }
                    
                    #${uniqueId} .locallora-container.cards-mode-compact .locallora-media-container {
                        width: 64px;
                        height: 64px;
                    }
                    
                    #${uniqueId} .locallora-container.cards-mode-compact .locallora-lora-card-info {
                        position: static;
                        padding: 7px 8px;
                        opacity: 1;
                        transform: none;
                        pointer-events: auto;
                        background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015));
                    }
                    
                    #${uniqueId} .locallora-container.cards-mode-compact .lora-card-tags,
                    #${uniqueId} .locallora-container.cards-mode-compact .lora-trigger-preset-picker {
                        display: none;
                    }
                    
                    #${uniqueId} .locallora-container.cards-mode-compact .edit-tags-btn {
                        bottom: 4px;
                        right: 4px;
                    }

                    /* --- Card Contrast Themes --- */
                    #${uniqueId} .locallora-container.contrast-dim-inactive .locallora-gallery:has(.locallora-lora-card.selected-flow) .locallora-lora-card:not(.selected-flow) {
                        opacity: 0.65;
                        filter: grayscale(35%);
                    }
                    
                    #${uniqueId} .locallora-container.contrast-dim-inactive .locallora-gallery:has(.locallora-lora-card.selected-flow) .locallora-lora-card:not(.selected-flow):hover {
                        opacity: 0.95;
                        filter: none;
                        transform: translateY(-2px);
                    }
                    
                    #${uniqueId} .locallora-container.contrast-dim-by-default .locallora-lora-card {
                        opacity: 0.75;
                        filter: grayscale(35%);
                    }
                    
                    #${uniqueId} .locallora-container.contrast-dim-by-default .locallora-lora-card:hover,
                    #${uniqueId} .locallora-container.contrast-dim-by-default .locallora-lora-card.selected-flow {
                        opacity: 1;
                        filter: none;
                    }
                    
                    /* --- Controls & Inputs Standardizations --- */
                    #${uniqueId} .locallora-controls-row input[type=text], 
                    #${uniqueId} .locallora-controls-row select {
                        background: #222;
                        color: #ccc;
                        border: 1px solid #555;
                        padding: 4px;
                        border-radius: 4px;
                        font-size: 11px;
                    }
                    
                    #${uniqueId} .tag-filter-mode-btn {
                        padding: 4px 8px;
                        background-color: #555;
                        color: #fff;
                        border: 1px solid #666;
                        border-radius: 4px;
                        cursor: pointer;
                        flex-shrink: 0;
                        font-size: 11px;
                    }
                    
                    #${uniqueId} .tag-filter-mode-btn:hover {
                        background-color: #666;
                    }
                    
                    #${uniqueId} .tag-filter-input-wrapper {
                        display: flex;
                        flex-grow: 1;
                        position: relative;
                        align-items: center;
                    }
                    
                    #${uniqueId} .tag-filter-input-wrapper input {
                        flex-grow: 1;
                    }
                    
                    #${uniqueId} .clear-tag-filter-btn {
                        background: none;
                        border: none;
                        color: #ccc;
                        cursor: pointer;
                        position: absolute;
                        right: 4px;
                        top: 50%;
                        transform: translateY(-50%);
                        display: none;
                    }
                    
                    #${uniqueId} .tag-filter-input-wrapper input:not(:placeholder-shown) + .clear-tag-filter-btn {
                        display: block;
                    }
                    
                    /* --- Multi-Select Dropdown --- */
                    #${uniqueId} .locallora-multiselect-tag {
                        position: relative;
                        flex-grow: 1;
                    }
                    
                    #${uniqueId} .locallora-multiselect-tag-display {
                        background-color: #333;
                        color: #ccc;
                        border: 1px solid #555;
                        border-radius: 4px;
                        padding: 4px;
                        font-size: 10px;
                        height: 23px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 4px;
                    }
                    
                    #${uniqueId} .locallora-multiselect-arrow {
                        position: absolute;
                        right: 8px;
                        top: 50%;
                        transform: translateY(-50%);
                        transition: transform 0.2s ease-in-out;
                        font-size: 10px;
                        pointer-events: none;
                    }
                    
                    #${uniqueId} .locallora-multiselect-arrow.open {
                        transform: translateY(-50%) rotate(180deg);
                    }
                    
                    #${uniqueId} .locallora-multiselect-tag-dropdown {
                        display: none;
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        background-color: #222;
                        border: 1px solid #555;
                        border-top: none;
                        max-height: 200px;
                        overflow-y: auto;
                        z-index: 10;
                    }
                    
                    #${uniqueId} .locallora-multiselect-tag-dropdown label {
                        display: block;
                        padding: 4px 8px;
                        cursor: pointer;
                        font-size: 12px;
                        color: #ccc;
                    }
                    
                    #${uniqueId} .locallora-multiselect-tag-dropdown label:hover {
                        background-color: #444;
                    }
                    
                    /* --- Preset Picker Options --- */
                    #${uniqueId} .locallora-preset-container {
                        position: relative;
                        display: inline-flex;
                    }
                    
                    #${uniqueId} .preset-dropdown {
                        display: none;
                        position: absolute;
                        bottom: calc(100% + 8px);
                        left: 0;
                        background-color: #222;
                        min-width: 180px;
                        max-height: min(260px, 70vh);
                        overflow-y: auto;
                        box-shadow: 0px 12px 28px rgba(0,0,0,0.42);
                        z-index: 5000;
                        border: 1px solid rgba(255, 122, 0, 0.24);
                        border-radius: 8px;
                    }
                    
                    #${uniqueId} .preset-dropdown a {
                        color: #ccc;
                        padding: 8px 12px;
                        text-decoration: none;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 12px;
                    }
                    
                    #${uniqueId} .preset-dropdown a:hover {
                        background-color: #444;
                    }
                    
                    #${uniqueId} .delete-preset-btn {
                        color: #ff6666;
                        cursor: pointer;
                        font-weight: bold;
                        padding-left: 10px;
                    }
                    
                    #${uniqueId} .delete-preset-btn:hover {
                        color: #ff0000;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-picker {
                        position: relative;
                        width: 100%;
                        min-width: 0;
                    }

                    #${uniqueId} .locallora-lora-card .lora-trigger-preset-picker {
                        width: calc(100% - 32px);
                    }
                    
                    #${uniqueId} .lora-card-preset-select,
                    #${uniqueId} .lora-card-preset-checklist {
                        position: absolute;
                        opacity: 0;
                        pointer-events: none;
                        width: 1px;
                        height: 1px;
                        overflow: hidden;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-button {
                        width: 100%;
                        min-width: 0;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 4px;
                        padding: 0 7px;
                        border: 1px solid rgba(255,255,255,0.16);
                        border-radius: 999px;
                        background: rgba(8, 10, 14, 0.58);
                        color: #f0f4f7;
                        font-size: 10px;
                        font-weight: 700;
                        cursor: pointer;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-button:hover,
                    #${uniqueId} .lora-trigger-preset-picker.open .lora-trigger-preset-button {
                        border-color: rgba(255, 145, 40, 0.62);
                        background: rgba(26, 23, 20, 0.86);
                    }
                    
                    #${uniqueId} .lora-trigger-preset-label {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-count {
                        min-width: 0;
                        color: #95e8ca;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-arrow {
                        color: rgba(230,238,245,0.62);
                        font-size: 9px;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-popover {
                        position: absolute;
                        left: 0;
                        bottom: calc(100% + 6px);
                        display: none;
                        z-index: 5000;
                        width: min(260px, 76vw);
                        max-height: 240px;
                        overflow: hidden;
                        padding: 8px;
                        border: 1px solid rgba(255, 122, 0, 0.28);
                        border-radius: 12px;
                        background: radial-gradient(circle at 8% 8%, rgba(255, 146, 40, 0.10), transparent 40%), linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025) 45%, rgba(255,255,255,0.05)), rgba(16, 20, 26, 0.94);
                        box-shadow: 0 16px 42px rgba(0,0,0,0.46), inset 0 0 0 1px rgba(255,255,255,0.05);
                    }
                    
                    #${uniqueId} .locallora-lora-card .lora-trigger-preset-popover {
                        bottom: auto;
                        top: calc(100% + 6px);
                    }
                    
                    #${uniqueId} .lora-trigger-preset-picker.open .lora-trigger-preset-popover {
                        display: block;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-search {
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
                    
                    #${uniqueId} .lora-trigger-preset-options {
                        display: flex;
                        flex-direction: column;
                        gap: 3px;
                        max-height: 172px;
                        overflow-y: auto;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-option {
                        width: 100%;
                        min-width: 0;
                        display: grid;
                        grid-template-columns: minmax(72px, 0.65fr) minmax(0, 1fr);
                        gap: 8px;
                        align-items: center;
                        padding: 6px 7px;
                        border: 1px solid transparent;
                        border-radius: 7px;
                        background: transparent;
                        color: #dce6eb;
                        text-align: left;
                        cursor: pointer;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-option:hover {
                        background: rgba(255,255,255,0.07);
                    }
                    
                    #${uniqueId} .lora-trigger-preset-option.selected {
                        background: rgba(16, 199, 145, 0.18);
                        border-color: rgba(67, 231, 182, 0.42);
                        color: #fff;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-option-name,
                    #${uniqueId} .lora-trigger-preset-option-preview {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-option-name {
                        font-size: 11px;
                        font-weight: 750;
                    }
                    
                    #${uniqueId} .lora-trigger-preset-option-preview {
                        color: rgba(226, 238, 245, 0.62);
                        font-size: 10px;
                    }
                    
                    #${uniqueId} .lora-card-preset-stack-label {
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
                    
                    #${uniqueId} .lora-card-preset-stack-checkbox {
                        margin: 0;
                    }
                    
                    /* --- Collapsible States --- */
                    #${uniqueId} .locallora-container.gallery-collapsed .locallora-gallery {
                        display: none;
                    }

                    /* --- Thumbnails-centric Active Stack Grid Styles --- */
                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-active-chips {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                        gap: 12px;
                        width: 100%;
                        box-sizing: border-box;
                    }

                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-lora-item {
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: flex-end;
                        width: 100%;
                        height: 180px;
                        padding: 0;
                        box-sizing: border-box;
                        border: 1px solid rgba(255, 122, 0, 0.28);
                        border-radius: 12px;
                        background: #111;
                        overflow: hidden;
                        box-shadow: 0 8px 18px rgba(0,0,0,0.3);
                        transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
                    }
                    
                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-lora-item:hover {
                        transform: translateY(-2px);
                        border-color: rgba(255, 122, 0, 0.62);
                        box-shadow: 0 12px 24px rgba(0,0,0,0.4), 0 0 10px rgba(255, 122, 0, 0.2);
                    }

                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-selected-thumb {
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
                        cursor: pointer;
                        overflow: hidden;
                    }

                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-selected-thumb img,
                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-selected-thumb video {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }

                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-active-drag-handle {
                        position: absolute;
                        top: 8px;
                        left: 8px;
                        z-index: 10;
                        background: rgba(18, 22, 28, 0.66);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        border-radius: 6px;
                        padding: 4px;
                        height: auto;
                        width: auto;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    }

                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-selected-preset {
                        position: absolute;
                        top: 8px;
                        right: 8px;
                        z-index: 10;
                        width: auto;
                    }
                    
                    #${uniqueId} .locallora-container.active-mode-thumbnails .lora-trigger-preset-picker {
                        width: auto;
                    }

                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-active-overlay-capsule {
                        position: absolute;
                        bottom: 30px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 5;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 6px;
                        width: max-content;
                        padding: 8px 10px;
                        background: rgba(18, 22, 28, 0.78);
                        backdrop-filter: blur(12px) saturate(1.2);
                        -webkit-backdrop-filter: blur(12px) saturate(1.2);
                        border: 1px solid rgba(255, 255, 255, 0.08);
                        border-radius: 14px;
                        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
                    }
                    
                    #${uniqueId} .locallora-container.active-mode-thumbnails .lora-strength-chips-row {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }

                    #${uniqueId} .locallora-container.active-mode-thumbnails .locallora-selected-name {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        height: 24px;
                        z-index: 4;
                        background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.85));
                        text-align: center;
                        font-size: 10px;
                        line-height: 24px;
                        padding: 0 6px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        color: #ffffff;
                        pointer-events: none;
                        text-shadow: 0 1px 4px rgba(0,0,0,0.8);
                        font-weight: bold;
                    }

                    /* --- Hover Zoom & Cursor Hiding for weight adjustment --- */
                    #${uniqueId} .locallora-lora-item .managed-weight-val {
                        position: relative;
                        z-index: 1;
                        transform: scale(1);
                        transform-origin: center;
                        will-change: transform;
                        transition: transform 0.14s ease-out, background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
                        display: inline-block;
                        outline: none;
                    }
                    
                    #${uniqueId} .locallora-lora-item .managed-weight-val:hover,
                    #${uniqueId} .locallora-lora-item .managed-weight-val:focus-visible {
                        z-index: 30;
                        transform: scale(1.8);
                        background: rgba(10, 12, 16, 0.94);
                        border: 1px solid rgba(255, 122, 0, 0.52);
                        border-radius: 6px;
                        padding: 0 4px;
                        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45), 0 0 8px rgba(255, 122, 0, 0.22);
                        cursor: none;
                    }

                    /* Folder Context Menu & Drag highlights */
                    .lora-folder-ctx-menu {
                        background: rgba(28, 28, 30, 0.96);
                        backdrop-filter: blur(8px);
                        border: 1px solid rgba(255, 122, 0, 0.22);
                        border-radius: 8px;
                        padding: 6px;
                        color: #ddd;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
                        z-index: 25001;
                        min-width: 150px;
                        font-family: sans-serif;
                        box-sizing: border-box;
                    }
                    .lora-folder-ctx-menu .menu-item {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px 12px;
                        font-size: 12px;
                        cursor: pointer;
                        border-radius: 4px;
                        transition: background-color 0.1s;
                    }
                    .lora-folder-ctx-menu .menu-item:hover {
                        background-color: rgba(255, 122, 0, 0.15);
                        color: #ff7a00;
                    }
                    .lora-folder-ctx-menu .menu-item svg {
                        width: 14px;
                        height: 14px;
                        stroke: currentColor;
                    }
                    .lora-folder-ctx-menu .menu-divider {
                        height: 1px;
                        background: rgba(255, 255, 255, 0.08);
                        margin: 6px 0;
                    }
                    .lora-folder-ctx-menu .menu-header {
                        font-size: 10px;
                        color: #888;
                        text-transform: uppercase;
                        padding: 4px 12px;
                        font-weight: 600;
                        letter-spacing: 0.5px;
                    }
                    .lora-folder-ctx-menu .color-presets-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 6px;
                        padding: 6px 12px;
                    }
                    .lora-folder-ctx-menu .color-dot {
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        border: 1px solid rgba(255, 255, 255, 0.15);
                        cursor: pointer;
                        padding: 0;
                        transition: transform 0.1s, border-color 0.1s;
                    }
                    .lora-folder-ctx-menu .color-dot:hover,
                    .lora-folder-ctx-menu .color-dot.active {
                        transform: scale(1.15);
                        border-color: #ff7a00;
                    }
                    .lora-folder-ctx-menu .color-picker-row {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 6px 12px 4px;
                        gap: 8px;
                    }
                    .lora-folder-ctx-menu .custom-color-picker-label {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 11px;
                        cursor: pointer;
                        color: #aaa;
                    }
                    .lora-folder-ctx-menu .custom-color-picker-label:hover {
                        color: #fff;
                    }
                    .lora-folder-ctx-menu .custom-color-input {
                        width: 18px;
                        height: 18px;
                        padding: 0;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                    }
                    .lora-folder-ctx-menu .reset-color-btn {
                        background: transparent;
                        border: 1px solid rgba(255,255,255,0.15);
                        color: #aaa;
                        font-size: 9px;
                        padding: 2px 6px;
                        border-radius: 3px;
                        cursor: pointer;
                    }
                    .lora-folder-ctx-menu .reset-color-btn:hover {
                        color: #fff;
                        border-color: #ff7a00;
                        background: rgba(255, 122, 0, 0.1);
                    }
                    
                    /* Drag over visual drop indicator */
                    #${uniqueId} .lora-folder-pill.drag-over {
                        box-shadow: inset 0 0 0 2px rgba(255, 122, 0, 0.42) !important;
                    }
                    #${uniqueId} .lora-folder-pill.pinned-dragging {
                        opacity: 0.45;
                    }
                </style>
    `;
}
