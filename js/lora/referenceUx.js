export function getLoraReferenceUxStyles(uniqueId) {
    return `
        <style>
            #${uniqueId}-wrapper {
                overflow: hidden;
            }
            #${uniqueId} {
                container-type: inline-size;
                color-scheme: dark;
                width: 125%;
                height: 125% !important;
                transform: scale(0.8);
                transform-origin: top left;
            }
            #${uniqueId} .locallora-container {
                --lora-ux-line: rgba(147, 177, 199, 0.15);
                --lora-ux-text: #e8eef3;
                --lora-ux-green: #55dd7d;
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                color: var(--lora-ux-text);
                background:
                    radial-gradient(circle at 9% 2%, rgba(61, 197, 120, 0.075), transparent 29%),
                    radial-gradient(circle at 96% 94%, rgba(48, 113, 180, 0.065), transparent 34%),
                    linear-gradient(145deg, #09131d 0%, #08111a 55%, #09141e 100%);
                border: 1px solid rgba(147, 177, 199, 0.18);
                border-radius: 16px;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.025), 0 18px 48px rgba(0,0,0,0.24);
            }
            #${uniqueId} .locallora-container button,
            #${uniqueId} .locallora-container input,
            #${uniqueId} .locallora-container select,
            #${uniqueId} .locallora-container textarea { font: inherit; }
            #${uniqueId} .locallora-controls {
                min-height: 50px;
                padding: 6px 10px;
                box-sizing: border-box;
                background: rgba(6, 13, 20, 0.48);
                border-bottom: 1px solid var(--lora-ux-line);
                box-shadow: 0 10px 28px rgba(0,0,0,0.12);
            }
            #${uniqueId} .locallora-primary-controls,
            #${uniqueId} .lora-folder-first-row,
            #${uniqueId} .lora-folder-strip { gap: 7px; }
            #${uniqueId} .lora-active-stack-btn,
            #${uniqueId} .lora-action-btn {
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
            #${uniqueId} .lora-active-stack-btn:hover,
            #${uniqueId} .lora-action-btn:hover {
                color: #f4fff7;
                background: linear-gradient(145deg, rgba(85,221,125,0.14), rgba(255,255,255,0.02)), #0c191e;
                border-color: rgba(85, 221, 125, 0.42);
                box-shadow: 0 0 20px rgba(69, 218, 116, 0.09), inset 0 1px 0 rgba(255,255,255,0.04);
                transform: translateY(-1px);
            }
            #${uniqueId} .lora-folder-pull-tab {
                width: 60px;
                height: 16px;
                min-width: 60px;
                padding: 0;
                color: #82909d;
                background: #08111a;
                border: 1px solid rgba(155, 186, 208, 0.22);
                border-top: 0;
                border-radius: 0 0 7px 7px;
                box-shadow: 0 3px 8px rgba(0,0,0,0.22);
                transform: translateX(-50%);
            }
            #${uniqueId} .lora-folder-pull-tab:hover {
                color: #72e994;
                background: #0b1821;
                border-color: rgba(85, 221, 125, 0.34);
                box-shadow: 0 4px 12px rgba(0,0,0,0.26), 0 0 14px rgba(69,218,116,0.08);
                transform: translateX(-50%);
            }
            #${uniqueId} .lora-active-stack-btn:not(.empty),
            #${uniqueId} .lora-action-btn.active,
            #${uniqueId} .lora-settings-btn[aria-expanded="true"] {
                color: #78ef96;
                border-color: rgba(85, 221, 125, 0.54);
                background: linear-gradient(145deg, rgba(72,215,116,0.22), rgba(39,100,70,0.07)), #0b181b;
                box-shadow: 0 0 18px rgba(61, 218, 110, 0.12), inset 0 0 0 1px rgba(255,255,255,0.025);
            }
            #${uniqueId} .lora-folder-pill,
            #${uniqueId} .lora-folder-chip {
                min-height: 34px;
                padding: 0 11px;
                box-sizing: border-box;
                color: #d7e0e7;
                background: linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)), #0b151f;
                border: 1px solid rgba(156, 188, 211, 0.17);
                border-left: 2px solid var(--folder-color, rgba(156,188,211,0.28));
                border-radius: 9px;
                box-shadow: inset 0 1px 0 rgba(255,255,255,0.025), 0 5px 13px rgba(0,0,0,0.14);
                font-size: 11px;
                font-weight: 520;
            }
            #${uniqueId} .lora-folder-pill:hover,
            #${uniqueId} .lora-folder-pill.active,
            #${uniqueId} .lora-folder-chip:hover,
            #${uniqueId} .lora-folder-chip.active {
                color: #f4f8fb;
                background: linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.02)), #0d1924;
                border-color: rgba(177, 210, 231, 0.28);
                box-shadow: 0 0 18px rgba(85,221,125,0.08), inset 0 1px 0 rgba(255,255,255,0.035);
            }
            #${uniqueId} .locallora-body-shell {
                background: linear-gradient(180deg, rgba(255,255,255,0.008), rgba(0,0,0,0.04));
            }
            #${uniqueId} .locallora-gallery {
                gap: 12px;
                /* The browser keeps its native right-side scrollbar. Limit the
                   adjacent content inset to a deliberate, compact clearance. */
                padding: 14px 4px 18px 16px;
                background: transparent;
                scrollbar-color: rgba(132, 151, 169, 0.4) transparent;
            }
            #${uniqueId} .locallora-lora-card {
                border-radius: 12px;
                background: #0c1721;
                border: 1px solid rgba(150, 184, 207, 0.16);
                box-shadow: 0 9px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.02);
                overflow: hidden;
                transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
            }
            #${uniqueId} .locallora-lora-card:hover {
                transform: translateY(-2px);
                border-color: rgba(109, 224, 145, 0.34);
                box-shadow: 0 14px 32px rgba(0,0,0,0.25), 0 0 20px rgba(63, 205, 108, 0.075);
            }
            #${uniqueId} .locallora-lora-card.selected {
                border-color: rgba(75, 225, 119, 0.78);
                box-shadow: 0 0 0 1px rgba(73, 224, 118, 0.17), 0 0 23px rgba(61, 215, 106, 0.14), 0 14px 30px rgba(0,0,0,0.24);
            }
            #${uniqueId} .locallora-lora-card img,
            #${uniqueId} .locallora-lora-card video { transition: transform 0.24s ease, filter 0.24s ease; }
            #${uniqueId} .locallora-lora-card:hover img,
            #${uniqueId} .locallora-lora-card:hover video { transform: scale(1.025); }
            #${uniqueId} .locallora-active-sidebar {
                background:
                    radial-gradient(circle at 10% 0%, rgba(75, 223, 121, 0.09), transparent 32%),
                    rgba(8, 18, 26, 0.97);
                border-color: rgba(92, 221, 132, 0.25);
                border-radius: 13px;
                box-shadow: 0 20px 46px rgba(0,0,0,0.42), 0 0 22px rgba(67, 214, 113, 0.07);
            }
            #${uniqueId} .locallora-active-sidebar-header {
                min-height: 48px;
                padding: 9px 11px;
                border-bottom: 1px solid var(--lora-ux-line);
            }
            #${uniqueId} .locallora-metadata-editor,
            #${uniqueId} .lora-display-options-panel,
            #${uniqueId} .preset-dropdown {
                color: var(--lora-ux-text);
                background: rgba(8, 18, 26, 0.97);
                border: 1px solid rgba(147, 177, 199, 0.18);
                border-radius: 12px;
                box-shadow: 0 20px 46px rgba(0,0,0,0.4);
                backdrop-filter: blur(18px);
            }
            #${uniqueId} input[type="text"],
            #${uniqueId} select,
            #${uniqueId} textarea {
                min-height: 40px;
                padding: 8px 12px;
                box-sizing: border-box;
                color: #dce5eb;
                background: rgba(8, 17, 25, 0.72);
                border: 1px solid rgba(143, 177, 200, 0.18);
                border-radius: 10px;
                outline: none;
            }
            #${uniqueId} input[type="text"]:focus,
            #${uniqueId} select:focus,
            #${uniqueId} textarea:focus {
                border-color: rgba(78, 218, 120, 0.44);
                box-shadow: 0 0 0 3px rgba(73, 216, 116, 0.07);
            }
            #${uniqueId} .locallora-bottom-bar {
                min-height: 50px;
                padding: 7px 10px;
                gap: 7px;
                box-sizing: border-box;
                background: rgba(7, 15, 23, 0.94);
                border-top: 1px solid var(--lora-ux-line);
                box-shadow: 0 -14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.018);
                backdrop-filter: blur(18px) saturate(1.08);
            }
            @container (max-width: 620px) {
                #${uniqueId} .locallora-controls { padding-inline: 8px; }
                #${uniqueId} .lora-folder-strip { gap: 6px; }
                #${uniqueId} .lora-folder-pill,
                #${uniqueId} .lora-folder-chip { min-height: 36px; padding-inline: 10px; font-size: 10px; }
                #${uniqueId} .lora-active-stack-btn,
                #${uniqueId} .lora-action-btn { width: 38px; height: 36px; min-width: 38px; }
                #${uniqueId} .lora-folder-pull-tab { width: 54px; height: 14px; min-width: 54px; }
                #${uniqueId} .locallora-gallery { padding: 10px; gap: 9px; }
                #${uniqueId} .locallora-bottom-bar { padding-inline: 8px; gap: 6px; }
            }
        </style>
    `;
}
