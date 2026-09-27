import { confirmAction } from "../shared/nativeDialogs.js";
import { api } from "../../../scripts/api.js";
import * as loraApi from "../api/loraApi.js";
import { createOperationFeedback } from "../shared/operationFeedback.js";
import { createEventListenerRegistry } from "../shared/events.js";
import { cloneJsonOr, readSelectionArray, writeSelectionArray } from "../shared/json.js";
import {
    readWorkflowProfileSection,
    writeWorkflowProfileSection,
} from "../shared/workflowProfile.js";
import {
    LORA_DISPLAY_LIMITS,
    clampInteger,
    getLoraActiveCardControlScale,
    normalizeLoraDisplayMode,
    normalizeLoraDisplayState,
    normalizeLoraSortMode,
} from "./displayState.js";
import { buildLoraCardHtml } from "./renderers.js";
import { getResponsiveLoraBrowserCardLayout } from "./browserCardLayout.js";
import { createLoraActiveStackController } from "./activeStackController.js";
import { createLoraMetadataController } from "./metadataEditor.js";
import { createLoraFolderController, getFolderLabel } from "./folderController.js";
import { syncLoraWithCivitai } from "./civitaiSync.js";
import { buildLoraSelectionEntry } from "./selectionEntry.js";
import { normalizeLoraLotteryConfig, readLoraLotteryConfig } from "./lotteryState.js";
import { setupLoraPresetControls } from "./presetControls.js";
import { toSerializableLoraSelection } from "./selectionState.js";
import { setupLoraStateWidgets } from "./stateWidgets.js";
import { LORA_STYLES } from "./styles.js";
import { getLoraTemplate } from "./template.js";
import { ensureStyleSheet } from "../shared/styleSheet.js";
import { closePillMenu } from "../shared/pillMenu.js";
import { CHROME_STYLES } from "../shared/chrome.js";
import { createPopoverGroup } from "../shared/popovers.js";
import { createAutoHideBar } from "../shared/autoHideBar.js";
import { icon } from "../shared/icons.js";

export function createLoraGalleryLifecycle(app) {
const UnifiedLoraGalleryNode = {
    name: "LocalLoraGallery",
    isLoading: false,
    currentPage: 1,
    totalPages: 1,
    lastOutput: null,

    async getLoras(filter_tag = "", mode = "OR", folder = "", page = 1, selected_loras = [], per_page = 50, sort_mode = "az") {
        this.isLoading = true;
        try {
            const data = await loraApi.getLoras(filter_tag, mode, folder, page, selected_loras, per_page, sort_mode);
            this.totalPages = data.total_pages || 1;
            this.currentPage = data.current_page || 1;
            return data;
        } catch (error) {
            console.error("LocalLoraGallery: Error fetching LoRAs:", error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    },

    async updateMetadata(lora_name, data) {
        try {
            return await loraApi.updateMetadata(lora_name, data);
        } catch(e) {
            console.error("LocalLoraGallery: Failed to update metadata", e);
            throw e;
        }
    },

    async setUiState(nodeId, galleryId, state) {
        try {
            await loraApi.setUiState(nodeId, galleryId, state);
        } catch(e) {
            console.error("LocalLoraGallery: Failed to set UI state", e);
        }
    },

    setup(nodeType, nodeData) {
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated?.apply(this, arguments);

            setupLoraStateWidgets({ nodeInstance: this });

            const MIN_NODE_WIDTH = 600;
            const MIN_NODE_HEIGHT = 350;

            this.size = [700, 600];
            this.loraData = [];
            this.availableLoras = [];
            this.selectedLoraNamesForEditing = new Set();
            this.activeEditingLoraName = null;
            this.loraUiState = {};

            const widgetContainer = document.createElement("div");
            widgetContainer.className = "locallora-container-wrapper lg-root";
            this.addDOMWidget("lora_gallery", "div", widgetContainer, {});
            const globalListeners = createEventListenerRegistry();

            // Fix for node title menu icons appearing in wrong position (left) when clicking custom content.
            // Force canvas selection logic on mousedown so menu uses correct node title rect instead of widget rect.
            widgetContainer.addEventListener('mousedown', () => {
                setTimeout(() => {
                    if (app && app.canvas && typeof app.canvas.selectNode === 'function') {
                        app.canvas.selectNode(this);
                    }
                }, 0);
            });

            const uniqueId = `locallora-gallery-${this.id}`;
            widgetContainer.id = `${uniqueId}-wrapper`;
            ensureStyleSheet("locallora-styles", LORA_STYLES);
            ensureStyleSheet("localgallery-chrome", CHROME_STYLES);
            widgetContainer.innerHTML = getLoraTemplate(uniqueId);

            const mainContainer = widgetContainer.querySelector(".locallora-container");
            const selectedListEl = widgetContainer.querySelector(`#${uniqueId}-active-chips`);
            const galleryEl = widgetContainer.querySelector(".locallora-gallery");
            const searchInput = widgetContainer.querySelector(".search-input");
            const metadataEditor = widgetContainer.querySelector(".locallora-metadata-editor");
            const triggerEditorRow = widgetContainer.querySelector(".trigger-editor-row");
            const triggerEditorInput = widgetContainer.querySelector(".trigger-editor-input");
            const urlEditorRow = widgetContainer.querySelector(".url-editor-row");
            const urlEditorInput = widgetContainer.querySelector(".url-editor-input");
            const triggerPresetEditorRow = widgetContainer.querySelector(".trigger-preset-editor-row");
            const triggerPresetList = widgetContainer.querySelector(".trigger-preset-list");
            const triggerPresetNameInput = widgetContainer.querySelector(".trigger-preset-name-input");
            const triggerPresetValueInput = widgetContainer.querySelector(".trigger-preset-value-input");
            const addTriggerPresetBtn = widgetContainer.querySelector(".add-trigger-preset-btn");
            const strengthMemoryRow = widgetContainer.querySelector(".strength-memory-editor-row");
            const strengthMemoryEnableInput = widgetContainer.querySelector(".strength-memory-enable-input");
            const strengthMemoryModelInput = widgetContainer.querySelector(".strength-memory-model-input");
            const strengthMemoryClipInput = widgetContainer.querySelector(".strength-memory-clip-input");
            const activeStackBtn = widgetContainer.querySelector(".lora-active-stack-btn");
            const activeStackCount = widgetContainer.querySelector(".lora-active-stack-count");
            const selectedCountEl = widgetContainer.querySelector(".selected-count");
            const metadataEditorSelectionLabel = widgetContainer.querySelector(".lora-metadata-editor-selection-label");
            const metadataEditorTitle = widgetContainer.querySelector(".lora-metadata-editor-title");
            const metadataEditorCloseBtn = widgetContainer.querySelector(".lora-metadata-editor-close");
            const useLastOutputThumbnailBtn = widgetContainer.querySelector(".use-last-output-thumbnail-btn");
            const thumbnailActionLabel = widgetContainer.querySelector(".lora-thumbnail-action-label");
            const thumbnailActionStatus = widgetContainer.querySelector(".lora-thumbnail-action-status");
            const triggerPresetToggleBtn = widgetContainer.querySelector(".lora-trigger-preset-editor-toggle");
            const triggerPresetContent = widgetContainer.querySelector(".lora-trigger-preset-content");
            const triggerPresetCount = widgetContainer.querySelector(".lora-trigger-preset-count");
            const folderFilterSelect = widgetContainer.querySelector(".folder-filter-select");
            const folderStrip = widgetContainer.querySelector(".lora-folder-strip");
            const folderOverflow = widgetContainer.querySelector(".lora-folder-overflow");
            const folderMoreBtn = widgetContainer.querySelector(".lora-folder-more-btn");
            const savePresetBtn = widgetContainer.querySelector(".save-preset-btn");
            const loadPresetBtn = widgetContainer.querySelector(".load-preset-btn");
            const presetDropdown = widgetContainer.querySelector(".preset-dropdown");
            const presetPopover = widgetContainer.querySelector(".lora-preset-popover");
            const presetNameInput = widgetContainer.querySelector(".lora-preset-name-input");
            const bottomBar = widgetContainer.querySelector(".locallora-bottom-bar");
            const operationFeedback = createOperationFeedback({
                host: bottomBar,
                before: bottomBar.querySelector(".lg-spacer").nextElementSibling,
                readyMessage: "Ready",
            });
            this.operationFeedback = operationFeedback;
            const displayOptionsBtn = widgetContainer.querySelector(".lora-display-options-btn");
            const displayOptionsPopover = widgetContainer.querySelector(".lora-display-options-popover");
            const searchBtn = widgetContainer.querySelector(".lora-search-btn");
            const searchPopover = widgetContainer.querySelector(".lora-search-popover");
            const clearNameSearchBtn = widgetContainer.querySelector(".lora-search-clear-btn");
            const executionModeBtn = widgetContainer.querySelector(".lora-execution-mode-btn");
            const executionModeLabel = widgetContainer.querySelector(".lora-execution-mode-label");
            const compareStrengthsControl = widgetContainer.querySelector(".lora-compare-strengths-control");
            const compareStrengthsInput = widgetContainer.querySelector(".lora-compare-strengths-input");
            const lotteryBtn = widgetContainer.querySelector(".lora-lottery-btn");
            const lotteryPopover = widgetContainer.querySelector(".lora-lottery-popover");
            const lotteryEnabledInput = widgetContainer.querySelector(".lora-lottery-enabled-input");
            const lotteryFolderSelect = widgetContainer.querySelector(".lora-lottery-folder-select");
            const lotteryStrengthInput = widgetContainer.querySelector(".lora-lottery-strength-input");
            const lotteryClipStrengthInput = widgetContainer.querySelector(".lora-lottery-clip-strength-input");
            const lotteryStatus = widgetContainer.querySelector(".lora-lottery-status");
            let lotteryFolderValue = "";
            const getLoraDisplayState = () => normalizeLoraDisplayState(this.loraUiState);
            const autoHideBar = createAutoHideBar(widgetContainer, bottomBar, () => getLoraDisplayState().auto_hide_toolbars);
            const popovers = createPopoverGroup(widgetContainer, {
                onChange: panel => {
                    if (panel === folderOverflow) panel.querySelector("input")?.focus();
                    else if (panel === searchPopover) searchInput.focus();
                    autoHideBar.sync();
                },
            });
            const syncExecutionControls = () => {
                const mode = this.properties?.lora_execution_mode === "compare" ? "compare" : "stack";
                const strengths = String(this.properties?.lora_compare_strengths || "1.0");
                executionModeBtn.dataset.mode = mode;
                executionModeBtn.title = mode === "compare"
                    ? "Compare each enabled LoRA independently from the base model"
                    : "Stack enabled LoRAs onto one model";
                executionModeLabel.textContent = mode === "compare" ? "Compare" : "Stack";
                compareStrengthsControl.hidden = mode !== "compare";
                compareStrengthsInput.value = strengths;
            };
            const getLotteryConfig = () => normalizeLoraLotteryConfig({
                enabled: lotteryEnabledInput.checked,
                folder: lotteryFolderValue,
                strength: lotteryStrengthInput.value,
                strength_clip: lotteryClipStrengthInput.value,
            });
            const syncLotteryControls = (config = getLotteryConfig()) => {
                lotteryFolderValue = config.folder;
                lotteryEnabledInput.checked = config.enabled;
                lotteryFolderSelect.value = Array.from(lotteryFolderSelect.options)
                    .some(option => option.value === config.folder)
                    ? config.folder
                    : "";
                lotteryStrengthInput.value = String(config.strength);
                lotteryClipStrengthInput.value = String(config.strength_clip);
                lotteryBtn.classList.toggle("active", config.enabled);
                lotteryBtn.setAttribute("aria-label", config.enabled
                    ? "LoRA lottery enabled. Configure lottery"
                    : "Configure LoRA lottery");
                lotteryStatus.textContent = config.enabled
                    ? "On. One random LoRA will be added to each run."
                    : "Off. Your Active Stack is unchanged.";
            };
            const setExecutionProperty = (name, value) => {
                if (!this.properties) this.properties = {};
                this.properties[name] = value;
                this.setProperty?.(name, value);
                this.setDirtyCanvas(true, true);
            };
            let browserCardLayoutFrame = null;
            let browserCardLayoutObserver = null;

            const syncBrowserCardLayout = () => {
                browserCardLayoutFrame = null;
                const state = getLoraDisplayState();
                const galleryStyles = getComputedStyle(galleryEl);
                const layout = getResponsiveLoraBrowserCardLayout({
                    availableWidth: galleryEl.clientWidth,
                    minimumCardWidth: Math.max(118, Math.round(state.thumbnail_size_px * 0.78)),
                    gap: parseFloat(galleryStyles.columnGap) || 0,
                    paddingInline:
                        (parseFloat(galleryStyles.paddingLeft) || 0)
                        + (parseFloat(galleryStyles.paddingRight) || 0),
                });
                if (!layout) return;
                galleryEl.style.setProperty("--lora-card-responsive-height", `${layout.cardHeight}px`);
                galleryEl.dataset.responsiveColumns = String(layout.columns);
            };

            const scheduleBrowserCardLayout = () => {
                if (browserCardLayoutFrame != null) return;
                browserCardLayoutFrame = requestAnimationFrame(syncBrowserCardLayout);
            };

            let loraDisplayStateSaveTimer = null;
            let loraDisplayStateSaveQueued = false;
            let loraUiStateSaveChain = Promise.resolve();
            const persistLoraUiState = (extraState = {}) => {
                this.loraUiState = { ...this.loraUiState, ...extraState };
                const state = {
                    filter_folder: folderFilterSelect.value,
                    folder_colors: this.loraUiState.folder_colors,
                    pinned_folders: this.loraUiState.pinned_folders,
                    folder_order: this.loraUiState.folder_order,
                    ...getLoraDisplayState(),
                    ...extraState,
                };
                // Serialize snapshots so rapid UI changes retain their order while
                // the workflow change tracker observes one stable node property.
                loraUiStateSaveChain = loraUiStateSaveChain
                    .catch(() => {})
                    .then(() => {
                        writeWorkflowProfileSection(this, "lora_ui", state);
                        return { status: "ok", scope: "workflow" };
                    });
                return loraUiStateSaveChain;
            };

            const queueLoraDisplayStateSave = () => {
                if (loraDisplayStateSaveTimer) clearTimeout(loraDisplayStateSaveTimer);
                loraDisplayStateSaveQueued = true;
                loraDisplayStateSaveTimer = setTimeout(() => {
                    loraDisplayStateSaveTimer = null;
                    if (!loraDisplayStateSaveQueued) return;
                    loraDisplayStateSaveQueued = false;
                    persistLoraUiState();
                }, 250);
            };
            const flushLoraDisplayStateSave = () => {
                if (loraDisplayStateSaveTimer) {
                    clearTimeout(loraDisplayStateSaveTimer);
                    loraDisplayStateSaveTimer = null;
                }
                if (!loraDisplayStateSaveQueued) return loraUiStateSaveChain;
                loraDisplayStateSaveQueued = false;
                return persistLoraUiState();
            };

            const syncDisplayOptionControls = () => {
                const state = getLoraDisplayState();
                const activeThumbnailSlider = widgetContainer.querySelector(".lora-active-thumbnail-size-slider");
                const cardThumbnailSlider = widgetContainer.querySelector(".lora-thumbnail-size-slider");
                widgetContainer.querySelector(".lora-active-display-mode").value = state.active_display_mode;
                widgetContainer.querySelector(".lora-cards-display-mode").value = state.cards_display_mode;
                widgetContainer.querySelector(".lora-sort-select").value = state.sort_mode;
                activeThumbnailSlider.value = state.active_thumbnail_size_px;
                activeThumbnailSlider.disabled = state.active_display_mode !== "thumbnails";
                cardThumbnailSlider.value = state.thumbnail_size_px;
                cardThumbnailSlider.disabled = state.cards_display_mode !== "thumbnails";
                widgetContainer.querySelector(".lora-active-large-cards-checkbox").checked = state.active_card_size_mode === "large";
                widgetContainer.querySelector(".lora-show-clip-weights-checkbox").checked = state.show_clip_weights;
                widgetContainer.querySelector(".lora-move-active-to-top-checkbox").checked = state.move_active_loras_to_top;
                widgetContainer.querySelector(".lora-dim-unselected-checkbox").checked = state.card_contrast_mode === "dim_inactive";
                widgetContainer.querySelector(".lora-auto-hide-bar-checkbox").checked = state.auto_hide_toolbars;
            };

            const applyLoraDisplayState = () => {
                const state = getLoraDisplayState();
                mainContainer.classList.toggle("active-mode-thumbnails", state.active_display_mode === "thumbnails");
                mainContainer.classList.toggle("active-mode-compact", state.active_display_mode === "compact");
                mainContainer.classList.toggle("cards-mode-thumbnails", state.cards_display_mode === "thumbnails");
                mainContainer.classList.toggle("cards-mode-compact", state.cards_display_mode === "compact");
                mainContainer.classList.toggle("contrast-dim-inactive", state.card_contrast_mode === "dim_inactive");
                mainContainer.style.setProperty("--lora-card-thumb-size", `${state.thumbnail_size_px}px`);
                mainContainer.style.setProperty("--lora-card-min-width", `${Math.max(118, Math.round(state.thumbnail_size_px * 0.78))}px`);
                mainContainer.style.setProperty("--lora-active-thumb-size", `${state.active_thumbnail_size_px}px`);
                mainContainer.style.setProperty("--lora-active-card-width", `${Math.round(state.active_thumbnail_size_px * 1.2)}px`);
                mainContainer.style.setProperty("--lora-active-card-height", `${Math.round(state.active_thumbnail_size_px * 1.5)}px`);
                mainContainer.style.setProperty("--lora-active-large-card-width", `${Math.round(state.active_thumbnail_size_px * 1.42)}px`);
                mainContainer.style.setProperty("--lora-active-large-card-height", `${Math.round(state.active_thumbnail_size_px * 1.95)}px`);
                const activeCardControlScale = getLoraActiveCardControlScale(state.active_thumbnail_size_px)
                    * (state.active_card_size_mode === "large" ? 1.32 : 1);
                mainContainer.style.setProperty("--lora-active-card-control-scale", activeCardControlScale.toFixed(3));
                mainContainer.style.setProperty("--locallora-active-sidebar-width", `${state.active_sidebar_width}px`);
                const sidebarEl = widgetContainer.querySelector(".locallora-active-sidebar");
                if (sidebarEl) {
                    sidebarEl.classList.toggle("large-mode", state.active_card_size_mode === "large");
                }
                scheduleBrowserCardLayout();
                syncDisplayOptionControls();
                autoHideBar.sync();
            };

            const splitter = widgetContainer.querySelector(`#${uniqueId}-active-splitter`);
            let startX = 0;
            let startWidth = 360;
            let removeSidebarMouseMove = null;
            let removeSidebarMouseUp = null;

            const onMouseMove = (event) => {
                const deltaX = event.clientX - startX;
                const nextWidth = Math.max(300, Math.min(720, startWidth + deltaX));
                widgetContainer.style.setProperty("--locallora-active-sidebar-width", `${nextWidth}px`);
                this.loraUiState.active_sidebar_width = nextWidth;
            };

            const onMouseUp = () => {
                splitter.classList.remove("dragging");
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                removeSidebarMouseMove?.();
                removeSidebarMouseUp?.();
                removeSidebarMouseMove = null;
                removeSidebarMouseUp = null;
                persistLoraUiState();
            };

            if (splitter) {
                splitter.addEventListener("mousedown", (event) => {
                    if (!mainContainer.classList.contains("active-stack-open")) return;
                    event.preventDefault();
                    startX = event.clientX;
                    const state = getLoraDisplayState();
                    startWidth = state.active_sidebar_width;
                    splitter.classList.add("dragging");
                    document.body.style.cursor = "ew-resize";
                    document.body.style.userSelect = "none";
                    removeSidebarMouseMove?.();
                    removeSidebarMouseUp?.();
                    removeSidebarMouseMove = globalListeners.listen(document, "mousemove", onMouseMove);
                    removeSidebarMouseUp = globalListeners.listen(document, "mouseup", onMouseUp);
                });
            }

            const saveStateAndFetch = async () => {
                const stateToSave = {
                    filter_folder: folderFilterSelect.value,
                    folder_colors: this.loraUiState.folder_colors,
                    pinned_folders: this.loraUiState.pinned_folders,
                    folder_order: this.loraUiState.folder_order,
                    ...getLoraDisplayState(),
                };
                this.loraUiState = { ...this.loraUiState, ...stateToSave };
                // The visual filter update does not depend on JSON durability.
                // Start it now and let the coalesced persistence chain finish safely.
                const save = persistLoraUiState(stateToSave);
                const fetch = fetchAndRender(false);
                await Promise.all([save, fetch]);
            };

            const folderController = createLoraFolderController({
                nodeInstance: this,
                widgetContainer,
                folderFilterSelect,
                folderStrip,
                folderOverflow,
                folderMoreBtn,
                closeOverflow: () => popovers.close(),
                persistState: () => persistLoraUiState(),
                saveStateAndFetch,
            });
            const {
                renderFolderPills,
                onLoraFolderPointerMove,
                onLoraFolderPointerUp,
                onLoraFolderPointerCancel,
            } = folderController;
            renderFolderPills();
            const persistSelectionData = () => {
                const serializableData = toSerializableLoraSelection(this.loraData);
                const selectionEnvelope = JSON.parse(writeSelectionArray(serializableData));
                selectionEnvelope.execution = {
                    mode: this.properties?.lora_execution_mode === "compare" ? "compare" : "stack",
                    strengths: String(this.properties?.lora_compare_strengths || "1.0"),
                };
                selectionEnvelope.lottery = getLotteryConfig();
                const selectionJson = JSON.stringify(selectionEnvelope);
                this.setProperty("lora_selection_data", selectionJson);
                if (this.properties) this.properties.lora_selection_data = selectionJson;
                const widget = this.widgets.find(w => w.name === "lora_selection_data");
                if (widget) {
                    widget.value = selectionJson;
                    // Comfy serializes right before queue; always emit live in-memory selection
                    // so trigger presets chosen moments earlier are included.
                    widget.serializeValue = () => {
                        const live = toSerializableLoraSelection(this.loraData || []);
                        const liveEnvelope = JSON.parse(writeSelectionArray(live));
                        liveEnvelope.execution = {
                            mode: this.properties?.lora_execution_mode === "compare" ? "compare" : "stack",
                            strengths: String(this.properties?.lora_compare_strengths || "1.0"),
                        };
                        liveEnvelope.lottery = getLotteryConfig();
                        const liveJson = JSON.stringify(liveEnvelope);
                        if (this.properties) this.properties.lora_selection_data = liveJson;
                        widget.value = liveJson;
                        return liveJson;
                    };
                }
                return serializableData;
            };

            const updatePresetButtonText = (presetName = null) => {
                loadPresetBtn.classList.toggle("active", Boolean(presetName));
                loadPresetBtn.dataset.currentPreset = presetName || "";
                loadPresetBtn.title = presetName ? `Presets (current: ${presetName})` : "Presets";
                presetDropdown.querySelectorAll(".lora-preset-load").forEach(button => {
                    button.classList.toggle("active", button.dataset.presetName === presetName);
                });
            };

            const closeActiveStack = () => {
                mainContainer.classList.remove("active-stack-open");
                activeStackBtn.classList.remove("open");
                activeStackBtn.setAttribute("aria-pressed", "false");
            };

            const clearAllLoras = () => {
                this.loraData = [];
                closeActiveStack();
                renderSelectedList();
                updateSelection();
                syncGallerySelectionSoon();
                updatePresetButtonText(null);
            };

            galleryEl.addEventListener('scroll', () => {
                if (this.isLoading || this.currentPage >= this.totalPages) return;
                const { scrollTop, scrollHeight, clientHeight } = galleryEl;
                if (scrollHeight - scrollTop - clientHeight < 400) {
                    fetchAndRender(true);
                }
            });

            const updateSelection = () => {
                persistSelectionData();
                app.graph?.change?.();
                this.setDirtyCanvas?.(true, true);
            };

            let selectionSyncFrame = null;
            const syncSelectedCardStyles = () => {
                const selectedLoras = new Set(this.loraData.map(item => item.lora));
                const cards = Array.from(galleryEl.querySelectorAll(".locallora-lora-card"));
                cards.forEach(card => {
                    card.classList.toggle("selected-flow", selectedLoras.has(card.dataset.loraName));
                });

                const cardsByName = new Map(cards.map(card => [card.dataset.loraName, card]));
                const currentOrder = this.availableLoras.map(lora => lora.name);
                const orderedNames = getLoraDisplayState().move_active_loras_to_top
                    ? [...this.loraData.map(item => item.lora), ...currentOrder]
                    : currentOrder;
                const appendedNames = new Set();
                let targetIndex = 0;
                orderedNames.forEach(loraName => {
                    if (appendedNames.has(loraName)) return;
                    const card = cardsByName.get(loraName);
                    if (!card) return;
                    appendedNames.add(loraName);
                    // Avoid re-appending already-correct cards, which preserves media
                    // state and keeps selection/reorder work proportional to changes.
                    if (galleryEl.children[targetIndex] !== card) {
                        galleryEl.insertBefore(card, galleryEl.children[targetIndex] || null);
                    }
                    targetIndex += 1;
                });
            };

            const syncGallerySelectionSoon = () => {
                if (selectionSyncFrame !== null) return;
                selectionSyncFrame = requestAnimationFrame(() => {
                    selectionSyncFrame = null;
                    if (!widgetContainer.isConnected) return;
                    syncSelectedCardStyles();
                });
            };

            const findGalleryCardByLoraName = (loraName) => (
                Array.from(galleryEl.querySelectorAll(".locallora-lora-card"))
                    .find(card => card.dataset.loraName === loraName) || null
            );

            const getLoraMetadataByName = (loraName) => (
                this.availableLoras.find(lora => lora.name === loraName)
                || this.loraData.find(item => item.lora === loraName)
                || null
            );

            const updateCachedLoraMetadata = (loraName, updates) => {
                const availableItem = this.availableLoras.find(lora => lora.name === loraName);
                if (availableItem) Object.assign(availableItem, updates);
                const selectedItem = this.loraData.find(item => item.lora === loraName);
                if (selectedItem) Object.assign(selectedItem, updates);
            };

            const clearMetadataEditing = () => {
                document.querySelectorAll(`#${uniqueId} .locallora-lora-card.selected-edit`).forEach(c => c.classList.remove("selected-edit"));
                this.selectedLoraNamesForEditing.clear();
                this.activeEditingLoraName = null;
                renderMetadataEditor();
            };

            const rememberedStrengthTimers = new Map();
            const saveRememberedWeight = (loraName) => {
                // Read the live selection at fire time so a removed or replaced LoRA never
                // writes a detached object's weights onto the current row with that name.
                const item = this.loraData.find(entry => entry.lora === loraName);
                if (!item || !getLoraMetadataByName(loraName)?.remember_strength) return;
                const payload = {
                    saved_strength: item.strength ?? 1,
                    saved_strength_clip: item.strength_clip ?? item.strength ?? 1,
                };
                UnifiedLoraGalleryNode.updateMetadata(loraName, payload)
                    .then(() => updateCachedLoraMetadata(loraName, payload))
                    .catch(error => {
                        console.error("LocalLoraGallery: Failed to save remembered strength:", error);
                        operationFeedback.error(error?.message || "Could not save remembered strength");
                    });
            };
            const persistRememberedWeight = (item) => {
                if (!getLoraMetadataByName(item.lora)?.remember_strength) return;
                const loraName = item.lora;
                clearTimeout(rememberedStrengthTimers.get(loraName));
                rememberedStrengthTimers.set(loraName, setTimeout(() => {
                    rememberedStrengthTimers.delete(loraName);
                    saveRememberedWeight(loraName);
                }, 500));
            };
            const flushRememberedStrengthTimers = () => {
                if (!rememberedStrengthTimers.size) return;
                rememberedStrengthTimers.forEach(timer => clearTimeout(timer));
                const pendingNames = [...rememberedStrengthTimers.keys()];
                rememberedStrengthTimers.clear();
                pendingNames.forEach(saveRememberedWeight);
            };

            const activeStackController = createLoraActiveStackController({
                nodeInstance: this,
                widgetContainer,
                selectedListEl,
                activeStackBtn,
                activeStackCount,
                mainContainer,
                metadataEditor,
                uniqueId,
                getLoraDisplayState,
                closeActiveStack,
                clearMetadataEditing,
                findGalleryCardByLoraName,
                renderMetadataEditor: () => renderMetadataEditor(),
                updateSelection,
                syncGallerySelection: syncGallerySelectionSoon,
                updatePresetButtonText,
                persistRememberedWeight,
            });
            const {
                hydrateSelectedLoraInfo,
                renderSelectedList,
            } = activeStackController;
            const loraIconSvg = {
                sync: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-14.5 7.1"></path><path d="M3 12A9 9 0 0 1 17.5 4.9"></path><path d="M18 2v5h-5"></path><path d="M6 22v-5h5"></path></svg>',
                link: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>',
                edit: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
                alert: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
            };

            const syncWithCivitai = (loraName, card) => syncLoraWithCivitai({
                loraName,
                card,
                nodeInstance: this,
                loraIconSvg,
                operationFeedback,
            });
            const toggleLoraSelectionFromElement = (element, loraName) => {
                const existingIndex = this.loraData.findIndex(item => item.lora === loraName);
                const willSelect = existingIndex === -1;
                if (existingIndex > -1) {
                    this.loraData.splice(existingIndex, 1);
                } else {
                    this.loraData.push(buildLoraSelectionEntry({
                        element,
                        loraName,
                        lora: this.availableLoras.find(item => item.name === loraName),
                    }));
                }

                element.classList.toggle("selected-flow", willSelect);
                renderSelectedList();
                updateSelection();
                syncGallerySelectionSoon();
                updatePresetButtonText(null);
            };

            const bindMetadataEditButton = (element, editBtn) => {
                editBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.activeEditingLoraName = null;

                    const loraName = element.dataset.loraName;
                    if (e.ctrlKey) {
                        if (this.selectedLoraNamesForEditing.has(loraName)) {
                            this.selectedLoraNamesForEditing.delete(loraName);
                            element.classList.remove("selected-edit");
                        } else {
                            this.selectedLoraNamesForEditing.add(loraName);
                            element.classList.add("selected-edit");
                        }
                    } else {
                        if (this.selectedLoraNamesForEditing.has(loraName) && this.selectedLoraNamesForEditing.size === 1) {
                            this.selectedLoraNamesForEditing.clear();
                            element.classList.remove("selected-edit");
                        } else {
                            document.querySelectorAll(`#${uniqueId} .locallora-lora-card.selected-edit`).forEach(c => c.classList.remove("selected-edit"));
                            this.selectedLoraNamesForEditing.clear();

                            this.selectedLoraNamesForEditing.add(loraName);
                            element.classList.add("selected-edit");
                        }
                    }

                    renderMetadataEditor();
                });
            };

            const renderGallery = (append = false) => {
                if (!append) galleryEl.innerHTML = "";
                const lorasToRender = this.availableLoras;
                const existingCardNames = new Set(Array.from(galleryEl.querySelectorAll('.locallora-lora-card')).map(c => c.dataset.loraName));

                lorasToRender.forEach(lora => {
                    if (append && existingCardNames.has(lora.name)) return;

                    const isSelectedLora = this.loraData.some(item => item.lora === lora.name);
                    const card = document.createElement("div");
                    card.className = `locallora-lora-card${isSelectedLora ? " selected-flow" : ""}`;
                    card.dataset.loraName = lora.name;
                    card.dataset.triggerWords = lora.trigger_words;
                    card.dataset.downloadUrl = lora.download_url;
                    card.title = lora.name;

                    const isSelectedForEditing = this.selectedLoraNamesForEditing.has(lora.name);
                    card.innerHTML = buildLoraCardHtml(lora, isSelectedLora, isSelectedForEditing, getLoraDisplayState().cards_display_mode === "compact", loraIconSvg);

                    setupLoraPresetControls(card, lora, {
                        nodeInstance: this,
                        widgetContainer,
                        uniqueId,
                        updateSelection,
                    });

                    const img = card.querySelector("img");
                    if (img) {
                        img.onerror = (e) => { e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; };
                    }
                    galleryEl.appendChild(card);

                    card.querySelector(".lora-card-link-btn")?.addEventListener("click", e => e.stopPropagation());
                    card.querySelector(".sync-civitai-btn").addEventListener("click", e => {
                        e.stopPropagation();
                        syncWithCivitai(lora.name, card);
                    });

                    if (isSelectedForEditing) card.classList.add("selected-edit");

                    if (lora.preview_type === 'video') {
                        const video = card.querySelector('video');
                        if (video) {
                            card.addEventListener('mouseenter', () => video.play().catch(() => {}));
                            card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
                        }
                    }

                    card.addEventListener("click", () => {
                        toggleLoraSelectionFromElement(card, card.dataset.loraName);
                    });

                    const editBtn = card.querySelector(".edit-tags-btn");
                    bindMetadataEditButton(card, editBtn);
                });
                syncSelectedCardStyles();
                reconcileNameSearch();
            };

            let lastReconciledQuery = "";
            let nameSearchFillGeneration = 0;
            const fillNameSearchResults = async (generation) => {
                // A query can hide most of the first page, so keep loading pages until the
                // viewport overflows or the catalog is exhausted; scroll-driven loading alone
                // would never fire while the filtered list is shorter than the viewport.
                let fetched = await fetchAndRender(false);
                while (fetched && generation === nameSearchFillGeneration
                    && this.currentPage < this.totalPages
                    && galleryEl.scrollHeight <= galleryEl.clientHeight + 400) {
                    fetched = await fetchAndRender(true);
                }
            };
            const reconcileNameSearch = () => {
                const query = searchInput.value.trim().toLowerCase();
                if (query !== lastReconciledQuery) {
                    lastReconciledQuery = query;
                    nameSearchFillGeneration += 1;
                    void fillNameSearchResults(nameSearchFillGeneration);
                }
                galleryEl.querySelectorAll(".locallora-lora-card").forEach(card => {
                    card.hidden = Boolean(query && !card.dataset.loraName.toLowerCase().includes(query));
                });
            };

            const renderCurrentView = (append = false) => {
                renderGallery(append);
            };

            let loraFetchSequence = 0;
            let pendingFetchAfterLoad = null;
            const activeLoraInfoHydratedNames = new Set();

            const markHydratedActiveLoraNames = (loras) => {
                const loraNames = new Set(loras.map(lora => lora.name));
                this.loraData.forEach(item => {
                    if (loraNames.has(item.lora)) activeLoraInfoHydratedNames.add(item.lora);
                });
            };

            const hydrateMissingActiveLoraInfo = async () => {
                const availableNames = new Set(this.availableLoras.map(lora => lora.name));
                const loraNames = [...new Set(this.loraData
                    .map(item => item.lora)
                    .filter(name => name && !availableNames.has(name) && !activeLoraInfoHydratedNames.has(name)))];
                if (!loraNames.length) return;

                // The browser request must retain its filters, order, and pagination. Fetch only
                // missing Active Stack metadata separately, because workflow selection persistence
                // intentionally omits preview fields.
                const loraInfoChunks = [];
                for (let index = 0; index < loraNames.length; index += 200) {
                    loraInfoChunks.push(loraNames.slice(index, index + 200));
                }
                const responses = await Promise.all(loraInfoChunks.map(async names => {
                    const data = await loraApi.getLoras(
                        "",
                        "OR",
                        "",
                        1,
                        names,
                        names.length,
                        getLoraDisplayState().sort_mode,
                    );
                    return { names, loras: data.loras || [] };
                }));
                responses.forEach(({ names, loras }) => {
                    hydrateSelectedLoraInfo(loras);
                    const returnedNames = new Set(loras.map(lora => lora.name));
                    names.forEach(name => {
                        if (returnedNames.has(name)) activeLoraInfoHydratedNames.add(name);
                    });
                });
            };

            const fetchAndRender = async (append = false) => {
                if (this.isLoading) {
                    pendingFetchAfterLoad = pendingFetchAfterLoad === false ? false : append;
                    return true;
                }
                const fetchSequence = ++loraFetchSequence;
                const pageToFetch = append ? this.currentPage + 1 : 1;
                if (append && pageToFetch > this.totalPages) return true;
                try {
                    // Keep browser sorting and pagination independent from the Active Stack.
                    const { loras, folders } = await UnifiedLoraGalleryNode.getLoras.call(this, "", "OR", folderFilterSelect.value, pageToFetch, [], 50, getLoraDisplayState().sort_mode);
                    if (fetchSequence !== loraFetchSequence) return;

                    if (append) {
                        const existingNames = new Set(this.availableLoras.map(l => l.name));
                        this.availableLoras.push(...(loras || []).filter(l => !existingNames.has(l.name)));
                    } else {
                        this.availableLoras = loras || [];
                        if (!foldersRendered && folders && folders.length > 0) renderFolders(folders);
                        galleryEl.scrollTop = 0;
                    }
                    hydrateSelectedLoraInfo();
                    markHydratedActiveLoraNames(this.availableLoras);
                    try {
                        await hydrateMissingActiveLoraInfo();
                    } catch (error) {
                        console.error("LocalLoraGallery: Failed to hydrate Active Stack metadata:", error);
                    }
                    renderCurrentView(append);
                    return true;
                } catch (error) {
                    console.error("LocalLoraGallery: Keeping the current gallery after a refresh failure:", error);
                    operationFeedback.warning("Could not refresh LoRAs. Showing previous results.", {
                        action: () => fetchAndRender(false),
                        actionLabel: "Retry",
                    });
                    return false;
                } finally {
                    if (fetchSequence === loraFetchSequence && pendingFetchAfterLoad !== null) {
                        const nextAppend = pendingFetchAfterLoad;
                        pendingFetchAfterLoad = null;
                        fetchAndRender(nextAppend);
                    }
                }
            };

            let foldersRendered = false;
            const renderFolders = (folders) => {
                if (foldersRendered) return;
                folderController.syncFolders(folders);
                const currentVal = folderFilterSelect.value;
                folderFilterSelect.innerHTML = `<option value="">All Folders</option>`;
                lotteryFolderSelect.innerHTML = `<option value="">All folders</option>`;
                folderController.getFoldersInCurrentOrder(folders).forEach(folder => {
                    const option = document.createElement("option");
                    option.value = folder;
                    option.textContent = getFolderLabel(folder);
                    folderFilterSelect.appendChild(option);
                    lotteryFolderSelect.appendChild(option.cloneNode(true));
                });
                folderFilterSelect.value = currentVal;
                if (!folders.includes(lotteryFolderValue)) lotteryFolderValue = "";
                lotteryFolderSelect.value = lotteryFolderValue;
                renderFolderPills();
                if (folders.length > 0) foldersRendered = true;
            };

            const applyPreset = async (name, stack) => {
                popovers.close();
                operationFeedback.pending(`Applying preset "${name}"...`);
                this.loraData = cloneJsonOr(stack, []);
                renderSelectedList();
                updateSelection();
                const refreshed = await fetchAndRender(false);
                renderSelectedList();
                updatePresetButtonText(name);
                if (refreshed) {
                    operationFeedback.success(`Preset "${name}" applied to workflow`);
                } else {
                    operationFeedback.warning(`Preset "${name}" applied. Gallery refresh failed.`, {
                        action: () => fetchAndRender(false),
                        actionLabel: "Retry",
                    });
                }
            };

            const deletePreset = async (name, button) => {
                if (!confirmAction(`Delete preset "${name}"?`)) return;
                button.disabled = true;
                operationFeedback.pending(`Deleting preset "${name}"...`);
                try {
                    const data = await loraApi.deletePreset(name);
                    if (loadPresetBtn.dataset.currentPreset === name) updatePresetButtonText(null);
                    renderPresets(data.presets);
                    operationFeedback.success(`Preset "${name}" deleted`);
                } catch (error) {
                    button.disabled = false;
                    operationFeedback.error(error?.message || "Could not delete LoRA preset");
                }
            };

            const renderPresets = (presets) => {
                const rows = Object.keys(presets).map(name => {
                    const row = document.createElement("div");
                    row.className = "lora-preset-row";
                    const loadBtn = document.createElement("button");
                    loadBtn.type = "button";
                    loadBtn.className = "lora-preset-load";
                    loadBtn.classList.toggle("active", loadPresetBtn.dataset.currentPreset === name);
                    loadBtn.dataset.presetName = name;
                    loadBtn.textContent = name;
                    loadBtn.title = `Replace the active stack with "${name}"`;
                    loadBtn.addEventListener("click", () => applyPreset(name, presets[name]));
                    const deleteBtn = document.createElement("button");
                    deleteBtn.type = "button";
                    deleteBtn.className = "lg-icon-btn";
                    deleteBtn.title = `Delete "${name}"`;
                    deleteBtn.setAttribute("aria-label", `Delete preset ${name}`);
                    deleteBtn.innerHTML = icon("close");
                    deleteBtn.addEventListener("click", () => deletePreset(name, deleteBtn));
                    row.append(loadBtn, deleteBtn);
                    return row;
                });
                if (!rows.length) {
                    const empty = document.createElement("p");
                    empty.className = "lg-empty";
                    empty.textContent = "No presets yet.";
                    rows.push(empty);
                }
                presetDropdown.replaceChildren(...rows);
            };

            const syncSavePresetButton = () => {
                savePresetBtn.disabled = !presetNameInput.value.trim() || this.loraData.length === 0;
            };

            const savePreset = async () => {
                const presetName = presetNameInput.value.trim();
                if (!presetName || this.loraData.length === 0) return;
                savePresetBtn.disabled = true;
                operationFeedback.pending(`Saving preset "${presetName}"...`);
                try {
                    const data = await loraApi.savePreset(presetName, this.loraData);
                    presetNameInput.value = "";
                    updatePresetButtonText(presetName);
                    renderPresets(data.presets);
                    operationFeedback.success(`Preset "${presetName}" saved to gallery`);
                } catch (error) {
                    operationFeedback.error(error?.message || "Could not save LoRA preset");
                } finally {
                    syncSavePresetButton();
                }
            };

            const loadPresets = async () => {
                try {
                    const presets = await loraApi.getPresets();
                    renderPresets(presets);
                } catch (e) {
                    console.error("LocalLoraGallery: Failed to load presets", e);
                    operationFeedback.error(e?.message || "Could not load LoRA presets", {
                        action: loadPresets,
                        actionLabel: "Retry",
                    });
                }
            };

            const { getEditingLorasData, renderMetadataEditor, commitStrengthMemoryEdits } = createLoraMetadataController({
                nodeInstance: this,
                metadataEditor,
                selectedCountEl,
                metadataEditorSelectionLabel,
                metadataEditorTitle,
                metadataEditorCloseBtn,
                useLastOutputThumbnailBtn,
                thumbnailActionLabel,
                thumbnailActionStatus,
                triggerEditorInput,
                triggerEditorRow,
                urlEditorInput,
                urlEditorRow,
                triggerPresetEditorRow,
                triggerPresetToggleBtn,
                triggerPresetContent,
                triggerPresetCount,
                triggerPresetList,
                triggerPresetNameInput,
                triggerPresetValueInput,
                addTriggerPresetBtn,
                strengthMemoryRow,
                strengthMemoryEnableInput,
                strengthMemoryModelInput,
                strengthMemoryClipInput,
                getLoraMetadataByName,
                updateCachedLoraMetadata,
                findGalleryCardByLoraName,
                linkIconSvg: loraIconSvg.link,
                updateMetadata: (...args) => UnifiedLoraGalleryNode.updateMetadata(...args),
                getLastOutput: () => UnifiedLoraGalleryNode.lastOutput,
                assignThumbnail: (...args) => loraApi.assignThumbnail(...args),
                renderCurrentView,
                renderSelectedList,
                updateSelection,
                operationFeedback,
                onClose: clearMetadataEditing,
            });
            this.initializeNode = async () => {
                let initialState = {
                    filter_folder: "",
                    active_display_mode: "thumbnails",
                    cards_display_mode: "thumbnails",
                    card_contrast_mode: "off",
                    sort_mode: "az",
                    active_thumbnail_size_px: 96,
                    thumbnail_size_px: 168,
                    move_active_loras_to_top: true,
                    show_clip_weights: true,
                    folder_colors: {},
                    folder_order: [],
                };

                try {
                    const savedSelection = JSON.parse(this.properties.lora_selection_data || "[]");
                    const savedExecution = savedSelection && !Array.isArray(savedSelection)
                        ? savedSelection.execution
                        : null;
                    if (savedExecution && typeof savedExecution === "object") {
                        this.properties.lora_execution_mode = savedExecution.mode === "compare" ? "compare" : "stack";
                        this.properties.lora_compare_strengths = String(savedExecution.strengths || "1.0");
                    }
                    syncLotteryControls(readLoraLotteryConfig(savedSelection));
                    this.loraData = readSelectionArray(this.properties.lora_selection_data, []);
                } catch (e) {
                    console.warn("LocalLoraGallery: Failed to parse lora_selection_data, resetting.", e);
                }

                try {
                    let loadedState = readWorkflowProfileSection(this, "lora_ui");
                    if (!loadedState) {
                        // One-time compatibility migration for workflows saved
                        // before UI profiles lived inside the node.
                        loadedState = await loraApi.getUiState(this.id, this.properties.lora_gallery_unique_id);
                    }
                    if (loadedState) {
                        if (loadedState.folder_colors && typeof loadedState.folder_colors !== "object") {
                            loadedState.folder_colors = {};
                        }
                        if (loadedState.folder_order && !Array.isArray(loadedState.folder_order)) {
                            loadedState.folder_order = [];
                        }
                    }
                    initialState = { ...initialState, ...loadedState };
                } catch(e) {
                    console.error("LocalLoraGallery: Failed to get initial UI state.", e);
                }
                this.loraUiState = { ...initialState };
                writeWorkflowProfileSection(this, "lora_ui", this.loraUiState);
                applyLoraDisplayState();
                syncExecutionControls();

                persistSelectionData();

                // These requests are independent once UI state is known.
                await Promise.all([loadPresets(), fetchAndRender()]);

                let needs_refetch = false;
                const savedFolderOption = Array.from(folderFilterSelect.options)
                    .find(option => option.value === initialState.filter_folder);
                if (initialState.filter_folder && savedFolderOption) {
                    if (folderFilterSelect.value !== initialState.filter_folder) {
                        folderFilterSelect.value = initialState.filter_folder;
                        renderFolderPills();
                        needs_refetch = true;
                    }
                }

                renderSelectedList();

                if (needs_refetch) {
                    await fetchAndRender();
                }
            };

            const bindEventListeners = () => {
                executionModeBtn?.addEventListener("click", () => {
                    const nextMode = executionModeBtn.dataset.mode === "compare" ? "stack" : "compare";
                    setExecutionProperty("lora_execution_mode", nextMode);
                    persistSelectionData();
                    syncExecutionControls();
                });

                compareStrengthsInput?.addEventListener("change", () => {
                    const strengths = compareStrengthsInput.value.trim() || "1.0";
                    setExecutionProperty("lora_compare_strengths", strengths);
                    persistSelectionData();
                    compareStrengthsInput.value = strengths;
                });

                popovers.register(folderMoreBtn, folderOverflow, renderFolderPills);
                popovers.register(searchBtn, searchPopover);
                popovers.register(loadPresetBtn, presetPopover, () => {
                    syncSavePresetButton();
                    return loadPresets();
                });
                popovers.register(lotteryBtn, lotteryPopover);
                popovers.register(displayOptionsBtn, displayOptionsPopover, syncDisplayOptionControls);
                [lotteryEnabledInput, lotteryFolderSelect, lotteryStrengthInput, lotteryClipStrengthInput]
                    .forEach(control => control?.addEventListener("change", () => {
                        if (control === lotteryFolderSelect) lotteryFolderValue = lotteryFolderSelect.value;
                        syncLotteryControls();
                        updateSelection();
                    }));

                globalListeners.listen(document, "keydown", (e) => {
                    if (e.key === "Escape" && metadataEditor.classList.contains("visible")) {
                        clearMetadataEditing();
                    }
                });

                globalListeners.listen(document, "pointerdown", (event) => {
                    if (!metadataEditor.classList.contains("visible")) return;
                    if (metadataEditor.contains(event.target)) return;
                    // Commit typed strength-memory values before the editing selection is
                    // cleared; a number input's change event fires after pointerdown.
                    void commitStrengthMemoryEdits();
                    if (event.target.closest?.(`#${uniqueId} .edit-tags-btn, #${uniqueId} .lora-active-preview-btn`)) return;
                    clearMetadataEditing();
                });

                presetNameInput.addEventListener("input", syncSavePresetButton);
                presetNameInput.addEventListener("keydown", (event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    void savePreset();
                });
                savePresetBtn.addEventListener("click", savePreset);

                widgetContainer.querySelector(".lora-active-display-mode")?.addEventListener("change", (event) => {
                    this.loraUiState.active_display_mode = normalizeLoraDisplayMode(event.target.value);
                    applyLoraDisplayState();
                    renderSelectedList();
                    queueLoraDisplayStateSave();
                    this.setDirtyCanvas(true, true);
                });

                widgetContainer.querySelector(".lora-active-large-cards-checkbox")?.addEventListener("change", (event) => {
                    this.loraUiState.active_card_size_mode = event.target.checked ? "large" : "default";
                    applyLoraDisplayState();
                    renderSelectedList();
                    queueLoraDisplayStateSave();
                    this.setDirtyCanvas(true, true);
                });

                widgetContainer.querySelector(".lora-show-clip-weights-checkbox")?.addEventListener("change", (event) => {
                    this.loraUiState.show_clip_weights = Boolean(event.target.checked);
                    applyLoraDisplayState();
                    renderSelectedList();
                    queueLoraDisplayStateSave();
                    this.setDirtyCanvas(true, true);
                });

                widgetContainer.querySelector(".lora-cards-display-mode")?.addEventListener("change", (event) => {
                    this.loraUiState.cards_display_mode = normalizeLoraDisplayMode(event.target.value);
                    applyLoraDisplayState();
                    renderCurrentView(false);
                    queueLoraDisplayStateSave();
                    this.setDirtyCanvas(true, true);
                });

                widgetContainer.querySelector(".lora-move-active-to-top-checkbox")?.addEventListener("change", async (event) => {
                    this.loraUiState.move_active_loras_to_top = Boolean(event.target.checked);
                    syncGallerySelectionSoon();
                    await persistLoraUiState({
                        move_active_loras_to_top: this.loraUiState.move_active_loras_to_top,
                    });
                });

                widgetContainer.querySelector(".lora-dim-unselected-checkbox").addEventListener("change", (event) => {
                    this.loraUiState.card_contrast_mode = event.target.checked ? "dim_inactive" : "off";
                    applyLoraDisplayState();
                    queueLoraDisplayStateSave();
                });

                widgetContainer.querySelector(".lora-auto-hide-bar-checkbox").addEventListener("change", (event) => {
                    this.loraUiState.auto_hide_toolbars = event.target.checked;
                    autoHideBar.sync();
                    queueLoraDisplayStateSave();
                });

                widgetContainer.querySelector(".lora-active-thumbnail-size-slider")?.addEventListener("input", (event) => {
                    if (event.target.disabled) return;
                    this.loraUiState.active_thumbnail_size_px = clampInteger(
                        event.target.value,
                        LORA_DISPLAY_LIMITS.activeThumbnailMin,
                        LORA_DISPLAY_LIMITS.activeThumbnailMax,
                        96,
                    );
                    applyLoraDisplayState();
                    queueLoraDisplayStateSave();
                    this.setDirtyCanvas(true, true);
                });
                widgetContainer.querySelector(".lora-active-thumbnail-size-slider")?.addEventListener("change", async (event) => {
                    if (event.target.disabled) return;
                    this.loraUiState.active_thumbnail_size_px = clampInteger(
                        event.target.value,
                        LORA_DISPLAY_LIMITS.activeThumbnailMin,
                        LORA_DISPLAY_LIMITS.activeThumbnailMax,
                        96,
                    );
                    applyLoraDisplayState();
                    await flushLoraDisplayStateSave();
                });

                widgetContainer.querySelector(".lora-thumbnail-size-slider")?.addEventListener("input", (event) => {
                    if (event.target.disabled) return;
                    this.loraUiState.thumbnail_size_px = clampInteger(
                        event.target.value,
                        LORA_DISPLAY_LIMITS.cardThumbnailMin,
                        LORA_DISPLAY_LIMITS.cardThumbnailMax,
                        168,
                    );
                    applyLoraDisplayState();
                    queueLoraDisplayStateSave();
                });
                widgetContainer.querySelector(".lora-thumbnail-size-slider")?.addEventListener("change", async (event) => {
                    if (event.target.disabled) return;
                    this.loraUiState.thumbnail_size_px = clampInteger(
                        event.target.value,
                        LORA_DISPLAY_LIMITS.cardThumbnailMin,
                        LORA_DISPLAY_LIMITS.cardThumbnailMax,
                        168,
                    );
                    applyLoraDisplayState();
                    await flushLoraDisplayStateSave();
                });

                widgetContainer.querySelector(".lora-sort-select")?.addEventListener("change", async (event) => {
                    this.loraUiState.sort_mode = normalizeLoraSortMode(event.target.value);
                    syncDisplayOptionControls();
                    await persistLoraUiState({ sort_mode: this.loraUiState.sort_mode });
                    await fetchAndRender(false);
                });

                activeStackBtn.addEventListener("click", () => {
                    const shouldOpen = !mainContainer.classList.contains("active-stack-open");
                    mainContainer.classList.toggle("active-stack-open", shouldOpen);
                    activeStackBtn.classList.toggle("open", shouldOpen);
                    activeStackBtn.setAttribute("aria-pressed", String(shouldOpen));
                });

                widgetContainer.querySelector(".lora-active-clear-btn")?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    clearAllLoras();
                });

                let nameSearchTimer = null;
                const queueNameSearchReconciliation = (immediate = false) => {
                    if (nameSearchTimer) clearTimeout(nameSearchTimer);
                    const apply = () => {
                        nameSearchTimer = null;
                        reconcileNameSearch();
                    };
                    if (immediate) apply();
                    else nameSearchTimer = setTimeout(apply, 120);
                };
                searchInput.addEventListener("input", () => {
                    searchBtn.classList.toggle("active", Boolean(searchInput.value));
                    clearNameSearchBtn.hidden = !searchInput.value;
                    queueNameSearchReconciliation();
                });
                searchInput.addEventListener("keydown", (event) => {
                    if (event.key === "Escape") searchBtn.focus();
                });
                clearNameSearchBtn.hidden = true;
                clearNameSearchBtn.addEventListener("click", () => {
                    searchInput.value = "";
                    searchBtn.classList.remove("active");
                    clearNameSearchBtn.hidden = true;
                    queueNameSearchReconciliation(true);
                    searchInput.focus();
                });
                globalListeners.listen(document, 'click', (e) => {
                    const hitPortaledPresetMenu = Boolean(
                        e.target.closest?.(".lora-trigger-preset-popover-portal"),
                    );
                    if (
                        !hitPortaledPresetMenu
                        && !e.target.closest?.(`#${uniqueId} .lora-active-stack-btn, #${uniqueId}-active-sidebar`)
                    ) {
                        closeActiveStack();
                    }
                    if (
                        !hitPortaledPresetMenu
                        && !e.target.closest?.(`#${uniqueId} .lora-trigger-preset-picker`)
                    ) {
                        widgetContainer.querySelectorAll(".lora-trigger-preset-picker.open").forEach(openPicker => {
                            openPicker._closeLoraPresetPopover?.();
                        });
                    }
                });

                globalListeners.listen(document, "keydown", event => {
                    if (event.key === "Escape") folderController.cancelDrag();
                });
                globalListeners.listen(window, "pointermove", onLoraFolderPointerMove);
                globalListeners.listen(window, "pointerup", onLoraFolderPointerUp);
                globalListeners.listen(window, "pointercancel", onLoraFolderPointerCancel);

                // Clean up on node removal
                const originalOnRemoved = this.onRemoved;
                this.onRemoved = function () {
                    const wasResizingSidebar = splitter?.classList.contains("dragging");
                    globalListeners.cleanup();
                    removeSidebarMouseMove = null;
                    removeSidebarMouseUp = null;
                    splitter?.classList.remove("dragging");
                    if (wasResizingSidebar) {
                        document.body.style.cursor = "";
                        document.body.style.userSelect = "";
                    }
                    if (loraDisplayStateSaveTimer) {
                        clearTimeout(loraDisplayStateSaveTimer);
                        loraDisplayStateSaveTimer = null;
                    }
                    loraDisplayStateSaveQueued = false;
                    if (selectionSyncFrame !== null) {
                        cancelAnimationFrame(selectionSyncFrame);
                        selectionSyncFrame = null;
                    }
                    if (browserCardLayoutFrame !== null) {
                        cancelAnimationFrame(browserCardLayoutFrame);
                        browserCardLayoutFrame = null;
                    }
                    browserCardLayoutObserver?.disconnect();
                    browserCardLayoutObserver = null;
                    if (nameSearchTimer) {
                        clearTimeout(nameSearchTimer);
                        nameSearchTimer = null;
                    }
                    document.querySelectorAll(".lora-trigger-preset-popover-portal").forEach(popover => {
                        if (popover.dataset.loraPortalOwner !== uniqueId) return;
                        popover._restoreLoraPresetPopover?.();
                        if (popover.isConnected && !widgetContainer.contains(popover)) popover.remove();
                    });
                    folderController.dispose();
                    popovers.dispose();
                    autoHideBar.dispose();
                    activeStackController.dispose();
                    flushRememberedStrengthTimers();
                    operationFeedback.dispose();
                    closePillMenu();
                    if (originalOnRemoved) originalOnRemoved.call(this);
                };
            };

            this.onResize = function(size) {
                if (size[1] < MIN_NODE_HEIGHT) size[1] = MIN_NODE_HEIGHT;
                if (size[0] < MIN_NODE_WIDTH) size[0] = MIN_NODE_WIDTH;
            };

            bindEventListeners();
            if (typeof ResizeObserver === "function") {
                browserCardLayoutObserver = new ResizeObserver(scheduleBrowserCardLayout);
                browserCardLayoutObserver.observe(galleryEl);
            }
            scheduleBrowserCardLayout();
            setTimeout(() => this.initializeNode(), 1);

            return result;
        };
    }
};

return {
    async beforeRegisterNodeDef(nodeType, nodeData) {
        UnifiedLoraGalleryNode.setup(nodeType, nodeData);
    },
    async setup() {
        api.addEventListener("executed", (event) => {
            const output = event.detail?.output || {};
            const results = output.images?.length ? output.images : output.gifs;
            if (!results?.length) return;

            const last = results[results.length - 1];
            if (!last?.filename) return;
            UnifiedLoraGalleryNode.lastOutput = {
                filename: last.filename,
                subfolder: last.subfolder || "",
                type: last.type || "output",
            };

            document.querySelectorAll(".use-last-output-thumbnail-btn").forEach((button) => {
                if (button.dataset.selectionEligible !== "true") return;
                button.disabled = false;
                const status = button.closest(".lora-thumbnail-editor-action")
                    ?.querySelector(".lora-thumbnail-action-status");
                if (status) status.textContent = "Ready to use the latest result";
                button.title = "Use the latest generated image";
                status?.classList.remove("is-visible");
            });
        });
    },
};
}

