import {
    bindPromptPreviewVideo,
    buildPromptPreviewMediaHtml,
    clampActiveSidebarWidth as clampActiveSidebarWidthToBounds,
    createPinnedManagedControlsHtml,
    createPromptActionButton,
    formatWeight,
    getActiveSidebarWidth as resolveActiveSidebarWidth,
    getActiveSidebarWidthBounds as resolveActiveSidebarWidthBounds,
    getManagedPromptState,
} from "./helpers.js";
import { escapeHtml } from "../shared/dom.js";

export function buildPromptTextDiff(originalText, currentText) {
    const tokenize = value => String(value || "").match(/\s+|[^\s]+/g) || [];
    const original = tokenize(originalText);
    const current = tokenize(currentText);
    const originalLength = original.length;
    const currentLength = current.length;

    if (originalLength > 800 || currentLength > 800) {
        const originalValue = original.join("");
        const currentValue = current.join("");
        let prefixLength = 0;
        const maxPrefix = Math.min(originalValue.length, currentValue.length);
        while (
            prefixLength < maxPrefix
            && originalValue[prefixLength] === currentValue[prefixLength]
        ) {
            prefixLength += 1;
        }

        let suffixLength = 0;
        while (
            suffixLength < originalValue.length - prefixLength
            && suffixLength < currentValue.length - prefixLength
            && originalValue[originalValue.length - 1 - suffixLength]
                === currentValue[currentValue.length - 1 - suffixLength]
        ) {
            suffixLength += 1;
        }

        const segments = [];
        const prefix = originalValue.slice(0, prefixLength);
        const removed = originalValue.slice(prefixLength, originalValue.length - suffixLength);
        const added = currentValue.slice(prefixLength, currentValue.length - suffixLength);
        const suffix = suffixLength ? originalValue.slice(-suffixLength) : "";
        if (prefix) segments.push({ type: "equal", text: prefix });
        if (removed) segments.push({ type: "removed", text: removed });
        if (added) segments.push({ type: "added", text: added });
        if (suffix) segments.push({ type: "equal", text: suffix });
        return segments;
    }

    const width = currentLength + 1;
    const directions = new Uint8Array((originalLength + 1) * width);
    let previous = new Uint16Array(width);
    let active = new Uint16Array(width);

    for (let originalIndex = 1; originalIndex <= originalLength; originalIndex += 1) {
        for (let currentIndex = 1; currentIndex <= currentLength; currentIndex += 1) {
            const directionIndex = originalIndex * width + currentIndex;
            if (original[originalIndex - 1] === current[currentIndex - 1]) {
                active[currentIndex] = previous[currentIndex - 1] + 1;
                directions[directionIndex] = 1;
            } else if (previous[currentIndex] >= active[currentIndex - 1]) {
                active[currentIndex] = previous[currentIndex];
                directions[directionIndex] = 2;
            } else {
                active[currentIndex] = active[currentIndex - 1];
                directions[directionIndex] = 3;
            }
        }
        [previous, active] = [active, previous];
        active.fill(0);
    }

    const reversed = [];
    let originalIndex = originalLength;
    let currentIndex = currentLength;
    while (originalIndex > 0 || currentIndex > 0) {
        const direction = directions[originalIndex * width + currentIndex];
        if (originalIndex > 0 && currentIndex > 0 && direction === 1) {
            reversed.push({ type: "equal", text: original[originalIndex - 1] });
            originalIndex -= 1;
            currentIndex -= 1;
        } else if (originalIndex > 0 && (currentIndex === 0 || direction === 2)) {
            reversed.push({ type: "removed", text: original[originalIndex - 1] });
            originalIndex -= 1;
        } else {
            reversed.push({ type: "added", text: current[currentIndex - 1] });
            currentIndex -= 1;
        }
    }

    const segments = [];
    reversed.reverse().forEach(segment => {
        const previousSegment = segments[segments.length - 1];
        if (previousSegment?.type === segment.type) {
            previousSegment.text += segment.text;
        } else {
            segments.push({ ...segment });
        }
    });
    return segments;
}

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
            chip.insertAdjacentHTML("beforeend", createPromptActionButton({
                icon: "edit",
                className: "localprompt-workflow-edit-button localprompt-inline-btn",
                title: "Edit for this workflow",
            }));
            editButton = chip.lastElementChild;
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

        const syncEditedState = () => {
            const edited = hasOverride();
            chip.classList.toggle("localprompt-workflow-edited", edited);
            editButton.classList.toggle("is-edited", edited);
            const editLabel = edited ? "Edit for this workflow (edited)" : "Edit for this workflow";
            editButton.title = editLabel;
            editButton.setAttribute("aria-label", editLabel);
            if (editedBadge) editedBadge.hidden = !edited;
        };

        syncEditedState();

        const saveOverride = (value) => {
            const normalized = String(value || "").trim();
            if (normalized && normalized !== getCardText().trim()) {
                selectedEntry.prompt_text_override = normalized;
            } else {
                delete selectedEntry.prompt_text_override;
            }
            saveSelectionData({ redrawCanvas: false });
            syncEditedState();
        };

        const openWorkflowEditor = () => {
            const existingOverlay = document.querySelector(".localprompt-workflow-editor-overlay");
            existingOverlay?.__localpromptClose?.({ restoreFocus: false });

            const initialValue = getOverride() || getCardText();
            const overlay = document.createElement("div");
            overlay.className = "localprompt-workflow-editor-overlay";
            overlay.innerHTML = `
                <section
                    class="localprompt-workflow-editor"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="localprompt-workflow-editor-title"
                    aria-describedby="localprompt-workflow-editor-description"
                >
                    <header class="localprompt-workflow-editor-header">
                        <div class="localprompt-workflow-editor-heading">
                            <h2 id="localprompt-workflow-editor-title">Edit for this workflow</h2>
                            <p id="localprompt-workflow-editor-description"></p>
                        </div>
                        <button
                            type="button"
                            class="localprompt-workflow-editor-close"
                            data-workflow-editor-action="cancel"
                            aria-label="Cancel and close editor"
                            title="Cancel"
                        >&times;</button>
                    </header>
                    <main class="localprompt-workflow-editor-body">
                        <section class="localprompt-workflow-editor-input-pane">
                            <div class="localprompt-workflow-editor-label-row">
                                <label class="localprompt-workflow-editor-label" for="localprompt-workflow-editor-text">
                                    Prompt text
                                </label>
                                <span class="localprompt-workflow-inline-diff-status" data-workflow-diff-status>
                                    Matches card
                                </span>
                            </div>
                            <details class="localprompt-workflow-original-reference" open>
                                <summary>Original card text</summary>
                                <pre data-workflow-original-text></pre>
                            </details>
                            <div class="localprompt-workflow-editor-input-wrap">
                                <pre class="localprompt-workflow-editor-highlight" aria-hidden="true"></pre>
                                <textarea
                                    id="localprompt-workflow-editor-text"
                                    class="localprompt-workflow-editor-text"
                                    spellcheck="false"
                                ></textarea>
                            </div>
                        </section>
                    </main>
                    <footer class="localprompt-workflow-editor-footer">
                        <div class="localprompt-workflow-editor-status" aria-live="polite">
                            <span data-workflow-editor-status>No changes</span>
                            <span aria-hidden="true">|</span>
                            <span data-workflow-editor-count>0 characters</span>
                        </div>
                        <div class="localprompt-workflow-editor-actions">
                            <button
                                type="button"
                                class="localprompt-workflow-revert-button"
                                data-workflow-editor-action="revert"
                            >Use card text</button>
                            <button
                                type="button"
                                class="localprompt-workflow-cancel-button"
                                data-workflow-editor-action="cancel"
                            >Cancel</button>
                            <button
                                type="button"
                                class="localprompt-workflow-confirm-button"
                                data-workflow-editor-action="confirm"
                            >Confirm changes</button>
                        </div>
                    </footer>
                </section>
            `;

            const editor = overlay.querySelector(".localprompt-workflow-editor");
            const description = overlay.querySelector("#localprompt-workflow-editor-description");
            const textArea = overlay.querySelector(".localprompt-workflow-editor-text");
            const status = overlay.querySelector("[data-workflow-editor-status]");
            const count = overlay.querySelector("[data-workflow-editor-count]");
            const revertButton = overlay.querySelector("[data-workflow-editor-action='revert']");
            const diffStatus = overlay.querySelector("[data-workflow-diff-status]");
            const originalTextReference = overlay.querySelector("[data-workflow-original-text]");
            const highlightLayer = overlay.querySelector(".localprompt-workflow-editor-highlight");
            const previousBodyOverflow = document.body.style.overflow;
            let closed = false;

            description.textContent = prompt?.name
                ? `${prompt.name}. This edit is saved only in the current workflow.`
                : "This edit is saved only in the current workflow.";
            textArea.value = initialValue;
            revertButton.hidden = !hasOverride();

            const renderHighlightSegments = (segments) => {
                highlightLayer.replaceChildren();
                segments.forEach(segment => {
                    if (segment.type === "removed") return;
                    const element = segment.type === "equal"
                        ? document.createTextNode(segment.text)
                        : document.createElement("mark");
                    if (element.nodeType === Node.ELEMENT_NODE) {
                        element.className = "localprompt-workflow-diff-added";
                        element.textContent = segment.text;
                    }
                    highlightLayer.appendChild(element);
                });
                highlightLayer.appendChild(document.createTextNode("\n"));
            };

            const renderOriginalSegments = (segments) => {
                originalTextReference.replaceChildren();
                if (!getCardText()) {
                    originalTextReference.textContent = "This card has no prompt text.";
                    return;
                }
                segments.forEach(segment => {
                    if (segment.type === "added") return;
                    const element = segment.type === "removed"
                        ? document.createElement("mark")
                        : document.createTextNode(segment.text);
                    if (element.nodeType === Node.ELEMENT_NODE) {
                        element.className = "localprompt-workflow-diff-removed";
                        element.textContent = segment.text;
                    }
                    originalTextReference.appendChild(element);
                });
            };

            const updateDiff = () => {
                const segments = buildPromptTextDiff(getCardText(), textArea.value);
                const hasAdded = segments.some(segment => segment.type === "added");
                const hasRemoved = segments.some(segment => segment.type === "removed");
                const hasChanges = hasAdded || hasRemoved;
                if (hasAdded && hasRemoved) {
                    diffStatus.textContent = "Changed text highlighted";
                } else if (hasAdded) {
                    diffStatus.textContent = "Added text highlighted";
                } else if (hasRemoved) {
                    diffStatus.textContent = "Text removed from card";
                } else {
                    diffStatus.textContent = "Matches card";
                }
                diffStatus.classList.toggle("has-changes", hasChanges);
                renderHighlightSegments(segments);
                renderOriginalSegments(segments);
            };

            const updateStatus = () => {
                const dirty = textArea.value !== initialValue;
                status.textContent = dirty ? "Ready to confirm" : "No changes";
                count.textContent = `${textArea.value.length} character${textArea.value.length === 1 ? "" : "s"}`;
                updateDiff();
            };

            const closeEditor = ({ restoreFocus = true } = {}) => {
                if (closed) return;
                closed = true;
                document.removeEventListener("keydown", handleKeydown, true);
                overlay.remove();
                document.body.style.overflow = previousBodyOverflow;
                if (restoreFocus && editButton.isConnected) editButton.focus();
            };

            const confirmEditor = () => {
                saveOverride(textArea.value);
                closeEditor();
            };

            const handleKeydown = (event) => {
                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeEditor();
                    return;
                }
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    event.stopPropagation();
                    confirmEditor();
                    return;
                }
                if (event.key !== "Tab") return;

                const focusable = Array.from(editor.querySelectorAll(
                    "button:not([disabled]):not([hidden]), textarea:not([disabled])"
                ));
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            };

            overlay.__localpromptClose = closeEditor;
            overlay.addEventListener("click", (event) => {
                const action = event.target.closest("[data-workflow-editor-action]")?.dataset.workflowEditorAction;
                if (action === "cancel") closeEditor();
                if (action === "confirm") confirmEditor();
                if (action === "revert") {
                    textArea.value = getCardText();
                    textArea.focus();
                    updateStatus();
                }
            });
            textArea.addEventListener("input", updateStatus);
            textArea.addEventListener("scroll", () => {
                highlightLayer.scrollTop = textArea.scrollTop;
                highlightLayer.scrollLeft = textArea.scrollLeft;
            });
            document.addEventListener("keydown", handleKeydown, true);
            document.body.style.overflow = "hidden";
            document.body.appendChild(overlay);
            updateStatus();
            requestAnimationFrame(() => {
                textArea.focus();
                textArea.setSelectionRange(textArea.value.length, textArea.value.length);
            });
        };

        editButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            openWorkflowEditor();
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
            const previewMediaHtml = buildPromptPreviewMediaHtml(prompt);
            const previewHtml = previewMediaHtml || `
                    <div class="managed-thumb-placeholder">
                        <div class="managed-placeholder-icon">#</div>
                        ${safeCategory ? `<div class="managed-placeholder-category">${safeCategory}</div>` : ""}
                        <div class="managed-placeholder-name">${safeName}</div>
                    </div>
                `;
            chip = document.createElement("div");
            chip.className = `localprompt-chip-thumb selected pinned-managed${previewMediaHtml ? "" : " no-thumb"}`;
            chip.innerHTML = `
                ${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })}
                <div class="managed-thumb-media" tabindex="-1">
                    ${previewHtml}
                    <span class="thumb-label">${safeName}</span>
                </div>
                ${createPinnedManagedControlsHtml(selectedEntry)}
            `;
            const chipMedia = chip.querySelector("img, video");
            if (chipMedia) chipMedia.draggable = false;
        } else {
            const safeName = escapeHtml(prompt.name || "");
            const safeCategory = escapeHtml(prompt.category || "");
            const { weight, isOn } = getManagedPromptState(selectedEntry);
            const formattedWeight = formatWeight(weight);
            const previewHtml = buildPromptPreviewMediaHtml(prompt)
                || `<div class="localprompt-active-row-thumb-placeholder">${safeCategory || "#"}</div>`;
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
            const rowMedia = chip.querySelector("img, video");
            if (rowMedia) rowMedia.draggable = false;
        }

        bindPromptPreviewVideo(chip);
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
