import * as promptApi from "../api/promptApi.js?v=sort-20260606";
import {
    CATEGORY_ROLE_PALETTE,
    FAVORITE_COLORS,
    PER_PAGE,
    THUMBNAIL_SIZE_DEFAULT,
    THUMBNAIL_SIZE_LEGACY_PRESETS,
    THUMBNAIL_SIZE_MAX,
    THUMBNAIL_SIZE_MIN,
} from "./constants.js";
import {
    createManagedTextControlsHtml,
    createPinnedManagedControlsHtml,
    getCategoryColorMap as resolveCategoryColorMap,
    getCategoryRoleColor as resolveCategoryRoleColor,
    getLibraryTabsFromPrefs,
    getNearestPaletteColor,
    getThumbnailVariables,
    hexToRgba,
    isShowTextNode,
    normalizePromptIdList,
    formatWeight,
    getManagedPromptState,
    promotePromptsById,
    sortPromptsByPinnedOrder,
    stepManagedPromptWeight,
    syncPinnedOrderWithPromptIds,
} from "./helpers.js?v=unified-icons-20260606";
import { showCardManagerModal as openCardManager } from "./browse.js?v=default-gallery-pointer-reorder-20260608";
import {
    showAddPromptDialog as openAddPromptDialog,
    showEditPromptDialog as openEditPromptDialog,
    showFromLastOutputDialog as openFromLastOutputDialog,
    showImportDialog as openImportDialog,
    showUploadThumbnailDialog as openUploadThumbnailDialog,
} from "./dialogs.js?v=workspace-toggle-cleanup-20260607";
import {
    showPromptActionContextMenu as openPromptActionContextMenu,
    showPromptContextMenu as openPromptContextMenu,
} from "./contextMenus.js";
import {
    attachInfoPopup as attachPromptInfoPopup,
    hideHoverPreview as hidePromptHoverPreview,
    showHoverPreview as showPromptHoverPreview,
} from "./previews.js?v=preview-popover-20260606";
import {
    applyActiveSidebarPreference as applyPromptActiveSidebarPreference,
    applyActiveSidebarWidthPreference as applyPromptActiveSidebarWidthPreference,
    getActiveSidebarWidth as getPromptActiveSidebarWidth,
    renderActiveSidebar as renderPromptActiveSidebar,
} from "./activeSidebar.js?v=active-stack-swap-reorder-20260617";
import {
    loadCategories as loadPromptGalleryCategories,
    promptMatchesCurrentGallery as promptMatchesPromptGallery,
    renderGallery as renderPromptGallery,
} from "./gallery.js?v=default-gallery-pointer-reorder-20260608";
import {
    applyLibraryTabLayoutPreference as applyLibraryTabLayoutClasses,
    getUtilityLibraryTabs,
    isUtilityLibraryTab,
    renderPromptBuilderBar,
    renderPromptBuilderDrawer,
} from "./library.js?v=prompt-builder-swap-reorder-20260617";
import { showPresetsModal as openPresetsModal } from "./presets.js?v=workspace-close-safe-20260608";
import { showSettingsModal as openSettingsModal } from "./settings.js?v=prefs-schema-20260611";
import { showWildcardsModal } from "./wildcards.js";
import { getPromptTemplate } from "./template.js";
import { setupPromptPreDomStateWidgets, setupPromptPostDomStateWidgets } from "./stateWidgets.js";
import { createMetaTagsController } from "./metaTags.js";
import { createPromptWorkspaceController } from "./workspace.js";
import {
    DEFAULT_PROMPT_UI_PREFS,
    getActiveDisplayMode as resolveActiveDisplayMode,
    getActiveThumbnailSizePx as resolveActiveThumbnailSizePx,
    getCardsDisplayMode as resolveCardsDisplayMode,
    getThumbnailSizePx as resolveThumbnailSizePx,
    mergeUiPrefs,
    normalizeDisplayMode,
} from "./preferences.js?v=prefs-schema-20260611";
import { escapeHtml } from "../shared/dom.js";
import { readSelectionArray, stringifyJsonOr, writeSelectionArray } from "../shared/json.js";

export function registerPromptGalleryUi(app, api) {
const UnifiedPromptGalleryNode = {
    name: "LocalGalleryPromptLora.PromptUI",
    isLoading: false,
    currentPage: 1,
    totalPages: 1,
    lastOutput: null, // Stores { filename, subfolder, type } of last generation
    FAVORITE_COLORS,
    CATEGORY_ROLE_PALETTE,
    THUMBNAIL_SIZE_MIN,
    THUMBNAIL_SIZE_MAX,
    THUMBNAIL_SIZE_DEFAULT,
    THUMBNAIL_SIZE_LEGACY_PRESETS,

    async getPrompts(filter_name = "", mode = "OR", page = 1, selected_prompts = [], filter_category = "", favorites_only = false, perPage = PER_PAGE, sortMode = "manual") {
        this.isLoading = true;
        try {
            const data = await promptApi.getPrompts(filter_name, mode, page, selected_prompts, filter_category, favorites_only, perPage, sortMode);
            this.totalPages = data.total_pages || 1;
            this.currentPage = data.current_page || 1;
            return data;
        } catch (error) {
            console.error("LocalPromptGallery: Error fetching prompts:", error);
            return { prompts: [], total_pages: 1, current_page: 1 };
        } finally {
            this.isLoading = false;
        }
    },

    async getPrompt(prompt_id) {
        try {
            return await promptApi.getPrompt(prompt_id);
        } catch (error) {
            console.error("LocalPromptGallery: Error fetching prompt:", error);
            return null;
        }
    },

    async getPromptsByIds(prompt_ids = []) {
        try {
            return await promptApi.getPromptsByIds(prompt_ids);
        } catch (error) {
            console.error("LocalPromptGallery: Error fetching prompts by ids:", error);
            return [];
        }
    },

    async getCategories() {
        try {
            return await promptApi.getCategories();
        } catch (error) {
            console.error("LocalPromptGallery: Error fetching categories:", error);
            return [];
        }
    },

    async updateMetadata(prompt_id, data) {
        try {
            return await promptApi.updateMetadata(prompt_id, data);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to update metadata", e);
            throw e;
        }
    },

    async createPrompt(name, prompt_text, category = "") {
        try {
            return await promptApi.createPrompt(name, prompt_text, category);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to create prompt", e);
            return { status: "error", message: e.toString() };
        }
    },

    async createPromptFromOutput(name, prompt_text, category = "", lastOutput = null) {
        try {
            return await promptApi.createPromptFromOutput(name, prompt_text, category, lastOutput);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to create prompt from output", e);
            return { status: "error", message: e.toString() };
        }
    },

    async deletePrompt(prompt_id) {
        try {
            return await promptApi.deletePrompt(prompt_id);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to delete prompt", e);
            return { status: "error", message: e.toString() };
        }
    },

    async deletePromptsBulk(prompt_ids) {
        try {
            return await promptApi.deletePromptsBulk(prompt_ids);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to bulk delete prompts", e);
            return { status: "error", message: e.toString() };
        }
    },

    async uploadThumbnail(prompt_id, file) {
        try {
            return await promptApi.uploadThumbnail(prompt_id, file);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to upload thumbnail", e);
            return { status: "error", message: e.toString() };
        }
    },

    async toggleFavorite(prompt_id, category = null) {
        try {
            return await promptApi.toggleFavorite(prompt_id, category);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to toggle favorite", e);
            return { status: "error", message: e.toString() };
        }
    },

    async setFavoriteColor(prompt_id, color) {
        try {
            return await promptApi.setFavoriteColor(prompt_id, color);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to set favorite color", e);
            return { status: "error", message: e.toString() };
        }
    },

    async uploadWildcardFile(file) {
        try {
            return await promptApi.uploadWildcardFile(file);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to upload wildcard file", e);
            return { status: "error", message: e.toString() };
        }
    },

    async importWildcardFile(filename, category) {
        try {
            return await promptApi.importWildcardFile(filename, category);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to import wildcard file", e);
            return { status: "error", message: e.toString() };
        }
    },

    async deleteCategory(category) {
        try {
            return await promptApi.deleteCategory(category);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to delete category", e);
            return { status: "error", message: e.toString() };
        }
    },

    async renameCategory(oldCategory, newCategory) {
        try {
            return await promptApi.renameCategory(oldCategory, newCategory);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to rename category", e);
            return { status: "error", message: e.toString() };
        }
    },

    async getMostUsed(count = 10) {
        try {
            return await promptApi.getMostUsed(count);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to get most used", e);
            return [];
        }
    },

    async getUiPrefs() {
        try {
            return await promptApi.getUiPrefs();
        } catch (e) {
            console.error("LocalPromptGallery: Failed to get UI prefs", e);
            return { ...DEFAULT_PROMPT_UI_PREFS };
        }
    },

    async saveUiPrefs(prefs) {
        try {
            return await promptApi.saveUiPrefs(prefs);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to save UI prefs", e);
            return { status: "error", message: e.toString() };
        }
    },

    // ========== PRESET API ==========
    async getPresets() {
        try {
            return await promptApi.getPresets();
        } catch (e) {
            console.error("LocalPromptGallery: Failed to get presets", e);
            return [];
        }
    },

    async savePreset(name, selection, wildcardMode, wildcardCategories) {
        try {
            return await promptApi.savePreset(name, selection, wildcardMode, wildcardCategories);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to save preset", e);
            return { status: "error", message: e.toString() };
        }
    },

    async getOrCreatePrompts(prompts) {
        try {
            return await promptApi.getOrCreatePrompts(prompts);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to get or create prompts", e);
            return { status: "error", message: e.toString() };
        }
    },

    async loadPreset(name) {
        try {
            return await promptApi.loadPreset(name);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to load preset", e);
            return { status: "error", message: e.toString() };
        }
    },

    async deletePreset(name) {
        try {
            return await promptApi.deletePreset(name);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to delete preset", e);
            return { status: "error", message: e.toString() };
        }
    },

    async resetUsageCount(prompt_id) {
        try {
            return await promptApi.resetUsageCount(prompt_id);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to reset usage count", e);
            return { status: "error", message: e.toString() };
        }
    },

    async assignThumbnail(prompt_id, lastOutput) {
        try {
            return await promptApi.assignThumbnail(prompt_id, lastOutput);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to assign thumbnail", e);
            return { status: "error", message: e.toString() };
        }
    },

    setup(nodeType, nodeData) {
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated?.apply(this, arguments);
            const node_instance = this;

            const preDomWidgets = setupPromptPreDomStateWidgets({ nodeInstance: this });
            const {
                galleryIdWidget,
                selectionWidget,
                metaTagsWidget,
                activeSidebarWidthWidget,
            } = preDomWidgets;

            this.size = [500, 450];
            let widgetContainer = null;
            
            // Set minimum size so bottom bar doesn't disappear
            const MIN_WIDTH = 400;
            const MIN_HEIGHT = 350;
            const originalOnResize = this.onResize;
            this.onResize = function(size) {
                if (size[0] < MIN_WIDTH) size[0] = MIN_WIDTH;
                if (size[1] < MIN_HEIGHT) size[1] = MIN_HEIGHT;
                if (originalOnResize) originalOnResize.call(this, size);
                if (widgetContainer) {
                    applyActiveSidebarWidthPreference();
                }
            };
            
            this.promptData = [];
            this.metaTags = [];
            this.availablePrompts = [];
            this.mostUsedPrompts = [];
            this.showFavoritesOnly = false;
            this.uiPrefs = {
                ...DEFAULT_PROMPT_UI_PREFS,
                last_created_category: "",
                active_border_theme: "default",
                active_border_custom_1: "#ff0000",
                active_border_custom_2: "#0000ff",
            };

            

            // ADD DOM WIDGET HERE - before hidden data widgets
            widgetContainer = document.createElement("div");
            widgetContainer.className = "localprompt-container-wrapper";
            this.addDOMWidget("prompt_gallery", "div", widgetContainer, {});

            // --- HIDDEN DATA WIDGETS (added AFTER DOM widget to not affect its position) ---
            const postDomWidgets = setupPromptPostDomStateWidgets({ nodeInstance: this });
            const {
                wildcardWidget,
                wildcardRngModeWidget,
                wildcardShuffleNonceWidget,
                categoriesWidget,
                seedWidget,
                controlWidget,
            } = postDomWidgets;


            const uniqueId = `localprompt-gallery-${this.id}`;

            widgetContainer.innerHTML = getPromptTemplate(uniqueId);

            const metaTagsController = createMetaTagsController({
                app,
                nodeInstance: this,
                widgetContainer,
                uniqueId,
                metaTagsWidget,
                writeSelectionArray,
                readSelectionArray,
                escapeHtml,
                onRender: () => {
                    const panel = widgetContainer.querySelector(`#${uniqueId}-meta-tags-panel`);
                    if (!panel?.classList.contains("open")) return;
                    fitFloatingPanelToNode(panel);
                    requestAnimationFrame(() => fitFloatingPanelToNode(panel));
                },
            });
            const {
                saveMetaTags,
                renderMetaTags,
                updateMetaTagsButtonState,
                loadMetaTagsFromProperties,
                bindAddMetaTagButton,
            } = metaTagsController;

            let activeLibraryTab = null;
            let categoryOverflowOpen = false;
            let currentWildcardMode = wildcardWidget?.value || 'off';
            let libraryDrawerRenderToken = 0;
            let queuedLibraryDrawerTimer = null;
            let activeSidebarRenderToken = 0;
            let cachedCategories = null;
            let cachedCategoriesPromise = null;

            function queueLibraryDrawerRender(tabName = activeLibraryTab, delay = 60) {
                if (!tabName) return;
                if (queuedLibraryDrawerTimer) {
                    clearTimeout(queuedLibraryDrawerTimer);
                }
                queuedLibraryDrawerTimer = setTimeout(() => {
                    queuedLibraryDrawerTimer = null;
                    renderLibraryDrawer(tabName);
                }, delay);
            }

            function invalidateCategoryCache() {
                cachedCategories = null;
                cachedCategoriesPromise = null;
            }

            async function getCachedCategories({ force = false } = {}) {
                if (!force && Array.isArray(cachedCategories)) {
                    return cachedCategories;
                }
                if (!force && cachedCategoriesPromise) {
                    return cachedCategoriesPromise;
                }
                cachedCategoriesPromise = UnifiedPromptGalleryNode.getCategories()
                    .then(categories => {
                        cachedCategories = Array.isArray(categories) ? categories : [];
                        return cachedCategories;
                    })
                    .finally(() => {
                        cachedCategoriesPromise = null;
                    });
                return cachedCategoriesPromise;
            }

            const workspaceController = createPromptWorkspaceController({
                widgetContainer,
                uniqueId,
                nodeInstance: this,
                closeToolbarPanels,
                closeActiveSidebarForWorkspaceMode,
                clearLibraryNavActiveState,
                syncSelectedSectionVisibility,
                renderPinnedCategoryStrip,
                getActiveLibraryTab: () => activeLibraryTab,
                setActiveLibraryTab: (val) => { activeLibraryTab = val; },
                showBrowseWorkspace: (onClose) => showBrowseWorkspace(onClose),
                showPresetsWorkspace: (onClose) => showPresetsWorkspace(onClose),
                showImportWorkspace: (onClose) => showImportWorkspace(onClose),
            });
            const {
                getWorkspaceMode,
                getWorkspaceHost,
                setWorkspaceMode,
                toggleWorkspaceMode,
                returnToGallery,
                getLibrarySubnavHtml,
                renderLibraryShell,
                renderLibraryWorkspace,
            } = workspaceController;

            // Create hover preview outside the node container so it's not bounded
            const hoverPreview = document.createElement('div');
            hoverPreview.id = `${uniqueId}-hover-preview`;
            hoverPreview.className = 'localprompt-hover-preview';
            document.body.appendChild(hoverPreview);
            let toolbarOutsideClickHandler = null;
            let activeCategoryContextMenu = null;
            let categoryDragState = null;
            let suppressCategoryClickUntil = 0;

            // Category Context Menu & Pointer drag event handlers
            const globalPointerDownHandler = (event) => {
                if (activeCategoryContextMenu && !activeCategoryContextMenu.contains(event.target)) {
                    closeCategoryContextMenu();
                }
            };
            const globalKeydownHandler = (event) => {
                if (event.key === "Escape") {
                    closeCategoryContextMenu();
                    if (categoryDragState) {
                        categoryDragState.pill.classList.remove("pinned-dragging");
                        categoryDragState.pill.releasePointerCapture?.(categoryDragState.pointerId);
                        categoryDragState = null;
                        clearCategoryDragTargets();
                    }
                }
            };
            const globalResizeHandler = () => {
                closeCategoryContextMenu();
            };

            const onCategoryPointerMove = async (event) => {
                if (!categoryDragState) return;
                const distance = Math.hypot(event.clientX - categoryDragState.startX, event.clientY - categoryDragState.startY);
                if (!categoryDragState.active && distance < 8) return;

                if (!categoryDragState.active) {
                    categoryDragState.active = true;
                    categoryDragState.pill.classList.add("pinned-dragging");
                    suppressCategoryClickUntil = Date.now() + 200;
                }

                event.preventDefault();
                event.stopPropagation();
                
                const targetPill = getCategoryPillAtPoint(event.clientX, event.clientY);
                if (targetPill && targetPill !== categoryDragState.pill) {
                    setCategoryDragTarget(targetPill);
                } else {
                    setCategoryDragTarget(null);
                }
            };

            const onCategoryPointerUp = async (event) => {
                if (!categoryDragState) return;
                const dragState = categoryDragState;
                categoryDragState = null;

                dragState.pill.classList.remove("pinned-dragging");
                dragState.pill.releasePointerCapture?.(dragState.pointerId);

                if (!dragState.active) return;
                event.preventDefault();
                event.stopPropagation();
                suppressCategoryClickUntil = Date.now() + 250;

                const targetPill = getCategoryPillAtPoint(event.clientX, event.clientY) || lastCategoryDragTarget;
                clearCategoryDragTargets();

                if (!targetPill || targetPill === dragState.pill) {
                    return;
                }

                const targetCategory = targetPill.dataset.category;
                const draggedCategory = dragState.category;
                if (!targetCategory || !draggedCategory) return;

                // Determine if target is pinned or unpinned
                const isTargetPinned = targetPill.dataset.pinned === "true" || targetPill.closest(`#${uniqueId}-pinned-category-strip`) !== null;
                const allCategories = await getCachedCategories();
                let pinned = getPinnedCategories(allCategories);
                const swapItems = (items, first, second) => {
                    const firstIndex = items.indexOf(first);
                    const secondIndex = items.indexOf(second);
                    if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return false;
                    [items[firstIndex], items[secondIndex]] = [items[secondIndex], items[firstIndex]];
                    return true;
                };
                
                // Remove draggedCategory from pinned if it's there
                if (isTargetPinned) {
                    // Pinned zone drop
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
                    // Unpinned zone drop
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
            };

            const onCategoryPointerCancel = () => {
                if (categoryDragState) {
                    categoryDragState.pill.classList.remove("pinned-dragging");
                    categoryDragState.pill.releasePointerCapture?.(categoryDragState.pointerId);
                    categoryDragState = null;
                }
                clearCategoryDragTargets();
            };

            document.addEventListener("pointerdown", globalPointerDownHandler, { capture: true });
            document.addEventListener("keydown", globalKeydownHandler);
            window.addEventListener("resize", globalResizeHandler);
            window.addEventListener("pointermove", onCategoryPointerMove);
            window.addEventListener("pointerup", onCategoryPointerUp);
            window.addEventListener("pointercancel", onCategoryPointerCancel);

            // Clean up on node removal
            const originalOnRemoved = this.onRemoved;
            this.onRemoved = function () {
                const preview = document.getElementById(`${uniqueId}-hover-preview`);
                if (preview) preview.remove();
                if (toolbarOutsideClickHandler) {
                    document.removeEventListener("click", toolbarOutsideClickHandler);
                    toolbarOutsideClickHandler = null;
                }
                if (queuedLibraryDrawerTimer) {
                    clearTimeout(queuedLibraryDrawerTimer);
                    queuedLibraryDrawerTimer = null;
                }
                document.removeEventListener("pointerdown", globalPointerDownHandler, { capture: true });
                document.removeEventListener("keydown", globalKeydownHandler);
                window.removeEventListener("resize", globalResizeHandler);
                window.removeEventListener("pointermove", onCategoryPointerMove);
                window.removeEventListener("pointerup", onCategoryPointerUp);
                window.removeEventListener("pointercancel", onCategoryPointerCancel);
                closeCategoryContextMenu();
                if (originalOnRemoved) originalOnRemoved.call(this);
            };

            function saveSelectionData(options = {}) {
                const data = writeSelectionArray(node_instance.promptData);
                node_instance.properties["prompt_selection_data"] = data;
                selectionWidget.value = data;
                syncActivePromptCounts();
                node_instance.setDirtyCanvas?.(true, options.redrawCanvas !== false);
                if (app.graph) app.graph.change();
            }

            function closeToolbarPanels(exceptPanel = null) {
                widgetContainer.querySelectorAll(".localprompt-dropdown-panel.open").forEach(panel => {
                    if (panel !== exceptPanel) panel.classList.remove("open");
                });
                widgetContainer.querySelectorAll(".localprompt-toolbar-button.active, .localprompt-category-grid-button.active, .localprompt-pinned-category-pill.active").forEach(btn => {
                    const panelId = btn.getAttribute("aria-controls");
                    if (!panelId) return;
                    const panel = panelId ? widgetContainer.querySelector(`#${panelId}`) : null;
                    if (panel !== exceptPanel) btn.classList.remove("active");
                });
                const overflow = widgetContainer.querySelector(`#${uniqueId}-category-overflow`);
                if (overflow && overflow !== exceptPanel) {
                    categoryOverflowOpen = false;
                    overflow.classList.remove("open");
                    const pullTab = widgetContainer.querySelector(`#${uniqueId}-category-pull-tab`);
                    if (pullTab) {
                        pullTab.setAttribute("aria-expanded", "false");
                    }
                }
                syncAutoHideToolbarState();
            }

            function setupToolbarDropdown(buttonId, panelId, onOpen = null) {
                const button = widgetContainer.querySelector(`#${buttonId}`);
                const panel = widgetContainer.querySelector(`#${panelId}`);
                if (!button || !panel) return;
                button.setAttribute("aria-controls", panelId);
                button.addEventListener("click", async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    // Retract active sidebar on toolbar dropdown interaction (focus change)
                    if (isActiveSidebarOpen()) {
                        clearActiveSidebarOpenTimer();
                        clearActiveSidebarCloseTimer();
                        activeSidebarHoverOpen = false;
                        applyActiveSidebarPreference();
                    }
                    closeDisplayOptionsPopover();
                    const willOpen = !panel.classList.contains("open");
                    if (willOpen && getWorkspaceMode() !== "gallery") {
                        returnToGallery();
                    }
                    closeToolbarPanels(panel);
                    panel.classList.toggle("open", willOpen);
                    button.classList.toggle("active", willOpen);
                    if (willOpen && typeof onOpen === "function") {
                        await onOpen();
                    }
                    if (willOpen) {
                        fitFloatingPanelToNode(panel);
                        requestAnimationFrame(() => fitFloatingPanelToNode(panel));
                    }
                    syncAutoHideToolbarState();
                });
                panel.addEventListener("click", event => event.stopPropagation());
            }

            function fitFloatingPanelToNode(panel, options = {}) {
                if (!panel) return;
                const container = widgetContainer.querySelector(".localprompt-container") || widgetContainer;
                const containerRect = container.getBoundingClientRect();
                const padding = Number(options.padding ?? 8);
                const maxWidth = Math.max(160, Math.floor(containerRect.width - padding * 2));

                panel.style.transform = "";
                panel.style.maxWidth = `${maxWidth}px`;
                panel.style.minWidth = `${Math.min(220, maxWidth)}px`;
                panel.style.boxSizing = "border-box";

                if (panel.classList.contains("localprompt-meta-panel")) {
                    panel.style.width = `${Math.min(420, maxWidth)}px`;
                } else if (panel.id === `${uniqueId}-categories-panel`) {
                    panel.style.width = `${Math.min(600, maxWidth)}px`;
                } else if (panel.id === `${uniqueId}-size-controls`) {
                    panel.style.width = `${Math.min(220, maxWidth)}px`;
                }

                const panelRect = panel.getBoundingClientRect();
                let shiftX = 0;
                const minLeft = containerRect.left + padding;
                const maxRight = containerRect.right - padding;
                if (panelRect.right > maxRight) {
                    shiftX = maxRight - panelRect.right;
                }
                if (panelRect.left + shiftX < minLeft) {
                    shiftX += minLeft - (panelRect.left + shiftX);
                }

                let shiftY = 0;
                const minTop = containerRect.top + padding;
                const maxBottom = containerRect.bottom - padding;
                if (panelRect.top < minTop) {
                    shiftY = minTop - panelRect.top;
                }
                const panelTopAfterShift = panelRect.top + shiftY;
                const availableHeight = Math.max(120, Math.floor(maxBottom - panelTopAfterShift));
                panel.style.maxHeight = `${availableHeight}px`;
                panel.style.overflowY = "auto";

                if (shiftX || shiftY) {
                    panel.style.transform = `translate(${Math.round(shiftX)}px, ${Math.round(shiftY)}px)`;
                }
            }

            async function openCategoryFromMenu(category) {
                if (getWorkspaceMode() !== "gallery") {
                    setWorkspaceMode("gallery");
                }
                const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
                const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);
                if (activeLibraryTab === category) {
                    if (categorySelect) categorySelect.value = "";
                    activeLibraryTab = null;
                    clearLibraryNavActiveState();
                    drawer?.classList.remove("active");
                    syncPromptSortControls();
                    syncSelectedSectionVisibility();
                    await renderPinnedCategoryStrip();
                    await renderCategoryDropdownOptions();
                    closeToolbarPanels();
                    return;
                }
                if (categorySelect) categorySelect.value = category || "";
                activeLibraryTab = category;
                clearLibraryNavActiveState();
                drawer?.classList.add("active");
                await renderLibraryDrawer(category);
                syncPromptSortControls();
                syncSelectedSectionVisibility();
                await renderPinnedCategoryStrip();
                await renderCategoryDropdownOptions();
                closeToolbarPanels();
            }

            async function renderPinnedCategoryStrip() {
                const strip = widgetContainer.querySelector(`#${uniqueId}-pinned-category-strip`);
                const moreGroup = widgetContainer.querySelector(`#${uniqueId}-more-category-group`);
                if (!strip) return;

                const allCategories = await getCachedCategories();
                const pinnedCategories = await ensurePinnedCategoriesInitialized(allCategories);
                const visiblePinnedCategories = pinnedCategories.slice(0, getVisiblePinnedCategoryCount());
                strip.innerHTML = "";

                visiblePinnedCategories.forEach(category => {
                    const pill = document.createElement("button");
                    pill.type = "button";
                    pill.className = `localprompt-pinned-category-pill${activeLibraryTab === category ? " active" : ""}`;
                    pill.textContent = category;
                    pill.title = category;
                    pill.dataset.category = category;
                    pill.dataset.pinned = "true";
                    applyLibraryTabRoleStyling(pill, category, activeLibraryTab === category);
                    
                    pill.addEventListener("click", (e) => {
                        if (Date.now() < suppressCategoryClickUntil) {
                            e.stopImmediatePropagation();
                            return;
                        }
                        openCategoryFromMenu(category);
                    });

                    // Context Menu
                    pill.addEventListener("contextmenu", (event) => {
                        event.preventDefault();
                        showCategoryPillContextMenu(event, category, true);
                    });

                    // Pointer Long Press & Drag setup
                    let longPressTimer = null;
                    let startX = 0;
                    let startY = 0;

                    pill.addEventListener("pointerdown", (event) => {
                        if (event.button !== 0) return;
                        if (event.target.closest("button:not(.localprompt-pinned-category-pill), input, select, textarea")) return;
                        
                        startX = event.clientX;
                        startY = event.clientY;
                        if (longPressTimer) clearTimeout(longPressTimer);
                        
                        longPressTimer = setTimeout(() => {
                            suppressCategoryClickUntil = Date.now() + 250;
                            showCategoryPillContextMenu(event, category, true);
                        }, 500);

                        categoryDragState = {
                            pill,
                            category,
                            isPinned: true,
                            startX: event.clientX,
                            startY: event.clientY,
                            active: false,
                            pointerId: event.pointerId,
                        };
                        pill.setPointerCapture?.(event.pointerId);
                    });

                    pill.addEventListener("pointermove", (event) => {
                        if (longPressTimer && Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
                            clearTimeout(longPressTimer);
                            longPressTimer = null;
                        }
                    });

                    pill.addEventListener("pointerup", (event) => {
                        if (longPressTimer) {
                            clearTimeout(longPressTimer);
                            longPressTimer = null;
                        }
                    });

                    pill.addEventListener("pointercancel", () => {
                        if (longPressTimer) {
                            clearTimeout(longPressTimer);
                            longPressTimer = null;
                        }
                    });

                    strip.appendChild(pill);
                });

                moreGroup?.classList.remove("hidden");

                await renderCategoryOverflowCategories();
            }

            async function renderCategoryOverflowCategories() {
                const overflowContainer = widgetContainer.querySelector(`#${uniqueId}-category-overflow`);
                const chipsContainer = widgetContainer.querySelector(`#${uniqueId}-category-overflow-chips`);
                const pullTab = widgetContainer.querySelector(`#${uniqueId}-category-pull-tab`);
                if (!overflowContainer || !chipsContainer) return;

                const categories = await getCachedCategories();
                const active = activeLibraryTab;
                const pinnedCategories = await ensurePinnedCategoriesInitialized(categories);
                const visiblePinned = new Set(pinnedCategories.slice(0, getVisiblePinnedCategoryCount()));
                const hiddenCategories = getCategoriesInCurrentOrder(categories).filter(category => !visiblePinned.has(category));

                chipsContainer.innerHTML = "";

                if (!hiddenCategories.length) {
                    categoryOverflowOpen = false;
                    if (pullTab) {
                        pullTab.style.display = "none";
                        pullTab.setAttribute("aria-expanded", "false");
                    }
                    overflowContainer.classList.remove("open");
                    return;
                }

                if (pullTab) {
                    pullTab.style.display = "flex";
                    pullTab.setAttribute("aria-expanded", String(categoryOverflowOpen));
                }
                overflowContainer.classList.toggle("open", categoryOverflowOpen);

                hiddenCategories.forEach(category => {
                    const option = document.createElement("button");
                    const isPinned = pinnedCategories.includes(category);
                    option.className = `localprompt-pinned-category-pill${active === category ? " active" : ""}`;
                    option.type = "button";
                    option.textContent = category;
                    option.title = category;
                    option.dataset.category = category;
                    option.dataset.pinned = String(isPinned);
                    applyLibraryTabRoleStyling(option, category, active === category);
                    
                    option.addEventListener("click", (e) => {
                        if (Date.now() < suppressCategoryClickUntil) {
                            e.stopImmediatePropagation();
                            return;
                        }
                        openCategoryFromMenu(category);
                    });

                    // Context Menu
                    option.addEventListener("contextmenu", (event) => {
                        event.preventDefault();
                        showCategoryPillContextMenu(event, category, isPinned);
                    });

                    // Pointer Long Press & Drag setup
                    let longPressTimer = null;
                    let startX = 0;
                    let startY = 0;

                    option.addEventListener("pointerdown", (event) => {
                        if (event.button !== 0) return;
                        if (event.target.closest("button:not(.localprompt-pinned-category-pill), input, select, textarea")) return;
                        
                        startX = event.clientX;
                        startY = event.clientY;
                        if (longPressTimer) clearTimeout(longPressTimer);
                        
                        longPressTimer = setTimeout(() => {
                            suppressCategoryClickUntil = Date.now() + 250;
                            showCategoryPillContextMenu(event, category, isPinned);
                        }, 500);

                        categoryDragState = {
                            pill: option,
                            category,
                            isPinned,
                            startX: event.clientX,
                            startY: event.clientY,
                            active: false,
                            pointerId: event.pointerId,
                        };
                        option.setPointerCapture?.(event.pointerId);
                    });

                    option.addEventListener("pointermove", (event) => {
                        if (longPressTimer && Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
                            clearTimeout(longPressTimer);
                            longPressTimer = null;
                        }
                    });

                    option.addEventListener("pointerup", (event) => {
                        if (longPressTimer) {
                            clearTimeout(longPressTimer);
                            longPressTimer = null;
                        }
                    });

                    option.addEventListener("pointercancel", () => {
                        if (longPressTimer) {
                            clearTimeout(longPressTimer);
                            longPressTimer = null;
                        }
                    });

                    chipsContainer.appendChild(option);
                });
            }

            async function renderCategoryDropdownOptions() {
                return renderCategoryOverflowCategories();
            }

            function saveNodeProperties() {
                node_instance.setDirtyCanvas?.(true, true);
                if (app.graph) app.graph.change();
            }


            function getPromptSourceNode() {
                const sourceId = node_instance.properties?.prompt_source_node_id;
                if (sourceId == null) return null;
                return app.graph?.getNodeById?.(sourceId) || null;
            }



            function updatePromptSourceStatus() {
                const statusEls = document.querySelectorAll(`#${uniqueId}-prompt-source-status`);
                if (!statusEls.length) return;

                let label = '';
                let titleText = '';
                let prefix = 'Source: ';

                const sourceNode = getPromptSourceNode();
                if (sourceNode) {
                    label = sourceNode.title || sourceNode.type || `Node ${sourceNode.id}`;
                    titleText = label;
                } else {
                    const storedLabel = node_instance.properties?.prompt_source_node_title;
                    if (storedLabel) {
                        label = storedLabel;
                        titleText = storedLabel;
                        prefix = 'Source missing: ';
                    } else {
                        label = 'No prompt source';
                        titleText = 'No prompt source selected';
                        prefix = '';
                    }
                }

                statusEls.forEach(statusEl => {
                    statusEl.innerHTML = `${prefix}${label} `;
                    statusEl.title = titleText;
                });
            }



            function saveWildcardState(mode = wildcardWidget?.value || "off", categoriesValue = categoriesWidget?.value || "[]") {
                node_instance.properties["wildcard_mode"] = String(mode || "off");
                node_instance.properties["wildcard_categories"] = typeof categoriesValue === 'string'
                    ? categoriesValue
                    : stringifyJsonOr(categoriesValue || []);
                if (wildcardWidget) wildcardWidget.value = node_instance.properties["wildcard_mode"];
                if (categoriesWidget) categoriesWidget.value = node_instance.properties["wildcard_categories"];
                node_instance.setDirtyCanvas?.(true, true);
                if (app.graph) app.graph.change();
            }

            function normalizeWildcardRngMode(mode) {
                return ["seed_stable", "shuffle", "fresh"].includes(mode) ? mode : "seed_stable";
            }

            function saveWildcardRngState(mode = wildcardRngModeWidget?.value || "seed_stable", nonce = wildcardShuffleNonceWidget?.value || "0") {
                node_instance.properties["wildcard_rng_mode"] = normalizeWildcardRngMode(mode);
                node_instance.properties["wildcard_shuffle_nonce"] = String(nonce || "0");
                if (wildcardRngModeWidget) wildcardRngModeWidget.value = node_instance.properties["wildcard_rng_mode"];
                if (wildcardShuffleNonceWidget) wildcardShuffleNonceWidget.value = node_instance.properties["wildcard_shuffle_nonce"];
                node_instance.setDirtyCanvas?.(true, true);
                if (app.graph) app.graph.change();
            }

            saveWildcardState();
            saveWildcardRngState();

            function syncSelectedSectionVisibility() {
                const selectedSection = widgetContainer.querySelector(`#${uniqueId}-selected-section`);
                if (!selectedSection) return;
                selectedSection.classList.add('pinned-unified-hidden');
                selectedSection.style.display = 'none';
                selectedSection.style.height = '0';
                selectedSection.style.minHeight = '0';
                selectedSection.style.padding = '0';
                selectedSection.style.border = '0';
                selectedSection.style.overflow = 'hidden';
            }

            function getSelectedPromptEntry(promptId) {
                return node_instance.promptData.find(item => String(item.prompt_id) === String(promptId)) || null;
            }

            function getSelectedPromptIdsInOrder() {
                return node_instance.promptData.map(item => item.prompt_id);
            }

            function refreshManagedControlsForPrompt(promptId) {
                const selectedEntry = getSelectedPromptEntry(promptId);
                if (!selectedEntry) return;

                const { weight, isOn } = getManagedPromptState(selectedEntry);
                widgetContainer.querySelectorAll('.pinned-managed, .localprompt-active-row').forEach(chip => {
                    if (String(chip.dataset.promptId || '') !== String(promptId)) return;

                    chip.querySelectorAll('.managed-weight-val').forEach(label => {
                        label.textContent = formatWeight(weight);
                    });

                    chip.querySelectorAll('[data-managed-action="toggle-on"]').forEach(button => {
                        button.textContent = isOn ? 'ON' : 'OFF';
                        button.classList.toggle('on', isOn);
                        button.classList.toggle('off', !isOn);
                    });
                });
            }

            function updateSelectedPromptEntry(promptId, updater, options = {}) {
                const index = node_instance.promptData.findIndex(item => String(item.prompt_id) === String(promptId));
                if (index < 0) return false;
                updater(node_instance.promptData[index], index);
                hideHoverPreview();
                if (options.refreshOnly) {
                    saveSelectionData({ redrawCanvas: false });
                    refreshManagedControlsForPrompt(promptId);
                } else {
                    saveSelectionData();
                    renderPrompts();
                    if (activeLibraryTab) queueLibraryDrawerRender(activeLibraryTab);
                }
                return true;
            }

            function getThumbnailSizePx() {
                return resolveThumbnailSizePx(node_instance.uiPrefs);
            }

            function getActiveThumbnailSizePx() {
                return resolveActiveThumbnailSizePx(node_instance.uiPrefs);
            }

            function getActiveDisplayMode() {
                return resolveActiveDisplayMode(node_instance.uiPrefs);
            }

            function getCardsDisplayMode() {
                return resolveCardsDisplayMode(node_instance.uiPrefs);
            }

            function applyThumbnailVariables(target, sizePx) {
                const variables = getThumbnailVariables(sizePx);
                target.style.setProperty('--localprompt-thumb-height', `${variables.height}px`);
                target.style.setProperty('--localprompt-thumb-width', `${variables.width}px`);
                target.style.setProperty('--localprompt-thumb-label-size', `${variables.label}px`);
            }

            function syncThumbnailSizeSliders() {
                const cardSlider = widgetContainer.querySelector(`#${uniqueId}-thumbnail-size-slider`);
                const activeSlider = widgetContainer.querySelector(`#${uniqueId}-active-thumbnail-size-slider`);
                const cardModeSelect = widgetContainer.querySelector(`#${uniqueId}-cards-display-mode`);
                const activeModeSelect = widgetContainer.querySelector(`#${uniqueId}-active-display-mode`);
                if (cardSlider) cardSlider.value = String(getThumbnailSizePx());
                if (activeSlider) activeSlider.value = String(getActiveThumbnailSizePx());
                if (cardModeSelect) cardModeSelect.value = getCardsDisplayMode();
                if (activeModeSelect) activeModeSelect.value = getActiveDisplayMode();
                const contrastSelect = widgetContainer.querySelector(`#${uniqueId}-card-contrast-select`);
                if (contrastSelect) contrastSelect.value = node_instance.uiPrefs.card_contrast_mode || "off";
                syncDisplayOptionAvailability();
            }

            function syncDisplayOptionAvailability() {
                const sections = [
                    {
                        mode: getActiveDisplayMode(),
                        slider: widgetContainer.querySelector(`#${uniqueId}-active-thumbnail-size-slider`),
                        control: widgetContainer.querySelector(`#${uniqueId}-active-size-control`),
                    },
                    {
                        mode: getCardsDisplayMode(),
                        slider: widgetContainer.querySelector(`#${uniqueId}-thumbnail-size-slider`),
                        control: widgetContainer.querySelector(`#${uniqueId}-cards-size-control`),
                    },
                ];
                sections.forEach(({ mode, slider, control }) => {
                    const enabled = mode === "thumbnails";
                    if (slider) slider.disabled = !enabled;
                    if (control) {
                        control.classList.toggle("disabled", !enabled);
                        control.title = enabled ? "Thumbnail size" : "Only available in Thumbnails mode";
                    }
                });
            }

            function applyThumbnailSizePreference(sizePx = getThumbnailSizePx()) {
                node_instance.uiPrefs.thumbnail_size_px = sizePx;
                applyThumbnailVariables(widgetContainer, sizePx);
                syncThumbnailSizeSliders();
            }

            function applyActiveThumbnailSizePreference(sizePx = getActiveThumbnailSizePx()) {
                node_instance.uiPrefs.active_thumbnail_size_px = sizePx;
                const activeSidebar = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
                if (activeSidebar) {
                    applyThumbnailVariables(activeSidebar, sizePx);
                }
                syncThumbnailSizeSliders();
            }

            function applyActiveBorderThemePreference() {
                const theme = node_instance.uiPrefs.active_border_theme || "default";
                const themeClasses = [
                    "zip-theme-default",
                    "zip-theme-cyberpunk",
                    "zip-theme-sunset",
                    "zip-theme-aurora",
                    "zip-theme-ice",
                    "zip-theme-fire-ice",
                    "zip-theme-golden-mint",
                    "zip-theme-rainbow-sync",
                    "zip-theme-rainbow-split",
                    "zip-theme-custom"
                ];
                themeClasses.forEach(cls => {
                    widgetContainer.classList.remove(cls);
                });
                
                widgetContainer.classList.add(`zip-theme-${theme}`);
                
                if (theme === "custom") {
                    const color1 = node_instance.uiPrefs.active_border_custom_1 || "#ff0000";
                    const color2 = node_instance.uiPrefs.active_border_custom_2 || "#0000ff";
                    widgetContainer.style.setProperty('--localprompt-zip-color-1', color1);
                    widgetContainer.style.setProperty('--localprompt-zip-color-2', color2);
                } else {
                    widgetContainer.style.removeProperty('--localprompt-zip-color-1');
                    widgetContainer.style.removeProperty('--localprompt-zip-color-2');
                }
            }

            function applyCardContrastModePreference() {
                const mode = node_instance.uiPrefs.card_contrast_mode || "off";
                const contrastClasses = [
                    "contrast-off",
                    "contrast-dim-inactive",
                    "contrast-dim-by-default"
                ];
                contrastClasses.forEach(cls => {
                    widgetContainer.classList.remove(cls);
                });
                widgetContainer.classList.add(`contrast-${mode.replace(/_/g, "-")}`);

                // Also apply to any active browse modal or workspace panel
                const activeModals = document.querySelectorAll(".localprompt-modal-overlay, .localprompt-workspace-panel");
                activeModals.forEach(modal => {
                    contrastClasses.forEach(cls => modal.classList.remove(cls));
                    modal.classList.add(`contrast-${mode.replace(/_/g, "-")}`);
                });
            }

            let thumbnailSizeSaveTimer = null;
            function queueThumbnailSizeSave() {
                if (thumbnailSizeSaveTimer) {
                    clearTimeout(thumbnailSizeSaveTimer);
                }
                thumbnailSizeSaveTimer = setTimeout(() => {
                    UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs).catch(e => {
                        console.warn("LocalPromptGallery: Failed to save thumbnail size", e);
                    });
                }, 250);
            }

            function setupThumbnailSizeSliders() {
                const cardSlider = widgetContainer.querySelector(`#${uniqueId}-thumbnail-size-slider`);
                const activeSlider = widgetContainer.querySelector(`#${uniqueId}-active-thumbnail-size-slider`);
                const cardModeSelect = widgetContainer.querySelector(`#${uniqueId}-cards-display-mode`);
                const activeModeSelect = widgetContainer.querySelector(`#${uniqueId}-active-display-mode`);
                if (cardSlider) {
                    cardSlider.value = String(getThumbnailSizePx());
                    cardSlider.addEventListener('input', () => {
                        if (cardSlider.disabled) return;
                        applyThumbnailSizePreference(Number(cardSlider.value));
                        queueThumbnailSizeSave();
                    });
                }
                if (activeSlider) {
                    activeSlider.value = String(getActiveThumbnailSizePx());
                    activeSlider.addEventListener('input', () => {
                        if (activeSlider.disabled) return;
                        applyActiveThumbnailSizePreference(Number(activeSlider.value));
                        queueThumbnailSizeSave();
                    });
                }
                if (cardModeSelect) {
                    cardModeSelect.value = getCardsDisplayMode();
                    cardModeSelect.addEventListener('change', async () => {
                        node_instance.uiPrefs.cards_display_mode = normalizeDisplayMode(cardModeSelect.value, "thumbnails");
                        node_instance.uiPrefs.display_mode = node_instance.uiPrefs.cards_display_mode;
                        syncThumbnailSizeSliders();
                        if (activeLibraryTab) await renderLibraryDrawer(activeLibraryTab);
                        renderGallery();
                        saveUiPrefs().catch(error => {
                            console.warn("LocalPromptGallery: Failed to save cards display mode", error);
                        });
                    });
                }
                if (activeModeSelect) {
                    activeModeSelect.value = getActiveDisplayMode();
                    activeModeSelect.addEventListener('change', async () => {
                        node_instance.uiPrefs.active_display_mode = normalizeDisplayMode(activeModeSelect.value, "compact");
                        syncThumbnailSizeSliders();
                        await renderActiveSidebar();
                        saveUiPrefs().catch(error => {
                            console.warn("LocalPromptGallery: Failed to save active display mode", error);
                        });
                    });
                }
                const contrastSelect = widgetContainer.querySelector(`#${uniqueId}-card-contrast-select`);
                if (contrastSelect) {
                    contrastSelect.value = node_instance.uiPrefs.card_contrast_mode || "off";
                    contrastSelect.addEventListener('change', () => {
                        node_instance.uiPrefs.card_contrast_mode = contrastSelect.value;
                        applyCardContrastModePreference();
                        saveUiPrefs().catch(error => {
                            console.warn("LocalPromptGallery: Failed to save card contrast mode", error);
                        });
                    });
                }
                bindMainSortSelect();
                syncDisplayOptionAvailability();
            }

            function getActiveSidebarWidth() {
                return getPromptActiveSidebarWidth({ nodeInstance: node_instance });
            }

            function applyActiveSidebarWidthPreference() {
                applyPromptActiveSidebarWidthPreference({
                    widgetContainer,
                    nodeInstance: node_instance,
                    activeSidebarWidthWidget,
                });
            }

            function getPinnedOrder() {
                return normalizePromptIdList(node_instance.uiPrefs?.pinned_order);
            }

            function getCategoryColorMap() {
                return resolveCategoryColorMap(node_instance.uiPrefs);
            }

            function getCategoryRoleColor(promptOrCategory) {
                return resolveCategoryRoleColor(promptOrCategory, getCategoryColorMap());
            }

            function applyCategoryRoleStyling(element, prompt, { soften = false } = {}) {
                const roleColor = getCategoryRoleColor(prompt);
                if (!element || !roleColor) return;
                element.classList.add('role-colored');
                element.style.setProperty('--role-color', roleColor);
                if (soften && !element.classList.contains('pinned-managed')) {
                    element.style.borderColor = `color-mix(in srgb, ${roleColor} 50%, #444)`;
                }
            }

            function getLibraryTabLayoutMode() {
                return node_instance.uiPrefs?.library_tab_layout === 'wrap' ? 'wrap' : 'scroll';
            }




            function applyLibraryTabLayoutPreference() {
                applyLibraryTabLayoutClasses({
                    widgetContainer,
                    uniqueId,
                    layoutMode: getLibraryTabLayoutMode(),
                });
            }

            function applyLibraryTabRoleStyling(tabBtn, tabContent, isActive) {
                const roleColor = getCategoryRoleColor(tabContent);
                if (!roleColor) {
                    tabBtn.style.removeProperty('--category-color');
                    tabBtn.style.removeProperty('--category-color-glow');
                    tabBtn.classList.remove('has-role-color');
                } else {
                    tabBtn.style.setProperty('--category-color', roleColor);
                    tabBtn.style.setProperty('--category-color-glow', hexToRgba(roleColor, 0.15));
                    tabBtn.classList.add('has-role-color');
                }
            }

            function getLibraryTabs() {
                return getLibraryTabsFromPrefs(node_instance.uiPrefs, getUtilityLibraryTabs());
            }

            const PINNED_CATEGORY_VISIBLE_COUNT = 5;

            function getVisiblePinnedCategoryCount() {
                const count = Number(node_instance.uiPrefs?.visible_pinned_category_count);
                if (!Number.isFinite(count)) return PINNED_CATEGORY_VISIBLE_COUNT;
                return Math.max(1, Math.min(20, Math.round(count)));
            }

            function getPinnedCategories(allCategories = null) {
                const categorySet = Array.isArray(allCategories) ? new Set(allCategories) : null;
                const storedPins = Array.isArray(node_instance.uiPrefs?.pinned_categories)
                    ? node_instance.uiPrefs.pinned_categories
                    : [];
                return [...new Set(storedPins.map(category => String(category || "").trim()).filter(Boolean))]
                    .filter(category => !categorySet || categorySet.has(category));
            }

            function getCategoriesInCurrentOrder(allCategories) {
                const categorySet = new Set(allCategories);
                const ordered = getLibraryTabs().filter(category => categorySet.has(category));
                const orderedSet = new Set(ordered);
                return [...ordered, ...allCategories.filter(category => !orderedSet.has(category))];
            }

            async function ensurePinnedCategoriesInitialized(allCategories) {
                if (Array.isArray(node_instance.uiPrefs?.pinned_categories)) {
                    return getPinnedCategories(allCategories);
                }
                const initialPins = getCategoriesInCurrentOrder(allCategories).slice(0, getVisiblePinnedCategoryCount());
                node_instance.uiPrefs.pinned_categories = initialPins;
                await saveUiPrefs();
                return initialPins;
            }

            async function savePinnedCategories(nextPinnedCategories) {
                const allCategories = await getCachedCategories();
                const categorySet = new Set(allCategories);
                node_instance.uiPrefs.pinned_categories = [...new Set(
                    (nextPinnedCategories || [])
                        .map(category => String(category || "").trim())
                        .filter(category => category && categorySet.has(category))
                )];
                node_instance.uiPrefs.visible_pinned_category_count = getVisiblePinnedCategoryCount();
                await saveUiPrefs();
                await renderPinnedCategoryStrip();
                await renderCategoryDropdownOptions();
            }

            function clearLibraryNavActiveState() {
                widgetContainer
                    .querySelectorAll(`#${uniqueId}-library-tabs .localprompt-library-tab, #${uniqueId}-utility-tabs .localprompt-library-tab, #${uniqueId}-fav-toggle-btn`)
                    .forEach(button => button.classList.remove('active'));
            }

            let activeSidebarHoverOpen = false;
            let activeSidebarOpenTimer = null;
            let activeSidebarCloseTimer = null;

            function isActiveSidebarOpen() {
                return activeSidebarHoverOpen;
            }

            function applyActiveSidebarPreference() {
                applyPromptActiveSidebarPreference({
                    widgetContainer,
                    uniqueId,
                    nodeInstance: node_instance,
                    activeSidebarWidthWidget,
                });
                const sidebar = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
                const toggleBtn = widgetContainer.querySelector(`#${uniqueId}-active-toggle`);
                const isOpen = isActiveSidebarOpen();
                const isPinned = false;
                widgetContainer.classList.toggle("active-sidebar-expanded", isOpen);
                sidebar?.classList.toggle("active", isOpen);
                if (toggleBtn) {
                    toggleBtn.classList.toggle("active", isOpen);
                    toggleBtn.classList.toggle("pinned", isPinned);
                    toggleBtn.setAttribute("aria-pressed", isOpen ? "true" : "false");
                }
            }

            async function toggleActiveSidebarPeek() {
                clearActiveSidebarOpenTimer();
                clearActiveSidebarCloseTimer();
                node_instance.uiPrefs.active_sidebar_open = false;
                activeSidebarHoverOpen = !activeSidebarHoverOpen;
                applyActiveSidebarPreference();
                saveUiPrefs().catch(error => {
                    console.warn("LocalPromptGallery: Failed to save active sidebar state", error);
                });
                if (activeSidebarHoverOpen) {
                    await renderActiveSidebar();
                }
            }

            function closeActiveSidebarForWorkspaceMode() {
                if (!isActiveSidebarOpen()) return;
                clearActiveSidebarOpenTimer();
                activeSidebarHoverOpen = false;
                node_instance.uiPrefs.active_sidebar_open = false;
                applyActiveSidebarPreference();
                saveUiPrefs().catch(error => {
                    console.warn("LocalPromptGallery: Failed to save active sidebar state", error);
                });
            }

            async function setActiveSidebarHoverOpen(nextOpen) {
                activeSidebarHoverOpen = !!nextOpen && node_instance.promptData.length > 0;
                applyActiveSidebarPreference();
                if (activeSidebarHoverOpen) {
                    await renderActiveSidebar();
                }
            }

            function clearActiveSidebarCloseTimer() {
                if (!activeSidebarCloseTimer) return;
                clearTimeout(activeSidebarCloseTimer);
                activeSidebarCloseTimer = null;
            }

            function clearActiveSidebarOpenTimer() {
                if (!activeSidebarOpenTimer) return;
                clearTimeout(activeSidebarOpenTimer);
                activeSidebarOpenTimer = null;
            }

            function isActiveSidebarHoverBehaviorEnabled() {
                return node_instance.uiPrefs?.active_sidebar_hover_open !== false;
            }

            function scheduleActiveSidebarHoverOpen() {
                if (!isActiveSidebarHoverBehaviorEnabled()) return;
                clearActiveSidebarOpenTimer();
                clearActiveSidebarCloseTimer();
                if (node_instance.promptData.length === 0) return;
                activeSidebarOpenTimer = setTimeout(() => {
                    setActiveSidebarHoverOpen(true).catch(error => {
                        console.error('LocalPromptGallery: Failed to hover-open active sidebar', error);
                    });
                }, 150);
            }

            function scheduleActiveSidebarHoverClose() {
                if (!isActiveSidebarHoverBehaviorEnabled()) return;
                clearActiveSidebarOpenTimer();
                clearActiveSidebarCloseTimer();
                activeSidebarCloseTimer = setTimeout(() => {
                    activeSidebarHoverOpen = false;
                    applyActiveSidebarPreference();
                }, 450);
            }

            async function saveUiPrefs() {
                node_instance.uiPrefs.library_tabs = getLibraryTabs();
                await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs);
            }

            function closeCategoryContextMenu() {
                if (activeCategoryContextMenu) {
                    activeCategoryContextMenu.remove();
                    activeCategoryContextMenu = null;
                }
            }

            async function saveCategoryOrder(nextCategoryOrder) {
                const currentTabs = Array.isArray(node_instance.uiPrefs.library_tabs) 
                    ? node_instance.uiPrefs.library_tabs 
                    : [];
                const utilityTabs = currentTabs.filter(tab => !nextCategoryOrder.includes(tab));
                const nextTabs = [...utilityTabs, ...nextCategoryOrder];
                node_instance.uiPrefs.library_tabs = nextTabs;
                await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs);
            }

            function showCategoryPillContextMenu(e, category, isCurrentlyPinned) {
                closeCategoryContextMenu();
                
                const menu = document.createElement("div");
                menu.className = "localprompt-category-ctx-menu";
                
                const presetColors = ["#ef4444", "#f97316", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8"];
                const activeColor = node_instance.uiPrefs.category_colors?.[category] || "";
                
                let colorsHtml = presetColors.map(color => `
                    <button class="color-dot${activeColor === color ? ' active' : ''}" style="background-color: ${color};" data-color="${color}"></button>
                `).join("");
                
                menu.innerHTML = `
                    <div class="menu-item pin-toggle-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <span>${isCurrentlyPinned ? "Unpin Category" : "Pin Category"}</span>
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-header">Category Color</div>
                    <div class="color-presets-grid">
                        ${colorsHtml}
                    </div>
                    <div class="color-picker-row">
                        <label class="custom-color-picker-label">
                            <input type="color" class="custom-color-input" value="${activeColor || "#3b82f6"}">
                            <span>Custom Color...</span>
                        </label>
                        <button class="reset-color-btn" style="${activeColor ? "" : "display: none;"}">Reset</button>
                    </div>
                `;
                
                menu.style.position = "fixed";
                menu.style.left = `${e.clientX}px`;
                menu.style.top = `${e.clientY}px`;
                document.body.appendChild(menu);
                activeCategoryContextMenu = menu;
                
                const rect = menu.getBoundingClientRect();
                if (e.clientX + rect.width > window.innerWidth) {
                    menu.style.left = `${window.innerWidth - rect.width - 8}px`;
                }
                if (e.clientY + rect.height > window.innerHeight) {
                    menu.style.top = `${window.innerHeight - rect.height - 8}px`;
                }
                
                menu.querySelector(".pin-toggle-btn").addEventListener("click", async () => {
                    const allCategories = await getCachedCategories();
                    let pinned = getPinnedCategories(allCategories);
                    if (isCurrentlyPinned) {
                        pinned = pinned.filter(c => c !== category);
                    } else {
                        pinned = [...pinned, category];
                    }
                    await savePinnedCategories(pinned);
                    closeCategoryContextMenu();
                });
                
                menu.querySelectorAll(".color-dot").forEach(dot => {
                    dot.addEventListener("click", async () => {
                        const color = dot.dataset.color;
                        if (!node_instance.uiPrefs.category_colors) {
                            node_instance.uiPrefs.category_colors = {};
                        }
                        node_instance.uiPrefs.category_colors[category] = color;
                        await saveUiPrefs();
                        await renderPinnedCategoryStrip();
                        await renderCategoryOverflowCategories();
                        closeCategoryContextMenu();
                    });
                });
                
                const customPicker = menu.querySelector(".custom-color-input");
                customPicker.addEventListener("input", (event) => {
                    menu.querySelector(".reset-color-btn").style.display = "";
                });
                customPicker.addEventListener("change", async (event) => {
                    const color = event.target.value;
                    if (!node_instance.uiPrefs.category_colors) {
                        node_instance.uiPrefs.category_colors = {};
                    }
                    node_instance.uiPrefs.category_colors[category] = color;
                    await saveUiPrefs();
                    await renderPinnedCategoryStrip();
                    await renderCategoryOverflowCategories();
                    closeCategoryContextMenu();
                });
                
                menu.querySelector(".reset-color-btn").addEventListener("click", async () => {
                    if (node_instance.uiPrefs.category_colors) {
                        delete node_instance.uiPrefs.category_colors[category];
                        await saveUiPrefs();
                        await renderPinnedCategoryStrip();
                        await renderCategoryOverflowCategories();
                    }
                    closeCategoryContextMenu();
                });
            }

            let lastCategoryDragTarget = null;
            function getCategoryPillAtPoint(x, y) {
                const el = document.elementFromPoint(x, y);
                return el?.closest(".localprompt-pinned-category-pill");
            }
            function setCategoryDragTarget(element) {
                if (lastCategoryDragTarget === element) return;
                clearCategoryDragTargets();
                if (element) {
                    element.classList.add("drag-over");
                    lastCategoryDragTarget = element;
                }
            }
            function clearCategoryDragTargets() {
                widgetContainer.querySelectorAll(".localprompt-pinned-category-pill.drag-over").forEach(el => {
                    el.classList.remove("drag-over");
                });
                lastCategoryDragTarget = null;
            }

            const PROMPT_SORT_MODES = new Set(["manual", "newest", "oldest", "az", "za"]);
            function getPromptSortScope(scope = null) {
                if (scope && typeof scope === "object") {
                    if (scope.key) return String(scope.key);
                    if (scope.tabName) return getPromptSortScope(scope.tabName);
                    if (scope.category != null) {
                        const category = String(scope.category).trim();
                        return category ? `category:${category}` : "all";
                    }
                }
                if (typeof scope === "string") {
                    if (scope === "pinned") return "favorites";
                    if (scope === "most_used") return "most_used";
                    if (scope.trim()) return `category:${scope.trim()}`;
                }

                const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);
                const selectedCategory = categorySelect?.value || "";
                if (selectedCategory) return `category:${selectedCategory}`;
                if (activeLibraryTab === "pinned") return "favorites";
                if (activeLibraryTab === "most_used") return "most_used";
                if (activeLibraryTab) return `category:${activeLibraryTab}`;
                if (node_instance.showFavoritesOnly) return "favorites";
                return "all";
            }

            function normalizePromptSortMode(mode) {
                const normalized = String(mode || "manual");
                return PROMPT_SORT_MODES.has(normalized) ? normalized : "manual";
            }

            function getPromptSortMode(scope = null) {
                const key = getPromptSortScope(scope);
                const scopedModes = node_instance.uiPrefs?.prompt_sort_modes;
                const mode = scopedModes && typeof scopedModes === "object"
                    ? scopedModes[key]
                    : null;
                if (mode) return normalizePromptSortMode(mode);
                const fallbackMode = key === "all"
                    ? node_instance.uiPrefs?.prompt_sort_mode
                    : node_instance.uiPrefs?.prompt_sort_modes?.all || node_instance.uiPrefs?.prompt_sort_mode;
                return normalizePromptSortMode(fallbackMode);
            }

            function syncPromptSortControls() {
                const mainSortSelect = widgetContainer.querySelector(`#${uniqueId}-main-sort-select`);
                if (mainSortSelect) {
                    mainSortSelect.value = getPromptSortMode();
                }
                widgetContainer.querySelectorAll(".localprompt-browse-sort-select").forEach(select => {
                    const browseRoot = select.closest(".localprompt-browse-page");
                    const browseCategory = browseRoot?.querySelector("#browse-category")?.value || "";
                    select.value = getPromptSortMode({ category: browseCategory });
                });
            }

            function getMetaTagsButtonSide() {
                return node_instance.uiPrefs?.meta_tags_button_side === "left" ? "left" : "right";
            }

            function applyMetaTagsButtonSidePreference() {
                const moreGroup = widgetContainer.querySelector(`#${uniqueId}-more-category-group`);
                const wrapper = widgetContainer.querySelector(`#${uniqueId}-pinned-category-wrapper`);
                const firstRow = widgetContainer.querySelector(`#${uniqueId}-pinned-first-row`);
                if (!moreGroup || !wrapper || !firstRow) return;

                const side = getMetaTagsButtonSide();
                moreGroup.classList.toggle("align-left", side === "left");
                moreGroup.classList.toggle("align-right", side !== "left");

                if (side === "left") {
                    firstRow.insertBefore(moreGroup, wrapper);
                } else {
                    firstRow.appendChild(moreGroup);
                }
            }

            function bindMainSortSelect() {
                const select = widgetContainer.querySelector(`#${uniqueId}-main-sort-select`);
                if (!select) return;
                select.value = getPromptSortMode();
                if (select.dataset.sortBound === "1") return;
                const handleSortChange = async (event) => {
                    event.stopPropagation();
                    await setPromptSortMode(event.target.value);
                };
                select.addEventListener("change", handleSortChange);
                select.addEventListener("input", handleSortChange);
                select.dataset.sortBound = "1";
            }

            async function setPromptSortMode(mode, options = {}) {
                const scopeKey = getPromptSortScope(options.scope ?? null);
                const sortMode = normalizePromptSortMode(mode);
                const scopedModes = node_instance.uiPrefs.prompt_sort_modes && typeof node_instance.uiPrefs.prompt_sort_modes === "object"
                    ? { ...node_instance.uiPrefs.prompt_sort_modes }
                    : {};
                scopedModes[scopeKey] = sortMode;
                node_instance.uiPrefs.prompt_sort_modes = scopedModes;
                if (scopeKey === "all") {
                    node_instance.uiPrefs.prompt_sort_mode = sortMode;
                }
                syncPromptSortControls();
                const drawerContainer = widgetContainer.querySelector(`#${uniqueId}-library-chips`);
                const renderedDrawerTab = drawerContainer?.dataset?.renderedTab;
                const drawerTabToRefresh = activeLibraryTab || renderedDrawerTab;
                const refreshTasks = [];
                if (options.reload !== false) {
                    refreshTasks.push(loadPromptsForGallery(1));
                }
                if (drawerTabToRefresh) {
                    refreshTasks.push(renderLibraryDrawer(drawerTabToRefresh));
                }
                await Promise.all(refreshTasks);
                saveUiPrefs().catch(error => {
                    console.warn("LocalPromptGallery: Failed to save prompt sort mode", error);
                });
            }

            async function persistPinnedOrder(nextOrder) {
                node_instance.uiPrefs.pinned_order = normalizePromptIdList(nextOrder);
                await saveUiPrefs();
            }

            function getPromptManualOrder(scope = null) {
                const scopeKey = getPromptSortScope(scope);
                const manualOrders = node_instance.uiPrefs?.prompt_manual_orders;
                return normalizePromptIdList(
                    manualOrders && typeof manualOrders === "object" ? manualOrders[scopeKey] : []
                );
            }

            async function persistPromptManualOrder(scope, nextOrder) {
                const scopeKey = getPromptSortScope(scope);
                const manualOrders = node_instance.uiPrefs.prompt_manual_orders && typeof node_instance.uiPrefs.prompt_manual_orders === "object"
                    ? { ...node_instance.uiPrefs.prompt_manual_orders }
                    : {};
                const nextIds = normalizePromptIdList(nextOrder);
                const currentIds = normalizePromptIdList(manualOrders[scopeKey]);
                if (currentIds.length) {
                    const nextSet = new Set(nextIds);
                    const existingIndexes = currentIds
                        .map((id, index) => nextSet.has(id) ? index : -1)
                        .filter(index => index >= 0);
                    const insertIndex = existingIndexes.length ? Math.min(...existingIndexes) : 0;
                    const mergedIds = currentIds.filter(id => !nextSet.has(id));
                    mergedIds.splice(insertIndex, 0, ...nextIds);
                    manualOrders[scopeKey] = normalizePromptIdList(mergedIds);
                } else {
                    manualOrders[scopeKey] = nextIds;
                }
                node_instance.uiPrefs.prompt_manual_orders = manualOrders;
                await saveUiPrefs();
            }

            function sortPromptsByManualOrder(prompts, order) {
                const orderMap = new Map(normalizePromptIdList(order).map((id, index) => [id, index]));
                return [...prompts].sort((a, b) => {
                    const aIndex = orderMap.has(String(a.id)) ? orderMap.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
                    const bIndex = orderMap.has(String(b.id)) ? orderMap.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
                    if (aIndex !== bIndex) return aIndex - bIndex;
                    return 0;
                });
            }

            function applyPromptManualOrderLocally(scope) {
                const order = getPromptManualOrder(scope);
                if (!order.length || !Array.isArray(node_instance.availablePrompts)) return;
                node_instance.availablePrompts = sortPromptsByManualOrder(node_instance.availablePrompts, order);
            }

            function syncPinnedOrderWithPrompts(prompts) {
                const nextOrder = syncPinnedOrderWithPromptIds(
                    getPinnedOrder(),
                    prompts.map(prompt => prompt.id)
                );
                node_instance.uiPrefs.pinned_order = nextOrder;
                return nextOrder;
            }

            function sortPinnedPrompts(prompts) {
                const orderedIds = syncPinnedOrderWithPrompts(prompts);
                if (node_instance.uiPrefs?.promote_selected_prompts === false) {
                    const promptMap = new Map(prompts.map(prompt => [String(prompt.id), prompt]));
                    return normalizePromptIdList(orderedIds)
                        .map(id => promptMap.get(id))
                        .filter(Boolean);
                }
                return sortPromptsByPinnedOrder(prompts, orderedIds, getSelectedPromptIdsInOrder());
            }

            function promoteSelectedPrompts(prompts) {
                if (node_instance.uiPrefs?.promote_selected_prompts === false) {
                    return prompts;
                }
                return promotePromptsById(prompts, getSelectedPromptIdsInOrder());
            }

            function clearAllSelections() {
                node_instance.promptData = [];
                hideHoverPreview();
                saveSelectionData();
                renderPrompts();
                if (activeLibraryTab) queueLibraryDrawerRender(activeLibraryTab);
                if (app.graph) app.graph.change();
            }

            async function getActivePromptModels() {
                const promptIds = node_instance.promptData.map(entry => entry.prompt_id);
                const fetchedPrompts = await UnifiedPromptGalleryNode.getPromptsByIds(promptIds);
                const promptMap = new Map(fetchedPrompts.map(prompt => [String(prompt.id), prompt]));
                return node_instance.promptData.map(entry => {
                    const fullPrompt = promptMap.get(String(entry.prompt_id));
                    if (fullPrompt) return fullPrompt;
                    return {
                        id: entry.prompt_id,
                        name: entry.name || String(entry.prompt_id),
                        prompt_text: entry.name || '',
                        category: '',
                        preview_type: null,
                        preview_url: null,
                        favorite: false,
                        category_favorites: [],
                        usage_count: 0,
                    };
                }).filter(Boolean);
            }

            async function syncPinnedOrderForFavorite(promptId, isPinned) {
                const currentOrder = getPinnedOrder().filter(id => id !== String(promptId));
                if (isPinned) currentOrder.push(String(promptId));
                await persistPinnedOrder(currentOrder);
            }

            function bindPinnedManagedControls(chip, prompt) {
                chip.querySelectorAll('[data-managed-action]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const action = btn.getAttribute('data-managed-action');
                        updateSelectedPromptEntry(prompt.id, (item, index) => {
                            if (action === 'toggle-on') {
                                item.on = item.on === false;
                            }
                        }, { refreshOnly: true });
                    });
                });

                chip.querySelectorAll('.managed-weight-val').forEach(el => {
                    el.addEventListener('wheel', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const direction = e.deltaY < 0 ? 1 : -1;
                        updateSelectedPromptEntry(prompt.id, (item, index) => {
                            item.weight = stepManagedPromptWeight(item.weight, direction, { step: 0.05 });
                        }, { refreshOnly: true });
                    }, { passive: false });
                });
            }

            // Setup Add Tab Button
            const addTabBtn = widgetContainer.querySelector(`#${uniqueId}-add-tab-btn`);
            if (addTabBtn) {
                addTabBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const categories = await getCachedCategories();
                    if (!categories || categories.length === 0) {
                        alert("No categories available to add.");
                        return;
                    }
                    
                    // Create dropdown
                    const existingDropdown = document.querySelector('.localprompt-add-tab-dropdown');
                    if (existingDropdown) {
                        existingDropdown.remove();
                        return;
                    }
                    
                    const dropdown = document.createElement('div');
                    dropdown.className = 'localprompt-add-tab-dropdown';
                    const rect = addTabBtn.getBoundingClientRect();
                    dropdown.style.cssText = `
                        position: fixed;
                        top: ${rect.bottom + 4}px;
                        left: ${rect.left}px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 0;
                        z-index: 10000;
                        min-width: 150px;
                        max-height: 200px;
                        overflow-y: auto;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    `;
                    
                    const currentTabs = getLibraryTabs();
                    const availableCats = categories.filter(c => c && !currentTabs.includes(c));
                    
                    if (availableCats.length === 0) {
                        dropdown.innerHTML = '<div style="padding: 8px 12px; color: #888; font-size: 11px;">All categories added</div>';
                    } else {
                        availableCats.forEach(cat => {
                            const option = document.createElement('div');
                            option.textContent = cat;
                            option.style.cssText = `
                                padding: 6px 12px;
                                cursor: pointer;
                                color: #ddd;
                                font-size: 12px;
                            `;
                            option.addEventListener('mouseenter', () => option.style.background = '#3a3a3a');
                            option.addEventListener('mouseleave', () => option.style.background = 'transparent');
                            option.addEventListener('click', async () => {
                                currentTabs.push(cat);
                                node_instance.uiPrefs.library_tabs = currentTabs;
                                await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs);
                                dropdown.remove();
                                renderLibraryBar();
                            });
                            dropdown.appendChild(option);
                        });
                    }
                    
                    document.body.appendChild(dropdown);
                    
                    // Click outside to close
                    setTimeout(() => {
                        const closeHandler = (e) => {
                            if (!dropdown.contains(e.target)) {
                                dropdown.remove();
                                document.removeEventListener('click', closeHandler);
                            }
                        };
                        document.addEventListener('click', closeHandler);
                    }, 0);
                });
            }

            function updateActiveSideTabCount() {
                const tab = widgetContainer.querySelector(`#${uniqueId}-active-toggle`);
                const tabCount = widgetContainer.querySelector(`#${uniqueId}-active-tab-count`);
                const count = node_instance.promptData.length;
                if (tabCount) tabCount.textContent = count > 9 ? "9+" : String(count);
                if (tab) {
                    tab.classList.toggle("empty", count === 0);
                    tab.title = count === 0 ? "Active Prompts (empty)" : `${count} active prompt${count === 1 ? "" : "s"}`;
                    tab.setAttribute("aria-label", tab.title);
                }
                if (count === 0 && activeSidebarHoverOpen) {
                    clearActiveSidebarOpenTimer();
                    activeSidebarHoverOpen = false;
                    applyActiveSidebarPreference();
                }
            }

            function syncActivePromptCounts() {
                const selectedCount = widgetContainer.querySelector(`#${uniqueId}-selected-count`);
                const activeCount = widgetContainer.querySelector(`#${uniqueId}-active-count`);
                const activeClearBtn = widgetContainer.querySelector(`#${uniqueId}-active-clear-btn`);

                if (selectedCount) selectedCount.textContent = node_instance.promptData.length;
                if (activeCount) activeCount.textContent = `${node_instance.promptData.length} selected`;
                if (activeClearBtn) activeClearBtn.disabled = node_instance.promptData.length === 0;
                updateActiveSideTabCount();
            }

            function renderPrompts() {
                syncSelectedSectionVisibility();
                syncActivePromptCounts();
                renderActiveSidebar().catch((error) => {
                    console.error('LocalPromptGallery: Failed to render active sidebar', error);
                });
                return;
            }

            function updateConfigBarVisibility() {
                const configBar = widgetContainer.querySelector(`#${uniqueId}-config-bar`);
                const wildcardControlsEl = widgetContainer.querySelector(`#${uniqueId}-wildcard-controls`);
                const hasOpenPanel = wildcardControlsEl && wildcardControlsEl.style.display !== 'none';
                configBar?.classList.toggle('collapsed', !hasOpenPanel);
                syncAutoHideToolbarState();
            }

            function closeDisplayOptionsPopover() {
                const sizeControls = widgetContainer.querySelector(`#${uniqueId}-size-controls`);
                const sizeToggleBtn = widgetContainer.querySelector(`#${uniqueId}-size-toggle-btn`);
                if (sizeControls) sizeControls.style.display = 'none';
                sizeToggleBtn?.classList.remove('active');
                syncAutoHideToolbarState();
            }

            let bottomToolbarHovered = false;
            let bottomToolbarInteracting = false;
            let bottomToolbarHideTimer = null;

            function isAutoHideToolbarsEnabled() {
                return node_instance.uiPrefs?.auto_hide_toolbars === true;
            }

            function toolbarHasFocusedElement(toolbar) {
                if (!toolbar || !document.activeElement || !toolbar.contains(document.activeElement)) {
                    return false;
                }
                return !!document.activeElement.closest("input, select, textarea, [contenteditable='true']");
            }

            function hasOpenBottomToolbarPanel() {
                const sizeControls = widgetContainer.querySelector(`#${uniqueId}-size-controls`);
                const wildcardControlsEl = widgetContainer.querySelector(`#${uniqueId}-wildcard-controls`);
                return !!(
                    (sizeControls && sizeControls.style.display !== 'none')
                    || (wildcardControlsEl && wildcardControlsEl.style.display !== 'none')
                );
            }

            function syncAutoHideToolbarState() {
                const bottomBar = widgetContainer.querySelector(".localprompt-bottom-bar");
                const enabled = isAutoHideToolbarsEnabled();
                widgetContainer.classList.toggle("auto-hide-toolbars", enabled);

                if (!enabled) {
                    bottomBar?.classList.remove("toolbar-revealed", "toolbar-pinned");
                    return;
                }

                if (bottomBar) {
                    const pinned = hasOpenBottomToolbarPanel() || toolbarHasFocusedElement(bottomBar) || bottomToolbarInteracting;
                    bottomBar.classList.toggle("toolbar-pinned", pinned);
                    bottomBar.classList.toggle("toolbar-revealed", pinned || bottomToolbarHovered);
                }
            }

            function scheduleToolbarHide() {
                if (bottomToolbarHideTimer) clearTimeout(bottomToolbarHideTimer);
                bottomToolbarHideTimer = setTimeout(() => {
                    bottomToolbarHovered = false;
                    syncAutoHideToolbarState();
                }, 750);
            }

            function setupAutoHideToolbarBehavior() {
                const bottomBar = widgetContainer.querySelector(".localprompt-bottom-bar");
                const bindToolbar = (toolbar) => {
                    if (!toolbar) return;
                    toolbar.addEventListener("mouseenter", () => {
                        bottomToolbarHovered = true;
                        if (bottomToolbarHideTimer) clearTimeout(bottomToolbarHideTimer);
                        syncAutoHideToolbarState();
                    });
                    toolbar.addEventListener("mouseleave", scheduleToolbarHide);
                    toolbar.addEventListener("focusin", syncAutoHideToolbarState);
                    toolbar.addEventListener("focusout", () => setTimeout(syncAutoHideToolbarState, 0));
                    toolbar.addEventListener("pointerdown", () => {
                        bottomToolbarInteracting = true;
                        syncAutoHideToolbarState();
                        const releaseInteraction = () => {
                            bottomToolbarInteracting = false;
                            syncAutoHideToolbarState();
                            window.removeEventListener("pointerup", releaseInteraction);
                            window.removeEventListener("pointercancel", releaseInteraction);
                        };
                        window.addEventListener("pointerup", releaseInteraction);
                        window.addEventListener("pointercancel", releaseInteraction);
                    });
                };
                bindToolbar(bottomBar);
                syncAutoHideToolbarState();
            }

            function updateWildcardControlsUI() {
                const wildcardToggleBtn = widgetContainer.querySelector(`#${uniqueId}-wildcard-toggle-btn`);
                const wildcardControls = widgetContainer.querySelector(`#${uniqueId}-wildcard-controls`);
                const wildcardRngSelect = widgetContainer.querySelector(`#${uniqueId}-wildcard-rng-select`);
                const wildcardShuffleBtn = widgetContainer.querySelector(`#${uniqueId}-wildcard-shuffle-btn`);
                const isOn = currentWildcardMode === 'on';
                if (wildcardToggleBtn) {
                    wildcardToggleBtn.classList.toggle('active', isOn);
                    wildcardToggleBtn.style.background = isOn ? '#2f6f45' : '';
                    wildcardToggleBtn.style.borderColor = isOn ? '#55a66b' : '';
                    wildcardToggleBtn.style.color = isOn ? '#fff' : '';
                }
                if (wildcardControls) {
                    wildcardControls.style.display = isOn ? 'flex' : 'none';
                }
                const rngMode = normalizeWildcardRngMode(wildcardRngModeWidget?.value || node_instance.properties?.wildcard_rng_mode);
                if (wildcardRngSelect) {
                    wildcardRngSelect.value = rngMode;
                }
                if (wildcardShuffleBtn) {
                    wildcardShuffleBtn.style.display = isOn && rngMode === "shuffle" ? "inline-flex" : "none";
                }
                updateConfigBarVisibility();
            }
            async function renderActiveSidebar() {
                const renderToken = ++activeSidebarRenderToken;
                await renderPromptActiveSidebar({
                    widgetContainer,
                    uniqueId,
                    nodeInstance: node_instance,
                    applyActiveSidebarPreference,
                    isActiveSidebarOpen,
                    hideHoverPreview,
                    getActivePromptModels,
                    getSelectedPromptEntry,
                    applyCategoryRoleStyling,
                    bindPinnedManagedControls,
                    saveSelectionData,
                    renderPrompts,
                    getActiveLibraryTab: () => activeLibraryTab,
                    renderLibraryDrawer: queueLibraryDrawerRender,
                    addPromptToSelection,
                    attachInfoPopup,
                    attachContextMenu,
                    getDisplayMode: getActiveDisplayMode,
                    isRenderCurrent: () => renderToken === activeSidebarRenderToken,
                });
            }

            async function renderLibraryBar() {
                await renderPromptBuilderBar({
                    widgetContainer,
                    uniqueId,
                    getLibraryTabs,
                    getActiveLibraryTab: () => activeLibraryTab,
                    setActiveLibraryTab: value => {
                        activeLibraryTab = value;
                    },
                    saveLibraryTabs: async tabs => {
                        node_instance.uiPrefs.library_tabs = tabs;
                        await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs);
                    },
                    applyLibraryTabLayoutPreference,
                    applyLibraryTabRoleStyling,
                    clearLibraryNavActiveState,
                    renderLibraryDrawer,
                    syncSelectedSectionVisibility,
                    rerenderLibraryBar: renderLibraryBar,
                    uiPrefs: node_instance.uiPrefs,
                });
                const favBtn = widgetContainer.querySelector(`#${uniqueId}-fav-toggle-btn`);
                if (favBtn) {
                    favBtn.classList.toggle("active", activeLibraryTab === "pinned");
                }
                widgetContainer
                    .querySelectorAll(`#${uniqueId}-library-tabs .localprompt-library-tab, #${uniqueId}-utility-tabs .localprompt-library-tab, #${uniqueId}-fav-toggle-btn`)
                    .forEach(button => {
                        button.addEventListener("click", () => {
                            if (getWorkspaceMode() !== "gallery") {
                                setWorkspaceMode("gallery");
                            }
                        }, { capture: true });
                    });
                await renderCategoryDropdownOptions();
                await renderPinnedCategoryStrip();
            }

            async function renderLibraryDrawer(tabName) {
                const renderToken = ++libraryDrawerRenderToken;
                await renderPromptBuilderDrawer({
                    widgetContainer,
                    uniqueId,
                    tabName,
                    nodeInstance: node_instance,
                    galleryNode: UnifiedPromptGalleryNode,
                    hideHoverPreview,
                    getSelectedPromptIdsInOrder,
                    getSelectedPromptEntry,
                    applyCategoryRoleStyling,
                    sortPinnedPrompts,
                    promoteSelectedPrompts,
                    clearAllSelections,
                    toggleFavorite: UnifiedPromptGalleryNode.toggleFavorite,
                    syncPinnedOrderForFavorite,
                    getPinnedOrder,
                    persistPinnedOrder,
                    saveSelectionData,
                    renderPrompts,
                    getActiveLibraryTab: () => activeLibraryTab,
                    rerenderLibraryDrawer: renderLibraryDrawer,
                    bindPinnedManagedControls,
                    addPromptToSelection,
                    attachInfoPopup,
                    attachContextMenu,
                    getSortMode: scope => getPromptSortMode(scope || tabName),
                    setSortMode: setPromptSortMode,
                    getManualOrder: scope => getPromptManualOrder(scope || tabName),
                    persistManualOrder: persistPromptManualOrder,
                    getDisplayMode: getCardsDisplayMode,
                    isRenderCurrent: () => renderToken === libraryDrawerRenderToken && activeLibraryTab === tabName,
                });
            }

            // Helper to attach info popup to element
            function attachInfoPopup(element, prompt) {
                attachPromptInfoPopup({
                    element,
                    prompt,
                    uniqueId,
                    showHoverPreview,
                    hideHoverPreview,
                });
            }

            // Helper to attach context menu to any element
            function attachContextMenu(element, prompt) {
                element.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showContextMenu(prompt, e.clientX, e.clientY);
                });
            }

            // Global refresh function for after context menu actions
            async function refreshAllSections() {
                if (activeLibraryTab) await renderLibraryDrawer(activeLibraryTab);
                renderPrompts();
            }

            async function ensurePromptExistsForEdit(prompt) {
                const originalId = prompt?.id ?? prompt?.prompt_id;
                if (originalId) {
                    const existingPrompt = await UnifiedPromptGalleryNode.getPrompt(originalId);
                    if (existingPrompt) {
                        return existingPrompt;
                    }
                }

                const fallbackText = String(prompt?.prompt_text || prompt?.name || '').trim();
                if (!fallbackText) {
                    throw new Error('This prompt has no saved id or fallback text.');
                }

                const resolved = await UnifiedPromptGalleryNode.getOrCreatePrompts([fallbackText]);
                if (resolved?.status !== 'ok' || !Array.isArray(resolved.prompts) || !resolved.prompts.length) {
                    throw new Error(resolved?.message || 'Could not recreate missing prompt.');
                }

                const resolvedPrompt = resolved.prompts[0];
                const resolvedId = resolvedPrompt.prompt_id || resolvedPrompt.id;
                const fullPrompt = {
                    ...prompt,
                    ...resolvedPrompt,
                    id: resolvedId,
                    prompt_id: resolvedId,
                    name: resolvedPrompt.name || prompt.name || fallbackText,
                    prompt_text: resolvedPrompt.prompt_text || prompt.prompt_text || fallbackText,
                    category: resolvedPrompt.category || prompt.category || 'Combo'
                };

                node_instance.promptData.forEach(entry => {
                    if (
                        String(entry.prompt_id) === String(originalId)
                        || String(entry.name || '').trim().toLowerCase() === String(prompt?.name || '').trim().toLowerCase()
                    ) {
                        entry.id = resolvedId;
                        entry.prompt_id = resolvedId;
                        entry.name = fullPrompt.name;
                        entry.prompt_text = fullPrompt.prompt_text;
                        entry.category = fullPrompt.category;
                    }
                });
                saveSelectionData({ redrawCanvas: false });

                return fullPrompt;
            }

            function updateLocalPromptAfterMetadataSave(promptId, nextData) {
                const key = String(promptId);
                const updateEntry = (entry) => {
                    entry.id = promptId;
                    entry.prompt_id = promptId;
                    if (Object.prototype.hasOwnProperty.call(nextData, 'name')) entry.name = nextData.name;
                    if (Object.prototype.hasOwnProperty.call(nextData, 'prompt_text')) entry.prompt_text = nextData.prompt_text;
                    if (Object.prototype.hasOwnProperty.call(nextData, 'category')) entry.category = nextData.category;
                };

                let changedSelection = false;
                node_instance.promptData.forEach(entry => {
                    if (String(entry.prompt_id) === key || String(entry.id) === key) {
                        updateEntry(entry);
                        changedSelection = true;
                    }
                });

                if (Array.isArray(node_instance.availablePrompts)) {
                    node_instance.availablePrompts = node_instance.availablePrompts.map(entry => {
                        const entryId = entry?.id ?? entry?.prompt_id;
                        if (String(entryId) !== key) return entry;
                        return {
                            ...entry,
                            ...nextData,
                            id: promptId,
                            prompt_id: promptId
                        };
                    });
                }

                if (changedSelection) {
                    saveSelectionData({ redrawCanvas: false });
                }
            }

            // Context menu function (global)
            function showContextMenu(prompt, x, y, customRefresh = null) {
                const refresh = customRefresh || refreshAllSections;
                openPromptActionContextMenu({
                    prompt,
                    x,
                    y,
                    hasLastOutput: !!UnifiedPromptGalleryNode.lastOutput,
                    actions: {
                        edit: async (selectedPrompt) => {
                            try {
                                const editablePrompt = await ensurePromptExistsForEdit(selectedPrompt);
                                showEditPromptDialog(editablePrompt, refresh);
                            } catch (e) {
                                alert('Error preparing prompt for edit: ' + e.message);
                            }
                        },
                        thumbnail: async (selectedPrompt) => {
                            showUploadThumbnailDialog(selectedPrompt, refresh);
                        },
                        favorite: async (selectedPrompt) => {
                            const result = await UnifiedPromptGalleryNode.toggleFavorite(selectedPrompt.id);
                            if (result?.status === 'ok') {
                                await syncPinnedOrderForFavorite(selectedPrompt.id, result.favorite);
                            }
                            await refresh();
                        },
                        reset_usage: async (selectedPrompt) => {
                            await UnifiedPromptGalleryNode.resetUsageCount(selectedPrompt.id);
                            await refresh();
                        },
                        use_last_output: async (selectedPrompt) => {
                            if (UnifiedPromptGalleryNode.lastOutput) {
                                const res = await UnifiedPromptGalleryNode.assignThumbnail(selectedPrompt.id, UnifiedPromptGalleryNode.lastOutput);
                                if (res.status === 'ok') {
                                    await refresh();
                                } else {
                                    alert('Error: ' + res.message);
                                }
                            }
                        },
                        delete: async (selectedPrompt) => {
                            if (confirm(`Delete prompt "${selectedPrompt.name}"?`)) {
                                await UnifiedPromptGalleryNode.deletePrompt(selectedPrompt.id);
                                const idx = node_instance.promptData.findIndex(p => p.prompt_id === selectedPrompt.id);
                                if (idx >= 0) {
                                    node_instance.promptData.splice(idx, 1);
                                    saveSelectionData();
                                }
                                await refresh();
                            }
                        },
                    },
                });
            }

            // Helper to add/remove prompt from selection
            function addPromptToSelection(prompt) {
                const existingIndex = node_instance.promptData.findIndex(p => String(p.prompt_id) === String(prompt.id));
                let isNowSelected = false;
                if (existingIndex >= 0) {
                    // Remove if already selected
                    node_instance.promptData.splice(existingIndex, 1);
                } else {
                    // Add to selection
                    node_instance.promptData.push({
                        prompt_id: prompt.id,
                        name: prompt.name,
                        on: true,
                        weight: 1.0
                    });
                    isNowSelected = true;
                }
                hideHoverPreview();
                saveSelectionData();
                renderPrompts();
                if (typeof activeLibraryTab !== 'undefined' && activeLibraryTab) {
                    queueLibraryDrawerRender(activeLibraryTab);
                }
                return isNowSelected;
            }

            function showHoverPreview(prompt, event, anchorElement = null) {
                return showPromptHoverPreview({
                    prompt,
                    event,
                    anchorElement,
                    uniqueId,
                    getCategoryRoleColor,
                });
            }

            function hideHoverPreview() {
                hidePromptHoverPreview({ uniqueId });
            }

            function renderGallery() {
                renderPromptGallery({
                    uniqueId,
                    nodeInstance: node_instance,
                    galleryNode: UnifiedPromptGalleryNode,
                    syncPinnedOrderForFavorite,
                    loadPromptsForGallery,
                    attachInfoPopup,
                    showPromptContextMenu,
                    saveSelectionData,
                    renderPrompts,
                    preservePromptOrder: false,
                    sortMode: getPromptSortMode(),
                    manualOrderScope: getPromptSortScope(),
                    setSortMode: setPromptSortMode,
                    persistManualOrder: async (scope, nextOrder) => {
                        await setPromptSortMode("manual", { scope: { key: scope }, reload: false });
                        await persistPromptManualOrder(scope, nextOrder);
                        applyPromptManualOrderLocally(scope);
                        renderGallery();
                    },
                });
            }

            async function loadCategories() {
                invalidateCategoryCache();
                const categoryAwareGalleryNode = {
                    ...UnifiedPromptGalleryNode,
                    getCategories: () => getCachedCategories({ force: true }),
                };
                await loadPromptGalleryCategories({
                    widgetContainer,
                    uniqueId,
                    galleryNode: categoryAwareGalleryNode,
                });
                await renderCategoryDropdownOptions();
            }

            async function loadPromptsForGallery(page = 1) {
                const filterInput = widgetContainer.querySelector(`#${uniqueId}-filter-input`);
                const modeSelect = widgetContainer.querySelector(`#${uniqueId}-filter-mode`);
                const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);

                const filterName = filterInput ? filterInput.value : "";
                const mode = modeSelect ? modeSelect.value : "OR";
                const category = categorySelect ? categorySelect.value : "";

                const selectedPromptIds = node_instance.promptData.map(p => p.prompt_id);
                const querySelectedIds = node_instance.uiPrefs?.promote_selected_prompts === false ? [] : selectedPromptIds;
                const data = await UnifiedPromptGalleryNode.getPrompts(filterName, mode, page, querySelectedIds, category, node_instance.showFavoritesOnly, 10, getPromptSortMode());

                const prompts = data.prompts || [];
                if (node_instance.uiPrefs?.promote_selected_prompts === false) {
                    node_instance.availablePrompts = prompts;
                } else {
                    const selectedPrompts = selectedPromptIds.length ? await getActivePromptModels() : [];
                    const selectedPromptIdSet = new Set(selectedPromptIds.map(id => String(id)));
                    const visibleSelectedPrompts = selectedPrompts.filter(prompt => promptMatchesCurrentGallery(prompt));
                    const visibleSelectedIdSet = new Set(visibleSelectedPrompts.map(prompt => String(prompt.id)));
                    node_instance.availablePrompts = [
                        ...visibleSelectedPrompts,
                        ...prompts.filter(prompt => !visibleSelectedIdSet.has(String(prompt.id))),
                    ].filter((prompt, index, allPrompts) => {
                        const promptId = String(prompt.id);
                        return selectedPromptIdSet.has(promptId) || allPrompts.findIndex(item => String(item.id) === promptId) === index;
                    });
                }
                renderGallery();
                renderPrompts();

                const pageInfo = widgetContainer.querySelector(`#${uniqueId}-page-info`);
                const prevBtn = widgetContainer.querySelector(`#${uniqueId}-prev-btn`);
                const nextBtn = widgetContainer.querySelector(`#${uniqueId}-next-btn`);

                if (pageInfo) pageInfo.textContent = `Page ${data.current_page} of ${data.total_pages}`;
                if (prevBtn) prevBtn.disabled = data.current_page <= 1;
                if (nextBtn) nextBtn.disabled = data.current_page >= data.total_pages;
            }

            function promptMatchesCurrentGallery(prompt) {
                return promptMatchesPromptGallery({
                    prompt,
                    widgetContainer,
                    uniqueId,
                    nodeInstance: node_instance,
                });
            }

            function insertPromptIntoCurrentGallery(prompt) {
                if (!prompt || !promptMatchesCurrentGallery(prompt)) {
                    return false;
                }

                if (!Array.isArray(node_instance.availablePrompts)) {
                    node_instance.availablePrompts = [];
                }
                const existingIndex = node_instance.availablePrompts.findIndex(item => String(item.id) === String(prompt.id));
                if (existingIndex >= 0) {
                    node_instance.availablePrompts.splice(existingIndex, 1);
                }
                node_instance.availablePrompts.unshift(prompt);
                renderGallery();
                renderPrompts();
                return true;
            }

            async function renameCategoryWithPrompt(oldCategory, onSuccess) {
                const sourceCategory = String(oldCategory || '').trim();
                if (!sourceCategory) {
                    alert('No category selected to rename.');
                    return false;
                }

                const requestedName = prompt(`Rename category "${sourceCategory}" to:`, sourceCategory);
                if (requestedName === null) return false;

                const targetCategory = requestedName.trim();
                if (!targetCategory) {
                    alert('Please enter a category name.');
                    return false;
                }
                if (targetCategory === sourceCategory) {
                    return false;
                }

                const confirmed = confirm(
                    `Rename "${sourceCategory}" to "${targetCategory}" and move every prompt in that category?`
                );
                if (!confirmed) return false;

                const result = await UnifiedPromptGalleryNode.renameCategory(sourceCategory, targetCategory);
                if (result?.status !== 'ok') {
                    alert('Error: ' + (result?.message || 'Failed to rename category'));
                    return false;
                }

                if (typeof onSuccess === 'function') {
                    await onSuccess(targetCategory, result);
                }
                return true;
            }

            function showPromptContextMenu(event, prompt) {
                openPromptContextMenu({
                    event,
                    prompt,
                    showEditPromptDialog,
                    showUploadThumbnailDialog,
                    deletePromptWithConfirm,
                });
            }

            async function showEditPromptDialog(prompt, onRefresh = null) {
                await openEditPromptDialog({
                    prompt,
                    galleryNode: UnifiedPromptGalleryNode,
                    updateLocalPromptAfterMetadataSave,
                    loadCategories,
                    loadPromptsForGallery,
                    refreshAllSections,
                    onRefresh,
                });
            }


            async function showFromLastOutputDialog() {
                await openFromLastOutputDialog({
                    galleryNode: UnifiedPromptGalleryNode,
                    nodeInstance: node_instance,
                    getPromptSourceNode,
                    insertPromptIntoCurrentGallery,
                    loadPromptsForGallery,
                });
            }

            async function showFromLastOutputWorkspace() {
                const host = setWorkspaceMode("from_last_output");
                await openFromLastOutputDialog({
                    galleryNode: UnifiedPromptGalleryNode,
                    nodeInstance: node_instance,
                    getPromptSourceNode,
                    insertPromptIntoCurrentGallery,
                    loadPromptsForGallery,
                    workspaceContainer: host,
                    onClose: returnToGallery,
                });
                if (host && !host.hasChildNodes()) {
                    returnToGallery();
                }
            }

            async function showAddPromptDialog() {
                await openAddPromptDialog({
                    galleryNode: UnifiedPromptGalleryNode,
                    nodeInstance: node_instance,
                    loadCategories,
                    loadPromptsForGallery,
                });
            }

            async function showImportDialog() {
                await openImportDialog({
                    galleryNode: UnifiedPromptGalleryNode,
                    loadCategories,
                    loadPromptsForGallery,
                });
            }

            async function showImportWorkspace(onClose = returnToGallery) {
                const host = renderLibraryShell("import");
                if (!host) return;
                await openImportDialog({
                    galleryNode: UnifiedPromptGalleryNode,
                    loadCategories,
                    loadPromptsForGallery,
                    workspaceContainer: host,
                    onClose,
                    librarySubnavHtml: getLibrarySubnavHtml("import"),
                });
            }

            async function showPresetsWorkspace(onClose = returnToGallery) {
                const host = renderLibraryShell("presets");
                if (!host) return;
                await openPresetsModal({
                    app,
                    nodeInstance: node_instance,
                    galleryNode: UnifiedPromptGalleryNode,
                    categoriesWidget,
                    getCurrentWildcardMode: () => currentWildcardMode,
                    setCurrentWildcardMode: mode => {
                        currentWildcardMode = mode;
                    },
                    saveSelectionData,
                    saveWildcardState,
                    updateWildcardControlsUI,
                    renderPrompts,
                    getActiveLibraryTab: () => activeLibraryTab,
                    renderLibraryDrawer,
                    workspaceContainer: host,
                    onClose,
                    librarySubnavHtml: getLibrarySubnavHtml("presets"),
                });
            }

            async function showBrowseWorkspace(onClose = returnToGallery) {
                const host = renderLibraryShell("cards");
                if (!host) return;
                await openCardManager({
                    app,
                    nodeInstance: node_instance,
                    galleryNode: UnifiedPromptGalleryNode,
                    saveSelectionData,
                    loadCategories,
                    refreshAllSections,
                    addPromptToSelection,
                    syncPinnedOrderForFavorite,
                    attachInfoPopup,
                    showContextMenu,
                    renameCategoryWithPrompt,
                    getCategoryRoleColor,
                    getSortMode: scope => getPromptSortMode(scope),
                    setSortMode: setPromptSortMode,
                    getManualOrder: scope => getPromptManualOrder(scope),
                    persistManualOrder: persistPromptManualOrder,
                    workspaceContainer: host,
                    onClose,
                    librarySubnavHtml: getLibrarySubnavHtml("cards"),
                });
            }

            function showUploadThumbnailDialog(prompt, onRefresh = null) {
                openUploadThumbnailDialog({
                    prompt,
                    galleryNode: UnifiedPromptGalleryNode,
                    loadPromptsForGallery,
                    onRefresh,
                });
            }

            async function deletePromptWithConfirm(prompt) {
                if (!confirm(`Are you sure you want to delete "${prompt.name}"?`)) {
                    return;
                }

                await UnifiedPromptGalleryNode.deletePrompt(prompt.id);
                await loadCategories();
                await loadPromptsForGallery(UnifiedPromptGalleryNode.currentPage);
            }

            setTimeout(() => {
                const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);

                const prevBtn = widgetContainer.querySelector(`#${uniqueId}-prev-btn`);
                const nextBtn = widgetContainer.querySelector(`#${uniqueId}-next-btn`);

                if (categorySelect) {
                    categorySelect.addEventListener('change', async () => {
                        await loadPromptsForGallery(1);
                        // Show/hide delete category button based on selection
                        const deleteCategoryBtn = widgetContainer.querySelector(`#${uniqueId}-delete-category-btn`);
                        if (deleteCategoryBtn) {
                            deleteCategoryBtn.style.display = categorySelect.value ? 'block' : 'none';
                        }
                    });
                }

                // Delete category button handler
                const deleteCategoryBtn = widgetContainer.querySelector(`#${uniqueId}-delete-category-btn`);
                if (deleteCategoryBtn) {
                    deleteCategoryBtn.addEventListener('click', async () => {
                        const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);
                        const categoryToDelete = categorySelect?.value;
                        
                        if (!categoryToDelete) {
                            alert('Please select a category to delete.');
                            return;
                        }
                        
                        // Show confirmation dialog
                        const confirmed = confirm(
                            `DELETE ENTIRE CATEGORY\n\n` +
                            `Are you sure you want to delete the category "${categoryToDelete}" and ALL prompts within it?\n\n` +
                            `This action cannot be undone!`
                        );
                        
                        if (!confirmed) return;
                        
                        // Second confirmation for safety
                        const doubleConfirmed = confirm(
                            `Final confirmation:\n\n` +
                            `Delete ALL prompts in "${categoryToDelete}"?`
                        );
                        
                        if (!doubleConfirmed) return;
                        
                        try {
                            const result = await UnifiedPromptGalleryNode.deleteCategory(categoryToDelete);
                            if (result.status === 'ok') {
                                alert(result.message);
                                categorySelect.value = ''; // Reset to "All Categories"
                                deleteCategoryBtn.style.display = 'none';
                                await loadCategories();
                                await loadPromptsForGallery(1);
                            } else {
                                alert('Error: ' + (result.message || 'Failed to delete category'));
                            }
                        } catch (e) {
                            console.error('Error deleting category:', e);
                            alert('Error deleting category: ' + e.message);
                        }
                    });
                }



                if (prevBtn) {
                    prevBtn.addEventListener('click', async () => {
                        if (UnifiedPromptGalleryNode.currentPage > 1) {
                            await loadPromptsForGallery(UnifiedPromptGalleryNode.currentPage - 1);
                        }
                    });
                }

                if (nextBtn) {
                    nextBtn.addEventListener('click', async () => {
                        if (UnifiedPromptGalleryNode.currentPage < UnifiedPromptGalleryNode.totalPages) {
                            await loadPromptsForGallery(UnifiedPromptGalleryNode.currentPage + 1);
                        }
                    });
                }
                // ========== WILDCARD MODE ==========
                currentWildcardMode = wildcardWidget?.value || 'off';

                const wildcardToggleBtn = widgetContainer.querySelector(`#${uniqueId}-wildcard-toggle-btn`);

                if (wildcardToggleBtn) {
                    updateWildcardControlsUI();
                    wildcardToggleBtn.addEventListener('click', () => {
                        currentWildcardMode = currentWildcardMode === 'on' ? 'off' : 'on';
                        saveWildcardState(currentWildcardMode, categoriesWidget?.value || "[]");
                        updateWildcardControlsUI();
                    });
                }

                // Seed controls in bottom bar
                const btmSeedInput = widgetContainer.querySelector(`#${uniqueId}-seed-input`);
                const btmSeedDec = widgetContainer.querySelector(`#${uniqueId}-seed-dec`);
                const btmSeedInc = widgetContainer.querySelector(`#${uniqueId}-seed-inc`);

                if (btmSeedInput) {
                    btmSeedInput.value = seedWidget?.value || 0;
                    btmSeedInput.addEventListener('input', (e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (seedWidget) seedWidget.value = val;
                        if (app.graph) app.graph.change();
                    });
                }

                if (btmSeedDec) {
                    btmSeedDec.addEventListener('click', () => {
                        let current = parseInt(btmSeedInput?.value, 10) || 0;
                        current = Math.max(0, current - 1);
                        if (btmSeedInput) btmSeedInput.value = current;
                        if (seedWidget) seedWidget.value = current;
                        if (app.graph) app.graph.change();
                    });
                }

                if (btmSeedInc) {
                    btmSeedInc.addEventListener('click', () => {
                        let current = parseInt(btmSeedInput?.value, 10) || 0;
                        current += 1;
                        if (btmSeedInput) btmSeedInput.value = current;
                        if (seedWidget) seedWidget.value = current;
                        if (app.graph) app.graph.change();
                    });
                }

                const btmControlSelect = widgetContainer.querySelector(`#${uniqueId}-control-select`);
                if (btmControlSelect) {
                    btmControlSelect.value = controlWidget?.value || 'fixed';
                    btmControlSelect.addEventListener('change', (e) => {
                        if (controlWidget) controlWidget.value = e.target.value;
                        if (app.graph) app.graph.change();
                    });
                }

                const wildcardRngSelect = widgetContainer.querySelector(`#${uniqueId}-wildcard-rng-select`);
                const wildcardShuffleBtn = widgetContainer.querySelector(`#${uniqueId}-wildcard-shuffle-btn`);
                if (wildcardRngSelect) {
                    wildcardRngSelect.value = normalizeWildcardRngMode(wildcardRngModeWidget?.value || node_instance.properties?.wildcard_rng_mode);
                    wildcardRngSelect.addEventListener('change', (event) => {
                        saveWildcardRngState(event.target.value, wildcardShuffleNonceWidget?.value || "0");
                        updateWildcardControlsUI();
                    });
                }
                if (wildcardShuffleBtn) {
                    wildcardShuffleBtn.addEventListener('click', () => {
                        const currentNonce = Number.parseInt(wildcardShuffleNonceWidget?.value || node_instance.properties?.wildcard_shuffle_nonce || "0", 10) || 0;
                        saveWildcardRngState("shuffle", String(currentNonce + 1));
                        updateWildcardControlsUI();
                    });
                }

                // Wildcards button handler
                widgetContainer.querySelector(`#${uniqueId}-wildcards-btn`)?.addEventListener('click', () => {
                    showWildcardsModal({
                        getCategories: () => getCachedCategories(),
                        categoriesWidget,
                        getCurrentWildcardMode: () => currentWildcardMode,
                        saveWildcardState,
                    });
                });

                // Sync seed input with widget on execution (DOM sync only, no increment logic)
                const originalOnExecuted = node_instance.onExecuted;
                node_instance.onExecuted = function (message) {
                    if (originalOnExecuted) {
                        originalOnExecuted.apply(this, arguments);
                    }
                    const seedInputEl = widgetContainer.querySelector(`#${uniqueId}-seed-input`);
                    if (seedWidget && seedInputEl) {
                        seedInputEl.value = seedWidget.value;
                    }
                };
                // ========== END WILDCARD MODE ==========


                if (node_instance.properties && node_instance.properties.prompt_selection_data) {
                    try {
                        node_instance.promptData = readSelectionArray(node_instance.properties.prompt_selection_data, []);
                    } catch (e) {
                        node_instance.promptData = [];
                    }
                }
                loadMetaTagsFromProperties();

                // Load UI preferences and initialize
                (async () => {
                    // Load UI preferences
                    node_instance.uiPrefs = mergeUiPrefs(
                        node_instance.uiPrefs,
                        await UnifiedPromptGalleryNode.getUiPrefs()
                    );
                    node_instance.uiPrefs.active_sidebar_open = false;
                    node_instance.uiPrefs.active_display_mode = getActiveDisplayMode();
                    node_instance.uiPrefs.cards_display_mode = getCardsDisplayMode();
                    if (typeof node_instance.properties?.active_sidebar_width === 'number') {
                        node_instance.uiPrefs.active_sidebar_width = node_instance.properties.active_sidebar_width;
                    }
                    node_instance.uiPrefs.library_tabs = getLibraryTabs();
                    if (activeLibraryTab === 'active') {
                        activeLibraryTab = null;
                    }
                    applyThumbnailSizePreference();
                    applyActiveThumbnailSizePreference();
                    setupThumbnailSizeSliders();
                    applyActiveSidebarWidthPreference();
                    applyActiveSidebarPreference();
                    applyMetaTagsButtonSidePreference();
                    applyActiveBorderThemePreference();
                    applyCardContrastModePreference();
                    syncPromptSortControls();
                    syncAutoHideToolbarState();
                    
                    // Render all sections
                    renderPrompts();
                    await renderLibraryBar();
                    await renderPinnedCategoryStrip();
                    renderMetaTags();
                    await renderCategoryDropdownOptions();
                    syncSelectedSectionVisibility();
                    updatePromptSourceStatus();
                })();

                // ========== NEW BUTTON HANDLERS ==========

                const pullTab = widgetContainer.querySelector(`#${uniqueId}-category-pull-tab`);
                if (pullTab) {
                    pullTab.addEventListener("click", async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        categoryOverflowOpen = !categoryOverflowOpen;
                        if (categoryOverflowOpen) {
                            closeToolbarPanels(widgetContainer.querySelector(`#${uniqueId}-category-overflow`));
                        } else {
                            closeToolbarPanels();
                        }
                        await renderCategoryOverflowCategories();
                    });
                }
                setupToolbarDropdown(
                    `${uniqueId}-meta-tags-btn`,
                    `${uniqueId}-meta-tags-panel`,
                    () => renderMetaTags()
                );
                const favBtn = widgetContainer.querySelector(`#${uniqueId}-fav-toggle-btn`);
                if (favBtn) {
                    favBtn.addEventListener("click", async () => {
                        if (getWorkspaceMode() !== "gallery") {
                            setWorkspaceMode("gallery");
                        }
                        const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
                        if (activeLibraryTab === "pinned") {
                            activeLibraryTab = null;
                            clearLibraryNavActiveState();
                            drawer.classList.remove("active");
                        } else {
                            activeLibraryTab = "pinned";
                            clearLibraryNavActiveState();
                            favBtn.classList.add("active");
                            drawer.classList.add("active");
                            await renderLibraryDrawer("pinned");
                        }
                        syncPromptSortControls();
                        syncSelectedSectionVisibility();
                    });
                }

                setupAutoHideToolbarBehavior();

                toolbarOutsideClickHandler = () => {
                    closeToolbarPanels();
                    closeDisplayOptionsPopover();
                };
                document.addEventListener("click", toolbarOutsideClickHandler);

                bindAddMetaTagButton();

                widgetContainer.querySelector(`#${uniqueId}-manage-categories-btn`)?.addEventListener("click", async () => {
                    closeToolbarPanels();
                    await showSettingsWorkspace();
                });

                widgetContainer.querySelector(`#${uniqueId}-library-btn`)?.addEventListener('click', () => {
                    toggleWorkspaceMode("library_overview", renderLibraryWorkspace);
                });

                widgetContainer.querySelector(`#${uniqueId}-from-last-output-btn`)?.addEventListener('click', async () => {
                    try {
                        await toggleWorkspaceMode("from_last_output", showFromLastOutputWorkspace);
                    } catch (e) {
                        console.error("Error in showFromLastOutputDialog:", e);
                        alert("Error opening dialog: " + e.message);
                    }
                });

                // Import button
                widgetContainer.querySelector(`#${uniqueId}-import-btn`)?.addEventListener('click', async () => {
                    try {
                        await toggleWorkspaceMode("library_import", showImportWorkspace);
                    } catch (e) {
                        console.error("Error showing import dialog:", e);
                        alert(e.message);
                    }
                });

                // Settings button
                widgetContainer.querySelector(`#${uniqueId}-settings-btn`)?.addEventListener('click', () => {
                    toggleWorkspaceMode("settings", showSettingsWorkspace);
                });

                widgetContainer.querySelector(`#${uniqueId}-size-toggle-btn`)?.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    // Retract active sidebar on toolbar interaction (focus change)
                    if (isActiveSidebarOpen()) {
                        clearActiveSidebarOpenTimer();
                        clearActiveSidebarCloseTimer();
                        activeSidebarHoverOpen = false;
                        applyActiveSidebarPreference();
                    }
                    closeToolbarPanels();
                    const sizeControls = widgetContainer.querySelector(`#${uniqueId}-size-controls`);
                    const sizeToggleBtn = widgetContainer.querySelector(`#${uniqueId}-size-toggle-btn`);
                    const isOpen = sizeControls && sizeControls.style.display !== 'none';
                    if (sizeControls) {
                        sizeControls.style.display = isOpen ? 'none' : 'grid';
                    }
                    sizeToggleBtn?.classList.toggle('active', !isOpen);
                    syncThumbnailSizeSliders();
                    if (!isOpen) {
                        fitFloatingPanelToNode(sizeControls);
                        requestAnimationFrame(() => fitFloatingPanelToNode(sizeControls));
                    }
                    updateConfigBarVisibility();
                });
                widgetContainer.querySelector(`#${uniqueId}-size-controls`)?.addEventListener('click', (event) => {
                    event.stopPropagation();
                });

                const activeSideTab = widgetContainer.querySelector(`#${uniqueId}-active-toggle`);
                const activeSidebarEl = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
                activeSideTab?.addEventListener('mouseenter', () => {
                    scheduleActiveSidebarHoverOpen();
                });
                activeSideTab?.addEventListener('mouseleave', () => {
                    clearActiveSidebarOpenTimer();
                });
                activeSideTab?.addEventListener('click', async () => {
                    await toggleActiveSidebarPeek();
                });
                activeSidebarEl?.addEventListener('mouseenter', clearActiveSidebarCloseTimer);
                activeSidebarEl?.addEventListener('mouseleave', scheduleActiveSidebarHoverClose);

                // Close active sidebar on "focus change" — clicking anywhere else on the node
                widgetContainer.addEventListener('click', (e) => {
                    if (!isActiveSidebarOpen()) return;
                    const clickedInsideSidebar = activeSidebarEl?.contains(e.target);
                    const clickedInsideToggle = activeSideTab?.contains(e.target);
                    if (!clickedInsideSidebar && !clickedInsideToggle) {
                        clearActiveSidebarOpenTimer();
                        clearActiveSidebarCloseTimer();
                        activeSidebarHoverOpen = false;
                        applyActiveSidebarPreference();
                    }
                });

                widgetContainer.querySelector(`#${uniqueId}-active-clear-btn`)?.addEventListener('click', () => {
                    if (node_instance.promptData.length > 0 && confirm("Remove all prompts from selection?")) {
                        clearAllSelections();
                    }
                });

                // Presets Modal
                async function showPresetsModal() {
                    await openPresetsModal({
                        app,
                        nodeInstance: node_instance,
                        galleryNode: UnifiedPromptGalleryNode,
                        categoriesWidget,
                        getCurrentWildcardMode: () => currentWildcardMode,
                        setCurrentWildcardMode: mode => {
                            currentWildcardMode = mode;
                        },
                        saveSelectionData,
                        saveWildcardState,
                        updateWildcardControlsUI,
                        renderPrompts,
                        getActiveLibraryTab: () => activeLibraryTab,
                        renderLibraryDrawer,
                    });
                }

                // Seed input and inc/dec listeners are already bound in the main seed controls block above.

                // Control after generate dropdown listener is already bound in the main seed controls block above.

                // Card Manager modal function
                async function showCardManagerModal() {
                    await openCardManager({
                        app,
                        nodeInstance: node_instance,
                        galleryNode: UnifiedPromptGalleryNode,
                        saveSelectionData,
                        loadCategories,
                        refreshAllSections,
                        addPromptToSelection,
                        syncPinnedOrderForFavorite,
                        attachInfoPopup,
                        showContextMenu,
                        renameCategoryWithPrompt,
                        getCategoryRoleColor,
                        getSortMode: scope => getPromptSortMode(scope),
                        setSortMode: setPromptSortMode,
                        getManualOrder: scope => getPromptManualOrder(scope),
                        persistManualOrder: persistPromptManualOrder,
                    });
                }

                // Settings Modal function
                async function showSettingsModal() {
                    await openSettingsModal({
                        uniqueId,
                        app,
                        nodeInstance: node_instance,
                        galleryNode: UnifiedPromptGalleryNode,
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
                        applyMetaTagsButtonSidePreference,
                        applyAutoHideToolbarPreference: syncAutoHideToolbarState,
                        applyActiveBorderThemePreference,
                        applyActiveSidebarPreference,
                        applyActiveThumbnailSizePreference,
                        renderActiveSidebar,
                        renderGallery,
                        renderLibraryBar,
                        getActiveLibraryTab: () => activeLibraryTab,
                        renderLibraryDrawer,
                        getPinnedCategories,
                        savePinnedCategories,
                    });
                }

                async function showSettingsWorkspace() {
                    const host = setWorkspaceMode("settings");
                    await openSettingsModal({
                        uniqueId,
                        app,
                        nodeInstance: node_instance,
                        galleryNode: UnifiedPromptGalleryNode,
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
                        applyMetaTagsButtonSidePreference,
                        applyAutoHideToolbarPreference: syncAutoHideToolbarState,
                        applyActiveBorderThemePreference,
                        applyActiveSidebarPreference,
                        applyActiveThumbnailSizePreference,
                        renderActiveSidebar,
                        renderGallery,
                        renderLibraryBar,
                        getActiveLibraryTab: () => activeLibraryTab,
                        renderLibraryDrawer,
                        getPinnedCategories,
                        savePinnedCategories,
                        workspaceContainer: host,
                        onClose: returnToGallery,
                    });
                }

            }, 100);

            return result;
        };
    }
};

app.registerExtension({
    name: "LocalGalleryPromptLora.PromptUI",
    async setup() {
        // Global execution listener to track outputs from ANY node
        api.addEventListener("executed", (event) => {
            const output = event.detail?.output;
            if (!output) return;
            
            // Check for images
            if (output.images && output.images.length > 0) {
                const last = output.images[output.images.length - 1];
                UnifiedPromptGalleryNode.lastOutput = {
                    filename: last.filename,
                    subfolder: last.subfolder || '',
                    type: last.type || 'output'
                };
            }
            // Check for gifs (videos)
            else if (output.gifs && output.gifs.length > 0) {
                const last = output.gifs[output.gifs.length - 1];
                UnifiedPromptGalleryNode.lastOutput = {
                    filename: last.filename,
                    subfolder: last.subfolder || '',
                    type: last.type || 'output'
                };
            }
        });
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "LocalGalleryPromptLora") {
            UnifiedPromptGalleryNode.setup(nodeType, nodeData);
        }
    },
    async nodeCreated(node) {
        // onExecuted seed sync is handled inside the setup() setTimeout block
        // where the DOM elements are guaranteed to exist.
    }
});
}

