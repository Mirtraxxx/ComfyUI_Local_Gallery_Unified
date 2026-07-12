/**
 * Prompt Builder category strip/overflow controller.
 *
 * Rendering is intentionally isolated from ui.js: category pills own their
 * pointer/long-press timers, and async category fetches are generation-guarded
 * so a late response cannot repaint a newer strip.
 */
export function createPromptCategoryStripController({
    widgetContainer,
    uniqueId,
    getCachedCategories,
    ensurePinnedCategoriesInitialized,
    getVisiblePinnedCategoryCount,
    getCategoriesInCurrentOrder,
    getActiveLibraryTab,
    setActiveLibraryTab,
    getCategoryOverflowOpen,
    setCategoryOverflowOpen,
    getSuppressCategoryClickUntil,
    setSuppressCategoryClickUntil,
    setCategoryDragState,
    applyLibraryTabRoleStyling,
    showCategoryPillContextMenu,
    setWorkspaceMode,
    getWorkspaceMode,
    renderLibraryDrawer,
    clearLibraryNavActiveState,
    syncPromptSortControls,
    syncSelectedSectionVisibility,
    closeToolbarPanels,
}) {
    let renderGeneration = 0;
    let openGeneration = 0;
    const longPressTimers = new Set();
    let disposed = false;

    function isCurrent(generation) {
        return !disposed && generation === renderGeneration;
    }

    function clearLongPressTimers() {
        longPressTimers.forEach(timer => clearTimeout(timer));
        longPressTimers.clear();
    }

    function armCategoryPill(pill, category, isPinned) {
        let longPressTimer = null;
        let startX = 0;
        let startY = 0;
        const clearLongPress = () => {
            if (longPressTimer) clearTimeout(longPressTimer);
            if (longPressTimer) longPressTimers.delete(longPressTimer);
            longPressTimer = null;
        };

        pill.addEventListener("click", event => {
            if (Date.now() < getSuppressCategoryClickUntil()) {
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
            if (event.target.closest("button:not(.localprompt-pinned-category-pill), input, select, textarea")) return;
            startX = event.clientX;
            startY = event.clientY;
            clearLongPress();
            longPressTimer = setTimeout(() => {
                longPressTimers.delete(longPressTimer);
                longPressTimer = null;
                setSuppressCategoryClickUntil(Date.now() + 250);
                showCategoryPillContextMenu(event, category, isPinned);
            }, 500);
            longPressTimers.add(longPressTimer);
            setCategoryDragState({
                pill,
                category,
                isPinned,
                startX: event.clientX,
                startY: event.clientY,
                active: false,
                pointerId: event.pointerId,
            });
            pill.setPointerCapture?.(event.pointerId);
        });
        pill.addEventListener("pointermove", event => {
            if (longPressTimer && Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
                clearLongPress();
            }
        });
        pill.addEventListener("pointerup", clearLongPress);
        pill.addEventListener("pointercancel", clearLongPress);
    }

    async function openCategoryFromMenu(category) {
        const generation = ++openGeneration;
        if (getWorkspaceMode() !== "gallery") setWorkspaceMode("gallery");
        const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
        const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);
        if (getActiveLibraryTab() === category) {
            if (categorySelect) categorySelect.value = "";
            setActiveLibraryTab(null);
            clearLibraryNavActiveState();
            drawer?.classList.remove("active");
            syncPromptSortControls();
            syncSelectedSectionVisibility();
            await renderPinnedCategoryStrip();
            if (disposed || generation !== openGeneration) return;
            await renderCategoryDropdownOptions();
            if (disposed || generation !== openGeneration) return;
            closeToolbarPanels();
            return;
        }
        if (categorySelect) categorySelect.value = category || "";
        setActiveLibraryTab(category);
        clearLibraryNavActiveState();
        drawer?.classList.add("active");
        await renderLibraryDrawer(category);
        if (disposed || generation !== openGeneration) return;
        syncPromptSortControls();
        syncSelectedSectionVisibility();
        await renderPinnedCategoryStrip();
        if (disposed || generation !== openGeneration) return;
        await renderCategoryDropdownOptions();
        if (disposed || generation !== openGeneration) return;
        closeToolbarPanels();
    }

    async function renderPinnedCategoryStrip() {
        const generation = ++renderGeneration;
        clearLongPressTimers();
        const strip = widgetContainer.querySelector(`#${uniqueId}-pinned-category-strip`);
        const moreGroup = widgetContainer.querySelector(`#${uniqueId}-more-category-group`);
        if (!strip) return;
        const allCategories = await getCachedCategories();
        const pinnedCategories = await ensurePinnedCategoriesInitialized(allCategories);
        if (!isCurrent(generation)) return;
        const visiblePinnedCategories = pinnedCategories.slice(0, getVisiblePinnedCategoryCount());
        strip.innerHTML = "";
        visiblePinnedCategories.forEach(category => {
            const pill = document.createElement("button");
            pill.type = "button";
            pill.className = `localprompt-pinned-category-pill${getActiveLibraryTab() === category ? " active" : ""}`;
            pill.textContent = category;
            pill.title = category;
            pill.dataset.category = category;
            pill.dataset.pinned = "true";
            applyLibraryTabRoleStyling(pill, category, getActiveLibraryTab() === category);
            armCategoryPill(pill, category, true);
            strip.appendChild(pill);
        });
        moreGroup?.classList.remove("hidden");
        await renderCategoryOverflowCategories(generation);
    }

    async function renderCategoryOverflowCategories(parentGeneration = null) {
        const generation = parentGeneration ?? ++renderGeneration;
        const overflowContainer = widgetContainer.querySelector(`#${uniqueId}-category-overflow`);
        const chipsContainer = widgetContainer.querySelector(`#${uniqueId}-category-overflow-chips`);
        const pullTab = widgetContainer.querySelector(`#${uniqueId}-category-pull-tab`);
        if (!overflowContainer || !chipsContainer) return;
        const categories = await getCachedCategories();
        if (!isCurrent(generation)) return;
        const pinnedCategories = await ensurePinnedCategoriesInitialized(categories);
        if (!isCurrent(generation)) return;
        const visiblePinned = new Set(pinnedCategories.slice(0, getVisiblePinnedCategoryCount()));
        const hiddenCategories = getCategoriesInCurrentOrder(categories).filter(category => !visiblePinned.has(category));
        chipsContainer.innerHTML = "";
        if (!hiddenCategories.length) {
            setCategoryOverflowOpen(false);
            if (pullTab) {
                pullTab.style.display = "none";
                pullTab.setAttribute("aria-expanded", "false");
            }
            overflowContainer.classList.remove("open");
            return;
        }
        if (pullTab) {
            pullTab.style.display = "flex";
            pullTab.setAttribute("aria-expanded", String(getCategoryOverflowOpen()));
        }
        overflowContainer.classList.toggle("open", getCategoryOverflowOpen());
        hiddenCategories.forEach(category => {
            const option = document.createElement("button");
            const isPinned = pinnedCategories.includes(category);
            option.className = `localprompt-pinned-category-pill${getActiveLibraryTab() === category ? " active" : ""}`;
            option.type = "button";
            option.textContent = category;
            option.title = category;
            option.dataset.category = category;
            option.dataset.pinned = String(isPinned);
            applyLibraryTabRoleStyling(option, category, getActiveLibraryTab() === category);
            armCategoryPill(option, category, isPinned);
            chipsContainer.appendChild(option);
        });
    }

    async function renderCategoryDropdownOptions() {
        return renderCategoryOverflowCategories();
    }

    function dispose() {
        disposed = true;
        renderGeneration += 1;
        openGeneration += 1;
        clearLongPressTimers();
    }

    return {
        openCategoryFromMenu,
        renderPinnedCategoryStrip,
        renderCategoryOverflowCategories,
        renderCategoryDropdownOptions,
        dispose,
    };
}
