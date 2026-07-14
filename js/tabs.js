import { hideWidget, setDomWidgetVisible } from "./shared/widgets.js";

export function setupUnifiedGalleryTabs(nodeType) {
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
        const result = onNodeCreated?.apply(this, arguments);
        const node = this;
        if (!node.properties) node.properties = {};
        if (node.properties.active_tab !== "lora") node.properties.active_tab = "prompt";

        const tabContainer = document.createElement("div");
        tabContainer.className = "unified-gallery-tabs-wrapper";
        // Ensure canvas selection uses correct node rect for menu positioning even when clicking tabs.
        tabContainer.addEventListener('mousedown', () => {
            setTimeout(() => {
                if (app && app.canvas && typeof app.canvas.selectNode === 'function') {
                    app.canvas.selectNode(node);
                }
            }, 0);
        });
        tabContainer.innerHTML = `
            <style>
                .unified-gallery-tabs-wrapper {
                    width: 100%;
                    padding: 5px 8px 4px;
                    box-sizing: border-box;
                    background:
                        radial-gradient(circle at 12% 0%, rgba(72, 219, 135, 0.08), transparent 32%),
                        #08111a;
                    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                }
                .unified-gallery-tabs {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 6px;
                    width: 100%;
                }
                .unified-gallery-tab {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    min-width: 0;
                    min-height: 32px;
                    padding: 5px 10px;
                    box-sizing: border-box;
                    border: 1px solid rgba(148, 179, 201, 0.16);
                    background: linear-gradient(145deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012));
                    color: #aeb9c5;
                    border-radius: 8px;
                    cursor: pointer;
                    font: 500 10.5px/1.1 inherit;
                    letter-spacing: 0.01em;
                    outline: none;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.025), 0 8px 22px rgba(0,0,0,0.12);
                    transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
                }
                .unified-gallery-tab svg {
                    width: 14px;
                    height: 14px;
                    flex: 0 0 auto;
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 1.8;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }
                .unified-gallery-tab:hover {
                    color: #e8f3f7;
                    border-color: rgba(123, 214, 157, 0.34);
                    background: linear-gradient(145deg, rgba(255,255,255,0.065), rgba(255,255,255,0.02));
                    transform: translateY(-1px);
                }
                .unified-gallery-tab.active {
                    color: #ecfff2;
                    border-color: rgba(78, 220, 124, 0.54);
                    background:
                        linear-gradient(135deg, rgba(63, 201, 110, 0.22), rgba(33, 92, 69, 0.12) 58%, rgba(255,255,255,0.025)),
                        rgba(10, 25, 26, 0.88);
                    box-shadow: inset 0 1px 0 rgba(222,255,234,0.08), 0 0 0 1px rgba(72, 227, 124, 0.05), 0 0 24px rgba(54, 211, 111, 0.11);
                }
                .unified-gallery-tab:focus-visible {
                    outline: 2px solid rgba(113, 237, 150, 0.72);
                    outline-offset: 2px;
                }
                @container (max-width: 520px) {
                    .unified-gallery-tabs-wrapper { padding-inline: 6px; }
                    .unified-gallery-tabs { gap: 5px; }
                    .unified-gallery-tab { min-height: 30px; padding: 4px 8px; font-size: 10px; }
                    .unified-gallery-tab svg { width: 13px; height: 13px; }
                }
            </style>
            <div class="unified-gallery-tabs">
                <button class="unified-gallery-tab" data-tab="prompt" title="Show Prompt Gallery" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.8h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.8a1 1 0 0 1 1-1Z"></path></svg>
                    <span>Prompt Gallery</span>
                </button>
                <button class="unified-gallery-tab" data-tab="lora" title="Show LoRA Gallery" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 13.8 13.8 10"></path><path d="M7.4 16.6 5.3 18.7a3.8 3.8 0 0 1-5.4-5.4L4 9.2a3.8 3.8 0 0 1 5.4 0"></path><path d="m16.6 7.4 2.1-2.1a3.8 3.8 0 0 1 5.4 5.4L20 14.8a3.8 3.8 0 0 1-5.4 0"></path></svg>
                    <span>LoRA Gallery</span>
                </button>
            </div>
        `;
        const tabWidget = node.addDOMWidget("unified_gallery_tabs", "div", tabContainer, {});
        // ComfyUI reserves roughly 16px of DOM-widget chrome from computeSize.
        // Allocate that allowance so the native 41px switcher stays contained.
        tabWidget.computeSize = function(width) { return [width, 57]; };

        const activeTabWidget = node.addWidget("text", "active_tab", node.properties.active_tab, () => {}, {});
        activeTabWidget.serializeValue = () => node.properties.active_tab || "prompt";
        hideWidget(activeTabWidget);

        const applyTab = (tab) => {
            const nextTab = tab === "lora" ? "lora" : "prompt";
            node.properties.active_tab = nextTab;
            activeTabWidget.value = nextTab;
            tabContainer.querySelectorAll(".unified-gallery-tab").forEach((btn) => {
                btn.classList.toggle("active", btn.dataset.tab === nextTab);
            });
            const promptWidget = node.widgets?.find((w) => w.name === "prompt_gallery");
            const loraWidget = node.widgets?.find((w) => w.name === "lora_gallery");
            setDomWidgetVisible(promptWidget, nextTab === "prompt");
            setDomWidgetVisible(loraWidget, nextTab === "lora");
            node.setDirtyCanvas?.(true, true);
        };

        tabContainer.querySelectorAll(".unified-gallery-tab").forEach((btn) => {
            btn.addEventListener("click", () => applyTab(btn.dataset.tab));
        });
        setTimeout(() => applyTab(node.properties.active_tab), 50);
        return result;
    };
}
