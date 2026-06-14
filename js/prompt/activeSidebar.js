import {
    clampActiveSidebarWidth as clampActiveSidebarWidthToBounds,
    createPinnedManagedControlsHtml,
    createPromptActionButton,
    formatWeight,
    getActiveSidebarWidth as resolveActiveSidebarWidth,
    getActiveSidebarWidthBounds as resolveActiveSidebarWidthBounds,
    getManagedPromptState,
} from "./helpers.js?v=unified-icons-20260606";
import { escapeHtml } from "../shared/dom.js";

export function getActiveSidebarWidth({ nodeInstance }) {
    return resolveActiveSidebarWidth(nodeInstance.properties, nodeInstance.uiPrefs);
}

export function getActiveSidebarWidthBounds({ widgetContainer, nodeInstance }) {
    const shell = widgetContainer.querySelector(".localprompt-body-shell");
    return resolveActiveSidebarWidthBounds(shell?.clientWidth, nodeInstance.size?.[0]);
}

export function clampActiveSidebarWidth({ widgetContainer, nodeInstance, width }) {
    return clampActiveSidebarWidthToBounds(
        width,
        getActiveSidebarWidthBounds({ widgetContainer, nodeInstance })
    );
}

export function applyActiveSidebarWidthPreference({
    widgetContainer,
    nodeInstance,
    activeSidebarWidthWidget,
}) {
    const width = clampActiveSidebarWidth({
        widgetContainer,
        nodeInstance,
        width: getActiveSidebarWidth({ nodeInstance }),
    });
    widgetContainer.style.setProperty("--localprompt-active-sidebar-width", `${width}px`);
    nodeInstance.uiPrefs.active_sidebar_width = width;
    nodeInstance.properties.active_sidebar_width = width;
    if (activeSidebarWidthWidget) activeSidebarWidthWidget.value = width;
}

export function isActiveSidebarOpen({ nodeInstance }) {
    return nodeInstance.uiPrefs?.active_sidebar_open === true;
}

export function applyActiveSidebarPreference({
    widgetContainer,
    uniqueId,
    nodeInstance,
    activeSidebarWidthWidget,
}) {
    const sidebar = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
    const toggleBtn = widgetContainer.querySelector(`#${uniqueId}-active-toggle`);
    const splitter = widgetContainer.querySelector(`#${uniqueId}-active-splitter`);
    const isOpen = isActiveSidebarOpen({ nodeInstance });
    if (sidebar) sidebar.classList.toggle("active", isOpen);
    if (splitter) splitter.classList.toggle("active", isOpen);
    if (toggleBtn) {
        toggleBtn.classList.toggle("active", isOpen);
        toggleBtn.setAttribute("aria-pressed", isOpen ? "true" : "false");
    }
    applyActiveSidebarWidthPreference({
        widgetContainer,
        nodeInstance,
        activeSidebarWidthWidget,
    });
}

export function setupActiveSidebarResize({
    widgetContainer,
    uniqueId,
    nodeInstance,
    activeSidebarWidthWidget,
    saveUiPrefs,
}) {
    const splitter = widgetContainer.querySelector(`#${uniqueId}-active-splitter`);
    if (!splitter) return;

    let startX = 0;
    let startWidth = 0;

    const onMouseMove = (event) => {
        const nextWidth = clampActiveSidebarWidth({
            widgetContainer,
            nodeInstance,
            width: startWidth + (event.clientX - startX),
        });
        widgetContainer.style.setProperty("--localprompt-active-sidebar-width", `${nextWidth}px`);
    };

    const onMouseUp = async (event) => {
        const finalWidth = clampActiveSidebarWidth({
            widgetContainer,
            nodeInstance,
            width: startWidth + (event.clientX - startX),
        });
        nodeInstance.uiPrefs.active_sidebar_width = finalWidth;
        nodeInstance.properties.active_sidebar_width = finalWidth;
        if (activeSidebarWidthWidget) activeSidebarWidthWidget.value = finalWidth;
        widgetContainer.style.setProperty("--localprompt-active-sidebar-width", `${finalWidth}px`);
        splitter.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        await saveUiPrefs();
    };

    splitter.addEventListener("mousedown", (event) => {
        if (typeof isActiveSidebarOpen === "function" ? !isActiveSidebarOpen() : !isActiveSidebarOpen({ nodeInstance })) return;
        event.preventDefault();
        startX = event.clientX;
        startWidth = clampActiveSidebarWidth({
            widgetContainer,
            nodeInstance,
            width: getActiveSidebarWidth({ nodeInstance }),
        });
        splitter.classList.add("dragging");
        document.body.style.cursor = "ew-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });
}

export async function renderActiveSidebar({
    widgetContainer,
    uniqueId,
    nodeInstance,
    applyActiveSidebarPreference,
    isActiveSidebarOpen,
    hideHoverPreview,
    getActivePromptModels,
    getSelectedPromptEntry,
    applyCategoryRoleStyling,
    bindPinnedManagedControls,
    saveSelectionData,
    renderPrompts,
    getActiveLibraryTab,
    renderLibraryDrawer,
    addPromptToSelection,
    attachInfoPopup,
    attachContextMenu,
    getDisplayMode = () => nodeInstance.uiPrefs?.active_display_mode || nodeInstance.uiPrefs?.display_mode || "compact",
    isRenderCurrent = () => true,
}) {
    const sidebar = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
    const container = widgetContainer.querySelector(`#${uniqueId}-active-chips`);
    if (!sidebar || !container) return;

    const scrollHost = container.closest(".localprompt-active-sidebar-content") || container;
    const previousScrollTop = scrollHost.scrollTop;
    applyActiveSidebarPreference();
    if (!isActiveSidebarOpen()) {
        container.innerHTML = "";
        return;
    }

    hideHoverPreview();
    container.ondragover = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    };
    container.ondrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const prompts = await getActivePromptModels();
    if (!isRenderCurrent()) return;
    const nextContent = document.createDocumentFragment();
    const displayMode = getDisplayMode() === "thumbnails" ? "thumbnails" : "compact";
    container.classList.toggle("active-compact-mode", displayMode === "compact");
    container.classList.toggle("active-thumbnail-mode", displayMode === "thumbnails");

    if (prompts.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "localprompt-empty-state";
        emptyState.textContent = "No active prompts selected.";
        container.replaceChildren(emptyState);
        requestAnimationFrame(() => {
            scrollHost.scrollTop = previousScrollTop;
        });
        return;
    }

    let draggedSelectedPromptId = null;

    prompts.forEach(prompt => {
        const selectedEntry = getSelectedPromptEntry(prompt.id);
        if (!selectedEntry) return;

        const promptId = String(prompt.id);
        let chip;

        if (displayMode === "thumbnails") {
            const safeName = escapeHtml(prompt.name || "");
            const safeCategory = escapeHtml(prompt.category || "");
            const previewHtml = prompt.preview_url
                ? `<img src="${escapeHtml(prompt.preview_url)}" alt="${safeName}" loading="lazy" decoding="async">`
                : `
                    <div class="managed-thumb-placeholder">
                        <div class="managed-placeholder-icon">#</div>
                        ${safeCategory ? `<div class="managed-placeholder-category">${safeCategory}</div>` : ""}
                        <div class="managed-placeholder-name">${safeName}</div>
                    </div>
                `;
            chip = document.createElement("div");
            chip.className = `localprompt-chip-thumb selected pinned-managed${prompt.preview_url ? "" : " no-thumb"}`;
            chip.innerHTML = `
                ${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })}
                <div class="managed-thumb-media" tabindex="-1">
                    ${previewHtml}
                    <span class="thumb-label">${safeName}</span>
                </div>
                ${createPinnedManagedControlsHtml(selectedEntry)}
            `;
            const chipImage = chip.querySelector("img");
            if (chipImage) chipImage.draggable = false;
        } else {
            const safeName = escapeHtml(prompt.name || "");
            const safeCategory = escapeHtml(prompt.category || "");
            const { weight, isOn } = getManagedPromptState(selectedEntry);
            const formattedWeight = formatWeight(weight);
            const previewHtml = prompt.preview_url
                ? `<img src="${escapeHtml(prompt.preview_url)}" alt="${safeName}" loading="lazy" decoding="async">`
                : `<div class="localprompt-active-row-thumb-placeholder">${safeCategory || "#"}</div>`;
            chip = document.createElement("div");
            chip.className = "localprompt-active-row selected";
            chip.innerHTML = `
                <span class="localprompt-active-drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                </span>
                <div class="localprompt-active-row-thumb localprompt-active-preview-target" title="View details" role="button" tabindex="0">${previewHtml}</div>
                <div class="localprompt-active-main">
                    <div class="localprompt-active-name" title="${safeName}">${safeName}</div>
                    <div class="localprompt-active-controls">
                        <button class="managed-state-pill ${isOn ? "on" : "off"}" data-managed-action="toggle-on">${isOn ? "ON" : "OFF"}</button>
                        <span class="managed-weight-val" title="Scroll to adjust weight" aria-label="Scroll to adjust weight" tabindex="0">${formattedWeight}</span>
                    </div>
                </div>
            `;
            const rowImage = chip.querySelector("img");
            if (rowImage) rowImage.draggable = false;
        }

        chip.draggable = true;
        chip.dataset.promptId = promptId;
        applyCategoryRoleStyling(chip, prompt, { soften: true });
        bindPinnedManagedControls(chip, prompt);

        chip.addEventListener("dragstart", (event) => {
            draggedSelectedPromptId = promptId;
            chip.classList.add("pinned-dragging");
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-localpromptgallery-selected", promptId);
            }
        });
        chip.addEventListener("dragover", (event) => {
            if (!draggedSelectedPromptId || draggedSelectedPromptId === promptId) return;
            event.preventDefault();
            event.stopPropagation();
            chip.classList.add("pinned-drop-target");
        });
        chip.addEventListener("dragleave", () => {
            chip.classList.remove("pinned-drop-target");
        });
        chip.addEventListener("drop", (event) => {
            if (!draggedSelectedPromptId || draggedSelectedPromptId === promptId) return;
            event.preventDefault();
            event.stopPropagation();
            chip.classList.remove("pinned-drop-target");
            const currentOrder = [...nodeInstance.promptData];
            const fromIndex = currentOrder.findIndex(item => String(item.prompt_id) === draggedSelectedPromptId);
            const toIndex = currentOrder.findIndex(item => String(item.prompt_id) === promptId);
            if (fromIndex < 0 || toIndex < 0) return;
            const [movedItem] = currentOrder.splice(fromIndex, 1);
            currentOrder.splice(toIndex, 0, movedItem);
            nodeInstance.promptData = currentOrder;
            saveSelectionData();
            renderPrompts();
            const activeLibraryTab = getActiveLibraryTab();
            if (activeLibraryTab) renderLibraryDrawer(activeLibraryTab);
        });
        chip.addEventListener("dragend", () => {
            chip.classList.remove("pinned-dragging", "pinned-drop-target");
            draggedSelectedPromptId = null;
        });
        chip.addEventListener("click", (event) => {
            if (event.target.closest("[data-managed-action], .managed-weight-val, .localprompt-info-btn")) return;
            addPromptToSelection(prompt);
        });
        attachInfoPopup(chip, prompt);
        attachContextMenu(chip, prompt);
        nextContent.appendChild(chip);
    });
    if (!isRenderCurrent()) return;
    container.replaceChildren(nextContent);
    requestAnimationFrame(() => {
        scrollHost.scrollTop = previousScrollTop;
    });
}
