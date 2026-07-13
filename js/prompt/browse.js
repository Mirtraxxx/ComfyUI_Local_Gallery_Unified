import {
    createPromptActionButton,
} from "./helpers.js?v=unified-icons-20260606";
import { escapeHtml } from "../shared/dom.js";
import { showBulkEditDrawer } from "./bulkEditor.js?v=card-manager-bulk-editor-20260713";

// Product term: Card Manager. Historical code names still use "browse"
// for DOM ids, CSS classes, and compatibility exports.

function closeOnOverlayClick(overlay, closeHandler = () => overlay.remove()) {
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeHandler();
        }
    });
}

function createBrowseSurface({ workspaceContainer, onClose }) {
    if (!workspaceContainer) {
        const overlay = document.createElement("div");
        overlay.className = "localprompt-modal-overlay";
        document.body.appendChild(overlay);
        return {
            root: overlay,
            close: () => overlay.remove(),
            isWorkspace: false,
        };
    }

    workspaceContainer.innerHTML = "";
    const root = document.createElement("div");
    root.className = "localprompt-workspace-panel";
    workspaceContainer.appendChild(root);
    return {
        root,
        close: () => {
            root.remove();
            onClose?.();
        },
        isWorkspace: true,
    };
}

function populateCategorySelect(categorySelect, categories, counts = {}, totalCount = null, selectedCategory = "") {
    const allLabel = Number.isFinite(totalCount) ? `All Categories (${totalCount})` : "All Categories";
    categorySelect.innerHTML = `<option value="">${allLabel}</option>`;
    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        const count = Number.isFinite(Number(counts?.[category])) ? Number(counts[category]) : null;
        option.textContent = count === null ? category : `${category} (${count})`;
        categorySelect.appendChild(option);
    });
    if (selectedCategory && categories.includes(selectedCategory)) {
        categorySelect.value = selectedCategory;
    }
}

function updateCategoryActionButtons(overlay, categoryValue) {
    const renameCategoryBtn = overlay.querySelector("#browse-rename-category");
    const exportCategoryBtn = overlay.querySelector("#browse-export-category");
    const deleteCategoryBtn = overlay.querySelector("#browse-delete-category");
    const categoryActionsToggle = overlay.querySelector("#browse-category-actions-toggle");
    const categoryActionsMenu = overlay.querySelector("#browse-category-actions-menu");
    if (renameCategoryBtn) {
        renameCategoryBtn.style.display = categoryValue ? "block" : "none";
    }
    if (exportCategoryBtn) {
        exportCategoryBtn.style.display = categoryValue ? "block" : "none";
    }
    if (deleteCategoryBtn) {
        deleteCategoryBtn.style.display = categoryValue ? "block" : "none";
    }
    if (categoryActionsToggle) {
        categoryActionsToggle.style.display = categoryValue ? "inline-flex" : "none";
    }
    if (!categoryValue && categoryActionsMenu) {
        categoryActionsMenu.hidden = true;
        categoryActionsToggle?.setAttribute("aria-expanded", "false");
    }
}

function openBulkMoveDialog({ categories = [], counts = {}, selectedCount = 0, currentCategory = "" }) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "localprompt-modal-overlay localprompt-bulk-move-overlay";
        overlay.innerHTML = `
            <div class="localprompt-modal localprompt-bulk-move-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-move-title">
                <div class="localprompt-modal-header">
                    <div>
                        <h3 id="bulk-move-title">Move ${selectedCount} card${selectedCount === 1 ? "" : "s"}</h3>
                        <p class="localprompt-bulk-move-subtitle">Choose a destination category for the selected cards.</p>
                    </div>
                    <button type="button" class="localprompt-modal-close" data-bulk-move-cancel title="Cancel">×</button>
                </div>
                <div class="localprompt-modal-content localprompt-bulk-move-content">
                    <label class="localprompt-field-label" for="bulk-move-category">Destination category</label>
                    <select id="bulk-move-category" class="localprompt-browse-select"></select>
                    <div class="localprompt-bulk-move-new-row" hidden>
                        <label class="localprompt-field-label" for="bulk-move-new-category">New category name</label>
                        <input id="bulk-move-new-category" class="localprompt-browse-input" type="text" maxlength="80" placeholder="e.g. Lighting">
                    </div>
                    <p class="localprompt-bulk-move-preview" id="bulk-move-preview"></p>
                </div>
                <div class="localprompt-modal-footer">
                    <button type="button" class="localprompt-btn" data-bulk-move-cancel>Cancel</button>
                    <button type="button" class="localprompt-btn primary" data-bulk-move-confirm>Move cards</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const dialog = overlay.querySelector(".localprompt-bulk-move-dialog");
        const categorySelect = overlay.querySelector("#bulk-move-category");
        const newCategoryRow = overlay.querySelector(".localprompt-bulk-move-new-row");
        const newCategoryInput = overlay.querySelector("#bulk-move-new-category");
        const preview = overlay.querySelector("#bulk-move-preview");
        const confirmButton = overlay.querySelector("[data-bulk-move-confirm]");

        const chooseOption = document.createElement("option");
        chooseOption.value = "__choose_category__";
        chooseOption.textContent = "Select a category…";
        chooseOption.disabled = true;
        chooseOption.selected = true;
        categorySelect.appendChild(chooseOption);
        const uncategorizedOption = document.createElement("option");
        uncategorizedOption.value = "";
        uncategorizedOption.textContent = "Uncategorized";
        categorySelect.appendChild(uncategorizedOption);
        categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category;
            const count = Number.isFinite(Number(counts?.[category])) ? ` (${counts[category]})` : "";
            option.textContent = `${category}${count}`;
            categorySelect.appendChild(option);
        });
        const newOption = document.createElement("option");
        newOption.value = "__new_category__";
        newOption.textContent = "+ New category…";
        categorySelect.appendChild(newOption);
        if (currentCategory && categories.includes(currentCategory)) {
            categorySelect.value = currentCategory;
        }

        function getTargetCategory() {
            if (categorySelect.value === "__new_category__") return newCategoryInput.value.trim();
            if (categorySelect.value === "__choose_category__") return null;
            return categorySelect.value;
        }

        function updateDialogState() {
            const isNew = categorySelect.value === "__new_category__";
            newCategoryRow.hidden = !isNew;
            const target = getTargetCategory();
            confirmButton.disabled = target === null || (isNew && !target);
            preview.textContent = target === null
                ? "Choose a destination category to continue."
                : target
                ? `${selectedCount} card${selectedCount === 1 ? "" : "s"} will move to “${target}”.`
                : "Selected cards will be moved to Uncategorized.";
        }

        function finish(value) {
            overlay.remove();
            document.removeEventListener("keydown", onKeydown);
            resolve(value);
        }

        function onKeydown(event) {
            if (event.key === "Escape") finish(null);
        }

        categorySelect.addEventListener("change", updateDialogState);
        newCategoryInput.addEventListener("input", updateDialogState);
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) finish(null);
        });
        overlay.querySelectorAll("[data-bulk-move-cancel]").forEach((button) => {
            button.addEventListener("click", () => finish(null));
        });
        confirmButton.addEventListener("click", () => {
            const target = getTargetCategory();
            if (categorySelect.value === "__new_category__" && !target) return;
            finish(target);
        });
        document.addEventListener("keydown", onKeydown);
        updateDialogState();
        (dialog.querySelector("#bulk-move-category") || newCategoryInput).focus();
    });
}

function buildPromptCardHtml(prompt, hasPreview) {
    const safeName = escapeHtml(prompt.name);
    const previewHtml = hasPreview && prompt.preview_type === "video"
        ? `<video src="${escapeHtml(prompt.preview_url)}" muted playsinline preload="metadata" aria-label="${safeName}"></video>`
        : hasPreview
            ? `<img src="${escapeHtml(prompt.preview_url)}" alt="${safeName}" loading="lazy" decoding="async">`
            : "No Preview";
    return `
        ${createPromptActionButton({ icon: "eye", className: "localprompt-info-btn", title: "View Info" })}
        <div class="item-preview ${hasPreview ? "" : "no-img"}">
            ${previewHtml}
        </div>
        <div class="item-info">
            <div class="item-name" title="${safeName}">${safeName}</div>
        </div>
        ${createPromptActionButton({ icon: "star", className: `favorite-btn ${prompt.favorite ? "favorited" : ""}`, title: "Pin/Unpin", pressed: !!prompt.favorite })}
    `;
}

function bindPreviewAspectRatio(item) {
    const preview = item.querySelector(".item-preview:not(.no-img)");
    const media = preview?.querySelector("img, video");
    if (!preview || !media) return;

    const syncRatio = () => {
        const isVideo = media.tagName === "VIDEO";
        const width = isVideo ? media.videoWidth : media.naturalWidth;
        const height = isVideo ? media.videoHeight : media.naturalHeight;
        if (!width || !height) return;
        preview.style.aspectRatio = `${width} / ${height}`;
        preview.dataset.aspectReady = "true";
    };

    if (media.tagName === "VIDEO") {
        if (media.readyState >= 1) syncRatio();
        else media.addEventListener("loadedmetadata", syncRatio, { once: true });
    } else if (media.complete && media.naturalWidth) {
        syncRatio();
    } else {
        media.addEventListener("load", syncRatio, { once: true });
    }
}

export async function showCardManagerModal({
    app,
    nodeInstance,
    galleryNode,
    saveSelectionData,
    loadCategories,
    refreshAllSections,
    addPromptToSelection,
    syncPinnedOrderForFavorite,
    attachInfoPopup,
    showContextMenu,
    renameCategoryWithPrompt,
    onExportCategory = null,
    getCategoryRoleColor,
    getSortMode = () => "manual",
    setSortMode = null,
    workspaceContainer = null,
    onClose = null,
    librarySubnavHtml = "",
}) {
    let browseManageMode = false;
    const bulkSelectedPromptIds = new Set();
    let bulkQuerySelection = null;
    let lastBrowseData = null;
    let browseFavoritesOnly = false;
    let browseUncategorizedOnly = false;
    const surface = createBrowseSurface({ workspaceContainer, onClose });
    const { root, close: closeSurface, isWorkspace } = surface;
    const contrastMode = (nodeInstance?.uiPrefs?.card_contrast_mode || "off").replace(/_/g, "-");
    root.classList.add(`contrast-${contrastMode}`);
    root.innerHTML = `
        <div class="localprompt-modal localprompt-browse-page${isWorkspace ? " localprompt-workspace-page" : ""}">
            <div class="${isWorkspace ? "localprompt-workspace-header" : "localprompt-modal-header"} localprompt-card-manager-legacy-header">
                <div class="localprompt-workspace-title">
                    <h3>Cards</h3>
                    ${isWorkspace ? "<p>Browse, search, pin, add, and manage prompt cards.</p>" : ""}
                </div>
                ${isWorkspace ? "" : '<button class="localprompt-modal-close" title="Close">x</button>'}
            </div>
            ${isWorkspace ? librarySubnavHtml : ""}
            <div class="${isWorkspace ? "localprompt-workspace-body" : "localprompt-modal-content"}">
                <div class="localprompt-card-manager-layout">
                    <aside class="localprompt-card-manager-rail" aria-label="Card categories">
                        <div class="localprompt-card-manager-rail-workspace localprompt-card-manager-fullscreen-only">
                            <div class="localprompt-card-manager-brand">
                                <span class="localprompt-card-manager-brand-mark">C</span>
                                <span>Card Manager</span>
                            </div>
                            <nav class="localprompt-card-manager-workspace-nav" aria-label="Library workspace">
                                <button type="button" class="localprompt-card-manager-workspace-item active" data-library-page="cards">Cards</button>
                                <button type="button" class="localprompt-card-manager-workspace-item" data-library-page="presets">Presets</button>
                                <button type="button" class="localprompt-card-manager-workspace-item" data-library-page="import">Import TXT</button>
                                <button type="button" class="localprompt-card-manager-workspace-item" data-library-page="export">Export TXT</button>
                            </nav>
                        </div>
                        <div class="localprompt-card-manager-rail-title">COLLECTIONS</div>
                        <button type="button" class="localprompt-card-manager-rail-item active" data-browse-rail-category="">All cards <span id="browse-rail-all-count"></span></button>
                        <button type="button" class="localprompt-card-manager-rail-item" data-browse-rail-favorites="true">Pinned <span id="browse-rail-favorite-count"></span></button>
                        <button type="button" class="localprompt-card-manager-rail-item" data-browse-rail-category="__uncategorized__">Uncategorized <span id="browse-rail-uncategorized-count"></span></button>
                        <div class="localprompt-card-manager-rail-title">CATEGORIES</div>
                        <div id="browse-category-rail-list" class="localprompt-card-manager-rail-list"></div>
                    </aside>
                    <div class="localprompt-card-manager-main">
                        <header class="localprompt-card-manager-fullscreen-header localprompt-card-manager-fullscreen-only">
                            <div>
                                <div class="localprompt-card-manager-kicker">PROMPT LIBRARY</div>
                                <div class="localprompt-card-manager-heading-row">
                                    <h2 id="browse-fullscreen-context">All cards</h2>
                                    <span id="browse-fullscreen-count">0 cards</span>
                                </div>
                            </div>
                            <button id="browse-fullscreen-exit" class="localprompt-btn localprompt-card-manager-exit" type="button">Exit full screen</button>
                        </header>
                        <div class="localprompt-browse-toolbar">
                            <div class="localprompt-browse-search-group">
                                <input type="text" id="browse-filter" class="localprompt-browse-input" placeholder="Search cards...">
                                <select id="browse-category" class="localprompt-browse-select localprompt-card-manager-embedded-category"></select>
                            </div>
                            <select id="browse-sort" class="localprompt-sort-select localprompt-browse-sort-select" title="Sort cards">
                                <option value="manual">Manual / stored order</option>
                                <option value="newest">Newest first</option>
                                <option value="oldest">Oldest first</option>
                                <option value="az">A to Z</option>
                                <option value="za">Z to A</option>
                            </select>
                            <div class="localprompt-browse-command-group">
                                <button id="browse-manage-toggle" class="localprompt-btn localprompt-browse-toolbar-btn">Manage</button>
                                <button id="browse-fullscreen-toggle" class="localprompt-btn localprompt-browse-toolbar-btn" type="button" title="Expand Card Manager to the full ComfyUI screen" aria-pressed="false">Full screen</button>
                                <div class="localprompt-category-actions">
                                    <button id="browse-category-actions-toggle" class="localprompt-btn localprompt-browse-toolbar-btn" type="button" aria-haspopup="menu" aria-expanded="false">Category actions</button>
                                    <div id="browse-category-actions-menu" class="localprompt-category-actions-menu" role="menu" hidden>
                                        <button id="browse-rename-category" class="localprompt-category-action" type="button" role="menuitem">Rename category</button>
                                        <button id="browse-export-category" class="localprompt-category-action" type="button" role="menuitem">Export category</button>
                                        <button id="browse-delete-category" class="localprompt-category-action danger" type="button" role="menuitem">Delete category</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                <div id="browse-bulk-toolbar" class="localprompt-bulk-toolbar" style="display: none; margin-bottom: 12px;">
                    <span id="browse-bulk-summary" class="localprompt-bulk-summary">0 selected</span>
                    <button id="browse-select-visible" class="localprompt-btn">Select page</button>
                    <button id="browse-select-all-results" class="localprompt-btn">Select all results</button>
                    <button id="browse-edit-selected" class="localprompt-btn primary">Edit...</button>
                    <button id="browse-move-selected" class="localprompt-btn primary">Move to…</button>
                    <button id="browse-clear-selected" class="localprompt-btn">Clear</button>
                    <button id="browse-delete-selected" class="localprompt-btn localprompt-clear-btn">Delete</button>
                    <span id="browse-bulk-status" class="localprompt-bulk-status" role="status" aria-live="polite"></span>
                </div>
                <div id="browse-gallery-grid" class="localprompt-gallery-grid"></div>
                    </div>
                </div>
            </div>
            <div class="${isWorkspace ? "localprompt-workspace-footer " : ""}localprompt-browse-footer">
                <span id="browse-result-count" class="localprompt-browse-result-count">0 cards</span>
                <div class="localprompt-browse-pagination-pill">
                    <button id="browse-prev" class="localprompt-btn">Prev</button>
                    <span id="browse-page-info" class="localprompt-browse-page-info">Page 1 of 1</span>
                    <button id="browse-next" class="localprompt-btn">Next</button>
                </div>
            </div>
        </div>
    `;

    const closeBtn = root.querySelector(isWorkspace ? ".localprompt-workspace-back" : ".localprompt-modal-close");
    const filterInput = root.querySelector("#browse-filter");
    const categorySelect = root.querySelector("#browse-category");
    const sortSelect = root.querySelector("#browse-sort");
    const manageToggleBtn = root.querySelector("#browse-manage-toggle");
    const fullscreenToggleBtn = root.querySelector("#browse-fullscreen-toggle");
    const fullscreenExitBtn = root.querySelector("#browse-fullscreen-exit");
    const fullscreenContext = root.querySelector("#browse-fullscreen-context");
    const fullscreenCount = root.querySelector("#browse-fullscreen-count");
    const resultCount = root.querySelector("#browse-result-count");
    const categoryActionsToggle = root.querySelector("#browse-category-actions-toggle");
    const categoryActionsMenu = root.querySelector("#browse-category-actions-menu");
    const bulkToolbar = root.querySelector("#browse-bulk-toolbar");
    const bulkSummary = root.querySelector("#browse-bulk-summary");
    const selectVisibleBtn = root.querySelector("#browse-select-visible");
    const selectAllResultsBtn = root.querySelector("#browse-select-all-results");
    const editSelectedBtn = root.querySelector("#browse-edit-selected");
    const moveSelectedBtn = root.querySelector("#browse-move-selected");
    const clearSelectedBtn = root.querySelector("#browse-clear-selected");
    const deleteSelectedBtn = root.querySelector("#browse-delete-selected");
    const bulkStatus = root.querySelector("#browse-bulk-status");
    const grid = root.querySelector("#browse-gallery-grid");
    const prevBtn = root.querySelector("#browse-prev");
    const nextBtn = root.querySelector("#browse-next");
    const pageInfo = root.querySelector("#browse-page-info");
    const categoryRail = root.querySelector("#browse-category-rail-list");
    const railAllCount = root.querySelector("#browse-rail-all-count");
    const railFavoriteCount = root.querySelector("#browse-rail-favorite-count");
    const railUncategorizedCount = root.querySelector("#browse-rail-uncategorized-count");

    let currentPage = 1;
    let totalPages = 1;
    let lastScrollTop = 0;
    let downwardScrollDistance = 0;
    let upwardScrollDistance = 0;
    let suppressNextCardClick = false;
    let browseLoadSequence = 0;
    let isFullscreen = false;
    let forwardingLibraryNavigation = false;
    const originalParent = root.parentElement;

    function getBulkSelectionCount() {
        if (!bulkQuerySelection) return bulkSelectedPromptIds.size;
        return Math.max(
            0,
            Number(bulkQuerySelection.selectedCount || 0) - bulkQuerySelection.exclusions.size,
        );
    }

    function getBulkSelectionDescriptor() {
        if (bulkQuerySelection) {
            return {
                type: "query",
                filter_name: bulkQuerySelection.filter_name,
                category: bulkQuerySelection.category,
                favorites_only: !!bulkQuerySelection.favorites_only,
                uncategorized_only: !!bulkQuerySelection.uncategorized_only,
                exclusions: Array.from(bulkQuerySelection.exclusions || []),
            };
        }
        return { type: "ids", ids: Array.from(bulkSelectedPromptIds) };
    }

    function clearBulkSelection() {
        bulkSelectedPromptIds.clear();
        bulkQuerySelection = null;
    }

    function getBrowseContextLabel() {
        if (browseFavoritesOnly) return "Pinned";
        if (browseUncategorizedOnly) return "Uncategorized";
        return categorySelect.value || "All cards";
    }

    function updateBrowseContext(total = Number(lastBrowseData?.total_prompts || 0)) {
        const label = getBrowseContextLabel();
        const countLabel = `${total} card${total === 1 ? "" : "s"}`;
        if (fullscreenContext) fullscreenContext.textContent = label;
        if (fullscreenCount) fullscreenCount.textContent = countLabel;
        if (resultCount) resultCount.textContent = `${label} · ${countLabel}`;
        if (selectAllResultsBtn) selectAllResultsBtn.textContent = total ? `Select all ${total} results` : "Select all results";
    }

    function closeCategoryActions() {
        if (!categoryActionsMenu) return;
        categoryActionsMenu.hidden = true;
        categoryActionsToggle?.setAttribute("aria-expanded", "false");
    }

    function renderCategoryRail(summary, activeCategory = "") {
        if (!categoryRail) return;
        const categories = Array.isArray(summary?.categories) ? summary.categories : [];
        const counts = summary?.counts || {};
        if (railAllCount) railAllCount.textContent = Number.isFinite(summary?.totalCount) ? summary.totalCount : "";
        if (railFavoriteCount) railFavoriteCount.textContent = "";
        if (railUncategorizedCount) {
            const categorized = categories.reduce((total, category) => total + Number(counts[category] || 0), 0);
            const total = Number(summary?.totalCount || 0);
            railUncategorizedCount.textContent = total ? Math.max(0, total - categorized) : "";
        }
        categoryRail.innerHTML = categories.map(category => `
            <button type="button" class="localprompt-card-manager-rail-item${category === activeCategory ? " active" : ""}" data-browse-rail-category="${escapeHtml(category)}">
                <span class="localprompt-card-manager-rail-label" title="${escapeHtml(category)}">${escapeHtml(category)}</span>
                <span>${Number(counts[category] || 0)}</span>
            </button>
        `).join("");
        root.querySelectorAll("[data-browse-rail-category], [data-browse-rail-favorites]").forEach(button => {
            const isActive = button.hasAttribute("data-browse-rail-favorites")
                ? browseFavoritesOnly
                : browseUncategorizedOnly
                    ? button.dataset.browseRailCategory === "__uncategorized__"
                    : (button.dataset.browseRailCategory || "") === activeCategory;
            button.classList.toggle("active", isActive);
        });
    }

    function updateFullscreenButton() {
        if (!fullscreenToggleBtn) return;
        fullscreenToggleBtn.textContent = "Full screen";
        fullscreenToggleBtn.title = isFullscreen
            ? "Return Card Manager to the node workspace"
            : "Expand Card Manager to the full ComfyUI screen";
        fullscreenToggleBtn.setAttribute("aria-pressed", String(isFullscreen));
        fullscreenExitBtn?.setAttribute("aria-pressed", String(isFullscreen));
    }

    function setFullscreen(nextState) {
        isFullscreen = Boolean(nextState);
        root.classList.toggle("localprompt-card-manager-fullscreen", isFullscreen);
        if (isFullscreen) {
            document.body.appendChild(root);
        } else if (originalParent?.isConnected) {
            originalParent.appendChild(root);
        }
        updateFullscreenButton();
        updateBrowseContext();
    }

    function close() {
        document.removeEventListener("keydown", handleFullscreenKeydown);
        if (isFullscreen) setFullscreen(false);
        closeSurface();
    }

    function handleFullscreenKeydown(event) {
        if (event.key === "Escape" && isFullscreen) {
            event.preventDefault();
            setFullscreen(false);
        }
    }

    document.addEventListener("keydown", handleFullscreenKeydown);
    updateFullscreenButton();

    if (isWorkspace) {
        root.addEventListener("click", (event) => {
            const libraryPageButton = event.target.closest?.("[data-library-page]");
            if (!libraryPageButton || !isFullscreen || forwardingLibraryNavigation) return;

            // The workspace controller owns these actions through event delegation on
            // the original host, so put the panel back before forwarding the click.
            forwardingLibraryNavigation = true;
            setFullscreen(false);
            libraryPageButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            forwardingLibraryNavigation = false;
        });
    }

    async function loadBrowseCategoryOptions(selectedCategory = "") {
        const summary = typeof galleryNode.getCategorySummary === "function"
            ? await galleryNode.getCategorySummary()
            : {
                categories: await galleryNode.getCategories(),
                counts: {},
                totalCount: null,
            };
        const categories = Array.isArray(summary?.categories) ? summary.categories : [];
        populateCategorySelect(
            categorySelect,
            categories,
            summary?.counts,
            summary?.totalCount,
            selectedCategory,
        );
        renderCategoryRail(summary, selectedCategory);
    }

    if (isWorkspace && grid) {
        grid.addEventListener("scroll", () => {
            const nextScrollTop = grid.scrollTop;
            const scrollDelta = nextScrollTop - lastScrollTop;
            if (scrollDelta > 0) {
                downwardScrollDistance += scrollDelta;
                upwardScrollDistance = 0;
            } else if (scrollDelta < 0) {
                upwardScrollDistance += Math.abs(scrollDelta);
                downwardScrollDistance = 0;
            }
            if (downwardScrollDistance >= 8 && nextScrollTop > 36 && !browseManageMode) {
                root.querySelector(".localprompt-browse-toolbar")?.classList.add("toolbar-hidden");
                downwardScrollDistance = 0;
            } else if (upwardScrollDistance >= 8 || nextScrollTop <= 12) {
                root.querySelector(".localprompt-browse-toolbar")?.classList.remove("toolbar-hidden");
                upwardScrollDistance = 0;
            }
            lastScrollTop = Math.max(0, nextScrollTop);
        }, { passive: true });
    }

    function updateBrowseBulkToolbar() {
        if (bulkToolbar) {
            bulkToolbar.style.display = browseManageMode ? "flex" : "none";
        }
        if (bulkSummary) {
            bulkSummary.textContent = `${getBulkSelectionCount()} selected${bulkQuerySelection ? " (all matching results)" : ""}`;
        }
        if (manageToggleBtn) {
            manageToggleBtn.classList.toggle("active", browseManageMode);
            manageToggleBtn.textContent = browseManageMode ? "Done" : "Manage";
        }
        root.classList.toggle("localprompt-card-manager-managing", browseManageMode);
        if (browseManageMode) {
            root.querySelector(".localprompt-browse-toolbar")?.classList.remove("toolbar-hidden");
        }
        if (clearSelectedBtn) clearSelectedBtn.disabled = getBulkSelectionCount() === 0;
        if (moveSelectedBtn) moveSelectedBtn.disabled = getBulkSelectionCount() === 0;
        if (deleteSelectedBtn) deleteSelectedBtn.disabled = getBulkSelectionCount() === 0 || !!bulkQuerySelection;
        if (editSelectedBtn) editSelectedBtn.disabled = getBulkSelectionCount() === 0;
    }

    async function loadBrowseGallery(page = 1) {
        const loadSequence = ++browseLoadSequence;
        const filter = filterInput.value;
        const category = categorySelect.value;
        const sortScope = { category };
        const sortMode = getSortMode(sortScope);
        const data = await galleryNode.getPrompts(filter, "OR", page, [], category, browseFavoritesOnly, 30, sortMode, browseUncategorizedOnly);
        if (loadSequence !== browseLoadSequence) return;
        lastBrowseData = data;
        updateBrowseContext(Number(data.total_prompts || 0));

        currentPage = data.current_page || 1;
        totalPages = data.total_pages || 1;
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;

        const selectedIds = new Set(nodeInstance.promptData.map(prompt => String(prompt.prompt_id)));
        grid.innerHTML = "";
        updateBrowseBulkToolbar();

        (data.prompts || []).forEach(prompt => {
            const promptId = String(prompt.id);
            const item = document.createElement("div");
            item.className = `localprompt-gallery-item ${selectedIds.has(promptId) ? "selected" : ""}`;
            if (browseManageMode) item.classList.add("manage-mode");
            if (bulkQuerySelection
                ? !bulkQuerySelection.exclusions.has(promptId)
                : bulkSelectedPromptIds.has(promptId)) item.classList.add("bulk-selected");
            item.dataset.promptId = promptId;
            item.style.position = "relative";

            const roleColor = getCategoryRoleColor(prompt);
            if (roleColor) {
                item.style.borderColor = roleColor;
                item.style.boxShadow = `inset 0 0 0 1px ${roleColor}55`;
            }

            const hasPreview = prompt.preview_type && prompt.preview_url;
            item.innerHTML = buildPromptCardHtml(prompt, hasPreview);
            bindPreviewAspectRatio(item);

            item.addEventListener("click", (event) => {
                if (suppressNextCardClick) {
                    suppressNextCardClick = false;
                    return;
                }
                if (event.target.classList.contains("favorite-btn")) return;
                if (browseManageMode) {
                    if (bulkQuerySelection) {
                        const excluded = bulkQuerySelection.exclusions;
                        if (excluded.has(promptId)) {
                            excluded.delete(promptId);
                            item.classList.add("bulk-selected");
                        } else {
                            excluded.add(promptId);
                            item.classList.remove("bulk-selected");
                        }
                    } else {
                        if (bulkSelectedPromptIds.has(promptId)) {
                            bulkSelectedPromptIds.delete(promptId);
                            item.classList.remove("bulk-selected");
                        } else {
                            bulkSelectedPromptIds.add(promptId);
                            item.classList.add("bulk-selected");
                        }
                    }
                    updateBrowseBulkToolbar();
                    return;
                }
                addPromptToSelection(prompt);
                item.classList.toggle("selected", nodeInstance.promptData.some(entry => String(entry.prompt_id) === promptId));
            });

            item.querySelector(".favorite-btn").addEventListener("click", async (event) => {
                event.stopPropagation();
                const button = event.target;
                const wasFavorited = button.classList.contains("favorited");
                button.classList.toggle("favorited", !wasFavorited);

                galleryNode.toggleFavorite(prompt.id).then(async (result) => {
                    if (result?.status === "ok") {
                        await syncPinnedOrderForFavorite(prompt.id, result.favorite);
                    }
                    refreshAllSections();
                });
            });

            attachInfoPopup(item, prompt);

            item.addEventListener("contextmenu", (event) => {
                event.preventDefault();
                showContextMenu(prompt, event.clientX, event.clientY, async () => {
                    await loadBrowseCategoryOptions(categorySelect.value);
                    await loadBrowseGallery(currentPage);
                    refreshAllSections();
                });
            });

            grid.appendChild(item);
        });
    }

    closeBtn?.addEventListener("click", close);
    if (!isWorkspace) closeOnOverlayClick(root, close);

    fullscreenToggleBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        setFullscreen(!isFullscreen);
    });
    fullscreenExitBtn?.addEventListener("click", () => setFullscreen(false));

    categoryActionsToggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = categoryActionsMenu.hidden;
        categoryActionsMenu.hidden = !willOpen;
        categoryActionsToggle.setAttribute("aria-expanded", String(willOpen));
    });
    categoryActionsMenu?.addEventListener("click", event => event.stopPropagation());
    root.addEventListener("click", closeCategoryActions);

    await loadBrowseCategoryOptions();
    updateCategoryActionButtons(root, categorySelect.value);
    if (sortSelect) sortSelect.value = getSortMode({ category: categorySelect.value || "" });

    manageToggleBtn?.addEventListener("click", () => {
        browseManageMode = !browseManageMode;
        if (!browseManageMode) {
            clearBulkSelection();
        }
        updateBrowseBulkToolbar();
        loadBrowseGallery(currentPage);
    });

    selectVisibleBtn?.addEventListener("click", () => {
        grid.querySelectorAll(".localprompt-gallery-item[data-prompt-id]").forEach(item => {
            const promptId = item.dataset.promptId;
            if (bulkQuerySelection) bulkQuerySelection.exclusions.delete(promptId);
            else bulkSelectedPromptIds.add(promptId);
        });
        updateBrowseBulkToolbar();
        loadBrowseGallery(currentPage);
    });

    selectAllResultsBtn?.addEventListener("click", () => {
        const selectedCount = Number(lastBrowseData?.total_prompts || 0);
        if (!selectedCount) return;
        bulkSelectedPromptIds.clear();
        bulkQuerySelection = {
            filter_name: filterInput.value.trim(),
            category: categorySelect.value || "",
            favorites_only: browseFavoritesOnly,
            uncategorized_only: browseUncategorizedOnly,
            exclusions: new Set(),
            selectedCount,
        };
        updateBrowseBulkToolbar();
        loadBrowseGallery(currentPage);
    });

    clearSelectedBtn?.addEventListener("click", () => {
        clearBulkSelection();
        if (bulkStatus) bulkStatus.textContent = "";
        updateBrowseBulkToolbar();
        loadBrowseGallery(currentPage);
    });

    editSelectedBtn?.addEventListener("click", async () => {
        if (!getBulkSelectionCount()) return;
        const summary = await galleryNode.getCategorySummary();
        await showBulkEditDrawer({
            galleryNode,
            selectedCount: getBulkSelectionCount(),
            categories: summary?.categories || [],
            selection: getBulkSelectionDescriptor(),
            onApplied: async result => {
                const updatedPrompts = await galleryNode.getPromptsByIds(result.updated_ids || []);
                const updatedById = new Map(updatedPrompts.map(prompt => [String(prompt.id), prompt]));
                let changedSelection = false;
                nodeInstance.promptData.forEach(entry => {
                    const prompt = updatedById.get(String(entry.prompt_id ?? entry.id));
                    if (!prompt) return;
                    Object.assign(entry, {
                        id: prompt.id,
                        prompt_id: prompt.id,
                        name: prompt.name,
                        prompt_text: prompt.prompt_text,
                        category: prompt.category,
                    });
                    changedSelection = true;
                });
                if (changedSelection) saveSelectionData({ redrawCanvas: false });
                clearBulkSelection();
                await loadCategories();
                await loadBrowseCategoryOptions(categorySelect.value);
                await loadBrowseGallery(1);
                await refreshAllSections();
                if (bulkStatus) bulkStatus.textContent = `${result.changed_count || 0} card${result.changed_count === 1 ? "" : "s"} updated.`;
            },
        });
        updateBrowseBulkToolbar();
    });

    moveSelectedBtn?.addEventListener("click", async () => {
        if (getBulkSelectionCount() === 0) return;
        const summary = await galleryNode.getCategorySummary();
        const targetCategory = await openBulkMoveDialog({
            categories: summary?.categories || [],
            counts: summary?.counts || {},
            selectedCount: getBulkSelectionCount(),
            currentCategory: categorySelect.value,
        });
        if (targetCategory === null) return;

        moveSelectedBtn.disabled = true;
        let result;
        try {
            if (bulkQuerySelection) {
                const selection = getBulkSelectionDescriptor();
                const operations = { category: { mode: "set", value: targetCategory } };
                const preview = await galleryNode.bulkEdit(selection, operations, { preview: true, sampleLimit: 0 });
                result = await galleryNode.bulkEdit(selection, operations, {
                    preview: false,
                    baseRevision: preview.revision,
                    sampleLimit: 0,
                });
                result.moved_count = result.changed_count;
            } else {
                result = await galleryNode.movePromptsBulk(Array.from(bulkSelectedPromptIds), targetCategory);
            }
        } catch (error) {
            if (bulkStatus) bulkStatus.textContent = error.message || "Move failed.";
            updateBrowseBulkToolbar();
            return;
        }
        if (!result || result.status !== "ok") {
            if (bulkStatus) bulkStatus.textContent = result?.message || "Move failed.";
            updateBrowseBulkToolbar();
            return;
        }

        clearBulkSelection();
        if (bulkStatus) {
            const movedCount = Number(result.moved_count || 0);
            bulkStatus.textContent = movedCount
                ? `${movedCount} card${movedCount === 1 ? "" : "s"} moved.`
                : "Cards were already in that category.";
        }
        await loadCategories();
        await loadBrowseCategoryOptions(categorySelect.value);
        await loadBrowseGallery(1);
        await refreshAllSections();
        if (Array.isArray(result.missing_ids) && result.missing_ids.length && bulkStatus) {
            bulkStatus.textContent += ` ${result.missing_ids.length} missing.`;
        }
    });

    deleteSelectedBtn?.addEventListener("click", async () => {
        if (bulkSelectedPromptIds.size === 0) return;
        const idsToDelete = Array.from(bulkSelectedPromptIds);
        const confirmed = confirm(`Delete ${idsToDelete.length} selected prompts?`);
        if (!confirmed) return;

        const result = await galleryNode.deletePromptsBulk(idsToDelete);
        if (!result || result.status !== "ok") {
            alert(`Bulk delete failed: ${result?.message || "Unknown error"}`);
            return;
        }

        nodeInstance.promptData = nodeInstance.promptData.filter(
            entry => !bulkSelectedPromptIds.has(String(entry.prompt_id))
        );
        saveSelectionData();
        bulkSelectedPromptIds.clear();
        await loadCategories();
        await loadBrowseCategoryOptions(categorySelect.value);
        await loadBrowseGallery(1);
        await refreshAllSections();
        if (Array.isArray(result.missing_ids) && result.missing_ids.length) {
            alert(`Deleted ${result.deleted_count || 0} prompt(s). ${result.missing_ids.length} item(s) were already missing.`);
        }
    });

    let filterTimeout = null;
    filterInput.addEventListener("input", () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            if (bulkQuerySelection) clearBulkSelection();
            loadBrowseGallery(1);
            updateBrowseBulkToolbar();
        }, 300);
    });

    categorySelect.addEventListener("change", () => {
        browseFavoritesOnly = false;
        browseUncategorizedOnly = false;
        if (bulkQuerySelection) clearBulkSelection();
        if (sortSelect) sortSelect.value = getSortMode({ category: categorySelect.value || "" });
        loadBrowseGallery(1);
        loadBrowseCategoryOptions(categorySelect.value);
        updateCategoryActionButtons(root, categorySelect.value);
        updateBrowseBulkToolbar();
    });

    categoryRail?.addEventListener("click", event => {
        const button = event.target.closest?.("[data-browse-rail-category]");
        if (!button || !categoryRail.contains(button)) return;
            const isUncategorized = button.dataset.browseRailCategory === "__uncategorized__";
            const value = isUncategorized ? "" : button.dataset.browseRailCategory;
            browseFavoritesOnly = false;
            browseUncategorizedOnly = isUncategorized;
            categorySelect.value = value;
            if (bulkQuerySelection) clearBulkSelection();
            loadBrowseGallery(1);
            loadBrowseCategoryOptions(value);
            root.querySelectorAll("[data-browse-rail-category], [data-browse-rail-favorites]").forEach(railButton => railButton.classList.toggle("active", railButton === button));
            updateCategoryActionButtons(root, value);
            updateBrowseBulkToolbar();
    });
    root.querySelector("[data-browse-rail-category='']")?.addEventListener("click", () => {
        browseFavoritesOnly = false;
        browseUncategorizedOnly = false;
        categorySelect.value = "";
        if (bulkQuerySelection) clearBulkSelection();
        loadBrowseGallery(1);
        loadBrowseCategoryOptions("");
        root.querySelectorAll("[data-browse-rail-category], [data-browse-rail-favorites]").forEach(button => button.classList.toggle("active", button.dataset.browseRailCategory === ""));
        updateCategoryActionButtons(root, "");
        updateBrowseBulkToolbar();
    });
    root.querySelector("[data-browse-rail-category='__uncategorized__']")?.addEventListener("click", () => {
        browseFavoritesOnly = false;
        browseUncategorizedOnly = true;
        categorySelect.value = "";
        if (bulkQuerySelection) clearBulkSelection();
        loadBrowseGallery(1);
        loadBrowseCategoryOptions("");
        root.querySelectorAll("[data-browse-rail-category], [data-browse-rail-favorites]").forEach(button => button.classList.toggle("active", button.dataset.browseRailCategory === "__uncategorized__"));
        updateCategoryActionButtons(root, "");
        updateBrowseBulkToolbar();
    });
    root.querySelector("[data-browse-rail-favorites]")?.addEventListener("click", () => {
        browseFavoritesOnly = true;
        browseUncategorizedOnly = false;
        categorySelect.value = "";
        if (bulkQuerySelection) clearBulkSelection();
        if (sortSelect) sortSelect.value = getSortMode({ category: "" });
        loadBrowseGallery(1);
        loadBrowseCategoryOptions("");
        root.querySelectorAll("[data-browse-rail-category], [data-browse-rail-favorites]").forEach(button => {
            button.classList.toggle("active", button.hasAttribute("data-browse-rail-favorites"));
        });
        updateCategoryActionButtons(root, "");
        updateBrowseBulkToolbar();
    });

    sortSelect?.addEventListener("change", async () => {
        if (typeof setSortMode === "function") {
            await setSortMode(sortSelect.value, {
                scope: { category: categorySelect.value || "" },
                reload: false,
            });
        }
        await loadBrowseGallery(1);
    });

    prevBtn.addEventListener("click", () => loadBrowseGallery(currentPage - 1));
    nextBtn.addEventListener("click", () => loadBrowseGallery(currentPage + 1));

    root.querySelector("#browse-export-category")?.addEventListener("click", async () => {
        closeCategoryActions();
        const categoryToExport = categorySelect.value;
        if (!categoryToExport) {
            alert("Please select a category to export.");
            return;
        }
        if (typeof onExportCategory === "function") {
            await onExportCategory(categoryToExport);
        }
    });

    root.querySelector("#browse-rename-category")?.addEventListener("click", async () => {
        closeCategoryActions();
        await renameCategoryWithPrompt(categorySelect.value, async (newCategory) => {
            await loadBrowseCategoryOptions(newCategory);
            updateCategoryActionButtons(root, categorySelect.value);
            await loadBrowseGallery(1);
            refreshAllSections();
        });
    });

    root.querySelector("#browse-delete-category")?.addEventListener("click", async () => {
        closeCategoryActions();
        const categoryToDelete = categorySelect.value;
        if (!categoryToDelete) {
            alert("Please select a category to delete.");
            return;
        }

        const confirmed = confirm(
            `DELETE ENTIRE CATEGORY\n\n` +
            `Are you sure you want to delete the category "${categoryToDelete}" and ALL prompts within it?\n\n` +
            `This action cannot be undone!`
        );
        if (!confirmed) return;

        const doubleConfirmed = confirm(
            `Final confirmation:\n\nDelete ALL prompts in "${categoryToDelete}"?`
        );
        if (!doubleConfirmed) return;

        try {
            const result = await galleryNode.deleteCategory(categoryToDelete);
            if (result.status === "ok") {
                alert(result.message);
                await loadBrowseCategoryOptions();
                updateCategoryActionButtons(root, "");
                await loadBrowseGallery(1);
                refreshAllSections();
            } else {
                alert("Error: " + (result.message || "Failed to delete category"));
            }
        } catch (error) {
            console.error("Error deleting category:", error);
            alert("Error deleting category: " + error.message);
        }
    });

    await loadBrowseGallery(1);
}

export const showBrowseModal = showCardManagerModal;
