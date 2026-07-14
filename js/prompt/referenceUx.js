export function getPromptReferenceUxStyles() {
    return `
        <style>
            .localprompt-container-wrapper {
                container-type: inline-size;
                color-scheme: dark;
                overflow: hidden;
            }

            .localprompt-container {
                --ux-bg: #08111a;
                --ux-panel: #0c1621;
                --ux-panel-raised: #101c28;
                --ux-line: rgba(147, 177, 199, 0.15);
                --ux-line-strong: rgba(159, 193, 215, 0.24);
                --ux-text: #e8eef3;
                --ux-muted: #8f9cab;
                --ux-green: #55dd7d;
                --ux-green-soft: rgba(85, 221, 125, 0.14);
                --ux-blue: #62a9ff;
                --ux-danger: #ef6262;
                width: 125%;
                height: 125% !important;
                transform: scale(0.8);
                transform-origin: top left;
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                color: var(--ux-text);
                background:
                    radial-gradient(circle at 9% 2%, rgba(61, 197, 120, 0.075), transparent 29%),
                    radial-gradient(circle at 96% 94%, rgba(48, 113, 180, 0.065), transparent 34%),
                    linear-gradient(145deg, #09131d 0%, #08111a 55%, #09141e 100%);
                border: 1px solid rgba(147, 177, 199, 0.18);
                border-radius: 16px;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.025), 0 18px 48px rgba(0,0,0,0.24);
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
                border-bottom: 1px solid var(--ux-line);
                box-shadow: 0 10px 28px rgba(0,0,0,0.12);
            }

            .localprompt-toolbar,
            .localprompt-pinned-first-row,
            .localprompt-pinned-category-strip {
                gap: 7px;
            }

            .localprompt-active-side-tab,
            .localprompt-toolbar-button.localprompt-icon-btn,
            .localprompt-favorite-toggle-btn,
            .localprompt-category-grid-button,
            .localprompt-bottom-bar .localprompt-icon-btn {
                width: 36px;
                height: 34px;
                min-width: 36px;
                padding: 0;
                color: #d9e3ea;
                background: linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.012)), #0b151f;
                border: 1px solid rgba(155, 186, 208, 0.19);
                border-radius: 9px;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.035), 0 6px 16px rgba(0,0,0,0.15);
                transition: border-color 0.17s ease, color 0.17s ease, background 0.17s ease, box-shadow 0.17s ease, transform 0.17s ease;
            }

            .localprompt-active-side-tab:hover,
            .localprompt-toolbar-button.localprompt-icon-btn:hover,
            .localprompt-favorite-toggle-btn:hover,
            .localprompt-category-grid-button:hover,
            .localprompt-bottom-bar .localprompt-icon-btn:hover {
                color: #f4fff7;
                background: linear-gradient(145deg, rgba(85,221,125,0.14), rgba(255,255,255,0.02)), #0c191e;
                border-color: rgba(85, 221, 125, 0.42);
                box-shadow: 0 0 20px rgba(69, 218, 116, 0.09), inset 0 1px 0 rgba(255,255,255,0.04);
                transform: translateY(-1px);
            }

            .localprompt-active-side-tab:not(.empty),
            .localprompt-bottom-bar .localprompt-icon-btn.active,
            .localprompt-bottom-bar .localprompt-icon-btn[aria-pressed="true"] {
                color: #78ef96;
                border-color: rgba(85, 221, 125, 0.54);
                background: linear-gradient(145deg, rgba(72,215,116,0.22), rgba(39,100,70,0.07)), #0b181b;
                box-shadow: 0 0 18px rgba(61, 218, 110, 0.12), inset 0 0 0 1px rgba(255,255,255,0.025);
            }

            .localprompt-active-side-tab-count {
                color: currentColor;
                font-size: 13px;
                font-weight: 650;
            }

            .localprompt-pinned-category-pill,
            .localprompt-library-tab {
                min-height: 34px;
                padding: 0 11px;
                box-sizing: border-box;
                color: #d7e0e7;
                background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)), #0b151f;
                border: 1px solid rgba(156, 188, 211, 0.17);
                border-left: 2px solid var(--category-color, rgba(156,188,211,0.28));
                border-radius: 9px;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.025), 0 5px 13px rgba(0,0,0,0.14);
                font-size: 11px;
                font-weight: 520;
                letter-spacing: 0.005em;
            }

            .localprompt-pinned-category-pill.has-role-color,
            .localprompt-library-tab.has-role-color {
                border-left-width: 2px;
                border-left-color: var(--category-color) !important;
            }

            .localprompt-pinned-category-pill:hover,
            .localprompt-pinned-category-pill.active,
            .localprompt-library-tab:hover,
            .localprompt-library-tab.active {
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
                padding: 14px 16px 18px;
            }

            .localprompt-library-drawer .localprompt-chip-container,
            .localprompt-gallery-grid {
                gap: 12px;
                grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr));
                align-content: start;
            }

            .localprompt-chip-thumb,
            .localprompt-gallery-item {
                border-radius: 12px;
                background: #0c1721;
                border: 1px solid rgba(150, 184, 207, 0.16);
                box-shadow: 0 9px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.02);
                overflow: hidden;
                transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
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

            .localprompt-active-sidebar {
                background:
                    radial-gradient(circle at 10% 0%, rgba(75, 223, 121, 0.09), transparent 32%),
                    rgba(8, 18, 26, 0.97);
                border: 1px solid rgba(92, 221, 132, 0.25);
                border-radius: 13px;
                box-shadow: 0 20px 46px rgba(0,0,0,0.42), 0 0 22px rgba(67, 214, 113, 0.07);
            }

            .localprompt-active-sidebar-header {
                min-height: 48px;
                padding: 9px 11px;
                border-bottom: 1px solid var(--ux-line);
            }

            .localprompt-bottom-bar {
                min-height: 50px;
                padding: 7px 10px;
                gap: 7px;
                box-sizing: border-box;
                background: rgba(7, 15, 23, 0.94);
                border-top: 1px solid var(--ux-line);
                box-shadow: 0 -14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.018);
                backdrop-filter: blur(18px) saturate(1.08);
            }

            .localprompt-library-shell,
            .localprompt-workspace-page,
            .localprompt-workspace-panel,
            .localprompt-workspace-card {
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

            .localprompt-workspace-header {
                min-height: 68px;
                padding: 13px 18px 10px;
                box-sizing: border-box;
                background:
                    radial-gradient(circle at 6% 20%, rgba(70, 206, 123, 0.06), transparent 28%),
                    rgba(8, 17, 26, 0.34);
                border-bottom: 0;
            }

            .localprompt-workspace-title h3 {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 0;
                color: #eef4f7;
                font-size: clamp(18px, 2.3cqi, 23px);
                font-weight: 650;
                letter-spacing: -0.025em;
                text-shadow: 0 0 18px rgba(210, 239, 225, 0.08);
            }

            .localprompt-workspace-title p {
                margin: 6px 0 0;
                color: var(--ux-muted);
                font-size: 11px;
                line-height: 1.5;
            }

            .localprompt-title-status {
                display: inline-block;
                width: 7px;
                height: 7px;
                flex: 0 0 7px;
                border-radius: 999px;
                background: #55d97b;
                box-shadow: 0 0 0 4px rgba(85,217,123,0.10), 0 0 14px rgba(85,217,123,0.55);
            }

            .localprompt-workspace-heading-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 27px;
                height: 27px;
                color: #73e892;
            }

            .localprompt-workspace-heading-icon svg,
            .localprompt-library-choice-icon svg {
                width: 100%;
                height: 100%;
                fill: none;
                stroke: currentColor;
                stroke-width: 1.7;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .localprompt-workspace-heading-icon--import {
                color: #78baff;
            }

            .localprompt-workspace-heading-icon--export { color: #68e38b; }

            .localprompt-library-subnav {
                display: flex;
                align-items: stretch;
                gap: 0;
                min-height: 44px;
                padding: 0 14px;
                background: rgba(7, 15, 23, 0.38);
                border-top: 1px solid rgba(255,255,255,0.012);
                border-bottom: 1px solid var(--ux-line);
                overflow-x: auto;
                scrollbar-width: none;
            }

            .localprompt-library-subnav::-webkit-scrollbar { display: none; }

            .localprompt-library-subnav-item {
                position: relative;
                min-width: 82px;
                min-height: 44px;
                padding: 0 13px;
                color: #aab5c0;
                background: transparent;
                border: 0;
                border-radius: 0;
                font-size: 12px;
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
                background: var(--ux-green);
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

            .localprompt-library-landing {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 0;
                min-height: 280px;
                padding: 16px 4px;
            }

            .localprompt-library-choice {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                justify-content: center;
                min-width: 0;
                min-height: 250px;
                padding: 28px 30px;
                color: var(--ux-text);
                text-align: left;
                background:
                    radial-gradient(circle at 24% 34%, color-mix(in srgb, var(--library-accent) 9%, transparent), transparent 32%),
                    transparent;
                border: 0;
                border-right: 1px solid rgba(143, 174, 196, 0.10);
                border-radius: 0;
                box-shadow: none;
                cursor: pointer;
                transition: background 0.18s ease, transform 0.18s ease;
            }

            .localprompt-library-choice:last-child { border-right: 0; }

            .localprompt-library-choice::before,
            .localprompt-library-choice::after { display: none; }

            .localprompt-library-choice:hover {
                background:
                    radial-gradient(circle at 25% 34%, color-mix(in srgb, var(--library-accent) 17%, transparent), transparent 38%),
                    rgba(255,255,255,0.014);
                border-color: rgba(143,174,196,0.10);
                box-shadow: none;
                transform: translateY(-2px);
            }

            .localprompt-library-choice-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 54px;
                height: 54px;
                margin: 0 0 24px;
                padding: 13px;
                box-sizing: border-box;
                color: var(--library-accent);
                background: color-mix(in srgb, var(--library-accent) 13%, rgba(10,20,29,0.78));
                border: 1px solid color-mix(in srgb, var(--library-accent) 34%, transparent);
                border-radius: 50%;
                box-shadow: 0 0 24px color-mix(in srgb, var(--library-accent) 13%, transparent), inset 0 1px 0 rgba(255,255,255,0.04);
            }

            .localprompt-library-choice strong {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                width: 100%;
                margin-bottom: 12px;
                color: #eef3f6;
                font-size: 20px;
                font-weight: 640;
                line-height: 1.15;
            }

            .localprompt-library-choice-arrow {
                color: #dbe4ea;
                font-size: 28px;
                font-weight: 300;
                line-height: 0.7;
                transition: transform 0.18s ease, color 0.18s ease;
            }

            .localprompt-library-choice:hover .localprompt-library-choice-arrow {
                color: var(--library-accent);
                transform: translateX(3px);
            }

            .localprompt-library-choice > span:last-child {
                max-width: 190px;
                color: #9ba7b3;
                font-size: 12px;
                line-height: 1.55;
            }

            .localprompt-workspace-section {
                padding: 0;
                background: transparent;
                border: 0;
                border-radius: 0;
            }

            .localprompt-workspace-section h4,
            .localprompt-saved-presets-title {
                display: flex;
                align-items: center;
                gap: 9px;
                color: #e9f0f4 !important;
                font-size: 14px !important;
                font-weight: 610 !important;
            }

            .localprompt-section-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 22px;
                color: #65df87;
                font-size: 20px;
                font-weight: 400;
                text-shadow: 0 0 14px rgba(85,221,125,0.36);
            }

            .localprompt-library-shell input[type="text"],
            .localprompt-library-shell input[type="file"],
            .localprompt-library-shell textarea,
            .localprompt-library-shell select,
            .localprompt-browse-input,
            .localprompt-browse-select,
            .localprompt-sort-select {
                min-height: 44px;
                width: 100%;
                padding: 10px 13px !important;
                box-sizing: border-box;
                color: #dce5eb !important;
                background: rgba(8, 17, 25, 0.72) !important;
                border: 1px solid rgba(143, 177, 200, 0.18) !important;
                border-radius: 10px !important;
                outline: none;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.018);
                transition: border-color 0.17s ease, box-shadow 0.17s ease, background 0.17s ease;
            }

            .localprompt-library-shell input:focus,
            .localprompt-library-shell textarea:focus,
            .localprompt-library-shell select:focus,
            .localprompt-browse-input:focus,
            .localprompt-browse-select:focus,
            .localprompt-sort-select:focus {
                background: rgba(10, 21, 30, 0.92) !important;
                border-color: rgba(78, 218, 120, 0.44) !important;
                box-shadow: 0 0 0 3px rgba(73, 216, 116, 0.07), 0 0 20px rgba(59, 204, 105, 0.05);
            }

            .localprompt-library-shell input::placeholder,
            .localprompt-library-shell textarea::placeholder,
            .localprompt-browse-input::placeholder {
                color: #687585;
            }

            .localprompt-preset-management,
            .localprompt-combo-preset,
            .localprompt-saved-presets {
                margin: 0 !important;
                padding: 20px 4px 22px !important;
                border-bottom: 1px solid rgba(143, 174, 196, 0.10) !important;
            }

            .localprompt-saved-presets { border-bottom: 0 !important; }
            .localprompt-preset-save-row { align-items: stretch; }
            #combo-prompts-input { min-height: 94px; resize: vertical; }

            #save-preset-btn,
            #create-combo-btn,
            #import-save-btn,
            #export-save-btn,
            .localprompt-btn.active,
            .localprompt-btn.primary {
                min-height: 44px;
                padding: 9px 18px !important;
                color: #edfff2 !important;
                background:
                    linear-gradient(135deg, rgba(89, 224, 128, 0.28), rgba(38, 110, 71, 0.12)),
                    #10251b !important;
                border: 1px solid rgba(84, 224, 126, 0.55) !important;
                border-radius: 10px !important;
                box-shadow: inset 0 1px 0 rgba(228,255,236,0.08), 0 0 20px rgba(65,211,109,0.09);
            }

            #save-preset-btn:hover,
            #create-combo-btn:hover,
            #import-save-btn:hover,
            #export-save-btn:hover,
            .localprompt-btn.active:hover,
            .localprompt-btn.primary:hover {
                background:
                    linear-gradient(135deg, rgba(103, 238, 143, 0.36), rgba(44, 129, 81, 0.15)),
                    #132b20 !important;
                border-color: rgba(102, 238, 142, 0.72) !important;
                box-shadow: 0 0 24px rgba(69, 221, 115, 0.14);
            }

            .localprompt-presets-list {
                display: grid;
                gap: 8px;
            }

            .localprompt-preset-row {
                min-height: 58px;
                padding: 10px 12px;
                background: rgba(10, 20, 29, 0.58);
                border: 1px solid rgba(144, 177, 199, 0.13);
                border-radius: 10px;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.018);
            }

            .localprompt-preset-icon {
                color: #aa79ff;
                background: rgba(145, 88, 234, 0.12);
                border-color: rgba(160, 100, 255, 0.38);
                box-shadow: 0 0 14px rgba(145,88,234,0.11);
            }

            .localprompt-export-form,
            .localprompt-import-form {
                display: grid;
                gap: 18px;
                padding-top: 4px;
            }

            .localprompt-export-form > p,
            .localprompt-import-form > p {
                margin: 0 0 8px !important;
                color: #9aa8b6 !important;
                font-size: 12px !important;
                line-height: 1.55;
            }

            .localprompt-export-form label,
            .localprompt-import-form label {
                margin-bottom: 7px !important;
                color: #dce5eb !important;
                font-size: 12px;
                font-weight: 600 !important;
            }

            #import-file-input::file-selector-button {
                margin-right: 14px;
                padding: 7px 12px;
                color: #7be99a;
                background: rgba(69, 205, 111, 0.08);
                border: 0;
                border-right: 1px solid rgba(143,177,200,0.15);
                cursor: pointer;
            }

            .localprompt-form-note {
                min-height: 44px;
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 13px !important;
                color: #8f9cab !important;
                background: rgba(255,255,255,0.014) !important;
                border: 1px solid rgba(143, 177, 200, 0.12) !important;
                border-radius: 10px !important;
            }

            .localprompt-library-shell .localprompt-workspace-footer {
                min-height: 56px;
                padding: 8px 18px;
                box-sizing: border-box;
                background: rgba(7, 15, 23, 0.86);
                border-top: 1px solid var(--ux-line);
                box-shadow: 0 -12px 28px rgba(0,0,0,0.13);
            }

            #import-cancel-btn,
            #export-cancel-btn {
                min-height: 44px;
                padding: 9px 18px !important;
                color: #d6e0e6 !important;
                background: #0d1721 !important;
                border: 1px solid rgba(147,177,199,0.18) !important;
                border-radius: 10px !important;
            }

            .localprompt-browse-toolbar {
                display: grid;
                grid-template-columns: minmax(160px, 1.4fr) minmax(140px, 1fr) minmax(140px, 1fr) auto auto auto;
                gap: 9px;
                min-height: 62px;
                padding: 9px;
                background: rgba(8, 17, 25, 0.68);
                border: 1px solid rgba(143, 177, 200, 0.13);
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.018);
                backdrop-filter: blur(16px);
            }

            .localprompt-browse-search {
                position: relative;
                display: flex;
                align-items: center;
                min-width: 0;
            }

            .localprompt-browse-search > svg {
                position: absolute;
                left: 13px;
                z-index: 2;
                width: 17px;
                height: 17px;
                fill: none;
                stroke: #8fa0ad;
                stroke-width: 1.8;
                stroke-linecap: round;
                pointer-events: none;
            }

            .localprompt-browse-search .localprompt-browse-input {
                width: 100%;
                padding-left: 39px !important;
            }

            .localprompt-browse-toolbar-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 7px;
                min-height: 44px;
                padding: 8px 13px !important;
                color: #d7e1e7;
                background: #0c1721;
                border: 1px solid rgba(143, 177, 200, 0.17);
                border-radius: 10px;
            }

            .localprompt-browse-toolbar-btn svg {
                width: 17px;
                height: 17px;
                flex: 0 0 auto;
                fill: none;
                stroke: currentColor;
                stroke-width: 1.7;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .localprompt-browse-danger-btn {
                color: #ffd5d5;
                background: rgba(91, 28, 31, 0.64) !important;
                border-color: rgba(231, 78, 82, 0.42) !important;
            }

            .localprompt-browse-pagination-pill {
                min-height: 38px;
                padding: 5px 8px;
                background: rgba(8, 17, 25, 0.92);
                border-color: rgba(143, 177, 200, 0.15);
                box-shadow: 0 12px 28px rgba(0,0,0,0.28);
            }

            @container (max-width: 940px) {
                .localprompt-library-landing { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .localprompt-library-choice:nth-child(2) { border-right: 0; }
                .localprompt-library-choice:nth-child(-n+2) { border-bottom: 1px solid rgba(143,174,196,0.10); }
                .localprompt-browse-toolbar { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            }

            @container (max-width: 620px) {
                .localprompt-top-row { padding-inline: 8px; }
                .localprompt-pinned-category-strip { gap: 6px; }
                .localprompt-pinned-category-pill { min-height: 32px; padding-inline: 9px; font-size: 10px; }
                .localprompt-active-side-tab,
                .localprompt-toolbar-button.localprompt-icon-btn,
                .localprompt-favorite-toggle-btn,
                .localprompt-bottom-bar .localprompt-icon-btn { width: 34px; height: 32px; min-width: 34px; }
                .localprompt-workspace-header { min-height: 62px; padding: 12px 15px 8px; }
                .localprompt-library-subnav { padding: 0 6px; }
                .localprompt-library-subnav-item { min-width: 78px; padding-inline: 10px; font-size: 11px; }
                .localprompt-library-shell .localprompt-workspace-body { padding: 15px 12px 22px; }
                .localprompt-library-landing { grid-template-columns: 1fr; padding: 0; }
                .localprompt-library-choice { min-height: 158px; padding: 20px; border-right: 0; border-bottom: 1px solid rgba(143,174,196,0.10); }
                .localprompt-library-choice:last-child { border-bottom: 0; }
                .localprompt-library-choice-icon { width: 44px; height: 44px; margin-bottom: 16px; padding: 10px; }
                .localprompt-library-choice strong { font-size: 17px; margin-bottom: 7px; }
                .localprompt-preset-save-row { flex-direction: column; }
                .localprompt-browse-toolbar { grid-template-columns: 1fr 1fr; max-height: none; }
                .localprompt-browse-search { grid-column: 1 / -1; }
                .localprompt-bottom-bar { padding-inline: 8px; gap: 6px; overflow-x: auto; }
            }
        </style>
    `;
}
