import { escapeHtml } from "../shared/dom.js";

function closeOnOverlayClick(overlay) {
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            overlay.remove();
        }
    });
}

function populatePromptSourceSelect({
    sourceSelect,
    app,
    nodeInstance,
    isShowTextNode,
    saveNodeProperties,
    updatePromptSourceStatus,
}) {
    if (!sourceSelect || !app.graph) {
        return;
    }

    const allNodes = app.graph._nodes || [];
    const textNodes = allNodes.filter(node => isShowTextNode(node) && node !== nodeInstance);

    textNodes.forEach(node => {
        const option = document.createElement("option");
        option.value = node.id;
        option.textContent = node.title || node.type || `Node ${node.id}`;
        sourceSelect.appendChild(option);
    });

    if (nodeInstance.properties?.prompt_source_node_id != null) {
        sourceSelect.value = nodeInstance.properties.prompt_source_node_id;
    }

    sourceSelect.addEventListener("change", (event) => {
        const sourceId = event.target.value;
        if (sourceId) {
            const selectedNode = textNodes.find(node => String(node.id) === sourceId);
            if (selectedNode) {
                nodeInstance.properties.prompt_source_node_id = selectedNode.id;
                nodeInstance.properties.prompt_source_node_title = selectedNode.title || selectedNode.type || `Node ${selectedNode.id}`;
                saveNodeProperties();
                updatePromptSourceStatus();
                return;
            }
        }
        nodeInstance.properties.prompt_source_node_id = null;
        nodeInstance.properties.prompt_source_node_title = null;
        saveNodeProperties();
        updatePromptSourceStatus();
    });
}

function openCategoryColorPopover({
    anchor,
    category,
    draftCategoryColors,
    palette,
    getNearestPaletteColor,
    getCategoryRoleColor,
    closeCategoryColorPopover,
    renderCategoryTabOrderList,
    setActiveCategoryColorPopover,
}) {
    closeCategoryColorPopover();
    const currentColor = getNearestPaletteColor(
        draftCategoryColors[category] || getCategoryRoleColor(category) || "#6c757d",
        palette || []
    );
    const rect = anchor.getBoundingClientRect();
    const popover = document.createElement("div");
    popover.style.cssText = `
        position: fixed;
        left: ${Math.max(8, rect.left)}px;
        top: ${rect.bottom + 6}px;
        z-index: 10002;
        padding: 10px;
        background: #161616;
        border: 1px solid #444;
        border-radius: 8px;
        box-shadow: 0 10px 24px rgba(0,0,0,0.45);
        display: grid;
        grid-template-columns: repeat(5, 18px);
        gap: 8px;
    `;

    palette.forEach(color => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.title = color;
        swatch.dataset.paletteColor = color;
        swatch.style.cssText = `
            width: 18px;
            height: 18px;
            padding: 0;
            border-radius: 999px;
            cursor: pointer;
            background: ${color};
            border: 2px solid ${color === currentColor ? "#f8f9fa" : "#2b2b2b"};
            box-shadow: ${color === currentColor ? `0 0 0 1px ${color}` : "none"};
        `;
        swatch.addEventListener("click", () => {
            draftCategoryColors[category] = color;
            closeCategoryColorPopover();
            renderCategoryTabOrderList();
        });
        popover.appendChild(swatch);
    });

    document.body.appendChild(popover);
    setActiveCategoryColorPopover(popover);

    requestAnimationFrame(() => {
        const popRect = popover.getBoundingClientRect();
        if (popRect.right > window.innerWidth - 8) {
            popover.style.left = `${Math.max(8, window.innerWidth - popRect.width - 8)}px`;
        }
        if (popRect.bottom > window.innerHeight - 8) {
            popover.style.top = `${Math.max(8, rect.top - popRect.height - 6)}px`;
        }
    });

    setTimeout(() => {
        const closeHandler = (event) => {
            if (!popover.contains(event.target) && event.target !== anchor) {
                closeCategoryColorPopover();
                document.removeEventListener("mousedown", closeHandler);
            }
        };
        document.addEventListener("mousedown", closeHandler);
    }, 0);
}

function createCategoryColorRow({
    category,
    roleColor,
    openColorPopover,
}) {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px;";
    row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
            <button type="button" data-category-color-trigger="${escapeHtml(category)}" style="width: 28px; height: 24px; padding: 0; border: 1px solid #444; background: #1a1a1a; border-radius: 6px; cursor: pointer; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;">
                <span style="width: 14px; height: 14px; border-radius: 999px; background: ${roleColor}; border: 1px solid #111;"></span>
            </button>
            <span style="font-size: 11px; color: #ddd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(category)}</span>
        </div>
    `;
    row.querySelector("[data-category-color-trigger]")?.addEventListener("click", (event) => {
        openColorPopover(event.currentTarget, category);
    });
    return row;
}

export async function showSettingsModal({
    uniqueId,
    app,
    nodeInstance,
    galleryNode,
    getLibraryTabs,
    getLibraryTabLayoutMode,
    getThumbnailSizePx,
    getActiveThumbnailSizePx,
    isShowTextNode,
    saveNodeProperties,
    updatePromptSourceStatus,
    getNearestPaletteColor,
    getCategoryRoleColor,
    applyThumbnailSizePreference,
    applyLibraryTabLayoutPreference,
    renderLibraryBar,
    getActiveLibraryTab,
    renderLibraryDrawer,
}) {
    const overlay = document.createElement("div");
    overlay.className = "localprompt-modal-overlay";
    const currentCategoryTabs = getLibraryTabs().filter(tab => !["active", "most_used", "pinned"].includes(tab));
    overlay.innerHTML = `
        <div class="localprompt-modal" style="width: 460px;">
            <div class="localprompt-modal-header">
                <h3>Settings</h3>
                <button class="localprompt-modal-close">x</button>
            </div>
            <div class="localprompt-modal-content">
                <div style="margin-bottom: 16px; padding: 12px; background: #1f1f1f; border: 1px solid #333; border-radius: 6px;">
                    <div style="font-size: 12px; font-weight: 500; color: #ddd; margin-bottom: 8px;">Prompt Source Configuration</div>
                    <select id="${uniqueId}-settings-prompt-source-select" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                        <option value="">-- None Selected --</option>
                    </select>
                    <div id="${uniqueId}-prompt-source-status" style="font-size: 11px; color: #aaa; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">No prompt source</div>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 11px; color: #888; margin-bottom: 6px;">Display Mode</label>
                    <select id="settings-display-mode" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                        <option value="text">Text Only</option>
                        <option value="thumbnails">With Thumbnails</option>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 11px; color: #888; margin-bottom: 6px;">Most Used Count</label>
                    <input type="number" id="settings-most-used-count" min="1" max="50" value="10" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 11px; color: #888; margin-bottom: 6px;">Category Tab Layout</label>
                    <select id="settings-library-tab-layout" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                        <option value="scroll">Scroll</option>
                        <option value="wrap">Wrap To Rows</option>
                    </select>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 11px; color: #888; margin-bottom: 6px;">Category Tab Colors</label>
                    <div style="font-size: 10px; color: #666; margin-bottom: 8px;">Drag category tabs directly on the node to reorder them.</div>
                    <div id="settings-category-order-list" style="max-height: 180px; overflow-y: auto; padding: 10px; background: #151515; border: 1px solid #333; border-radius: 6px;"></div>
                </div>
                <button id="settings-save" class="localprompt-btn active" style="width: 100%; padding: 10px;">Save Settings</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector(".localprompt-modal-close");
    const displayModeSelect = overlay.querySelector("#settings-display-mode");
    const mostUsedCountInput = overlay.querySelector("#settings-most-used-count");
    const tabLayoutSelect = overlay.querySelector("#settings-library-tab-layout");
    const saveBtn = overlay.querySelector("#settings-save");
    const palette = galleryNode.CATEGORY_ROLE_PALETTE || [];

    populatePromptSourceSelect({
        sourceSelect: overlay.querySelector(`#${uniqueId}-settings-prompt-source-select`),
        app,
        nodeInstance,
        isShowTextNode,
        saveNodeProperties,
        updatePromptSourceStatus,
    });
    updatePromptSourceStatus();

    displayModeSelect.value = nodeInstance.uiPrefs.display_mode || "text";
    mostUsedCountInput.value = nodeInstance.uiPrefs.most_used_count || 10;
    tabLayoutSelect.value = getLibraryTabLayoutMode();

    const orderList = overlay.querySelector("#settings-category-order-list");
    const draftCategoryColors = {
        ...(nodeInstance.uiPrefs.category_colors || {})
    };
    let activeCategoryColorPopover = null;

    const closeCategoryColorPopover = () => {
        if (activeCategoryColorPopover) {
            activeCategoryColorPopover.remove();
            activeCategoryColorPopover = null;
        }
    };

    const renderCategoryTabOrderList = () => {
        if (!orderList) return;
        if (!currentCategoryTabs.length) {
            orderList.innerHTML = '<div style="font-size: 11px; color: #666;">No category tabs added yet.</div>';
            return;
        }
        orderList.innerHTML = "";
        currentCategoryTabs.forEach(category => {
            const roleColor = getNearestPaletteColor(
                draftCategoryColors[category] || getCategoryRoleColor(category) || "#6c757d",
                palette
            );
            orderList.appendChild(createCategoryColorRow({
                category,
                roleColor,
                openColorPopover: (anchor, categoryName) => {
                    openCategoryColorPopover({
                        anchor,
                        category: categoryName,
                        draftCategoryColors,
                        palette,
                        getNearestPaletteColor,
                        getCategoryRoleColor,
                        closeCategoryColorPopover,
                        renderCategoryTabOrderList,
                        setActiveCategoryColorPopover: popover => {
                            activeCategoryColorPopover = popover;
                        },
                    });
                },
            }));
        });
    };
    renderCategoryTabOrderList();

    closeBtn.addEventListener("click", () => overlay.remove());
    closeOnOverlayClick(overlay);

    saveBtn.addEventListener("click", async () => {
        const categoryColors = {
            ...(nodeInstance.uiPrefs.category_colors || {})
        };
        currentCategoryTabs.forEach(category => {
            if (draftCategoryColors[category]) {
                categoryColors[category] = draftCategoryColors[category];
            }
        });
        const newPrefs = {
            ...nodeInstance.uiPrefs,
            display_mode: displayModeSelect.value,
            most_used_count: parseInt(mostUsedCountInput.value) || 10,
            library_tab_layout: tabLayoutSelect.value === "wrap" ? "wrap" : "scroll",
            thumbnail_size_px: getThumbnailSizePx(),
            active_thumbnail_size_px: getActiveThumbnailSizePx(),
            library_tabs: ["active", "most_used", "pinned", ...currentCategoryTabs],
            category_colors: categoryColors
        };
        await galleryNode.saveUiPrefs(newPrefs);
        nodeInstance.uiPrefs = newPrefs;
        applyThumbnailSizePreference();
        applyLibraryTabLayoutPreference();
        renderLibraryBar();

        const activeLibraryTab = getActiveLibraryTab();
        if (activeLibraryTab) {
            await renderLibraryDrawer(activeLibraryTab);
        }

        closeCategoryColorPopover();
        overlay.remove();
    });
}
