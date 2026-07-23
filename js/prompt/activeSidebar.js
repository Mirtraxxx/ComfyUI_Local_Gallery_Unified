import {
    clampActiveSidebarWidth as clampActiveSidebarWidthToBounds,
    createPinnedManagedControlsHtml,
    createPromptActionButton,
    formatWeight,
    getActiveSidebarWidth as resolveActiveSidebarWidth,
    getActiveSidebarWidthBounds as resolveActiveSidebarWidthBounds,
    getManagedPromptState,
} from "./helpers.js?v=workflow-edit-icon-20260723-1";
import { escapeHtml } from "../shared/dom.js";

export function getActiveSidebarWidth({ nodeInstance }) {
    return resolveActiveSidebarWidth(nodeInstance.properties, nodeInstance.uiPrefs);
}

export function getActiveSidebarWidthBounds({ widgetContainer, nodeInstance }) {
    const shell = widgetContainer.querySelector(".localprompt-body-shell");
    return resolveActiveSidebarWidthBounds(shell?.clientWidth, nodeInstance.size?.[0], {}, nodeInstance.uiPrefs);
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
    
    if (sidebar) {
        sidebar.classList.toggle("active", isOpen);
        const activeDisplay = nodeInstance.uiPrefs?.active_display_mode || nodeInstance.uiPrefs?.display_mode || "compact";
        const isLargeMode = nodeInstance.uiPrefs?.active_card_size_mode === "large" && activeDisplay === "thumbnails";
        sidebar.classList.toggle("large-mode", isLargeMode);
    }
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
    container.classList.toggle("localprompt-active-thumbnail-grid", displayMode === "thumbnails");
    const isLargeMode = nodeInstance.uiPrefs?.active_card_size_mode === "large" && displayMode === "thumbnails";
    container.classList.toggle("active-large-mode", isLargeMode);

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

    let suppressActiveClickUntil = 0;

    const clearActiveDropTargets = () => {
        container.querySelectorAll(".pinned-drop-target").forEach(card => {
            card.classList.remove("pinned-drop-target");
        });
    };

    const getActiveCards = () => Array.from(container.querySelectorAll("[data-prompt-id]"));

    const getSwapTarget = (dragState, clientX, clientY) => {
        const cards = dragState.cardGeometry || getActiveCards()
            .filter(card => card !== dragState.chip)
            .map(card => ({ card, rect: card.getBoundingClientRect() }));
        if (!cards.length) return null;
        const dragCenterX = clientX - dragState.pointerOffsetX;
        const dragCenterY = clientY - dragState.pointerOffsetY;
        const containerRect = container.getBoundingClientRect();
        if (
            dragCenterX < containerRect.left ||
            dragCenterX > containerRect.right ||
            dragCenterY < containerRect.top ||
            dragCenterY > containerRect.bottom
        ) {
            return null;
        }

        const directTarget = cards.find(({ rect }) => {
            return dragCenterX >= rect.left && dragCenterX <= rect.right && dragCenterY >= rect.top && dragCenterY <= rect.bottom;
        });
        if (directTarget) return directTarget.card;

        return cards.reduce((nearest, { card, rect }) => {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(dragCenterX - centerX, dragCenterY - centerY);
            if (!nearest || distance < nearest.distance) return { card, distance };
            return nearest;
        }, null)?.card || null;
    };

    const swapActivePrompts = async (fromPromptId, toPromptId) => {
        if (!fromPromptId || !toPromptId || fromPromptId === toPromptId) return;
        const currentOrder = [...nodeInstance.promptData];
        const fromIndex = currentOrder.findIndex(item => String(item.prompt_id) === String(fromPromptId));
        const toIndex = currentOrder.findIndex(item => String(item.prompt_id) === String(toPromptId));
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
        [currentOrder[fromIndex], currentOrder[toIndex]] = [currentOrder[toIndex], currentOrder[fromIndex]];
        nodeInstance.promptData = currentOrder;
        saveSelectionData();
        renderPrompts();
        const activeLibraryTab = getActiveLibraryTab();
        if (activeLibraryTab) renderLibraryDrawer(activeLibraryTab);
    };

    const bindActivePointerSwap = (chip, promptId) => {
        chip.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            if (event.target.closest("[data-managed-action], .managed-weight-val, .localprompt-info-btn, button, input, select, textarea, a")) return;

            const rect = chip.getBoundingClientRect();
            const dragState = {
                chip,
                promptId,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                pointerOffsetX: event.clientX - (rect.left + rect.width / 2),
                pointerOffsetY: event.clientY - (rect.top + rect.height / 2),
                active: false,
                lastTarget: null,
                cardGeometry: null,
            };
            let pendingMoveEvent = null;
            let moveFrame = null;
            chip.setPointerCapture?.(event.pointerId);

            const cleanup = () => {
                if (moveFrame) cancelAnimationFrame(moveFrame);
                moveFrame = null;
                chip.classList.remove("pinned-dragging");
                chip.releasePointerCapture?.(dragState.pointerId);
                clearActiveDropTargets();
                document.removeEventListener("pointermove", onPointerMove, true);
                document.removeEventListener("pointerup", onPointerUp, true);
                document.removeEventListener("pointercancel", onPointerCancel, true);
                window.removeEventListener("blur", onPointerCancel);
                if (container.__localpromptActiveSidebarDragCleanup === cleanup) {
                    container.__localpromptActiveSidebarDragCleanup = null;
                }
            };

            const updateTarget = moveEvent => {
                clearActiveDropTargets();
                const target = getSwapTarget(dragState, moveEvent.clientX, moveEvent.clientY);
                if (target) target.classList.add("pinned-drop-target");
                dragState.lastTarget = target || dragState.lastTarget;
                return target;
            };

            const onPointerMove = moveEvent => {
                if (moveEvent.pointerId !== dragState.pointerId) return;
                if (!dragState.active) {
                    const distance = Math.hypot(moveEvent.clientX - dragState.startX, moveEvent.clientY - dragState.startY);
                    if (distance < 6) return;
                    dragState.active = true;
                    chip.classList.add("pinned-dragging");
                    // Geometry is stable while this renderer does not reorder
                    // DOM; snapshot it once per drag instead of reading every
                    // card's layout on every pointer event.
                    dragState.cardGeometry = getActiveCards()
                        .filter(card => card !== chip)
                        .map(card => ({ card, rect: card.getBoundingClientRect() }));
                }
                moveEvent.preventDefault();
                moveEvent.stopPropagation();
                pendingMoveEvent = moveEvent;
                if (!moveFrame) {
                    moveFrame = requestAnimationFrame(() => {
                        moveFrame = null;
                        if (pendingMoveEvent) updateTarget(pendingMoveEvent);
                        pendingMoveEvent = null;
                    });
                }
            };

            const onPointerUp = async upEvent => {
                if (upEvent.pointerId !== dragState.pointerId) return;
                if (!dragState.active) {
                    cleanup();
                    return;
                }
                upEvent.preventDefault();
                upEvent.stopPropagation();
                if (moveFrame) {
                    cancelAnimationFrame(moveFrame);
                    moveFrame = null;
                }
                const target = updateTarget(upEvent) || dragState.lastTarget;
                cleanup();
                suppressActiveClickUntil = Date.now() + 250;
                if (target && target !== chip) {
                    await swapActivePrompts(promptId, target.dataset.promptId);
                }
            };

            const onPointerCancel = () => cleanup();

            document.addEventListener("pointermove", onPointerMove, true);
            document.addEventListener("pointerup", onPointerUp, true);
            document.addEventListener("pointercancel", onPointerCancel, true);
            window.addEventListener("blur", onPointerCancel);
            container.__localpromptActiveSidebarDragCleanup?.();
            container.__localpromptActiveSidebarDragCleanup = cleanup;
        });
    };

    const bindWorkflowTextEditor = (chip, prompt, selectedEntry) => {
        const isThumbnail = displayMode === "thumbnails";
        const getOverride = () => {
            const value = selectedEntry?.prompt_text_override;
            return typeof value === "string" ? value.trim() : "";
        };
        const getCardText = () => String(prompt?.prompt_text || "");
        const hasOverride = () => Boolean(getOverride());

        const controlHost = chip.querySelector(".localprompt-active-controls, .managed-card-controls") || chip;
        let editButton;
        if (isThumbnail) {
            controlHost.insertAdjacentHTML("beforeend", createPromptActionButton({
                icon: "edit",
                className: "localprompt-workflow-edit-button localprompt-inline-btn",
                title: "Edit for this workflow",
            }));
            editButton = controlHost.lastElementChild;
        } else {
            editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "localprompt-workflow-edit-button";
            editButton.textContent = "Edit";
            editButton.title = "Edit for this workflow";
            editButton.setAttribute("aria-label", "Edit for this workflow");
            controlHost.appendChild(editButton);
        }
        editButton.dataset.workflowAction = "edit";

        let editedBadge = null;
        if (!isThumbnail) {
            editedBadge = document.createElement("span");
            editedBadge.className = "localprompt-workflow-edited-badge";
            editedBadge.textContent = "Edited";
            editedBadge.hidden = !hasOverride();
            const badgeHost = chip.querySelector(".localprompt-active-main") || chip;
            badgeHost.appendChild(editedBadge);
        }

        const editor = document.createElement("div");
        editor.className = "localprompt-workflow-editor";
        editor.hidden = true;

        const editorLabel = document.createElement("label");
        editorLabel.className = "localprompt-workflow-editor-label";
        editorLabel.textContent = "Workflow-only prompt text";
        const textArea = document.createElement("textarea");
        textArea.className = "localprompt-workflow-editor-text";
        textArea.rows = 3;
        textArea.spellcheck = false;
        textArea.value = getOverride() || getCardText();
        editorLabel.appendChild(textArea);

        const editorActions = document.createElement("div");
        editorActions.className = "localprompt-workflow-editor-actions";
        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "localprompt-workflow-close-button";
        closeButton.dataset.workflowAction = "close";
        closeButton.textContent = "Done";
        editorActions.appendChild(closeButton);
        const revertButton = document.createElement("button");
        revertButton.type = "button";
        revertButton.className = "localprompt-workflow-revert-button";
        revertButton.dataset.workflowAction = "revert";
        revertButton.textContent = "Revert to card text";
        revertButton.hidden = !hasOverride();
        editorActions.appendChild(revertButton);
        editor.append(editorLabel, editorActions);
        chip.appendChild(editor);

        const syncEditedState = () => {
            const edited = hasOverride();
            chip.classList.toggle("localprompt-workflow-edited", edited);
            editButton.classList.toggle("is-edited", edited);
            const editLabel = edited ? "Edit for this workflow (edited)" : "Edit for this workflow";
            editButton.title = editLabel;
            editButton.setAttribute("aria-label", editLabel);
            if (editedBadge) editedBadge.hidden = !edited;
            revertButton.hidden = !edited;
        };

        syncEditedState();

        const saveOverride = (value) => {
            const normalized = String(value || "").trim();
            if (normalized) {
                selectedEntry.prompt_text_override = normalized;
            } else {
                delete selectedEntry.prompt_text_override;
            }
            saveSelectionData({ redrawCanvas: false });
            syncEditedState();
        };

        editButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            editor.hidden = !editor.hidden;
            if (!editor.hidden) {
                textArea.value = getOverride() || getCardText();
                textArea.focus();
                textArea.select();
            }
        });
        textArea.addEventListener("input", event => {
            saveOverride(event.target.value);
        });
        closeButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            editor.hidden = true;
        });
        revertButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            delete selectedEntry.prompt_text_override;
            saveSelectionData();
            renderPrompts();
        });
    };

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

        chip.draggable = false;
        chip.dataset.promptId = promptId;
        applyCategoryRoleStyling(chip, prompt, { soften: true });
        bindPinnedManagedControls(chip, prompt);
        bindWorkflowTextEditor(chip, prompt, selectedEntry);
        bindActivePointerSwap(chip, promptId);
        chip.addEventListener("click", (event) => {
            if (suppressActiveClickUntil > Date.now()) return;
            if (event.target.closest("[data-managed-action], [data-workflow-action], .managed-weight-val, .localprompt-info-btn, button, input, select, textarea, a")) return;
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
