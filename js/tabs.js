import { hideWidget, setDomWidgetVisible } from "./shared/widgets.js";

const SWITCH_STYLE_ID = "unified-gallery-switch-styles";

function ensureSwitchStyles() {
    if (document.getElementById(SWITCH_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = SWITCH_STYLE_ID;
    style.textContent = `
        .unified-gallery-switch {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            min-width: 28px;
            flex: 0 0 28px;
            margin-left: 3px;
            padding: 0;
            box-sizing: border-box;
            border: 1px solid rgba(62, 213, 111, 0.34);
            background: rgba(18, 70, 42, 0.72);
            color: #4ee281;
            border-radius: 7px;
            cursor: pointer;
            outline: none;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
            transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .unified-gallery-switch:hover {
            color: #effff3;
            border-color: rgba(78, 220, 124, 0.62);
            background: rgba(28, 103, 58, 0.82);
        }
        .unified-gallery-switch:focus-visible {
            outline: 2px solid rgba(113, 237, 150, 0.72);
            outline-offset: 2px;
        }
        .unified-gallery-switch svg {
            width: 14px;
            height: 14px;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
            pointer-events: none;
        }
        .localprompt-pinned-first-row > .unified-gallery-switch,
        .lora-folder-first-row > .unified-gallery-switch {
            margin-left: auto;
        }
    `;
    document.head.appendChild(style);
}

function createGallerySwitchButton({ targetTab, applyTab }) {
    const targetLabel = targetTab === "lora" ? "LoRA Gallery" : "Prompt Gallery";
    const button = document.createElement("button");
    button.className = "unified-gallery-switch";
    button.type = "button";
    button.title = `Switch to ${targetLabel}`;
    button.setAttribute("aria-label", `Switch to ${targetLabel}`);
    button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7h11l-3-3"></path><path d="m18 7-3 3"></path>
            <path d="M17 17H6l3 3"></path><path d="m6 17 3-3"></path>
        </svg>
    `;
    button.addEventListener("click", () => applyTab(targetTab));
    return button;
}

export function setupUnifiedGalleryTabs(nodeType, app) {
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
        const result = onNodeCreated?.apply(this, arguments);
        const node = this;
        if (!node.properties) node.properties = {};
        if (node.properties.active_tab !== "lora") node.properties.active_tab = "prompt";
        ensureSwitchStyles();

        // Keep the historical DOM-widget position so existing workflows retain
        // their widget-value alignment, but collapse it completely: the visible
        // switch now lives inside each gallery's existing toolbar.
        const compatibilityContainer = document.createElement("div");
        compatibilityContainer.style.display = "none";
        const compatibilityWidget = node.addDOMWidget("unified_gallery_tabs", "div", compatibilityContainer, {});
        hideWidget(compatibilityWidget);

        const activeTabWidget = node.addWidget("text", "active_tab", node.properties.active_tab, () => {}, {});
        activeTabWidget.serializeValue = () => node.properties.active_tab || "prompt";
        hideWidget(activeTabWidget);

        let mountAttempt = 0;
        let mountTimer = null;

        const mountSwitchButtons = () => {
            const promptWidget = node.widgets?.find((widget) => widget.name === "prompt_gallery");
            const loraWidget = node.widgets?.find((widget) => widget.name === "lora_gallery");
            const promptTarget = promptWidget?.element?.querySelector?.(".localprompt-pinned-first-row");
            const loraTarget = loraWidget?.element?.querySelector?.(".lora-folder-first-row");

            if (promptTarget && !promptTarget.querySelector(".unified-gallery-switch")) {
                promptTarget.appendChild(createGallerySwitchButton({ targetTab: "lora", applyTab }));
            }
            if (loraTarget && !loraTarget.querySelector(".unified-gallery-switch")) {
                loraTarget.appendChild(createGallerySwitchButton({ targetTab: "prompt", applyTab }));
            }

            if ((!promptTarget || !loraTarget) && mountAttempt < 20 && !mountTimer) {
                mountAttempt += 1;
                mountTimer = setTimeout(() => {
                    mountTimer = null;
                    mountSwitchButtons();
                }, 50);
            }
        };

        const applyTab = (tab) => {
            const nextTab = tab === "lora" ? "lora" : "prompt";
            node.properties.active_tab = nextTab;
            activeTabWidget.value = nextTab;
            const promptWidget = node.widgets?.find((widget) => widget.name === "prompt_gallery");
            const loraWidget = node.widgets?.find((widget) => widget.name === "lora_gallery");
            setDomWidgetVisible(promptWidget, nextTab === "prompt");
            setDomWidgetVisible(loraWidget, nextTab === "lora");
            mountSwitchButtons();
            node.setDirtyCanvas?.(true, true);
        };

        setTimeout(() => {
            mountSwitchButtons();
            applyTab(node.properties.active_tab);
        }, 50);

        const onRemoved = node.onRemoved;
        node.onRemoved = function () {
            if (mountTimer) clearTimeout(mountTimer);
            return onRemoved?.apply(this, arguments);
        };
        return result;
    };
}
