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
    getActiveThumbnailSizePx as resolveActiveThumbnailSizePx,
    getCategoryColorMap as resolveCategoryColorMap,
    getCategoryRoleColor as resolveCategoryRoleColor,
    getLibraryTabsFromPrefs,
    getNearestPaletteColor,
    getThumbnailSizePx as resolveThumbnailSizePx,
    getThumbnailVariables,
    hexToRgba,
    isShowTextNode,
    normalizePromptIdList,
    promotePromptsById,
    sortPromptsByPinnedOrder,
    stepManagedPromptWeight,
    syncPinnedOrderWithPromptIds,
} from "./helpers.js";
import { showBrowseModal as openBrowseModal } from "./browse.js?v=sort-20260606";
import {
    showAddPromptDialog as openAddPromptDialog,
    showEditPromptDialog as openEditPromptDialog,
    showFromLastOutputDialog as openFromLastOutputDialog,
    showImportDialog as openImportDialog,
    showUploadThumbnailDialog as openUploadThumbnailDialog,
} from "./dialogs.js?v=sort-20260606";
import {
    showPromptActionContextMenu as openPromptActionContextMenu,
    showPromptContextMenu as openPromptContextMenu,
} from "./contextMenus.js";
import {
    attachInfoPopup as attachPromptInfoPopup,
    hideHoverPreview as hidePromptHoverPreview,
    showHoverPreview as showPromptHoverPreview,
} from "./previews.js";
import {
    applyActiveSidebarPreference as applyPromptActiveSidebarPreference,
    applyActiveSidebarWidthPreference as applyPromptActiveSidebarWidthPreference,
    getActiveSidebarWidth as getPromptActiveSidebarWidth,
    isActiveSidebarOpen as isPromptActiveSidebarOpen,
    renderActiveSidebar as renderPromptActiveSidebar,
    setupActiveSidebarResize as setupPromptActiveSidebarResize,
} from "./activeSidebar.js?v=sort-20260606";
import {
    loadCategories as loadPromptGalleryCategories,
    promptMatchesCurrentGallery as promptMatchesPromptGallery,
    renderGallery as renderPromptGallery,
} from "./gallery.js?v=sort-20260606";
import {
    applyLibraryTabLayoutPreference as applyLibraryTabLayoutClasses,
    getUtilityLibraryTabs,
    isUtilityLibraryTab,
    renderLibraryBar as renderPromptLibraryBar,
    renderLibraryDrawer as renderPromptLibraryDrawer,
} from "./library.js?v=sort-20260606";
import { showPresetsModal as openPresetsModal } from "./presets.js";
import { showSettingsModal as openSettingsModal } from "./settings.js?v=sort-20260606";
import { showWildcardsModal } from "./wildcards.js";
import { escapeHtml } from "../shared/dom.js";
import { readSelectionArray, stringifyJsonOr, writeSelectionArray } from "../shared/json.js";
import { collapseWidget, hideWidget } from "../shared/widgets.js";

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
            return {
                display_mode: "thumbnails",
                most_used_count: 10,
                library_tab_layout: "scroll",
                thumbnail_size: "medium",
                thumbnail_size_px: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_DEFAULT,
                active_thumbnail_size_px: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_DEFAULT,
                library_tabs: ["most_used", "pinned"],
                pinned_categories: null,
                visible_pinned_category_count: 5,
                pinned_order: [],
                category_colors: {},
                active_sidebar_open: false,
                active_sidebar_width: 392,
            };
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

            if (!this.properties || !this.properties.prompt_gallery_unique_id) {
                if (!this.properties) {
                    this.properties = {};
                }
                this.properties.prompt_gallery_unique_id = "prompt-gallery-" + Math.random().toString(36).substring(2, 11);
            }
            if (typeof this.properties.active_sidebar_width !== 'number') {
                this.properties.active_sidebar_width = 392;
            }

            // --- WIDGET SETUP ---
            // Add visible/DOM widgets FIRST to minimize space above them
            
            const galleryIdWidget = this.addWidget(
                "text",
                "prompt_gallery_unique_id_widget",
                this.properties.prompt_gallery_unique_id,
                () => { },
                {}
            );

            galleryIdWidget.serializeValue = () => {
                return this.properties.prompt_gallery_unique_id;
            };

            collapseWidget(galleryIdWidget);

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
                display_mode: "text",
                most_used_count: 10,
                show_most_used: true,
                library_tab_layout: "scroll",
                thumbnail_size: "medium",
                thumbnail_size_px: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_DEFAULT,
                active_thumbnail_size_px: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_DEFAULT,
                pinned_categories: null,
                visible_pinned_category_count: 5,
                pinned_order: [],
                category_colors: {},
                active_sidebar_width: 392,
                last_created_category: "",
                prompt_sort_mode: "manual",
            };

            const selectionWidget = this.addWidget(
                "text",
                "prompt_selection_data",
                this.properties.prompt_selection_data || "[]",
                () => { },
                { multiline: true }
            );

            selectionWidget.serializeValue = () => {
                return node_instance.properties["prompt_selection_data"] || "[]";
            };

            collapseWidget(selectionWidget);

            const metaTagsWidget = this.addWidget(
                "text",
                "prompt_meta_tags",
                this.properties.prompt_meta_tags || "[]",
                () => { },
                { multiline: true }
            );

            metaTagsWidget.serializeValue = () => {
                return node_instance.properties["prompt_meta_tags"] || "[]";
            };

            collapseWidget(metaTagsWidget);

            const activeSidebarWidthWidget = this.addWidget(
                "number",
                "active_sidebar_width",
                this.properties.active_sidebar_width || 392,
                () => { },
                {}
            );
            activeSidebarWidthWidget.serializeValue = () => {
                return Number(node_instance.properties.active_sidebar_width) || 392;
            };
            hideWidget(activeSidebarWidthWidget);

            // ADD DOM WIDGET HERE - before hidden data widgets
            widgetContainer = document.createElement("div");
            widgetContainer.className = "localprompt-container-wrapper";
            this.addDOMWidget("prompt_gallery", "div", widgetContainer, {});

            // --- HIDDEN DATA WIDGETS (added AFTER DOM widget to not affect its position) ---
            
            // Wildcard Mode
            let wildcardWidget = this.widgets?.find(w => w.name === 'wildcard_mode');
            if (!wildcardWidget) {
                wildcardWidget = this.addWidget("text", "wildcard_mode", "off", () => { }, {});
            }
            if (typeof this.properties.wildcard_mode === 'string') {
                wildcardWidget.value = this.properties.wildcard_mode;
            } else if (typeof wildcardWidget.value === 'string') {
                this.properties.wildcard_mode = wildcardWidget.value;
            }
            wildcardWidget.serializeValue = () => {
                return node_instance.properties["wildcard_mode"] || "off";
            };
            hideWidget(wildcardWidget);

            let wildcardRngModeWidget = this.widgets?.find(w => w.name === 'wildcard_rng_mode');
            if (!wildcardRngModeWidget) {
                wildcardRngModeWidget = this.addWidget("text", "wildcard_rng_mode", "seed_stable", () => { }, {});
            }
            if (typeof this.properties.wildcard_rng_mode === 'string') {
                wildcardRngModeWidget.value = this.properties.wildcard_rng_mode;
            } else if (typeof wildcardRngModeWidget.value === 'string') {
                this.properties.wildcard_rng_mode = wildcardRngModeWidget.value;
            }
            wildcardRngModeWidget.serializeValue = () => {
                return node_instance.properties["wildcard_rng_mode"] || "seed_stable";
            };
            hideWidget(wildcardRngModeWidget);

            let wildcardShuffleNonceWidget = this.widgets?.find(w => w.name === 'wildcard_shuffle_nonce');
            if (!wildcardShuffleNonceWidget) {
                wildcardShuffleNonceWidget = this.addWidget("text", "wildcard_shuffle_nonce", "0", () => { }, {});
            }
            if (typeof this.properties.wildcard_shuffle_nonce === 'string') {
                wildcardShuffleNonceWidget.value = this.properties.wildcard_shuffle_nonce;
            } else if (typeof wildcardShuffleNonceWidget.value === 'string') {
                this.properties.wildcard_shuffle_nonce = wildcardShuffleNonceWidget.value;
            }
            wildcardShuffleNonceWidget.serializeValue = () => {
                return node_instance.properties["wildcard_shuffle_nonce"] || "0";
            };
            hideWidget(wildcardShuffleNonceWidget);

            // Wildcard Categories
            let categoriesWidget = this.widgets?.find(w => w.name === 'wildcard_categories');
            if (!categoriesWidget) {
                categoriesWidget = this.addWidget("text", "wildcard_categories", "", () => { }, {});
            }
            if (typeof this.properties.wildcard_categories === 'string') {
                categoriesWidget.value = this.properties.wildcard_categories;
            } else if (typeof categoriesWidget.value === 'string') {
                this.properties.wildcard_categories = categoriesWidget.value;
            }
            categoriesWidget.serializeValue = () => {
                return node_instance.properties["wildcard_categories"] || "[]";
            };
            hideWidget(categoriesWidget);

            // Seed
            let seedWidget = this.widgets?.find(w => w.name === 'seed');
            if (!seedWidget) {
                seedWidget = this.addWidget("number", "seed", 0, (v) => { }, { min: 0, max: 0xffffffffffffffff });
            }
            hideWidget(seedWidget);

            // Control After Generate
            let controlWidget = this.widgets?.find(w => w.name === 'control_after_generate');
            if (!controlWidget) {
                controlWidget = this.addWidget("combo", "control_after_generate", "increment",
                    (v) => { },
                    { values: ["fixed", "increment", "decrement", "randomize"] }
                );
            }
            hideWidget(controlWidget);


            const uniqueId = `localprompt-gallery-${this.id}`;

            widgetContainer.innerHTML = `
                <style>
                    .localprompt-container-wrapper {
                        width: 100%;
                        height: 100%;
                    }
                    .localprompt-container {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        background: #1a1a1a;
                        border-radius: 8px;
                        overflow: hidden;
                        position: relative;
                    }
                    .localprompt-btn {
                        padding: 5px 10px;
                        background: #3a3a3a;
                        color: #ddd;
                        border: 1px solid #555;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 11px;
                        white-space: nowrap;
                        transition: background 0.15s;
                    }
                    .localprompt-btn:hover { background: #4a4a4a; }
                    .localprompt-btn.active { background: #4a7c4a; border-color: #5a9c5a; }
                    .localprompt-clear-btn:hover { background: #6a3a3a !important; border-color: #8a4a4a !important; }
                    .localprompt-icon-btn {
                        width: 32px;
                        height: 28px;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        flex: 0 0 auto;
                    }
                    .localprompt-icon-btn svg {
                        width: 15px;
                        height: 15px;
                        display: block;
                        stroke: currentColor;
                    }
                    .localprompt-toolbar {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        width: 100%;
                        min-width: 0;
                    }
                    .localprompt-pinned-categories {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 1 1 auto;
                        min-width: 0;
                        overflow: visible;
                    }
                    .localprompt-pinned-category-strip {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                        overflow: hidden;
                        flex: 1 1 auto;
                    }
                    .localprompt-pinned-category-pill {
                        max-width: 128px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        border-radius: 999px;
                        padding: 5px 10px;
                        font-size: 11px;
                        line-height: 1;
                        background: #2a2a2a;
                        color: #ddd;
                        border: 1px solid #444;
                        cursor: pointer;
                        flex: 0 1 auto;
                    }
                    .localprompt-pinned-category-pill:hover,
                    .localprompt-pinned-category-pill.active {
                        color: #fff;
                        filter: brightness(1.1);
                    }
                    .localprompt-category-grid-button {
                        width: 32px;
                        height: 28px;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        flex: 0 0 auto;
                        border-radius: 6px;
                        background: #292929;
                        border: 1px solid #444;
                        color: #ddd;
                        cursor: pointer;
                    }
                    .localprompt-category-grid-button:hover,
                    .localprompt-category-grid-button.active {
                        background: #344a34;
                        border-color: #5a9c5a;
                        color: #fff;
                    }
                    .localprompt-category-grid-button svg {
                        width: 15px;
                        height: 15px;
                        display: block;
                        stroke: currentColor;
                    }
                    .localprompt-more-category-group {
                        position: relative;
                        margin-left: auto;
                        flex: 0 0 auto;
                    }
                    .localprompt-more-category-group.hidden {
                        display: none;
                    }
                    .localprompt-toolbar-shortcuts {
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        margin-left: auto;
                        flex: 0 0 auto;
                    }
                    .localprompt-toolbar-group {
                        position: relative;
                        flex: 0 0 auto;
                    }
                    .localprompt-toolbar-button {
                        height: 30px;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 0 10px;
                        border-radius: 6px;
                        background: #292929;
                        border: 1px solid #444;
                        color: #ddd;
                        font-size: 11px;
                        cursor: pointer;
                    }
                    .localprompt-toolbar-button:hover,
                    .localprompt-toolbar-button.active {
                        background: #344a34;
                        border-color: #5a9c5a;
                        color: #fff;
                    }
                    .localprompt-toolbar-button.has-enabled {
                        border-color: #5a9c5a;
                        box-shadow: inset 0 0 0 1px rgba(90, 156, 90, 0.2);
                    }
                    .localprompt-toolbar-button .chevron {
                        color: #888;
                        font-size: 9px;
                        line-height: 1;
                    }
                    .localprompt-dropdown-panel {
                        position: absolute;
                        top: calc(100% + 6px);
                        left: 0;
                        display: none;
                        z-index: 2000;
                        min-width: 220px;
                        max-width: min(520px, 92vw);
                        background: #202020;
                        border: 1px solid #444;
                        border-radius: 8px;
                        box-shadow: 0 10px 28px rgba(0,0,0,0.55);
                        padding: 8px;
                    }
                    .localprompt-dropdown-panel.open {
                        display: block;
                    }
                    #${uniqueId}-categories-panel {
                        width: min(600px, calc(100vw - 24px));
                        max-width: min(600px, calc(100vw - 24px));
                        right: 0;
                        left: auto;
                        padding: 12px;
                        position: absolute;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-bar-container {
                        display: block;
                        padding-top: 0;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-bar-container::before {
                        display: none;
                        content: none;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-tab-strip {
                        display: block;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-tabs-scroll {
                        display: flex;
                        flex-wrap: wrap;
                        overflow: visible;
                        gap: 9px 10px;
                        padding: 0 34px 0 0;
                        max-height: 230px;
                        overflow-y: auto;
                        align-items: center;
                        align-content: flex-start;
                    }
                    #${uniqueId}-categories-panel .localprompt-library-add-tab {
                        display: none;
                    }
                    .localprompt-category-sort-row {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin: 0 34px 10px 0;
                        padding: 7px 9px;
                        background: rgba(255,255,255,0.035);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 8px;
                    }
                    .localprompt-category-sort-row label {
                        color: #aeb6bd;
                        font-size: 11px;
                        white-space: nowrap;
                    }
                    .localprompt-sort-select {
                        min-height: 28px;
                        min-width: 136px;
                        padding: 5px 8px;
                        background: #111820;
                        border: 1px solid #3b4652;
                        border-radius: 7px;
                        color: #e8ecef;
                        font-size: 11px;
                    }
                    .localprompt-sort-select option {
                        background: #111820;
                        color: #e8ecef;
                    }
                    .localprompt-category-palette-item {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        min-width: 0;
                        max-width: 180px;
                    }
                    .localprompt-category-palette-item .localprompt-library-tab {
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .localprompt-dropdown-note {
                        color: #a8a8a8;
                        font-size: 10px;
                        line-height: 1.45;
                        padding: 4px 4px 8px;
                    }
                    .localprompt-category-list {
                        display: none;
                    }
                    .localprompt-dropdown-divider {
                        height: 1px;
                        background: #383838;
                        margin: 8px 0;
                    }
                    #${uniqueId}-categories-panel .localprompt-dropdown-divider {
                        display: none;
                    }
                    .localprompt-category-popover-footer {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        z-index: 1;
                    }
                    .localprompt-category-manage-icon {
                        width: 26px;
                        height: 26px;
                        padding: 0;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        background: transparent;
                        border: 1px solid transparent;
                        border-radius: 5px;
                        color: #8f8f8f;
                        cursor: pointer;
                    }
                    .localprompt-category-manage-icon:hover {
                        color: #ddd;
                        background: #2a2a2a;
                        border-color: #444;
                    }
                    .localprompt-meta-panel {
                        width: min(560px, 86vw);
                    }
                    .localprompt-meta-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 10px;
                    }
                    .localprompt-meta-save-status {
                        color: #777;
                        font-size: 10px;
                        line-height: 1.35;
                        white-space: nowrap;
                        min-width: 46px;
                        text-align: right;
                    }
                    .localprompt-meta-save-status.saving {
                        color: #aaa;
                    }
                    .localprompt-meta-save-status.saved {
                        color: #76b982;
                    }
                    .localprompt-meta-list {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }
                    .localprompt-meta-row {
                        display: grid;
                        grid-template-columns: 54px minmax(82px, 0.45fr) minmax(170px, 1.35fr) 28px;
                        align-items: start;
                        gap: 8px;
                        padding: 6px 0;
                        border-bottom: 1px solid #303030;
                        background: transparent;
                    }
                    .localprompt-meta-row:last-child {
                        border-bottom: 0;
                    }
                    .localprompt-meta-toggle {
                        height: 24px;
                        min-width: 46px;
                        padding: 0 10px;
                        border-radius: 999px;
                        border: 1px solid #4a4a4a;
                        background: linear-gradient(180deg, #3b3b3b 0%, #282828 100%);
                        color: #d5d5d5;
                        font-size: 10px;
                        font-weight: 700;
                        cursor: pointer;
                    }
                    .localprompt-meta-toggle.on {
                        background: linear-gradient(180deg, #438a4e 0%, #2f6638 100%);
                        border-color: #5aa764;
                        color: #fff;
                        box-shadow: 0 0 10px rgba(90, 156, 90, 0.18);
                    }
                    .localprompt-meta-toggle.off {
                        background: linear-gradient(180deg, #3d3d3d 0%, #292929 100%);
                        border-color: #555;
                        color: #e0e0e0;
                    }
                    .localprompt-meta-name,
                    .localprompt-meta-text {
                        min-width: 0;
                        width: 100%;
                        background: #151515;
                        color: #e0e0e0;
                        border: 1px solid #444;
                        border-radius: 5px;
                        font-size: 11px;
                        padding: 5px 8px;
                        box-sizing: border-box;
                    }
                    .localprompt-meta-name::placeholder,
                    .localprompt-meta-text::placeholder {
                        color: #777;
                    }
                    .localprompt-meta-text {
                        resize: none;
                        min-height: 24px;
                        max-height: 110px;
                        line-height: 1.35;
                        overflow: hidden;
                    }
                    .localprompt-meta-action {
                        width: 28px;
                        height: 24px;
                        padding: 0;
                    }
                    .localprompt-meta-empty {
                        padding: 10px;
                        border: 1px dashed #3a3a3a;
                        border-radius: 7px;
                        color: #777;
                        font-size: 11px;
                        text-align: center;
                    }
                    .localprompt-section {
                        padding: 8px 10px;
                        border-bottom: 1px solid #333;
                        overflow: hidden;
                    }
                    .localprompt-workspace {
                        display: flex;
                        flex-direction: column;
                        flex: 1;
                        min-height: 0;
                    }
                    .localprompt-top-row {
                        display: flex;
                        align-items: flex-start;
                        gap: 10px;
                        background: #1e1e1e;
                        padding: 8px 10px;
                        border-bottom: 1px solid #333;
                    }
                    .localprompt-top-controls {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 6px;
                        flex: 0 0 auto;
                    }
                    .localprompt-active-toggle {
                        flex: 0 0 auto;
                        align-self: center;
                        margin-right: 0;
                        width: 54px;
                        height: 28px;
                        border-radius: 999px;
                        background: linear-gradient(180deg, rgba(47, 111, 69, 0.9) 0%, rgba(35, 79, 48, 0.94) 100%);
                        border-color: #4f985d;
                        color: #fff;
                        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 12px rgba(90,156,90,0.12);
                    }
                    .localprompt-active-toggle::before {
                        content: '\\25B6';
                        font-size: 9px;
                        letter-spacing: 0;
                        opacity: 0.9;
                        margin-right: 8px;
                    }
                    .localprompt-library-bar-container {
                        position: relative;
                        padding-top: 10px;
                    }
                    .localprompt-library-bar-container::before {
                        content: 'Categories';
                        position: absolute;
                        top: -2px;
                        left: 0;
                        font-size: 9px;
                        font-weight: 700;
                        color: #929292;
                        text-transform: uppercase;
                        letter-spacing: 0.12em;
                        pointer-events: none;
                    }
                    .localprompt-utility-bar {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        flex: 0 0 auto;
                        align-self: flex-start;
                        padding-top: 0;
                        position: static;
                    }
                    .localprompt-utility-buttons {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        padding: 1px;
                        background: transparent;
                        border: 0;
                        border-radius: 0;
                        box-shadow: none;
                    }
                    .localprompt-body-shell {
                        display: flex;
                        flex: 1;
                        min-height: 0;
                    }
                    .localprompt-active-sidebar {
                        display: none;
                        flex-direction: column;
                        width: var(--localprompt-active-sidebar-width, 392px);
                        min-width: var(--localprompt-active-sidebar-width, 392px);
                        max-width: var(--localprompt-active-sidebar-width, 392px);
                        background: linear-gradient(180deg, #161616 0%, #111111 100%);
                        border-right: 1px solid #2f2f2f;
                        box-shadow: inset -1px 0 0 rgba(255,255,255,0.03);
                        min-height: 0;
                    }
                    .localprompt-active-sidebar.active {
                        display: flex;
                    }
                    .localprompt-active-splitter {
                        display: none;
                        flex: 0 0 10px;
                        align-items: center;
                        justify-content: center;
                        cursor: ew-resize;
                        background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.04) 100%);
                        border-right: 1px solid #2d2d2d;
                        border-left: 1px solid #1a1a1a;
                        transition: background 0.15s ease;
                    }
                    .localprompt-active-splitter.active {
                        display: flex;
                    }
                    .localprompt-active-splitter:hover,
                    .localprompt-active-splitter.dragging {
                        background: linear-gradient(180deg, rgba(90, 156, 90, 0.2) 0%, rgba(74, 158, 255, 0.14) 100%);
                    }
                    .localprompt-active-splitter-bar {
                        width: 3px;
                        height: 42px;
                        border-radius: 999px;
                        background: linear-gradient(180deg, #4e4e4e 0%, #7a7a7a 50%, #4e4e4e 100%);
                        box-shadow: 0 0 0 1px rgba(0,0,0,0.25);
                    }
                    .localprompt-active-sidebar-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        padding: 10px 12px;
                        border-bottom: 1px solid #2a2a2a;
                        background: rgba(255,255,255,0.02);
                    }
                    .localprompt-active-sidebar-title {
                        display: flex;
                        align-items: baseline;
                        gap: 8px;
                        min-width: 0;
                    }
                    .localprompt-active-sidebar-title span:first-child {
                        font-size: 11px;
                        font-weight: 700;
                        color: #ececec;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                    }
                    .localprompt-active-sidebar-title span:last-child {
                        font-size: 10px;
                        color: #8f8f8f;
                    }
                    .localprompt-active-sidebar-content {
                        flex: 1;
                        min-height: 0;
                        overflow-y: auto;
                        padding: 8px 6px 8px 8px;
                        scrollbar-width: thin;
                        scrollbar-color: #4a4a4a transparent;
                    }
                    .localprompt-active-sidebar .localprompt-chip-container {
                        max-height: none;
                        min-height: 0;
                        padding-right: 1px;
                    }
                    .localprompt-library-pane {
                        display: flex;
                        flex-direction: column;
                        flex: 1;
                        min-width: 0;
                        min-height: 0;
                    }
                    .localprompt-workspace-host {
                        display: none;
                        flex: 1;
                        min-height: 0;
                        overflow: hidden;
                        background: #151515;
                    }
                    .localprompt-workspace-host.active {
                        display: flex;
                        flex-direction: column;
                    }
                    .localprompt-library-shell {
                        display: flex;
                        flex-direction: column;
                        flex: 1;
                        min-height: 0;
                        background: radial-gradient(circle at 20% 0%, rgba(69, 125, 85, 0.08), transparent 34%), #111820;
                    }
                    .localprompt-library-subnav {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        gap: 5px;
                        padding: 0 14px 8px;
                    }
                    .localprompt-library-subnav-item {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 24px;
                        padding: 4px 9px;
                        border: 1px solid rgba(255,255,255,0.09);
                        border-radius: 999px;
                        background: rgba(255,255,255,0.035);
                        color: #c7ccd2;
                        font-size: 11px;
                        line-height: 1;
                        cursor: pointer;
                    }
                    .localprompt-library-subnav-item:hover {
                        background: rgba(255,255,255,0.075);
                        color: #fff;
                    }
                    .localprompt-library-subnav-item.active {
                        background: rgba(75, 181, 99, 0.18);
                        border-color: rgba(94, 210, 118, 0.32);
                        color: #7df08f;
                        box-shadow: inset 0 0 0 1px rgba(92, 219, 111, 0.22);
                    }
                    .localprompt-library-shell-content {
                        display: flex;
                        flex-direction: column;
                        min-width: 0;
                        min-height: 0;
                        padding: 0 8px 8px;
                        overflow: hidden;
                    }
                    .localprompt-library-shell-content > .localprompt-workspace-panel {
                        padding: 0;
                    }
                    .localprompt-library-shell .localprompt-workspace-page,
                    .localprompt-library-shell .localprompt-modal.localprompt-workspace-page {
                        background: transparent !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                    .localprompt-library-shell .localprompt-workspace-header {
                        border-bottom: 0;
                    }
                    .localprompt-library-shell .localprompt-workspace-body {
                        padding-top: 8px;
                    }
                    .localprompt-library-shell .localprompt-workspace-footer {
                        background: transparent;
                        border-top: 1px solid rgba(255,255,255,0.06);
                    }
                    .localprompt-settings-page.localprompt-workspace-page {
                        background: transparent !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                    .localprompt-settings-page .localprompt-workspace-header {
                        border-bottom: 0;
                    }
                    .localprompt-settings-page .localprompt-workspace-title p {
                        display: none;
                    }
                    .localprompt-settings-page .localprompt-workspace-body {
                        padding-top: 8px;
                    }
                    .localprompt-settings-page .localprompt-workspace-footer {
                        background: transparent;
                        border-top: 1px solid rgba(255,255,255,0.06);
                    }
                    .localprompt-from-output-page.localprompt-workspace-page {
                        background: transparent !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }
                    .localprompt-from-output-page .localprompt-workspace-header {
                        border-bottom: 0;
                        padding: 8px 14px 6px;
                    }
                    .localprompt-from-output-page .localprompt-workspace-title p {
                        display: none;
                    }
                    .localprompt-from-output-page .localprompt-workspace-body {
                        padding-top: 8px;
                    }
                    .localprompt-from-output-page .localprompt-workspace-footer {
                        background: transparent;
                        border-top: 1px solid rgba(255,255,255,0.06);
                    }
                    .localprompt-from-output-page .localprompt-workspace-section {
                        background: transparent;
                        border: 0;
                        border-radius: 0;
                        padding: 0 0 14px;
                        margin-bottom: 14px;
                    }
                    .localprompt-from-output-page .localprompt-from-output-details {
                        grid-template-columns: 116px minmax(0, 1fr) !important;
                        gap: 16px !important;
                        align-items: stretch !important;
                        padding-bottom: 18px;
                        border-bottom: 1px solid rgba(255,255,255,0.07);
                    }
                    .localprompt-from-output-page .localprompt-from-output-preview-wrap,
                    .localprompt-from-output-page .localprompt-from-output-preview {
                        width: 116px !important;
                    }
                    .localprompt-from-output-page .localprompt-from-output-preview {
                        height: 116px !important;
                        border: 1px solid rgba(255,255,255,0.12) !important;
                        border-radius: 7px !important;
                        background: rgba(255,255,255,0.04) !important;
                        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
                    }
                    .localprompt-from-output-page label {
                        color: #dfe5e2 !important;
                        font-size: 11px !important;
                    }
                    .localprompt-from-output-page input,
                    .localprompt-from-output-page select,
                    .localprompt-from-output-page textarea {
                        background: rgba(0,0,0,0.18) !important;
                        border: 1px solid rgba(255,255,255,0.12) !important;
                        border-radius: 6px !important;
                        color: #f2f4f3 !important;
                    }
                    .localprompt-from-output-page select option {
                        background: #11171d;
                        color: #f2f4f3;
                    }
                    .localprompt-from-output-page select option:disabled {
                        color: #808892;
                    }
                    .localprompt-from-output-page input:focus,
                    .localprompt-from-output-page select:focus,
                    .localprompt-from-output-page textarea:focus {
                        border-color: rgba(93, 207, 105, 0.55) !important;
                        box-shadow: 0 0 0 1px rgba(93, 207, 105, 0.18);
                        outline: none;
                    }
                    .localprompt-from-output-page textarea {
                        min-height: 150px;
                    }
                    .localprompt-from-output-page .localprompt-from-output-source {
                        color: #9ba5ad !important;
                    }
                    .localprompt-from-output-page #from-last-output-cancel,
                    .localprompt-from-output-page #from-last-output-save {
                        min-height: 28px;
                        padding: 5px 14px !important;
                        border-radius: 6px !important;
                    }
                    .localprompt-from-output-page #from-last-output-cancel {
                        background: rgba(255,255,255,0.05) !important;
                        border-color: rgba(255,255,255,0.14) !important;
                    }
                    .localprompt-from-output-page #from-last-output-save {
                        background: rgba(70, 134, 73, 0.9) !important;
                        border-color: rgba(105, 190, 111, 0.7) !important;
                    }
                    @container (max-width: 520px) {
                        .localprompt-from-output-page .localprompt-from-output-details {
                            grid-template-columns: 1fr !important;
                        }
                        .localprompt-from-output-page .localprompt-from-output-preview-wrap,
                        .localprompt-from-output-page .localprompt-from-output-preview {
                            width: 100% !important;
                        }
                        .localprompt-from-output-page .localprompt-from-output-preview {
                            height: 160px !important;
                        }
                    }
                    .localprompt-workspace-panel {
                        display: flex;
                        flex-direction: column;
                        flex: 1;
                        min-height: 0;
                        padding: 10px;
                        overflow: hidden;
                    }
                    .localprompt-workspace-page,
                    .localprompt-workspace-card {
                        width: 100% !important;
                        max-width: none !important;
                        max-height: none !important;
                        height: 100%;
                        flex: 1;
                        box-shadow: none !important;
                        border-radius: 6px !important;
                    }
                    .localprompt-workspace-page {
                        display: flex;
                        flex-direction: column;
                        min-height: 0;
                        background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015));
                        border: 1px solid rgba(255,255,255,0.09);
                        color: #ddd;
                        overflow: hidden;
                    }
                    .localprompt-workspace-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        padding: 10px 14px 6px;
                        background: transparent;
                        border-bottom: 1px solid rgba(255,255,255,0.07);
                    }
                    .localprompt-workspace-title {
                        min-width: 0;
                    }
                    .localprompt-workspace-title h3 {
                        margin: 0;
                        color: #f3f5f4;
                        font-size: 17px;
                        line-height: 1.2;
                    }
                    .localprompt-workspace-title p {
                        margin: 4px 0 0;
                        color: #a8afb8;
                        font-size: 11px;
                        line-height: 1.4;
                    }
                    .localprompt-library-shell .localprompt-workspace-title p {
                        display: none;
                    }
                    .localprompt-workspace-back {
                        min-height: 26px;
                        padding: 4px 9px;
                        border-radius: 999px;
                        background: rgba(255,255,255,0.04);
                        border: 1px solid rgba(255,255,255,0.13);
                        color: #e5e7ea;
                        cursor: pointer;
                        font-size: 11px;
                        line-height: 1;
                        flex: 0 0 auto;
                    }
                    .localprompt-workspace-back:hover {
                        background: rgba(255,255,255,0.08);
                        color: #fff;
                    }
                    .localprompt-workspace-body {
                        flex: 1;
                        min-height: 0;
                        overflow-y: auto;
                        padding: 10px 14px;
                    }
                    .localprompt-workspace-footer {
                        display: flex;
                        justify-content: flex-end;
                        gap: 8px;
                        padding: 8px 14px;
                        background: rgba(255,255,255,0.025);
                        border-top: 1px solid rgba(255,255,255,0.08);
                        flex: 0 0 auto;
                    }
                    .localprompt-workspace-section {
                        padding: 14px;
                        margin-bottom: 14px;
                        background: rgba(255,255,255,0.025);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 8px;
                    }
                    .localprompt-workspace-section h4 {
                        margin: 0 0 10px;
                        color: #e8e8e8;
                        font-size: 12px;
                    }
                    .localprompt-presets-list {
                        max-height: 300px;
                        overflow-y: auto;
                        background: rgba(8, 13, 19, 0.42);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 9px;
                        padding: 6px;
                    }
                    .localprompt-preset-row {
                        display: grid;
                        grid-template-columns: 28px minmax(0, 1fr) auto auto auto;
                        align-items: center;
                        gap: 8px;
                        padding: 8px;
                        background: rgba(255,255,255,0.025);
                        border-bottom: 1px solid rgba(255,255,255,0.06);
                    }
                    .localprompt-preset-row:last-child {
                        border-bottom: 0;
                    }
                    .localprompt-preset-icon {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 22px;
                        height: 22px;
                        border-radius: 6px;
                        background: rgba(155, 98, 255, 0.15);
                        border: 1px solid rgba(155, 98, 255, 0.28);
                        color: #b58cff;
                        font-size: 11px;
                        font-weight: 700;
                    }
                    .localprompt-preset-load {
                        background: rgba(72, 174, 94, 0.13) !important;
                        border-color: rgba(89, 210, 115, 0.3) !important;
                        color: #83e896 !important;
                    }
                    .localprompt-preset-edit {
                        background: rgba(79, 147, 255, 0.13) !important;
                        border-color: rgba(79, 147, 255, 0.32) !important;
                        color: #7fb0ff !important;
                    }
                    .localprompt-preset-delete {
                        background: rgba(220, 68, 68, 0.12) !important;
                        border-color: rgba(220, 68, 68, 0.34) !important;
                        color: #ff7777 !important;
                    }
                    .localprompt-workspace-card .localprompt-modal-content {
                        min-height: 0;
                    }
                    .localprompt-library-landing {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
                        gap: 14px;
                    }
                    .localprompt-library-choice {
                        position: relative;
                        min-height: 152px;
                        padding: 22px;
                        text-align: left;
                        border-radius: 9px;
                        background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
                        border: 1px solid rgba(255,255,255,0.1);
                        color: #ddd;
                        cursor: pointer;
                        overflow: hidden;
                    }
                    .localprompt-library-choice:hover {
                        background: linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035));
                        border-color: rgba(255,255,255,0.2);
                        transform: translateY(-1px);
                    }
                    .localprompt-library-choice::after {
                        content: '>';
                        position: absolute;
                        right: 18px;
                        top: 50%;
                        color: #f4f7f5;
                        font-size: 22px;
                        transform: translateY(-50%);
                    }
                    .localprompt-library-choice::before {
                        content: '';
                        position: absolute;
                        inset: auto 0 0;
                        height: 3px;
                        background: var(--library-accent, #58d66a);
                        opacity: 0.9;
                    }
                    .localprompt-library-choice-icon {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 42px;
                        height: 42px;
                        margin-bottom: 24px;
                        border-radius: 9px;
                        background: color-mix(in srgb, var(--library-accent, #58d66a) 18%, transparent);
                        border: 1px solid color-mix(in srgb, var(--library-accent, #58d66a) 48%, transparent);
                        color: var(--library-accent, #58d66a);
                        font-size: 21px;
                    }
                    .localprompt-library-choice strong {
                        display: block;
                        margin-bottom: 8px;
                        color: #f0f0f0;
                        font-size: 18px;
                    }
                    .localprompt-library-choice span {
                        display: block;
                        max-width: 210px;
                        color: #a9b0b8;
                        font-size: 13px;
                        line-height: 1.45;
                    }
                    .localprompt-library-bar-container {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 1;
                        min-width: 0;
                    }
                    .localprompt-library-bar-container.wrap-mode {
                        align-items: flex-start;
                    }
                    .localprompt-library-tab-strip {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 1;
                        min-width: 0;
                    }
                    .localprompt-library-tab-strip.wrap-mode {
                        align-items: flex-start;
                    }
                    .localprompt-library-tabs-scroll {
                        display: flex;
                        gap: 6px;
                        overflow-x: auto;
                        flex: 1;
                        padding-bottom: 2px;
                        min-width: 0;
                    }
                    .localprompt-library-tabs-scroll.wrap-mode {
                        flex-wrap: wrap;
                        overflow-x: visible;
                        padding-bottom: 0;
                    }
                    .localprompt-library-tabs-scroll.wrap-mode::-webkit-scrollbar {
                        display: none;
                    }
                    .localprompt-library-tabs-scroll::-webkit-scrollbar { height: 4px; }
                    .localprompt-library-tabs-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
                    
                    .localprompt-library-tab {
                        padding: 4px 10px;
                        background: #2a2a2a;
                        color: #aaa;
                        border-radius: 12px;
                        font-size: 11px;
                        cursor: pointer;
                        white-space: nowrap;
                        user-select: none;
                        transition: all 0.15s ease;
                        border: 1px solid #333;
                    }
                    .localprompt-library-tab:hover { background: #333; color: #ddd; }
                    .localprompt-library-tab.active { background: #3a5a3a; color: #fff; border-color: #5a9c5a; box-shadow: 0 0 8px rgba(90, 156, 90, 0.4); }
                    .localprompt-utility-tab {
                        background: rgba(255,255,255,0.05);
                        color: #d7d7d7;
                        border-color: rgba(255,255,255,0.12);
                        border-radius: 999px;
                        font-size: 15px;
                        font-weight: 700;
                        letter-spacing: 0;
                        padding: 0;
                        width: 28px;
                        height: 28px;
                        min-height: 28px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .localprompt-utility-tab:hover {
                        background: rgba(255,255,255,0.12);
                        color: #fff;
                        border-color: rgba(255,255,255,0.2);
                    }
                    .localprompt-utility-tab.active {
                        background: linear-gradient(180deg, rgba(62, 84, 62, 0.78) 0%, rgba(44, 66, 44, 0.82) 100%);
                        color: #fff;
                        border-color: #5a9c5a;
                        box-shadow: 0 0 8px rgba(90, 156, 90, 0.2);
                    }
                    
                    .localprompt-library-add-tab {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 28px;
                        height: 28px;
                        background: #242424;
                        color: #b0b0b0;
                        border: 1px solid #3a3a3a;
                        border-radius: 999px;
                        font-size: 18px;
                        line-height: 1;
                        cursor: pointer;
                        padding: 0;
                        margin-left: auto;
                        flex: 0 0 auto;
                        transition: color 0.15s, background 0.15s, border-color 0.15s;
                    }
                    .localprompt-library-add-tab:hover { color: #fff; background: #313131; border-color: #4e4e4e; }
                    
                    .localprompt-library-drawer {
                        background: #141414;
                        border-bottom: 0;
                        padding: 10px 10px 16px;
                        display: none;
                        flex: 1;
                        min-height: 0;
                        box-shadow: inset 0 4px 6px rgba(0,0,0,0.3);
                    }
                    .localprompt-library-drawer.active {
                        display: flex;
                        flex-direction: column;
                        animation: slideDown 0.2s ease-out;
                    }
                    @keyframes slideDown { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
                    
                    .localprompt-resize-handle {
                        width: 100%;
                        height: 10px;
                        cursor: ns-resize;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        background: #1a1a1a;
                        transition: background 0.2s;
                        border-bottom: 1px solid #333;
                    }
                    .localprompt-resize-handle:hover { background: #2a2a2a; }
                    .localprompt-resize-handle.hidden { display: none; }

                    .localprompt-library-drawer .localprompt-chip-container {
                        max-height: none;
                        padding-right: 1px;
                        flex: 1;
                        min-height: 0;
                        overflow-y: auto;
                        align-content: flex-start;
                        scrollbar-width: thin;
                        scrollbar-color: #4a4a4a transparent;
                    }
                    .localprompt-drawer-toolbar {
                        flex: 0 0 100%;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        margin-bottom: 10px;
                    }
                    .localprompt-drawer-summary {
                        font-size: 10px;
                        color: #8f8f8f;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                    }
                    .localprompt-section-header {
                        font-size: 10px;
                        font-weight: bold;
                        color: #888;
                        margin-bottom: 6px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .localprompt-chip-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 5px;
                        max-height: 180px;
                        overflow-y: auto;
                        padding-right: 1px;
                        scrollbar-width: thin;
                        scrollbar-color: #4a4a4a transparent;
                    }
                    .localprompt-active-sidebar-content::-webkit-scrollbar,
                    .localprompt-library-drawer .localprompt-chip-container::-webkit-scrollbar,
                    .localprompt-chip-container::-webkit-scrollbar {
                        width: 5px;
                        height: 5px;
                    }
                    .localprompt-active-sidebar-content::-webkit-scrollbar-track,
                    .localprompt-library-drawer .localprompt-chip-container::-webkit-scrollbar-track,
                    .localprompt-chip-container::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .localprompt-active-sidebar-content::-webkit-scrollbar-thumb,
                    .localprompt-library-drawer .localprompt-chip-container::-webkit-scrollbar-thumb,
                    .localprompt-chip-container::-webkit-scrollbar-thumb {
                        background: #4a4a4a;
                        border-radius: 999px;
                    }
                    .localprompt-active-sidebar-content::-webkit-scrollbar-thumb:hover,
                    .localprompt-library-drawer .localprompt-chip-container::-webkit-scrollbar-thumb:hover,
                    .localprompt-chip-container::-webkit-scrollbar-thumb:hover {
                        background: #5a5a5a;
                    }
                    .localprompt-container-wrapper {
                        --localprompt-thumb-height: 132px;
                        --localprompt-thumb-width: 90px;
                        --localprompt-thumb-label-size: 9px;
                        container-type: inline-size;
                    }
                    .localprompt-thumbnail-size-control {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        min-width: 0;
                        flex: 1 1 112px;
                    }
                    .localprompt-thumbnail-size-control input[type="range"] {
                        width: 100%;
                        min-width: 52px;
                        max-width: 90px;
                        accent-color: #8ab4f8;
                        cursor: ew-resize;
                    }
                    .localprompt-thumbnail-size-control span {
                        color: #888;
                        font-size: 10px;
                        line-height: 1;
                    }
                    .localprompt-thumbnail-size-control .size-label {
                        min-width: 30px;
                        color: #aaa;
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.04em;
                    }
                    .localprompt-chip {
                        width: auto;
                        height: auto;
                        padding: 4px 10px;
                        background: #2d2d2d;
                        border: 1px solid #444;
                        border-radius: 12px;
                        font-size: 11px;
                        color: #ddd;
                        cursor: pointer;
                        transition: all 0.15s;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        white-space: nowrap;
                    }
                    .localprompt-chip:hover { background: #3a3a3a; border-color: #666; }
                    .localprompt-chip.selected { background: #1a2a3a; border: 2px solid #4a9eff; box-shadow: 0 0 8px rgba(74, 158, 255, 0.4); }
                    .localprompt-chip.pinned-managed {
                        display: flex;
                        flex-direction: column;
                        align-items: stretch;
                        gap: 8px;
                        min-width: 180px;
                        padding: 10px;
                        border-radius: 14px;
                        white-space: normal;
                    }
                    .localprompt-chip.pinned-managed .managed-card-name {
                        font-size: 11px;
                        color: #f0f0f0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .localprompt-chip.pinned-managed .managed-card-controls {
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .localprompt-chip.pinned-managed .managed-weight-val {
                        min-width: 34px;
                        text-align: center;
                        font-size: 11px;
                        color: #ddd;
                    }
                    .localprompt-chip.pinned-draggable { cursor: grab; }
                    .localprompt-chip.pinned-draggable:active { cursor: grabbing; }
                    .localprompt-chip.pinned-dragging {
                        opacity: 0.45;
                        border-style: dashed;
                    }
                    .localprompt-chip.pinned-drop-target {
                        border-color: #88c0ff;
                        box-shadow: 0 0 0 2px rgba(136, 192, 255, 0.35);
                    }
                    .localprompt-chip.selected::before {
                        content: '+';
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 14px;
                        height: 14px;
                        background: #4a9eff;
                        color: #fff;
                        border-radius: 50%;
                        font-size: 9px;
                        font-weight: bold;
                        flex-shrink: 0;
                    }
                    .localprompt-chip.role-colored {
                        border-color: color-mix(in srgb, var(--role-color, #4c4c4c) 65%, #444);
                        box-shadow: inset 3px 0 0 color-mix(in srgb, var(--role-color, #4c4c4c) 85%, transparent);
                    }
                    .localprompt-chip .usage-count {
                        font-size: 9px;
                        color: #888;
                        background: #222;
                        padding: 1px 4px;
                        border-radius: 8px;
                        margin-left: 4px;
                    }
                    .localprompt-chip-thumb {
                        width: var(--localprompt-thumb-width);
                        height: var(--localprompt-thumb-height);
                        border-radius: 6px;
                        background: #151515;
                        border: 1px solid #444;
                        cursor: pointer;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        position: relative;
                        transition: all 0.15s;
                    }
                    .localprompt-chip-thumb:hover { border-color: #666; }
                    .localprompt-chip-thumb.selected { border-width: 2px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.02); }
                    .localprompt-chip-thumb.pinned-managed {
                        width: var(--localprompt-thumb-width);
                        height: var(--localprompt-thumb-height);
                        border-width: 2px;
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-thumb-media {
                        position: absolute;
                        inset: 0;
                        overflow: hidden;
                    }
                    .localprompt-chip-thumb.pinned-managed.no-thumb {
                        background:
                            radial-gradient(circle at 50% 22%, color-mix(in srgb, var(--role-color, #4a9eff) 26%, transparent), transparent 42%),
                            linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015)),
                            #111820;
                    }
                    .localprompt-chip-thumb.pinned-managed.no-thumb .managed-thumb-media {
                        display: flex;
                        align-items: stretch;
                        justify-content: stretch;
                    }
                    .managed-thumb-placeholder {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                        width: 100%;
                        height: 100%;
                        padding: 32px 10px 52px;
                        box-sizing: border-box;
                        text-align: center;
                        background:
                            linear-gradient(135deg, color-mix(in srgb, var(--role-color, #4a9eff) 18%, transparent), transparent 48%),
                            radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06), transparent 54%);
                    }
                    .managed-placeholder-icon {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 28px;
                        height: 28px;
                        border-radius: 9px;
                        color: color-mix(in srgb, var(--role-color, #9ab8ff) 74%, #ffffff);
                        background: color-mix(in srgb, var(--role-color, #4a9eff) 16%, rgba(255,255,255,0.04));
                        border: 1px solid color-mix(in srgb, var(--role-color, #4a9eff) 44%, rgba(255,255,255,0.12));
                        font-size: 14px;
                        font-weight: 800;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.18);
                    }
                    .managed-placeholder-category {
                        max-width: 100%;
                        padding: 2px 7px;
                        border-radius: 999px;
                        color: color-mix(in srgb, var(--role-color, #9ab8ff) 70%, #ffffff);
                        background: rgba(0,0,0,0.22);
                        border: 1px solid color-mix(in srgb, var(--role-color, #4a9eff) 34%, rgba(255,255,255,0.12));
                        font-size: 9px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .managed-placeholder-name {
                        max-width: 100%;
                        color: #f3f5f6;
                        font-size: var(--localprompt-thumb-label-size);
                        font-weight: 700;
                        line-height: 1.2;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                    }
                    .localprompt-chip-thumb.pinned-managed.no-thumb .thumb-label {
                        display: none;
                    }
                    .localprompt-chip-thumb.pinned-managed .thumb-label {
                        left: 50%;
                        right: auto;
                        bottom: 42px;
                        transform: translateX(-50%);
                        max-width: calc(100% - 20px);
                        z-index: 4;
                        padding: 4px 10px;
                        background: rgba(10, 10, 10, 0.52);
                        border: 1px solid rgba(255,255,255,0.12);
                        border-radius: 10px;
                        backdrop-filter: blur(8px);
                        box-shadow: 0 8px 18px rgba(0,0,0,0.28);
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-card-overlay {
                        position: absolute;
                        left: 8px;
                        right: 8px;
                        bottom: 8px;
                        height: auto;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                        background: transparent;
                        z-index: 4;
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-card-controls {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                    }
                    .localprompt-chip-thumb.pinned-managed .managed-weight-val {
                        min-width: 28px;
                        text-align: center;
                        font-size: 12px;
                        font-weight: 600;
                        color: #f0f0f0;
                        padding: 6px 12px;
                        background: rgba(10, 10, 10, 0.52);
                        border: 1px solid rgba(255,255,255,0.12);
                        border-radius: 12px;
                        backdrop-filter: blur(8px);
                        box-shadow: 0 8px 18px rgba(0,0,0,0.28);
                    }
                    .localprompt-chip-thumb.pinned-managed.selected::after {
                        display: none;
                    }
                    .localprompt-info-btn,
                    .localprompt-favorite-star,
                    .localprompt-gallery-item .favorite-btn,
                    .chip-pin-btn {
                        position: absolute;
                        top: 6px;
                        width: 22px;
                        height: 22px;
                        background: rgba(20, 20, 20, 0.75);
                        color: #e0e0e0;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 4px;
                        font-weight: bold;
                        font-size: 11px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        z-index: 10;
                        backdrop-filter: blur(4px);
                        transition: all 0.15s;
                        line-height: 1;
                        padding: 0;
                    }
                    .localprompt-info-btn:hover,
                    .localprompt-favorite-star:hover,
                    .localprompt-gallery-item .favorite-btn:hover,
                    .chip-pin-btn:hover {
                        background: rgba(40, 40, 40, 0.9);
                        color: #fff;
                        border-color: rgba(255, 255, 255, 0.4);
                        transform: scale(1.05);
                    }
                    .localprompt-info-btn {
                        left: 6px;
                    }
                    .localprompt-favorite-star,
                    .localprompt-gallery-item .favorite-btn,
                    .chip-pin-btn {
                        right: 6px;
                        font-size: 13px; /* Slightly larger for star icon */
                    }
                    .localprompt-favorite-star.favorited,
                    .localprompt-gallery-item .favorite-btn.favorited,
                    .chip-pin-btn.favorited {
                        color: #ffd700;
                        text-shadow: 0 0 8px rgba(255, 215, 0, 0.6);
                        border-color: rgba(255, 215, 0, 0.5);
                        background: rgba(40, 35, 10, 0.85);
                    }
                    .localprompt-chip .localprompt-info-btn,
                    .localprompt-chip .chip-pin-btn {
                        position: static;
                        width: 18px;
                        height: 18px;
                        flex-shrink: 0;
                    }
                    .localprompt-chip .localprompt-info-btn {
                        font-size: 10px;
                        margin-right: 4px;
                    }
                    .localprompt-chip .chip-pin-btn {
                        font-size: 12px;
                        margin-left: auto;
                    }
                    .managed-state-pill {
                        position: absolute;
                        top: 6px;
                        left: 34px;
                        z-index: 5;
                        min-width: 34px;
                        height: 22px;
                        padding: 0 10px;
                        border-radius: 999px;
                        border: 1px solid rgba(255,255,255,0.15);
                        background: rgba(22, 22, 22, 0.88);
                        color: #d8d8d8;
                        font-size: 10px;
                        font-weight: 700;
                        letter-spacing: 0.04em;
                        cursor: pointer;
                        transition: filter 0.15s ease, background 0.15s ease;
                    }
                    .managed-state-pill.on {
                        background: rgba(64, 124, 76, 0.95);
                        color: #fff;
                        border-color: rgba(122, 196, 136, 0.55);
                    }
                    .managed-state-pill.off {
                        background: rgba(48, 48, 48, 0.88);
                        color: #bdbdbd;
                    }
                    .localprompt-chip-thumb.pinned-draggable { cursor: grab; }
                    .localprompt-chip-thumb.pinned-draggable:active { cursor: grabbing; }
                    .localprompt-chip-thumb.pinned-dragging {
                        opacity: 0.45;
                        border-style: dashed;
                    }
                    .localprompt-chip-thumb.pinned-drop-target {
                        border-color: #88c0ff;
                        box-shadow: 0 0 0 2px rgba(136, 192, 255, 0.45);
                    }
                    .localprompt-chip-thumb.selected::after {
                        content: '+';
                        position: absolute;
                        top: 4px;
                        left: 4px;
                        width: 16px;
                        height: 16px;
                        background: #4a9eff;
                        color: #fff;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        font-weight: bold;
                        z-index: 10;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    }
                    .localprompt-chip-thumb.role-colored {
                        border-color: var(--role-color, #4c4c4c);
                        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--role-color, #4c4c4c) 55%, transparent);
                    }
                    .localprompt-chip-thumb.role-colored::before {
                        content: '';
                        position: absolute;
                        inset: 0;
                        border: 1px solid color-mix(in srgb, var(--role-color, #4c4c4c) 65%, transparent);
                        border-radius: inherit;
                        z-index: 3;
                        pointer-events: none;
                    }
                    .localprompt-chip-thumb.role-colored.pinned-managed::before {
                        border-color: color-mix(in srgb, var(--role-color, #4c4c4c) 40%, transparent);
                    }
                    .localprompt-chip-thumb.role-colored.pinned-managed::after {
                        content: '';
                        position: absolute;
                        inset: 0;
                        z-index: 1;
                        pointer-events: none;
                        background: linear-gradient(180deg, color-mix(in srgb, var(--role-color, #4c4c4c) 12%, transparent) 0%, transparent 38%);
                    }
                    .localprompt-role-badge {
                        position: absolute;
                        top: 6px;
                        right: 6px;
                        z-index: 5;
                        max-width: calc(100% - 52px);
                        padding: 2px 8px;
                        border-radius: 999px;
                        background: color-mix(in srgb, var(--role-color, #444) 90%, rgba(17,17,17,0.92));
                        color: #fff;
                        font-size: 9px;
                        font-weight: 700;
                        line-height: 1.4;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
                    }
                    .localprompt-chip-thumb img { width: 100%; height: 100%; object-fit: cover; }
                    .localprompt-chip-thumb .thumb-label {
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: rgba(0,0,0,0.75);
                        font-size: var(--localprompt-thumb-label-size);
                        color: #ddd;
                        padding: 3px 4px;
                        text-align: center;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .localprompt-inline-btn {
                        height: 26px;
                        border-radius: 999px;
                        border: 1px solid rgba(255,255,255,0.2);
                        background: rgba(10, 10, 10, 0.52);
                        color: #f0f0f0;
                        font-size: 14px;
                        padding: 0 10px;
                        cursor: pointer;
                        backdrop-filter: blur(3px);
                        box-shadow: 0 8px 18px rgba(0,0,0,0.28);
                    }
                    .localprompt-inline-btn {
                        min-width: 26px;
                        padding: 0;
                    }
                    .localprompt-chip-thumb.pinned-managed .localprompt-inline-btn {
                        flex: 0 0 26px;
                    }
                    .localprompt-inline-btn:hover {
                        filter: brightness(1.08);
                    }
                    .localprompt-section.pinned-unified-hidden {
                        display: none;
                    }
                    
                    .localprompt-selected-list {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                        align-content: flex-start;
                        padding-bottom: 4px;
                        padding-right: 4px;
                    }
                    .localprompt-selected-item {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 4px 6px;
                        background: #252525;
                        border: 1px solid #444;
                        border-radius: 16px;
                        cursor: grab;
                        user-select: none;
                        transition: all 0.2s;
                        width: auto;
                    }
                    .localprompt-selected-item:active { cursor: grabbing; }
                    .localprompt-selected-item.dragging { opacity: 0.5; background: #333; border-style: dashed; }
                    .localprompt-selected-item .item-name {
                        flex: 0 1 auto;
                        font-size: 11px;
                        color: #ddd;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 200px;
                    }
                    .localprompt-selected-item .item-controls {
                        display: flex;
                        align-items: center;
                        gap: 3px;
                    }
                    .localprompt-selected-item .weight-btn {
                        width: 24px;
                        height: 24px;
                        padding: 0;
                        background: #333;
                        border: 1px solid #555;
                        border-radius: 4px;
                        color: #ddd;
                        cursor: pointer;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.15s;
                    }
                    .localprompt-selected-item .weight-btn:hover { background: #4a4a4a; border-color: #777; }
                    .localprompt-selected-item .weight-btn:active { background: #555; }
                    .localprompt-selected-item .weight-val {
                        font-size: 11px;
                        color: #ccc;
                        min-width: 26px;
                        text-align: center;
                    }
                    .localprompt-selected-item .remove-btn {
                        width: 24px;
                        height: 24px;
                        background: #5a3030;
                        border: 1px solid #7a4040;
                        border-radius: 4px;
                        color: #ddd;
                        cursor: pointer;
                        font-size: 11px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-left: 2px;
                        transition: background 0.15s;
                    }
                    .localprompt-selected-item .remove-btn:hover { background: #8a3a3a; border-color: #aa4a4a; }
                    .localprompt-selected-item .toggle-btn {
                        padding: 4px 8px;
                        font-size: 10px;
                        font-weight: bold;
                        border-radius: 12px;
                        border: none;
                        cursor: pointer;
                        transition: opacity 0.15s;
                    }
                    .localprompt-selected-item .toggle-btn:hover { opacity: 0.8; }
                    .localprompt-selected-item .toggle-btn.on { background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; }
                    .localprompt-selected-item .toggle-btn.off { background: #7c4a4a; color: #fff; border: 1px solid #9c5a5a; }
                    
                    .localprompt-bottom-bar {
                        padding: 8px 10px;
                        background: #252525;
                        border-top: 1px solid #333;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex-wrap: wrap;
                        margin-top: 12px;
                        flex-shrink: 0;
                    }
                    .localprompt-bottom-spacer {
                        flex: 1 1 auto;
                        min-width: 10px;
                    }
                    .localprompt-action-bar {
                        margin-bottom: 0;
                        padding-bottom: 4px;
                    }
                    .localprompt-config-bar {
                        display: flex;
                        flex: 1 1 auto;
                        flex-wrap: wrap;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                        max-width: 100%;
                        margin: 0;
                        border-top: none;
                        padding: 0;
                        background: transparent;
                    }
                    .localprompt-config-bar.collapsed {
                        display: none;
                    }
                    .localprompt-wildcard-row {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        flex: 0 1 auto;
                        min-width: 0;
                        margin-left: 0 !important;
                    }
                    .localprompt-size-row {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        gap: 8px;
                        flex: 1 1 260px;
                        min-width: 0;
                    }
                    @container (max-width: 430px) {
                        .localprompt-size-row {
                            flex-basis: 100%;
                        }
                    }
                    .localprompt-bottom-bar .seed-group {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-left: 0 !important;
                    }
                    .localprompt-bottom-bar .comfyui-seed-style {
                        display: flex;
                        align-items: center;
                        background: #252525;
                        border: 1px solid #454545;
                        border-radius: 12px;
                        height: 22px;
                        font-family: Arial, sans-serif;
                        overflow: hidden;
                    }
                    .localprompt-bottom-bar .seed-btn {
                        background: transparent;
                        border: none;
                        color: #aaa;
                        font-size: 10px;
                        cursor: pointer;
                        padding: 0 8px;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background-color 0.15s, color 0.15s;
                    }
                    .localprompt-bottom-bar .seed-btn:hover {
                        background: #333;
                        color: #fff;
                    }
                    .localprompt-bottom-bar .seed-label {
                        color: #aaa;
                        font-size: 11px;
                        padding: 0 2px 0 6px;
                    }
                    .localprompt-bottom-bar .seed-input {
                        width: 60px;
                        background: transparent;
                        border: none;
                        color: #fff;
                        font-family: inherit;
                        font-size: 11px;
                        text-align: right;
                        outline: none;
                        -moz-appearance: textfield;
                        padding-right: 6px;
                    }
                    .localprompt-bottom-bar .seed-input::-webkit-inner-spin-button,
                    .localprompt-bottom-bar .seed-input::-webkit-outer-spin-button {
                        -webkit-appearance: none;
                        margin: 0;
                    }
                    .localprompt-wildcard-rng-control {
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        color: #aeb6bd;
                        font-size: 11px;
                        white-space: nowrap;
                    }
                    .localprompt-wildcard-rng-control select {
                        min-height: 24px;
                        padding: 4px 7px;
                        background: #1a1a1a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        color: #ddd;
                        font-size: 11px;
                    }
                    .localprompt-wildcard-rng-control select option {
                        background: #11171d;
                        color: #e8ecef;
                    }
                    .localprompt-wildcard-shuffle-btn {
                        min-height: 24px;
                        padding: 4px 9px;
                        white-space: nowrap;
                    }

                    .localprompt-empty-state {
                        padding: 20px;
                        text-align: center;
                        color: #666;
                        font-size: 11px;
                    }
                    
                    .localprompt-hover-preview {
                        position: fixed;
                        background: #2a2a2a;
                        border: 2px solid #4a9eff;
                        border-radius: 8px;
                        padding: 0;
                        z-index: 20000;
                        max-width: 280px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.8);
                        pointer-events: none;
                        display: block;
                        opacity: 0;
                        visibility: hidden;
                        transform: translateY(6px);
                        transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s ease;
                        overflow: hidden;
                    }
                    .localprompt-hover-preview.active {
                        opacity: 1;
                        visibility: visible;
                        transform: translateY(0);
                    }
                    .localprompt-hover-preview img, .localprompt-hover-preview video { 
                        width: 100%; 
                        max-height: 380px;
                        object-fit: cover;
                        display: block; 
                        background: #111;
                        opacity: 1;
                    }
                    .localprompt-hover-preview .preview-meta {
                        padding: 10px 12px 12px;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        background: rgba(16,16,16,0.98);
                    }
                    .localprompt-hover-preview .preview-name { font-size: 13px; font-weight: 700; color: #ececec; }
                    .localprompt-hover-preview .preview-pill-row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
                    }
                    .localprompt-hover-preview .preview-pill {
                        display: inline-flex;
                        align-items: center;
                        padding: 4px 8px;
                        border-radius: 999px;
                        background: rgba(34,34,34,0.95);
                        color: #ddd;
                        font-size: 10px;
                        border: 1px solid rgba(255,255,255,0.12);
                    }
                    .localprompt-hover-preview .preview-pill.category-pill {
                        background: color-mix(in srgb, var(--role-color, #3f69a8) 80%, rgba(18,18,18,0.95));
                        color: #fff;
                    }
                    .localprompt-hover-preview .preview-text {
                        font-size: 10px;
                        color: #aaa;
                        background: #1a1a1a;
                        padding: 8px;
                        border-radius: 6px;
                        max-height: 100px;
                        overflow-y: auto;
                        line-height: 1.5;
                    }
                    
                    /* Modal styles */
                    .localprompt-modal-overlay {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0,0,0,0.75);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                    }
                    .localprompt-modal {
                        background: #2a2a2a;
                        border: 1px solid #555;
                        border-radius: 8px;
                        width: 700px;
                        max-width: 90vw;
                        max-height: 80vh;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    }
                    .localprompt-modal-header {
                        padding: 12px 16px;
                        background: #333;
                        border-bottom: 1px solid #444;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        border-radius: 8px 8px 0 0;
                    }
                    .localprompt-modal-header h3 { margin: 0; font-size: 14px; color: #ddd; }
                    .localprompt-modal-close {
                        background: none;
                        border: none;
                        color: #888;
                        font-size: 18px;
                        cursor: pointer;
                    }
                    .localprompt-modal-close:hover { color: #ddd; }
                    .localprompt-modal-content {
                        flex: 1;
                        overflow-y: auto;
                        padding: 16px;
                    }
                    
                    /* Gallery grid for modal */
                    .localprompt-gallery-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
                        gap: 12px;
                    }
                    .localprompt-browse-toolbar {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        gap: 10px;
                        position: sticky;
                        top: 0;
                        z-index: 40;
                        margin-bottom: 10px;
                        padding: 8px;
                        background: rgb(17, 23, 29);
                        border: 1px solid rgba(255,255,255,0.08);
                        border-radius: 9px;
                        box-shadow: 0 10px 22px rgba(0,0,0,0.24);
                        transition: transform 0.16s ease, opacity 0.16s ease;
                        max-height: 112px;
                        overflow: hidden;
                    }
                    .localprompt-browse-toolbar.toolbar-hidden {
                        transform: translateY(-8px);
                        opacity: 0;
                        pointer-events: none;
                    }
                    .localprompt-browse-toolbar input {
                        flex: 1 1 180px;
                    }
                    .localprompt-browse-toolbar select {
                        flex: 1 1 150px;
                    }
                    .localprompt-browse-page {
                        position: relative;
                    }
                    .localprompt-browse-page .localprompt-workspace-body,
                    .localprompt-browse-page .localprompt-modal-content {
                        padding-bottom: 56px;
                    }
                    .localprompt-browse-footer.localprompt-workspace-footer,
                    .localprompt-browse-footer {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 40;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 8px 12px;
                        background: transparent;
                        border-top: 0;
                        pointer-events: none;
                    }
                    .localprompt-browse-pagination-pill {
                        position: relative;
                        z-index: 1;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        max-width: calc(100% - 24px);
                        padding: 5px 8px;
                        border: 1px solid rgba(255,255,255,0.12);
                        border-radius: 999px;
                        background: rgb(16, 20, 24);
                        box-shadow: 0 10px 28px rgba(0,0,0,0.32);
                        overflow: hidden;
                        pointer-events: auto;
                    }
                    .localprompt-browse-pagination-pill .localprompt-btn {
                        min-height: 24px;
                        padding: 4px 10px;
                        border-radius: 999px;
                        font-size: 11px;
                    }
                    .localprompt-browse-page-info {
                        min-width: 68px;
                        padding: 0 4px;
                        color: #aab1b8;
                        font-size: 11px;
                        text-align: center;
                        white-space: nowrap;
                    }
                    .localprompt-gallery-item {
                        background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02));
                        border: 1px solid rgba(255,255,255,0.13);
                        border-radius: 10px;
                        overflow: hidden;
                        cursor: pointer;
                        transition: all 0.15s;
                        box-shadow: 0 10px 22px rgba(0,0,0,0.14);
                    }
                    .localprompt-gallery-item:hover { border-color: rgba(255,255,255,0.24); transform: translateY(-2px); }
                    .localprompt-gallery-item.selected { 
                        border-color: #4a9eff; 
                        box-shadow: 0 0 10px rgba(74, 158, 255, 0.4); 
                        position: relative;
                    }
                    .localprompt-gallery-item.selected::after {
                        content: '+';
                        position: absolute;
                        top: 4px;
                        left: 4px;
                        width: 16px;
                        height: 16px;
                        background: #4a9eff;
                        color: #fff;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 10px;
                        font-weight: bold;
                        z-index: 10;
                    }
                    .localprompt-gallery-item .item-preview {
                        height: 116px;
                        background: radial-gradient(circle at 50% 40%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 42%, transparent 70%), #101720;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .localprompt-gallery-item .item-preview img { width: 100%; height: 100%; object-fit: cover; }
                    .localprompt-gallery-item .item-preview.no-img { font-size: 10px; color: #5f6975; }
                    .localprompt-gallery-item .item-info { padding: 9px 10px 10px; }
                    .localprompt-gallery-item .item-name { font-size: 12px; color: #f0f2f3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .localprompt-bulk-toolbar {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        flex-wrap: wrap;
                        margin-top: 10px;
                        padding: 8px 10px;
                        background: #1b1b1b;
                        border: 1px solid #343434;
                        border-radius: 8px;
                    }
                    .localprompt-bulk-summary {
                        font-size: 11px;
                        color: #b9b9b9;
                        margin-right: auto;
                    }
                    .localprompt-gallery-item.manage-mode {
                        cursor: pointer;
                    }
                    .localprompt-gallery-item.manage-mode::before {
                        content: '';
                        position: absolute;
                        inset: 0;
                        border: 1px solid rgba(255,255,255,0.04);
                        pointer-events: none;
                    }
                </style>
                <div class="localprompt-container" style="height: 100%;">
                    <div class="localprompt-workspace">
                        <div class="localprompt-top-row">
                            <div class="localprompt-toolbar">
                                <div class="localprompt-toolbar-group">
                                    <button class="localprompt-toolbar-button localprompt-icon-btn" id="${uniqueId}-active-toggle" type="button" title="Toggle active prompts" aria-label="Toggle active prompts">
                                        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><path d="M3 6h.01"></path><path d="M3 12h.01"></path><path d="M3 18h.01"></path></svg>
                                    </button>
                                    <button class="localprompt-toolbar-button localprompt-icon-btn" id="${uniqueId}-meta-tags-btn" type="button" title="Meta Tags / Hidden Prompts" aria-label="Meta Tags / Hidden Prompts">
                                        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><path d="M7 7h.01"></path></svg>
                                    </button>
                                    <div class="localprompt-dropdown-panel localprompt-meta-panel" id="${uniqueId}-meta-tags-panel">
                                        <div class="localprompt-meta-header">
                                            <div class="localprompt-dropdown-note">Hidden prompts are injected into final output but do not appear in Active Prompts.</div>
                                            <div class="localprompt-meta-save-status" id="${uniqueId}-meta-save-status" aria-live="polite"></div>
                                        </div>
                                        <div class="localprompt-meta-list" id="${uniqueId}-meta-tags-list"></div>
                                        <div class="localprompt-dropdown-divider"></div>
                                        <button class="localprompt-btn" id="${uniqueId}-add-meta-tag-btn" type="button" style="width: 100%; padding: 7px 10px; border-color: #4f8658; background: #28402c;">+ Add Hidden Prompt</button>
                                    </div>
                                </div>
                                <div class="localprompt-pinned-categories" id="${uniqueId}-pinned-categories">
                                    <div class="localprompt-pinned-category-strip" id="${uniqueId}-pinned-category-strip"></div>
                                    <div class="localprompt-more-category-group" id="${uniqueId}-more-category-group">
                                        <button class="localprompt-category-grid-button" id="${uniqueId}-categories-menu-btn" type="button" title="All categories" aria-label="All categories">
                                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="5" rx="1"></rect><rect x="9.5" y="3" width="5" height="5" rx="1"></rect><rect x="16" y="3" width="5" height="5" rx="1"></rect><rect x="3" y="9.5" width="5" height="5" rx="1"></rect><rect x="9.5" y="9.5" width="5" height="5" rx="1"></rect><rect x="16" y="9.5" width="5" height="5" rx="1"></rect><rect x="3" y="16" width="5" height="5" rx="1"></rect><rect x="9.5" y="16" width="5" height="5" rx="1"></rect><rect x="16" y="16" width="5" height="5" rx="1"></rect></svg>
                                        </button>
                                        <div class="localprompt-dropdown-panel" id="${uniqueId}-categories-panel">
                                            <div class="localprompt-category-sort-row">
                                                <label for="${uniqueId}-main-sort-select">Sort cards by</label>
                                                <select class="localprompt-sort-select" id="${uniqueId}-main-sort-select" title="Sort cards">
                                                    <option value="manual">Manual / stored order</option>
                                                    <option value="newest">Newest first</option>
                                                    <option value="oldest">Oldest first</option>
                                                    <option value="az">A to Z</option>
                                                    <option value="za">Z to A</option>
                                                </select>
                                            </div>
                                            <div class="localprompt-library-bar-container">
                                                <div class="localprompt-library-tab-strip">
                                                    <div class="localprompt-library-tabs-scroll" id="${uniqueId}-library-tabs"></div>
                                                    <button class="localprompt-library-add-tab" id="${uniqueId}-add-tab-btn" title="Add Category Tab">+</button>
                                            </div>
                                        </div>
                                        <div class="localprompt-dropdown-divider"></div>
                                            <div class="localprompt-category-popover-footer">
                                                <button class="localprompt-category-manage-icon" id="${uniqueId}-manage-categories-btn" type="button" title="Manage categories" aria-label="Manage categories">&#9881;</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <select id="${uniqueId}-category-select" style="display: none;"><option value="">All Categories</option></select>
                            </div>
                        </div>
                        <div class="localprompt-body-shell">
                            <aside class="localprompt-active-sidebar" id="${uniqueId}-active-sidebar">
                                <div class="localprompt-active-sidebar-header">
                                    <div class="localprompt-active-sidebar-title">
                                        <span>Active</span>
                                        <span id="${uniqueId}-active-count">0 selected</span>
                                    </div>
                                    <button class="localprompt-btn localprompt-clear-btn" id="${uniqueId}-active-clear-btn" style="padding: 2px 6px; font-size: 9px; background: #4a2a2a; border-color: #6a3a3a;">Clear All</button>
                                </div>
                                <div class="localprompt-active-sidebar-content">
                                    <div class="localprompt-chip-container" id="${uniqueId}-active-chips"></div>
                                </div>
                            </aside>
                            <div class="localprompt-active-splitter" id="${uniqueId}-active-splitter" title="Drag to resize active panel">
                                <div class="localprompt-active-splitter-bar"></div>
                            </div>
                            <div class="localprompt-library-pane">
                                <div class="localprompt-workspace-host" id="${uniqueId}-workspace-host"></div>
                                <div class="localprompt-library-drawer" id="${uniqueId}-library-drawer">
                                    <div class="localprompt-chip-container" id="${uniqueId}-library-chips"></div>
                                </div>
                                <div class="localprompt-resize-handle hidden" data-target="${uniqueId}-library-drawer" id="${uniqueId}-resize">
                                    <div style="width: 20px; height: 3px; background: #666; border-radius: 2px;"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- SELECTED PROMPTS SECTION -->
                    <div class="localprompt-section pinned-unified-hidden" id="${uniqueId}-selected-section" style="display: none !important; flex: 0 0 auto; height: 0; min-height: 0; padding: 0; overflow: hidden; border: 0;">
                        <div class="localprompt-section-header" style="display: flex; justify-content: space-between; align-items: center;">
                            <span>Selected (<span id="${uniqueId}-selected-count">0</span>)</span>
                            <button class="localprompt-btn localprompt-clear-btn" id="${uniqueId}-clear-btn" style="padding: 2px 6px; font-size: 9px; background: #4a2a2a; border-color: #6a3a3a;" title="Clear all selected prompts">Clear All</button>
                        </div>
                        <div id="${uniqueId}-selected-list" class="localprompt-selected-list"></div>
                    </div>

                    <!-- BOTTOM BAR -->
                    <div class="localprompt-bottom-bar localprompt-action-bar">
                        <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-library-btn" title="Library" aria-label="Library">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                        </button>
                        <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-from-last-output-btn" title="From Last Output" aria-label="From Last Output">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
                        </button>
                        <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-import-btn" title="Import" aria-label="Import">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
                        </button>
                        <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-settings-btn" title="Settings" aria-label="Settings">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7"></path><path d="M4 10V3"></path><path d="M12 21v-9"></path><path d="M12 8V3"></path><path d="M20 21v-5"></path><path d="M20 12V3"></path><path d="M2 14h4"></path><path d="M10 8h4"></path><path d="M18 16h4"></path></svg>
                        </button>
                        <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-size-toggle-btn" title="Thumbnail Size" aria-label="Thumbnail Size">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10"></path><path d="M18 7h2"></path><path d="M4 17h2"></path><path d="M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle></svg>
                        </button>
                        <button class="localprompt-btn localprompt-icon-btn localprompt-wildcard-toggle" id="${uniqueId}-wildcard-toggle-btn" title="Wildcard Mode" aria-label="Wildcard Mode">
                            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"></path><path d="M8 8h.01"></path><path d="M16 8h.01"></path><path d="M8 16h.01"></path><path d="M16 16h.01"></path><path d="M12 12h.01"></path></svg>
                        </button>
                        <div class="localprompt-config-bar collapsed" id="${uniqueId}-config-bar">
                            <div class="localprompt-size-row" id="${uniqueId}-size-controls" style="display: none;">
                                <label class="localprompt-thumbnail-size-control" title="Library thumbnail size">
                                    <span class="size-label">Cards</span>
                                    <span>-</span>
                                    <input id="${uniqueId}-thumbnail-size-slider" type="range" min="${UnifiedPromptGalleryNode.THUMBNAIL_SIZE_MIN}" max="${UnifiedPromptGalleryNode.THUMBNAIL_SIZE_MAX}" step="1">
                                    <span>+</span>
                                </label>
                                <label class="localprompt-thumbnail-size-control" title="Active prompt thumbnail size">
                                    <span class="size-label">Active</span>
                                    <span>-</span>
                                    <input id="${uniqueId}-active-thumbnail-size-slider" type="range" min="${UnifiedPromptGalleryNode.THUMBNAIL_SIZE_MIN}" max="${UnifiedPromptGalleryNode.THUMBNAIL_SIZE_MAX}" step="1">
                                    <span>+</span>
                                </label>
                            </div>
                            <div class="seed-group localprompt-wildcard-row" id="${uniqueId}-wildcard-controls" style="display: none;">
                                <button class="localprompt-btn localprompt-icon-btn" id="${uniqueId}-wildcards-btn" title="Wildcard Categories" aria-label="Wildcard Categories">
                                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 8 4-8 4-8-4 8-4z"></path><path d="m4 12 8 4 8-4"></path><path d="m4 18 8 4 8-4"></path></svg>
                                </button>
                                <div class="comfyui-seed-style">
                                    <button id="${uniqueId}-seed-dec" class="seed-btn">&lt;</button>
                                    <span class="seed-label">seed</span>
                                    <input type="number" id="${uniqueId}-seed-input" class="seed-input" value="0">
                                    <button id="${uniqueId}-seed-inc" class="seed-btn">&gt;</button>
                                </div>
                                <select id="${uniqueId}-control-select" style="padding: 4px; background: #1a1a1a; border: 1px solid #444; color: #ddd; border-radius: 4px; font-size: 11px; margin-left: 4px;">
                                    <option value="fixed">fixed</option>
                                    <option value="increment">increment</option>
                                    <option value="decrement">decrement</option>
                                    <option value="randomize">randomize</option>
                                </select>
                                <label class="localprompt-wildcard-rng-control" title="Wildcard RNG mode">
                                    <span>RNG</span>
                                    <select id="${uniqueId}-wildcard-rng-select">
                                        <option value="seed_stable">Seed-stable</option>
                                        <option value="shuffle">Shuffle on click</option>
                                        <option value="fresh">Fresh every run</option>
                                    </select>
                                </label>
                                <button class="localprompt-btn localprompt-wildcard-shuffle-btn" id="${uniqueId}-wildcard-shuffle-btn" type="button" title="Shuffle wildcard picks">Shuffle Wildcards</button>
                            </div>
                        </div>
                        <div class="localprompt-bottom-spacer"></div>
                        <div class="localprompt-utility-bar">
                            <div class="localprompt-utility-buttons" id="${uniqueId}-utility-tabs"></div>
                        </div>
                    </div>
                </div>
            `;

            // Create hover preview outside the node container so it's not bounded
            const hoverPreview = document.createElement('div');
            hoverPreview.id = `${uniqueId}-hover-preview`;
            hoverPreview.className = 'localprompt-hover-preview';
            document.body.appendChild(hoverPreview);
            let toolbarOutsideClickHandler = null;

            // Clean up on node removal
            const originalOnRemoved = this.onRemoved;
            this.onRemoved = function () {
                const preview = document.getElementById(`${uniqueId}-hover-preview`);
                if (preview) preview.remove();
                if (toolbarOutsideClickHandler) {
                    document.removeEventListener("click", toolbarOutsideClickHandler);
                    toolbarOutsideClickHandler = null;
                }
                if (originalOnRemoved) originalOnRemoved.call(this);
            };

            function saveSelectionData(options = {}) {
                const data = writeSelectionArray(node_instance.promptData);
                node_instance.properties["prompt_selection_data"] = data;
                selectionWidget.value = data;
                node_instance.setDirtyCanvas?.(true, options.redrawCanvas !== false);
                if (app.graph) app.graph.change();
            }

            function normalizeMetaTags(rawTags) {
                const tags = Array.isArray(rawTags) ? rawTags : [];
                return tags.map((tag, index) => ({
                    id: String(tag?.id || `meta-${Date.now()}-${index}`),
                    name: String(tag?.name ?? ""),
                    prompt_text: String(tag?.prompt_text || tag?.prompt || ""),
                    enabled: tag?.enabled === true,
                    order: Number.isFinite(Number(tag?.order ?? tag?.index))
                        ? Number(tag?.order ?? tag?.index)
                        : index,
                })).sort((a, b) => (a.order - b.order) || String(a.id).localeCompare(String(b.id)));
            }

            let metaSaveStatusTimer = null;
            function setMetaSaveStatus(text, statusClass = "") {
                const statusEl = widgetContainer.querySelector(`#${uniqueId}-meta-save-status`);
                if (!statusEl) return;
                statusEl.textContent = text;
                statusEl.classList.remove("saving", "saved");
                if (statusClass) statusEl.classList.add(statusClass);
            }

            function showMetaSaveFeedback() {
                setMetaSaveStatus("Saving...", "saving");
                if (metaSaveStatusTimer) {
                    clearTimeout(metaSaveStatusTimer);
                }
                metaSaveStatusTimer = setTimeout(() => {
                    setMetaSaveStatus("Saved", "saved");
                    metaSaveStatusTimer = null;
                }, 220);
            }

            function saveMetaTags(options = {}) {
                if (!options.skipStatus) {
                    showMetaSaveFeedback();
                }
                node_instance.metaTags = normalizeMetaTags(node_instance.metaTags).map((tag, index) => ({
                    ...tag,
                    order: index,
                }));
                const data = writeSelectionArray(node_instance.metaTags);
                node_instance.properties["prompt_meta_tags"] = data;
                metaTagsWidget.value = data;
                if (!options.skipRender) {
                    renderMetaTags();
                } else {
                    updateMetaTagsButtonState();
                }
                node_instance.setDirtyCanvas?.(true, options.redrawCanvas !== false);
                if (app.graph) app.graph.change();
            }

            function updateMetaTagsButtonState() {
                const btn = widgetContainer.querySelector(`#${uniqueId}-meta-tags-btn`);
                const enabledCount = node_instance.metaTags.filter(tag => tag.enabled && tag.prompt_text.trim()).length;
                if (btn) {
                    btn.classList.toggle("has-enabled", enabledCount > 0);
                    btn.title = enabledCount > 0
                        ? `${enabledCount} hidden prompt${enabledCount === 1 ? "" : "s"} enabled`
                        : "Meta Tags";
                }
            }

            function renderMetaTags() {
                const list = widgetContainer.querySelector(`#${uniqueId}-meta-tags-list`);
                if (!list) return;
                updateMetaTagsButtonState();
                list.innerHTML = "";

                if (!node_instance.metaTags.length) {
                    const empty = document.createElement("div");
                    empty.className = "localprompt-meta-empty";
                    empty.textContent = "No hidden prompts yet.";
                    list.appendChild(empty);
                    return;
                }

                node_instance.metaTags.forEach((tag, index) => {
                    const row = document.createElement("div");
                    row.className = "localprompt-meta-row";
                    row.dataset.metaId = tag.id;
                    row.innerHTML = `
                        <button class="localprompt-meta-toggle ${tag.enabled ? "on" : "off"}" type="button" title="Toggle hidden prompt">${tag.enabled ? "ON" : "OFF"}</button>
                        <input class="localprompt-meta-name" type="text" value="${escapeHtml(tag.name)}" placeholder="Label" title="Optional label">
                        <textarea class="localprompt-meta-text" rows="1" placeholder="Hidden prompt" title="Hidden prompt text">${escapeHtml(tag.prompt_text)}</textarea>
                        <button class="localprompt-btn localprompt-meta-action localprompt-clear-btn" data-meta-action="delete" title="Delete hidden prompt" style="background: #4a2a2a; border-color: #6a3a3a;">x</button>
                    `;

                    const toggleBtn = row.querySelector(".localprompt-meta-toggle");
                    const promptTextArea = row.querySelector(".localprompt-meta-text");
                    const autoGrowPromptText = () => {
                        if (!promptTextArea) return;
                        promptTextArea.style.height = "24px";
                        promptTextArea.style.height = `${Math.min(promptTextArea.scrollHeight, 110)}px`;
                    };
                    autoGrowPromptText();

                    toggleBtn?.addEventListener("click", () => {
                        node_instance.metaTags[index].enabled = !node_instance.metaTags[index].enabled;
                        const isEnabled = node_instance.metaTags[index].enabled;
                        toggleBtn.textContent = isEnabled ? "ON" : "OFF";
                        toggleBtn.classList.toggle("on", isEnabled);
                        toggleBtn.classList.toggle("off", !isEnabled);
                        saveMetaTags({ redrawCanvas: false, skipRender: true });
                    });
                    row.querySelector(".localprompt-meta-name")?.addEventListener("input", (event) => {
                        node_instance.metaTags[index].name = event.target.value;
                        saveMetaTags({ redrawCanvas: false, skipRender: true });
                    });
                    promptTextArea?.addEventListener("input", (event) => {
                        node_instance.metaTags[index].prompt_text = event.target.value;
                        autoGrowPromptText();
                        saveMetaTags({ redrawCanvas: false, skipRender: true });
                    });
                    row.querySelector('[data-meta-action="delete"]')?.addEventListener("click", () => {
                        if (!confirm(`Delete hidden prompt "${tag.name || "Untitled"}"?`)) return;
                        node_instance.metaTags.splice(index, 1);
                        saveMetaTags();
                    });

                    list.appendChild(row);
                });
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
            }

            function setupToolbarDropdown(buttonId, panelId, onOpen = null) {
                const button = widgetContainer.querySelector(`#${buttonId}`);
                const panel = widgetContainer.querySelector(`#${panelId}`);
                if (!button || !panel) return;
                button.setAttribute("aria-controls", panelId);
                button.addEventListener("click", async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const willOpen = !panel.classList.contains("open");
                    if (willOpen && workspaceMode !== "gallery") {
                        returnToGallery();
                    }
                    closeToolbarPanels(panel);
                    panel.classList.toggle("open", willOpen);
                    button.classList.toggle("active", willOpen);
                    if (willOpen && typeof onOpen === "function") {
                        await onOpen();
                    }
                });
                panel.addEventListener("click", event => event.stopPropagation());
            }

            async function openCategoryFromMenu(category) {
                if (workspaceMode !== "gallery") {
                    setWorkspaceMode("gallery");
                }
                const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
                const resizeHandle = widgetContainer.querySelector(`#${uniqueId}-resize`);
                const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);
                if (activeLibraryTab === category) {
                    if (categorySelect) categorySelect.value = "";
                    activeLibraryTab = null;
                    clearLibraryNavActiveState();
                    drawer?.classList.remove("active");
                    resizeHandle?.classList.add("hidden");
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
                resizeHandle?.classList.remove("hidden");
                await renderLibraryDrawer(category);
                syncSelectedSectionVisibility();
                await renderPinnedCategoryStrip();
                await renderCategoryDropdownOptions();
                closeToolbarPanels();
            }

            async function renderPinnedCategoryStrip() {
                const strip = widgetContainer.querySelector(`#${uniqueId}-pinned-category-strip`);
                const moreGroup = widgetContainer.querySelector(`#${uniqueId}-more-category-group`);
                const moreBtn = widgetContainer.querySelector(`#${uniqueId}-categories-menu-btn`);
                if (!strip) return;

                const allCategories = await UnifiedPromptGalleryNode.getCategories();
                const pinnedCategories = await ensurePinnedCategoriesInitialized(allCategories);
                const visiblePinnedCategories = pinnedCategories.slice(0, getVisiblePinnedCategoryCount());
                const visibleSet = new Set(visiblePinnedCategories);
                const hiddenCategories = getCategoriesInCurrentOrder(allCategories).filter(category => !visibleSet.has(category));
                strip.innerHTML = "";

                visiblePinnedCategories.forEach(category => {
                    const pill = document.createElement("button");
                    pill.type = "button";
                    pill.className = `localprompt-pinned-category-pill${activeLibraryTab === category ? " active" : ""}`;
                    pill.textContent = category;
                    pill.title = category;
                    applyLibraryTabRoleStyling(pill, category, activeLibraryTab === category);
                    pill.addEventListener("click", () => openCategoryFromMenu(category));
                    strip.appendChild(pill);
                });

                if (moreGroup) {
                    moreGroup.classList.toggle("hidden", hiddenCategories.length === 0);
                }
                if (moreBtn) {
                    moreBtn.title = "All categories";
                    moreBtn.setAttribute("aria-label", "All categories");
                }
            }

            async function renderCategoryDropdownOptions() {
                const list = widgetContainer.querySelector(`#${uniqueId}-library-tabs`);
                bindMainSortSelect();
                if (!list) return;
                const categories = await UnifiedPromptGalleryNode.getCategories();
                const active = activeLibraryTab;
                const pinnedCategories = await ensurePinnedCategoriesInitialized(categories);
                const visiblePinned = new Set(pinnedCategories.slice(0, getVisiblePinnedCategoryCount()));
                const hiddenCategories = getCategoriesInCurrentOrder(categories).filter(category => !visiblePinned.has(category));
                const paletteCategories = hiddenCategories.length ? hiddenCategories : categories;
                list.innerHTML = "";
                if (!paletteCategories.length) {
                    const empty = document.createElement("div");
                    empty.className = "localprompt-meta-empty";
                    empty.textContent = categories.length ? "All categories are visible." : "No categories found.";
                    list.appendChild(empty);
                    return;
                }
                paletteCategories.forEach(category => {
                    const option = document.createElement("button");
                    option.className = `localprompt-library-tab${active === category ? " active" : ""}`;
                    option.type = "button";
                    option.textContent = category;
                    option.title = category;
                    applyLibraryTabRoleStyling(option, category, active === category);
                    option.addEventListener("click", () => openCategoryFromMenu(category));
                    list.appendChild(option);
                });
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
                const resizeHandle = widgetContainer.querySelector(`#${uniqueId}-resize`);
                if (resizeHandle) resizeHandle.classList.add('hidden');
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

                const weight = selectedEntry.weight || 1.0;
                const isOn = selectedEntry.on !== false;
                widgetContainer.querySelectorAll('.pinned-managed').forEach(chip => {
                    if (String(chip.dataset.promptId || '') !== String(promptId)) return;

                    chip.querySelectorAll('.managed-weight-val').forEach(label => {
                        label.textContent = weight.toFixed(1);
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
                    if (activeLibraryTab) renderLibraryDrawer(activeLibraryTab);
                }
                return true;
            }

            // Setup resize handles for sections
            function setupResizeHandles() {
                const handles = widgetContainer.querySelectorAll('.localprompt-resize-handle');
                
                handles.forEach(handle => {
                    let startY = 0;
                    let startHeight = 0;
                    let targetSection = null;
                    
                    const onMouseMove = (e) => {
                        if (!targetSection) return;
                        const deltaY = e.clientY - startY;
                        const newHeight = Math.max(40, startHeight + deltaY);
                        targetSection.style.height = `${newHeight}px`;
                        targetSection.style.maxHeight = `${newHeight}px`;
                    };
                    
                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';
                    };
                    
                    handle.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const targetId = handle.getAttribute('data-target');
                        targetSection = widgetContainer.querySelector(`#${targetId}`);
                        if (!targetSection) return;
                        
                        startY = e.clientY;
                        startHeight = targetSection.offsetHeight;
                        
                        document.body.style.cursor = 'ns-resize';
                        document.body.style.userSelect = 'none';
                        
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    });
                });
            }
            
            // Initialize resize handles
            setupResizeHandles();
            setupActiveSidebarResize();

            function getThumbnailSizePx() {
                return resolveThumbnailSizePx(node_instance.uiPrefs, {
                    legacyPresets: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_LEGACY_PRESETS,
                    defaultSize: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_DEFAULT,
                    minSize: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_MIN,
                    maxSize: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_MAX,
                });
            }

            function getActiveThumbnailSizePx() {
                return resolveActiveThumbnailSizePx(node_instance.uiPrefs, getThumbnailSizePx(), {
                    minSize: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_MIN,
                    maxSize: UnifiedPromptGalleryNode.THUMBNAIL_SIZE_MAX,
                });
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
                if (cardSlider) cardSlider.value = String(getThumbnailSizePx());
                if (activeSlider) activeSlider.value = String(getActiveThumbnailSizePx());
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
                if (cardSlider) {
                    cardSlider.value = String(getThumbnailSizePx());
                    cardSlider.addEventListener('input', () => {
                        applyThumbnailSizePreference(Number(cardSlider.value));
                        queueThumbnailSizeSave();
                    });
                }
                if (activeSlider) {
                    activeSlider.value = String(getActiveThumbnailSizePx());
                    activeSlider.addEventListener('input', () => {
                        applyActiveThumbnailSizePreference(Number(activeSlider.value));
                        queueThumbnailSizeSave();
                    });
                }
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
                if (soften) {
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
                if (!roleColor) return;
                tabBtn.style.borderColor = roleColor;
                tabBtn.style.color = isActive ? '#fff' : roleColor;
                tabBtn.style.boxShadow = isActive
                    ? `0 0 10px ${hexToRgba(roleColor, 0.26)}`
                    : `inset 0 0 0 1px ${hexToRgba(roleColor, 0.18)}`;
                tabBtn.style.background = isActive
                    ? `linear-gradient(180deg, ${hexToRgba(roleColor, 0.34)} 0%, ${hexToRgba(roleColor, 0.2)} 100%)`
                    : hexToRgba(roleColor, 0.08);
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
                const allCategories = await UnifiedPromptGalleryNode.getCategories();
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
                    .querySelectorAll(`#${uniqueId}-library-tabs .localprompt-library-tab, #${uniqueId}-utility-tabs .localprompt-library-tab`)
                    .forEach(button => button.classList.remove('active'));
            }

            function isActiveSidebarOpen() {
                return isPromptActiveSidebarOpen({ nodeInstance: node_instance });
            }

            function applyActiveSidebarPreference() {
                applyPromptActiveSidebarPreference({
                    widgetContainer,
                    uniqueId,
                    nodeInstance: node_instance,
                    activeSidebarWidthWidget,
                });
            }

            async function setActiveSidebarOpen(nextOpen) {
                node_instance.uiPrefs.active_sidebar_open = !!nextOpen;
                applyActiveSidebarPreference();
                await saveUiPrefs();
                if (nextOpen) {
                    await renderActiveSidebar();
                }
            }

            async function saveUiPrefs() {
                node_instance.uiPrefs.library_tabs = getLibraryTabs();
                await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs);
            }

            const PROMPT_SORT_MODES = new Set(["manual", "newest", "oldest", "az", "za"]);
            function getPromptSortMode() {
                const mode = String(node_instance.uiPrefs?.prompt_sort_mode || "manual");
                return PROMPT_SORT_MODES.has(mode) ? mode : "manual";
            }

            function syncPromptSortControls() {
                widgetContainer
                    .querySelectorAll(`#${uniqueId}-main-sort-select, .localprompt-browse-sort-select`)
                    .forEach(select => {
                        select.value = getPromptSortMode();
                    });
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
                node_instance.uiPrefs.prompt_sort_mode = PROMPT_SORT_MODES.has(mode) ? mode : "manual";
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

            function setupActiveSidebarResize() {
                setupPromptActiveSidebarResize({
                    widgetContainer,
                    uniqueId,
                    nodeInstance: node_instance,
                    activeSidebarWidthWidget,
                    saveUiPrefs,
                });
            }

            async function persistPinnedOrder(nextOrder) {
                node_instance.uiPrefs.pinned_order = normalizePromptIdList(nextOrder);
                await saveUiPrefs();
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
                return sortPromptsByPinnedOrder(prompts, orderedIds, getSelectedPromptIdsInOrder());
            }

            function promoteSelectedPrompts(prompts) {
                return promotePromptsById(prompts, getSelectedPromptIdsInOrder());
            }

            function clearAllSelections() {
                node_instance.promptData = [];
                hideHoverPreview();
                saveSelectionData();
                renderPrompts();
                if (activeLibraryTab) renderLibraryDrawer(activeLibraryTab);
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
                            } else if (action === 'weight-up') {
                                item.weight = stepManagedPromptWeight(item.weight, 1);
                            } else if (action === 'weight-down') {
                                item.weight = stepManagedPromptWeight(item.weight, -1);
                            }
                        }, { refreshOnly: true });
                    });
                });
            }

            // Setup Add Tab Button
            const addTabBtn = widgetContainer.querySelector(`#${uniqueId}-add-tab-btn`);
            if (addTabBtn) {
                addTabBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const categories = await UnifiedPromptGalleryNode.getCategories();
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

            let draggedIndex = -1;
            function renderPrompts() {
                const selectedCount = widgetContainer.querySelector(`#${uniqueId}-selected-count`);
                const activeCount = widgetContainer.querySelector(`#${uniqueId}-active-count`);
                const activeClearBtn = widgetContainer.querySelector(`#${uniqueId}-active-clear-btn`);

                syncSelectedSectionVisibility();
                if (selectedCount) selectedCount.textContent = node_instance.promptData.length;
                if (activeCount) activeCount.textContent = `${node_instance.promptData.length} selected`;
                if (activeClearBtn) activeClearBtn.disabled = node_instance.promptData.length === 0;
                renderActiveSidebar().catch((error) => {
                    console.error('LocalPromptGallery: Failed to render active sidebar', error);
                });
                return;

                selectedList.innerHTML = "";
                if (selectedCount) selectedCount.textContent = node_instance.promptData.length;

                if (node_instance.promptData.length === 0) {
                    selectedList.innerHTML = '<div class="localprompt-empty-state">No prompts selected. Use Most Used, Pinned, or Browse to add prompts.</div>';
                    return;
                }

                node_instance.promptData.forEach((item, index) => {
                    const div = document.createElement("div");
                    div.className = "localprompt-selected-item";
                    div.draggable = true;
                    div.dataset.index = index;

                    const isOn = item.on !== false;
                    const weight = item.weight || 1.0;

                    div.innerHTML = `
                        <button class="toggle-btn ${isOn ? 'on' : 'off'}">${isOn ? 'ON' : 'OFF'}</button>
                        <span class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                        <div class="item-controls">
                            <button class="weight-btn" data-action="weight-down">-</button>
                            <span class="weight-val">${weight.toFixed(1)}</span>
                            <button class="weight-btn" data-action="weight-up">+</button>
                            <button class="remove-btn" data-action="remove" title="Remove">x</button>
                        </div>
                    `;

                    // Drag and drop listeners
                    div.addEventListener('dragstart', (e) => {
                        draggedIndex = index;
                        div.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                    });
                    div.addEventListener('dragend', () => div.classList.remove('dragging'));
                    div.addEventListener('dragover', (e) => e.preventDefault());
                    div.addEventListener('drop', (e) => {
                        e.preventDefault();
                        if (draggedIndex !== -1 && draggedIndex !== index) {
                            const movedItem = node_instance.promptData[draggedIndex];
                            node_instance.promptData.splice(draggedIndex, 1);
                            node_instance.promptData.splice(index, 0, movedItem);
                            saveSelectionData();
                            renderPrompts();
                        }
                        draggedIndex = -1;
                    });

                    // Toggle button
                    div.querySelector('.toggle-btn').addEventListener('click', () => {
                        item.on = !isOn;
                        saveSelectionData();
                        renderPrompts();
                    });

                    // Control buttons
                    div.querySelectorAll('[data-action]').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const action = btn.dataset.action;

                            if (action === 'remove') {
                                node_instance.promptData.splice(index, 1);
                            } else if (action === 'weight-up') {
                                item.weight = Math.min(2.0, Math.round((item.weight + 0.1) * 10) / 10);
                            } else if (action === 'weight-down') {
                                item.weight = Math.max(0.1, Math.round((item.weight - 0.1) * 10) / 10);
                            }

                            saveSelectionData();
                            renderPrompts();
                            if (typeof activeLibraryTab !== 'undefined' && activeLibraryTab) {
                                renderLibraryDrawer(activeLibraryTab);
                            }
                        });
                    });

                    // Context menu listener for selected item
                    div.addEventListener('contextmenu', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const fullPrompt = await UnifiedPromptGalleryNode.getPrompt(item.prompt_id);
                        if (fullPrompt) {
                            showContextMenu(fullPrompt, e.clientX, e.clientY, async () => {
                                // After context menu action, check if name was updated
                                const checkPrompt = await UnifiedPromptGalleryNode.getPrompt(item.prompt_id);
                                if (checkPrompt) {
                                    const idx = node_instance.promptData.findIndex(p => p.prompt_id === item.prompt_id);
                                    if (idx >= 0) {
                                        node_instance.promptData[idx].name = checkPrompt.name;
                                    }
                                } else {
                                    // If null, it was deleted
                                    const idx = node_instance.promptData.findIndex(p => p.prompt_id === item.prompt_id);
                                    if (idx >= 0) {
                                        node_instance.promptData.splice(idx, 1);
                                    }
                                }
                                saveSelectionData();
                                await refreshAllSections();
                            });
                        }
                    });

                    selectedList.appendChild(div);
                });
            }

            let activeLibraryTab = null;
            let workspaceMode = "gallery";
            let currentWildcardMode = wildcardWidget?.value || 'off';

            function getWorkspaceHost() {
                return widgetContainer.querySelector(`#${uniqueId}-workspace-host`);
            }

            function updateConfigBarVisibility() {
                const configBar = widgetContainer.querySelector(`#${uniqueId}-config-bar`);
                const sizeControls = widgetContainer.querySelector(`#${uniqueId}-size-controls`);
                const wildcardControlsEl = widgetContainer.querySelector(`#${uniqueId}-wildcard-controls`);
                const hasOpenPanel =
                    (sizeControls && sizeControls.style.display !== 'none')
                    || (wildcardControlsEl && wildcardControlsEl.style.display !== 'none');
                configBar?.classList.toggle('collapsed', !hasOpenPanel);
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

            function setWorkspaceMode(mode = "gallery") {
                workspaceMode = mode;
                closeToolbarPanels();
                const host = getWorkspaceHost();
                const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
                const resizeHandle = widgetContainer.querySelector(`#${uniqueId}-resize`);
                if (!host) return null;

                host.innerHTML = "";
                host.classList.toggle("active", mode !== "gallery");
                if (mode !== "gallery") {
                    activeLibraryTab = null;
                    clearLibraryNavActiveState();
                    drawer?.classList.remove("active");
                    resizeHandle?.classList.add("hidden");
                }
                syncSelectedSectionVisibility();
                renderPinnedCategoryStrip();
                return host;
            }

            function returnToGallery() {
                setWorkspaceMode("gallery");
            }

            function getLibrarySubnavHtml(activePage = "overview") {
                const navItems = [
                    { key: "overview", label: "Overview" },
                    { key: "cards", label: "Cards" },
                    { key: "presets", label: "Presets" },
                    { key: "import", label: "Import TXT" },
                ];

                return `
                    <nav class="localprompt-library-subnav" aria-label="Library sections">
                        ${navItems.map(item => `
                            <button class="localprompt-library-subnav-item${item.key === activePage ? " active" : ""}" data-library-page="${item.key}" type="button">${item.label}</button>
                        `).join("")}
                    </nav>
                `;
            }

            function renderLibraryShell(activePage = "overview") {
                const host = setWorkspaceMode(`library_${activePage}`);
                if (!host) return null;

                host.innerHTML = `
                    <div class="localprompt-library-shell">
                        <div class="localprompt-library-shell-content" id="${uniqueId}-library-workspace-content"></div>
                    </div>
                `;

                host.addEventListener("click", event => {
                    const button = event.target.closest?.("[data-library-page]");
                    if (!button || !host.contains(button)) return;
                    const page = button.dataset.libraryPage;
                    if (page === "overview") renderLibraryWorkspace();
                    if (page === "cards") showBrowseWorkspace();
                    if (page === "presets") showPresetsWorkspace();
                    if (page === "import") showImportWorkspace();
                });

                return host.querySelector(`#${uniqueId}-library-workspace-content`);
            }

            function renderLibraryWorkspace() {
                const content = renderLibraryShell("overview");
                if (!content) return;
                content.innerHTML = `
                    <div class="localprompt-workspace-panel">
                        <div class="localprompt-workspace-page">
                            <div class="localprompt-workspace-header">
                                <div class="localprompt-workspace-title">
                                    <h3>Library</h3>
                                    <p>Choose what you want to manage.</p>
                                </div>
                                <button class="localprompt-workspace-back" title="Back to Gallery">&lt; Gallery</button>
                            </div>
                            ${getLibrarySubnavHtml("overview")}
                            <div class="localprompt-workspace-body">
                                <div class="localprompt-library-landing">
                                    <button class="localprompt-library-choice" data-workspace-target="library_cards" style="--library-accent: #58d66a;">
                                        <span class="localprompt-library-choice-icon">C</span>
                                        <strong>Cards</strong>
                                        <span>Browse, search, pin, add, and manage prompt cards.</span>
                                    </button>
                                    <button class="localprompt-library-choice" data-workspace-target="library_presets" style="--library-accent: #9b62ff;">
                                        <span class="localprompt-library-choice-icon">P</span>
                                        <strong>Presets</strong>
                                        <span>Save, load, edit, and create prompt preset stacks.</span>
                                    </button>
                                    <button class="localprompt-library-choice" data-workspace-target="import_txt" style="--library-accent: #4f93ff;">
                                        <span class="localprompt-library-choice-icon">I</span>
                                        <strong>Import TXT</strong>
                                        <span>Create a new category from a wildcard-style text file.</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                content.querySelector(".localprompt-workspace-back")?.addEventListener("click", returnToGallery);
                content.querySelector('[data-workspace-target="library_cards"]')?.addEventListener("click", () => showBrowseWorkspace());
                content.querySelector('[data-workspace-target="library_presets"]')?.addEventListener("click", () => showPresetsWorkspace());
                content.querySelector('[data-workspace-target="import_txt"]')?.addEventListener("click", () => showImportWorkspace());
            }

            async function renderActiveSidebar() {
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
                    renderLibraryDrawer,
                    addPromptToSelection,
                    attachInfoPopup,
                    attachContextMenu,
                    getSortMode: getPromptSortMode,
                });
            }

            async function renderLibraryBar() {
                await renderPromptLibraryBar({
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
                });
                widgetContainer
                    .querySelectorAll(`#${uniqueId}-library-tabs .localprompt-library-tab, #${uniqueId}-utility-tabs .localprompt-library-tab`)
                    .forEach(button => {
                        button.addEventListener("click", () => {
                            if (workspaceMode !== "gallery") {
                                setWorkspaceMode("gallery");
                            }
                        }, { capture: true });
                    });
                await renderCategoryDropdownOptions();
                await renderPinnedCategoryStrip();
            }

            async function renderLibraryDrawer(tabName) {
                await renderPromptLibraryDrawer({
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
                }
                hideHoverPreview();
                saveSelectionData();
                renderPrompts();
                if (typeof activeLibraryTab !== 'undefined' && activeLibraryTab) {
                    renderLibraryDrawer(activeLibraryTab);
                }
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
                    preservePromptOrder: getPromptSortMode() !== "manual",
                    sortMode: getPromptSortMode(),
                });
            }

            async function loadCategories() {
                await loadPromptGalleryCategories({
                    widgetContainer,
                    uniqueId,
                    galleryNode: UnifiedPromptGalleryNode,
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
                const data = await UnifiedPromptGalleryNode.getPrompts(filterName, mode, page, selectedPromptIds, category, node_instance.showFavoritesOnly, 10, getPromptSortMode());

                node_instance.availablePrompts = data.prompts || [];
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
                await openBrowseModal({
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
                    getSortMode: getPromptSortMode,
                    setSortMode: setPromptSortMode,
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
                    btmControlSelect.value = controlWidget?.value || 'increment';
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
                        getCategories: () => UnifiedPromptGalleryNode.getCategories(),
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
                node_instance.metaTags = normalizeMetaTags(readSelectionArray(node_instance.properties?.prompt_meta_tags || "[]", []));
                saveMetaTags({ redrawCanvas: false, skipStatus: true });

                // Load UI preferences and initialize
                (async () => {
                    // Load UI preferences
                    node_instance.uiPrefs = {
                        ...node_instance.uiPrefs,
                        ...(await UnifiedPromptGalleryNode.getUiPrefs()),
                    };
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
                    syncPromptSortControls();
                    
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

                setupToolbarDropdown(
                    `${uniqueId}-categories-menu-btn`,
                    `${uniqueId}-categories-panel`,
                    renderCategoryDropdownOptions
                );
                setupToolbarDropdown(
                    `${uniqueId}-meta-tags-btn`,
                    `${uniqueId}-meta-tags-panel`,
                    () => renderMetaTags()
                );

                toolbarOutsideClickHandler = () => closeToolbarPanels();
                document.addEventListener("click", toolbarOutsideClickHandler);

                widgetContainer.querySelector(`#${uniqueId}-add-meta-tag-btn`)?.addEventListener("click", () => {
                    node_instance.metaTags.push({
                        id: `meta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        name: "",
                        prompt_text: "",
                        enabled: true,
                        order: node_instance.metaTags.length,
                    });
                    saveMetaTags();
                    requestAnimationFrame(() => {
                        const rows = widgetContainer.querySelectorAll(`#${uniqueId}-meta-tags-list .localprompt-meta-row`);
                        const lastRow = rows[rows.length - 1];
                        lastRow?.querySelector(".localprompt-meta-text")?.focus();
                    });
                });

                widgetContainer.querySelector(`#${uniqueId}-manage-categories-btn`)?.addEventListener("click", async () => {
                    closeToolbarPanels();
                    await showSettingsWorkspace();
                });

                widgetContainer.querySelector(`#${uniqueId}-library-btn`)?.addEventListener('click', () => {
                    renderLibraryWorkspace();
                });

                widgetContainer.querySelector(`#${uniqueId}-from-last-output-btn`)?.addEventListener('click', async () => {
                    try {
                        await showFromLastOutputWorkspace();
                    } catch (e) {
                        console.error("Error in showFromLastOutputDialog:", e);
                        alert("Error opening dialog: " + e.message);
                    }
                });

                // Import button
                widgetContainer.querySelector(`#${uniqueId}-import-btn`)?.addEventListener('click', async () => {
                    try {
                        await showImportWorkspace();
                    } catch (e) {
                        console.error("Error showing import dialog:", e);
                        alert(e.message);
                    }
                });

                // Settings button
                widgetContainer.querySelector(`#${uniqueId}-settings-btn`)?.addEventListener('click', () => {
                    showSettingsWorkspace();
                });

                widgetContainer.querySelector(`#${uniqueId}-size-toggle-btn`)?.addEventListener('click', () => {
                    const sizeControls = widgetContainer.querySelector(`#${uniqueId}-size-controls`);
                    const sizeToggleBtn = widgetContainer.querySelector(`#${uniqueId}-size-toggle-btn`);
                    const isOpen = sizeControls && sizeControls.style.display !== 'none';
                    if (sizeControls) {
                        sizeControls.style.display = isOpen ? 'none' : 'flex';
                    }
                    sizeToggleBtn?.classList.toggle('active', !isOpen);
                    syncThumbnailSizeSliders();
                    updateConfigBarVisibility();
                });

                widgetContainer.querySelector(`#${uniqueId}-active-toggle`)?.addEventListener('click', async () => {
                    await setActiveSidebarOpen(!isActiveSidebarOpen());
                });

                widgetContainer.querySelector(`#${uniqueId}-active-clear-btn`)?.addEventListener('click', () => {
                    if (node_instance.promptData.length > 0 && confirm("Remove all prompts from selection?")) {
                        clearAllSelections();
                    }
                });

                // Clear button
                widgetContainer.querySelector(`#${uniqueId}-clear-btn`)?.addEventListener('click', () => {
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

                // Browse Modal function
                async function showBrowseModal() {
                    await openBrowseModal({
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

