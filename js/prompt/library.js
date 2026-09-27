import {
    bindPromptPreviewVideo,
    buildPromptPreviewMediaHtml,
    createManagedTextControlsHtml,
    createPinnedManagedControlsHtml,
    createPromptActionButton,
} from "./helpers.js";
import { escapeHtml } from "../shared/dom.js";

// Product term: Prompt Builder. Historical code names still use "library"
// for DOM ids, CSS classes, and compatibility exports.

function getPromptCreatedAtValue(prompt) {
    const rawValue = prompt?.created_at || prompt?.date_added || prompt?.createdAt;
    if (typeof rawValue === "number") return rawValue;
    if (typeof rawValue === "string" && rawValue.trim()) {
        const numericValue = Number(rawValue);
        if (Number.isFinite(numericValue)) return numericValue;
        const parsedDate = Date.parse(rawValue);
        if (Number.isFinite(parsedDate)) return parsedDate;
    }
    return 0;
}

function sortPromptsForDisplay(prompts, sortMode = "manual") {
    const mode = String(sortMode || "manual");
    const sorted = [...prompts];
    if (mode === "az") {
        sorted.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base" }));
    } else if (mode === "za") {
        sorted.sort((a, b) => String(b?.name || "").localeCompare(String(a?.name || ""), undefined, { sensitivity: "base" }));
    } else if (mode === "newest") {
        sorted.sort((a, b) => (getPromptCreatedAtValue(b) - getPromptCreatedAtValue(a)) || String(b?.id || "").localeCompare(String(a?.id || "")));
    } else if (mode === "oldest") {
        sorted.sort((a, b) => (getPromptCreatedAtValue(a) - getPromptCreatedAtValue(b)) || String(a?.id || "").localeCompare(String(b?.id || "")));
    }
    return sorted;
}

function sortPromptsByManualOrder(prompts, manualOrder = []) {
    if (!Array.isArray(manualOrder) || !manualOrder.length) return prompts;
    const orderMap = new Map(manualOrder.map((id, index) => [String(id), index]));
    return [...prompts].sort((a, b) => {
        const aIndex = orderMap.has(String(a.id)) ? orderMap.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
        const bIndex = orderMap.has(String(b.id)) ? orderMap.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
        if (aIndex !== bIndex) return aIndex - bIndex;
        return 0;
    });
}

export function getUtilityLibraryTabs() {
    return ["pinned"];
}

export async function getLibraryDrawerPrompts({
    galleryNode,
    tabName,
    maxCount,
    sortMode = "manual",
}) {
    if (tabName === "pinned") {
        const data = await galleryNode.getPrompts("", "OR", 1, [], "", true, maxCount, sortMode);
        return data.prompts || [];
    }

    const data = await galleryNode.getPrompts("", "OR", 1, [], tabName, false, 200, sortMode);
    return data.prompts || [];
}

export async function renderPromptBuilderDrawer({
    widgetContainer,
    uniqueId,
    tabName,
    nodeInstance,
    galleryNode,
    hideHoverPreview,
    getSelectedPromptIdsInOrder,
    getSelectedPromptEntry,
    applyCategoryRoleStyling,
    sortPinnedPrompts,
    promoteSelectedPrompts,
    toggleFavorite,
    syncPinnedOrderForFavorite,
    getPinnedOrder,
    persistPinnedOrder,
    saveSelectionData,
    renderPrompts,
    getActiveLibraryTab,
    rerenderLibraryDrawer,
    bindPinnedManagedControls,
    addPromptToSelection,
    attachInfoPopup,
    attachContextMenu,
    getSortMode = () => "manual",
    setSortMode = null,
    getManualOrder = () => [],
    persistManualOrder = null,
    getDisplayMode = () => nodeInstance.uiPrefs?.cards_display_mode || nodeInstance.uiPrefs?.display_mode || "thumbnails",
    getCachedPrompts = null,
    onPromptsLoaded = null,
    invalidatePrompts = null,
    isRenderCurrent = () => true,
}) {
    const container = widgetContainer.querySelector(`#${uniqueId}-library-chips`);
    if (!container) return;
    container.__localpromptBuilderManualOrderCleanup?.();
    container.__localpromptBuilderManualOrderCleanup = null;
    hideHoverPreview();
    const previousTabName = container.dataset.renderedTab || "";
    const previousSortMode = container.dataset.renderedSortMode || "";
    const sortMode = getSortMode();
    const shouldRestoreScroll = previousTabName === tabName;
    const shouldKeepScroll = shouldRestoreScroll && previousSortMode === sortMode;
    const shouldPreserveCurrentOrder = shouldKeepScroll;
    const previousPromptOrder = shouldPreserveCurrentOrder
        ? Array.from(container.querySelectorAll(".localprompt-chip[data-prompt-id], .localprompt-chip-thumb[data-prompt-id]"))
            .map(card => String(card.dataset.promptId || ""))
            .filter(Boolean)
        : [];
    const previousScrollTop = shouldKeepScroll ? container.scrollTop : 0;

    if (tabName === "pinned") {
        container.ondragover = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        };
        container.ondrop = (event) => {
            event.preventDefault();
            event.stopPropagation();
        };
    } else {
        container.ondragover = null;
        container.ondrop = null;
    }

    const maxCount = 200;
    const loadPrompts = () => getLibraryDrawerPrompts({
        galleryNode,
        tabName,
        maxCount,
        sortMode,
    });
    let prompts = typeof getCachedPrompts === "function"
        ? await getCachedPrompts({ tabName, maxCount, sortMode, load: loadPrompts })
        : await loadPrompts();
    if (!isRenderCurrent()) return;
    onPromptsLoaded?.(prompts);
    prompts = sortPromptsForDisplay(prompts, sortMode);
    if (sortMode === "manual") {
        prompts = sortPromptsByManualOrder(prompts, getManualOrder(tabName));
    }
    if (previousPromptOrder.length) {
        prompts = sortPromptsByManualOrder(prompts, previousPromptOrder);
    }
    if (!isRenderCurrent()) return;

    const nextContent = document.createDocumentFragment();

    const selectedIds = new Set(getSelectedPromptIdsInOrder().map(id => String(id)));
    const selectedIdStrings = selectedIds;
    const displayMode = getDisplayMode() === "compact" ? "compact" : "thumbnails";

    if (tabName === "pinned") {
        prompts = sortPinnedPrompts(prompts);
    } else {
        prompts = promoteSelectedPrompts(prompts);
    }

    if (prompts.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "lg-empty";
        emptyState.textContent = "No prompts found here.";
        nextContent.appendChild(emptyState);
        if (!isRenderCurrent()) return;
        container.replaceChildren(nextContent);
        container.dataset.renderedTab = tabName;
        container.dataset.renderedSortMode = sortMode;
        if (shouldRestoreScroll) {
            requestAnimationFrame(() => {
                container.scrollTop = previousScrollTop;
            });
        }
        return;
    }

    const canPointerReorderManualCards = (
        typeof persistManualOrder === "function"
        && tabName !== "pinned"
    );
    const manualOrderScope = tabName;
    let pointerManualDrag = null;
    let suppressManualClickUntil = 0;
    let lastManualDropTarget = null;

    const getPromptBuilderCards = () => Array.from(
        container.querySelectorAll(".localprompt-chip[data-prompt-id], .localprompt-chip-thumb[data-prompt-id]")
    );
    const clearManualDropTargets = () => {
        lastManualDropTarget?.classList.remove("pinned-drop-target");
        container.querySelector(".pinned-drop-target")?.classList.remove("pinned-drop-target");
        lastManualDropTarget = null;
    };
    const setManualDropTarget = targetCard => {
        if (lastManualDropTarget === targetCard) return;
        lastManualDropTarget?.classList.remove("pinned-drop-target");
        lastManualDropTarget = targetCard || null;
        lastManualDropTarget?.classList.add("pinned-drop-target");
    };
    const getPromptBuilderCardAtPoint = (clientX, clientY) => {
        const element = document.elementFromPoint(clientX, clientY);
        const card = element?.closest?.(".localprompt-chip[data-prompt-id], .localprompt-chip-thumb[data-prompt-id]");
        return card && container.contains(card) ? card : null;
    };

    let pinnedPointerDrag = null;
    let selectedPointerDrag = null;
    let pointerMoveFrame = null;
    let pendingPointerMove = null;

    const getSelectedBuilderCards = () => getPromptBuilderCards().filter(card => card.classList.contains("selected"));

    const getSelectedSwapTarget = (dragState, clientX, clientY) => {
        const cards = dragState.cardGeometry || getSelectedBuilderCards()
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

        // Swap only when the pointer is directly over a card; a release over
        // a gap cancels the reorder instead of grabbing the nearest card.
        const directTarget = cards.find(({ rect }) => {
            return dragCenterX >= rect.left && dragCenterX <= rect.right && dragCenterY >= rect.top && dragCenterY <= rect.bottom;
        });
        return directTarget ? directTarget.card : null;
    };

    const swapSelectedPromptOrder = (fromPromptId, toPromptId) => {
        if (!fromPromptId || !toPromptId || String(fromPromptId) === String(toPromptId)) return false;
        const nextOrder = [...nodeInstance.promptData];
        const fromIndex = nextOrder.findIndex(item => String(item.prompt_id) === String(fromPromptId));
        const toIndex = nextOrder.findIndex(item => String(item.prompt_id) === String(toPromptId));
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false;
        [nextOrder[fromIndex], nextOrder[toIndex]] = [nextOrder[toIndex], nextOrder[fromIndex]];
        nodeInstance.promptData = nextOrder;
        saveSelectionData();
        renderPrompts();
        const activeLibraryTab = getActiveLibraryTab();
        if (activeLibraryTab) rerenderLibraryDrawer(activeLibraryTab);
        return true;
    };
    const visibleUnselectedPinnedIds = tabName === "pinned"
        ? prompts.filter(prompt => !selectedIdStrings.has(String(prompt.id))).map(prompt => String(prompt.id))
        : [];

    prompts.forEach(prompt => {
        const isSelected = selectedIds.has(String(prompt.id));
        const promptId = String(prompt.id);
        let chip;
        const isGlobalPinned = prompt.favorite;
        const selectedEntry = isSelected ? getSelectedPromptEntry(prompt.id) : null;
        const safeName = escapeHtml(prompt.name || "");
        const previewMediaHtml = buildPromptPreviewMediaHtml(prompt);

        if (displayMode === "thumbnails" && previewMediaHtml) {
            chip = document.createElement("div");
            chip.className = `localprompt-chip-thumb ${isSelected ? "selected" : ""}`;

            let content = "";
            if (tabName !== "pinned" || !isSelected) {
                const pinFilter = isGlobalPinned ? "none" : "grayscale(100%) opacity(0.3)";
                content += createPromptActionButton({ icon: "star", className: `chip-pin-btn ${isGlobalPinned ? "favorited" : ""}`, title: "Pin/Unpin", extraAttrs: `style="filter: ${pinFilter};"`, pressed: !!isGlobalPinned });
            }

            if (isSelected && selectedEntry) {
                chip.classList.add("pinned-managed");
                content += `
                    ${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })}
                    <div class="managed-thumb-media">
                        ${previewMediaHtml}
                    </div>
                    ${createPinnedManagedControlsHtml(selectedEntry)}
                    <span class="thumb-label">${safeName}</span>
                `;
            } else {
                content += `
                    ${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })}
                    ${previewMediaHtml}
                    <span class="thumb-label">${safeName}</span>
                `;
            }
            chip.innerHTML = content;
            const chipMedia = chip.querySelector("img, video");
            if (chipMedia) chipMedia.draggable = false;
            bindPromptPreviewVideo(chip);
            applyCategoryRoleStyling(chip, prompt, { soften: isSelected });
            chip.removeAttribute("title");
        } else {
            chip = document.createElement("div");
            chip.className = `localprompt-chip ${isSelected ? "selected" : ""}`;

            let content = "";
            if (tabName !== "pinned" || !isSelected) {
                const pinFilter = isGlobalPinned ? "none" : "grayscale(100%) opacity(0.3)";
                content += createPromptActionButton({ icon: "star", className: `chip-pin-btn ${isGlobalPinned ? "favorited" : ""}`, title: "Pin/Unpin", extraAttrs: `style="filter: ${pinFilter};"`, pressed: !!isGlobalPinned });
            }

            if (isSelected && selectedEntry) {
                chip.classList.add("pinned-managed");
                content += `
                    <div class="managed-card-name" title="${safeName}">${safeName}</div>
                    ${createManagedTextControlsHtml(selectedEntry)}
                `;
            } else {
                content += `${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })} <span class="localprompt-chip-label">${safeName}</span>`;
            }
            chip.innerHTML = content;
            applyCategoryRoleStyling(chip, prompt, { soften: isSelected });
            chip.removeAttribute("title");
        }
        chip.dataset.promptId = promptId;

        const pinBtn = chip.querySelector(".chip-pin-btn");
        if (pinBtn) {
            pinBtn.addEventListener("click", async (event) => {
                event.stopPropagation();
                const result = await toggleFavorite(prompt.id);
                if (result?.status === "ok") {
                    await syncPinnedOrderForFavorite(prompt.id, result.favorite);
                    invalidatePrompts?.([prompt.id]);
                }
                rerenderLibraryDrawer(tabName);
            });
        }

        if (tabName === "pinned" && !isSelected) {
            chip.classList.add("pinned-draggable");
            chip.addEventListener("pointerdown", event => {
                if (event.button !== 0) return;
                if (event.target.closest("button, input, select, textarea, [contenteditable='true']")) return;
                event.stopPropagation();
                pinnedPointerDrag = {
                    chip,
                    promptId,
                    startX: event.clientX,
                    startY: event.clientY,
                    active: false,
                    pointerId: event.pointerId,
                };
                chip.setPointerCapture?.(event.pointerId);
            });
        }

        if (isSelected) {
            chip.draggable = false;
            chip.addEventListener("pointerdown", event => {
                if (event.button !== 0) return;
                if (event.target.closest("[data-managed-action], .managed-weight-val, .localprompt-info-btn, button, input, select, textarea, a")) return;
                const rect = chip.getBoundingClientRect();
                selectedPointerDrag = {
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
                chip.setPointerCapture?.(event.pointerId);
            });
        }

        if (isSelected) {
            bindPinnedManagedControls(chip, prompt);
            chip.addEventListener("click", (event) => {
                if (suppressManualClickUntil > Date.now()) return;
                if (event.target.closest("[data-managed-action], .managed-weight-val")) return;
                const isNowSelected = addPromptToSelection(prompt);
                if (typeof isNowSelected === "boolean") chip.classList.toggle("selected", isNowSelected);
            });
        } else {
            chip.addEventListener("click", () => {
                if (suppressManualClickUntil > Date.now()) return;
                const isNowSelected = addPromptToSelection(prompt);
                if (typeof isNowSelected === "boolean") chip.classList.toggle("selected", isNowSelected);
            });
        }
        if (tabName === "pinned") {
            chip.addEventListener("click", (event) => {
                if ((nodeInstance._suppressPinnedClickUntil || 0) > Date.now()) {
                    event.stopImmediatePropagation();
                }
            }, true);
        }
        attachInfoPopup(chip, prompt);
        attachContextMenu(chip, prompt);

        if (canPointerReorderManualCards && !isSelected) {
            chip.classList.add("manual-order-draggable");
            chip.addEventListener("pointerdown", event => {
                if (event.button !== 0) return;
                if (event.target.closest("button, input, select, textarea, [contenteditable='true']")) return;
                event.stopPropagation();
                pointerManualDrag = {
                    chip,
                    promptId,
                    startX: event.clientX,
                    startY: event.clientY,
                    active: false,
                    pointerId: event.pointerId,
                };
                chip.setPointerCapture?.(event.pointerId);
            });
        }

        nextContent.appendChild(chip);
    });

    if (!isRenderCurrent()) return;
    if (displayMode === "thumbnails") {
        // Keep the scroll owner separate from the responsive grid so its
        // left-side scrollbar does not reverse the card's visual order.
        const promptBuilderGrid = document.createElement("div");
        promptBuilderGrid.className = "localprompt-prompt-builder-grid";
        promptBuilderGrid.appendChild(nextContent);
        container.replaceChildren(promptBuilderGrid);
    } else {
        container.replaceChildren(nextContent);
    }
    container.dataset.renderedTab = tabName;
    container.dataset.renderedSortMode = sortMode;

    if (canPointerReorderManualCards || selectedIdStrings.size > 0 || (tabName === "pinned" && visibleUnselectedPinnedIds.length > 0)) {
        const updateSelectedPointerTarget = event => {
            clearManualDropTargets();
            const targetCard = getSelectedSwapTarget(selectedPointerDrag, event.clientX, event.clientY);
            if (targetCard) {
                targetCard.classList.add("pinned-drop-target");
                selectedPointerDrag.lastTarget = targetCard;
            }
            return targetCard;
        };

        const clearSelectedPointerDrag = () => {
            if (!selectedPointerDrag) return;
            selectedPointerDrag.chip.classList.remove("pinned-dragging");
            selectedPointerDrag.chip.releasePointerCapture?.(selectedPointerDrag.pointerId);
            selectedPointerDrag = null;
            clearManualDropTargets();
        };

        const onPointerMove = event => {
            if (selectedPointerDrag) {
                if (event.pointerId !== selectedPointerDrag.pointerId) return;
                const distance = Math.hypot(event.clientX - selectedPointerDrag.startX, event.clientY - selectedPointerDrag.startY);
                if (!selectedPointerDrag.active && distance < 6) return;

                if (!selectedPointerDrag.active) {
                    selectedPointerDrag.active = true;
                    selectedPointerDrag.chip.classList.add("pinned-dragging");
                    suppressManualClickUntil = Date.now() + 200;
                    selectedPointerDrag.cardGeometry = getSelectedBuilderCards()
                        .filter(card => card !== selectedPointerDrag.chip)
                        .map(card => ({ card, rect: card.getBoundingClientRect() }));
                }

                event.preventDefault();
                event.stopPropagation();
                pendingPointerMove = event;
                if (!pointerMoveFrame) {
                    pointerMoveFrame = requestAnimationFrame(() => {
                        pointerMoveFrame = null;
                        if (pendingPointerMove && selectedPointerDrag) {
                            updateSelectedPointerTarget(pendingPointerMove);
                        }
                        pendingPointerMove = null;
                    });
                }
                return;
            }

            const cardDrag = pointerManualDrag || pinnedPointerDrag;
            if (!cardDrag) return;
            const distance = Math.hypot(event.clientX - cardDrag.startX, event.clientY - cardDrag.startY);
            if (!cardDrag.active && distance < 8) return;

            if (!cardDrag.active) {
                cardDrag.active = true;
                cardDrag.chip.classList.add("pinned-dragging");
                suppressManualClickUntil = Date.now() + 200;
                if (pinnedPointerDrag) nodeInstance._suppressPinnedClickUntil = Date.now() + 200;
            }

            event.preventDefault();
            event.stopPropagation();
            const targetCard = getPromptBuilderCardAtPoint(event.clientX, event.clientY);
            if (targetCard && targetCard !== cardDrag.chip) {
                setManualDropTarget(targetCard);
            } else {
                setManualDropTarget(null);
            }
        };

        const onPointerUp = async event => {
            if (selectedPointerDrag) {
                if (event.pointerId !== selectedPointerDrag.pointerId) return;
                const dragState = selectedPointerDrag;
                if (pointerMoveFrame) {
                    cancelAnimationFrame(pointerMoveFrame);
                    pointerMoveFrame = null;
                }
                const targetCard = updateSelectedPointerTarget(event) || dragState.lastTarget;
                clearSelectedPointerDrag();

                if (!dragState.active) return;
                event.preventDefault();
                event.stopPropagation();
                suppressManualClickUntil = Date.now() + 250;
                if (targetCard && targetCard !== dragState.chip) {
                    swapSelectedPromptOrder(dragState.promptId, targetCard.dataset.promptId);
                }
                return;
            }

            const dragState = pointerManualDrag || pinnedPointerDrag;
            if (!dragState) return;
            const isPinnedDrag = Boolean(pinnedPointerDrag);
            pointerManualDrag = null;
            pinnedPointerDrag = null;

            dragState.chip.classList.remove("pinned-dragging");
            dragState.chip.releasePointerCapture?.(dragState.pointerId);
            const targetCard = getPromptBuilderCardAtPoint(event.clientX, event.clientY)
                || lastManualDropTarget
                || container.querySelector(".pinned-drop-target");

            if (!dragState.active) return;
            event.preventDefault();
            event.stopPropagation();
            suppressManualClickUntil = Date.now() + 250;

            if (!targetCard || targetCard === dragState.chip) {
                clearManualDropTargets();
                return;
            }

            if (isPinnedDrag) {
                const nextOrder = visibleUnselectedPinnedIds.filter(id => id !== dragState.promptId);
                const targetIndex = nextOrder.indexOf(targetCard.dataset.promptId);
                nextOrder.splice(targetIndex, 0, dragState.promptId);
                const hiddenPinnedIds = getPinnedOrder().filter(id => !visibleUnselectedPinnedIds.includes(id) && id !== dragState.promptId);
                nodeInstance._suppressPinnedClickUntil = Date.now() + 250;
                await persistPinnedOrder([...nextOrder, ...hiddenPinnedIds]);
                await rerenderLibraryDrawer(tabName);
                return;
            }

            const placeholder = document.createElement("span");
            dragState.chip.replaceWith(placeholder);
            targetCard.replaceWith(dragState.chip);
            placeholder.replaceWith(targetCard);
            clearManualDropTargets();

            const nextOrder = getPromptBuilderCards()
                .map(card => card.dataset.promptId)
                .filter(Boolean);

            if (sortMode !== "manual" && typeof setSortMode === "function") {
                await setSortMode("manual", { scope: manualOrderScope, reload: false });
            }
            await persistManualOrder(manualOrderScope, nextOrder);
        };

        const onPointerCancel = () => {
            clearSelectedPointerDrag();
            if (pointerManualDrag || pinnedPointerDrag) {
                const dragState = pointerManualDrag || pinnedPointerDrag;
                dragState.chip.classList.remove("pinned-dragging");
                dragState.chip.releasePointerCapture?.(dragState.pointerId);
                pointerManualDrag = null;
                pinnedPointerDrag = null;
            }
            clearManualDropTargets();
        };

        container.__localpromptBuilderManualOrderCleanup?.();
        container.__localpromptBuilderManualOrderCleanup = () => {
            if (pointerMoveFrame) cancelAnimationFrame(pointerMoveFrame);
            pointerMoveFrame = null;
            pendingPointerMove = null;
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerCancel);
        };
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerCancel);
    } else {
        container.__localpromptBuilderManualOrderCleanup?.();
        container.__localpromptBuilderManualOrderCleanup = null;
    }

    if (shouldRestoreScroll) {
        requestAnimationFrame(() => {
            container.scrollTop = previousScrollTop;
        });
    }
}

export const renderLibraryDrawer = renderPromptBuilderDrawer;
