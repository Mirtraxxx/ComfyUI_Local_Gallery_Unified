/**
 * Prompt Builder category strip/overflow controller.
 *
 * Category pills own their pointer/long-press timers, and async category
 * fetches are generation-guarded so a late response cannot repaint a newer strip.
 */
import { fitPillStrip, makePill, observePillStrip, renderPillOverflow } from "../shared/pillStrip.js";

export function createPromptCategoryStripController({
    widgetContainer,
    uniqueId,
    getCachedCategories,
    ensurePinnedCategoriesInitialized,
    getCategoriesInCurrentOrder,
    getActiveLibraryTab,
    setActiveLibraryTab,
    setCategoryOverflowOpen,
    getPinnedCategories,
    savePinnedCategories,
    saveCategoryOrder,
    showCategoryPillContextMenu,
    setWorkspaceMode,
    getWorkspaceMode,
    renderLibraryDrawer,
    clearLibraryNavActiveState,
    syncPromptSortControls,
    syncSelectedSectionVisibility,
    closeToolbarPanels,
    getCategoryRoleColor,
}) {
    let renderGeneration = 0;
    let openGeneration = 0;
    const searchState = { query: "" };
    const longPressTimers = new Set();
    let disposed = false;
    const strip = widgetContainer.querySelector(`#${uniqueId}-pinned-category-strip`);
    const stripObserver = strip ? observePillStrip(strip) : null;
    let dragState = null;
    let dragTarget = null;
    let suppressClickUntil = 0;

    function isCurrent(generation) {
        return !disposed && generation === renderGeneration;
    }

    function clearLongPressTimers() {
        longPressTimers.forEach(timer => clearTimeout(timer));
        longPressTimers.clear();
    }

    function createCategoryPill(category, isPinned) {
        const pill = makePill({
            label: category,
            color: getCategoryRoleColor(category),
            active: getActiveLibraryTab() === category,
            pinned: isPinned,
        });
        pill.classList.add("localprompt-pinned-category-pill");
        pill.dataset.category = category;

        let longPressTimer = null;
        let startX = 0;
        let startY = 0;
        const clearLongPress = () => {
            if (longPressTimer) clearTimeout(longPressTimer);
            if (longPressTimer) longPressTimers.delete(longPressTimer);
            longPressTimer = null;
        };

        pill.addEventListener("click", event => {
            if (Date.now() < suppressClickUntil) {
                event.stopImmediatePropagation();
                return;
            }
            openCategoryFromMenu(category);
        });
        pill.addEventListener("contextmenu", event => {
            event.preventDefault();
            showCategoryPillContextMenu(event, category, isPinned);
        });
        pill.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            startX = event.clientX;
            startY = event.clientY;
            clearLongPress();
            longPressTimer = setTimeout(() => {
                longPressTimers.delete(longPressTimer);
                longPressTimer = null;
                suppressClickUntil = Date.now() + 250;
                showCategoryPillContextMenu(event, category, isPinned);
            }, 500);
            longPressTimers.add(longPressTimer);
            dragState = {
                pill,
                category,
                startX: event.clientX,
                startY: event.clientY,
                active: false,
                pointerId: event.pointerId,
            };
            pill.setPointerCapture?.(event.pointerId);
        });
        pill.addEventListener("pointermove", event => {
            if (longPressTimer && Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
                clearLongPress();
            }
        });
        pill.addEventListener("pointerup", clearLongPress);
        pill.addEventListener("pointercancel", clearLongPress);
        return pill;
    }

    function setDragTarget(element) {
        if (dragTarget === element) return;
        clearDragTargets();
        if (element) {
            element.classList.add("drag-over");
            dragTarget = element;
        }
    }

    function clearDragTargets() {
        widgetContainer.querySelectorAll(".localprompt-pinned-category-pill.drag-over").forEach(el => el.classList.remove("drag-over"));
        dragTarget = null;
    }

    function pillAtPoint(x, y) {
        return document.elementFromPoint(x, y)?.closest(".localprompt-pinned-category-pill");
    }

    function cancelDrag() {
        if (dragState) {
            dragState.pill.classList.remove("pinned-dragging");
            dragState.pill.releasePointerCapture?.(dragState.pointerId);
            dragState = null;
        }
        clearDragTargets();
    }

    function onPointerMove(event) {
        if (!dragState) return;
        const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
        if (!dragState.active && distance < 8) return;
        if (!dragState.active) {
            dragState.active = true;
            dragState.pill.classList.add("pinned-dragging");
            suppressClickUntil = Date.now() + 200;
        }
        event.preventDefault();
        event.stopPropagation();
        const targetPill = pillAtPoint(event.clientX, event.clientY);
        setDragTarget(targetPill && targetPill !== dragState.pill ? targetPill : null);
    }

    // Dropping on a pinned pill swaps or inserts into the pinned set; dropping on
    // an unpinned pill unpins the category and reorders the remaining tabs.
    async function onPointerUp(event) {
        if (!dragState) return;
        const drag = dragState;
        dragState = null;
        drag.pill.classList.remove("pinned-dragging");
        drag.pill.releasePointerCapture?.(drag.pointerId);
        if (!drag.active) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil = Date.now() + 250;

        const targetPill = pillAtPoint(event.clientX, event.clientY) || dragTarget;
        clearDragTargets();
        if (!targetPill || targetPill === drag.pill) return;

        const targetCategory = targetPill.dataset.category;
        const draggedCategory = drag.category;
        if (!targetCategory || !draggedCategory) return;

        const isTargetPinned = targetPill.dataset.pinned === "true" || strip?.contains(targetPill);
        const allCategories = await getCachedCategories();
        let pinned = getPinnedCategories(allCategories);
        const swapItems = (items, first, second) => {
            const firstIndex = items.indexOf(first);
            const secondIndex = items.indexOf(second);
            if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return false;
            [items[firstIndex], items[secondIndex]] = [items[secondIndex], items[firstIndex]];
            return true;
        };

        if (isTargetPinned) {
            if (!swapItems(pinned, draggedCategory, targetCategory)) {
                pinned = pinned.filter(c => c !== draggedCategory);
                const targetIndex = pinned.indexOf(targetCategory);
                if (targetIndex >= 0) {
                    pinned.splice(targetIndex, 0, draggedCategory);
                } else {
                    pinned.push(draggedCategory);
                }
            }
            if (!pinned.includes(draggedCategory)) {
                pinned.push(draggedCategory);
            }
            await savePinnedCategories(pinned);
        } else {
            pinned = pinned.filter(c => c !== draggedCategory);
            const currentTabs = getCategoriesInCurrentOrder(allCategories);
            const unpinnedOrder = currentTabs.filter(c => !pinned.includes(c));
            if (!swapItems(unpinnedOrder, draggedCategory, targetCategory)) {
                const nextUnpinned = unpinnedOrder.filter(c => c !== draggedCategory);
                const targetIndex = nextUnpinned.indexOf(targetCategory);
                if (targetIndex >= 0) {
                    nextUnpinned.splice(targetIndex, 0, draggedCategory);
                    await saveCategoryOrder(nextUnpinned);
                } else {
                    nextUnpinned.push(draggedCategory);
                    await saveCategoryOrder(nextUnpinned);
                }
            } else {
                await saveCategoryOrder(unpinnedOrder);
            }
            await savePinnedCategories(pinned);
        }
    }

    async function openCategoryFromMenu(category) {
        const generation = ++openGeneration;
        if (getWorkspaceMode() !== "gallery") setWorkspaceMode("gallery");
        const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
        const closing = getActiveLibraryTab() === category;
        setActiveLibraryTab(closing ? null : category);
        clearLibraryNavActiveState();
        drawer?.classList.toggle("active", !closing);
        if (!closing) {
            await renderLibraryDrawer(category);
            if (disposed || generation !== openGeneration) return;
        }
        syncPromptSortControls();
        syncSelectedSectionVisibility();
        await renderPinnedCategoryStrip();
        if (disposed || generation !== openGeneration) return;
        closeToolbarPanels();
    }

    async function renderPinnedCategoryStrip() {
        const generation = ++renderGeneration;
        clearLongPressTimers();
        if (!strip) return;
        const allCategories = await getCachedCategories();
        const pinnedCategories = await ensurePinnedCategoriesInitialized(allCategories);
        if (!isCurrent(generation)) return;
        strip.replaceChildren(...pinnedCategories.map(category => createCategoryPill(category, true)));
        fitPillStrip(strip);
        await renderCategoryOverflowCategories(generation);
    }

    async function renderCategoryOverflowCategories(parentGeneration = null) {
        const generation = parentGeneration ?? ++renderGeneration;
        const overflow = widgetContainer.querySelector(`#${uniqueId}-category-overflow`);
        const pullTab = widgetContainer.querySelector(`#${uniqueId}-category-pull-tab`);
        if (!overflow) return;
        const categories = await getCachedCategories();
        if (!isCurrent(generation)) return;
        const pinnedCategories = await ensurePinnedCategoriesInitialized(categories);
        if (!isCurrent(generation)) return;
        const pinnedSet = new Set(pinnedCategories);
        const ordered = [...pinnedCategories, ...getCategoriesInCurrentOrder(categories).filter(category => !pinnedSet.has(category))];
        if (pullTab) pullTab.hidden = ordered.length === 0;
        renderPillOverflow(overflow, ordered.map(category => createCategoryPill(category, pinnedSet.has(category))), {
            state: searchState,
            placeholder: "Search categories",
            emptyText: "No categories match your search.",
            onPick: pill => openCategoryFromMenu(pill.dataset.category),
            onClose: () => {
                setCategoryOverflowOpen(false);
                pullTab?.focus();
            },
        });
    }

    function dispose() {
        disposed = true;
        renderGeneration += 1;
        openGeneration += 1;
        clearLongPressTimers();
        cancelDrag();
        stripObserver?.disconnect();
    }

    return {
        onPointerMove,
        onPointerUp,
        cancelDrag,
        openCategoryFromMenu,
        renderPinnedCategoryStrip,
        renderCategoryOverflowCategories,
        dispose,
    };
}
