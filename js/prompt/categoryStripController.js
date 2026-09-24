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
    getCategoryOverflowGrouping,
    setCategoryOverflowGrouping,
    getCategoryRoleColor,
}) {
    let renderGeneration = 0;
    let openGeneration = 0;
    let categorySearchQuery = "";
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

    const PRESET_COLOR_ORDER = ["#ef4444", "#f97316", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8"];
    const ALL_ALPHABET_KEYS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];

    function resolveGroupingMode() {
        if (typeof getCategoryOverflowGrouping === "function") {
            const mode = getCategoryOverflowGrouping();
            if (mode === "color" || mode === "alpha") return mode;
        }
        return "alpha";
    }

    async function persistGroupingMode(mode) {
        if (typeof setCategoryOverflowGrouping === "function") {
            await setCategoryOverflowGrouping(mode);
        }
    }

    function resolveRoleColor(category) {
        if (typeof getCategoryRoleColor === "function") {
            return getCategoryRoleColor(category);
        }
        return null;
    }

    async function renderCategoryOverflowCategories(parentGeneration = null) {
        const generation = parentGeneration ?? ++renderGeneration;
        const overflowContainer = widgetContainer.querySelector(`#${uniqueId}-category-overflow`);
        const chipsContainer = widgetContainer.querySelector(`#${uniqueId}-category-overflow-chips`);
        const moreBtn = widgetContainer.querySelector(`#${uniqueId}-category-more-btn`);
        if (!overflowContainer || !chipsContainer) return;
        const categories = await getCachedCategories();
        if (!isCurrent(generation)) return;
        const pinnedCategories = await ensurePinnedCategoriesInitialized(categories);
        if (!isCurrent(generation)) return;
        const visiblePinned = new Set(pinnedCategories.slice(0, getVisiblePinnedCategoryCount()));
        const hiddenCategories = getCategoriesInCurrentOrder(categories).filter(category => !visiblePinned.has(category));
        chipsContainer.innerHTML = "";
        if (moreBtn) {
            moreBtn.setAttribute("aria-expanded", String(getCategoryOverflowOpen()));
        }
        if (!hiddenCategories.length) {
            setCategoryOverflowOpen(false);
            if (moreBtn) moreBtn.hidden = true;
            overflowContainer.classList.remove("open");
            return;
        }
        if (moreBtn) moreBtn.hidden = false;
        overflowContainer.classList.toggle("open", getCategoryOverflowOpen());

        const currentMode = resolveGroupingMode();

        function createPill(category) {
            const pill = document.createElement("button");
            const isPinned = pinnedCategories.includes(category);
            pill.className = `localprompt-pinned-category-pill${getActiveLibraryTab() === category ? " active" : ""}`;
            pill.type = "button";
            pill.textContent = category;
            pill.title = category;
            pill.dataset.category = category;
            pill.dataset.pinned = String(isPinned);
            applyLibraryTabRoleStyling(pill, category, getActiveLibraryTab() === category);
            armCategoryPill(pill, category, isPinned);
            return pill;
        }

        // Header controls (sticky container)
        const header = document.createElement("div");
        header.className = "localprompt-category-overflow-header";

        const headerTop = document.createElement("div");
        headerTop.className = "localprompt-category-header-top";

        const searchRow = document.createElement("label");
        searchRow.className = "localprompt-category-search-row";
        searchRow.setAttribute("for", `${uniqueId}-category-search`);
        const searchLabel = document.createElement("span");
        searchLabel.className = "localprompt-category-search-label";
        searchLabel.textContent = "Find a category";
        const searchInput = document.createElement("input");
        searchInput.id = `${uniqueId}-category-search`;
        searchInput.className = "localprompt-category-search-input";
        searchInput.type = "search";
        searchInput.placeholder = "Search categories";
        searchInput.autocomplete = "off";
        searchInput.spellcheck = false;
        searchInput.value = categorySearchQuery;
        searchRow.append(searchLabel, searchInput);

        const modeToggle = document.createElement("div");
        modeToggle.className = "localprompt-category-mode-toggle";
        modeToggle.setAttribute("role", "tablist");
        modeToggle.setAttribute("aria-label", "Category grouping mode");

        const alphaBtn = document.createElement("button");
        alphaBtn.type = "button";
        alphaBtn.className = `localprompt-category-mode-btn${currentMode === "alpha" ? " active" : ""}`;
        alphaBtn.dataset.mode = "alpha";
        alphaBtn.textContent = "A–Z";
        alphaBtn.title = "Alphabetical grouping (A–Z)";

        const colorBtn = document.createElement("button");
        colorBtn.type = "button";
        colorBtn.className = `localprompt-category-mode-btn${currentMode === "color" ? " active" : ""}`;
        colorBtn.dataset.mode = "color";
        colorBtn.textContent = "Color";
        colorBtn.title = "Grouping by category color/role";

        modeToggle.append(alphaBtn, colorBtn);
        headerTop.append(searchRow, modeToggle);
        header.appendChild(headerTop);

        const jumpStrip = document.createElement("div");
        jumpStrip.className = "localprompt-category-jump-strip";
        jumpStrip.setAttribute("role", "toolbar");
        jumpStrip.setAttribute("aria-label", "Jump to section");
        header.appendChild(jumpStrip);
        chipsContainer.appendChild(header);

        const sectionsContainer = document.createElement("div");
        sectionsContainer.className = "localprompt-category-sections-container";

        function scrollToCategorySection(targetSection) {
            if (!targetSection || !overflowContainer) return;
            const containerRect = overflowContainer.getBoundingClientRect ? overflowContainer.getBoundingClientRect() : { top: 0 };
            const sectionRect = targetSection.getBoundingClientRect ? targetSection.getBoundingClientRect() : { top: 0 };
            const headerRect = header && header.getBoundingClientRect ? header.getBoundingClientRect() : null;
            const headerBottom = headerRect ? headerRect.bottom : containerRect.top;
            const offset = sectionRect.top - headerBottom;
            const targetScrollTop = Math.max(0, (overflowContainer.scrollTop || 0) + offset);
            if (typeof overflowContainer.scrollTo === "function") {
                overflowContainer.scrollTo({
                    top: targetScrollTop,
                    behavior: "smooth",
                });
            } else {
                overflowContainer.scrollTop = targetScrollTop;
            }
        }

        if (currentMode === "alpha") {
            const sorted = [...hiddenCategories].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
            const alphaGroups = new Map();
            for (const cat of sorted) {
                // Bucket on Unicode letters so accented and non-Latin names
                // get their own section instead of all landing in "#".
                const first = cat.trim()[0] || "";
                const key = /^\p{L}$/u.test(first) ? first.toUpperCase() : "#";
                if (!alphaGroups.has(key)) alphaGroups.set(key, []);
                alphaGroups.get(key).push(cat);
            }

            // Jump keys: the fixed A-Z/# strip plus any non-ASCII letter
            // groups that exist.
            const jumpKeys = [...ALL_ALPHABET_KEYS];
            for (const key of alphaGroups.keys()) {
                if (!jumpKeys.includes(key)) jumpKeys.push(key);
            }

            jumpKeys.forEach(letter => {
                const hasItems = alphaGroups.has(letter) && alphaGroups.get(letter).length > 0;
                const jumpItem = document.createElement("button");
                jumpItem.type = "button";
                jumpItem.className = `localprompt-category-jump-item${hasItems ? "" : " disabled"}`;
                jumpItem.textContent = letter;
                jumpItem.dataset.jumpKey = letter;
                jumpItem.title = hasItems ? `Jump to '${letter}'` : `No categories under '${letter}'`;
                if (!hasItems) {
                    jumpItem.setAttribute("aria-disabled", "true");
                    jumpItem.tabIndex = -1;
                }
                jumpItem.addEventListener("click", () => {
                    const section = sectionsContainer.querySelector(`.localprompt-category-section[data-section-key="${letter}"]`);
                    if (section) {
                        scrollToCategorySection(section);
                    }
                });
                jumpStrip.appendChild(jumpItem);
            });

            jumpKeys.filter(l => alphaGroups.has(l) && alphaGroups.get(l).length > 0).forEach(letter => {
                const items = alphaGroups.get(letter);
                const section = document.createElement("div");
                section.className = "localprompt-category-section";
                section.dataset.sectionKey = letter;

                const sectionHeader = document.createElement("div");
                sectionHeader.className = "localprompt-category-section-header";

                const titleSpan = document.createElement("span");
                titleSpan.className = "localprompt-category-section-title";
                titleSpan.textContent = letter;

                const countSpan = document.createElement("span");
                countSpan.className = "localprompt-category-section-count";
                countSpan.textContent = String(items.length);

                sectionHeader.append(titleSpan, countSpan);
                section.appendChild(sectionHeader);

                const grid = document.createElement("div");
                grid.className = "localprompt-category-overflow-grid";
                items.forEach(category => {
                    grid.appendChild(createPill(category));
                });
                section.appendChild(grid);
                sectionsContainer.appendChild(section);
            });
        } else {
            // Color mode
            const colorBuckets = new Map();
            for (const cat of hiddenCategories) {
                const rawColor = resolveRoleColor(cat);
                const colorHex = rawColor ? rawColor.toLowerCase() : null;
                const key = colorHex || "unassigned";
                if (!colorBuckets.has(key)) {
                    colorBuckets.set(key, {
                        colorHex,
                        categories: [],
                    });
                }
                colorBuckets.get(key).categories.push(cat);
            }

            for (const bucket of colorBuckets.values()) {
                bucket.categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
            }

            const colorKeys = Array.from(colorBuckets.keys()).sort((a, b) => {
                if (a === "unassigned") return 1;
                if (b === "unassigned") return -1;
                const idxA = PRESET_COLOR_ORDER.indexOf(a);
                const idxB = PRESET_COLOR_ORDER.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            colorKeys.forEach(key => {
                const bucket = colorBuckets.get(key);
                const jumpItem = document.createElement("button");
                jumpItem.type = "button";
                jumpItem.className = "localprompt-category-jump-item color-swatch";
                jumpItem.dataset.jumpKey = key;
                if (bucket.colorHex) {
                    jumpItem.style.setProperty("--jump-color", bucket.colorHex);
                    jumpItem.style.backgroundColor = bucket.colorHex;
                    jumpItem.title = `Jump to ${bucket.colorHex.toUpperCase()} (${bucket.categories.length})`;
                } else {
                    jumpItem.title = `Jump to Other / Uncategorized (${bucket.categories.length})`;
                    jumpItem.textContent = "•";
                }
                jumpItem.addEventListener("click", () => {
                    const section = sectionsContainer.querySelector(`.localprompt-category-section[data-section-key="${key}"]`);
                    if (section) {
                        scrollToCategorySection(section);
                    }
                });
                jumpStrip.appendChild(jumpItem);
            });

            colorKeys.forEach(key => {
                const bucket = colorBuckets.get(key);
                const section = document.createElement("div");
                section.className = "localprompt-category-section";
                section.dataset.sectionKey = key;

                const sectionHeader = document.createElement("div");
                sectionHeader.className = "localprompt-category-section-header";

                const titleSpan = document.createElement("span");
                titleSpan.className = "localprompt-category-section-title";
                if (bucket.colorHex) {
                    const dot = document.createElement("span");
                    dot.className = "localprompt-category-section-color-dot";
                    dot.style.backgroundColor = bucket.colorHex;
                    titleSpan.appendChild(dot);
                }
                const labelText = document.createTextNode(bucket.colorHex ? bucket.colorHex.toUpperCase() : "Other / Uncategorized");
                titleSpan.appendChild(labelText);

                const countSpan = document.createElement("span");
                countSpan.className = "localprompt-category-section-count";
                countSpan.textContent = String(bucket.categories.length);

                sectionHeader.append(titleSpan, countSpan);
                section.appendChild(sectionHeader);

                const grid = document.createElement("div");
                grid.className = "localprompt-category-overflow-grid";
                bucket.categories.forEach(category => {
                    grid.appendChild(createPill(category));
                });
                section.appendChild(grid);
                sectionsContainer.appendChild(section);
            });
        }

        chipsContainer.appendChild(sectionsContainer);

        const emptyState = document.createElement("div");
        emptyState.className = "localprompt-category-search-empty";
        emptyState.textContent = "No categories match your search.";
        emptyState.hidden = true;
        emptyState.setAttribute("role", "status");
        chipsContainer.appendChild(emptyState);

        const applySearch = () => {
            const query = categorySearchQuery.trim().toLocaleLowerCase();
            let totalVisible = 0;

            sectionsContainer.querySelectorAll(".localprompt-category-section").forEach(section => {
                const sectionKey = section.dataset.sectionKey;
                let visibleInSection = 0;
                section.querySelectorAll(".localprompt-pinned-category-pill").forEach(pill => {
                    const matches = !query || pill.dataset.category.toLocaleLowerCase().includes(query);
                    pill.hidden = !matches;
                    if (matches) visibleInSection += 1;
                });

                section.hidden = visibleInSection === 0;
                const countBadge = section.querySelector(".localprompt-category-section-count");
                if (countBadge) countBadge.textContent = String(visibleInSection);

                if (visibleInSection > 0) totalVisible += visibleInSection;

                const jumpBtn = jumpStrip.querySelector(`.localprompt-category-jump-item[data-jump-key="${sectionKey}"]`);
                if (jumpBtn) {
                    const hasMatches = visibleInSection > 0;
                    jumpBtn.classList.toggle("disabled", !hasMatches);
                    if (hasMatches) {
                        jumpBtn.removeAttribute("aria-disabled");
                        jumpBtn.tabIndex = 0;
                    } else {
                        jumpBtn.setAttribute("aria-disabled", "true");
                        jumpBtn.tabIndex = -1;
                    }
                }
            });

            emptyState.hidden = totalVisible !== 0;
        };

        searchInput.addEventListener("input", () => {
            categorySearchQuery = searchInput.value;
            applySearch();
        });
        searchInput.addEventListener("search", () => {
            categorySearchQuery = searchInput.value;
            applySearch();
        });
        searchInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                const firstPill = chipsContainer.querySelector(".localprompt-pinned-category-pill:not([hidden])");
                if (firstPill && firstPill.dataset.category) {
                    openCategoryFromMenu(firstPill.dataset.category);
                }
            } else if (event.key === "Escape") {
                // The field handled Escape; keep the document-level handler
                // from closing the whole toolbar panel.
                event.stopPropagation();
                if (searchInput.value) {
                    event.preventDefault();
                    searchInput.value = "";
                    categorySearchQuery = "";
                    applySearch();
                } else {
                    setCategoryOverflowOpen(false);
                    overflowContainer.classList.remove("open");
                    if (moreBtn) moreBtn.setAttribute("aria-expanded", "false");
                }
            }
        });

        alphaBtn.addEventListener("click", async () => {
            if (currentMode === "alpha") return;
            await persistGroupingMode("alpha");
            await renderCategoryOverflowCategories(generation);
        });

        colorBtn.addEventListener("click", async () => {
            if (currentMode === "color") return;
            await persistGroupingMode("color");
            await renderCategoryOverflowCategories(generation);
        });

        applySearch();
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
