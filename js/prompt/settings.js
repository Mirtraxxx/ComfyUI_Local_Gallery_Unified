import { escapeHtml } from "../shared/dom.js";
import { bindBackdropClose, createModalSurface } from "../shared/modalSurfaces.js";

function createSettingsSurface({ workspaceContainer, onClose }) {
    return createModalSurface({ workspaceContainer, onWorkspaceClose: onClose });
}

function populatePromptSourceSelect({
    sourceSelect,
    app,
    nodeInstance,
    isShowTextNode,
    saveNodeProperties,
    updatePromptSourceStatus,
}) {
    if (!sourceSelect || !app.graph) return;

    const textNodes = (app.graph._nodes || []).filter(node => isShowTextNode(node) && node !== nodeInstance);
    textNodes.forEach(node => {
        const option = document.createElement("option");
        option.value = node.id;
        option.textContent = node.title || node.type || `Node ${node.id}`;
        sourceSelect.appendChild(option);
    });

    if (nodeInstance.properties?.prompt_source_node_id != null) {
        sourceSelect.value = nodeInstance.properties.prompt_source_node_id;
    }

    sourceSelect.addEventListener("change", event => {
        const selectedNode = textNodes.find(node => String(node.id) === event.target.value);
        nodeInstance.properties.prompt_source_node_id = selectedNode?.id ?? null;
        nodeInstance.properties.prompt_source_node_title = selectedNode
            ? (selectedNode.title || selectedNode.type || `Node ${selectedNode.id}`)
            : null;
        saveNodeProperties();
        updatePromptSourceStatus();
    });
}

function getCategoryPreviewColor(category, draftCategoryColors, getCategoryRoleColor, resetCategoryColors = null) {
    if (resetCategoryColors?.has(category)) return "#6c757d";
    return draftCategoryColors[category] || getCategoryRoleColor(category) || "#6c757d";
}

function createCategoryActionButton({ label, title, disabled = false, onClick, className = "" }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `localprompt-settings-icon-button ${className}`.trim();
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
}

function createPinnedCategoryRow({ category, index, total, color, onMove, onUnpin, onColor }) {
    const row = document.createElement("div");
    row.className = "localprompt-settings-category-row";

    const colorButton = document.createElement("button");
    colorButton.type = "button";
    colorButton.className = "localprompt-settings-color-dot";
    colorButton.style.setProperty("--settings-category-color", color);
    colorButton.title = `Change ${category} color`;
    colorButton.setAttribute("aria-label", `Change ${category} color`);
    colorButton.addEventListener("click", event => onColor(event.currentTarget));

    const label = document.createElement("span");
    label.className = "localprompt-settings-category-name";
    label.textContent = category;
    label.title = category;

    const controls = document.createElement("div");
    controls.className = "localprompt-settings-category-actions";
    controls.append(
        createCategoryActionButton({
            label: "\u2191",
            title: `Move ${category} up`,
            disabled: index === 0,
            onClick: () => onMove(index, index - 1),
        }),
        createCategoryActionButton({
            label: "\u2193",
            title: `Move ${category} down`,
            disabled: index === total - 1,
            onClick: () => onMove(index, index + 1),
        }),
        createCategoryActionButton({
            label: "\u00d7",
            title: `Unpin ${category}`,
            className: "is-danger",
            onClick: onUnpin,
        }),
    );
    row.append(colorButton, label, controls);
    return row;
}

function createAvailableCategoryRow({ category, color, onPin, onColor }) {
    const row = document.createElement("div");
    row.className = "localprompt-settings-category-row is-available";

    const colorButton = document.createElement("button");
    colorButton.type = "button";
    colorButton.className = "localprompt-settings-color-dot";
    colorButton.style.setProperty("--settings-category-color", color);
    colorButton.title = `Change ${category} color`;
    colorButton.setAttribute("aria-label", `Change ${category} color`);
    colorButton.addEventListener("click", event => onColor(event.currentTarget));

    const label = document.createElement("span");
    label.className = "localprompt-settings-category-name";
    label.textContent = category;
    label.title = category;

    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "localprompt-btn localprompt-settings-pin-button";
    pinButton.textContent = "Pin";
    pinButton.title = `Pin ${category}`;
    pinButton.addEventListener("click", onPin);
    row.append(colorButton, label, pinButton);
    return row;
}

function createCategoryColorCard({ category, color, isCustom, onClick }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "localprompt-settings-color-card";
    button.title = `Choose color for ${category}`;
    button.setAttribute("aria-label", `Choose color for ${category}`);
    button.style.setProperty("--settings-category-color", color);
    button.innerHTML = `
        <span class="localprompt-settings-color-card-swatch" aria-hidden="true"></span>
        <span class="localprompt-settings-color-card-name">${escapeHtml(category)}</span>
        ${isCustom ? '<span class="localprompt-settings-color-card-state">Custom</span>' : '<span class="localprompt-settings-color-card-state">Auto</span>'}
    `;
    button.addEventListener("click", event => onClick(event.currentTarget));
    return button;
}

function openCategoryColorPopover({
    anchor,
    category,
    palette,
    draftCategoryColors,
    resetCategoryColors,
    getCategoryRoleColor,
    closePopover,
    onColorChange,
    onColorReset,
    setActivePopover,
}) {
    closePopover();
    const currentColor = getCategoryPreviewColor(
        category,
        draftCategoryColors,
        getCategoryRoleColor,
        resetCategoryColors,
    );
    const hasCustomColor = Boolean(draftCategoryColors[category]);
    const popover = document.createElement("div");
    popover.className = "localprompt-settings-color-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", `Color for ${category}`);
    popover.innerHTML = `
        <div class="localprompt-settings-color-popover-header">
            <span>Color for ${escapeHtml(category)}</span>
            <button type="button" class="localprompt-settings-popover-close" aria-label="Close color picker" title="Close">\u00d7</button>
        </div>
        <div class="localprompt-settings-palette" aria-label="Color palette"></div>
        <label class="localprompt-settings-custom-color">
            <span>Custom color</span>
            <input type="color" value="${escapeHtml(currentColor)}" aria-label="Custom color for ${escapeHtml(category)}">
        </label>
        <button type="button" class="localprompt-settings-reset-color" ${hasCustomColor ? "" : "disabled"}>Use automatic color</button>
    `;

    const paletteContainer = popover.querySelector(".localprompt-settings-palette");
    palette.forEach(color => {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "localprompt-settings-palette-swatch";
        swatch.style.backgroundColor = color;
        swatch.title = color;
        swatch.setAttribute("aria-label", `Use ${color}`);
        swatch.setAttribute("aria-pressed", String(color.toLowerCase() === currentColor.toLowerCase()));
        swatch.addEventListener("click", () => {
            onColorChange(color);
            closePopover();
        });
        paletteContainer.appendChild(swatch);
    });

    popover.querySelector(".localprompt-settings-popover-close")?.addEventListener("click", closePopover);
    popover.querySelector("input[type=color]")?.addEventListener("change", event => {
        onColorChange(event.target.value);
        closePopover();
    });
    popover.querySelector(".localprompt-settings-reset-color")?.addEventListener("click", () => {
        onColorReset();
        closePopover();
    });

    document.body.appendChild(popover);
    const anchorRect = anchor.getBoundingClientRect();
    const placePopover = () => {
        const rect = popover.getBoundingClientRect();
        const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - rect.width - 8));
        const below = anchorRect.bottom + 8;
        const top = below + rect.height <= window.innerHeight - 8
            ? below
            : Math.max(8, anchorRect.top - rect.height - 8);
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
    };
    placePopover();
    setActivePopover(popover, placePopover);
    popover.querySelector(".localprompt-settings-popover-close")?.focus();
}

export async function showSettingsModal({
    uniqueId,
    app,
    nodeInstance,
    galleryNode,
    isShowTextNode,
    saveNodeProperties,
    updatePromptSourceStatus,
    getCategoryRoleColor,
    renderLibraryBar,
    getActiveLibraryTab,
    renderLibraryDrawer,
    getPinnedCategories = null,
    savePinnedCategories = null,
    renderActiveSidebar = null,
    renderGallery = null,
    getWorkflowProfileStatus = null,
    workspaceContainer = null,
    onClose = null,
}) {
    const surface = createSettingsSurface({ workspaceContainer, onClose });
    const { root, close, isWorkspace } = surface;
    let allCategories = [];
    let categoryLoadError = null;
    try {
        const loadedCategories = await galleryNode.getCategories();
        allCategories = Array.isArray(loadedCategories) ? loadedCategories : [];
    } catch (error) {
        categoryLoadError = error;
    }
    const workflowProfileStatus = typeof getWorkflowProfileStatus === "function"
        ? getWorkflowProfileStatus()
        : { version: 1, prompt: false, lora: false };
    const profileParts = [
        workflowProfileStatus.prompt ? "Prompt" : null,
        workflowProfileStatus.lora ? "LoRA" : null,
    ].filter(Boolean);
    const profileCoverage = profileParts.length ? profileParts.join(" + ") : "initializing";

    root.innerHTML = `
        <div class="localprompt-modal${isWorkspace ? " localprompt-workspace-page localprompt-settings-page" : ""} localprompt-settings-modal">
            <div class="${isWorkspace ? "localprompt-workspace-header" : "localprompt-modal-header"}">
                <div class="localprompt-workspace-title">
                    <h3>Prompt settings</h3>
                    <p>Set the source, interaction preferences, and category strip.</p>
                </div>
                ${isWorkspace ? "" : '<button class="localprompt-modal-close" type="button" title="Close settings" aria-label="Close settings">\u00d7</button>'}
            </div>
            <div class="${isWorkspace ? "localprompt-workspace-body" : "localprompt-modal-content"} localprompt-settings-body">
                <section class="localprompt-settings-section localprompt-workflow-profile-section">
                    <div class="localprompt-settings-section-heading">
                        <h4>Workflow profile</h4>
                        <p>Gallery layout and browsing preferences are stored inside this node. Copied workflows inherit the starting layout, then remain independent when saved.</p>
                    </div>
                    <div class="localprompt-workflow-profile-status">
                        <span class="localprompt-workflow-profile-badge">Workflow local</span>
                        <span>${escapeHtml(profileCoverage)} settings · profile v${Number(workflowProfileStatus.version) || 1}</span>
                    </div>
                </section>

                <section class="localprompt-settings-section">
                    <div class="localprompt-settings-section-heading">
                        <h4>Prompt source</h4>
                        <p>Optionally read prompt text from another text node in this workflow.</p>
                    </div>
                    <label class="localprompt-settings-field-label" for="${uniqueId}-settings-prompt-source-select">Text node</label>
                    <select id="${uniqueId}-settings-prompt-source-select" class="localprompt-settings-select">
                        <option value="">No source selected</option>
                    </select>
                    <div id="${uniqueId}-prompt-source-status" class="localprompt-settings-help" aria-live="polite">No prompt source</div>
                </section>

                <section class="localprompt-settings-section">
                    <div class="localprompt-settings-section-heading">
                        <h4>Prompt behavior</h4>
                        <p>Display size, contrast, and card sorting stay in the sliders button on the prompt toolbar.</p>
                    </div>
                    <div class="localprompt-settings-behavior-grid">
                        <label class="localprompt-settings-number-field">
                            <span>Most Used cards</span>
                            <input type="number" id="settings-most-used-count" min="1" max="50" inputmode="numeric">
                            <small>How many cards the Most Used view can show.</small>
                        </label>
                        <div class="localprompt-settings-toggle-list">
                            <label class="localprompt-settings-toggle"><input type="checkbox" id="settings-show-most-used"><span>Show the Most Used category</span></label>
                            <label class="localprompt-settings-toggle"><input type="checkbox" id="settings-promote-selected-prompts"><span>Keep selected cards at the top</span></label>
                            <label class="localprompt-settings-toggle"><input type="checkbox" id="settings-active-sidebar-hover-open"><span>Open the Active Stack on hover</span></label>
                            <label class="localprompt-settings-toggle"><input type="checkbox" id="settings-auto-hide-toolbars"><span>Auto-hide the bottom toolbar</span></label>
                        </div>
                    </div>
                </section>

                <section class="localprompt-settings-section">
                    <div class="localprompt-settings-section-heading">
                        <h4>Category strip</h4>
                        <p>Pin categories for fast access, then place the most important ones first. Arrow buttons work with keyboard and mouse.</p>
                    </div>
                    <label class="localprompt-settings-number-field localprompt-settings-visible-count">
                        <span>Categories visible in the top row</span>
                        <input type="number" id="settings-visible-pinned-category-count" min="1" max="20" inputmode="numeric">
                        <small>Additional pinned categories remain available from the pull-out row.</small>
                    </label>
                    <div class="localprompt-settings-category-columns">
                        <div class="localprompt-settings-category-panel">
                            <div class="localprompt-settings-list-heading"><strong>Pinned</strong><span id="settings-pinned-category-count"></span></div>
                            <div id="settings-pinned-category-list" class="localprompt-settings-category-list" aria-label="Pinned categories"></div>
                        </div>
                        <div class="localprompt-settings-category-panel">
                            <div class="localprompt-settings-list-heading"><strong>Available</strong><span id="settings-available-category-count"></span></div>
                            <div id="settings-available-category-list" class="localprompt-settings-category-list" aria-label="Available categories"></div>
                        </div>
                    </div>
                </section>

                <section class="localprompt-settings-section">
                    <div class="localprompt-settings-section-heading">
                        <h4>Category colors</h4>
                        <p>Choose a palette color or a custom color. Automatic colors use the neutral gallery treatment.</p>
                    </div>
                    <div id="settings-category-color-list" class="localprompt-settings-color-list" aria-label="Category colors"></div>
                </section>
            </div>
            <div class="${isWorkspace ? "localprompt-workspace-footer" : "localprompt-settings-modal-footer"}">
                <span id="settings-save-status" class="localprompt-settings-save-status" aria-live="polite"></span>
                <button id="settings-save" type="button" class="localprompt-btn active localprompt-settings-save">Save changes</button>
            </div>
        </div>
    `;

    const closeBtn = root.querySelector(isWorkspace ? ".localprompt-workspace-back" : ".localprompt-modal-close");
    const sourceSelect = root.querySelector(`#${uniqueId}-settings-prompt-source-select`);
    const mostUsedCountInput = root.querySelector("#settings-most-used-count");
    const showMostUsedInput = root.querySelector("#settings-show-most-used");
    const promoteSelectedPromptsInput = root.querySelector("#settings-promote-selected-prompts");
    const activeSidebarHoverOpenInput = root.querySelector("#settings-active-sidebar-hover-open");
    const autoHideToolbarsInput = root.querySelector("#settings-auto-hide-toolbars");
    const visiblePinnedCountInput = root.querySelector("#settings-visible-pinned-category-count");
    const pinnedCategoryList = root.querySelector("#settings-pinned-category-list");
    const availableCategoryList = root.querySelector("#settings-available-category-list");
    const categoryColorList = root.querySelector("#settings-category-color-list");
    const pinnedCount = root.querySelector("#settings-pinned-category-count");
    const availableCount = root.querySelector("#settings-available-category-count");
    const saveButton = root.querySelector("#settings-save");
    const saveStatus = root.querySelector("#settings-save-status");
    const palette = galleryNode.CATEGORY_ROLE_PALETTE || [];

    populatePromptSourceSelect({
        sourceSelect,
        app,
        nodeInstance,
        isShowTextNode,
        saveNodeProperties,
        updatePromptSourceStatus,
    });
    updatePromptSourceStatus();

    mostUsedCountInput.value = Math.max(1, Math.min(50, Number.parseInt(nodeInstance.uiPrefs?.most_used_count, 10) || 10));
    showMostUsedInput.checked = nodeInstance.uiPrefs?.show_most_used !== false;
    promoteSelectedPromptsInput.checked = nodeInstance.uiPrefs?.promote_selected_prompts !== false;
    activeSidebarHoverOpenInput.checked = nodeInstance.uiPrefs?.active_sidebar_hover_open !== false;
    autoHideToolbarsInput.checked = nodeInstance.uiPrefs?.auto_hide_toolbars === true;
    visiblePinnedCountInput.value = Math.max(1, Math.min(20, Number.parseInt(nodeInstance.uiPrefs?.visible_pinned_category_count, 10) || 5));

    const draftCategoryColors = { ...(nodeInstance.uiPrefs?.category_colors || {}) };
    const resetCategoryColors = new Set();
    let draftPinnedCategories = typeof getPinnedCategories === "function"
        ? getPinnedCategories(allCategories)
        : (Array.isArray(nodeInstance.uiPrefs?.pinned_categories) ? [...nodeInstance.uiPrefs.pinned_categories] : []);
    draftPinnedCategories = [...new Set(draftPinnedCategories.filter(category => allCategories.includes(category)))];

    let activeColorPopover = null;
    let removePopoverListeners = null;
    const closeColorPopover = () => {
        activeColorPopover?.remove();
        activeColorPopover = null;
        removePopoverListeners?.();
        removePopoverListeners = null;
    };
    const setActiveColorPopover = (popover, placePopover) => {
        activeColorPopover = popover;
        const onPointerDown = event => {
            if (!popover.contains(event.target)) closeColorPopover();
        };
        const onKeyDown = event => {
            if (event.key === "Escape") closeColorPopover();
        };
        const onResize = () => placePopover();
        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);
        removePopoverListeners = () => {
            window.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onResize);
        };
    };

    const colorForCategory = category => getCategoryPreviewColor(
        category,
        draftCategoryColors,
        getCategoryRoleColor,
        resetCategoryColors,
    );
    const orderedCategories = () => {
        const pinnedSet = new Set(draftPinnedCategories);
        return [...draftPinnedCategories, ...allCategories.filter(category => !pinnedSet.has(category))];
    };
    const openColorPicker = (anchor, category) => openCategoryColorPopover({
        anchor,
        category,
        palette,
        draftCategoryColors,
        resetCategoryColors,
        getCategoryRoleColor,
        closePopover: closeColorPopover,
        onColorChange: color => {
            draftCategoryColors[category] = color;
            resetCategoryColors.delete(category);
            renderCategoryLists();
            renderCategoryColors();
        },
        onColorReset: () => {
            delete draftCategoryColors[category];
            resetCategoryColors.add(category);
            renderCategoryLists();
            renderCategoryColors();
        },
        setActivePopover: setActiveColorPopover,
    });

    const renderCategoryLists = () => {
        if (!pinnedCategoryList || !availableCategoryList) return;
        pinnedCategoryList.replaceChildren();
        availableCategoryList.replaceChildren();
        const pinnedSet = new Set(draftPinnedCategories);
        const availableCategories = allCategories.filter(category => !pinnedSet.has(category));
        pinnedCount.textContent = `${draftPinnedCategories.length} pinned`;
        availableCount.textContent = `${availableCategories.length} available`;

        if (categoryLoadError) {
            pinnedCategoryList.innerHTML = '<p class="localprompt-settings-empty-state">Could not load categories. Close settings and try again.</p>';
            availableCategoryList.replaceChildren();
            return;
        }
        if (!allCategories.length) {
            pinnedCategoryList.innerHTML = '<p class="localprompt-settings-empty-state">Create a card category to organize it here.</p>';
            availableCategoryList.replaceChildren();
            return;
        }
        if (!draftPinnedCategories.length) {
            pinnedCategoryList.innerHTML = '<p class="localprompt-settings-empty-state">No categories pinned yet.</p>';
        }
        draftPinnedCategories.forEach((category, index) => {
            pinnedCategoryList.appendChild(createPinnedCategoryRow({
                category,
                index,
                total: draftPinnedCategories.length,
                color: colorForCategory(category),
                onMove: (from, to) => {
                    if (to < 0 || to >= draftPinnedCategories.length) return;
                    [draftPinnedCategories[from], draftPinnedCategories[to]] = [draftPinnedCategories[to], draftPinnedCategories[from]];
                    renderCategoryLists();
                    renderCategoryColors();
                },
                onUnpin: () => {
                    draftPinnedCategories = draftPinnedCategories.filter(item => item !== category);
                    renderCategoryLists();
                    renderCategoryColors();
                },
                onColor: anchor => openColorPicker(anchor, category),
            }));
        });
        if (!availableCategories.length) {
            availableCategoryList.innerHTML = '<p class="localprompt-settings-empty-state">Every category is pinned.</p>';
        }
        availableCategories.forEach(category => {
            availableCategoryList.appendChild(createAvailableCategoryRow({
                category,
                color: colorForCategory(category),
                onPin: () => {
                    draftPinnedCategories = [...draftPinnedCategories, category];
                    renderCategoryLists();
                    renderCategoryColors();
                },
                onColor: anchor => openColorPicker(anchor, category),
            }));
        });
    };

    const renderCategoryColors = () => {
        if (!categoryColorList) return;
        categoryColorList.replaceChildren();
        if (categoryLoadError) {
            categoryColorList.innerHTML = '<p class="localprompt-settings-empty-state">Category colors are unavailable until categories load.</p>';
            return;
        }
        if (!allCategories.length) {
            categoryColorList.innerHTML = '<p class="localprompt-settings-empty-state">No categories yet.</p>';
            return;
        }
        orderedCategories().forEach(category => {
            categoryColorList.appendChild(createCategoryColorCard({
                category,
                color: colorForCategory(category),
                isCustom: Boolean(draftCategoryColors[category]),
                onClick: anchor => openColorPicker(anchor, category),
            }));
        });
    };

    renderCategoryLists();
    renderCategoryColors();
    closeBtn?.addEventListener("click", () => {
        closeColorPopover();
        close();
    });
    if (!isWorkspace) bindBackdropClose(root, () => {
        closeColorPopover();
        close();
    });

    saveButton.addEventListener("click", async () => {
        if (categoryLoadError) {
            saveStatus.textContent = "Categories could not be loaded, so nothing was saved.";
            return;
        }
        const categoryColors = { ...(nodeInstance.uiPrefs?.category_colors || {}), ...draftCategoryColors };
        resetCategoryColors.forEach(category => delete categoryColors[category]);
        const mostUsedCount = Math.max(1, Math.min(50, Number.parseInt(mostUsedCountInput.value, 10) || 10));
        const visiblePinnedCount = Math.max(1, Math.min(20, Number.parseInt(visiblePinnedCountInput.value, 10) || 5));
        const newPrefs = {
            ...nodeInstance.uiPrefs,
            most_used_count: mostUsedCount,
            show_most_used: showMostUsedInput.checked,
            promote_selected_prompts: promoteSelectedPromptsInput.checked,
            active_sidebar_hover_open: activeSidebarHoverOpenInput.checked,
            auto_hide_toolbars: autoHideToolbarsInput.checked,
            visible_pinned_category_count: visiblePinnedCount,
            pinned_categories: draftPinnedCategories,
            category_colors: categoryColors,
        };

        saveButton.disabled = true;
        saveStatus.textContent = "Saving...";
        try {
            await galleryNode.saveUiPrefs(newPrefs, nodeInstance);
            nodeInstance.uiPrefs = newPrefs;
            if (typeof savePinnedCategories === "function") {
                await savePinnedCategories(draftPinnedCategories);
            }
            await renderLibraryBar();
            const activeLibraryTab = getActiveLibraryTab();
            if (activeLibraryTab) await renderLibraryDrawer(activeLibraryTab);
            if (typeof renderActiveSidebar === "function") await renderActiveSidebar();
            if (typeof renderGallery === "function") renderGallery();
            closeColorPopover();
            close();
        } catch (error) {
            console.error("Local Prompt Gallery: failed to save settings", error);
            saveStatus.textContent = "Could not save changes. Please try again.";
            saveButton.disabled = false;
        }
    });
}
