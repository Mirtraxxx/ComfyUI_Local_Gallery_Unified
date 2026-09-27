import { confirmAction, showAlert } from "../shared/nativeDialogs.js";
import * as promptApi from "../api/promptApi.js";
import { INITIAL_PINNED_CATEGORY_COUNT } from "./constants.js";
import {
    getCategoryColorMap as resolveCategoryColorMap,
    getCategoryRoleColor as resolveCategoryRoleColor,
    getLibraryTabsFromPrefs,
    isShowTextNode,
    normalizePromptIdList,
    formatWeight,
    getManagedPromptState,
    stepManagedPromptWeight,
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
import { createPromptCategoryStripController } from "./categoryStripController.js";
import { createDisplayPreferencesController } from "./displayPreferencesController.js";
import { createActiveStackController } from "./activeStackController.js";
import { getUtilityLibraryTabs, renderPromptBuilderDrawer } from "./library.js";
import { showWildcardsModal } from "./wildcards.js";
import { getPromptTemplate } from "./template.js";
import { PROMPT_STYLES } from "./styles.js";
import { ensureStyleSheet } from "../shared/styleSheet.js";
import { CHROME_STYLES } from "../shared/chrome.js";
import { createPopoverGroup } from "../shared/popovers.js";
import { createAutoHideBar } from "../shared/autoHideBar.js";
import { closePillMenu, showPillMenu } from "../shared/pillMenu.js";
import { setupPromptPreDomStateWidgets, setupPromptPostDomStateWidgets } from "./stateWidgets.js";
import { createMetaTagsController } from "./metaTags.js";
import { createPromptWorkspaceController } from "./workspace.js";
import { createPromptWorkspaceActions } from "./workspaceActions.js";
import { createPromptGalleryNode } from "./galleryNode.js";
import { createPromptSortOrder } from "./sortOrder.js";
import {
    DEFAULT_PROMPT_UI_PREFS,
    mergeUiPrefs,
} from "./preferences.js";
import { escapeHtml } from "../shared/dom.js";
import { createEventListenerRegistry } from "../shared/events.js";
import { createOperationFeedback } from "../shared/operationFeedback.js";
import { readSelectionArray, stringifyJsonOr, writeSelectionArray } from "../shared/json.js";
import {
    readWorkflowProfileSection,
    writeWorkflowProfileSection,
} from "../shared/workflowProfile.js";

export function createPromptGalleryLifecycle(app, api) {
const UnifiedPromptGalleryNode = createPromptGalleryNode();

function setupPromptNode(nodeType, nodeData) {
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
        this.mostUsedPrompts = [];
        this.uiPrefs = {
            ...DEFAULT_PROMPT_UI_PREFS,
            last_created_category: "",
        };



        // ADD DOM WIDGET HERE - before hidden data widgets
        widgetContainer = document.createElement("div");
        widgetContainer.className = "localprompt-container-wrapper lg-root";
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

        ensureStyleSheet("localprompt-styles", PROMPT_STYLES);
        ensureStyleSheet("localgallery-chrome", CHROME_STYLES);
        widgetContainer.innerHTML = getPromptTemplate(uniqueId);
        const promptBottomBar = widgetContainer.querySelector(".localprompt-bottom-bar");
        const operationFeedback = createOperationFeedback({
            host: promptBottomBar,
            before: promptBottomBar.querySelector(".lg-spacer").nextElementSibling,
            readyMessage: "Ready",
        });
        this.operationFeedback = operationFeedback;
        const autoHideBar = createAutoHideBar(widgetContainer, promptBottomBar, () => node_instance.uiPrefs?.auto_hide_toolbars === true);
        const popovers = createPopoverGroup(widgetContainer, {
            onChange: panel => {
                if (panel && isActiveSidebarOpen()) {
                    clearActiveSidebarOpenTimer();
                    clearActiveSidebarCloseTimer();
                    setActiveSidebarHoverOpen(false);
                }
                if (panel?.id === `${uniqueId}-category-overflow`) panel.querySelector("input")?.focus();
                autoHideBar.sync();
            },
        });

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
                if (panel && !panel.hidden) popovers.fit(panel);
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
        let currentWildcardMode = wildcardWidget?.value || 'off';
        let disposed = false;
        let libraryDrawerRenderToken = 0;
        let queuedLibraryDrawerTimer = null;
        let selectionGraphChangeTimer = null;
        let setupTimer = null;
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


        // Create hover preview outside the node container so it's not bounded
        const hoverPreview = document.createElement('div');
        hoverPreview.id = `${uniqueId}-hover-preview`;
        hoverPreview.className = 'localprompt-hover-preview';
        document.body.appendChild(hoverPreview);
        // Category pill drag handlers
        const globalKeydownHandler = (event) => {
            if (event.key === "Escape") {
                closeToolbarPanels();
                categoryStripController?.cancelDrag();
            }
        };

        globalListeners.listen(document, "keydown", globalKeydownHandler);
        globalListeners.listen(window, "pointermove", event => categoryStripController?.onPointerMove(event));
        globalListeners.listen(window, "pointerup", event => categoryStripController?.onPointerUp(event));
        globalListeners.listen(window, "pointercancel", () => categoryStripController?.cancelDrag());

        // Clean up on node removal
        const originalOnRemoved = this.onRemoved;
        this.onRemoved = function () {
            disposed = true;
            libraryDrawerRenderToken += 1;
            activeStackController?.dispose?.();
            UnifiedPromptGalleryNode.instances.delete(this);
            this.__localPromptWidgetRoot = null;
            const preview = document.getElementById(`${uniqueId}-hover-preview`);
            if (preview) preview.remove();
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
            popovers.dispose();
            autoHideBar.dispose();
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
            closePillMenu();
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

        function closeToolbarPanels() {
            popovers.close();
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

        function saveNodeProperties() {
            node_instance.setDirtyCanvas?.(true, true);
            if (app.graph) app.graph.change();
        }


        function getPromptSourceNode() {
            const sourceId = node_instance.properties?.prompt_source_node_id;
            if (sourceId == null) return null;
            return app.graph?.getNodeById?.(sourceId) || null;
        }



        function promptSourceLabel(node) {
            return node.title || node.type || `Node ${node.id}`;
        }

        // Rebuilt whenever the Display popover opens, since the graph can change in between.
        function syncPromptSourceSelect() {
            const select = widgetContainer.querySelector(`#${uniqueId}-prompt-source-select`);
            if (!select) return;
            const textNodes = (app.graph?._nodes || []).filter(node => isShowTextNode(node) && node !== node_instance);
            const sourceId = node_instance.properties?.prompt_source_node_id;
            const options = [
                new Option("No source", ""),
                ...textNodes.map(node => new Option(promptSourceLabel(node), String(node.id))),
            ];
            if (sourceId != null && !textNodes.some(node => String(node.id) === String(sourceId))) {
                options.push(new Option(`Missing: ${node_instance.properties?.prompt_source_node_title || `Node ${sourceId}`}`, String(sourceId)));
            }
            select.replaceChildren(...options);
            select.value = sourceId == null ? "" : String(sourceId);
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

        function getLibraryTabs() {
            return getLibraryTabsFromPrefs(node_instance.uiPrefs, getUtilityLibraryTabs());
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
            const initialPins = getCategoriesInCurrentOrder(allCategories).slice(0, INITIAL_PINNED_CATEGORY_COUNT);
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
            await saveUiPrefs();
            await renderPinnedCategoryStrip();
        }

        function clearLibraryNavActiveState() {
            widgetContainer.querySelector(`#${uniqueId}-fav-toggle-btn`)?.classList.remove("active");
        }

        const {
            getPromptSortScope,
            getPromptSortMode,
            syncPromptSortControls,
            bindMainSortSelect,
            setPromptSortMode,
            persistPinnedOrder,
            getPromptManualOrder,
            persistPromptManualOrder,
            sortPinnedPrompts,
            promoteSelectedPrompts,
        } = createPromptSortOrder({
            widgetContainer,
            uniqueId,
            nodeInstance: node_instance,
            getActiveLibraryTab: () => activeLibraryTab,
            getPinnedOrder: () => getPinnedOrder(),
            getSelectedPromptIdsInOrder: () => getSelectedPromptIdsInOrder(),
            renderLibraryDrawer: tab => renderLibraryDrawer(tab),
            saveUiPrefs: () => saveUiPrefs(),
        });

        categoryStripController = createPromptCategoryStripController({
            widgetContainer,
            uniqueId,
            getCachedCategories,
            ensurePinnedCategoriesInitialized,
            getCategoriesInCurrentOrder,
            getActiveLibraryTab: () => activeLibraryTab,
            setActiveLibraryTab: value => { activeLibraryTab = value; },
            setCategoryOverflowOpen: open => {
                const overflow = widgetContainer.querySelector(`#${uniqueId}-category-overflow`);
                if (open) popovers.open(overflow);
                else popovers.close();
            },
            getPinnedCategories,
            savePinnedCategories,
            saveCategoryOrder,
            showCategoryPillContextMenu,
            setWorkspaceMode,
            getWorkspaceMode,
            renderLibraryDrawer,
            clearLibraryNavActiveState,
            syncPromptSortControls,
            syncSelectedSectionVisibility,
            closeToolbarPanels,
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
            renderActiveSidebar,
            applyActiveSidebarPreference,
            saveUiPrefs,
            bindMainSortSelect,
        });

        async function saveCategoryOrder(nextCategoryOrder) {
            const currentTabs = Array.isArray(node_instance.uiPrefs.library_tabs)
                ? node_instance.uiPrefs.library_tabs
                : [];
            const utilityTabs = currentTabs.filter(tab => !nextCategoryOrder.includes(tab));
            const nextTabs = [...utilityTabs, ...nextCategoryOrder];
            node_instance.uiPrefs.library_tabs = nextTabs;
            await UnifiedPromptGalleryNode.saveUiPrefs(node_instance.uiPrefs, node_instance);
        }

        function showCategoryPillContextMenu(event, category, isCurrentlyPinned, afterChange = null) {
            showPillMenu(event, {
                pinned: isCurrentlyPinned,
                color: node_instance.uiPrefs.category_colors?.[category] || "",
                onTogglePin: async () => {
                    const pinned = getPinnedCategories(await getCachedCategories());
                    await savePinnedCategories(isCurrentlyPinned ? pinned.filter(c => c !== category) : [...pinned, category]);
                    afterChange?.();
                },
                onColor: async color => {
                    const colors = { ...(node_instance.uiPrefs.category_colors || {}) };
                    if (color) colors[category] = color;
                    else delete colors[category];
                    node_instance.uiPrefs.category_colors = colors;
                    await saveUiPrefs();
                    await renderPinnedCategoryStrip();
                    if (activeLibraryTab) await renderLibraryDrawer(activeLibraryTab);
                    await renderActiveSidebar();
                    afterChange?.();
                },
            });
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

        function updateActiveSideTabCount() {
            const tab = widgetContainer.querySelector(`#${uniqueId}-active-toggle`);
            const tabCount = widgetContainer.querySelector(`#${uniqueId}-active-tab-count`);
            const count = node_instance.promptData.length;
            if (tabCount) tabCount.textContent = String(count);
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

        function updateWildcardControlsUI() {
            const isOn = currentWildcardMode === 'on';
            const rngMode = normalizeWildcardRngMode(wildcardRngModeWidget?.value || node_instance.properties?.wildcard_rng_mode);
            widgetContainer.querySelector(`#${uniqueId}-wildcard-toggle-btn`)?.classList.toggle('active', isOn);
            const enabledInput = widgetContainer.querySelector(`#${uniqueId}-wildcard-enabled`);
            if (enabledInput) enabledInput.checked = isOn;
            const rngSelect = widgetContainer.querySelector(`#${uniqueId}-wildcard-rng-select`);
            if (rngSelect) rngSelect.value = rngMode;
            const shuffleBtn = widgetContainer.querySelector(`#${uniqueId}-wildcard-shuffle-btn`);
            if (shuffleBtn) shuffleBtn.hidden = rngMode !== "shuffle";
            const autoAttachInput = widgetContainer.querySelector(`#${uniqueId}-wildcard-auto-attach`);
            if (autoAttachInput) {
                autoAttachInput.checked = String(
                    node_instance.properties?.wildcard_auto_attach_thumbnail
                    || wildcardAutoAttachThumbnailWidget?.value
                    || "off"
                ).toLowerCase() === "on";
            }
        }
        async function renderActiveSidebar() {
            return activeStackController?.render?.();
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

        async function loadCategories() {
            invalidateCategoryCache();
            await renderPinnedCategoryStrip();
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
            getPromptSourceNode,
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
            showAddPromptWorkspace,
            showImportWorkspace,
            showExportDialog,
            showExportWorkspace,
            showPresetsWorkspace,
            showBrowseWorkspace,
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
            // ========== WILDCARD MODE ==========
            currentWildcardMode = wildcardWidget?.value || 'off';

            updateWildcardControlsUI();
            widgetContainer.querySelector(`#${uniqueId}-wildcard-enabled`)?.addEventListener('change', (event) => {
                currentWildcardMode = event.target.checked ? 'on' : 'off';
                saveWildcardState(currentWildcardMode, categoriesWidget?.value || "[]");
                updateWildcardControlsUI();
            });

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
                applyActiveSidebarWidthPreference();
                applyActiveSidebarPreference();
                applyCardContrastModePreference();
                syncPromptSortControls();
                autoHideBar.sync();

                renderPrompts();
                await renderPinnedCategoryStrip();
                renderMetaTags();
                syncSelectedSectionVisibility();
                syncPromptSourceSelect();
            })();

            // ========== NEW BUTTON HANDLERS ==========

            const panelFor = id => widgetContainer.querySelector(`#${uniqueId}-${id}`);
            popovers.register(panelFor("category-pull-tab"), panelFor("category-overflow"), () => renderCategoryOverflowCategories());
            popovers.register(panelFor("meta-tags-btn"), panelFor("meta-tags-panel"), () => {
                if (getWorkspaceMode() !== "gallery") returnToGallery();
                renderMetaTags();
            });
            popovers.register(panelFor("wildcard-toggle-btn"), panelFor("wildcard-controls"), updateWildcardControlsUI);
            popovers.register(panelFor("size-toggle-btn"), panelFor("size-controls"), () => {
                syncThumbnailSizeSliders();
                syncPromptSourceSelect();
                panelFor("promote-selected").checked = node_instance.uiPrefs?.promote_selected_prompts !== false;
                panelFor("auto-hide-bar").checked = node_instance.uiPrefs?.auto_hide_toolbars === true;
            });
            panelFor("prompt-source-select").addEventListener("change", event => {
                const sourceNode = (app.graph?._nodes || []).find(node => String(node.id) === event.target.value);
                if (!event.target.value || sourceNode) {
                    node_instance.properties.prompt_source_node_id = sourceNode?.id ?? null;
                    node_instance.properties.prompt_source_node_title = sourceNode ? promptSourceLabel(sourceNode) : null;
                    saveNodeProperties();
                }
                syncPromptSourceSelect();
            });
            panelFor("promote-selected").addEventListener("change", async (event) => {
                node_instance.uiPrefs.promote_selected_prompts = event.target.checked;
                if (activeLibraryTab) await renderLibraryDrawer(activeLibraryTab);
                await saveUiPrefs();
            });
            panelFor("auto-hide-bar").addEventListener("change", async (event) => {
                node_instance.uiPrefs.auto_hide_toolbars = event.target.checked;
                autoHideBar.sync();
                await saveUiPrefs();
            });

            const favBtn = panelFor("fav-toggle-btn");
            favBtn.addEventListener("click", async () => {
                if (getWorkspaceMode() !== "gallery") {
                    setWorkspaceMode("gallery");
                }
                const drawer = panelFor("library-drawer");
                if (activeLibraryTab === "pinned") {
                    activeLibraryTab = null;
                    clearLibraryNavActiveState();
                    drawer.classList.remove("active");
                } else {
                    activeLibraryTab = "pinned";
                    favBtn.classList.add("active");
                    drawer.classList.add("active");
                    await renderLibraryDrawer("pinned");
                }
                syncPromptSortControls();
                syncSelectedSectionVisibility();
                await renderPinnedCategoryStrip();
            });

            bindAddMetaTagButton();

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

        }, 100);

        return result;
    };
}

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
        setupPromptNode(nodeType, nodeData);
    }
};
}

