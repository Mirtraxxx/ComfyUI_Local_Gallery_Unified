import { confirmAction, showAlert } from "../shared/nativeDialogs.js";
import * as promptApi from "../api/promptApi.js";
import {
    CATEGORY_ROLE_PALETTE,
    FAVORITE_COLORS,
    PER_PAGE,
    THUMBNAIL_SIZE_DEFAULT,
    THUMBNAIL_SIZE_LEGACY_PRESETS,
    THUMBNAIL_SIZE_MAX,
    THUMBNAIL_SIZE_MIN,
    VISIBLE_PINNED_CATEGORY_COUNT_DEFAULT,
    VISIBLE_PINNED_CATEGORY_COUNT_MAX,
    VISIBLE_PINNED_CATEGORY_COUNT_MIN,
} from "./constants.js";
import {
    createManagedTextControlsHtml,
    createPinnedManagedControlsHtml,
    getCategoryColorMap as resolveCategoryColorMap,
    getCategoryRoleColor as resolveCategoryRoleColor,
    getLibraryTabsFromPrefs,
    getNearestPaletteColor,
    hexToRgba,
    isShowTextNode,
    normalizePromptIdList,
    formatWeight,
    getManagedPromptState,
    promotePromptsById,
    sortPromptsByPinnedOrder,
    stepManagedPromptWeight,
    syncPinnedOrderWithPromptIds,
} from "./helpers.js";
import {
    closePromptContextMenus,
    showPromptActionContextMenu as openPromptActionContextMenu,
    showPromptContextMenu as openPromptContextMenu,
} from "./contextMenus.js";
import {
    attachInfoPopup as attachPromptInfoPopup,
    closePromptPreviews,
    hideHoverPreview as hidePromptHoverPreview,
    showHoverPreview as showPromptHoverPreview,
} from "./previews.js";
import {
    applyActiveSidebarWidthPreference as applyPromptActiveSidebarWidthPreference,
    getActiveSidebarWidth as getPromptActiveSidebarWidth,
} from "./activeSidebar.js";
import { createPromptGalleryController } from "./galleryController.js";
import { createPromptCategoryStripController } from "./categoryStripController.js";
import { createBottomToolbarController } from "./bottomToolbarController.js";
import { createDisplayPreferencesController } from "./displayPreferencesController.js";
import { createActiveStackController } from "./activeStackController.js";
import {
    applyLibraryTabLayoutPreference as applyLibraryTabLayoutClasses,
    getUtilityLibraryTabs,
    isUtilityLibraryTab,
    renderPromptBuilderBar,
    renderPromptBuilderDrawer,
} from "./library.js";
import { showSettingsModal as openSettingsModal } from "./settings.js";
import { showWildcardsModal } from "./wildcards.js";
import { getPromptTemplate } from "./template.js";
import { setupPromptPreDomStateWidgets, setupPromptPostDomStateWidgets } from "./stateWidgets.js";
import { createMetaTagsController } from "./metaTags.js";
import { createPromptWorkspaceController } from "./workspace.js";
import { createPromptWorkspaceActions } from "./workspaceActions.js";
import {
    DEFAULT_PROMPT_UI_PREFS,
    mergeUiPrefs,
} from "./preferences.js";
import { escapeHtml } from "../shared/dom.js";
import { createEventListenerRegistry } from "../shared/events.js";
import { createOperationFeedback } from "../shared/operationFeedback.js?v=operation-feedback-20260809-3";
import { readSelectionArray, stringifyJsonOr, writeSelectionArray } from "../shared/json.js";
import {
    getWorkflowProfileStatus,
    readWorkflowProfileSection,
    writeWorkflowProfileSection,
} from "../shared/workflowProfile.js";

export function createPromptGalleryLifecycle(app, api) {
const UnifiedPromptGalleryNode = {
    name: "LocalGalleryPromptLora.PromptUI",
    isLoading: false,
    currentPage: 1,
    totalPages: 1,
    lastOutput: null, // Stores { filename, subfolder, type } of last generation
    instances: new Set(),
    pendingWildcardAutoAttach: new Map(),
    recentOutputsByPromptId: new Map(),
    // Deferred auto-attach: queue card updates during long sequential runs and
    // flush only when Comfy is fully idle (never mid-sampling).
    deferredAutoAttachByPromptId: new Map(),
    deferredAutoAttachTimer: null,
    deferredAutoAttachFlushing: false,
    // Track Comfy execution so we never rewrite the large metadata file mid-run.
    isExecuting: false,
    queueRemaining: 0,
    // Short settle after true idle so the next queued job can cancel us first.
    AUTO_ATTACH_IDLE_SETTLE_MS: 750,
    FAVORITE_COLORS,
    CATEGORY_ROLE_PALETTE,
    THUMBNAIL_SIZE_MIN,
    THUMBNAIL_SIZE_MAX,
    THUMBNAIL_SIZE_DEFAULT,
    THUMBNAIL_SIZE_LEGACY_PRESETS,

    async getPrompts(filter_name = "", mode = "OR", page = 1, selected_prompts = [], filter_category = "", favorites_only = false, perPage = PER_PAGE, sortMode = "manual", requestOptions = {}) {
        this.isLoading = true;
        try {
            const data = await promptApi.getPrompts(filter_name, mode, page, selected_prompts, filter_category, favorites_only, perPage, sortMode, requestOptions);
            this.totalPages = data.total_pages || 1;
            this.currentPage = data.current_page || 1;
            return data;
        } catch (error) {
            if (requestOptions?.signal?.aborted) throw error;
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

    async getCategorySummary() {
        try {
            return await promptApi.getCategorySummary();
        } catch (error) {
            console.error("LocalPromptGallery: Error fetching category summary:", error);
            return { categories: [], counts: {}, totalCount: null };
        }
    },

    async getPromptStats(options = {}) {
        try {
            return await promptApi.getPromptStats(options);
        } catch (error) {
            console.error("LocalPromptGallery: Error fetching prompt stats:", error);
            throw error;
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

    async movePromptsBulk(prompt_ids, category = "") {
        try {
            return await promptApi.movePromptsBulk(prompt_ids, category);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to bulk move prompts", e);
            return { status: "error", message: e.toString() };
        }
    },

    async renamePromptsSequential(selection, options = {}) {
        try {
            return await promptApi.renamePromptsSequential(selection, options);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to rename prompts sequentially", e);
            throw e;
        }
    },

    async bulkEdit(selection, operations, options = {}) {
        try {
            return await promptApi.bulkEdit(selection, operations, options);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to bulk edit prompts", e);
            throw e;
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

    async exportWildcardCategory(category, filename = "", destination = "comfy") {
        try {
            return await promptApi.exportWildcardCategory(category, filename, destination);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to export wildcard category", e);
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

    async getUiPrefs() {
        try {
            return await promptApi.getUiPrefs();
        } catch (e) {
            console.error("LocalPromptGallery: Failed to get UI prefs", e);
            return { ...DEFAULT_PROMPT_UI_PREFS };
        }
    },

    async saveUiPrefs(prefs, nodeInstance = null) {
        try {
            if (typeof nodeInstance?.persistPromptUiPrefs === "function") {
                return await nodeInstance.persistPromptUiPrefs(prefs);
            }
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

    async savePreset(name, selection, wildcardMode, wildcardCategories, wildcardAutoAttachThumbnail = "off") {
        try {
            return await promptApi.savePreset(name, selection, wildcardMode, wildcardCategories, wildcardAutoAttachThumbnail);
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

    async assignThumbnail(prompt_id, lastOutput) {
        try {
            return await promptApi.assignThumbnail(prompt_id, lastOutput);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to assign thumbnail", e);
            return { status: "error", message: e.toString() };
        }
    },

    async assignThumbnailsBatch(assignments) {
        try {
            return await promptApi.assignThumbnailsBatch(assignments);
        } catch (e) {
            console.error("LocalPromptGallery: Failed to batch assign thumbnails", e);
            return { status: "error", message: e.toString(), attached_count: 0, results: [] };
        }
    },

    isComfyIdle() {
        return !this.isExecuting && Number(this.queueRemaining || 0) <= 0;
    },

    reportOperationFeedback(state, message, options = {}) {
        this.instances.forEach(instance => {
            instance.operationFeedback?.[state]?.(message, options);
        });
    },

    /**
     * Free GPU/compositor work in the gallery UI while Comfy is sampling.
     * Continuous card border animations + backdrop blur + video decode share the
     * same GPU as the sampler on Windows and can tank it/s until a hard refresh.
     */
    setSamplingQuietMode(enabled) {
        const quiet = !!enabled;
        this.instances.forEach(instance => {
            const root = instance.__localPromptWidgetRoot;
            if (!root) return;
            root.classList.toggle("localprompt-sampling-quiet", quiet);
            if (quiet) {
                root.querySelectorAll("video").forEach(video => {
                    try {
                        video.pause();
                    } catch {
                        // Ignore media control failures during teardown/generation.
                    }
                });
            }
        });
    },

    cancelDeferredAutoAttachFlush() {
        if (this.deferredAutoAttachTimer != null) {
            clearTimeout(this.deferredAutoAttachTimer);
            this.deferredAutoAttachTimer = null;
        }
    },

    queueDeferredAutoAttach(promptIds, lastOutput) {
        if (!lastOutput?.filename || !Array.isArray(promptIds) || promptIds.length === 0) {
            return;
        }
        for (const promptId of promptIds) {
            const id = String(promptId || "").trim();
            if (!id) continue;
            // Latest image for a card wins if it was selected again later in the queue.
            this.deferredAutoAttachByPromptId.set(id, {
                filename: lastOutput.filename,
                subfolder: lastOutput.subfolder || "",
                type: lastOutput.type || "output",
            });
        }
        // Never start a wall-clock timer while more jobs may still be running —
        // that was freezing sampling around step ~5 of the next prompt.
        this.tryScheduleDeferredAutoAttachFlush();
    },

    tryScheduleDeferredAutoAttachFlush() {
        if (this.deferredAutoAttachByPromptId.size === 0) {
            return;
        }
        if (!this.isComfyIdle()) {
            this.cancelDeferredAutoAttachFlush();
            return;
        }
        this.scheduleDeferredAutoAttachFlush(this.AUTO_ATTACH_IDLE_SETTLE_MS);
    },

    scheduleDeferredAutoAttachFlush(delayMs) {
        if (this.deferredAutoAttachByPromptId.size === 0) {
            return;
        }
        if (!this.isComfyIdle()) {
            this.cancelDeferredAutoAttachFlush();
            return;
        }
        if (this.deferredAutoAttachTimer != null) {
            clearTimeout(this.deferredAutoAttachTimer);
        }
        this.deferredAutoAttachTimer = setTimeout(() => {
            this.deferredAutoAttachTimer = null;
            void this.flushDeferredAutoAttach();
        }, Math.max(0, Number(delayMs) || this.AUTO_ATTACH_IDLE_SETTLE_MS));
    },

    async flushDeferredAutoAttach() {
        if (this.deferredAutoAttachFlushing) {
            // Another flush is in flight; retry only if still idle later.
            this.tryScheduleDeferredAutoAttachFlush();
            return;
        }
        if (this.deferredAutoAttachByPromptId.size === 0) {
            return;
        }
        // Hard gate: never rewrite ~30MB metadata while a prompt is generating.
        if (!this.isComfyIdle()) {
            this.cancelDeferredAutoAttachFlush();
            return;
        }

        this.deferredAutoAttachFlushing = true;
        this.cancelDeferredAutoAttachFlush();

        const assignments = [];
        for (const [promptId, lastOutput] of this.deferredAutoAttachByPromptId.entries()) {
            assignments.push({
                prompt_id: promptId,
                filename: lastOutput.filename,
                subfolder: lastOutput.subfolder || "",
                type: lastOutput.type || "output",
            });
        }
        this.deferredAutoAttachByPromptId.clear();

        try {
            // If a new job started between the settle timer and now, re-queue and abort.
            if (!this.isComfyIdle()) {
                for (const item of assignments) {
                    this.deferredAutoAttachByPromptId.set(item.prompt_id, {
                        filename: item.filename,
                        subfolder: item.subfolder,
                        type: item.type,
                    });
                }
                return;
            }

            const result = await this.assignThumbnailsBatch(assignments);
            // Backend refused because a new job started — put items back and wait.
            if (result?.status === "busy") {
                for (const item of assignments) {
                    this.deferredAutoAttachByPromptId.set(item.prompt_id, {
                        filename: item.filename,
                        subfolder: item.subfolder,
                        type: item.type,
                    });
                }
                return;
            }
            const attachedCount = Number(result?.attached_count) || 0;
            if (result?.status !== "ok") {
                console.warn(
                    "LocalPromptGallery: Deferred auto-attach batch failed",
                    result?.message || "unknown error"
                );
                this.reportOperationFeedback("error", result?.message || "Automatic thumbnail attachment failed");
            } else if (Array.isArray(result?.results)) {
                const failedItems = result.results.filter(item => item?.status && item.status !== "ok");
                for (const item of result.results) {
                    if (item?.status && item.status !== "ok") {
                        console.warn(
                            `LocalPromptGallery: Could not auto-attach output to wildcard card ${item.prompt_id}`,
                            item.message || "unknown error"
                        );
                    }
                }
                if (failedItems.length > 0) {
                    this.reportOperationFeedback(
                        "warning",
                        `Attached ${attachedCount} thumbnails. ${failedItems.length} failed.`
                    );
                } else if (attachedCount > 0) {
                    this.reportOperationFeedback("success", `Attached ${attachedCount} wildcard thumbnails`);
                }
            }

            // Only refresh gallery UI when still idle so we don't thrash the browser mid-run.
            if (attachedCount > 0 && this.isComfyIdle()) {
                await Promise.all([...this.instances].map(async (instance) => {
                    try {
                        await instance.__localGalleryRefresh?.();
                    } catch (error) {
                        console.warn("LocalPromptGallery: Failed to refresh after deferred auto-attach", error);
                    }
                }));
            }
        } catch (error) {
            console.warn("LocalPromptGallery: Deferred auto-attach flush failed", error);
            this.reportOperationFeedback("error", error?.message || "Automatic thumbnail attachment failed");
        } finally {
            this.deferredAutoAttachFlushing = false;
            // If more items arrived while we were writing, schedule another pass only if idle.
            if (this.deferredAutoAttachByPromptId.size > 0) {
                this.tryScheduleDeferredAutoAttachFlush();
            }
        }
    },

    setup(nodeType, nodeData) {
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated?.apply(this, arguments);
            const globalListeners = createEventListenerRegistry();
            const node_instance = this;
            UnifiedPromptGalleryNode.instances.add(node_instance);

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
            this.__localPromptWidgetRoot = widgetContainer;
            if (UnifiedPromptGalleryNode.isExecuting) {
                widgetContainer.classList.add("localprompt-sampling-quiet");
            }
            this.addDOMWidget("prompt_gallery", "div", widgetContainer, {});

            // Keep interactions inside the custom UI from bubbling into the ComfyUI canvas.
            // The node can still be selected from its title/header, while buttons, sliders,
            // category pills, and drag gestures remain owned by this interface.
            ['pointerdown', 'mousedown', 'click'].forEach(eventName => {
                widgetContainer.addEventListener(eventName, event => {
                    event.stopPropagation();
                });
            });

            // --- HIDDEN DATA WIDGETS (added AFTER DOM widget to not affect its position) ---
            const postDomWidgets = setupPromptPostDomStateWidgets({ nodeInstance: this });
            const {
                wildcardWidget,
                wildcardRngModeWidget,
                wildcardShuffleNonceWidget,
                wildcardAutoAttachThumbnailWidget,
                categoriesWidget,
                seedWidget,
                controlWidget,
            } = postDomWidgets;


            const uniqueId = `localprompt-gallery-${this.id}`;

            widgetContainer.innerHTML = getPromptTemplate(uniqueId);
            const promptBottomBar = widgetContainer.querySelector(".localprompt-bottom-bar");
            const operationFeedback = createOperationFeedback({
                host: promptBottomBar,
                before: promptBottomBar?.querySelector(".localprompt-bottom-spacer"),
                readyMessage: "Ready",
            });
            this.operationFeedback = operationFeedback;

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
                flushMetaTags,
                renderMetaTags,
                updateMetaTagsButtonState,
                loadMetaTagsFromProperties,
                bindAddMetaTagButton,
            } = metaTagsController;

            // Comfy serializes hidden widgets immediately before execution.
            // Flush an in-flight textarea debounce at that boundary so a fast
            // queue action never observes older Hidden Prompts.
            metaTagsWidget.serializeValue = () => {
                flushMetaTags({ redrawCanvas: false, skipRender: true });
                return node_instance.properties["prompt_meta_tags"] || "[]";
            };

            let activeLibraryTab = null;
            let categoryOverflowOpen = false;
            let currentWildcardMode = wildcardWidget?.value || 'off';
            let disposed = false;
            let libraryDrawerRenderToken = 0;
            let queuedLibraryDrawerTimer = null;
            let selectionGraphChangeTimer = null;
            let setupTimer = null;
            const libraryGalleryGuardButtons = new WeakSet();
            let cachedCategories = null;
            let cachedCategoriesPromise = null;
            // Per-node models keep Active Stack operations independent from
            // network latency.  Cards are seeded from every visible list and
            // only unresolved workflow ids are fetched during hydration.
            const promptModelCache = new Map();
            const promptModelRequests = new Map();
            const promptBuilderDrawerCache = new Map();

            function seedPromptModels(prompts) {
                (Array.isArray(prompts) ? prompts : []).forEach(prompt => {
                    const id = prompt?.id ?? prompt?.prompt_id;
                    if (id == null) return;
                    const key = String(id);
                    const previous = promptModelCache.get(key) || {};
                    promptModelCache.set(key, { ...previous, ...prompt, id: prompt.id ?? id });
                });
            }

            function invalidatePromptModelCache(promptIds = null) {
                if (!Array.isArray(promptIds)) {
                    promptModelCache.clear();
                    promptModelRequests.clear();
                    promptBuilderDrawerCache.clear();
                    return;
                }
                promptIds.forEach(id => {
                    const key = String(id);
                    promptModelCache.delete(key);
                    promptModelRequests.delete(key);
                });
                // A changed card can affect any cached builder listing.
                promptBuilderDrawerCache.clear();
            }

            async function getCachedPromptBuilderPrompts({ tabName, maxCount, sortMode, load }) {
                const cacheKey = `${tabName}|${maxCount}|${sortMode}`;
                const cached = promptBuilderDrawerCache.get(cacheKey);
                if (cached) return cached;
                const prompts = await load();
                const stablePrompts = Array.isArray(prompts) ? prompts : [];
                seedPromptModels(stablePrompts);
                promptBuilderDrawerCache.set(cacheKey, stablePrompts);
                return stablePrompts;
            }

            function queueLibraryDrawerRender(tabName = activeLibraryTab, delay = 60) {
                if (!tabName) return;
                if (queuedLibraryDrawerTimer) {
                    clearTimeout(queuedLibraryDrawerTimer);
                }
                queuedLibraryDrawerTimer = setTimeout(() => {
                    queuedLibraryDrawerTimer = null;
                    if (disposed) return;
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
                // Fetch through the raw API so a failed request rejects
                // instead of being cached as an empty list.
                cachedCategoriesPromise = promptApi.getCategories()
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
                showExportWorkspace: (onClose) => showExportWorkspace(onClose),
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

            async function showSettingsWorkspace() {
                const host = setWorkspaceMode("settings");
                if (!host) return;
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
                    getWorkflowProfileStatus: () => getWorkflowProfileStatus(node_instance),
                    operationFeedback,
                    workspaceContainer: host,
                    onClose: returnToGallery,
                });
            }

            widgetContainer.querySelector(`#${uniqueId}-settings-btn`)?.addEventListener("click", () => {
                toggleWorkspaceMode("settings", showSettingsWorkspace);
            });

            // Create hover preview outside the node container so it's not bounded
            const hoverPreview = document.createElement('div');
            hoverPreview.id = `${uniqueId}-hover-preview`;
            hoverPreview.className = 'localprompt-hover-preview';
            document.body.appendChild(hoverPreview);
            let toolbarOutsideClickHandler = null;
            let toolbarOutsidePointerDownHandler = null;
            let removeToolbarOutsidePointerDownHandler = null;
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
                    closeToolbarPanels();
                    closeDisplayOptionsPopover();
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

            globalListeners.listen(document, "pointerdown", globalPointerDownHandler, { capture: true });
            globalListeners.listen(document, "keydown", globalKeydownHandler);
            globalListeners.listen(window, "resize", globalResizeHandler);
            globalListeners.listen(window, "pointermove", onCategoryPointerMove);
            globalListeners.listen(window, "pointerup", onCategoryPointerUp);
            globalListeners.listen(window, "pointercancel", onCategoryPointerCancel);

            // Clean up on node removal
            const originalOnRemoved = this.onRemoved;
            this.onRemoved = function () {
                disposed = true;
                galleryController?.dispose?.();
                libraryDrawerRenderToken += 1;
                activeStackController?.dispose?.();
                UnifiedPromptGalleryNode.instances.delete(this);
                this.__localPromptWidgetRoot = null;
                const preview = document.getElementById(`${uniqueId}-hover-preview`);
                if (preview) preview.remove();
                if (toolbarOutsideClickHandler) {
                    document.removeEventListener("click", toolbarOutsideClickHandler);
                    toolbarOutsideClickHandler = null;
                }
                if (toolbarOutsidePointerDownHandler) {
                    removeToolbarOutsidePointerDownHandler();
                    toolbarOutsidePointerDownHandler = null;
                }
                if (queuedLibraryDrawerTimer) {
                    clearTimeout(queuedLibraryDrawerTimer);
                    queuedLibraryDrawerTimer = null;
                }
                if (selectionGraphChangeTimer) {
                    clearTimeout(selectionGraphChangeTimer);
                    selectionGraphChangeTimer = null;
                    app.graph?.change?.();
                }
                if (setupTimer) {
                    clearTimeout(setupTimer);
                    setupTimer = null;
                }
                displayPreferencesController?.dispose?.();
                bottomToolbarController?.dispose?.();
                widgetContainer.querySelector(`#${uniqueId}-library-chips`)?.__localpromptBuilderManualOrderCleanup?.();
                widgetContainer.querySelector(`#${uniqueId}-gallery`)?.__localpromptManualOrderCleanup?.();
                widgetContainer.querySelector(`#${uniqueId}-active-sidebar-content`)?.__localpromptActiveSidebarDragCleanup?.();
                workspaceController.dispose?.();
                categoryStripController?.dispose?.();
                metaTagsController.dispose?.();
                closePromptContextMenus();
                closePromptPreviews();
                globalListeners.cleanup();
                operationFeedback.dispose();
                closeCategoryContextMenu();
                if (originalOnRemoved) originalOnRemoved.call(this);
            };

            function saveSelectionData(options = {}) {
                const data = writeSelectionArray(node_instance.promptData);
                node_instance.properties["prompt_selection_data"] = data;
                selectionWidget.value = data;
                syncActivePromptCounts();
                node_instance.setDirtyCanvas?.(true, options.redrawCanvas !== false);
                if (!app.graph) return;
                if (options.coalesceGraphChange) {
                    if (selectionGraphChangeTimer) clearTimeout(selectionGraphChangeTimer);
                    selectionGraphChangeTimer = setTimeout(() => {
                        selectionGraphChangeTimer = null;
                        app.graph?.change?.();
                    }, 100);
                    return;
                }
                if (selectionGraphChangeTimer) {
                    clearTimeout(selectionGraphChangeTimer);
                    selectionGraphChangeTimer = null;
                }
                app.graph.change();
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
                    const moreBtn = widgetContainer.querySelector(`#${uniqueId}-category-more-btn`);
                    if (moreBtn) {
                        moreBtn.setAttribute("aria-expanded", "false");
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
                        setActiveSidebarHoverOpen(false);
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

            let categoryStripController = null;
            async function openCategoryFromMenu(category) {
                return categoryStripController?.openCategoryFromMenu?.(category);
            }
            async function renderPinnedCategoryStrip() {
                return categoryStripController?.renderPinnedCategoryStrip?.();
            }
            async function renderCategoryOverflowCategories() {
                return categoryStripController?.renderCategoryOverflowCategories?.();
            }
            async function renderCategoryDropdownOptions() {
                return categoryStripController?.renderCategoryDropdownOptions?.();
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
                    statusEl.textContent = `${prefix}${label} `;
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

            function saveWildcardAutoAttachState(enabled) {
                const value = enabled ? "on" : "off";
                node_instance.properties["wildcard_auto_attach_thumbnail"] = value;
                if (wildcardAutoAttachThumbnailWidget) {
                    wildcardAutoAttachThumbnailWidget.value = value;
                }
                node_instance.setDirtyCanvas?.(true, true);
                if (app.graph) app.graph.change();
            }

            saveWildcardState();
            saveWildcardRngState();
            saveWildcardAutoAttachState(
                String(node_instance.properties?.wildcard_auto_attach_thumbnail || wildcardAutoAttachThumbnailWidget?.value || "off").toLowerCase() === "on"
            );

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

            let displayPreferencesController = null;
            function getThumbnailSizePx() { return displayPreferencesController?.getThumbnailSizePx?.(); }
            function getActiveThumbnailSizePx() { return displayPreferencesController?.getActiveThumbnailSizePx?.(); }
            function getActiveDisplayMode() { return displayPreferencesController?.getActiveDisplayMode?.(); }
            function getCardsDisplayMode() { return displayPreferencesController?.getCardsDisplayMode?.(); }
            function syncThumbnailSizeSliders() { return displayPreferencesController?.syncThumbnailSizeSliders?.(); }
            function syncDisplayOptionAvailability() { return displayPreferencesController?.syncDisplayOptionAvailability?.(); }

            function applyThumbnailSizePreference(sizePx) { return displayPreferencesController?.applyThumbnailSizePreference?.(sizePx); }
            function applyActiveThumbnailSizePreference(sizePx) { return displayPreferencesController?.applyActiveThumbnailSizePreference?.(sizePx); }
            function applyActiveBorderThemePreference() { return displayPreferencesController?.applyActiveBorderThemePreference?.(); }
            function applyCardContrastModePreference() { return displayPreferencesController?.applyCardContrastModePreference?.(); }
            function queueThumbnailSizeSave() { return displayPreferencesController?.queueThumbnailSizeSave?.(); }
            function setupThumbnailSizeSliders() { return displayPreferencesController?.setupThumbnailSizeSliders?.(); }

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

            function normalizeVisiblePinnedCategoryCount(value) {
                const count = Number(value);
                if (!Number.isFinite(count)) return VISIBLE_PINNED_CATEGORY_COUNT_DEFAULT;
                return Math.min(
                    VISIBLE_PINNED_CATEGORY_COUNT_MAX,
                    Math.max(VISIBLE_PINNED_CATEGORY_COUNT_MIN, Math.round(count)),
                );
            }

            function getVisiblePinnedCategoryCount() {
                return normalizeVisiblePinnedCategoryCount(node_instance.uiPrefs?.visible_pinned_category_count);
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
                let allCategories;
                try {
                    allCategories = await getCachedCategories();
                } catch (error) {
                    // A failed category fetch must not rewrite the pin set
                    // against an unknown list.
                    console.error("LocalPromptGallery: category fetch failed while saving pins:", error);
                    return;
                }
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

            categoryStripController = createPromptCategoryStripController({
                widgetContainer,
                uniqueId,
                getCachedCategories,
                ensurePinnedCategoriesInitialized,
                getVisiblePinnedCategoryCount,
                getCategoriesInCurrentOrder,
                getActiveLibraryTab: () => activeLibraryTab,
                setActiveLibraryTab: value => { activeLibraryTab = value; },
                getCategoryOverflowOpen: () => categoryOverflowOpen,
                setCategoryOverflowOpen: value => { categoryOverflowOpen = !!value; },
                getSuppressCategoryClickUntil: () => suppressCategoryClickUntil,
                setSuppressCategoryClickUntil: value => { suppressCategoryClickUntil = value; },
                setCategoryDragState: value => { categoryDragState = value; },
                applyLibraryTabRoleStyling,
                showCategoryPillContextMenu,
                setWorkspaceMode,
                getWorkspaceMode,
                renderLibraryDrawer,
                clearLibraryNavActiveState,
                syncPromptSortControls,
                syncSelectedSectionVisibility,
                closeToolbarPanels,
                getCategoryOverflowGrouping: () => node_instance.uiPrefs?.category_overflow_grouping || "alpha",
                setCategoryOverflowGrouping: async (mode) => {
                    if (!node_instance.uiPrefs) node_instance.uiPrefs = {};
                    node_instance.uiPrefs.category_overflow_grouping = mode;
                    await saveUiPrefs();
                },
                getCategoryRoleColor,
            });

            let activeStackController = null;
            function isActiveSidebarOpen() { return activeStackController?.isOpen?.() ?? false; }
            function applyActiveSidebarPreference() { return activeStackController?.applyPreference?.(); }
            async function toggleActiveSidebarPeek() { return activeStackController?.togglePeek?.(); }
            function closeActiveSidebarForWorkspaceMode() { return activeStackController?.closeForWorkspaceMode?.(); }
            async function setActiveSidebarHoverOpen(nextOpen) { return activeStackController?.setHoverOpen?.(nextOpen); }
            function clearActiveSidebarCloseTimer() { return activeStackController?.clearCloseTimer?.(); }
            function clearActiveSidebarOpenTimer() { return activeStackController?.clearOpenTimer?.(); }
            function scheduleActiveSidebarHoverOpen() { return activeStackController?.scheduleHoverOpen?.(); }
            function scheduleActiveSidebarHoverClose() { return activeStackController?.scheduleHoverClose?.(); }

            async function saveUiPrefs() {
                node_instance.uiPrefs.library_tabs = getLibraryTabs();
                await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs, node_instance);
            }
            node_instance.persistPromptUiPrefs = async prefs => {
                node_instance.uiPrefs = mergeUiPrefs(node_instance.uiPrefs, prefs);
                writeWorkflowProfileSection(node_instance, "prompt_ui", node_instance.uiPrefs);
                return { status: "ok", scope: "workflow" };
            };

            activeStackController = createActiveStackController({
                widgetContainer,
                uniqueId,
                nodeInstance: node_instance,
                activeSidebarWidthWidget,
                saveUiPrefs,
                disposed: () => disposed,
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
            });

            displayPreferencesController = createDisplayPreferencesController({
                widgetContainer,
                uniqueId,
                nodeInstance: node_instance,
                activeLibraryTab: () => activeLibraryTab,
                renderLibraryDrawer,
                renderGallery,
                renderActiveSidebar,
                saveUiPrefs,
                bindMainSortSelect,
            });

            // The visible pinned category count lives in the Display Options
            // popover, mirroring the LoRA tab's "FOLDERS:" knob: same row
            // layout, same live count in the section title, same auto-pin while
            // the knob grows. The gear dialog curates which categories count.
            let visiblePinnedCategorySaveTimer = null;

            function queueVisiblePinnedCategorySave() {
                clearTimeout(visiblePinnedCategorySaveTimer);
                visiblePinnedCategorySaveTimer = setTimeout(() => {
                    visiblePinnedCategorySaveTimer = null;
                    Promise.resolve(saveUiPrefs()).catch(() => {});
                }, 250);
            }

            function syncVisiblePinnedCategoryCountControl() {
                const slider = widgetContainer.querySelector(`#${uniqueId}-display-visible-categories-slider`);
                const countVal = widgetContainer.querySelector(`#${uniqueId}-display-categories-count-val`);
                const count = getVisiblePinnedCategoryCount();
                if (slider) slider.value = String(count);
                if (countVal) countVal.textContent = String(count);
            }

            function setupVisiblePinnedCategoryCountControl() {
                const slider = widgetContainer.querySelector(`#${uniqueId}-display-visible-categories-slider`);
                if (!slider) return;
                // Serialize slider updates: rapid input events must not
                // interleave their category fetches and saves, or the strip
                // can end up with fewer pills than the knob claims.
                let pinnedCountUpdate = Promise.resolve();
                async function applyVisiblePinnedCategoryCount(nextCount) {
                    const previousCount = getVisiblePinnedCategoryCount();
                    if (nextCount > previousCount) {
                        // Widen the strip first: pull the next discovered categories into
                        // the pinned set so the knob never shows fewer pills than it could.
                        const allCategories = await getCachedCategories();
                        const pinned = new Set(getPinnedCategories(allCategories));
                        for (const category of getCategoriesInCurrentOrder(allCategories)) {
                            if (pinned.size >= nextCount) break;
                            pinned.add(category);
                        }
                        await savePinnedCategories([...pinned]);
                        await renderCategoryOverflowCategories();
                        return;
                    }
                    await renderPinnedCategoryStrip();
                    await renderCategoryOverflowCategories();
                    queueVisiblePinnedCategorySave();
                }
                slider.addEventListener("input", () => {
                    const nextCount = normalizeVisiblePinnedCategoryCount(slider.value);
                    node_instance.uiPrefs.visible_pinned_category_count = nextCount;
                    slider.value = String(nextCount);
                    const countVal = widgetContainer.querySelector(`#${uniqueId}-display-categories-count-val`);
                    if (countVal) countVal.textContent = String(nextCount);
                    pinnedCountUpdate = pinnedCountUpdate
                        .then(() => applyVisiblePinnedCategoryCount(nextCount))
                        .catch(() => {});
                });
                syncVisiblePinnedCategoryCountControl();
            }

            setupVisiblePinnedCategoryCountControl();

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
                await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs, node_instance);
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
                    if (scope.trim()) return `category:${scope.trim()}`;
                }

                if (activeLibraryTab === "pinned") return "favorites";
                if (activeLibraryTab) return `category:${activeLibraryTab}`;

                const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);
                const selectedCategory = categorySelect?.value || "";
                if (selectedCategory) return `category:${selectedCategory}`;
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
                    mainSortSelect.value = getPromptSortMode(activeLibraryTab);
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
                select.value = getPromptSortMode(activeLibraryTab);
                if (select.dataset.sortBound === "1") return;
                const handleSortChange = async (event) => {
                    event.stopPropagation();
                    await setPromptSortMode(event.target.value);
                };
                select.addEventListener("change", handleSortChange);
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
                const refreshTasks = [];
                if (activeLibraryTab) {
                    refreshTasks.push(renderLibraryDrawer(activeLibraryTab));
                } else if (options.reload !== false && document.getElementById(`${uniqueId}-gallery`)) {
                    refreshTasks.push(loadPromptsForGallery(1));
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
                const promptIds = node_instance.promptData.map(entry => String(entry.prompt_id));
                const unresolvedIds = [...new Set(promptIds.filter(id => !promptModelCache.has(id)))];
                if (unresolvedIds.length) {
                    const requestKey = unresolvedIds.slice().sort().join("|");
                    let request = promptModelRequests.get(requestKey);
                    if (!request) {
                        request = UnifiedPromptGalleryNode.getPromptsByIds(unresolvedIds)
                            .then(prompts => {
                                seedPromptModels(prompts);
                                return prompts;
                            })
                            .finally(() => promptModelRequests.delete(requestKey));
                        promptModelRequests.set(requestKey, request);
                    }
                    await request;
                }
                return node_instance.promptData.map(entry => {
                    const fullPrompt = promptModelCache.get(String(entry.prompt_id));
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
                    let categories;
                    try {
                        categories = await getCachedCategories();
                    } catch (error) {
                        console.error("LocalPromptGallery: Error fetching categories:", error);
                        showAlert("No categories available to add.");
                        return;
                    }
                    if (!categories || categories.length === 0) {
                        showAlert("No categories available to add.");
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
                                await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs, node_instance);
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
                if (count === 0 && isActiveSidebarOpen()) {
                    clearActiveSidebarOpenTimer();
                    setActiveSidebarHoverOpen(false);
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

            function isAutoHideToolbarsEnabled() {
                return node_instance.uiPrefs?.auto_hide_toolbars === true;
            }
            let bottomToolbarController = null;
            function syncAutoHideToolbarState() {
                return bottomToolbarController?.sync?.();
            }
            function scheduleToolbarHide() {
                return bottomToolbarController?.scheduleHide?.();
            }
            function setupAutoHideToolbarBehavior() {
                if (!bottomToolbarController) {
                    bottomToolbarController = createBottomToolbarController({
                        widgetContainer,
                        uniqueId,
                        isAutoHideEnabled: isAutoHideToolbarsEnabled,
                    });
                }
                bottomToolbarController.setup();
            }
            setupAutoHideToolbarBehavior();

            function updateWildcardControlsUI() {
                const wildcardToggleBtn = widgetContainer.querySelector(`#${uniqueId}-wildcard-toggle-btn`);
                const wildcardControls = widgetContainer.querySelector(`#${uniqueId}-wildcard-controls`);
                const wildcardRngSelect = widgetContainer.querySelector(`#${uniqueId}-wildcard-rng-select`);
                const wildcardShuffleBtn = widgetContainer.querySelector(`#${uniqueId}-wildcard-shuffle-btn`);
                const wildcardAutoAttachCheckbox = widgetContainer.querySelector(`#${uniqueId}-wildcard-auto-attach`);
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
                if (wildcardAutoAttachCheckbox) {
                    wildcardAutoAttachCheckbox.checked = String(
                        node_instance.properties?.wildcard_auto_attach_thumbnail
                        || wildcardAutoAttachThumbnailWidget?.value
                        || "off"
                    ).toLowerCase() === "on";
                }
                updateConfigBarVisibility();
            }
            async function renderActiveSidebar() {
                return activeStackController?.render?.();
            }

            async function renderLibraryBar() {
                if (disposed) return;
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
                        await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs, node_instance);
                    },
                    applyLibraryTabLayoutPreference,
                    applyLibraryTabRoleStyling,
                    clearLibraryNavActiveState,
                    renderLibraryDrawer,
                    syncSelectedSectionVisibility,
                    rerenderLibraryBar: renderLibraryBar,
                    uiPrefs: node_instance.uiPrefs,
                });
                if (disposed) return;
                const favBtn = widgetContainer.querySelector(`#${uniqueId}-fav-toggle-btn`);
                if (favBtn) {
                    favBtn.classList.toggle("active", activeLibraryTab === "pinned");
                }
                widgetContainer
                    .querySelectorAll(`#${uniqueId}-library-tabs .localprompt-library-tab, #${uniqueId}-utility-tabs .localprompt-library-tab, #${uniqueId}-fav-toggle-btn`)
                    .forEach(button => {
                        if (libraryGalleryGuardButtons.has(button)) return;
                        libraryGalleryGuardButtons.add(button);
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
                if (disposed) return;
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
                    getCachedPrompts: getCachedPromptBuilderPrompts,
                    onPromptsLoaded: seedPromptModels,
                    invalidatePrompts: invalidatePromptModelCache,
                    isRenderCurrent: () => renderToken === libraryDrawerRenderToken && activeLibraryTab === tabName,
                });
            }

            // Helper to attach info popup to element
            function attachInfoPopup(element, prompt, options = {}) {
                attachPromptInfoPopup({
                    element,
                    prompt,
                    uniqueId,
                    showHoverPreview,
                    hideHoverPreview,
                    getSurfaceHost: options.getSurfaceHost,
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
                invalidatePromptModelCache();
                if (activeLibraryTab) await renderLibraryDrawer(activeLibraryTab);
                renderPrompts();
            }

            node_instance.__localGalleryRefresh = refreshAllSections;

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
                    saveSelectionData({ redrawCanvas: false, coalesceGraphChange: true });
                }
                const cached = promptModelCache.get(key);
                if (cached) {
                    seedPromptModels([{ ...cached, ...nextData, id: promptId }]);
                } else {
                    invalidatePromptModelCache([promptId]);
                }
                promptBuilderDrawerCache.clear();
            }

            // Context menu function (global)
            function showContextMenu(prompt, x, y, customRefresh = null, options = {}) {
                const refresh = customRefresh || refreshAllSections;
                openPromptActionContextMenu({
                    prompt,
                    x,
                    y,
                    surfaceHost: options.surfaceHost || null,
                    hasLastOutput: !!UnifiedPromptGalleryNode.lastOutput,
                    actions: {
                        edit: async (selectedPrompt) => {
                            try {
                                const editablePrompt = await ensurePromptExistsForEdit(selectedPrompt);
                                showEditPromptDialog(editablePrompt, refresh);
                            } catch (e) {
                                showAlert('Error preparing prompt for edit: ' + e.message);
                            }
                        },
                        thumbnail: async (selectedPrompt) => {
                            showUploadThumbnailDialog(selectedPrompt, refresh);
                        },
                        favorite: async (selectedPrompt) => {
                            operationFeedback.pending('Updating favorite...');
                            let result;
                            try {
                                result = await UnifiedPromptGalleryNode.toggleFavorite(selectedPrompt.id);
                                if (!result || result.status !== 'ok') {
                                    throw new Error(result?.message || 'Could not update favorite');
                                }
                            } catch (error) {
                                operationFeedback.error(error?.message || 'Could not update favorite');
                                return;
                            }
                            try {
                                await syncPinnedOrderForFavorite(selectedPrompt.id, result.favorite);
                                await refresh();
                                operationFeedback.success(result.favorite ? 'Prompt added to favorites' : 'Prompt removed from favorites');
                            } catch (error) {
                                operationFeedback.warning('Favorite updated. View or pinned order refresh failed.', {
                                    action: refresh,
                                    actionLabel: 'Retry',
                                });
                            }
                        },
                        use_last_output: async (selectedPrompt) => {
                            if (UnifiedPromptGalleryNode.lastOutput) {
                                operationFeedback.pending('Saving thumbnail...');
                                try {
                                    const result = await UnifiedPromptGalleryNode.assignThumbnail(selectedPrompt.id, UnifiedPromptGalleryNode.lastOutput);
                                    if (!result || result.status !== 'ok') {
                                        throw new Error(result?.message || 'Could not save thumbnail');
                                    }
                                    operationFeedback.success('Thumbnail saved to gallery');
                                } catch (error) {
                                    operationFeedback.error(error?.message || 'Could not save thumbnail');
                                    showAlert('Error: ' + (error?.message || 'Could not save thumbnail'));
                                    return;
                                }
                                try {
                                    await refresh();
                                } catch (error) {
                                    operationFeedback.warning('Thumbnail saved. View refresh failed.', {
                                        action: refresh,
                                        actionLabel: 'Retry',
                                    });
                                }
                            }
                        },
                        delete: async (selectedPrompt) => {
                            if (confirmAction(`Delete prompt "${selectedPrompt.name}"?`)) {
                                operationFeedback.pending('Deleting prompt...');
                                try {
                                    const result = await UnifiedPromptGalleryNode.deletePrompt(selectedPrompt.id);
                                    if (!result || result.status !== 'ok') {
                                        throw new Error(result?.message || 'Could not delete prompt');
                                    }
                                } catch (error) {
                                    operationFeedback.error(error?.message || 'Could not delete prompt');
                                    return;
                                }
                                const idx = node_instance.promptData.findIndex(p => p.prompt_id === selectedPrompt.id);
                                if (idx >= 0) {
                                    node_instance.promptData.splice(idx, 1);
                                    saveSelectionData();
                                }
                                operationFeedback.success('Prompt deleted');
                                try {
                                    await refresh();
                                } catch (error) {
                                    operationFeedback.warning('Prompt deleted. View refresh failed.', {
                                        action: refresh,
                                        actionLabel: 'Retry',
                                    });
                                }
                            }
                        },
                    },
                });
            }

            // Helper to add/remove prompt from selection
            function addPromptToSelection(prompt) {
                seedPromptModels([prompt]);
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

            let galleryController = null;
            function renderGallery() { return galleryController?.renderGallery?.(); }
            async function loadCategories() { return galleryController?.loadCategories?.(); }
            async function loadPromptsForGallery(page = 1) {
                return galleryController?.loadPromptsForGallery?.(page);
            }
            function promptMatchesCurrentGallery(prompt) {
                return galleryController?.promptMatchesCurrentGallery?.(prompt) ?? false;
            }
            function insertPromptIntoCurrentGallery(prompt) {
                return galleryController?.insertPromptIntoCurrentGallery?.(prompt) ?? false;
            }

            async function renameCategoryWithPrompt(oldCategory, onSuccess) {
                const sourceCategory = String(oldCategory || '').trim();
                if (!sourceCategory) {
                    showAlert('No category selected to rename.');
                    return false;
                }

                const requestedName = prompt(`Rename category "${sourceCategory}" to:`, sourceCategory);
                if (requestedName === null) return false;

                const targetCategory = requestedName.trim();
                if (!targetCategory) {
                    showAlert('Please enter a category name.');
                    return false;
                }
                if (targetCategory === sourceCategory) {
                    return false;
                }

                const confirmed = confirmAction(
                    `Rename "${sourceCategory}" to "${targetCategory}" and move every prompt in that category?`
                );
                if (!confirmed) return false;

                operationFeedback.pending(`Renaming category "${sourceCategory}"...`);
                let result;
                try {
                    result = await UnifiedPromptGalleryNode.renameCategory(sourceCategory, targetCategory);
                    if (!result || result.status !== 'ok') {
                        throw new Error(result?.message || 'Failed to rename category');
                    }
                } catch (error) {
                    operationFeedback.error(error?.message || 'Failed to rename category');
                    showAlert('Error: ' + (error?.message || 'Failed to rename category'));
                    return false;
                }

                try {
                    if (typeof onSuccess === 'function') {
                        await onSuccess(targetCategory, result);
                    }
                    operationFeedback.success(`Category renamed to "${targetCategory}"`);
                } catch (error) {
                    operationFeedback.warning(`Category renamed to "${targetCategory}". View refresh failed.`);
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

            galleryController = createPromptGalleryController({
                widgetContainer,
                uniqueId,
                nodeInstance: node_instance,
                galleryNode: UnifiedPromptGalleryNode,
                getCategories: options => getCachedCategories(options),
                invalidateCategoryCache,
                renderCategoryDropdownOptions,
                renderPinnedCategoryStrip,
                syncPinnedOrderForFavorite,
                attachInfoPopup,
                showPromptContextMenu,
                saveSelectionData,
                renderPrompts,
                getPromptSortMode,
                setPromptSortMode,
                getPromptSortScope,
                persistPromptManualOrder,
                applyPromptManualOrderLocally,
                getActivePromptModels,
                onPromptsLoaded: seedPromptModels,
                disposed: () => disposed,
            });

            const workspaceActions = createPromptWorkspaceActions({
                app,
                nodeInstance: node_instance,
                galleryNode: UnifiedPromptGalleryNode,
                uniqueId,
                categoriesWidget,
                wildcardAutoAttachThumbnailWidget,
                getCurrentWildcardMode: () => currentWildcardMode,
                setCurrentWildcardMode: mode => { currentWildcardMode = mode; },
                getWildcardAutoAttachThumbnail: () => String(
                    node_instance.properties?.wildcard_auto_attach_thumbnail
                    || wildcardAutoAttachThumbnailWidget?.value
                    || "off"
                ).toLowerCase() === "on",
                saveSelectionData,
                saveWildcardState,
                saveWildcardAutoAttachState,
                updateWildcardControlsUI,
                renderPrompts,
                getActiveLibraryTab: () => activeLibraryTab,
                renderLibraryDrawer,
                loadCategories,
                loadPromptsForGallery,
                getPromptSourceNode,
                insertPromptIntoCurrentGallery,
                updateLocalPromptAfterMetadataSave,
                refreshAllSections,
                addPromptToSelection,
                syncPinnedOrderForFavorite,
                attachInfoPopup,
                showContextMenu,
                renameCategoryWithPrompt,
                getCategoryRoleColor,
                getPromptSortMode,
                setPromptSortMode,
                getPromptManualOrder,
                persistPromptManualOrder,
                setWorkspaceMode,
                returnToGallery,
                renderLibraryShell,
                getLibrarySubnavHtml,
                onPromptsLoaded: seedPromptModels,
                operationFeedback,
            });
            const {
                showEditPromptDialog,
                showFromLastOutputDialog,
                showFromLastOutputWorkspace,
                showAddPromptDialog,
                showAddPromptWorkspace,
                showImportDialog,
                showImportWorkspace,
                showExportDialog,
                showExportWorkspace,
                showPresetsWorkspace,
                showPresetsModal,
                showBrowseWorkspace,
                showCardManagerModal,
                showUploadThumbnailDialog,
                deletePromptWithConfirm,
            } = workspaceActions;

            // Bind the persistent bottom navigation as soon as the template and
            // workspace controller exist. These controls should remain usable even
            // if a later, optional gallery setup step fails or is still loading.
            widgetContainer.querySelector(`#${uniqueId}-library-btn`)?.addEventListener("click", async () => {
                try {
                    await toggleWorkspaceMode("library_cards", renderLibraryWorkspace);
                } catch (e) {
                    console.error("Error opening Prompt Library:", e);
                    showAlert("Error opening Prompt Library: " + e.message);
                }
            });

            const addPromptBtn = widgetContainer.querySelector(`#${uniqueId}-add-prompt-btn`) ||
                widgetContainer.querySelector(`#${uniqueId}-from-last-output-btn`);
            addPromptBtn?.addEventListener("click", async () => {
                try {
                    await toggleWorkspaceMode("add_prompt", showAddPromptWorkspace);
                } catch (e) {
                    console.error("Error in showAddPromptWorkspace:", e);
                    showAlert("Error opening dialog: " + e.message);
                }
            });

            widgetContainer.querySelector(`#${uniqueId}-import-btn`)?.addEventListener("click", async () => {
                try {
                    await toggleWorkspaceMode("library_import", showImportWorkspace);
                } catch (e) {
                    console.error("Error showing import dialog:", e);
                    showAlert(e.message);
                }
            });

            setupTimer = setTimeout(() => {
                setupTimer = null;
                if (disposed) return;
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
                            showAlert('Please select a category to delete.');
                            return;
                        }
                        
                        // Show confirmation dialog
                        const confirmed = confirmAction(
                            `DELETE ENTIRE CATEGORY\n\n` +
                            `Are you sure you want to delete the category "${categoryToDelete}" and ALL prompts within it?\n\n` +
                            `This action cannot be undone!`
                        );
                        
                        if (!confirmed) return;
                        
                        // Second confirmation for safety
                        const doubleConfirmed = confirmAction(
                            `Final confirmation:\n\n` +
                            `Delete ALL prompts in "${categoryToDelete}"?`
                        );
                        
                        if (!doubleConfirmed) return;
                        
                        operationFeedback.pending(`Deleting category "${categoryToDelete}"...`);
                        try {
                            const result = await UnifiedPromptGalleryNode.deleteCategory(categoryToDelete);
                            if (result.status === 'ok') {
                                categorySelect.value = ''; // Reset to "All Categories"
                                deleteCategoryBtn.style.display = 'none';
                                operationFeedback.success(`Category "${categoryToDelete}" deleted`);
                                try {
                                    await loadCategories();
                                    await loadPromptsForGallery(1);
                                } catch (error) {
                                    operationFeedback.warning(`Category "${categoryToDelete}" deleted. View refresh failed.`);
                                }
                            } else {
                                operationFeedback.error(result.message || 'Failed to delete category');
                                showAlert('Error: ' + (result.message || 'Failed to delete category'));
                            }
                        } catch (e) {
                            console.error('Error deleting category:', e);
                            operationFeedback.error(e?.message || 'Failed to delete category');
                            showAlert('Error deleting category: ' + e.message);
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
                const wildcardAutoAttachCheckbox = widgetContainer.querySelector(`#${uniqueId}-wildcard-auto-attach`);
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
                if (wildcardAutoAttachCheckbox) {
                    wildcardAutoAttachCheckbox.addEventListener('change', (event) => {
                        saveWildcardAutoAttachState(event.target.checked);
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
                        onExportCategory: showExportDialog,
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
                    // Existing workflows without an embedded profile inherit the
                    // former global preferences once. From then on this workflow's
                    // node owns an independent snapshot.
                    const globalPrefs = await UnifiedPromptGalleryNode.getUiPrefs();
                    const workflowPrefs = readWorkflowProfileSection(node_instance, "prompt_ui");
                    node_instance.uiPrefs = mergeUiPrefs(
                        node_instance.uiPrefs,
                        globalPrefs
                    );
                    if (workflowPrefs) {
                        node_instance.uiPrefs = mergeUiPrefs(node_instance.uiPrefs, workflowPrefs);
                    }
                    node_instance.uiPrefs.active_sidebar_open = false;
                    node_instance.uiPrefs.active_display_mode = getActiveDisplayMode();
                    node_instance.uiPrefs.cards_display_mode = getCardsDisplayMode();
                    if (typeof node_instance.properties?.active_sidebar_width === 'number') {
                        node_instance.uiPrefs.active_sidebar_width = node_instance.properties.active_sidebar_width;
                    }
                    node_instance.uiPrefs.library_tabs = getLibraryTabs();
                    writeWorkflowProfileSection(node_instance, "prompt_ui", node_instance.uiPrefs);
                    if (activeLibraryTab === 'active') {
                        activeLibraryTab = null;
                    }
                    applyThumbnailSizePreference();
                    applyActiveThumbnailSizePreference();
                    setupThumbnailSizeSliders();
                    syncVisiblePinnedCategoryCountControl();
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

                const moreBtn = widgetContainer.querySelector(`#${uniqueId}-category-more-btn`);
                if (moreBtn) {
                    moreBtn.addEventListener("click", async (event) => {
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
                            const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);
                            if (categorySelect) categorySelect.value = "";
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

                const isInsideToolbarOrPopover = (event) => {
                    const target = event?.target;
                    if (target instanceof Node) {
                        if (
                            target.closest?.(`#${uniqueId}-category-overflow`)
                            || target.closest?.(`#${uniqueId}-category-more-btn`)
                            || target.closest?.(`#${uniqueId}-meta-tags-panel`)
                            || target.closest?.(`#${uniqueId}-meta-tags-btn`)
                            || target.closest?.(`#${uniqueId}-size-controls`)
                            || target.closest?.(`#${uniqueId}-size-toggle-btn`)
                            || target.closest?.(".localprompt-dropdown-panel")
                            || target.closest?.(".localprompt-display-options-popover")
                            || target.closest?.(".localprompt-category-ctx-menu")
                        ) {
                            return true;
                        }
                    }
                    const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
                    for (const el of path) {
                        if (el instanceof Element) {
                            if (
                                el.id === `${uniqueId}-category-overflow`
                                || el.id === `${uniqueId}-category-more-btn`
                                || el.id === `${uniqueId}-meta-tags-panel`
                                || el.id === `${uniqueId}-meta-tags-btn`
                                || el.id === `${uniqueId}-size-controls`
                                || el.id === `${uniqueId}-size-toggle-btn`
                                || el.classList?.contains("localprompt-dropdown-panel")
                                || el.classList?.contains("localprompt-display-options-popover")
                                || el.classList?.contains("localprompt-category-ctx-menu")
                            ) {
                                return true;
                            }
                        }
                    }
                    return false;
                };

                toolbarOutsideClickHandler = (event) => {
                    if (isInsideToolbarOrPopover(event)) return;
                    closeToolbarPanels();
                    closeDisplayOptionsPopover();
                };
                document.addEventListener("click", toolbarOutsideClickHandler);

                toolbarOutsidePointerDownHandler = (event) => {
                    if (isInsideToolbarOrPopover(event)) return;
                    closeToolbarPanels();
                    closeDisplayOptionsPopover();
                };
                document.addEventListener("pointerdown", toolbarOutsidePointerDownHandler, { capture: true });

                removeToolbarOutsidePointerDownHandler = () => {
                    document.removeEventListener("pointerdown", toolbarOutsidePointerDownHandler, true);
                };


                bindAddMetaTagButton();

                widgetContainer.querySelector(`#${uniqueId}-manage-categories-btn`)?.addEventListener("click", async () => {
                    closeToolbarPanels();
                    await showSettingsWorkspace();
                });

                widgetContainer.querySelector(`#${uniqueId}-size-toggle-btn`)?.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    // Retract active sidebar on toolbar interaction (focus change)
                    if (isActiveSidebarOpen()) {
                        clearActiveSidebarOpenTimer();
                        clearActiveSidebarCloseTimer();
                        setActiveSidebarHoverOpen(false);
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
                    syncVisiblePinnedCategoryCountControl();
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
                    // Card removal can synchronously rerender and detach e.target
                    // before this delegated handler runs. The event path retains
                    // the original ancestry through that DOM update.
                    const eventPath = typeof e.composedPath === "function" ? e.composedPath() : [];
                    const clickedInsideSidebar = eventPath.includes(activeSidebarEl) || activeSidebarEl?.contains(e.target);
                    const clickedInsideToggle = eventPath.includes(activeSideTab) || activeSideTab?.contains(e.target);
                    if (!clickedInsideSidebar && !clickedInsideToggle) {
                        clearActiveSidebarOpenTimer();
                        clearActiveSidebarCloseTimer();
                        setActiveSidebarHoverOpen(false);
                    }
                });

                widgetContainer.querySelector(`#${uniqueId}-active-clear-btn`)?.addEventListener('click', () => {
                    if (node_instance.promptData.length > 0 && confirmAction("Remove all prompts from selection?")) {
                        clearAllSelections();
                    }
                });

                // Seed input and inc/dec listeners are already bound in the main seed controls block above.

                // Control after generate dropdown listener is already bound in the main seed controls block above.

            }, 100);

            return result;
        };
    }
};

return {
    async setup() {
        // Global execution listener to track outputs from ANY node
        api.addEventListener("executed", (event) => {
            const detail = event.detail || {};
            const output = detail.output || {};
            const promptId = detail.prompt_id == null ? "" : String(detail.prompt_id);
            const wildcardPromptIds = Array.isArray(output.wildcard_prompt_ids)
                ? [...new Set(output.wildcard_prompt_ids.map(id => String(id || "")).filter(Boolean))]
                : [];

            // The gallery node runs before image-saving nodes. Keep its wildcard
            // picks keyed by prompt_id until the matching execution completes.
            if (promptId && wildcardPromptIds.length > 0) {
                UnifiedPromptGalleryNode.pendingWildcardAutoAttach.set(promptId, {
                    promptIds: wildcardPromptIds,
                    lastOutput: UnifiedPromptGalleryNode.recentOutputsByPromptId.get(promptId) || null,
                });
            }

            let lastOutput = null;
            let isImageOutput = false;
            if (output.images && output.images.length > 0) {
                const last = output.images[output.images.length - 1];
                isImageOutput = true;
                lastOutput = {
                    filename: last.filename,
                    subfolder: last.subfolder || '',
                    type: last.type || 'output'
                };
            } else if (output.gifs && output.gifs.length > 0) {
                const last = output.gifs[output.gifs.length - 1];
                lastOutput = {
                    filename: last.filename,
                    subfolder: last.subfolder || '',
                    type: last.type || 'output'
                };
            }

            if (lastOutput?.filename) {
                UnifiedPromptGalleryNode.lastOutput = lastOutput;
                if (promptId && isImageOutput) {
                    UnifiedPromptGalleryNode.recentOutputsByPromptId.set(promptId, lastOutput);
                    const pending = UnifiedPromptGalleryNode.pendingWildcardAutoAttach.get(promptId);
                    if (pending) pending.lastOutput = lastOutput;
                }
            }
        });

        api.addEventListener("execution_start", () => {
            UnifiedPromptGalleryNode.isExecuting = true;
            // Abort any idle flush timer so we never hit disk mid-sampling.
            UnifiedPromptGalleryNode.cancelDeferredAutoAttachFlush();
            // Stop continuous browser GPU work (zip borders, blur, video) that
            // steals cycles from the sampler until the page is hard-refreshed.
            UnifiedPromptGalleryNode.setSamplingQuietMode(true);
        });

        api.addEventListener("execution_success", ({ detail }) => {
            UnifiedPromptGalleryNode.isExecuting = false;
            if (UnifiedPromptGalleryNode.isComfyIdle()) {
                UnifiedPromptGalleryNode.setSamplingQuietMode(false);
            }

            const promptId = detail?.prompt_id == null ? "" : String(detail.prompt_id);
            if (!promptId) return;

            const pending = UnifiedPromptGalleryNode.pendingWildcardAutoAttach.get(promptId);
            const lastOutput = pending?.lastOutput || UnifiedPromptGalleryNode.recentOutputsByPromptId.get(promptId);
            UnifiedPromptGalleryNode.pendingWildcardAutoAttach.delete(promptId);
            UnifiedPromptGalleryNode.recentOutputsByPromptId.delete(promptId);

            if (!pending?.promptIds?.length || !lastOutput?.filename) return;

            // Queue only; flush happens only when Comfy is fully idle.
            UnifiedPromptGalleryNode.queueDeferredAutoAttach(pending.promptIds, lastOutput);
        });

        api.addEventListener("status", ({ detail }) => {
            const remaining = detail?.exec_info?.queue_remaining;
            if (typeof remaining === "number" && Number.isFinite(remaining)) {
                UnifiedPromptGalleryNode.queueRemaining = remaining;
            }
            // queue_remaining can be 0 while the current job is still sampling —
            // isComfyIdle() also requires !isExecuting.
            if (UnifiedPromptGalleryNode.isComfyIdle()) {
                UnifiedPromptGalleryNode.setSamplingQuietMode(false);
            } else if (UnifiedPromptGalleryNode.isExecuting || Number(UnifiedPromptGalleryNode.queueRemaining || 0) > 0) {
                UnifiedPromptGalleryNode.setSamplingQuietMode(true);
            }
            UnifiedPromptGalleryNode.tryScheduleDeferredAutoAttachFlush();
        });

        const clearWildcardExecutionState = ({ detail }) => {
            UnifiedPromptGalleryNode.isExecuting = false;
            if (UnifiedPromptGalleryNode.isComfyIdle()) {
                UnifiedPromptGalleryNode.setSamplingQuietMode(false);
            }
            const promptId = detail?.prompt_id == null ? "" : String(detail.prompt_id);
            if (!promptId) return;
            UnifiedPromptGalleryNode.pendingWildcardAutoAttach.delete(promptId);
            UnifiedPromptGalleryNode.recentOutputsByPromptId.delete(promptId);
            UnifiedPromptGalleryNode.tryScheduleDeferredAutoAttachFlush();
        };
        api.addEventListener("execution_error", clearWildcardExecutionState);
        api.addEventListener("execution_interrupted", clearWildcardExecutionState);
    },
    async beforeRegisterNodeDef(nodeType, nodeData) {
        UnifiedPromptGalleryNode.setup(nodeType, nodeData);
    }
};
}

