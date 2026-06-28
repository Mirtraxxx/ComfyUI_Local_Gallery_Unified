import {
    createManagedTextControlsHtml,
    createPinnedManagedControlsHtml,
    createPromptActionButton,
} from "./helpers.js?v=unified-icons-20260606";

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
    return ["most_used", "pinned"];
}

export function isUtilityLibraryTab(tabName) {
    return getUtilityLibraryTabs().includes(tabName);
}

export function applyLibraryTabLayoutPreference({ widgetContainer, uniqueId, layoutMode }) {
    const barContainer = widgetContainer.querySelector(".localprompt-library-bar-container");
    const tabStrip = widgetContainer.querySelector(".localprompt-library-tab-strip");
    const tabsScroll = widgetContainer.querySelector(`#${uniqueId}-library-tabs`);
    const isWrapMode = layoutMode === "wrap";
    if (barContainer) barContainer.classList.toggle("wrap-mode", isWrapMode);
    if (tabStrip) tabStrip.classList.toggle("wrap-mode", isWrapMode);
    if (tabsScroll) tabsScroll.classList.toggle("wrap-mode", isWrapMode);
}

export async function renderPromptBuilderBar({
    widgetContainer,
    uniqueId,
    getLibraryTabs,
    getActiveLibraryTab,
    setActiveLibraryTab,
    saveLibraryTabs,
    applyLibraryTabLayoutPreference,
    applyLibraryTabRoleStyling,
    clearLibraryNavActiveState,
    renderLibraryDrawer,
    syncSelectedSectionVisibility,
    rerenderLibraryBar,
    uiPrefs,
}) {
    const tabsContainer = widgetContainer.querySelector(`#${uniqueId}-library-tabs`);
    const utilityContainer = widgetContainer.querySelector(`#${uniqueId}-utility-tabs`);
    if (!tabsContainer || !utilityContainer) return;

    const utilityTabs = [];
    if (uiPrefs?.show_most_used !== false) {
        utilityTabs.push("most_used");
    }
    const categoryTabs = getLibraryTabs();
    let draggedLibraryTab = null;

    tabsContainer.innerHTML = "";
    utilityContainer.innerHTML = "";
    applyLibraryTabLayoutPreference();

    const renderTabButton = (tabContent, targetContainer, role = "category") => {
        const tabBtn = document.createElement("button");
        const isActive = getActiveLibraryTab() === tabContent;
        tabBtn.className = `localprompt-library-tab${role === "utility" ? " localprompt-utility-tab" : ""}${isActive ? " active" : ""}`;
        if (tabContent === "most_used") {
            tabBtn.innerHTML = "&#128293;";
            tabBtn.title = "Most Used";
        } else if (tabContent === "pinned") {
            tabBtn.innerHTML = "&#11088;";
            tabBtn.title = "Favorites";
        } else {
            tabBtn.innerHTML = tabContent;
        }
        if (!isUtilityLibraryTab(tabContent)) {
            applyLibraryTabRoleStyling(tabBtn, tabContent, isActive);
            tabBtn.draggable = true;
            tabBtn.style.cursor = "grab";
        }

        tabBtn.addEventListener("click", async () => {
            const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
            if (getActiveLibraryTab() === tabContent) {
                setActiveLibraryTab(null);
                clearLibraryNavActiveState();
                drawer.classList.remove("active");
            } else {
                setActiveLibraryTab(tabContent);
                clearLibraryNavActiveState();
                tabBtn.classList.add("active");
                drawer.classList.add("active");
                await renderLibraryDrawer(tabContent);
            }
            syncSelectedSectionVisibility();
        });

        tabBtn.addEventListener("contextmenu", async (event) => {
            event.preventDefault();
            if (isUtilityLibraryTab(tabContent)) {
                alert("Cannot remove default tabs.");
                return;
            }
            if (confirm(`Remove "${tabContent}" from library bar?`)) {
                await saveLibraryTabs(getLibraryTabs().filter(tab => tab !== tabContent));
                if (getActiveLibraryTab() === tabContent) {
                    setActiveLibraryTab(null);
                    widgetContainer.querySelector(`#${uniqueId}-library-drawer`).classList.remove("active");
                }
                syncSelectedSectionVisibility();
                rerenderLibraryBar();
            }
        });

        if (!isUtilityLibraryTab(tabContent)) {
            tabBtn.addEventListener("dragstart", (event) => {
                draggedLibraryTab = tabContent;
                tabBtn.style.opacity = "0.45";
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", tabContent);
                }
            });
            tabBtn.addEventListener("dragover", (event) => {
                if (!draggedLibraryTab || draggedLibraryTab === tabContent) return;
                event.preventDefault();
                tabBtn.style.boxShadow = "inset 0 0 0 2px rgba(255,255,255,0.28)";
            });
            tabBtn.addEventListener("dragleave", () => {
                tabBtn.style.boxShadow = "";
                applyLibraryTabRoleStyling(tabBtn, tabContent, getActiveLibraryTab() === tabContent);
            });
            tabBtn.addEventListener("drop", async (event) => {
                if (!draggedLibraryTab || draggedLibraryTab === tabContent) return;
                event.preventDefault();
                const currentTabs = getLibraryTabs();
                const fromIndex = currentTabs.indexOf(draggedLibraryTab);
                const toIndex = currentTabs.indexOf(tabContent);
                if (fromIndex < 0 || toIndex < 0) return;
                const reorderedTabs = [...currentTabs];
                const [movedTab] = reorderedTabs.splice(fromIndex, 1);
                reorderedTabs.splice(toIndex, 0, movedTab);
                await saveLibraryTabs(reorderedTabs);
                draggedLibraryTab = null;
                rerenderLibraryBar();
                const activeLibraryTab = getActiveLibraryTab();
                if (activeLibraryTab) await renderLibraryDrawer(activeLibraryTab);
            });
            tabBtn.addEventListener("dragend", () => {
                draggedLibraryTab = null;
                tabBtn.style.opacity = "";
                tabBtn.style.boxShadow = "";
                applyLibraryTabRoleStyling(tabBtn, tabContent, getActiveLibraryTab() === tabContent);
            });
        }

        targetContainer.appendChild(tabBtn);
    };

    utilityTabs.forEach(tabContent => renderTabButton(tabContent, utilityContainer, "utility"));
    categoryTabs.forEach(tabContent => renderTabButton(tabContent, tabsContainer, "category"));
}

export const renderLibraryBar = renderPromptBuilderBar;

export async function getLibraryDrawerPrompts({
    galleryNode,
    tabName,
    maxCount,
    sortMode = "manual",
}) {
    if (tabName === "most_used") {
        return await galleryNode.getMostUsed(maxCount);
    }
    if (tabName === "pinned") {
        const data = await galleryNode.getPrompts("", "OR", 1, [], "", true, maxCount, sortMode);
        return data.prompts || [];
    }

    const data = await galleryNode.getPrompts("", "OR", 1, [], tabName, false, 200, sortMode);
    const categoryPrompts = data.prompts || [];
    if (sortMode === "manual") {
        categoryPrompts.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
    }
    return categoryPrompts;
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
    clearAllSelections,
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

    const maxCount = nodeInstance.uiPrefs.most_used_count || 10;
    let prompts = await getLibraryDrawerPrompts({
        galleryNode,
        tabName,
        maxCount,
        sortMode,
    });
    if (!isRenderCurrent()) return;
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
        const emptyState = document.createElement("span");
        emptyState.style.fontSize = "11px";
        emptyState.style.color = "#555";
        emptyState.style.padding = "4px";
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
        && tabName !== "most_used"
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

    let draggedPinnedId = null;
    let dragReordered = false;
    let selectedPointerDrag = null;

    const getSelectedBuilderCards = () => getPromptBuilderCards().filter(card => card.classList.contains("selected"));

    const getSelectedSwapTarget = (dragState, clientX, clientY) => {
        const cards = getSelectedBuilderCards().filter(card => card !== dragState.chip);
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

        const directTarget = cards.find(card => {
            const rect = card.getBoundingClientRect();
            return dragCenterX >= rect.left && dragCenterX <= rect.right && dragCenterY >= rect.top && dragCenterY <= rect.bottom;
        });
        if (directTarget) return directTarget;

        return cards.reduce((nearest, card) => {
            const rect = card.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(dragCenterX - centerX, dragCenterY - centerY);
            if (!nearest || distance < nearest.distance) return { card, distance };
            return nearest;
        }, null)?.card || null;
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

        if (displayMode === "thumbnails" && prompt.preview_url) {
            chip = document.createElement("div");
            chip.className = `localprompt-chip-thumb ${isSelected ? "selected" : ""}`;

            let content = "";
            if (tabName !== "most_used" && (tabName !== "pinned" || !isSelected)) {
                const pinFilter = isGlobalPinned ? "none" : "grayscale(100%) opacity(0.3)";
                content += createPromptActionButton({ icon: "star", className: `chip-pin-btn ${isGlobalPinned ? "favorited" : ""}`, title: "Pin/Unpin", extraAttrs: `style="filter: ${pinFilter};"`, pressed: !!isGlobalPinned });
            }

            if (isSelected && selectedEntry) {
                chip.classList.add("pinned-managed");
                content += `
                    ${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })}
                    <div class="managed-thumb-media">
                        <img src="${prompt.preview_url}" alt="${prompt.name}" loading="lazy" decoding="async">
                    </div>
                    ${createPinnedManagedControlsHtml(selectedEntry)}
                    <span class="thumb-label">${prompt.name}</span>
                `;
            } else {
                content += `
                    ${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })}
                    <img src="${prompt.preview_url}" alt="${prompt.name}" loading="lazy" decoding="async">
                    <span class="thumb-label">${prompt.name}</span>
                `;
            }
            chip.innerHTML = content;
            const chipImage = chip.querySelector("img");
            if (chipImage) chipImage.draggable = false;
            applyCategoryRoleStyling(chip, prompt, { soften: isSelected });
            chip.removeAttribute("title");
        } else {
            chip = document.createElement("div");
            chip.className = `localprompt-chip ${isSelected ? "selected" : ""}`;

            let content = "";
            if (tabName !== "most_used" && (tabName !== "pinned" || !isSelected)) {
                const pinFilter = isGlobalPinned ? "none" : "grayscale(100%) opacity(0.3)";
                content += createPromptActionButton({ icon: "star", className: `chip-pin-btn ${isGlobalPinned ? "favorited" : ""}`, title: "Pin/Unpin", extraAttrs: `style="filter: ${pinFilter};"`, pressed: !!isGlobalPinned });
            }

            if (isSelected && selectedEntry) {
                chip.classList.add("pinned-managed");
                content += `
                    <div class="managed-card-name" title="${prompt.name}">${prompt.name}</div>
                    ${createManagedTextControlsHtml(selectedEntry)}
                `;
            } else {
                content += `${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })} ${prompt.name}`;
            }
            if (tabName === "most_used" || (prompt.usage_count > 0 && tabName !== "pinned")) {
                content += ` <span class="usage-count">x${prompt.usage_count || 0}</span>`;
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
                }
                rerenderLibraryDrawer(tabName);
            });
        }

        if (tabName === "pinned" && !isSelected) {
            chip.classList.add("pinned-draggable");
            chip.draggable = true;
            chip.dataset.promptId = promptId;
            chip.addEventListener("dragstart", (event) => {
                event.stopPropagation();
                draggedPinnedId = promptId;
                dragReordered = false;
                chip.classList.add("pinned-dragging");
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("application/x-localpromptgallery-pinned", promptId);
                }
            });
            chip.addEventListener("dragover", (event) => {
                if (!draggedPinnedId || draggedPinnedId === promptId) return;
                event.preventDefault();
                event.stopPropagation();
                chip.classList.add("pinned-drop-target");
                if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
            });
            chip.addEventListener("dragleave", () => {
                chip.classList.remove("pinned-drop-target");
            });
            chip.addEventListener("drop", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                chip.classList.remove("pinned-drop-target");
                if (!draggedPinnedId || draggedPinnedId === promptId) return;

                const nextOrder = visibleUnselectedPinnedIds.filter(id => id !== draggedPinnedId);
                const targetIndex = nextOrder.indexOf(promptId);
                nextOrder.splice(targetIndex, 0, draggedPinnedId);
                const hiddenPinnedIds = getPinnedOrder().filter(id => !visibleUnselectedPinnedIds.includes(id) && id !== draggedPinnedId);

                dragReordered = true;
                await persistPinnedOrder([...nextOrder, ...hiddenPinnedIds]);
                await rerenderLibraryDrawer(tabName);
            });
            chip.addEventListener("dragend", () => {
                chip.classList.remove("pinned-dragging", "pinned-drop-target");
                draggedPinnedId = null;
                if (dragReordered) {
                    nodeInstance._suppressPinnedClickUntil = Date.now() + 150;
                }
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
    container.replaceChildren(nextContent);
    container.dataset.renderedTab = tabName;
    container.dataset.renderedSortMode = sortMode;

    if (canPointerReorderManualCards || selectedIdStrings.size > 0) {
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
                }

                event.preventDefault();
                event.stopPropagation();
                updateSelectedPointerTarget(event);
                return;
            }

            if (!pointerManualDrag) return;
            const distance = Math.hypot(event.clientX - pointerManualDrag.startX, event.clientY - pointerManualDrag.startY);
            if (!pointerManualDrag.active && distance < 8) return;

            if (!pointerManualDrag.active) {
                pointerManualDrag.active = true;
                pointerManualDrag.chip.classList.add("pinned-dragging");
                suppressManualClickUntil = Date.now() + 200;
            }

            event.preventDefault();
            event.stopPropagation();
            const targetCard = getPromptBuilderCardAtPoint(event.clientX, event.clientY);
            if (targetCard && targetCard !== pointerManualDrag.chip) {
                setManualDropTarget(targetCard);
            } else {
                setManualDropTarget(null);
            }
        };

        const onPointerUp = async event => {
            if (selectedPointerDrag) {
                if (event.pointerId !== selectedPointerDrag.pointerId) return;
                const dragState = selectedPointerDrag;
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

            if (!pointerManualDrag) return;
            const dragState = pointerManualDrag;
            pointerManualDrag = null;

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
            if (pointerManualDrag) {
                pointerManualDrag.chip.classList.remove("pinned-dragging");
                pointerManualDrag.chip.releasePointerCapture?.(pointerManualDrag.pointerId);
                pointerManualDrag = null;
            }
            clearManualDropTargets();
        };

        container.__localpromptBuilderManualOrderCleanup?.();
        container.__localpromptBuilderManualOrderCleanup = () => {
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
