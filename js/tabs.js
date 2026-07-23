import { hideWidget, setDomWidgetVisible } from "./shared/widgets.js";

const SWITCH_STYLE_ID = "unified-gallery-switch-styles";

function ensureSwitchStyles() {
    document.getElementById(SWITCH_STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = SWITCH_STYLE_ID;
    style.textContent = `
        .unified-gallery-edge-switch {
            position: absolute;
            top: 50%;
            right: 8px;
            z-index: 220;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 31px;
            height: 68px;
            min-width: 31px;
            padding: 0;
            box-sizing: border-box;
            border: 1px solid rgba(156, 221, 255, 0.42);
            background:
                linear-gradient(180deg, rgba(149, 228, 255, 0.22), rgba(101, 119, 255, 0.12)),
                rgba(13, 25, 37, 0.94);
            color: #d9f7ff;
            border-radius: 15px;
            cursor: pointer;
            outline: none;
            box-shadow: 0 8px 22px rgba(0, 0, 0, 0.30), inset 0 1px 0 rgba(255,255,255,0.12);
            transform: translateY(-50%);
            transition: color 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .unified-gallery-edge-switch[data-target-tab="prompt"] {
            left: 8px;
            right: auto;
            border-color: rgba(255, 179, 111, 0.44);
            background:
                linear-gradient(180deg, rgba(255, 164, 86, 0.24), rgba(229, 98, 188, 0.12)),
                rgba(40, 21, 25, 0.94);
            color: #fff0dd;
        }
        .unified-gallery-edge-switch:hover {
            color: #ffffff;
            border-color: rgba(201, 239, 255, 0.82);
            box-shadow: 0 10px 28px rgba(47, 184, 255, 0.20), inset 0 1px 0 rgba(255,255,255,0.18);
            transform: translateY(-50%) translateX(-2px) scale(1.04);
        }
        .unified-gallery-edge-switch[data-target-tab="prompt"]:hover {
            border-color: rgba(255, 211, 163, 0.82);
            box-shadow: 0 10px 28px rgba(255, 137, 75, 0.20), inset 0 1px 0 rgba(255,255,255,0.18);
            transform: translateY(-50%) translateX(2px) scale(1.04);
        }
        .unified-gallery-edge-switch:focus-visible {
            outline: 2px solid rgba(113, 237, 150, 0.72);
            outline-offset: 2px;
        }
        .unified-gallery-edge-switch svg {
            width: 16px;
            height: 16px;
            fill: none;
            stroke: currentColor;
            stroke-width: 1.8;
            stroke-linecap: round;
            stroke-linejoin: round;
            pointer-events: none;
        }
        .unified-gallery-edge-switch::after {
            content: attr(data-target-label);
            position: absolute;
            right: calc(100% + 8px);
            top: 50%;
            padding: 5px 7px;
            border: 1px solid rgba(197, 231, 255, 0.20);
            border-radius: 6px;
            background: rgba(9, 15, 22, 0.94);
            color: #f3fbff;
            font: 600 10px/1 system-ui, sans-serif;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transform: translate(-3px, -50%);
            transition: opacity 0.16s ease, transform 0.16s ease;
        }
        .unified-gallery-edge-switch:hover::after,
        .unified-gallery-edge-switch:focus-visible::after {
            opacity: 1;
            transform: translate(0, -50%);
        }
        .unified-gallery-edge-switch[data-target-tab="prompt"]::after {
            left: calc(100% + 8px);
            right: auto;
            transform: translate(3px, -50%);
        }
        .unified-gallery-edge-switch[data-target-tab="prompt"]:hover::after,
        .unified-gallery-edge-switch[data-target-tab="prompt"]:focus-visible::after {
            transform: translate(0, -50%);
        }
        .unified-gallery-edge-switch.unified-gallery-handle-arrived {
            animation: unified-gallery-handle-arrive-right 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .unified-gallery-edge-switch[data-target-tab="prompt"].unified-gallery-handle-arrived {
            animation-name: unified-gallery-handle-arrive-left;
        }
        @keyframes unified-gallery-handle-arrive-right {
            from { transform: translateY(-50%) translateX(7px); }
            to { transform: translateY(-50%) translateX(0); }
        }
        @keyframes unified-gallery-handle-arrive-left {
            from { transform: translateY(-50%) translateX(-7px); }
            to { transform: translateY(-50%) translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
            .unified-gallery-edge-switch,
            .unified-gallery-edge-switch::after {
                transition-duration: 0.01ms;
            }
            .unified-gallery-edge-switch.unified-gallery-handle-arrived {
                animation: none;
            }
        }
    `;
    document.head.appendChild(style);
}

function createGallerySwitchButton({ targetTab, transitionToTab }) {
    const targetLabel = targetTab === "lora" ? "LoRA Gallery" : "Prompt Gallery";
    const actionLabel = targetTab === "lora" ? "Open LoRA Gallery" : "Return to Prompt Gallery";
    const button = document.createElement("button");
    button.className = "unified-gallery-edge-switch";
    button.type = "button";
    button.dataset.targetTab = targetTab;
    button.dataset.targetLabel = targetLabel;
    button.title = actionLabel;
    button.setAttribute("aria-label", actionLabel);
    button.innerHTML = targetTab === "lora"
        ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13"></path><path d="m13 6 6 6-6 6"></path></svg>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6"></path><path d="m11 6-6 6 6 6"></path></svg>`;
    button.addEventListener("click", () => transitionToTab(targetTab, button));
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
        // switch is now an edge handle on each gallery surface.
        const compatibilityContainer = document.createElement("div");
        compatibilityContainer.style.display = "none";
        const compatibilityWidget = node.addDOMWidget("unified_gallery_tabs", "div", compatibilityContainer, {});
        hideWidget(compatibilityWidget);

        const activeTabWidget = node.addWidget("text", "active_tab", node.properties.active_tab, () => {}, {});
        activeTabWidget.serializeValue = () => node.properties.active_tab || "prompt";
        hideWidget(activeTabWidget);

        let mountAttempt = 0;
        let mountTimer = null;
        let handleCleanupTimer = null;
        let animatedHandle = null;
        let handleAnimationListener = null;

        const getGalleryRoot = (widget, tab) => widget?.element?.querySelector?.(
            tab === "lora" ? ".locallora-container" : ".localprompt-container",
        );

        const mountSwitchButtons = () => {
            const promptWidget = node.widgets?.find((widget) => widget.name === "prompt_gallery");
            const loraWidget = node.widgets?.find((widget) => widget.name === "lora_gallery");
            const promptTarget = getGalleryRoot(promptWidget, "prompt");
            const loraTarget = getGalleryRoot(loraWidget, "lora");

            if (promptTarget && !promptTarget.querySelector(".unified-gallery-edge-switch")) {
                promptTarget.appendChild(createGallerySwitchButton({ targetTab: "lora", transitionToTab }));
            }
            if (loraTarget && !loraTarget.querySelector(".unified-gallery-edge-switch")) {
                loraTarget.appendChild(createGallerySwitchButton({ targetTab: "prompt", transitionToTab }));
            }

            if ((!promptTarget || !loraTarget) && mountAttempt < 20 && !mountTimer) {
                mountAttempt += 1;
                mountTimer = setTimeout(() => {
                    mountTimer = null;
                    mountSwitchButtons();
                }, 50);
            }
        };

        const clearHandleAnimation = () => {
            if (handleCleanupTimer) clearTimeout(handleCleanupTimer);
            handleCleanupTimer = null;
            if (animatedHandle && handleAnimationListener) {
                animatedHandle.removeEventListener("animationend", handleAnimationListener);
            }
            animatedHandle?.classList.remove("unified-gallery-handle-arrived");
            animatedHandle = null;
            handleAnimationListener = null;
        };

        const animateHandleArrival = (root) => {
            clearHandleAnimation();
            const handle = root?.querySelector(".unified-gallery-edge-switch");
            if (!handle || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
            animatedHandle = handle;
            const cleanup = () => {
                if (animatedHandle !== handle) return;
                handle.classList.remove("unified-gallery-handle-arrived");
                handle.removeEventListener("animationend", onAnimationEnd);
                if (handleCleanupTimer) clearTimeout(handleCleanupTimer);
                handleCleanupTimer = null;
                animatedHandle = null;
                handleAnimationListener = null;
            };
            const onAnimationEnd = (event) => {
                if (event.target === handle) cleanup();
            };
            handle.addEventListener("animationend", onAnimationEnd);
            handleAnimationListener = onAnimationEnd;
            requestAnimationFrame(() => {
                if (animatedHandle === handle) handle.classList.add("unified-gallery-handle-arrived");
            });
            handleCleanupTimer = setTimeout(cleanup, 260);
        };

        const applyTab = (tab, { focusSwitch = false } = {}) => {
            const nextTab = tab === "lora" ? "lora" : "prompt";
            node.properties.active_tab = nextTab;
            activeTabWidget.value = nextTab;
            const promptWidget = node.widgets?.find((widget) => widget.name === "prompt_gallery");
            const loraWidget = node.widgets?.find((widget) => widget.name === "lora_gallery");
            setDomWidgetVisible(promptWidget, nextTab === "prompt");
            setDomWidgetVisible(loraWidget, nextTab === "lora");
            mountSwitchButtons();
            const activeRoot = getGalleryRoot(nextTab === "lora" ? loraWidget : promptWidget, nextTab);
            animateHandleArrival(activeRoot);
            if (focusSwitch) {
                requestAnimationFrame(() => activeRoot?.querySelector(".unified-gallery-edge-switch")?.focus());
            }
            node.setDirtyCanvas?.(true, true);
        };

        const transitionToTab = (tab) => {
            if (node.properties.active_tab === tab) return;
            applyTab(tab, { focusSwitch: true });
        };

        setTimeout(() => {
            mountSwitchButtons();
            applyTab(node.properties.active_tab);
        }, 50);

        const onRemoved = node.onRemoved;
        node.onRemoved = function () {
            if (mountTimer) clearTimeout(mountTimer);
            clearHandleAnimation();
            return onRemoved?.apply(this, arguments);
        };
        return result;
    };
}
