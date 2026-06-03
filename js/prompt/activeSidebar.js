import {
    createManagedTextControlsHtml,
    createPinnedManagedControlsHtml,
} from "./helpers.js";

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

        if (displayMode === "thumbnails" && prompt.preview_url) {
            chip = document.createElement("div");
            chip.className = "localprompt-chip-thumb selected pinned-managed";
            chip.innerHTML = `
                <button class="localprompt-info-btn" title="View Info">!</button>
                <div class="managed-thumb-media">
                    <img src="${prompt.preview_url}" alt="${prompt.name}">
                    <span class="thumb-label">${prompt.name}</span>
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
