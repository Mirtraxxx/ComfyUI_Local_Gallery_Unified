import * as loraApi from "../api/loraApi.js";
import { escapeHtml } from "../shared/dom.js";
import { createEventListenerRegistry } from "../shared/events.js?v=unified-listener-cleanup-20260712";
import { cloneJsonOr, readSelectionArray, writeSelectionArray } from "../shared/json.js";
import {
    LORA_DISPLAY_LIMITS,
    clampInteger,
    normalizeLoraContrastMode,
    normalizeLoraDisplayMode,
    normalizeLoraDisplayState,
    normalizeLoraSortMode,
    normalizeVisiblePinnedFolderCount,
} from "./displayState.js?v=lora-refactor-20260712";
import { buildLoraCardHtml } from "./renderers.js?v=repository-review-20260712";
import { createLoraActiveStackController } from "./activeStackController.js?v=lora-active-stack-20260721-1";
import { createLoraMetadataController } from "./metadataEditor.js?v=repository-review-20260712";
import { createLoraFolderController } from "./folderController.js?v=lora-refactor-20260712";
import { syncLoraWithCivitai } from "./civitaiSync.js?v=repository-review-20260712";
import { buildLoraSelectionEntry } from "./selectionEntry.js?v=lora-refactor-20260712";
import { setupLoraPresetControls } from "./presetControls.js?v=lora-refactor-20260712";
import { toSerializableLoraSelection } from "./selectionState.js?v=lora-refactor-20260712";
import { setupLoraStateWidgets } from "./stateWidgets.js";
import { getLoraStyles } from "./styles.js?v=bottom-bar-search-20260718-1";
import { getLoraReferenceUxStyles } from "./referenceUx.js?v=density-transform-20260714-1";

export function createLoraGalleryLifecycle(app) {
const UnifiedLoraGalleryNode = {
    name: "LocalLoraGallery",
    isLoading: false,
    currentPage: 1,
    totalPages: 1,
    
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
            await loraApi.updateMetadata(lora_name, data);
        } catch(e) {
            console.error("LocalLoraGallery: Failed to update metadata", e);
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
            
            const HEADER_HEIGHT = 90;
            const MIN_NODE_WIDTH = 600;

            this.size = [700, 600];
            this.loraData = [];
            this.availableLoras = [];
            this.isModelOnly = nodeData.name.includes("ModelOnly");
            this.selectedLoraNamesForEditing = new Set();
            this.activeEditingLoraName = null;
            this.loraUiState = {};

            const widgetContainer = document.createElement("div");
            widgetContainer.className = "locallora-container-wrapper";
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
            widgetContainer.innerHTML = `
                ${getLoraStyles(uniqueId)}
                ${getLoraReferenceUxStyles(uniqueId)}
                <div id="${uniqueId}" style="height: 100%;">
                    <div class="locallora-container">
                        <div class="locallora-controls">
                            <div class="locallora-controls-row locallora-primary-controls">
                                <button class="lora-active-stack-btn empty" type="button" title="Active LoRAs" aria-label="Active LoRAs" aria-pressed="false"><span class="lora-active-stack-count">0</span></button>
                                <div class="lora-folder-nav">
                                    <div class="lora-folder-first-row">
                                        <div class="lora-folder-strip"></div>
                                    </div>
                                    <div class="lora-folder-overflow-wrapper">
                                        <div class="lora-folder-overflow">
                                            <div class="lora-folder-overflow-chips"></div>
                                        </div>
                                        <button class="lora-folder-pull-tab" type="button" aria-expanded="false" title="Show all LoRA folders">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="locallora-controls-row locallora-hidden-filters" aria-hidden="true">
                                <button class="toggle-all-btn">Toggle All</button>
                                <button class="clear-all-btn" title="Clear all selected LoRAs">Clear All</button>
                                <button class="toggle-gallery-btn" title="Toggle Gallery">Hide Gallery</button>
                            </div>
                            
                            <div class="locallora-metadata-editor">
                                <div class="locallora-controls-row">
                                    <label style="font-size:12px;">Edit Tags (<span class="selected-count">0</span>):</label>
                                    <div class="tag-editor-list lora-card-tags" style="flex-grow:1;"></div>
                                    <input type="text" class="tag-editor-input" placeholder="Add tag..." style="width: 100px;">
                                </div>
                                <div class="locallora-controls-row trigger-editor-row" style="display:none;">
                                    <label style="font-size:12px;">Triggers:</label>
                                    <input type="text" class="trigger-editor-input" placeholder="Enter trigger words..." style="flex-grow: 1;">
                                </div>
                                <div class="locallora-controls-row url-editor-row" style="display:none;">
                                    <label style="font-size:12px;">URL:</label>
                                    <input type="text" class="url-editor-input" placeholder="Enter download URL..." style="flex-grow: 1;">
                                </div>
                                <div class="locallora-controls-row trigger-preset-editor-row" style="display:none; flex-direction: column; align-items: stretch; gap: 4px;">
                                    <label style="font-size:12px;">Trigger Presets:</label>
                                    <div class="trigger-preset-list" style="display: flex; flex-direction: column; gap: 2px;"></div>
                                    <div style="display: flex; gap: 4px;">
                                        <input type="text" class="trigger-preset-name-input" placeholder="Name..." style="width: 80px;">
                                        <input type="text" class="trigger-preset-value-input" placeholder="Triggers..." style="flex-grow: 1;">
                                        <button class="add-trigger-preset-btn" style="padding: 2px 6px; font-size: 10px; border-radius: 4px; border: 1px solid #555; background: #333; color: #ccc; cursor: pointer;">Add</button>
                                    </div>
                                </div>
                            </div>

                            <div class="locallora-controls-row locallora-hidden-filters" aria-hidden="true">
                                <button class="tag-filter-mode-btn" title="Click to switch filter mode">OR</button>
                                <div class="tag-filter-input-wrapper">
                                    <input type="text" class="tag-filter-input" placeholder="Filter by Tag...">
                                    <button class="clear-tag-filter-btn" title="Clear Tag Filter">x</button>
                                </div>
                                <div class="locallora-multiselect-tag">
                                    <div class="locallora-multiselect-tag-display">
                                        Select Tags
                                        <span class="locallora-multiselect-arrow">v</span>
                                    </div>
                                    <div class="locallora-multiselect-tag-dropdown"></div>
                                </div>
                            </div>
                            <select class="folder-filter-select">
                                <option value="">All Folders</option>
                            </select>
                        </div>
                        <div class="locallora-body-shell">
                            <aside class="locallora-active-sidebar" id="${uniqueId}-active-sidebar">
                                <div class="locallora-active-sidebar-header">
                                    <div class="locallora-active-sidebar-title">
                                        <span>Active LoRAs</span>
                                        <span id="${uniqueId}-active-count">0 selected</span>
                                    </div>
                                    <button class="lora-active-clear-btn" type="button" title="Clear all selected LoRAs">Clear All</button>
                                </div>
                                <div class="locallora-active-sidebar-content">
                                    <div class="locallora-active-chips" id="${uniqueId}-active-chips"></div>
                                </div>
                                <div class="locallora-active-splitter" id="${uniqueId}-active-splitter"></div>
                            </aside>
                            <div class="locallora-gallery-pane">
                                <div class="locallora-gallery"><p>Loading LoRAs...</p></div>
                            </div>
                        </div>
                        <div class="locallora-bottom-bar">
                            <div class="lora-search-anchor">
                                <button class="lora-action-btn lora-search-btn" type="button" title="Search LoRAs by name" aria-label="Search LoRAs by name" aria-expanded="false" aria-controls="${uniqueId}-search-popover">
                                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                                </button>
                                <div class="lora-search-popover" id="${uniqueId}-search-popover" style="display: none;">
                                    <input type="search" class="search-input" placeholder="Search LoRAs..." aria-label="Search LoRAs by name" autocomplete="off">
                                    <button class="lora-search-clear-btn" type="button" title="Clear search" aria-label="Clear search">&times;</button>
                                </div>
                            </div>
                            <button class="lora-action-btn save-preset-btn" title="Save current stack as preset" aria-label="Save LoRA preset">
                                <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><path d="M17 21v-8H7v8"></path><path d="M7 3v5h8"></path></svg>
                            </button>
                            <div class="locallora-preset-container">
                                <button class="lora-action-btn load-preset-btn" title="Load a saved preset" aria-label="Load LoRA preset">
                                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path><path d="M12 15V3"></path></svg>
                                </button>
                                <div class="preset-dropdown"></div>
                            </div>
                            <div class="lora-display-options-anchor">
                                <button class="lora-action-btn lora-settings-btn lora-display-options-btn" title="Display options" aria-label="Display options">
                                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7"></path><path d="M4 10V3"></path><path d="M12 21v-9"></path><path d="M12 8V3"></path><path d="M20 21v-5"></path><path d="M20 12V3"></path><path d="M2 14h4"></path><path d="M10 8h4"></path><path d="M18 16h4"></path></svg>
                                </button>
                                <div class="lora-display-options-popover" style="display: none;">
                                    <div class="lora-display-options-panel">
                                        <section class="lora-display-section">
                                            <div class="lora-display-section-title">ACTIVE</div>
                                            <select class="lora-display-mode-select lora-active-display-mode" title="Active display mode">
                                                <option value="thumbnails">Thumbnails</option>
                                                <option value="compact">Compact</option>
                                            </select>
                                            <label class="lora-thumbnail-size-control lora-active-size-control" title="Active LoRA thumbnail size">
                                                <span>-</span>
                                                <input class="lora-active-thumbnail-size-slider" type="range" min="72" max="156" step="1">
                                                <span>+</span>
                                            </label>
                                            <label class="lora-checkbox-option-label" title="Enable large card layout for active LoRAs">
                                                <input type="checkbox" class="lora-active-large-cards-checkbox">
                                                Large LoRA Cards
                                            </label>
                                            <label class="lora-checkbox-option-label" title="Show separate CLIP strength controls on active LoRAs">
                                                <input type="checkbox" class="lora-show-clip-weights-checkbox">
                                                Show CLIP weights
                                            </label>
                                        </section>
                                        <section class="lora-display-section">
                                            <div class="lora-display-section-title">CARDS</div>
                                            <select class="lora-display-mode-select lora-cards-display-mode" title="Cards display mode">
                                                <option value="thumbnails">Thumbnails</option>
                                                <option value="compact">Compact</option>
                                            </select>
                                            <label class="lora-thumbnail-size-control lora-cards-size-control" title="LoRA card thumbnail size">
                                                <span>-</span>
                                                <input class="lora-thumbnail-size-slider" type="range" min="112" max="260" step="1">
                                                <span>+</span>
                                            </label>
                                        </section>
                                        <section class="lora-display-section">
                                            <div class="lora-display-section-title">CONTRAST</div>
                                            <select class="lora-display-mode-select lora-card-contrast-select" title="Card contrast mode">
                                                <option value="off">Off (Default)</option>
                                                <option value="dim_inactive">Dim Inactive</option>
                                                <option value="dim_by_default">Dim by Default</option>
                                            </select>
                                        </section>
                                        <section class="lora-display-section">
                                            <div class="lora-display-section-title">SORT CARDS</div>
                                            <select class="lora-display-mode-select lora-sort-select" title="Sort LoRA cards">
                                                <option value="az">A to Z</option>
                                                <option value="za">Z to A</option>
                                                <option value="newest">Newest first</option>
                                                <option value="oldest">Oldest first</option>
                                            </select>
                                        </section>
                                        <section class="lora-display-section">
                                            <div class="lora-display-section-title">FOLDERS: <span class="lora-visible-folders-count-val">8</span></div>
                                            <label class="lora-thumbnail-size-control lora-folders-count-control" title="Visible pinned folders count">
                                                <span>1</span>
                                                <input class="lora-visible-folders-slider" type="range" min="1" max="25" step="1">
                                                <span>25</span>
                                            </label>
                                        </section>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            const mainContainer = widgetContainer.querySelector(".locallora-container");
            const selectedListEl = widgetContainer.querySelector(`#${uniqueId}-active-chips`);
            const galleryEl = widgetContainer.querySelector(".locallora-gallery");
            const searchInput = widgetContainer.querySelector(".search-input");
            const metadataEditor = widgetContainer.querySelector(".locallora-metadata-editor");
            const tagEditorList = widgetContainer.querySelector(".tag-editor-list");
            const tagEditorInput = widgetContainer.querySelector(".tag-editor-input");
            const triggerEditorRow = widgetContainer.querySelector(".trigger-editor-row");
            const triggerEditorInput = widgetContainer.querySelector(".trigger-editor-input");
            const urlEditorRow = widgetContainer.querySelector(".url-editor-row");
            const urlEditorInput = widgetContainer.querySelector(".url-editor-input");
            const triggerPresetEditorRow = widgetContainer.querySelector(".trigger-preset-editor-row");
            const triggerPresetList = widgetContainer.querySelector(".trigger-preset-list");
            const triggerPresetNameInput = widgetContainer.querySelector(".trigger-preset-name-input");
            const triggerPresetValueInput = widgetContainer.querySelector(".trigger-preset-value-input");
            const addTriggerPresetBtn = widgetContainer.querySelector(".add-trigger-preset-btn");
            const tagFilterInput = widgetContainer.querySelector(".tag-filter-input");
            const multiSelectTagContainer = widgetContainer.querySelector(".locallora-multiselect-tag");
            const multiSelectTagDisplay = multiSelectTagContainer.querySelector(".locallora-multiselect-tag-display");
            const multiSelectTagDropdown = multiSelectTagContainer.querySelector(".locallora-multiselect-tag-dropdown");
            const tagFilterModeBtn = widgetContainer.querySelector(".tag-filter-mode-btn");
            const toggleGalleryBtn = widgetContainer.querySelector(".toggle-gallery-btn");
            const activeStackBtn = widgetContainer.querySelector(".lora-active-stack-btn");
            const activeStackCount = widgetContainer.querySelector(".lora-active-stack-count");
            const selectedCountEl = widgetContainer.querySelector(".selected-count");
            const clearTagFilterBtn = widgetContainer.querySelector(".clear-tag-filter-btn");
            const folderFilterSelect = widgetContainer.querySelector(".folder-filter-select");
            const folderStrip = widgetContainer.querySelector(".lora-folder-strip");
            const folderOverflow = widgetContainer.querySelector(".lora-folder-overflow");
            const folderOverflowChips = widgetContainer.querySelector(".lora-folder-overflow-chips");
            const folderPullTab = widgetContainer.querySelector(".lora-folder-pull-tab");
            const savePresetBtn = widgetContainer.querySelector(".save-preset-btn");
            const loadPresetBtn = widgetContainer.querySelector(".load-preset-btn");
            const presetDropdown = widgetContainer.querySelector(".preset-dropdown");
            const displayOptionsBtn = widgetContainer.querySelector(".lora-display-options-btn");
            const displayOptionsPopover = widgetContainer.querySelector(".lora-display-options-popover");
            const searchAnchor = widgetContainer.querySelector(".lora-search-anchor");
            const searchBtn = widgetContainer.querySelector(".lora-search-btn");
            const searchPopover = widgetContainer.querySelector(".lora-search-popover");
            const clearNameSearchBtn = widgetContainer.querySelector(".lora-search-clear-btn");
            const getLoraChromeHeight = () => {
                const controlsEl = widgetContainer.querySelector(".locallora-controls");
                const bottomBarEl = widgetContainer.querySelector(".locallora-bottom-bar");
                return (controlsEl?.offsetHeight || 0) + (bottomBarEl?.offsetHeight || 0);
            };
            const getVisiblePinnedFolderCount = () => normalizeVisiblePinnedFolderCount(
                this.loraUiState?.visible_pinned_folder_count,
            );
            const getLoraDisplayState = () => normalizeLoraDisplayState(this.loraUiState);

            let loraDisplayStateSaveTimer = null;
            const persistLoraUiState = (extraState = {}) => {
                this.loraUiState = { ...this.loraUiState, ...extraState };
                return UnifiedLoraGalleryNode.setUiState(this.id, this.properties.lora_gallery_unique_id, {
                    filter_tag: tagFilterInput.value,
                    filter_mode: tagFilterModeBtn.textContent,
                    filter_folder: folderFilterSelect.value,
                    folder_colors: this.loraUiState.folder_colors,
                    pinned_folders: this.loraUiState.pinned_folders,
                    folder_order: this.loraUiState.folder_order,
                    visible_pinned_folder_count: this.loraUiState.visible_pinned_folder_count,
                    ...getLoraDisplayState(),
                    ...extraState,
                });
            };

            const queueLoraDisplayStateSave = () => {
                if (loraDisplayStateSaveTimer) clearTimeout(loraDisplayStateSaveTimer);
                loraDisplayStateSaveTimer = setTimeout(() => persistLoraUiState(), 250);
            };

            const syncDisplayOptionAvailability = () => {
                const state = getLoraDisplayState();
                const activeSlider = widgetContainer.querySelector(".lora-active-thumbnail-size-slider");
                const activeControl = widgetContainer.querySelector(".lora-active-size-control");
                const cardSlider = widgetContainer.querySelector(".lora-thumbnail-size-slider");
                const cardControl = widgetContainer.querySelector(".lora-cards-size-control");
                const activeEnabled = state.active_display_mode === "thumbnails";
                const cardsEnabled = state.cards_display_mode === "thumbnails";
                if (activeSlider) activeSlider.disabled = !activeEnabled;
                if (activeControl) {
                    activeControl.classList.toggle("disabled", !activeEnabled);
                    activeControl.title = activeEnabled ? "Active LoRA thumbnail size" : "Only available in Thumbnails mode";
                }
                if (cardSlider) cardSlider.disabled = !cardsEnabled;
                if (cardControl) {
                    cardControl.classList.toggle("disabled", !cardsEnabled);
                    cardControl.title = cardsEnabled ? "LoRA card thumbnail size" : "Only available in Thumbnails mode";
                }
            };

            const syncDisplayOptionControls = () => {
                const state = getLoraDisplayState();
                const activeModeSelect = widgetContainer.querySelector(".lora-active-display-mode");
                const cardsModeSelect = widgetContainer.querySelector(".lora-cards-display-mode");
                const contrastSelect = widgetContainer.querySelector(".lora-card-contrast-select");
                const sortSelect = widgetContainer.querySelector(".lora-sort-select");
                const foldersSlider = widgetContainer.querySelector(".lora-visible-folders-slider");
                if (activeModeSelect) activeModeSelect.value = state.active_display_mode;
                if (cardsModeSelect) cardsModeSelect.value = state.cards_display_mode;
                if (contrastSelect) contrastSelect.value = state.card_contrast_mode;
                if (sortSelect) sortSelect.value = state.sort_mode;
                if (foldersSlider) foldersSlider.value = getVisiblePinnedFolderCount();
                const foldersCountVal = widgetContainer.querySelector(".lora-visible-folders-count-val");
                if (foldersCountVal) foldersCountVal.textContent = getVisiblePinnedFolderCount();
                const largeCardsCheckbox = widgetContainer.querySelector(".lora-active-large-cards-checkbox");
                if (largeCardsCheckbox) {
                    largeCardsCheckbox.checked = state.active_card_size_mode === "large";
                }
                const showClipWeightsCheckbox = widgetContainer.querySelector(".lora-show-clip-weights-checkbox");
                if (showClipWeightsCheckbox) {
                    showClipWeightsCheckbox.checked = state.show_clip_weights;
                }
            };

            const applyLoraDisplayState = () => {
                const state = getLoraDisplayState();
                mainContainer.classList.toggle("active-mode-thumbnails", state.active_display_mode === "thumbnails");
                mainContainer.classList.toggle("active-mode-compact", state.active_display_mode === "compact");
                mainContainer.classList.toggle("cards-mode-thumbnails", state.cards_display_mode === "thumbnails");
                mainContainer.classList.toggle("cards-mode-compact", state.cards_display_mode === "compact");
                ["contrast-off", "contrast-dim-inactive", "contrast-dim-by-default"].forEach(cls => mainContainer.classList.remove(cls));
                mainContainer.classList.add(`contrast-${state.card_contrast_mode.replace(/_/g, "-")}`);
                mainContainer.style.setProperty("--lora-card-thumb-size", `${state.thumbnail_size_px}px`);
                mainContainer.style.setProperty("--lora-card-min-width", `${Math.max(118, Math.round(state.thumbnail_size_px * 0.78))}px`);
                mainContainer.style.setProperty("--lora-active-thumb-size", `${state.active_thumbnail_size_px}px`);
                mainContainer.style.setProperty("--lora-active-card-width", `${Math.round(state.active_thumbnail_size_px * 1.2)}px`);
                mainContainer.style.setProperty("--lora-active-card-height", `${Math.round(state.active_thumbnail_size_px * 1.5)}px`);
                mainContainer.style.setProperty("--lora-active-large-card-width", `${Math.round(state.active_thumbnail_size_px * 1.42)}px`);
                mainContainer.style.setProperty("--lora-active-large-card-height", `${Math.round(state.active_thumbnail_size_px * 1.95)}px`);
                mainContainer.style.setProperty("--locallora-active-sidebar-width", `${state.active_sidebar_width}px`);
                const sidebarEl = widgetContainer.querySelector(".locallora-active-sidebar");
                if (sidebarEl) {
                    sidebarEl.classList.toggle("large-mode", state.active_card_size_mode === "large");
                }
                syncDisplayOptionControls();
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
                    filter_tag: tagFilterInput.value,
                    filter_mode: tagFilterModeBtn.textContent,
                    filter_folder: folderFilterSelect.value,
                    folder_colors: this.loraUiState.folder_colors,
                    pinned_folders: this.loraUiState.pinned_folders,
                    folder_order: this.loraUiState.folder_order,
                    visible_pinned_folder_count: this.loraUiState.visible_pinned_folder_count,
                    ...getLoraDisplayState(),
                };
                this.loraUiState = { ...this.loraUiState, ...stateToSave };
                await UnifiedLoraGalleryNode.setUiState(this.id, this.properties.lora_gallery_unique_id, stateToSave);
                await fetchAndRender(false);
            };

            const folderController = createLoraFolderController({
                nodeInstance: this,
                widgetContainer,
                folderFilterSelect,
                folderStrip,
                folderOverflow,
                folderOverflowChips,
                folderPullTab,
                getVisiblePinnedFolderCount,
                saveStateAndFetch,
            });
            const {
                getFolderOptions,
                getFoldersInCurrentOrder,
                renderFolderPills,
                closeLoraFolderContextMenu,
                isContextMenuTarget,
                onLoraFolderPointerMove,
                onLoraFolderPointerUp,
                onLoraFolderPointerCancel,
            } = folderController;
            renderFolderPills();
            const persistSelectionData = () => {
                const serializableData = toSerializableLoraSelection(this.loraData);
                const selectionJson = writeSelectionArray(serializableData);
                this.setProperty("lora_selection_data", selectionJson);
                const widget = this.widgets.find(w => w.name === "lora_selection_data");
                if (widget) widget.value = selectionJson;
                return serializableData;
            };

            const updatePresetButtonText = (presetName = null) => {
                loadPresetBtn.classList.toggle("has-preset", Boolean(presetName));
                loadPresetBtn.dataset.currentPreset = presetName || "";
                loadPresetBtn.title = presetName ? `Current Preset: ${presetName}` : "Load a saved preset";
                loadPresetBtn.setAttribute("aria-label", presetName ? `Load LoRA preset. Current: ${presetName}` : "Load LoRA preset");
            };

            const closeActiveStack = () => {
                mainContainer.classList.remove("active-stack-open");
                activeStackBtn.classList.remove("open");
                activeStackBtn.setAttribute("aria-pressed", "false");
            };

            const clearAllLoras = () => {
                this.loraData = [];
                closeActiveStack();
                if (mainContainer.classList.contains("gallery-collapsed")) {
                    setTimeout(() => {
                        const contentHeight = getLoraChromeHeight();
                        if (!contentHeight) return;
                        this.size[1] = contentHeight + HEADER_HEIGHT;
                        this.setDirtyCanvas(true, true);
                    }, 0);
                }
                fetchAndRender(false);
                renderSelectedList();
                updateSelection();
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
                app.graph.setDirty(true);
                syncGallerySelectionSoon();
                this.setDirtyCanvas(true, true);
            };

            const syncSelectedCardStyles = (promoteSelected = false) => {
                const selectedLoras = new Set(this.loraData.map(item => item.lora));
                const cards = Array.from(galleryEl.querySelectorAll(".locallora-lora-card"));
                cards.forEach(card => {
                    card.classList.toggle("selected-flow", selectedLoras.has(card.dataset.loraName));
                });

                if (!promoteSelected || selectedLoras.size === 0 || cards.length === 0) return;

                const cardsByName = new Map(cards.map(card => [card.dataset.loraName, card]));
                const selectedCards = this.loraData
                    .map(item => cardsByName.get(item.lora))
                    .filter(Boolean);
                selectedCards.reverse().forEach(card => {
                    galleryEl.insertBefore(card, galleryEl.firstElementChild);
                });
            };

            const syncGallerySelectionSoon = () => {
                syncSelectedCardStyles(true);
                requestAnimationFrame(() => {
                    syncSelectedCardStyles(true);
                    requestAnimationFrame(() => syncSelectedCardStyles(true));
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
            
            const activeStackController = createLoraActiveStackController({
                nodeInstance: this,
                widgetContainer,
                selectedListEl,
                activeStackBtn,
                activeStackCount,
                mainContainer,
                metadataEditor,
                galleryEl,
                uniqueId,
                headerHeight: HEADER_HEIGHT,
                getLoraDisplayState,
                getLoraChromeHeight,
                closeActiveStack,
                clearMetadataEditing,
                findGalleryCardByLoraName,
                renderMetadataEditor: () => renderMetadataEditor(),
                updateSelection,
                fetchAndRender: (...args) => fetchAndRender(...args),
                renderCurrentView: (...args) => renderCurrentView(...args),
                updatePresetButtonText,
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
                renderCardTags,
                loadAllTags,
            });
            const promoteSelectedLorasInCurrentPage = () => {
                const selectedOrder = new Map(this.loraData.map((item, index) => [item.lora, index]));
                const currentOrder = new Map(this.availableLoras.map((lora, index) => [lora.name, index]));
                this.availableLoras = [...this.availableLoras].sort((a, b) => {
                    const aSelected = selectedOrder.has(a.name);
                    const bSelected = selectedOrder.has(b.name);
                    if (aSelected && bSelected) return selectedOrder.get(a.name) - selectedOrder.get(b.name);
                    if (aSelected) return -1;
                    if (bSelected) return 1;
                    return currentOrder.get(a.name) - currentOrder.get(b.name);
                });
            };

            const toggleLoraSelectionFromElement = async (element, loraName) => {
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
                promoteSelectedLorasInCurrentPage();
                renderCurrentView(false);
                syncGallerySelectionSoon();

                renderSelectedList();
                updateSelection();
                updatePresetButtonText(null);
                await fetchAndRender(false);
                renderSelectedList();
                syncGallerySelectionSoon();
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
                const nameFilter = searchInput.value.toLowerCase();
                const lorasToRender = this.availableLoras.filter(lora => lora.name.toLowerCase().includes(nameFilter));
                const existingCardNames = new Set(Array.from(galleryEl.querySelectorAll('.locallora-lora-card')).map(c => c.dataset.loraName));

                lorasToRender.forEach(lora => {
                    if (append && existingCardNames.has(lora.name)) return;
                    
                    const isSelectedLora = this.loraData.some(item => item.lora === lora.name);
                    const card = document.createElement("div");
                    card.className = `locallora-lora-card${isSelectedLora ? " selected-flow" : ""}`;
                    card.dataset.loraName = lora.name;
                    card.dataset.tags = lora.tags.join(',');
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

                    renderCardTags(card);
                    
                    if (lora.preview_type === 'video') {
                        const video = card.querySelector('video');
                        if (video) {
                            card.addEventListener('mouseenter', () => video.play().catch(e => {}));
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
            };

            const renderCurrentView = (append = false) => {
                renderGallery(append);
            };

            let loraFetchSequence = 0;
            let pendingFetchAfterLoad = null;
            
            const fetchAndRender = async (append = false) => {
                if (this.isLoading) {
                    pendingFetchAfterLoad = pendingFetchAfterLoad === false ? false : append;
                    return;
                }
                const fetchSequence = ++loraFetchSequence;
                const pageToFetch = append ? this.currentPage + 1 : 1;
                if (append && pageToFetch > this.totalPages) return;
                try {
                    const selectedLoras = this.loraData.map(item => item.lora);
                    const { loras, folders } = await UnifiedLoraGalleryNode.getLoras.call(this, tagFilterInput.value, tagFilterModeBtn.textContent, folderFilterSelect.value, pageToFetch, selectedLoras, 50, getLoraDisplayState().sort_mode); 
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
                    renderCurrentView(append);
                } catch (error) {
                    console.error("LocalLoraGallery: Keeping the current gallery after a refresh failure:", error);
                } finally {
                    if (fetchSequence === loraFetchSequence && pendingFetchAfterLoad !== null) {
                        const nextAppend = pendingFetchAfterLoad;
                        pendingFetchAfterLoad = null;
                        fetchAndRender(nextAppend);
                    }
                }
            };

            const handleTagSelectionChange = () => {
                const selectedTags = Array.from(multiSelectTagDropdown.querySelectorAll('input:checked')).map(cb => cb.value);
                tagFilterInput.value = selectedTags.join(',');
                saveStateAndFetch();
            };

            const loadAllTags = async () => {
                try {
                    const data = await loraApi.getAllTags();
                    multiSelectTagDropdown.innerHTML = '';
                    if (data.tags) {
                        data.tags.forEach(tag => {
                            const label = document.createElement('label');
                            const checkbox = document.createElement('input');
                            checkbox.type = 'checkbox';
                            checkbox.value = tag;
                            checkbox.addEventListener('change', handleTagSelectionChange);
                            label.append(checkbox, ` ${tag}`);
                            multiSelectTagDropdown.appendChild(label);
                        });
                    }
                } catch(e) { console.error("LocalLoraGallery: Failed to load all tags:", e); }
            };

            let foldersRendered = false;
            const renderFolders = (folders) => {
                if (foldersRendered) return;
                
                // Second normalization pass:
                const validOptions = new Set(["", ...folders]);
                
                // Filter out non-existent folders
                if (Array.isArray(this.loraUiState.pinned_folders)) {
                    this.loraUiState.pinned_folders = this.loraUiState.pinned_folders.filter(f => validOptions.has(f));
                } else {
                    this.loraUiState.pinned_folders = [];
                }
                
                if (Array.isArray(this.loraUiState.folder_order)) {
                    this.loraUiState.folder_order = this.loraUiState.folder_order.filter(f => validOptions.has(f));
                } else {
                    this.loraUiState.folder_order = [];
                }

                // If empty or missing, populate with first visible count from ["", ...folders]
                const maxVisible = getVisiblePinnedFolderCount();
                if (this.loraUiState.pinned_folders.length === 0) {
                    const defaultPinned = ["", ...folders].slice(0, maxVisible);
                    this.loraUiState.pinned_folders = defaultPinned;
                } else if (this.loraUiState.pinned_folders.length < maxVisible) {
                    const pinnedSet = new Set(this.loraUiState.pinned_folders);
                    const ordered = getFoldersInCurrentOrder(folders);
                    const allFoldersOrdered = ["", ...ordered];
                    for (const folder of allFoldersOrdered) {
                        if (pinnedSet.size >= maxVisible) break;
                        pinnedSet.add(folder);
                    }
                    this.loraUiState.pinned_folders = [...pinnedSet];
                }

                const currentVal = folderFilterSelect.value;
                folderFilterSelect.innerHTML = `<option value="">All Folders</option>`;
                
                const orderedFolders = getFoldersInCurrentOrder(folders);
                orderedFolders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder;
                    option.textContent = folder === "." ? "Root" : folder.replaceAll('\\', '/');
                    folderFilterSelect.appendChild(option);
                });
                folderFilterSelect.value = currentVal;
                renderFolderPills();
                if (folders.length > 0) foldersRendered = true;
            };

            const renderPresets = (presets) => {
                presetDropdown.innerHTML = '';
                for (const name in presets) {
                    const presetLink = document.createElement('a');
                    presetLink.href = '#';
                    presetLink.dataset.presetName = name;

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = name;
                    presetLink.appendChild(nameSpan);

                    const deleteBtn = document.createElement('span');
                    deleteBtn.className = 'delete-preset-btn';
                    deleteBtn.textContent = 'x';
                    deleteBtn.title = 'Delete Preset';
                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (confirm(`Are you sure you want to delete preset "${name}"?`)) {
                            const data = await loraApi.deletePreset(name);
                            renderPresets(data.presets);
                        }
                    };
                    presetLink.appendChild(deleteBtn);
                    
                    presetLink.onclick = (e) => {
                        e.preventDefault();
                        this.loraData = cloneJsonOr(presets[name], []);

                        renderSelectedList();

                        setTimeout(() => {
                            const HEADER_HEIGHT = 90;
                            const requiredTopHeight = getLoraChromeHeight();

                            if (mainContainer.classList.contains("gallery-collapsed")) {
                                this.size[1] = requiredTopHeight + HEADER_HEIGHT;
                            } else {
                                const galleryHeight = galleryEl.clientHeight;
                                const newTotalHeight = requiredTopHeight + galleryHeight + HEADER_HEIGHT;

                                if (newTotalHeight > this.size[1]) {
                                    this.size[1] = newTotalHeight;
                                    this.expandedHeight = newTotalHeight;
                                }
                            }
                            this.setDirtyCanvas(true, true);
                        }, 0);

                        updateSelection();
                        fetchAndRender(false).then(() => renderSelectedList());
                        presetDropdown.style.display = 'none';

                        updatePresetButtonText(name);
                    };
                    presetDropdown.appendChild(presetLink);
                }
            };
            
            const loadPresets = async () => {
                try {
                    const presets = await loraApi.getPresets();
                    renderPresets(presets);
                } catch (e) { console.error("LocalLoraGallery: Failed to load presets", e); }
            };

            const { getEditingLorasData, renderMetadataEditor, renderCardTags } = createLoraMetadataController({
                nodeInstance: this,
                metadataEditor,
                selectedCountEl,
                tagEditorList,
                triggerEditorInput,
                triggerEditorRow,
                urlEditorInput,
                urlEditorRow,
                triggerPresetEditorRow,
                triggerPresetList,
                triggerPresetNameInput,
                triggerPresetValueInput,
                addTriggerPresetBtn,
                tagFilterInput,
                getLoraMetadataByName,
                updateCachedLoraMetadata,
                findGalleryCardByLoraName,
                updateMetadata: (...args) => UnifiedLoraGalleryNode.updateMetadata(...args),
                loadAllTags,
                renderCurrentView,
                renderSelectedList,
                fetchAndRender,
            });
            this.initializeNode = async () => {
                let initialState = { 
                    is_collapsed: false, 
                    filter_tag: "",
                    filter_mode: "OR",
                    filter_folder: "",
                    active_display_mode: "thumbnails",
                    cards_display_mode: "thumbnails",
                    card_contrast_mode: "off",
                    sort_mode: "az",
                    active_thumbnail_size_px: 96,
                    thumbnail_size_px: 168,
                    show_clip_weights: true,
                    folder_colors: {},
                    pinned_folders: [],
                    folder_order: [],
                    visible_pinned_folder_count: 8,
                };

                try {
                    this.loraData = readSelectionArray(this.properties.lora_selection_data, []);
                } catch (e) {
                    console.warn("LocalLoraGallery: Failed to parse lora_selection_data, resetting.", e);
                }

                try {
                    const loadedState = await loraApi.getUiState(this.id, this.properties.lora_gallery_unique_id);
                    if (loadedState) {
                        if (loadedState.folder_colors && typeof loadedState.folder_colors !== "object") {
                            loadedState.folder_colors = {};
                        }
                        if (loadedState.pinned_folders && !Array.isArray(loadedState.pinned_folders)) {
                            loadedState.pinned_folders = [];
                        }
                        if (loadedState.folder_order && !Array.isArray(loadedState.folder_order)) {
                            loadedState.folder_order = [];
                        }
                        if (loadedState.visible_pinned_folder_count !== undefined) {
                            const count = parseInt(loadedState.visible_pinned_folder_count, 10);
                            loadedState.visible_pinned_folder_count = Number.isInteger(count) ? Math.max(1, Math.min(25, count)) : 8;
                        }
                    }
                    initialState = { ...initialState, ...loadedState };
                } catch(e) { 
                    console.error("LocalLoraGallery: Failed to get initial UI state.", e); 
                }
                initialState.is_collapsed = false;
                this.loraUiState = { ...initialState };
                applyLoraDisplayState();

                persistSelectionData();

                tagFilterInput.value = initialState.filter_tag;
                if (initialState.filter_mode === "AND") {
                    tagFilterModeBtn.textContent = "AND";
                    tagFilterModeBtn.style.backgroundColor = "#D97706";
                } else {
                    tagFilterModeBtn.textContent = "OR";
                    tagFilterModeBtn.style.backgroundColor = "#555";
                }
                
                await loadAllTags();
                await loadPresets();
                await fetchAndRender(); 

                let needs_refetch = false;
                if (initialState.filter_folder && folderFilterSelect.querySelector(`option[value="${initialState.filter_folder}"]`)) {
                    if (folderFilterSelect.value !== initialState.filter_folder) {
                        folderFilterSelect.value = initialState.filter_folder;
                        renderFolderPills();
                        needs_refetch = true;
                    }
                }

                const selectedTags = new Set(initialState.filter_tag.split(',').filter(Boolean));
                multiSelectTagDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = selectedTags.has(cb.value);
                });

                renderSelectedList();
                
                if (initialState.is_collapsed) {
                    setTimeout(() => {
                        const contentHeight = getLoraChromeHeight();
                        if (!contentHeight) return;
                        this.size[1] = contentHeight + HEADER_HEIGHT;
                        mainContainer.classList.add("gallery-collapsed");
                        toggleGalleryBtn.textContent = "Show Gallery";
                        this.setDirtyCanvas(true, true);
                    }, 0);
                }

                if (needs_refetch) {
                    await fetchAndRender();
                }
            };

            this.expandedHeight = this.size[1];

            const bindEventListeners = () => {
                globalListeners.listen(document, "keydown", (e) => {
                    if (e.key === "Escape") {
                        if (this.selectedLoraNamesForEditing.size > 0) {
                            document.querySelectorAll(`#${uniqueId} .locallora-lora-card.selected-edit`).forEach(c => c.classList.remove("selected-edit"));
                            this.selectedLoraNamesForEditing.clear();
                            renderMetadataEditor();
                        }
                    }
                });

                addTriggerPresetBtn.addEventListener("click", async (e) => {
                    e.preventDefault();
                    const editingLoras = getEditingLorasData();
                    if (editingLoras.length !== 1) return;
                    const name = triggerPresetNameInput.value.trim();
                    const val = triggerPresetValueInput.value.trim();
                    if (!name || !val) return;
                    
                    const loraName = editingLoras[0].name;
                    const loraInDataSource = getLoraMetadataByName(loraName);
                    if (!loraInDataSource) return;
                    
                    const newPresets = { ...(loraInDataSource.trigger_presets || {}) };
                    newPresets[name] = val;
                    await UnifiedLoraGalleryNode.updateMetadata(loraName, { trigger_presets: newPresets });
                    updateCachedLoraMetadata(loraName, { trigger_presets: newPresets });
                    triggerPresetNameInput.value = "";
                    triggerPresetValueInput.value = "";
                    addTriggerPresetBtn.textContent = "Add";
                    renderMetadataEditor();
                    renderCurrentView();
                    renderSelectedList();
                });

                urlEditorInput.addEventListener("keydown", async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const editingLoras = getEditingLorasData();
                        if (editingLoras.length !== 1) return;

                        const singleLora = editingLoras[0];
                        const loraName = singleLora.name;
                        const newUrl = urlEditorInput.value.trim();

                        await UnifiedLoraGalleryNode.updateMetadata(loraName, { download_url: newUrl });

                        updateCachedLoraMetadata(loraName, { download_url: newUrl });

                        const card = findGalleryCardByLoraName(loraName);
                        if (card) {
                            card.dataset.downloadUrl = newUrl;
                            let linkBtn = card.querySelector('.lora-card-link-btn');
                            if (newUrl) {
                                if (!linkBtn) {
                                    linkBtn = document.createElement('a');
                                    linkBtn.className = 'card-btn lora-card-link-btn';
                                    linkBtn.title = 'Open download page';
                                    linkBtn.setAttribute('aria-label', 'Open download page');
                                    linkBtn.innerHTML = loraIconSvg.link;
                                    linkBtn.target = '_blank';
                                    linkBtn.addEventListener("click", (e) => e.stopPropagation());
                                    card.prepend(linkBtn);
                                }
                                linkBtn.href = newUrl;
                            } else if (linkBtn) {
                                linkBtn.remove();
                            }
                        }

                        urlEditorInput.style.backgroundColor = "#2a5";
                        setTimeout(() => { urlEditorInput.style.backgroundColor = ""; }, 500);
                    }
                });

                triggerEditorInput.addEventListener("keydown", async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const editingLoras = getEditingLorasData();
                        if (editingLoras.length !== 1) return;

                        const singleLora = editingLoras[0];
                        const loraName = singleLora.name;
                        const newTriggers = triggerEditorInput.value.trim();

                        await UnifiedLoraGalleryNode.updateMetadata(loraName, { trigger_words: newTriggers });

                        updateCachedLoraMetadata(loraName, { trigger_words: newTriggers });

                        const card = findGalleryCardByLoraName(loraName);
                        if (card) {
                            card.dataset.triggerWords = newTriggers;
                            const triggerDisplayEl = card.querySelector('.lora-card-triggers');
                            if (triggerDisplayEl) {
                                triggerDisplayEl.textContent = newTriggers || 'No triggers';
                                triggerDisplayEl.title = newTriggers;
                            }
                        }
                        
                        triggerEditorInput.style.backgroundColor = "#2a5";
                        setTimeout(() => { triggerEditorInput.style.backgroundColor = ""; }, 500);
                    }
                });
                
                tagEditorInput.addEventListener("keydown", async (e) => {
                    if (e.key === 'Enter' && tagEditorInput.value.trim()) {
                        e.preventDefault();
                        const newTag = tagEditorInput.value.trim();
                        if (newTag) {
                            const editingLoras = getEditingLorasData();
                            const updatePromises = editingLoras.map(async (lora) => {
                                const loraName = lora.name;
                                const tags = [...lora.tags];
                                
                                if (!tags.includes(newTag)) {
                                    tags.push(newTag);
                                    await UnifiedLoraGalleryNode.updateMetadata(loraName, { tags: tags });

                                    updateCachedLoraMetadata(loraName, { tags: [...tags] });

                                    const card = findGalleryCardByLoraName(loraName);
                                    if (card) {
                                        card.dataset.tags = tags.join(',');
                                        renderCardTags(card);
                                    }
                                }
                            });
                            await Promise.all(updatePromises);
                            await loadAllTags();
                            renderMetadataEditor();
                            e.target.value = "";
                        }
                    }
                });

                clearTagFilterBtn.addEventListener("click", () => {
                    tagFilterInput.value = "";
                    multiSelectTagDropdown.querySelectorAll('input:checked').forEach(cb => cb.checked = false);
                    saveStateAndFetch();
                });

                widgetContainer.querySelector(".clear-all-btn").addEventListener("click", clearAllLoras);
                
                folderFilterSelect.addEventListener("change", () => {
                    folderController.overflowOpen = false;
                    renderFolderPills();
                    saveStateAndFetch();
                });
                folderPullTab?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    folderController.toggleOverflow();
                    renderFolderPills();
                });
                tagFilterModeBtn.addEventListener("click", () => {
                    if (tagFilterModeBtn.textContent === "OR") {
                        tagFilterModeBtn.textContent = "AND";
                        tagFilterModeBtn.style.backgroundColor = "#D97706";
                    } else {
                        tagFilterModeBtn.textContent = "OR";
                        tagFilterModeBtn.style.backgroundColor = "#555";
                    }
                    saveStateAndFetch();
                });
              
                savePresetBtn.addEventListener("click", async () => {
                    const presetName = prompt("Enter a name for this preset:", "");
                    if (presetName && this.loraData.length > 0) {
                        const data = await loraApi.savePreset(presetName, this.loraData);
                        renderPresets(data.presets);
                    }
                });

                loadPresetBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    presetDropdown.style.display = presetDropdown.style.display === 'block' ? 'none' : 'block';
                    if (presetDropdown.style.display === 'block') {
                        displayOptionsPopover.style.display = 'none';
                        displayOptionsBtn.classList.remove("active");
                    }
                });

                displayOptionsBtn?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const shouldOpen = displayOptionsPopover.style.display !== "block";
                    presetDropdown.style.display = "none";
                    displayOptionsPopover.style.display = shouldOpen ? "block" : "none";
                    displayOptionsBtn.classList.toggle("active", shouldOpen);
                    if (shouldOpen) syncDisplayOptionControls();
                });

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

                widgetContainer.querySelector(".lora-card-contrast-select")?.addEventListener("change", (event) => {
                    this.loraUiState.card_contrast_mode = normalizeLoraContrastMode(event.target.value);
                    applyLoraDisplayState();
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

                widgetContainer.querySelector(".lora-sort-select")?.addEventListener("change", async (event) => {
                    this.loraUiState.sort_mode = normalizeLoraSortMode(event.target.value);
                    syncDisplayOptionControls();
                    await persistLoraUiState({ sort_mode: this.loraUiState.sort_mode });
                    await fetchAndRender(false);
                });

                widgetContainer.querySelector(".lora-visible-folders-slider")?.addEventListener("input", (event) => {
                    const count = parseInt(event.target.value, 10);
                    const oldCount = getVisiblePinnedFolderCount();
                    this.loraUiState.visible_pinned_folder_count = normalizeVisiblePinnedFolderCount(count);
                    
                    const foldersCountVal = widgetContainer.querySelector(".lora-visible-folders-count-val");
                    if (foldersCountVal) foldersCountVal.textContent = this.loraUiState.visible_pinned_folder_count;
                    
                    if (count > oldCount) {
                        const discovered = getFolderOptions();
                        const ordered = getFoldersInCurrentOrder(discovered);
                        const pinned = new Set(this.loraUiState.pinned_folders || []);
                        for (const folder of ordered) {
                            if (pinned.size >= count) break;
                            pinned.add(folder);
                        }
                        this.loraUiState.pinned_folders = [...pinned];
                    }
                    
                    renderFolderPills();
                    queueLoraDisplayStateSave();
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

                toggleGalleryBtn.addEventListener("click", () => {
                    const isCollapsing = !mainContainer.classList.contains("gallery-collapsed");
                    
                    if (isCollapsing) {
                        this.expandedHeight = this.size[1];
                        const contentHeight = getLoraChromeHeight();
                        this.size[1] = contentHeight + HEADER_HEIGHT;
                        mainContainer.classList.add("gallery-collapsed");
                        toggleGalleryBtn.textContent = "Show Gallery";
                    } else {
                        this.size[1] = this.expandedHeight;
                        mainContainer.classList.remove("gallery-collapsed");
                        toggleGalleryBtn.textContent = "Hide Gallery";
                    }
                    
                    UnifiedLoraGalleryNode.setUiState(this.id, this.properties.lora_gallery_unique_id, {
                        is_collapsed: isCollapsing
                    });
                });

                widgetContainer.querySelector(".toggle-all-btn").addEventListener("click", () => {
                    const allOn = this.loraData.every(item => item.on);
                    this.loraData.forEach(item => item.on = !allOn);
                    renderSelectedList();
                    updateSelection();
                });

                const setNameSearchOpen = (isOpen) => {
                    searchPopover.style.display = isOpen ? "flex" : "none";
                    searchBtn.setAttribute("aria-expanded", String(isOpen));
                    searchBtn.classList.toggle("active", isOpen || Boolean(searchInput.value));
                    if (isOpen) requestAnimationFrame(() => searchInput.focus());
                };

                searchBtn.addEventListener("click", () => {
                    setNameSearchOpen(searchPopover.style.display === "none");
                });
                searchInput.addEventListener("input", () => {
                    searchBtn.classList.toggle("active", Boolean(searchInput.value));
                    renderCurrentView(false);
                });
                searchInput.addEventListener("keydown", (event) => {
                    if (event.key === "Escape") {
                        setNameSearchOpen(false);
                        searchBtn.focus();
                    }
                });
                clearNameSearchBtn.addEventListener("click", () => {
                    searchInput.value = "";
                    searchBtn.classList.add("active");
                    renderCurrentView(false);
                    searchInput.focus();
                });
                tagFilterInput.addEventListener("keydown", (e) => { if(e.key === 'Enter') saveStateAndFetch(); });
                
                const arrow = multiSelectTagContainer.querySelector('.locallora-multiselect-arrow');
                multiSelectTagDisplay.addEventListener('click', () => {
                    const isVisible = multiSelectTagDropdown.style.display === 'block';
                    multiSelectTagDropdown.style.display = isVisible ? 'none' : 'block';
                    arrow.classList.toggle('open', !isVisible);
                });

                globalListeners.listen(document, 'click', (e) => {
                    if (!multiSelectTagContainer.contains(e.target)) {
                        multiSelectTagDropdown.style.display = 'none';
                        arrow.classList.remove('open');
                    }
                    if (presetDropdown && !loadPresetBtn.contains(e.target) && !presetDropdown.contains(e.target)) {
                       presetDropdown.style.display = 'none';
                    }
                    if (displayOptionsPopover && !e.target.closest?.(`#${uniqueId} .lora-display-options-anchor`)) {
                        displayOptionsPopover.style.display = "none";
                        displayOptionsBtn?.classList.remove("active");
                    }
                    if (searchPopover && !searchAnchor.contains(e.target)) {
                        setNameSearchOpen(false);
                    }
                    if (!e.target.closest?.(`#${uniqueId} .lora-active-stack-btn, #${uniqueId}-active-sidebar`)) {
                        closeActiveStack();
                    }
                    if (!e.target.closest?.(`#${uniqueId} .lora-folder-nav`)) {
                        folderController.overflowOpen = false;
                        renderFolderPills();
                    }
                    if (!e.target.closest?.(`#${uniqueId} .lora-trigger-preset-picker`)) {
                        widgetContainer.querySelectorAll(".lora-trigger-preset-picker.open").forEach(openPicker => {
                            openPicker.classList.remove("open");
                            openPicker.closest(".locallora-lora-card, .locallora-lora-item")?.classList.remove("preset-open");
                        });
                    }
                });

                const globalLoraPointerDownHandler = (event) => {
                    if (!isContextMenuTarget(event.target)) {
                        closeLoraFolderContextMenu();
                    }
                };
                const globalLoraKeydownHandler = (event) => {
                    if (event.key === "Escape") {
                        closeLoraFolderContextMenu();
                        folderController.cancelDrag();
                    }
                };
                const globalLoraResizeHandler = () => {
                    closeLoraFolderContextMenu();
                };

                globalListeners.listen(document, "pointerdown", globalLoraPointerDownHandler, { capture: true });
                globalListeners.listen(document, "keydown", globalLoraKeydownHandler);
                globalListeners.listen(window, "resize", globalLoraResizeHandler);
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
                    document.querySelectorAll(".lora-trigger-preset-popover-portal").forEach(popover => {
                        if (popover.dataset.loraPortalOwner !== uniqueId) return;
                        popover._restoreLoraPresetPopover?.();
                        if (popover.isConnected && !widgetContainer.contains(popover)) popover.remove();
                    });
                    folderController.cancelDrag();
                    activeStackController.dispose();
                    closeLoraFolderContextMenu();
                    if (originalOnRemoved) originalOnRemoved.call(this);
                };
            };

            this.onResize = function(size) {
                const dynamicMinHeight = getLoraChromeHeight() + HEADER_HEIGHT;
                if (!mainContainer.classList.contains("gallery-collapsed")) {
                    this.expandedHeight = size[1];
                }
                if (size[1] < dynamicMinHeight) size[1] = dynamicMinHeight;
                if (size[0] < MIN_NODE_WIDTH) size[0] = MIN_NODE_WIDTH;
            };

            bindEventListeners();
            setTimeout(() => this.initializeNode(), 1);

            return result;
        };
    }
};

return {
    async beforeRegisterNodeDef(nodeType, nodeData) {
        UnifiedLoraGalleryNode.setup(nodeType, nodeData);
    },
};
}

