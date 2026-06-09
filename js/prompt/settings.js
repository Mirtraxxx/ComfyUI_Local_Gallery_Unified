import { escapeHtml } from "../shared/dom.js";

function closeOnOverlayClick(overlay) {
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            overlay.remove();
        }
    });
}

function createSettingsSurface({ workspaceContainer, onClose }) {
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

function createPinnedCategoryManagerRow({
    category,
    roleColor,
    buttons,
}) {
    const row = document.createElement("div");
    row.style.cssText = "display: flex; align-items: center; gap: 6px; padding: 7px; background: #151515; border: 1px solid #333; border-radius: 6px;";
    const label = document.createElement("div");
    label.textContent = category;
    label.title = category;
    label.style.cssText = `
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: ${roleColor};
        font-size: 11px;
    `;
    row.appendChild(label);

    buttons.forEach(({ label: text, title, disabled, onClick }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "localprompt-btn";
        button.textContent = text;
        button.title = title || text;
        button.disabled = !!disabled;
        button.style.cssText = "padding: 3px 7px; font-size: 10px;";
        button.addEventListener("click", onClick);
        row.appendChild(button);
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
    applyMetaTagsButtonSidePreference = null,
    renderLibraryBar,
    getActiveLibraryTab,
    renderLibraryDrawer,
    getPinnedCategories = null,
    savePinnedCategories = null,
    applyAutoHideToolbarPreference = null,
    applyActiveBorderThemePreference = null,
    workspaceContainer = null,
    onClose = null,
}) {
    const surface = createSettingsSurface({ workspaceContainer, onClose });
    const { root, close, isWorkspace } = surface;
    const currentCategoryTabs = getLibraryTabs().filter(tab => !["active", "most_used", "pinned"].includes(tab));
    const allCategories = await galleryNode.getCategories();
    root.innerHTML = `
        <div class="localprompt-modal${isWorkspace ? " localprompt-workspace-page localprompt-settings-page" : ""}" style="width: 460px;">
            <div class="${isWorkspace ? "localprompt-workspace-header" : "localprompt-modal-header"}">
                <div class="localprompt-workspace-title">
                    <h3>Settings</h3>
                    ${isWorkspace ? "<p>Adjust prompt source, display, and category preferences.</p>" : ""}
                </div>
                ${isWorkspace ? "" : '<button class="localprompt-modal-close" title="Close">x</button>'}
            </div>
            <div class="${isWorkspace ? "localprompt-workspace-body" : "localprompt-modal-content"}">
                <div class="${isWorkspace ? "localprompt-workspace-section" : ""}" style="margin-bottom: 16px; padding: 12px; background: #1f1f1f; border: 1px solid #333; border-radius: 6px;">
                    <div style="font-size: 12px; font-weight: 500; color: #ddd; margin-bottom: 8px;">Prompt Source Configuration</div>
                    <select id="${uniqueId}-settings-prompt-source-select" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                        <option value="">-- None Selected --</option>
                    </select>
                    <div id="${uniqueId}-prompt-source-status" style="font-size: 11px; color: #aaa; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">No prompt source</div>
                </div>
                <div class="${isWorkspace ? "localprompt-workspace-section" : ""}" style="margin-bottom: 16px;">
                    <h4>Display</h4>
                    <label style="display: block; font-size: 11px; color: #888; margin-bottom: 6px;">Display Mode</label>
                    <select id="settings-display-mode" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                        <option value="text">Text Only</option>
                        <option value="thumbnails">With Thumbnails</option>
                    </select>
                    <label style="display: block; font-size: 11px; color: #888; margin: 12px 0 6px;">Most Used Count</label>
                    <input type="number" id="settings-most-used-count" min="1" max="50" value="10" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #ddd; margin-top: 12px;">
                        <input type="checkbox" id="settings-auto-hide-toolbars">
                        <span>Auto-hide bottom toolbar</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #ddd; margin-top: 12px;">
                        <input type="checkbox" id="settings-active-sidebar-hover-open">
                        <span>Open Active overlay on hover</span>
                    </label>
                    <label style="display: block; font-size: 11px; color: #888; margin: 12px 0 6px;">Hidden Prompts Button Side</label>
                    <select id="settings-meta-tags-button-side" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                        <option value="right">Right side</option>
                        <option value="left">Left side</option>
                    </select>

                    <label style="display: block; font-size: 11px; color: #888; margin: 12px 0 6px;">Active Border Glow Theme</label>
                    <select id="settings-active-border-theme" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                        <option value="default">Classic Theme (Role/White)</option>
                        <option value="cyberpunk">Cyberpunk (Magenta & Cyan)</option>
                        <option value="sunset">Cosmic Sunset (Amber & Blue)</option>
                        <option value="aurora">Aurora Borealis (Green & Violet)</option>
                        <option value="ice">Electric Ice (Glacier Blue & Pink)</option>
                        <option value="fire-ice">Fire & Ice (Crimson & Cyan)</option>
                        <option value="golden-mint">Golden Mint (Gold & Mint Green)</option>
                        <option value="rainbow-sync">Rainbow Cycle (Synchronized)</option>
                        <option value="rainbow-split">Rainbow Cycle (Split Spectrum)</option>
                        <option value="custom">Custom Colors...</option>
                    </select>
                    <div id="settings-active-border-custom-colors" style="display: none; align-items: center; gap: 12px; margin-top: 8px;">
                        <div style="flex: 1; display: flex; align-items: center; gap: 6px;">
                            <label style="font-size: 10px; color: #aaa; white-space: nowrap;">Dot 1:</label>
                            <input type="color" id="settings-active-border-custom-1" style="width: 100%; height: 28px; padding: 2px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; cursor: pointer;">
                        </div>
                        <div style="flex: 1; display: flex; align-items: center; gap: 6px;">
                            <label style="font-size: 10px; color: #aaa; white-space: nowrap;">Dot 2:</label>
                            <input type="color" id="settings-active-border-custom-2" style="width: 100%; height: 28px; padding: 2px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; cursor: pointer;">
                        </div>
                    </div>
                </div>
                <div class="${isWorkspace ? "localprompt-workspace-section" : ""}" style="margin-bottom: 16px;">
                    <h4>Categories</h4>
                    <div style="font-size: 10px; color: #777; margin-bottom: 10px;">Manage which categories appear in the top row. Extra pinned categories appear under All Categories.</div>
                    <label style="display: block; font-size: 11px; color: #888; margin: 12px 0 6px;">Visible pinned categories</label>
                    <input type="number" id="settings-visible-pinned-category-count" min="1" max="20" value="5" style="width: 100%; padding: 8px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px;">
                    <label style="display: block; font-size: 11px; color: #888; margin: 12px 0 6px;">Category Colors</label>
                    <div style="font-size: 10px; color: #666; margin-bottom: 8px;">Drag category tabs directly on the node to reorder them.</div>
                    <div id="settings-category-order-list" style="max-height: 180px; overflow-y: auto; padding: 10px; background: #151515; border: 1px solid #333; border-radius: 6px;"></div>
                    <div style="height: 1px; background: #333; margin: 14px 0;"></div>
                    <h4 style="margin-top: 0;">Pinned Categories</h4>
                    <div style="font-size: 10px; color: #777; margin-bottom: 8px;">Pinned categories appear in the top row in this order.</div>
                    <div id="settings-pinned-category-list" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;"></div>
                    <h4 style="margin-top: 0;">Available Categories</h4>
                    <div id="settings-available-category-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
                </div>
            </div>
            <div class="${isWorkspace ? "localprompt-workspace-footer" : ""}" style="${isWorkspace ? "" : "padding: 0 16px 16px;"}">
                <button id="settings-save" class="localprompt-btn active" style="padding: 10px 16px;">Save Settings</button>
            </div>
        </div>
    `;

    const closeBtn = root.querySelector(isWorkspace ? ".localprompt-workspace-back" : ".localprompt-modal-close");
    const displayModeSelect = root.querySelector("#settings-display-mode");
    const mostUsedCountInput = root.querySelector("#settings-most-used-count");
    const autoHideToolbarsInput = root.querySelector("#settings-auto-hide-toolbars");
    const activeSidebarHoverOpenInput = root.querySelector("#settings-active-sidebar-hover-open");
    const metaTagsButtonSideSelect = root.querySelector("#settings-meta-tags-button-side");
    const visiblePinnedCountInput = root.querySelector("#settings-visible-pinned-category-count");
    const activeBorderThemeSelect = root.querySelector("#settings-active-border-theme");
    const activeBorderCustomColorsDiv = root.querySelector("#settings-active-border-custom-colors");
    const activeBorderCustom1Input = root.querySelector("#settings-active-border-custom-1");
    const activeBorderCustom2Input = root.querySelector("#settings-active-border-custom-2");
    const saveBtn = root.querySelector("#settings-save");
    const palette = galleryNode.CATEGORY_ROLE_PALETTE || [];

    populatePromptSourceSelect({
        sourceSelect: root.querySelector(`#${uniqueId}-settings-prompt-source-select`),
        app,
        nodeInstance,
        isShowTextNode,
        saveNodeProperties,
        updatePromptSourceStatus,
    });
    updatePromptSourceStatus();

    displayModeSelect.value = nodeInstance.uiPrefs.display_mode || "text";
    mostUsedCountInput.value = nodeInstance.uiPrefs.most_used_count || 10;
    if (autoHideToolbarsInput) autoHideToolbarsInput.checked = nodeInstance.uiPrefs.auto_hide_toolbars === true;
    if (activeSidebarHoverOpenInput) activeSidebarHoverOpenInput.checked = nodeInstance.uiPrefs.active_sidebar_hover_open !== false;
    if (metaTagsButtonSideSelect) {
        metaTagsButtonSideSelect.value = nodeInstance.uiPrefs.meta_tags_button_side === "left" ? "left" : "right";
    }
    visiblePinnedCountInput.value = Math.max(1, Math.min(20, parseInt(nodeInstance.uiPrefs.visible_pinned_category_count, 10) || 5));

    if (activeBorderThemeSelect) {
        activeBorderThemeSelect.value = nodeInstance.uiPrefs.active_border_theme || "default";
        activeBorderThemeSelect.addEventListener("change", () => {
            if (activeBorderCustomColorsDiv) {
                activeBorderCustomColorsDiv.style.display = activeBorderThemeSelect.value === "custom" ? "flex" : "none";
            }
        });
    }
    if (activeBorderCustom1Input) {
        activeBorderCustom1Input.value = nodeInstance.uiPrefs.active_border_custom_1 || "#ff0000";
    }
    if (activeBorderCustom2Input) {
        activeBorderCustom2Input.value = nodeInstance.uiPrefs.active_border_custom_2 || "#0000ff";
    }
    if (activeBorderCustomColorsDiv && activeBorderThemeSelect) {
        activeBorderCustomColorsDiv.style.display = activeBorderThemeSelect.value === "custom" ? "flex" : "none";
    }

    const orderList = root.querySelector("#settings-category-order-list");
    const pinnedCategoryList = root.querySelector("#settings-pinned-category-list");
    const availableCategoryList = root.querySelector("#settings-available-category-list");
    const draftCategoryColors = {
        ...(nodeInstance.uiPrefs.category_colors || {})
    };
    let draftPinnedCategories = typeof getPinnedCategories === "function"
        ? getPinnedCategories(allCategories)
        : (Array.isArray(nodeInstance.uiPrefs?.pinned_categories) ? [...nodeInstance.uiPrefs.pinned_categories] : []);
    draftPinnedCategories = [...new Set(draftPinnedCategories.filter(category => allCategories.includes(category)))];
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

    const renderPinnedCategoryManager = () => {
        if (!pinnedCategoryList || !availableCategoryList) return;
        const categoryColor = category => getNearestPaletteColor(
            draftCategoryColors[category] || getCategoryRoleColor(category) || "#aaa",
            palette
        );

        pinnedCategoryList.innerHTML = "";
        availableCategoryList.innerHTML = "";

        if (!draftPinnedCategories.length) {
            pinnedCategoryList.innerHTML = '<div style="font-size: 11px; color: #666; padding: 8px;">No pinned categories.</div>';
        }

        draftPinnedCategories.forEach((category, index) => {
            pinnedCategoryList.appendChild(createPinnedCategoryManagerRow({
                category,
                roleColor: categoryColor(category),
                buttons: [
                    {
                        label: "↑",
                        title: "Move up",
                        disabled: index === 0,
                        onClick: () => {
                            if (index === 0) return;
                            [draftPinnedCategories[index - 1], draftPinnedCategories[index]] = [draftPinnedCategories[index], draftPinnedCategories[index - 1]];
                            renderPinnedCategoryManager();
                        },
                    },
                    {
                        label: "↓",
                        title: "Move down",
                        disabled: index === draftPinnedCategories.length - 1,
                        onClick: () => {
                            if (index >= draftPinnedCategories.length - 1) return;
                            [draftPinnedCategories[index + 1], draftPinnedCategories[index]] = [draftPinnedCategories[index], draftPinnedCategories[index + 1]];
                            renderPinnedCategoryManager();
                        },
                    },
                    {
                        label: "Unpin",
                        onClick: () => {
                            draftPinnedCategories = draftPinnedCategories.filter(item => item !== category);
                            renderPinnedCategoryManager();
                        },
                    },
                ],
            }));
        });

        const pinnedSet = new Set(draftPinnedCategories);
        const availableCategories = allCategories.filter(category => !pinnedSet.has(category));
        if (!availableCategories.length) {
            availableCategoryList.innerHTML = '<div style="font-size: 11px; color: #666; padding: 8px;">All categories are pinned.</div>';
            return;
        }

        availableCategories.forEach(category => {
            availableCategoryList.appendChild(createPinnedCategoryManagerRow({
                category,
                roleColor: categoryColor(category),
                buttons: [
                    {
                        label: "Pin",
                        onClick: () => {
                            draftPinnedCategories = [...draftPinnedCategories, category];
                            renderPinnedCategoryManager();
                        },
                    },
                ],
            }));
        });
    };
    renderPinnedCategoryManager();

    closeBtn?.addEventListener("click", close);
    if (!isWorkspace) closeOnOverlayClick(root);

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
            auto_hide_toolbars: autoHideToolbarsInput?.checked === true,
            active_sidebar_hover_open: activeSidebarHoverOpenInput?.checked !== false,
            meta_tags_button_side: metaTagsButtonSideSelect?.value === "left" ? "left" : "right",
            visible_pinned_category_count: Math.max(1, Math.min(20, parseInt(visiblePinnedCountInput.value, 10) || 5)),
            active_border_theme: activeBorderThemeSelect?.value || "default",
            active_border_custom_1: activeBorderCustom1Input?.value || "#ff0000",
            active_border_custom_2: activeBorderCustom2Input?.value || "#0000ff",
            library_tab_layout: getLibraryTabLayoutMode(),
            thumbnail_size_px: getThumbnailSizePx(),
            active_thumbnail_size_px: getActiveThumbnailSizePx(),
            library_tabs: ["active", "most_used", "pinned", ...currentCategoryTabs],
            pinned_categories: draftPinnedCategories,
            category_colors: categoryColors
        };
        await galleryNode.saveUiPrefs(newPrefs);
        nodeInstance.uiPrefs = newPrefs;
        if (typeof savePinnedCategories === "function") {
            await savePinnedCategories(draftPinnedCategories);
        }
        applyThumbnailSizePreference();
        applyLibraryTabLayoutPreference();
        if (typeof applyMetaTagsButtonSidePreference === "function") {
            applyMetaTagsButtonSidePreference();
        }
        if (typeof applyAutoHideToolbarPreference === "function") {
            applyAutoHideToolbarPreference();
        }
        if (typeof applyActiveBorderThemePreference === "function") {
            applyActiveBorderThemePreference();
        }
        await renderLibraryBar();

        const activeLibraryTab = getActiveLibraryTab();
        if (activeLibraryTab) {
            await renderLibraryDrawer(activeLibraryTab);
        }

        closeCategoryColorPopover();
        close();
    });
}
