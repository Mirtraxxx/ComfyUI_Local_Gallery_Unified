import {
    clampActiveSidebarWidth as clampActiveSidebarWidthToBounds,
    createManagedTextControlsHtml,
    createPinnedManagedControlsHtml,
    getActiveSidebarWidth as resolveActiveSidebarWidth,
    getActiveSidebarWidthBounds as resolveActiveSidebarWidthBounds,
} from "./helpers.js";
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
        if (!isActiveSidebarOpen({ nodeInstance })) return;
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
    const nextContent = document.createDocumentFragment();

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

    const displayMode = nodeInstance.uiPrefs.display_mode || "text";
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
                ? `<img src="${escapeHtml(prompt.preview_url)}" alt="${safeName}">`
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
                <button class="localprompt-info-btn" title="View Info">!</button>
                <div class="managed-thumb-media">
                    ${previewHtml}
                    <span class="thumb-label">${safeName}</span>
                </div>
                ${createPinnedManagedControlsHtml(selectedEntry)}
            `;
            const chipImage = chip.querySelector("img");
            if (chipImage) chipImage.draggable = false;
        } else {
            chip = document.createElement("div");
            chip.className = "localprompt-chip selected pinned-managed";
            chip.innerHTML = `
                <button class="localprompt-info-btn" title="View Info">!</button>
                <div class="managed-card-name" title="${prompt.name}">${prompt.name}</div>
                ${createManagedTextControlsHtml(selectedEntry)}
            `;
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
            if (event.target.closest("[data-managed-action]")) return;
            addPromptToSelection(prompt);
        });
        attachInfoPopup(chip, prompt);
        attachContextMenu(chip, prompt);
        nextContent.appendChild(chip);
    });
    container.replaceChildren(nextContent);
    requestAnimationFrame(() => {
        scrollHost.scrollTop = previousScrollTop;
    });
}
