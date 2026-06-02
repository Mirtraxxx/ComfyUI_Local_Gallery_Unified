export function setupUnifiedGalleryTabs(nodeType) {
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
        const result = onNodeCreated?.apply(this, arguments);
        const node = this;
        if (!node.properties) node.properties = {};
        if (node.properties.active_tab !== "lora") node.properties.active_tab = "prompt";

        const tabContainer = document.createElement("div");
        tabContainer.className = "unified-gallery-tabs-wrapper";
        tabContainer.innerHTML = `
            <style>
                .unified-gallery-tabs-wrapper { width: 100%; padding: 4px 6px 2px; box-sizing: border-box; }
                .unified-gallery-tabs { display: flex; gap: 4px; width: 100%; }
                .unified-gallery-tab { flex: 1 1 0; min-width: 0; padding: 6px 8px; border: 1px solid #555; background: #2d2d2d; color: #ddd; border-radius: 5px; cursor: pointer; font-size: 12px; line-height: 1.1; }
                .unified-gallery-tab:hover { background: #3a3a3a; }
                .unified-gallery-tab.active { background: #4a7c4a; border-color: #66a066; color: #fff; }
            </style>
            <div class="unified-gallery-tabs">
                <button class="unified-gallery-tab" data-tab="prompt" title="Show Prompt Gallery">Prompt Gallery</button>
                <button class="unified-gallery-tab" data-tab="lora" title="Show LoRA Gallery">LoRA Gallery</button>
            </div>
        `;
        const tabWidget = node.addDOMWidget("unified_gallery_tabs", "div", tabContainer, {});
        tabWidget.computeSize = function(width) { return [width, 42]; };

        const activeTabWidget = node.addWidget("text", "active_tab", node.properties.active_tab, () => {}, {});
        activeTabWidget.serializeValue = () => node.properties.active_tab || "prompt";
        activeTabWidget.type = "hidden";
        activeTabWidget.computeSize = () => [0, -4];
        activeTabWidget.draw = function() {};

        const applyTab = (tab) => {
            const nextTab = tab === "lora" ? "lora" : "prompt";
            node.properties.active_tab = nextTab;
            activeTabWidget.value = nextTab;
            tabContainer.querySelectorAll(".unified-gallery-tab").forEach((btn) => {
                btn.classList.toggle("active", btn.dataset.tab === nextTab);
            });
            const promptWidget = node.widgets?.find((w) => w.name === "prompt_gallery");
            const loraWidget = node.widgets?.find((w) => w.name === "lora_gallery");
            const setWidgetVisible = (widget, visible) => {
                if (!widget) return;
                delete widget.computeSize;
                widget.type = visible ? "div" : "hidden";
                widget.options.getMinHeight = () => visible ? 260 : 0;
                widget.options.getMaxHeight = () => visible ? 100000 : 0;
                if (widget.element) {
                    widget.element.style.display = visible ? "" : "none";
                    widget.element.style.height = visible ? "100%" : "0";
                    widget.element.style.maxHeight = visible ? "none" : "0";
                    widget.element.style.overflow = "hidden";
                    widget.element.style.pointerEvents = visible ? "auto" : "none";
                }
            };
            setWidgetVisible(promptWidget, nextTab === "prompt");
            setWidgetVisible(loraWidget, nextTab === "lora");
            node.setDirtyCanvas?.(true, true);
        };

        tabContainer.querySelectorAll(".unified-gallery-tab").forEach((btn) => {
            btn.addEventListener("click", () => applyTab(btn.dataset.tab));
        });
        setTimeout(() => applyTab(node.properties.active_tab), 50);
        return result;
    };
}
