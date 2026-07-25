/**
 * Prompt Builder category strip/overflow controller.
 *
 * Rendering is intentionally isolated from ui.js: category pills own their
 * pointer/long-press timers, and async category fetches are generation-guarded
 * so a late response cannot repaint a newer strip.
 */
export const CATEGORY_OVERFLOW_MIN_HEIGHT = 120;
export const CATEGORY_OVERFLOW_VIEWPORT_GUTTER = 24;

export function clampCategoryOverflowHeight(
    requestedHeight,
    panelTop,
    viewportHeight,
    minHeight = CATEGORY_OVERFLOW_MIN_HEIGHT,
    viewportGutter = CATEGORY_OVERFLOW_VIEWPORT_GUTTER,
    scale = 1,
) {
    const safeMinimum = Math.max(0, Number(minHeight) || 0);
    const safeScale = Math.max(0.01, Number(scale) || 1);
    const availableHeight = Math.max(
        safeMinimum,
        (
            (Number(viewportHeight) || 0)
            - (Number(panelTop) || 0)
            - Math.max(0, Number(viewportGutter) || 0)
        ) / safeScale,
    );
    return Math.min(availableHeight, Math.max(safeMinimum, Number(requestedHeight) || safeMinimum));
}

export function setupCategoryOverflowResize(widgetContainer, uniqueId, options = {}) {
    const panel = widgetContainer.querySelector(`#${uniqueId}-category-overflow`);
    const pullTab = widgetContainer.querySelector(`#${uniqueId}-category-pull-tab`);
    if (!panel || !pullTab) return () => {};

    const getStoredHeight = typeof options.getStoredHeight === "function" ? options.getStoredHeight : null;
    const onHeightCommit = typeof options.onHeightCommit === "function" ? options.onHeightCommit : null;

    let resizeState = null;
    let customHeight = null;
    let suppressNextClick = false;

    const setPanelHeight = height => {
        customHeight = height;
        panel.style.setProperty("--localprompt-category-overflow-height", `${Math.round(height)}px`);
        pullTab.setAttribute("aria-valuenow", String(Math.round(height)));
    };

    const getPanelScale = panelRect => {
        const layoutHeight = panel.offsetHeight;
        if (!layoutHeight || !panelRect.height) return 1;
        return panelRect.height / layoutHeight;
    };

    const clampToViewport = requestedHeight => {
        const panelRect = panel.getBoundingClientRect();
        return clampCategoryOverflowHeight(
            requestedHeight,
            panelRect.top,
            globalThis.window?.innerHeight ?? requestedHeight,
            CATEGORY_OVERFLOW_MIN_HEIGHT,
            CATEGORY_OVERFLOW_VIEWPORT_GUTTER,
            getPanelScale(panelRect),
        );
    };

    const finishResize = event => {
        if (!resizeState || (event.pointerId !== undefined && event.pointerId !== resizeState.pointerId)) return;
        const didDrag = resizeState.didDrag;
        resizeState = null;
        panel.classList.remove("is-resizing");
        pullTab.classList.remove("is-resizing");
        if (didDrag) {
            suppressNextClick = true;
            if (customHeight != null) {
                try {
                    onHeightCommit?.(Math.round(customHeight));
                } catch (error) {
                    console.warn("LocalPromptGallery: Failed to persist category overflow height", error);
                }
            }
        }
    };

    const onPointerDown = event => {
        if (event.button !== 0 || pullTab.getAttribute("aria-expanded") !== "true") return;
        const panelRect = panel.getBoundingClientRect();
        resizeState = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: panel.offsetHeight || panelRect.height,
            scale: getPanelScale(panelRect),
            didDrag: false,
        };
        pullTab.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = event => {
        if (!resizeState || event.pointerId !== resizeState.pointerId) return;
        const delta = event.clientY - resizeState.startY;
        if (!resizeState.didDrag && Math.abs(delta) < 4) return;
        resizeState.didDrag = true;
        event.preventDefault();
        panel.classList.add("is-resizing");
        pullTab.classList.add("is-resizing");
        setPanelHeight(clampToViewport(resizeState.startHeight + (delta / resizeState.scale)));
    };

    const onClickCapture = event => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    const onWindowResize = () => {
        if (customHeight === null) return;
        setPanelHeight(clampToViewport(customHeight));
    };

    const storedHeight = Number(getStoredHeight?.());
    if (Number.isFinite(storedHeight) && storedHeight > 0) {
        setPanelHeight(Math.max(CATEGORY_OVERFLOW_MIN_HEIGHT, Math.round(storedHeight)));
    }

    pullTab.addEventListener("pointerdown", onPointerDown);
    pullTab.addEventListener("pointermove", onPointerMove);
    pullTab.addEventListener("pointerup", finishResize);
    pullTab.addEventListener("pointercancel", finishResize);
    pullTab.addEventListener("click", onClickCapture, true);
    globalThis.window?.addEventListener("resize", onWindowResize);

    return () => {
        pullTab.removeEventListener("pointerdown", onPointerDown);
        pullTab.removeEventListener("pointermove", onPointerMove);
        pullTab.removeEventListener("pointerup", finishResize);
        pullTab.removeEventListener("pointercancel", finishResize);
        pullTab.removeEventListener("click", onClickCapture, true);
        globalThis.window?.removeEventListener("resize", onWindowResize);
    };
}

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
    getCategoryOverflowHeight,
    persistCategoryOverflowHeight,
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
    const disposeOverflowResize = setupCategoryOverflowResize(widgetContainer, uniqueId, {
        getStoredHeight: () => getCategoryOverflowHeight?.(),
        onHeightCommit: height => persistCategoryOverflowHeight?.(height),
    });

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
            pullTab.setAttribute(
                "aria-label",
                getCategoryOverflowOpen()
                    ? "Resize category list or click to hide categories"
                    : "Show all categories",
            );
            pullTab.title = getCategoryOverflowOpen()
                ? "Drag to resize. Click to hide categories."
                : "Show all categories";
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
        disposeOverflowResize();
    }

    return {
        openCategoryFromMenu,
        renderPinnedCategoryStrip,
        renderCategoryOverflowCategories,
        renderCategoryDropdownOptions,
        dispose,
    };
}
