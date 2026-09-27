import { hideWidget, setDomWidgetVisible } from "./shared/widgets.js";

const TABS = [["prompt", "Prompts"], ["lora", "LoRAs"]];

function createGalleryTabs(onSelect) {
    const tabs = document.createElement("div");
    tabs.className = "lg-tabs unified-gallery-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Gallery");
    for (const [tab, label] of TABS) {
        const button = document.createElement("button");
        button.className = "lg-tab";
        button.type = "button";
        button.setAttribute("role", "tab");
        button.dataset.tab = tab;
        button.textContent = label;
        button.addEventListener("click", () => onSelect(tab));
        tabs.appendChild(button);
    }
    return tabs;
}

export function setupUnifiedGalleryTabs(nodeType, app) {
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
        const result = onNodeCreated?.apply(this, arguments);
        const node = this;
        if (!node.properties) node.properties = {};
        if (node.properties.active_tab !== "lora") node.properties.active_tab = "prompt";

        // Keep the historical DOM-widget position so existing workflows retain
        // their widget-value alignment; the visible switch lives in each gallery's top bar.
        const compatibilityContainer = document.createElement("div");
        compatibilityContainer.style.display = "none";
        const compatibilityWidget = node.addDOMWidget("unified_gallery_tabs", "div", compatibilityContainer, {});
        hideWidget(compatibilityWidget);

        const activeTabWidget = node.addWidget("text", "active_tab", node.properties.active_tab, () => {}, {});
        activeTabWidget.serializeValue = () => node.properties.active_tab || "prompt";
        hideWidget(activeTabWidget);

        let mountAttempt = 0;
        let mountTimer = null;

        const getGalleryWidget = (tab) => node.widgets?.find((widget) => widget.name === `${tab}_gallery`);
        const getTopBar = (tab) => getGalleryWidget(tab)?.element?.querySelector?.(".lg-top");

        const syncTabs = () => {
            for (const [tab] of TABS) {
                for (const button of getTopBar(tab)?.querySelectorAll(".unified-gallery-tabs .lg-tab") || []) {
                    button.setAttribute("aria-selected", String(button.dataset.tab === node.properties.active_tab));
                }
            }
        };

        const mountTabs = () => {
            let missing = false;
            for (const [tab] of TABS) {
                const bar = getTopBar(tab);
                if (!bar) missing = true;
                else if (!bar.querySelector(".unified-gallery-tabs")) bar.prepend(createGalleryTabs(selectTab));
            }
            syncTabs();
            if (missing && mountAttempt < 20 && !mountTimer) {
                mountAttempt += 1;
                mountTimer = setTimeout(() => {
                    mountTimer = null;
                    mountTabs();
                }, 50);
            }
        };

        const applyTab = (tab, { focusTab = false } = {}) => {
            const nextTab = tab === "lora" ? "lora" : "prompt";
            node.properties.active_tab = nextTab;
            activeTabWidget.value = nextTab;
            for (const [name] of TABS) setDomWidgetVisible(getGalleryWidget(name), name === nextTab);
            mountTabs();
            if (focusTab) {
                requestAnimationFrame(() => getTopBar(nextTab)?.querySelector(`.unified-gallery-tabs [data-tab="${nextTab}"]`)?.focus());
            }
            node.setDirtyCanvas?.(true, true);
        };

        const selectTab = (tab) => {
            if (node.properties.active_tab === tab) return;
            applyTab(tab, { focusTab: true });
        };

        setTimeout(() => applyTab(node.properties.active_tab), 50);

        const onRemoved = node.onRemoved;
        node.onRemoved = function () {
            if (mountTimer) clearTimeout(mountTimer);
            return onRemoved?.apply(this, arguments);
        };
        return result;
    };
}
