import * as promptApi from "../api/promptApi.js";
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
    getActiveSidebarWidth as resolveActiveSidebarWidth,
    getActiveSidebarWidthBounds as resolveActiveSidebarWidthBounds,
    getCategoryColorMap as resolveCategoryColorMap,
    getCategoryRoleColor as resolveCategoryRoleColor,
    getLibraryTabsFromPrefs,
    getNearestPaletteColor,
    getThumbnailSizePx as resolveThumbnailSizePx,
    getThumbnailVariables,
    hexToRgba,
    isShowTextNode,
    clampActiveSidebarWidth as clampActiveSidebarWidthToBounds,
    normalizePromptIdList,
    promotePromptsById,
    sortPromptsByPinnedOrder,
    stepManagedPromptWeight,
    syncPinnedOrderWithPromptIds,
} from "./helpers.js";
import { showBrowseModal as openBrowseModal } from "./browse.js";
import {
    showAddPromptDialog as openAddPromptDialog,
    showEditPromptDialog as openEditPromptDialog,
    showFromLastOutputDialog as openFromLastOutputDialog,
    showImportDialog as openImportDialog,
    showUploadThumbnailDialog as openUploadThumbnailDialog,
} from "./dialogs.js";
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
    loadCategories as loadPromptGalleryCategories,
    promptMatchesCurrentGallery as promptMatchesPromptGallery,
    renderGallery as renderPromptGallery,
} from "./gallery.js";
import { showPresetsModal as openPresetsModal } from "./presets.js";
import { showSettingsModal as openSettingsModal } from "./settings.js";
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

    async getPrompts(filter_name = "", mode = "OR", page = 1, selected_prompts = [], filter_category = "", favorites_only = false, perPage = PER_PAGE) {
        this.isLoading = true;
        try {
            const data = await promptApi.getPrompts(filter_name, mode, page, selected_prompts, filter_category, favorites_only, perPage);
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
                pinned_order: [],
                category_colors: {},
                active_sidebar_width: 392,
                last_created_category: "",
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
                        align-self: flex-start;
                        margin-right: 0;
                    }
                    .localprompt-active-toggle::before {
                        content: '||';
                        font-size: 9px;
                        letter-spacing: -0.08em;
                        opacity: 0.7;
                        margin-right: 6px;
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
                    .localprompt-action-bar {
                        margin-bottom: 0;
                        padding-bottom: 4px;
                    }
                    .localprompt-config-bar {
                        display: grid;
                        grid-template-columns: auto 1fr;
                        align-items: center;
                        gap: 6px;
                        margin-top: 0;
                        border-top: none;
                        padding-top: 4px;
                    }
                    .localprompt-config-bar.collapsed {
                        display: none;
                    }
                    .localprompt-wildcard-row {
                        grid-column: 1 / -1;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        min-width: 0;
                        margin-left: 0 !important;
                    }
                    .localprompt-size-row {
                        grid-column: 1 / -1;
                        display: grid;
                        grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr);
                        align-items: center;
                        gap: 8px;
                        min-width: 0;
                    }
                    @container (max-width: 430px) {
                        .localprompt-config-bar {
                            grid-template-columns: auto 1fr;
                        }
                        .localprompt-size-row {
                            grid-template-columns: 1fr;
                        }
                    }
                    .localprompt-bottom-bar .seed-group {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-left: auto;
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
                        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                        gap: 10px;
                    }
                    .localprompt-gallery-item {
                        background: #252525;
                        border: 2px solid #444;
                        border-radius: 6px;
                        overflow: hidden;
                        cursor: pointer;
                        transition: all 0.15s;
                    }
                    .localprompt-gallery-item:hover { border-color: #666; transform: translateY(-2px); }
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
                        height: 100px;
                        background: #1a1a1a;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .localprompt-gallery-item .item-preview img { width: 100%; height: 100%; object-fit: cover; }
                    .localprompt-gallery-item .item-preview.no-img { font-size: 9px; color: #555; }
                    .localprompt-gallery-item .item-info { padding: 6px; }
                    .localprompt-gallery-item .item-name { font-size: 10px; color: #ddd; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
                            <div class="localprompt-top-controls">
                                <button class="localprompt-library-tab localprompt-active-toggle" id="${uniqueId}-active-toggle" type="button" title="Active Cards">&#9679;</button>
                                <div class="localprompt-utility-bar">
                                    <div class="localprompt-utility-buttons" id="${uniqueId}-utility-tabs"></div>
                                </div>
                            </div>
                            <div class="localprompt-library-bar-container">
                                <div class="localprompt-library-tab-strip">
                                    <div class="localprompt-library-tabs-scroll" id="${uniqueId}-library-tabs"></div>
                                    <button class="localprompt-library-add-tab" id="${uniqueId}-add-tab-btn" title="Add Category Tab">+</button>
                                </div>
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
                    </div>
                    <div class="localprompt-bottom-bar localprompt-config-bar collapsed" id="${uniqueId}-config-bar">
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
                        </div>
                    </div>
                </div>
            `;

            // Create hover preview outside the node container so it's not bounded
            const hoverPreview = document.createElement('div');
            hoverPreview.id = `${uniqueId}-hover-preview`;
            hoverPreview.className = 'localprompt-hover-preview';
            document.body.appendChild(hoverPreview);

            // Clean up on node removal
            const originalOnRemoved = this.onRemoved;
            this.onRemoved = function () {
                const preview = document.getElementById(`${uniqueId}-hover-preview`);
                if (preview) preview.remove();
                if (originalOnRemoved) originalOnRemoved.call(this);
            };

            function saveSelectionData(options = {}) {
                const data = writeSelectionArray(node_instance.promptData);
                node_instance.properties["prompt_selection_data"] = data;
                selectionWidget.value = data;
                node_instance.setDirtyCanvas?.(true, options.redrawCanvas !== false);
                if (app.graph) app.graph.change();
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

            saveWildcardState();

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
                return resolveActiveSidebarWidth(node_instance.properties, node_instance.uiPrefs);
            }

            function getActiveSidebarWidthBounds() {
                const shell = widgetContainer.querySelector('.localprompt-body-shell');
                return resolveActiveSidebarWidthBounds(shell?.clientWidth, node_instance.size?.[0]);
            }

            function clampActiveSidebarWidth(width) {
                return clampActiveSidebarWidthToBounds(width, getActiveSidebarWidthBounds());
            }

            function applyActiveSidebarWidthPreference() {
                const width = clampActiveSidebarWidth(getActiveSidebarWidth());
                widgetContainer.style.setProperty('--localprompt-active-sidebar-width', `${width}px`);
                node_instance.uiPrefs.active_sidebar_width = width;
                node_instance.properties.active_sidebar_width = width;
                if (activeSidebarWidthWidget) activeSidebarWidthWidget.value = width;
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
                const barContainer = widgetContainer.querySelector('.localprompt-library-bar-container');
                const tabStrip = widgetContainer.querySelector('.localprompt-library-tab-strip');
                const tabsScroll = widgetContainer.querySelector(`#${uniqueId}-library-tabs`);
                const isWrapMode = getLibraryTabLayoutMode() === 'wrap';
                if (barContainer) barContainer.classList.toggle('wrap-mode', isWrapMode);
                if (tabStrip) tabStrip.classList.toggle('wrap-mode', isWrapMode);
                if (tabsScroll) tabsScroll.classList.toggle('wrap-mode', isWrapMode);
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

            function getUtilityLibraryTabs() {
                return ['most_used', 'pinned'];
            }

            function isUtilityLibraryTab(tabName) {
                return getUtilityLibraryTabs().includes(tabName);
            }

            function clearLibraryNavActiveState() {
                widgetContainer
                    .querySelectorAll(`#${uniqueId}-library-tabs .localprompt-library-tab, #${uniqueId}-utility-tabs .localprompt-library-tab`)
                    .forEach(button => button.classList.remove('active'));
            }

            function isActiveSidebarOpen() {
                return node_instance.uiPrefs?.active_sidebar_open === true;
            }

            function applyActiveSidebarPreference() {
                const sidebar = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
                const toggleBtn = widgetContainer.querySelector(`#${uniqueId}-active-toggle`);
                const splitter = widgetContainer.querySelector(`#${uniqueId}-active-splitter`);
                const isOpen = isActiveSidebarOpen();
                if (sidebar) sidebar.classList.toggle('active', isOpen);
                if (splitter) splitter.classList.toggle('active', isOpen);
                if (toggleBtn) {
                    toggleBtn.classList.toggle('active', isOpen);
                    toggleBtn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
                }
                applyActiveSidebarWidthPreference();
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

            function setupActiveSidebarResize() {
                const splitter = widgetContainer.querySelector(`#${uniqueId}-active-splitter`);
                if (!splitter) return;

                let startX = 0;
                let startWidth = 0;

                const onMouseMove = (e) => {
                    const nextWidth = clampActiveSidebarWidth(startWidth + (e.clientX - startX));
                    widgetContainer.style.setProperty('--localprompt-active-sidebar-width', `${nextWidth}px`);
                };

                const onMouseUp = async (e) => {
                    const finalWidth = clampActiveSidebarWidth(startWidth + (e.clientX - startX));
                    node_instance.uiPrefs.active_sidebar_width = finalWidth;
                    node_instance.properties.active_sidebar_width = finalWidth;
                    if (activeSidebarWidthWidget) activeSidebarWidthWidget.value = finalWidth;
                    widgetContainer.style.setProperty('--localprompt-active-sidebar-width', `${finalWidth}px`);
                    splitter.classList.remove('dragging');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    await saveUiPrefs();
                };

                splitter.addEventListener('mousedown', (e) => {
                    if (!isActiveSidebarOpen()) return;
                    e.preventDefault();
                    startX = e.clientX;
                    startWidth = clampActiveSidebarWidth(getActiveSidebarWidth());
                    splitter.classList.add('dragging');
                    document.body.style.cursor = 'ew-resize';
                    document.body.style.userSelect = 'none';
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
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
            let draggedLibraryTab = null;

            async function renderActiveSidebar() {
                const sidebar = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
                const container = widgetContainer.querySelector(`#${uniqueId}-active-chips`);
                if (!sidebar || !container) return;

                const scrollHost = container.closest('.localprompt-active-sidebar-content') || container;
                const previousScrollTop = scrollHost.scrollTop;
                applyActiveSidebarPreference();
                if (!isActiveSidebarOpen()) {
                    container.innerHTML = '';
                    return;
                }

                hideHoverPreview();
                container.ondragover = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                };
                container.ondrop = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                };

                const prompts = await getActivePromptModels();
                const nextContent = document.createDocumentFragment();

                if (prompts.length === 0) {
                    const emptyState = document.createElement('div');
                    emptyState.className = 'localprompt-empty-state';
                    emptyState.textContent = 'No active prompts selected.';
                    container.replaceChildren(emptyState);
                    requestAnimationFrame(() => {
                        scrollHost.scrollTop = previousScrollTop;
                    });
                    return;
                }

                const displayMode = node_instance.uiPrefs.display_mode || 'text';
                let draggedSelectedPromptId = null;

                prompts.forEach(prompt => {
                    const selectedEntry = getSelectedPromptEntry(prompt.id);
                    if (!selectedEntry) return;

                    const promptId = String(prompt.id);
                    let chip;
                    const roleColor = getCategoryRoleColor(prompt);

                    if (displayMode === 'thumbnails' && prompt.preview_url) {
                        chip = document.createElement('div');
                        chip.className = 'localprompt-chip-thumb selected pinned-managed';
                        chip.innerHTML = `
                            <button class="localprompt-info-btn" title="View Info">!</button>
                            <div class="managed-thumb-media">
                                <img src="${prompt.preview_url}" alt="${prompt.name}">
                                <span class="thumb-label">${prompt.name}</span>
                            </div>
                            ${createPinnedManagedControlsHtml(selectedEntry)}
                        `;
                        const chipImage = chip.querySelector('img');
                        if (chipImage) chipImage.draggable = false;
                    } else {
                        chip = document.createElement('div');
                        chip.className = 'localprompt-chip selected pinned-managed';
                        chip.innerHTML = `
                            <button class="localprompt-info-btn" title="View Info">!</button>
                            <div class="managed-card-name" title="${prompt.name}">${prompt.name}</div>
                            ${createManagedTextControlsHtml(selectedEntry)}
                        `;
                    }

                    chip.draggable = true;
                    chip.dataset.promptId = promptId;
                    applyCategoryRoleStyling(chip, prompt, { soften: true });
                    bindPinnedManagedControls(chip, prompt);

                    chip.addEventListener('dragstart', (e) => {
                        draggedSelectedPromptId = promptId;
                        chip.classList.add('pinned-dragging');
                        if (e.dataTransfer) {
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('application/x-localpromptgallery-selected', promptId);
                        }
                    });
                    chip.addEventListener('dragover', (e) => {
                        if (!draggedSelectedPromptId || draggedSelectedPromptId === promptId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        chip.classList.add('pinned-drop-target');
                    });
                    chip.addEventListener('dragleave', () => {
                        chip.classList.remove('pinned-drop-target');
                    });
                    chip.addEventListener('drop', (e) => {
                        if (!draggedSelectedPromptId || draggedSelectedPromptId === promptId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        chip.classList.remove('pinned-drop-target');
                        const currentOrder = [...node_instance.promptData];
                        const fromIndex = currentOrder.findIndex(item => String(item.prompt_id) === draggedSelectedPromptId);
                        const toIndex = currentOrder.findIndex(item => String(item.prompt_id) === promptId);
                        if (fromIndex < 0 || toIndex < 0) return;
                        const [movedItem] = currentOrder.splice(fromIndex, 1);
                        currentOrder.splice(toIndex, 0, movedItem);
                        node_instance.promptData = currentOrder;
                        saveSelectionData();
                        renderPrompts();
                        if (activeLibraryTab) renderLibraryDrawer(activeLibraryTab);
                    });
                    chip.addEventListener('dragend', () => {
                        chip.classList.remove('pinned-dragging', 'pinned-drop-target');
                        draggedSelectedPromptId = null;
                    });
                    chip.addEventListener('click', (e) => {
                        if (e.target.closest('[data-managed-action]')) return;
                        addPromptToSelection(prompt);
                    });
                    attachInfoPopup(chip, prompt);
                    attachContextMenu(chip, prompt);
                    nextContent.appendChild(chip);
                });
                container.replaceChildren(nextContent);
                requestAnimationFrame(() => {
                    scrollHost.scrollTop = previousScrollTop;
                });
            }

            async function renderLibraryBar() {
                const tabsContainer = widgetContainer.querySelector(`#${uniqueId}-library-tabs`);
                const utilityContainer = widgetContainer.querySelector(`#${uniqueId}-utility-tabs`);
                if (!tabsContainer || !utilityContainer) return;

                const utilityTabs = getUtilityLibraryTabs();
                const categoryTabs = getLibraryTabs();
                tabsContainer.innerHTML = '';
                utilityContainer.innerHTML = '';
                applyLibraryTabLayoutPreference();
                const renderTabButton = (tabContent, targetContainer, role = 'category') => {
                    const tabBtn = document.createElement('button');
                    const isActive = activeLibraryTab === tabContent;
                    tabBtn.className = `localprompt-library-tab${role === 'utility' ? ' localprompt-utility-tab' : ''}${isActive ? ' active' : ''}`;
                    if (tabContent === 'most_used') { tabBtn.innerHTML = '&#128293;'; tabBtn.title = 'Most Used'; }
                    else if (tabContent === 'pinned') { tabBtn.innerHTML = '&#11088;'; tabBtn.title = 'Pinned'; }
                    else tabBtn.innerHTML = tabContent;
                    if (!isUtilityLibraryTab(tabContent)) {
                        applyLibraryTabRoleStyling(tabBtn, tabContent, isActive);
                        tabBtn.draggable = true;
                        tabBtn.style.cursor = 'grab';
                    }

                    // Click to toggle drawer
                    tabBtn.addEventListener('click', async () => {
                        const drawer = widgetContainer.querySelector(`#${uniqueId}-library-drawer`);
                        const resizeHandle = widgetContainer.querySelector(`#${uniqueId}-resize`);
                        if (activeLibraryTab === tabContent) {
                            activeLibraryTab = null;
                            clearLibraryNavActiveState();
                            drawer.classList.remove('active');
                            if (resizeHandle) resizeHandle.classList.add('hidden');
                        } else {
                            activeLibraryTab = tabContent;
                            clearLibraryNavActiveState();
                            tabBtn.classList.add('active');
                            drawer.classList.add('active');
                            if (resizeHandle) resizeHandle.classList.remove('hidden');
                            await renderLibraryDrawer(tabContent);
                        }
                        syncSelectedSectionVisibility();
                    });

                    // Right click to remove tab
                    tabBtn.addEventListener('contextmenu', async (e) => {
                        e.preventDefault();
                        if (isUtilityLibraryTab(tabContent)) {
                            alert('Cannot remove default tabs.');
                            return;
                        }
                        if (confirm(`Remove "${tabContent}" from library bar?`)) {
                            node_instance.uiPrefs.library_tabs = getLibraryTabs().filter(t => t !== tabContent);
                            await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs);
                            if (activeLibraryTab === tabContent) {
                                activeLibraryTab = null;
                                widgetContainer.querySelector(`#${uniqueId}-library-drawer`).classList.remove('active');
                            }
                            syncSelectedSectionVisibility();
                            renderLibraryBar();
                        }
                    });

                    if (!isUtilityLibraryTab(tabContent)) {
                        tabBtn.addEventListener('dragstart', (e) => {
                            draggedLibraryTab = tabContent;
                            tabBtn.style.opacity = '0.45';
                            if (e.dataTransfer) {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', tabContent);
                            }
                        });
                        tabBtn.addEventListener('dragover', (e) => {
                            if (!draggedLibraryTab || draggedLibraryTab === tabContent) return;
                            e.preventDefault();
                            tabBtn.style.boxShadow = 'inset 0 0 0 2px rgba(255,255,255,0.28)';
                        });
                        tabBtn.addEventListener('dragleave', () => {
                            tabBtn.style.boxShadow = '';
                            applyLibraryTabRoleStyling(tabBtn, tabContent, activeLibraryTab === tabContent);
                        });
                        tabBtn.addEventListener('drop', async (e) => {
                            if (!draggedLibraryTab || draggedLibraryTab === tabContent) return;
                            e.preventDefault();
                            const currentTabs = getLibraryTabs();
                            const fromIndex = currentTabs.indexOf(draggedLibraryTab);
                            const toIndex = currentTabs.indexOf(tabContent);
                            if (fromIndex < 0 || toIndex < 0) return;
                            const reorderedTabs = [...currentTabs];
                            const [movedTab] = reorderedTabs.splice(fromIndex, 1);
                            reorderedTabs.splice(toIndex, 0, movedTab);
                            node_instance.uiPrefs.library_tabs = reorderedTabs;
                            await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs);
                            draggedLibraryTab = null;
                            renderLibraryBar();
                            if (activeLibraryTab) await renderLibraryDrawer(activeLibraryTab);
                        });
                        tabBtn.addEventListener('dragend', () => {
                            draggedLibraryTab = null;
                            tabBtn.style.opacity = '';
                            tabBtn.style.boxShadow = '';
                            applyLibraryTabRoleStyling(tabBtn, tabContent, activeLibraryTab === tabContent);
                        });
                    }

                    targetContainer.appendChild(tabBtn);
                };

                utilityTabs.forEach(tabContent => renderTabButton(tabContent, utilityContainer, 'utility'));
                categoryTabs.forEach(tabContent => renderTabButton(tabContent, tabsContainer, 'category'));
            }

            async function renderLibraryDrawer(tabName) {
                const container = widgetContainer.querySelector(`#${uniqueId}-library-chips`);
                if (!container) return;
                hideHoverPreview();
                const previousTabName = container.dataset.renderedTab || '';
                const shouldRestoreScroll = previousTabName === tabName;
                const previousScrollTop = shouldRestoreScroll ? container.scrollTop : 0;
                container.dataset.renderedTab = tabName;

                if (tabName === 'pinned') {
                    container.ondragover = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                    };
                    container.ondrop = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    };
                } else {
                    container.ondragover = null;
                    container.ondrop = null;
                }

                let prompts = [];
                const maxCount = node_instance.uiPrefs.most_used_count || 10;
                
                if (tabName === 'most_used') {
                    prompts = await UnifiedPromptGalleryNode.getMostUsed(maxCount);
                } else if (tabName === 'pinned') {
                    const data = await UnifiedPromptGalleryNode.getPrompts("", "OR", 1, [], "", true, maxCount);
                    prompts = data.prompts || [];
                } else {
                    // Category tab: fetch all prompts for category
                    const data = await UnifiedPromptGalleryNode.getPrompts("", "OR", 1, [], tabName, false, 200);
                    let catPrompts = data.prompts || [];
                    
                    catPrompts.sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
                    
                    prompts = catPrompts;
                }

                const nextContent = document.createDocumentFragment();

                const selectedIds = new Set(getSelectedPromptIdsInOrder().map(id => String(id)));
                const selectedIdStrings = selectedIds;
                const displayMode = node_instance.uiPrefs.display_mode || 'text';

                if (tabName === 'pinned') {
                    prompts = sortPinnedPrompts(prompts);
                } else {
                    prompts = promoteSelectedPrompts(prompts);
                }

                const drawerToolbar = document.createElement('div');
                drawerToolbar.className = 'localprompt-drawer-toolbar';
                drawerToolbar.innerHTML = `
                    <span class="localprompt-drawer-summary">Selected (${node_instance.promptData.length})</span>
                    <button class="localprompt-btn localprompt-clear-btn" style="padding: 2px 6px; font-size: 9px; background: #4a2a2a; border-color: #6a3a3a;" ${node_instance.promptData.length ? '' : 'disabled'}>Clear All</button>
                `;
                const drawerClearBtn = drawerToolbar.querySelector('button');
                if (drawerClearBtn) {
                    drawerClearBtn.addEventListener('click', () => {
                        if (node_instance.promptData.length > 0 && confirm("Remove all prompts from selection?")) {
                            clearAllSelections();
                        }
                    });
                }
                nextContent.appendChild(drawerToolbar);

                if (prompts.length === 0) {
                    const emptyState = document.createElement('span');
                    emptyState.style.fontSize = '11px';
                    emptyState.style.color = '#555';
                    emptyState.style.padding = '4px';
                    emptyState.textContent = 'No prompts found here.';
                    nextContent.appendChild(emptyState);
                    container.replaceChildren(nextContent);
                    if (shouldRestoreScroll) {
                        requestAnimationFrame(() => {
                            container.scrollTop = previousScrollTop;
                        });
                    }
                    return;
                }

                let draggedPinnedId = null;
                let dragReordered = false;
                let draggedSelectedPromptId = null;
                const visibleUnselectedPinnedIds = tabName === 'pinned'
                    ? prompts.filter(prompt => !selectedIdStrings.has(String(prompt.id))).map(prompt => String(prompt.id))
                    : [];

                prompts.forEach(prompt => {
                    const isSelected = selectedIds.has(String(prompt.id));
                    const promptId = String(prompt.id);
                    let chip;
                    const roleColor = getCategoryRoleColor(prompt);
                    
                    const isGlobalPinned = prompt.favorite;
                    const selectedEntry = isSelected ? getSelectedPromptEntry(prompt.id) : null;

                    if (displayMode === 'thumbnails' && prompt.preview_url) {
                        chip = document.createElement('div');
                        chip.className = `localprompt-chip-thumb ${isSelected ? 'selected' : ''}`;
                        
                        let content = '';
                        if (tabName !== 'most_used' && (tabName !== 'pinned' || !isSelected)) {
                            const pinFilter = isGlobalPinned ? 'none' : 'grayscale(100%) opacity(0.3)';
                            content += `<button class="chip-pin-btn" style="filter: ${pinFilter};">&#9733;</button>`;
                        }

                        if (isSelected && selectedEntry) {
                            chip.classList.add('pinned-managed');
                            content += `
                                <div class="managed-thumb-media">
                                    <img src="${prompt.preview_url}" alt="${prompt.name}">
                                    <span class="thumb-label">${prompt.name}</span>
                                </div>
                                ${createPinnedManagedControlsHtml(selectedEntry)}
                            `;
                        } else {
                            content += `
                                <button class="localprompt-info-btn" title="View Info">!</button>
                                <img src="${prompt.preview_url}" alt="${prompt.name}">
                                <span class="thumb-label">${prompt.name}</span>
                            `;
                        }
                        chip.innerHTML = content;
                        const chipImage = chip.querySelector('img');
                        if (chipImage) chipImage.draggable = false;
                        applyCategoryRoleStyling(chip, prompt, { soften: isSelected });
                        chip.removeAttribute('title');
                    } else {
                        chip = document.createElement('div');
                        chip.className = `localprompt-chip ${isSelected ? 'selected' : ''}`;
                        
                        let content = '';
                        if (tabName !== 'most_used' && (tabName !== 'pinned' || !isSelected)) {
                            const pinFilter = isGlobalPinned ? 'none' : 'grayscale(100%) opacity(0.3)';
                            content += `<button class="chip-pin-btn" style="filter: ${pinFilter};">&#9733;</button>`;
                        }

                        if (isSelected && selectedEntry) {
                            chip.classList.add('pinned-managed');
                            content += `
                                <div class="managed-card-name" title="${prompt.name}">${prompt.name}</div>
                                ${createManagedTextControlsHtml(selectedEntry)}
                            `;
                        } else {
                            content += `<button class="localprompt-info-btn" title="View Info">!</button> ${prompt.name}`;
                        }
                        if (tabName === 'most_used' || (prompt.usage_count > 0 && tabName !== 'pinned')) {
                            content += ` <span class="usage-count">x${prompt.usage_count || 0}</span>`;
                        }
                        chip.innerHTML = content;
                        applyCategoryRoleStyling(chip, prompt, { soften: isSelected });
                        chip.removeAttribute('title');
                    }
                    chip.dataset.promptId = promptId;

                    // Add event listener to pin button
                    const pinBtn = chip.querySelector('.chip-pin-btn');
                    if (pinBtn) {
                        pinBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const result = await UnifiedPromptGalleryNode.toggleFavorite(prompt.id);
                            if (result?.status === 'ok') {
                                await syncPinnedOrderForFavorite(prompt.id, result.favorite);
                            }
                            renderLibraryDrawer(tabName);
                        });
                    }

                    if (tabName === 'pinned' && !isSelected) {
                        chip.classList.add('pinned-draggable');
                        chip.draggable = true;
                        chip.dataset.promptId = promptId;
                        chip.addEventListener('dragstart', (e) => {
                            e.stopPropagation();
                            draggedPinnedId = promptId;
                            dragReordered = false;
                            chip.classList.add('pinned-dragging');
                            if (e.dataTransfer) {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('application/x-localpromptgallery-pinned', promptId);
                            }
                        });
                        chip.addEventListener('dragover', (e) => {
                            if (!draggedPinnedId || draggedPinnedId === promptId) return;
                            e.preventDefault();
                            e.stopPropagation();
                            chip.classList.add('pinned-drop-target');
                            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                        });
                        chip.addEventListener('dragleave', () => {
                            chip.classList.remove('pinned-drop-target');
                        });
                        chip.addEventListener('drop', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            chip.classList.remove('pinned-drop-target');
                            if (!draggedPinnedId || draggedPinnedId === promptId) return;

                            const nextOrder = visibleUnselectedPinnedIds.filter(id => id !== draggedPinnedId);
                            const targetIndex = nextOrder.indexOf(promptId);
                            nextOrder.splice(targetIndex, 0, draggedPinnedId);
                            const hiddenPinnedIds = getPinnedOrder().filter(id => !visibleUnselectedPinnedIds.includes(id) && id !== draggedPinnedId);

                            dragReordered = true;
                            await persistPinnedOrder([...nextOrder, ...hiddenPinnedIds]);
                            await renderLibraryDrawer(tabName);
                        });
                        chip.addEventListener('dragend', () => {
                            chip.classList.remove('pinned-dragging', 'pinned-drop-target');
                            draggedPinnedId = null;
                            if (dragReordered) {
                                node_instance._suppressPinnedClickUntil = Date.now() + 150;
                            }
                        });
                    }

                    if (isSelected) {
                        chip.draggable = true;
                        chip.addEventListener('dragstart', (e) => {
                            draggedSelectedPromptId = promptId;
                            chip.classList.add('pinned-dragging');
                            if (e.dataTransfer) {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('application/x-localpromptgallery-selected', promptId);
                            }
                        });
                        chip.addEventListener('dragover', (e) => {
                            if (!draggedSelectedPromptId || draggedSelectedPromptId === promptId) return;
                            e.preventDefault();
                            chip.classList.add('pinned-drop-target');
                        });
                        chip.addEventListener('dragleave', () => {
                            chip.classList.remove('pinned-drop-target');
                        });
                        chip.addEventListener('drop', (e) => {
                            if (!draggedSelectedPromptId || draggedSelectedPromptId === promptId) return;
                            e.preventDefault();
                            chip.classList.remove('pinned-drop-target');
                            const currentOrder = [...node_instance.promptData];
                            const fromIndex = currentOrder.findIndex(item => String(item.prompt_id) === draggedSelectedPromptId);
                            const toIndex = currentOrder.findIndex(item => String(item.prompt_id) === promptId);
                            if (fromIndex < 0 || toIndex < 0) return;
                            const [movedItem] = currentOrder.splice(fromIndex, 1);
                            currentOrder.splice(toIndex, 0, movedItem);
                            node_instance.promptData = currentOrder;
                            saveSelectionData();
                            renderPrompts();
                            if (activeLibraryTab) renderLibraryDrawer(activeLibraryTab);
                        });
                        chip.addEventListener('dragend', () => {
                            chip.classList.remove('pinned-dragging', 'pinned-drop-target');
                            draggedSelectedPromptId = null;
                        });
                    }

                    if (isSelected) {
                        bindPinnedManagedControls(chip, prompt);
                        chip.addEventListener('click', (e) => {
                            if (e.target.closest('[data-managed-action]')) return;
                            addPromptToSelection(prompt);
                        });
                    } else {
                        chip.addEventListener('click', () => addPromptToSelection(prompt));
                    }
                    if (tabName === 'pinned') {
                        chip.addEventListener('click', (e) => {
                            if ((node_instance._suppressPinnedClickUntil || 0) > Date.now()) {
                                e.stopImmediatePropagation();
                            }
                        }, true);
                    }
                    attachInfoPopup(chip, prompt);
                    attachContextMenu(chip, prompt);
                    nextContent.appendChild(chip);
                });

                container.replaceChildren(nextContent);

                if (shouldRestoreScroll) {
                    requestAnimationFrame(() => {
                        container.scrollTop = previousScrollTop;
                    });
                }
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
                });
            }

            async function loadCategories() {
                await loadPromptGalleryCategories({
                    widgetContainer,
                    uniqueId,
                    galleryNode: UnifiedPromptGalleryNode,
                });
            }

            async function loadPromptsForGallery(page = 1) {
                const filterInput = widgetContainer.querySelector(`#${uniqueId}-filter-input`);
                const modeSelect = widgetContainer.querySelector(`#${uniqueId}-filter-mode`);
                const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);

                const filterName = filterInput ? filterInput.value : "";
                const mode = modeSelect ? modeSelect.value : "OR";
                const category = categorySelect ? categorySelect.value : "";

                const selectedPromptIds = node_instance.promptData.map(p => p.prompt_id);
                const data = await UnifiedPromptGalleryNode.getPrompts(filterName, mode, page, selectedPromptIds, category, node_instance.showFavoritesOnly);

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
                const filterInput = widgetContainer.querySelector(`#${uniqueId}-filter-input`);
                const modeSelect = widgetContainer.querySelector(`#${uniqueId}-filter-mode`);
                const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);

                const prevBtn = widgetContainer.querySelector(`#${uniqueId}-prev-btn`);
                const nextBtn = widgetContainer.querySelector(`#${uniqueId}-next-btn`);

                if (filterInput) {
                    filterInput.addEventListener('input', async () => {
                        await loadPromptsForGallery(1);
                    });
                }

                if (modeSelect) {
                    modeSelect.addEventListener('change', async () => {
                        await loadPromptsForGallery(1);
                    });
                }

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
                let currentWildcardMode = wildcardWidget?.value || 'off';

                const wildcardToggleBtn = widgetContainer.querySelector(`#${uniqueId}-wildcard-toggle-btn`);
                const wildcardControls = widgetContainer.querySelector(`#${uniqueId}-wildcard-controls`);

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
                    updateConfigBarVisibility();
                }

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
                    
                    // Render all sections
                    renderPrompts();
                    renderLibraryBar();
                    syncSelectedSectionVisibility();
                    updatePromptSourceStatus();
                })();

                // ========== NEW BUTTON HANDLERS ==========

                widgetContainer.querySelector(`#${uniqueId}-library-btn`)?.addEventListener('click', () => {
                    showLibraryModal();
                });

                widgetContainer.querySelector(`#${uniqueId}-from-last-output-btn`)?.addEventListener('click', async () => {
                    try {
                        await showFromLastOutputDialog();
                    } catch (e) {
                        console.error("Error in showFromLastOutputDialog:", e);
                        alert("Error opening dialog: " + e.message);
                    }
                });

                // Import button
                widgetContainer.querySelector(`#${uniqueId}-import-btn`)?.addEventListener('click', async () => {
                    try {
                        await showImportDialog();
                    } catch (e) {
                        console.error("Error showing import dialog:", e);
                        alert(e.message);
                    }
                });

                // Settings button
                widgetContainer.querySelector(`#${uniqueId}-settings-btn`)?.addEventListener('click', () => {
                    showSettingsModal();
                });

                widgetContainer.querySelector(`#${uniqueId}-size-toggle-btn`)?.addEventListener('click', () => {
                    const sizeControls = widgetContainer.querySelector(`#${uniqueId}-size-controls`);
                    const sizeToggleBtn = widgetContainer.querySelector(`#${uniqueId}-size-toggle-btn`);
                    const isOpen = sizeControls && sizeControls.style.display !== 'none';
                    if (sizeControls) {
                        sizeControls.style.display = isOpen ? 'none' : 'grid';
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

                function showLibraryModal() {
                    const overlay = document.createElement('div');
                    overlay.className = 'localprompt-modal-overlay';
                    overlay.innerHTML = `
                        <div class="localprompt-modal" style="width: 360px;">
                            <div class="localprompt-modal-header">
                                <h3>Library</h3>
                                <button class="localprompt-modal-close">×</button>
                            </div>
                            <div class="localprompt-modal-content" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <button id="${uniqueId}-library-cards-tab" class="localprompt-btn active" style="padding: 14px;">Cards</button>
                                <button id="${uniqueId}-library-presets-tab" class="localprompt-btn active" style="padding: 14px;">Presets</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(overlay);
                    overlay.querySelector('.localprompt-modal-close')?.addEventListener('click', () => overlay.remove());
                    overlay.addEventListener('click', (e) => {
                        if (e.target === overlay) overlay.remove();
                    });
                    overlay.querySelector(`#${uniqueId}-library-cards-tab`)?.addEventListener('click', () => {
                        overlay.remove();
                        showBrowseModal();
                    });
                    overlay.querySelector(`#${uniqueId}-library-presets-tab`)?.addEventListener('click', () => {
                        overlay.remove();
                        showPresetsModal();
                    });
                }

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

