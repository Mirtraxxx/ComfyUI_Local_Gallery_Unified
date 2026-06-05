import { escapeHtml } from "../shared/dom.js";

function closeOnOverlayClick(overlay) {
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            overlay.remove();
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

function populateCategorySelect(categorySelect, categories, selectedCategory = "") {
    categorySelect.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
    if (selectedCategory && categories.includes(selectedCategory)) {
        categorySelect.value = selectedCategory;
    }
}

function updateCategoryActionButtons(overlay, categoryValue) {
    const renameCategoryBtn = overlay.querySelector("#browse-rename-category");
    const deleteCategoryBtn = overlay.querySelector("#browse-delete-category");
    if (renameCategoryBtn) {
        renameCategoryBtn.style.display = categoryValue ? "block" : "none";
    }
    if (deleteCategoryBtn) {
        deleteCategoryBtn.style.display = categoryValue ? "block" : "none";
    }
}

function buildPromptCardHtml(prompt, hasPreview) {
    const safeName = escapeHtml(prompt.name);
    const previewHtml = hasPreview
        ? `<img src="${escapeHtml(prompt.preview_url)}" alt="${safeName}">`
        : "No Preview";
    return `
        <button class="localprompt-info-btn" title="View Info">!</button>
        <div class="item-preview ${hasPreview ? "" : "no-img"}">
            ${previewHtml}
        </div>
        <div class="item-info">
            <div class="item-name" title="${safeName}">${safeName}</div>
        </div>
        <button class="favorite-btn ${prompt.favorite ? "favorited" : ""}" title="Pin/Unpin">*</button>
    `;
}

export async function showBrowseModal({
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
    getCategoryRoleColor,
    workspaceContainer = null,
    onClose = null,
    librarySubnavHtml = "",
}) {
    let browseManageMode = false;
    const bulkSelectedPromptIds = new Set();
    const surface = createBrowseSurface({ workspaceContainer, onClose });
    const { root, close, isWorkspace } = surface;
    root.innerHTML = `
        <div class="localprompt-modal${isWorkspace ? " localprompt-workspace-page" : ""}">
            <div class="${isWorkspace ? "localprompt-workspace-header" : "localprompt-modal-header"}">
                <div class="localprompt-workspace-title">
                    <h3>Cards</h3>
                    ${isWorkspace ? "<p>Browse, search, pin, add, and manage prompt cards.</p>" : ""}
                </div>
                <button class="${isWorkspace ? "localprompt-workspace-back" : "localprompt-modal-close"}">${isWorkspace ? "Back to Gallery" : "x"}</button>
            </div>
            ${isWorkspace ? librarySubnavHtml : ""}
            <div class="${isWorkspace ? "localprompt-workspace-body" : "localprompt-modal-content"}">
                <div class="localprompt-browse-toolbar">
                    <input type="text" id="browse-filter" placeholder="Search cards..." style="padding: 8px 10px; background: #111820; border: 1px solid #3b4652; color: #ddd; border-radius: 7px; font-size: 12px;">
                    <select id="browse-category" style="padding: 8px 10px; background: #111820; border: 1px solid #3b4652; color: #ddd; border-radius: 7px; font-size: 12px;"></select>
                    <button id="browse-manage-toggle" class="localprompt-btn" style="padding: 8px 12px;">Manage</button>
                    <button id="browse-rename-category" class="localprompt-btn" style="padding: 8px 12px; display: none;" title="Rename category">Rename</button>
                    <button id="browse-delete-category" class="localprompt-btn" style="padding: 8px 12px; background: #5a3030; display: none;" title="Delete entire category">Delete</button>
                </div>
                <div id="browse-bulk-toolbar" class="localprompt-bulk-toolbar" style="display: none; margin-bottom: 12px;">
                    <span id="browse-bulk-summary" class="localprompt-bulk-summary">0 selected</span>
                    <button id="browse-select-visible" class="localprompt-btn">Select Visible</button>
                    <button id="browse-clear-selected" class="localprompt-btn">Clear Selection</button>
                    <button id="browse-delete-selected" class="localprompt-btn localprompt-clear-btn" style="background: #6a3a3a; border-color: #8a4a4a;">Delete Selected</button>
                </div>
                <div id="browse-gallery-grid" class="localprompt-gallery-grid"></div>
            </div>
            <div class="${isWorkspace ? "localprompt-workspace-footer" : ""}" style="display: flex; justify-content: center; gap: 8px;">
                <button id="browse-prev" class="localprompt-btn">Prev</button>
                <span id="browse-page-info" style="font-size: 11px; color: #888; padding: 5px 10px;">Page 1 of 1</span>
                <button id="browse-next" class="localprompt-btn">Next</button>
            </div>
        </div>
    `;

    const closeBtn = root.querySelector(isWorkspace ? ".localprompt-workspace-back" : ".localprompt-modal-close");
    const filterInput = root.querySelector("#browse-filter");
    const categorySelect = root.querySelector("#browse-category");
    const manageToggleBtn = root.querySelector("#browse-manage-toggle");
    const bulkToolbar = root.querySelector("#browse-bulk-toolbar");
    const bulkSummary = root.querySelector("#browse-bulk-summary");
    const selectVisibleBtn = root.querySelector("#browse-select-visible");
    const clearSelectedBtn = root.querySelector("#browse-clear-selected");
    const deleteSelectedBtn = root.querySelector("#browse-delete-selected");
    const grid = root.querySelector("#browse-gallery-grid");
    const prevBtn = root.querySelector("#browse-prev");
    const nextBtn = root.querySelector("#browse-next");
    const pageInfo = root.querySelector("#browse-page-info");

    let currentPage = 1;
    let totalPages = 1;

    function updateBrowseBulkToolbar() {
        if (bulkToolbar) {
            bulkToolbar.style.display = browseManageMode ? "flex" : "none";
        }
        if (bulkSummary) {
            bulkSummary.textContent = `${bulkSelectedPromptIds.size} selected`;
        }
        if (manageToggleBtn) {
            manageToggleBtn.classList.toggle("active", browseManageMode);
            manageToggleBtn.textContent = browseManageMode ? "Done" : "Manage";
        }
        if (clearSelectedBtn) clearSelectedBtn.disabled = bulkSelectedPromptIds.size === 0;
        if (deleteSelectedBtn) deleteSelectedBtn.disabled = bulkSelectedPromptIds.size === 0;
    }

    async function loadBrowseGallery(page = 1) {
        const filter = filterInput.value;
        const category = categorySelect.value;
        const data = await galleryNode.getPrompts(filter, "OR", page, [], category, false, 30);

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
            if (bulkSelectedPromptIds.has(promptId)) item.classList.add("selected");
            item.dataset.promptId = promptId;
            item.style.position = "relative";

            const roleColor = getCategoryRoleColor(prompt);
            if (roleColor) {
                item.style.borderColor = roleColor;
                item.style.boxShadow = `inset 0 0 0 1px ${roleColor}55`;
            }

            const hasPreview = prompt.preview_type && prompt.preview_url;
            item.innerHTML = buildPromptCardHtml(prompt, hasPreview);

            item.addEventListener("click", (event) => {
                if (event.target.classList.contains("favorite-btn")) return;
                if (browseManageMode) {
                    if (bulkSelectedPromptIds.has(promptId)) {
                        bulkSelectedPromptIds.delete(promptId);
                        item.classList.remove("selected");
                    } else {
                        bulkSelectedPromptIds.add(promptId);
                        item.classList.add("selected");
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
                    await loadBrowseGallery(currentPage);
                    refreshAllSections();
                });
            });

            grid.appendChild(item);
        });
    }

    closeBtn.addEventListener("click", close);
    if (!isWorkspace) closeOnOverlayClick(root);

    populateCategorySelect(categorySelect, await galleryNode.getCategories());

    manageToggleBtn?.addEventListener("click", () => {
        browseManageMode = !browseManageMode;
        if (!browseManageMode) {
            bulkSelectedPromptIds.clear();
        }
        updateBrowseBulkToolbar();
        loadBrowseGallery(currentPage);
    });

    selectVisibleBtn?.addEventListener("click", () => {
        grid.querySelectorAll(".localprompt-gallery-item[data-prompt-id]").forEach(item => {
            bulkSelectedPromptIds.add(item.dataset.promptId);
        });
        updateBrowseBulkToolbar();
        loadBrowseGallery(currentPage);
    });

    clearSelectedBtn?.addEventListener("click", () => {
        bulkSelectedPromptIds.clear();
        updateBrowseBulkToolbar();
        loadBrowseGallery(currentPage);
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
        await loadBrowseGallery(1);
        await refreshAllSections();
        if (Array.isArray(result.missing_ids) && result.missing_ids.length) {
            alert(`Deleted ${result.deleted_count || 0} prompt(s). ${result.missing_ids.length} item(s) were already missing.`);
        }
    });

    let filterTimeout = null;
    filterInput.addEventListener("input", () => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => loadBrowseGallery(1), 300);
    });

    categorySelect.addEventListener("change", () => {
        loadBrowseGallery(1);
        updateCategoryActionButtons(root, categorySelect.value);
    });

    prevBtn.addEventListener("click", () => loadBrowseGallery(currentPage - 1));
    nextBtn.addEventListener("click", () => loadBrowseGallery(currentPage + 1));

    root.querySelector("#browse-rename-category")?.addEventListener("click", async () => {
        await renameCategoryWithPrompt(categorySelect.value, async (newCategory) => {
            const newCategories = await galleryNode.getCategories();
            populateCategorySelect(categorySelect, newCategories, newCategory);
            updateCategoryActionButtons(root, categorySelect.value);
            await loadBrowseGallery(1);
            refreshAllSections();
        });
    });

    root.querySelector("#browse-delete-category")?.addEventListener("click", async () => {
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
                populateCategorySelect(categorySelect, await galleryNode.getCategories());
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
