import * as loraApi from "../api/loraApi.js";
import { escapeHtml } from "../shared/dom.js";
import { cloneJsonOr, readSelectionArray, writeSelectionArray } from "../shared/json.js";
import { buildLoraPresetControlsHtml, buildSelectedLoraItemHtml, buildLoraCardHtml } from "./renderers.js?v=lora-active-preset-direct-20260617";
import { setupLoraStateWidgets } from "./stateWidgets.js";
import { getLoraStyles } from "./styles.js?v=lora-active-preset-direct-20260617";

export function registerLoraGalleryUi(app) {
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
            return { loras: [], folders: [], total_pages: 1, current_page: 1 };
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
            this.selectedCardsForEditing = new Set();
            this.loraUiState = {};

            const widgetContainer = document.createElement("div");
            widgetContainer.className = "locallora-container-wrapper";
            this.addDOMWidget("lora_gallery", "div", widgetContainer, {});

            const uniqueId = `locallora-gallery-${this.id}`;
            widgetContainer.innerHTML = `
                ${getLoraStyles(uniqueId)}
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
                                <input type="text" class="search-input" placeholder="Filter by Name..." style="flex-grow: 1;">
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
            const getLoraChromeHeight = () => {
                const controlsEl = widgetContainer.querySelector(".locallora-controls");
                const bottomBarEl = widgetContainer.querySelector(".locallora-bottom-bar");
                return (controlsEl?.offsetHeight || 0) + (bottomBarEl?.offsetHeight || 0);
            };
            let currentViewMode = "gallery";
            let folderOverflowOpen = false;
            let folderDragState = null;
            let suppressFolderClickUntil = 0;
            const getVisiblePinnedFolderCount = () => {
                const count = parseInt(this.loraUiState?.visible_pinned_folder_count, 10);
                return Number.isInteger(count) ? Math.max(1, Math.min(25, count)) : 8;
            };
            const LORA_FOLDER_COLORS = ["#ef4444", "#f97316", "#22c55e", "#14b8a6", "#3b82f6", "#06b6d4", "#ec4899", "#8b5cf6", "#94a3b8"];
            const LORA_DISPLAY_MODES = new Set(["thumbnails", "compact"]);
            const LORA_CONTRAST_MODES = new Set(["off", "dim_inactive", "dim_by_default"]);
            const LORA_SORT_MODES = new Set(["az", "za", "newest", "oldest"]);
            const LORA_CARD_THUMBNAIL_MIN = 112;
            const LORA_CARD_THUMBNAIL_MAX = 260;
            const LORA_ACTIVE_THUMBNAIL_MIN = 72;
            const LORA_ACTIVE_THUMBNAIL_MAX = 156;

            const clampNumber = (value, min, max, fallback) => {
                const number = Number(value);
                if (!Number.isFinite(number)) return fallback;
                return Math.min(max, Math.max(min, Math.round(number)));
            };

            const normalizeChoice = (value, allowed, fallback) => allowed.has(String(value || "")) ? String(value) : fallback;

            const getLoraDisplayState = () => ({
                active_display_mode: normalizeChoice(this.loraUiState.active_display_mode, LORA_DISPLAY_MODES, "thumbnails"),
                cards_display_mode: normalizeChoice(this.loraUiState.cards_display_mode, LORA_DISPLAY_MODES, "thumbnails"),
                card_contrast_mode: normalizeChoice(this.loraUiState.card_contrast_mode, LORA_CONTRAST_MODES, "off"),
                sort_mode: normalizeChoice(this.loraUiState.sort_mode, LORA_SORT_MODES, "az"),
                active_thumbnail_size_px: clampNumber(this.loraUiState.active_thumbnail_size_px, LORA_ACTIVE_THUMBNAIL_MIN, LORA_ACTIVE_THUMBNAIL_MAX, 96),
                thumbnail_size_px: clampNumber(this.loraUiState.thumbnail_size_px, LORA_CARD_THUMBNAIL_MIN, LORA_CARD_THUMBNAIL_MAX, 168),
                active_sidebar_width: clampNumber(this.loraUiState.active_sidebar_width, 300, 720, 450),
            });

            let loraDisplayStateSaveTimer = null;
            const persistLoraUiState = (extraState = {}) => {
                this.loraUiState = { ...this.loraUiState, ...extraState };
                return UnifiedLoraGalleryNode.setUiState(this.id, this.properties.lora_gallery_unique_id, {
                    filter_tag: tagFilterInput.value,
                    filter_mode: tagFilterModeBtn.textContent,
                    filter_folder: folderFilterSelect.value,
                    view_mode: currentViewMode,
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
                mainContainer.style.setProperty("--lora-active-card-size", `${Math.round(state.active_thumbnail_size_px * 1.3)}px`);
                mainContainer.style.setProperty("--locallora-active-sidebar-width", `${state.active_sidebar_width}px`);
                syncDisplayOptionControls();
            };

            const splitter = widgetContainer.querySelector(`#${uniqueId}-active-splitter`);
            let startX = 0;
            let startWidth = 360;

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
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
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
                    document.addEventListener("mousemove", onMouseMove);
                    document.addEventListener("mouseup", onMouseUp);
                });
            }

            const saveStateAndFetch = async () => {
                const stateToSave = {
                    filter_tag: tagFilterInput.value,
                    filter_mode: tagFilterModeBtn.textContent,
                    filter_folder: folderFilterSelect.value,
                    view_mode: currentViewMode,
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

            const setViewMode = (viewMode, shouldRender = true, shouldPersist = true) => {
                currentViewMode = "gallery";
                if (shouldRender) renderCurrentView(false);
            };

            const getFolderLabel = (folder) => {
                if (!folder) return "All Folders";
                return folder === "." ? "Root" : String(folder).replaceAll('\\', '/');
            };

            const getFolderColor = (folder, index) => {
                if (this.loraUiState.folder_colors && this.loraUiState.folder_colors[folder]) {
                    return this.loraUiState.folder_colors[folder];
                }
                if (!folder) return "#8fb6d9";
                let hash = 0;
                String(folder).split("").forEach(char => {
                    hash = ((hash << 5) - hash) + char.charCodeAt(0);
                    hash |= 0;
                });
                return LORA_FOLDER_COLORS[Math.abs(hash || index) % LORA_FOLDER_COLORS.length];
            };

            const buildFolderButton = (folder, index, isOverflow = false) => {
                const label = getFolderLabel(folder);
                const isActive = folderFilterSelect.value === folder;
                const button = document.createElement("button");
                button.type = "button";
                button.className = `lora-folder-pill${isActive ? " active" : ""}`;
                button.textContent = label;
                button.title = label;
                button.dataset.folder = folder;
                const isPinned = (this.loraUiState.pinned_folders || []).includes(folder);
                button.dataset.pinned = String(isPinned);
                const color = getFolderColor(folder, index);
                button.style.setProperty("--folder-color", color);
                button.style.setProperty("--folder-glow", `${color}55`);
                button.addEventListener("click", (e) => {
                    if (Date.now() < suppressFolderClickUntil) {
                        e.stopImmediatePropagation();
                        return;
                    }
                    folderFilterSelect.value = folder;
                    folderOverflowOpen = false;
                    renderFolderPills();
                    saveStateAndFetch();
                });

                // Context Menu
                button.addEventListener("contextmenu", (event) => {
                    event.preventDefault();
                    showLoraFolderContextMenu(event, folder, isPinned);
                });

                // Pointer Long Press & Drag setup
                let longPressTimer = null;
                let startX = 0;
                let startY = 0;

                button.addEventListener("pointerdown", (event) => {
                    if (event.button !== 0) return;
                    if (event.target.closest("button:not(.lora-folder-pill), input, select, textarea")) return;
                    
                    startX = event.clientX;
                    startY = event.clientY;
                    if (longPressTimer) clearTimeout(longPressTimer);
                    
                    longPressTimer = setTimeout(() => {
                        suppressFolderClickUntil = Date.now() + 250;
                        showLoraFolderContextMenu(event, folder, isPinned);
                    }, 500);

                    folderDragState = {
                        pill: button,
                        folder,
                        isPinned,
                        startX: event.clientX,
                        startY: event.clientY,
                        active: false,
                        pointerId: event.pointerId,
                    };
                    button.setPointerCapture?.(event.pointerId);
                });

                button.addEventListener("pointermove", (event) => {
                    if (longPressTimer && Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                });

                button.addEventListener("pointerup", (event) => {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                });

                button.addEventListener("pointercancel", () => {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                });

                if (isOverflow) button.dataset.overflow = "true";
                return button;
            };

            const getFolderOptions = () => Array.from(folderFilterSelect.options).map(option => option.value);

            const getFoldersInCurrentOrder = (discoveredFolders) => {
                const folderSet = new Set(discoveredFolders);
                const ordered = (this.loraUiState.folder_order || []).filter(f => folderSet.has(f));
                const orderedSet = new Set(ordered);
                return [...ordered, ...discoveredFolders.filter(f => !orderedSet.has(f))];
            };

            const renderFolderPills = () => {
                if (!folderStrip || !folderOverflow || !folderOverflowChips) return;
                const discovered = getFolderOptions();
                const pinned = this.loraUiState.pinned_folders || [];
                const maxVisible = getVisiblePinnedFolderCount();
                
                const visiblePinned = pinned.slice(0, maxVisible);
                const visiblePinnedSet = new Set(visiblePinned);
                
                const orderedAll = getFoldersInCurrentOrder(discovered);
                const overflowFolders = orderedAll.filter(f => !visiblePinnedSet.has(f));

                folderStrip.innerHTML = "";
                visiblePinned.forEach((folder, index) => {
                    folderStrip.appendChild(buildFolderButton(folder, index));
                });

                folderOverflowChips.innerHTML = "";
                overflowFolders.forEach((folder, index) => {
                    folderOverflowChips.appendChild(buildFolderButton(folder, index + visiblePinned.length, true));
                });

                const hasOverflow = overflowFolders.length > 0;
                folderOverflow.classList.toggle("open", hasOverflow && folderOverflowOpen);
                if (folderPullTab) {
                    folderPullTab.style.display = hasOverflow ? "flex" : "none";
                    folderPullTab.classList.toggle("open", hasOverflow && folderOverflowOpen);
                    folderPullTab.setAttribute("aria-expanded", String(hasOverflow && folderOverflowOpen));
                }
            };

            let activeLoraFolderContextMenu = null;
            const closeLoraFolderContextMenu = () => {
                if (activeLoraFolderContextMenu) {
                    activeLoraFolderContextMenu.remove();
                    activeLoraFolderContextMenu = null;
                }
            };

            function showLoraFolderContextMenu(e, folder, isCurrentlyPinned) {
                closeLoraFolderContextMenu();
                
                const menu = document.createElement("div");
                menu.className = "lora-folder-ctx-menu";
                
                const presetColors = ["#ef4444", "#f97316", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8"];
                const activeColor = this.loraUiState.folder_colors?.[folder] || "";
                
                let colorsHtml = presetColors.map(color => `
                    <button class="color-dot${activeColor === color ? ' active' : ''}" style="background-color: ${color};" data-color="${color}"></button>
                `).join("");
                
                menu.innerHTML = `
                    <div class="menu-item pin-toggle-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <span>${isCurrentlyPinned ? "Unpin Folder" : "Pin Folder"}</span>
                    </div>
                    <div class="menu-divider"></div>
                    <div class="menu-header">Folder Color</div>
                    <div class="color-presets-grid">
                        ${colorsHtml}
                    </div>
                    <div class="color-picker-row">
                        <label class="custom-color-picker-label">
                            <input type="color" class="custom-color-input" value="${activeColor || "#f97316"}">
                            <span>Custom Color...</span>
                        </label>
                        <button class="reset-color-btn" style="${activeColor ? "" : "display: none;"}">Reset</button>
                    </div>
                `;
                
                menu.style.position = "fixed";
                menu.style.left = `${e.clientX}px`;
                menu.style.top = `${e.clientY}px`;
                document.body.appendChild(menu);
                activeLoraFolderContextMenu = menu;
                
                const rect = menu.getBoundingClientRect();
                if (e.clientX + rect.width > window.innerWidth) {
                    menu.style.left = `${window.innerWidth - rect.width - 8}px`;
                }
                if (e.clientY + rect.height > window.innerHeight) {
                    menu.style.top = `${window.innerHeight - rect.height - 8}px`;
                }
                
                menu.querySelector(".pin-toggle-btn").addEventListener("click", async () => {
                    const discovered = getFolderOptions();
                    let pinned = [...(this.loraUiState.pinned_folders || [])];
                    if (isCurrentlyPinned) {
                        pinned = pinned.filter(f => f !== folder);
                    } else {
                        pinned = [...pinned, folder];
                    }
                    this.loraUiState.pinned_folders = pinned;
                    await saveStateAndFetch();
                    renderFolderPills();
                    closeLoraFolderContextMenu();
                });
                
                menu.querySelectorAll(".color-dot").forEach(dot => {
                    dot.addEventListener("click", async () => {
                        const color = dot.dataset.color;
                        if (!this.loraUiState.folder_colors) {
                            this.loraUiState.folder_colors = {};
                        }
                        this.loraUiState.folder_colors[folder] = color;
                        await saveStateAndFetch();
                        renderFolderPills();
                        closeLoraFolderContextMenu();
                    });
                });
                
                const customPicker = menu.querySelector(".custom-color-input");
                customPicker.addEventListener("input", (event) => {
                    menu.querySelector(".reset-color-btn").style.display = "";
                });
                customPicker.addEventListener("change", async (event) => {
                    const color = event.target.value;
                    if (!this.loraUiState.folder_colors) {
                        this.loraUiState.folder_colors = {};
                    }
                    this.loraUiState.folder_colors[folder] = color;
                    await saveStateAndFetch();
                    renderFolderPills();
                    closeLoraFolderContextMenu();
                });
                
                menu.querySelector(".reset-color-btn").addEventListener("click", async () => {
                    if (this.loraUiState.folder_colors) {
                        delete this.loraUiState.folder_colors[folder];
                        await saveStateAndFetch();
                        renderFolderPills();
                    }
                    closeLoraFolderContextMenu();
                });
            }

            let lastLoraFolderDragTarget = null;
            function getLoraFolderPillAtPoint(x, y) {
                const el = document.elementFromPoint(x, y);
                return el?.closest(".lora-folder-pill");
            }
            function setLoraFolderDragTarget(element) {
                if (lastLoraFolderDragTarget === element) return;
                clearLoraFolderDragTargets();
                if (element) {
                    element.classList.add("drag-over");
                    lastLoraFolderDragTarget = element;
                }
            }
            function clearLoraFolderDragTargets() {
                widgetContainer.querySelectorAll(".lora-folder-pill.drag-over").forEach(el => {
                    el.classList.remove("drag-over");
                });
                lastLoraFolderDragTarget = null;
            }

            const onLoraFolderPointerMove = async (event) => {
                if (!folderDragState) return;
                const distance = Math.hypot(event.clientX - folderDragState.startX, event.clientY - folderDragState.startY);
                if (!folderDragState.active && distance < 8) return;

                if (!folderDragState.active) {
                    folderDragState.active = true;
                    folderDragState.pill.classList.add("pinned-dragging");
                    suppressFolderClickUntil = Date.now() + 200;
                }

                event.preventDefault();
                event.stopPropagation();
                
                const targetPill = getLoraFolderPillAtPoint(event.clientX, event.clientY);
                if (targetPill && targetPill !== folderDragState.pill) {
                    setLoraFolderDragTarget(targetPill);
                } else {
                    setLoraFolderDragTarget(null);
                }
            };

            const onLoraFolderPointerUp = async (event) => {
                if (!folderDragState) return;
                const dragState = folderDragState;
                folderDragState = null;

                dragState.pill.classList.remove("pinned-dragging");
                dragState.pill.releasePointerCapture?.(dragState.pointerId);

                if (!dragState.active) return;
                event.preventDefault();
                event.stopPropagation();
                suppressFolderClickUntil = Date.now() + 250;

                const targetPill = getLoraFolderPillAtPoint(event.clientX, event.clientY) || lastLoraFolderDragTarget;
                clearLoraFolderDragTargets();

                if (!targetPill || targetPill === dragState.pill) {
                    return;
                }

                const targetFolder = targetPill.dataset.folder;
                const draggedFolder = dragState.folder;
                if (targetFolder === undefined || draggedFolder === undefined) return;

                // Determine if target is pinned or unpinned
                const isTargetPinned = targetPill.dataset.pinned === "true" || targetPill.closest(".lora-folder-strip") !== null;
                const discovered = getFolderOptions();
                
                let pinned = [...(this.loraUiState.pinned_folders || [])];
                const swapItems = (items, first, second) => {
                    const firstIndex = items.indexOf(first);
                    const secondIndex = items.indexOf(second);
                    if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return false;
                    [items[firstIndex], items[secondIndex]] = [items[secondIndex], items[firstIndex]];
                    return true;
                };

                if (isTargetPinned) {
                    // Pinned zone drop
                    if (!swapItems(pinned, draggedFolder, targetFolder)) {
                        pinned = pinned.filter(f => f !== draggedFolder);
                        const targetIndex = pinned.indexOf(targetFolder);
                        if (targetIndex >= 0) {
                            pinned.splice(targetIndex, 0, draggedFolder);
                        } else {
                            pinned.push(draggedFolder);
                        }
                    }
                    if (!pinned.includes(draggedFolder)) {
                        pinned.push(draggedFolder);
                    }
                    this.loraUiState.pinned_folders = pinned;
                    await saveStateAndFetch();
                } else {
                    // Unpinned zone drop
                    pinned = pinned.filter(f => f !== draggedFolder);
                    const currentFolders = getFoldersInCurrentOrder(discovered);
                    const unpinnedOrder = currentFolders.filter(f => !pinned.includes(f));
                    if (!swapItems(unpinnedOrder, draggedFolder, targetFolder)) {
                        const nextUnpinned = unpinnedOrder.filter(f => f !== draggedFolder);
                        const targetIndex = nextUnpinned.indexOf(targetFolder);
                        if (targetIndex >= 0) {
                            nextUnpinned.splice(targetIndex, 0, draggedFolder);
                        } else {
                            nextUnpinned.push(draggedFolder);
                        }
                        this.loraUiState.folder_order = nextUnpinned;
                    } else {
                        this.loraUiState.folder_order = unpinnedOrder;
                    }
                    this.loraUiState.pinned_folders = pinned;
                    await saveStateAndFetch();
                }
                renderFolderPills();
            };

            const onLoraFolderPointerCancel = () => {
                if (folderDragState) {
                    folderDragState.pill.classList.remove("pinned-dragging");
                    folderDragState.pill.releasePointerCapture?.(folderDragState.pointerId);
                    folderDragState = null;
                }
                clearLoraFolderDragTargets();
            };
            renderFolderPills();

            const persistSelectionData = () => {
                const serializableData = this.loraData.map(({
                    element,
                    preview_url,
                    preview_type,
                    tags,
                    trigger_words,
                    trigger_presets,
                    download_url,
                    ...rest
                }) => rest);
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
            
            let draggedIndex = -1;
            let cleanupMouseReorder = null;

            const clearDragMarkers = (root = widgetContainer) => {
                root.querySelectorAll(".locallora-lora-item.drag-over-before, .locallora-lora-item.drag-over-after, .locallora-lora-item.drag-over").forEach(row => {
                    row.classList.remove("drag-over-before", "drag-over-after", "drag-over");
                });
            };

            const bindMouseReorderHandle = (row, handle, rowSelector, root, onMoved) => {
                if (!row || !handle) return;

                const shouldStartReorder = (event) => {
                    if (event.target.closest?.(".locallora-selected-thumb")) return true;
                    return !event.target.closest?.("button, input, select, textarea, a, .managed-weight-val, .lora-trigger-preset-picker");
                };

                const containsPoint = (rect, x, y) => (
                    x >= rect.left &&
                    x <= rect.right &&
                    y >= rect.top &&
                    y <= rect.bottom
                );

                handle.addEventListener("pointerdown", (event) => {
                    if (event.button !== 0) return;
                    if (!shouldStartReorder(event)) return;

                    const startedFromDragSurface = Boolean(event.target.closest?.(".locallora-selected-thumb"));
                    if (startedFromDragSurface) {
                        event.preventDefault();
                        event.stopPropagation();
                    }

                    cleanupMouseReorder?.();
                    draggedIndex = parseInt(row.dataset.index);
                    const pointerId = event.pointerId;
                    const startX = event.clientX;
                    const startY = event.clientY;
                    const startRect = row.getBoundingClientRect();
                    const pointerOffsetX = startX - (startRect.left + startRect.width / 2);
                    const pointerOffsetY = startY - (startRect.top + startRect.height / 2);
                    let hasDragged = false;
                    let lastDropMarker = null;
                    row.setPointerCapture?.(event.pointerId);

                    const getTargetRow = (moveEvent) => {
                        const rows = Array.from(root.querySelectorAll(rowSelector)).filter(candidate => candidate !== row);
                        if (!rows.length) return null;
                        const dragCenterX = moveEvent.clientX - pointerOffsetX;
                        const dragCenterY = moveEvent.clientY - pointerOffsetY;

                        const sourceRect = row.getBoundingClientRect();
                        if (containsPoint(sourceRect, dragCenterX, dragCenterY)) {
                            return null;
                        }

                        const rootRect = root.getBoundingClientRect();
                        if (!containsPoint(rootRect, dragCenterX, dragCenterY)) {
                            return null;
                        }

                        const rowUnderPointer = rows.find(candidate => {
                            const rect = candidate.getBoundingClientRect();
                            return containsPoint(rect, dragCenterX, dragCenterY);
                        });
                        if (rowUnderPointer) return rowUnderPointer;

                        return rows.reduce((nearestRow, candidate) => {
                            const rect = candidate.getBoundingClientRect();
                            const centerX = rect.left + rect.width / 2;
                            const centerY = rect.top + rect.height / 2;
                            const distance = Math.hypot(dragCenterX - centerX, dragCenterY - centerY);
                            if (!nearestRow || distance < nearestRow.distance) {
                                return { row: candidate, distance };
                            }
                            return nearestRow;
                        }, null)?.row || null;
                    };

                    const updateMarker = (moveEvent) => {
                        clearDragMarkers(root);
                        const targetRow = getTargetRow(moveEvent);
                        if (!targetRow) return null;
                        targetRow.classList.add("drag-over");
                        lastDropMarker = { targetRow };
                        return lastDropMarker;
                    };

                    const onPointerMove = (moveEvent) => {
                        if (moveEvent.pointerId !== pointerId) return;
                        if (!hasDragged) {
                            const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
                            if (distance < 4) return;
                            hasDragged = true;
                            row.classList.add("dragging");
                            document.body.style.userSelect = "none";
                        }
                        moveEvent.preventDefault();
                        moveEvent.stopPropagation();
                        updateMarker(moveEvent);
                    };

                    const suppressClickAfterDrag = (clickEvent) => {
                        clickEvent.preventDefault();
                        clickEvent.stopPropagation();
                        row.removeEventListener("click", suppressClickAfterDrag, true);
                    };

                    const onPointerUp = (upEvent) => {
                        if (upEvent.pointerId !== pointerId) return;
                        if (!hasDragged) {
                            cleanupMouseReorder?.();
                            return;
                        }
                        upEvent.preventDefault();
                        upEvent.stopPropagation();
                        const marker = updateMarker(upEvent) || lastDropMarker;
                        const fromIndex = draggedIndex;
                        const targetIndex = marker ? parseInt(marker.targetRow.dataset.index) : -1;
                        cleanupMouseReorder?.();
                        row.addEventListener("click", suppressClickAfterDrag, true);
                        window.setTimeout(() => row.removeEventListener("click", suppressClickAfterDrag, true), 0);
                        if (marker && fromIndex >= 0 && targetIndex >= 0 && fromIndex !== targetIndex) {
                            onMoved(fromIndex, targetIndex);
                        }
                    };

                    cleanupMouseReorder = () => {
                        row.classList.remove("dragging");
                        clearDragMarkers(root);
                        draggedIndex = -1;
                        document.body.style.userSelect = "";
                        if (row.hasPointerCapture?.(pointerId)) {
                            row.releasePointerCapture?.(pointerId);
                        }
                        document.removeEventListener("pointermove", onPointerMove, true);
                        document.removeEventListener("pointerup", onPointerUp, true);
                        document.removeEventListener("pointercancel", cleanupMouseReorder, true);
                        window.removeEventListener("blur", cleanupMouseReorder);
                        cleanupMouseReorder = null;
                    };

                    document.addEventListener("pointermove", onPointerMove, true);
                    document.addEventListener("pointerup", onPointerUp, true);
                    document.addEventListener("pointercancel", cleanupMouseReorder, true);
                    window.addEventListener("blur", cleanupMouseReorder);
                });
            };

            const resolveLoraInfo = (loraName, item = null) => this.availableLoras.find(lora => lora.name === loraName) || {
                name: loraName,
                tags: item?.tags || [],
                trigger_words: item?.trigger_words || "",
                trigger_presets: item?.trigger_presets || {},
                download_url: item?.download_url || "",
                preview_url: item?.preview_url || "",
                preview_type: item?.preview_type || "none"
            };

            const hydrateSelectedLoraInfo = () => {
                const loraInfoByName = new Map(this.availableLoras.map(lora => [lora.name, lora]));
                this.loraData.forEach(item => {
                    const lora = loraInfoByName.get(item.lora);
                    if (!lora) return;
                    item.preview_url = lora.preview_url || "";
                    item.preview_type = lora.preview_type || "none";
                    item.tags = lora.tags || [];
                    item.trigger_words = lora.trigger_words || "";
                    item.trigger_presets = lora.trigger_presets || {};
                    item.download_url = lora.download_url || "";
                });
            };

            const renderSelectedList = () => {
                selectedListEl.innerHTML = "";
                activeStackBtn.classList.toggle("has-active", this.loraData.length > 0);
                activeStackBtn.classList.toggle("empty", this.loraData.length === 0);
                activeStackBtn.disabled = this.loraData.length === 0;
                activeStackBtn.title = this.loraData.length ? "Show selected LoRAs" : "No selected LoRAs";
                activeStackBtn.setAttribute("aria-pressed", String(mainContainer.classList.contains("active-stack-open")));
                
                const activeCountEl = widgetContainer.querySelector(`#${uniqueId}-active-count`);
                if (activeCountEl) activeCountEl.textContent = `${this.loraData.length} selected`;
                if (activeStackCount) activeStackCount.textContent = this.loraData.length;

                if (!this.loraData.length) {
                    closeActiveStack();
                    return;
                }

                const displayState = getLoraDisplayState();
                const isCompact = displayState.active_display_mode === "compact";

                this.loraData.forEach((item, index) => {
                    const lora = resolveLoraInfo(item.lora, item);
                    const el = document.createElement("div");
                    el.className = "locallora-lora-item";
                    el.dataset.index = index;
                    el.dataset.loraName = item.lora;
                    el.classList.toggle("disabled", !item.on);
                    el.title = `${item.lora}\nDrag to change LoRA load order`;

                    el.innerHTML = buildSelectedLoraItemHtml(item, index, lora, this.isModelOnly, isCompact);

                    setupPresetControls(el, lora);

                    if (!isCompact) {
                        const previewImage = el.querySelector(".locallora-selected-thumb img");
                        if (previewImage) {
                            previewImage.onerror = (e) => {
                                e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                            };
                            previewImage.draggable = false;
                        }
                        const previewVideo = el.querySelector(".locallora-selected-thumb video");
                        if (previewVideo) {
                            previewVideo.draggable = false;
                            el.addEventListener("mouseenter", () => previewVideo.play().catch(() => {}));
                            el.addEventListener("mouseleave", () => { previewVideo.pause(); previewVideo.currentTime = 0; });
                        }
                    }

                    const toggleBtn = el.querySelector(".lora-selected-toggle-pill");
                    toggleBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        this.loraData[index].on = !this.loraData[index].on;
                        renderSelectedList();
                        updateSelection();
                    });

                    const formatWeight = (weight) => {
                        const rounded = Math.round(weight * 100) / 100;
                        const tenth = Math.round(rounded * 10) / 10;
                        if (Math.abs(rounded - tenth) < 1e-9) {
                            return tenth.toFixed(1);
                        } else {
                            return rounded.toFixed(2);
                        }
                    };

                    const stepStrength = (val, direction, min = -10.0, max = 10.0) => {
                        const current = Number(val) || 1.0;
                        const next = Math.round((current + (direction * 0.05)) * 100) / 100;
                        return Math.max(min, Math.min(max, next));
                    };

                    const strengthModelVal = el.querySelector(".selected-strength-model");
                    if (strengthModelVal) {
                        strengthModelVal.addEventListener("wheel", (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const direction = e.deltaY < 0 ? 1 : -1;
                            const nextVal = stepStrength(this.loraData[index].strength ?? 1.0, direction, -10.0, 10.0);
                            this.loraData[index].strength = nextVal;
                            strengthModelVal.textContent = formatWeight(nextVal);
                            updateSelection();
                        }, { passive: false });
                    }

                    const strengthClipVal = el.querySelector(".selected-strength-clip");
                    if (strengthClipVal) {
                        strengthClipVal.addEventListener("wheel", (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const direction = e.deltaY < 0 ? 1 : -1;
                            const currentVal = this.loraData[index].strength_clip ?? this.loraData[index].strength ?? 1.0;
                            const nextVal = stepStrength(currentVal, direction, -2.0, 2.0);
                            this.loraData[index].strength_clip = nextVal;
                            strengthClipVal.textContent = formatWeight(nextVal);
                            updateSelection();
                        }, { passive: false });
                    }

                    const removeActiveLora = (e) => {
                        e.stopPropagation();
                        const loraNameToRemove = item.lora;
                        const removeIndex = this.loraData.findIndex(entry => entry.lora === loraNameToRemove);
                        if (removeIndex > -1) {
                            this.loraData.splice(removeIndex, 1);
                        }
                        galleryEl.querySelectorAll(".locallora-lora-card").forEach(card => {
                            if (card.dataset.loraName === loraNameToRemove) {
                                card.classList.remove("selected-flow");
                            }
                        });
                        renderSelectedList();
                        updateSelection();
                        if (mainContainer.classList.contains("gallery-collapsed")) {
                            setTimeout(() => {
                                const contentHeight = getLoraChromeHeight();
                                this.size[1] = contentHeight + HEADER_HEIGHT;
                                this.setDirtyCanvas(true, true);
                            }, 0);
                        }
                        fetchAndRender(false);
                        updatePresetButtonText(null);
                    };

                    el.querySelectorAll(".remove-lora-btn").forEach(removeTarget => {
                        removeTarget.addEventListener("pointerdown", (e) => {
                            if (removeTarget.classList.contains("locallora-selected-thumb")) return;
                            e.stopPropagation();
                        });
                        removeTarget.addEventListener("click", removeActiveLora);
                    });

                    const dragHandle = el.querySelector(".locallora-selected-thumb") || el;
                    bindMouseReorderHandle(el, dragHandle, ".locallora-lora-item", selectedListEl, (fromIdx, targetIdx) => {
                        if (fromIdx === targetIdx || fromIdx < 0 || targetIdx < 0 || fromIdx >= this.loraData.length || targetIdx >= this.loraData.length) return;
                        const items = [...this.loraData];
                        [items[fromIdx], items[targetIdx]] = [items[targetIdx], items[fromIdx]];
                        this.loraData = items;
                        repaintLoraOrder();
                        updateSelection();
                    });

                    selectedListEl.appendChild(el);
                });
            };

            const repaintLoraOrder = () => {
                renderSelectedList();
                renderCurrentView(false);
                requestAnimationFrame(() => {
                    renderSelectedList();
                    renderCurrentView(false);
                    this.setDirtyCanvas(true, true);
                });
            };

            const loraIconSvg = {
                sync: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-14.5 7.1"></path><path d="M3 12A9 9 0 0 1 17.5 4.9"></path><path d="M18 2v5h-5"></path><path d="M6 22v-5h5"></path></svg>',
                link: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>',
                edit: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
                alert: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
            };
            
            const syncWithCivitai = async (loraName, card) => {
                const syncBtn = card.querySelector('.sync-civitai-btn');

                syncBtn.innerHTML = loraIconSvg.sync;
                syncBtn.title = "Syncing with Civitai";
                syncBtn.classList.remove('error');
                syncBtn.classList.add('loading');
            
                try {
                    const result = await loraApi.syncCivitai(loraName);
            
                    if (result.status === 'ok' && result.metadata) {
                        const { preview_url, preview_type, trigger_words, download_url, tags } = result.metadata;
                        
                        const loraInDataSource = this.availableLoras.find(l => l.name === loraName);
                        if (loraInDataSource) {
                            loraInDataSource.preview_url = preview_url || '';
                            loraInDataSource.preview_type = preview_type || 'none';
                            loraInDataSource.trigger_words = trigger_words || '';
                            loraInDataSource.download_url = download_url || '';
                            loraInDataSource.tags = tags || [];
                        }
                        
                        const mediaContainer = card.querySelector('.locallora-media-container');
                        if (mediaContainer) {
                            if (preview_type === 'video' && preview_url) {
                                mediaContainer.innerHTML = `<video muted loop playsinline src="${escapeHtml(preview_url)}"></video>`;
                                const video = mediaContainer.querySelector('video');
                                card.addEventListener('mouseenter', () => video.play().catch(e => {}));
                                card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
                            } else if (preview_type === 'image' && preview_url) {
                                mediaContainer.innerHTML = `<img src="${escapeHtml(preview_url)}">`;
                            } else {
                                const empty_lora_image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                                mediaContainer.innerHTML = `<img src="${empty_lora_image}">`;
                            }
                        }

                        const triggerEl = card.querySelector('.lora-card-triggers');
                        if(triggerEl) {
                           triggerEl.textContent = trigger_words || 'No triggers';
                           triggerEl.title = trigger_words || '';
                        }
                        card.dataset.triggerWords = trigger_words || '';
                        card.dataset.downloadUrl = download_url || '';
                        card.dataset.tags = (tags || []).join(',');
                        
                        const oldLinkBtn = card.querySelector('.lora-card-link-btn');
                        if(oldLinkBtn) oldLinkBtn.remove();
                        if(download_url){
                            const linkBtn = document.createElement('a');
                            linkBtn.href = download_url;
                            linkBtn.target = '_blank';
                            linkBtn.className = 'card-btn lora-card-link-btn';
                            linkBtn.title = 'Open download page';
                            linkBtn.setAttribute('aria-label', 'Open download page');
                            linkBtn.innerHTML = loraIconSvg.link;
                            linkBtn.addEventListener('click', e => e.stopPropagation());
                            card.prepend(linkBtn);
                        }
                        
                        renderCardTags(card);
                        await loadAllTags();
                    } else {
                       throw new Error(result.message || 'Sync failed');
                    }
            
                } catch (error) {
                    console.error("LocalLoraGallery: Failed to sync with Civitai:", error);
                    syncBtn.innerHTML = loraIconSvg.alert;
                    syncBtn.title = "Civitai sync failed";
                    syncBtn.classList.add('error');
                    setTimeout(() => {
                        syncBtn.innerHTML = loraIconSvg.sync;
                        syncBtn.title = "Sync with Civitai";
                        syncBtn.classList.remove('error');
                    }, 2000);
                } finally {
                    syncBtn.classList.remove('loading');
                    if (!syncBtn.classList.contains('error')) {
                        syncBtn.innerHTML = loraIconSvg.sync;
                        syncBtn.title = "Sync with Civitai";
                    }
                }
            };

            const buildPresetControlsHTML = buildLoraPresetControlsHtml;

            const setupPresetControls = (element, lora) => {
                const presetSelect = element.querySelector('.lora-card-preset-select');
                if (!presetSelect) return;

                const presetStackCheckbox = element.querySelector('.lora-card-preset-stack-checkbox');
                const presetChecklist = element.querySelector('.lora-card-preset-checklist');
                const presetChecks = Array.from(element.querySelectorAll('.lora-card-preset-check'));
                const picker = element.querySelector('.lora-trigger-preset-picker');
                const pickerButton = element.querySelector('.lora-trigger-preset-button');
                const pickerLabel = element.querySelector('.lora-trigger-preset-label');
                const pickerCount = element.querySelector('.lora-trigger-preset-count');
                const pickerPopover = element.querySelector('.lora-trigger-preset-popover');
                const presetOptions = Array.from(element.querySelectorAll('.lora-trigger-preset-option'));
                const presetSearch = element.querySelector('.lora-trigger-preset-search');
                const loraName = element.dataset.loraName || lora.name;
                const getSelectionItem = () => this.loraData.find(item => item.lora === loraName) || null;
                const getPresetNamesFromItem = (item) => item && Array.isArray(item.selected_presets)
                    ? item.selected_presets.filter(Boolean)
                    : (item && item.selected_preset ? [item.selected_preset] : []);
                const existingItem = getSelectionItem();
                const existingPresetNames = getPresetNamesFromItem(existingItem);
                const useStackedTriggerPresets = Boolean(existingItem?.stack_trigger_presets || existingPresetNames.length > 1);

                const getSelectedPresetNames = () => {
                    if (presetStackCheckbox.checked) {
                        return presetChecks.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
                    }
                    return presetSelect.value ? [presetSelect.value] : [];
                };

                const syncPresetPickerUi = (selectedNamesOverride = null, stackingOverride = null) => {
                    let selectedPresetNames = selectedNamesOverride;
                    let stacking = stackingOverride;
                    if (!selectedPresetNames || stacking === null) {
                        const currentItem = getSelectionItem();
                        if (currentItem) {
                            selectedPresetNames = getPresetNamesFromItem(currentItem);
                            stacking = Boolean(currentItem.stack_trigger_presets || selectedPresetNames.length > 1);
                        } else {
                            selectedPresetNames = getSelectedPresetNames();
                            stacking = presetStackCheckbox.checked;
                        }
                    }
                    presetStackCheckbox.checked = stacking;
                    if (stacking) {
                        presetChecks.forEach(checkbox => {
                            checkbox.checked = selectedPresetNames.includes(checkbox.value);
                        });
                    } else {
                        presetSelect.value = selectedPresetNames[0] || "";
                        presetChecks.forEach(checkbox => {
                            checkbox.checked = false;
                        });
                    }
                    picker?.classList.toggle("stacking", stacking);
                    presetChecklist.classList.toggle("visible", false);
                    const selectedLabel = stacking
                        ? (selectedPresetNames.length ? `${selectedPresetNames.length} presets` : "Stack presets")
                        : (presetSelect.value || "Default Triggers");
                    if (pickerLabel) pickerLabel.textContent = selectedLabel;
                    if (pickerCount) pickerCount.textContent = stacking && selectedPresetNames.length ? selectedPresetNames.length : "";
                    presetOptions.forEach(option => {
                        const presetName = option.dataset.presetName || "";
                        const isSelected = stacking
                            ? selectedPresetNames.includes(presetName)
                            : presetName === presetSelect.value;
                        option.classList.toggle("selected", isSelected);
                    });
                };

                presetStackCheckbox.checked = useStackedTriggerPresets;
                if (useStackedTriggerPresets) {
                    presetChecks.forEach(checkbox => {
                        checkbox.checked = existingPresetNames.includes(checkbox.value);
                    });
                } else if (existingPresetNames.length > 0) {
                    presetSelect.value = existingPresetNames[0];
                }
                syncPresetPickerUi();

                const applyPresetSelection = ({ selectedPresetsOverride = null, stackingOverride = null } = {}) => {
                    const item = getSelectionItem();
                    const stacking = stackingOverride ?? presetStackCheckbox.checked;
                    const selectedPresets = selectedPresetsOverride ?? (stacking
                        ? presetChecks.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value)
                        : (presetSelect.value ? [presetSelect.value] : []));
                    if (item) {
                        if (stacking) {
                            item.stack_trigger_presets = true;
                            item.selected_presets = selectedPresets;
                            item.selected_preset = selectedPresets.length === 1 ? selectedPresets[0] : "";
                        } else {
                            item.selected_preset = selectedPresets[0] || "";
                            delete item.selected_presets;
                            delete item.stack_trigger_presets;
                        }
                        updateSelection();
                    }
                    syncPresetPickerUi(selectedPresets, stacking);
                };

                presetSelect.addEventListener('click', (e) => e.stopPropagation());
                presetSelect.addEventListener('mousedown', (e) => e.stopPropagation());
                presetSelect.addEventListener('change', () => applyPresetSelection());
                presetChecklist.addEventListener('click', (e) => e.stopPropagation());
                presetChecks.forEach(checkbox => {
                    checkbox.addEventListener('change', () => applyPresetSelection());
                });
                presetStackCheckbox.addEventListener('click', (e) => e.stopPropagation());
                presetStackCheckbox.addEventListener('change', () => {
                    if (presetStackCheckbox.checked && presetSelect.value) {
                        presetChecks.forEach(checkbox => {
                            checkbox.checked = checkbox.value === presetSelect.value;
                        });
                    }
                    if (!presetStackCheckbox.checked) {
                        const firstSelected = presetChecks.find(checkbox => checkbox.checked);
                        presetSelect.value = firstSelected ? firstSelected.value : "";
                    }
                    applyPresetSelection();
                });

                pickerButton?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const shouldOpen = !picker?.classList.contains("open");
                    widgetContainer.querySelectorAll(".lora-trigger-preset-picker.open").forEach(openPicker => {
                        openPicker.classList.remove("open");
                        openPicker.closest(".locallora-lora-card, .locallora-lora-item")?.classList.remove("preset-open");
                    });
                    picker?.classList.toggle("open", shouldOpen);
                    element.closest(".locallora-lora-card, .locallora-lora-item")?.classList.toggle("preset-open", shouldOpen);
                    if (shouldOpen) presetSearch?.focus();
                });

                pickerPopover?.addEventListener("click", (e) => {
                    const option = e.target.closest?.(".lora-trigger-preset-option");
                    e.stopPropagation();
                    if (!option || !pickerPopover.contains(option)) return;
                    e.preventDefault();
                    const presetName = option.dataset.presetName || "";
                    let selectedPresets = [];
                    const stacking = presetStackCheckbox.checked;
                    if (presetStackCheckbox.checked) {
                        if (!presetName) {
                            presetChecks.forEach(checkbox => checkbox.checked = false);
                        } else {
                            const matchingCheck = presetChecks.find(checkbox => checkbox.value === presetName);
                            if (matchingCheck) matchingCheck.checked = !matchingCheck.checked;
                        }
                        selectedPresets = presetChecks.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
                    } else {
                        presetSelect.value = presetName;
                        selectedPresets = presetName ? [presetName] : [];
                        picker?.classList.remove("open");
                        element.closest(".locallora-lora-card, .locallora-lora-item")?.classList.remove("preset-open");
                    }
                    applyPresetSelection({ selectedPresetsOverride: selectedPresets, stackingOverride: stacking });
                });

                presetSearch?.addEventListener("input", () => {
                    const query = presetSearch.value.trim().toLowerCase();
                    presetOptions.forEach(option => {
                        const optionText = option.textContent.toLowerCase();
                        option.hidden = query && !optionText.includes(query);
                    });
                });
            };

            const getNewLoraEntryFromElement = (element, loraName) => {
                const newEntry = { on: true, lora: loraName, strength: 1.0, strength_clip: 1.0 };
                const lora = this.availableLoras.find(item => item.name === loraName);
                if (lora) {
                    newEntry.preview_url = lora.preview_url || "";
                    newEntry.preview_type = lora.preview_type || "none";
                    newEntry.tags = lora.tags || [];
                    newEntry.trigger_words = lora.trigger_words || "";
                    newEntry.trigger_presets = lora.trigger_presets || {};
                    newEntry.download_url = lora.download_url || "";
                } else {
                    const previewMedia = element.querySelector(".locallora-media-container img, .locallora-media-container video");
                    if (previewMedia?.getAttribute("src")) {
                        newEntry.preview_url = previewMedia.getAttribute("src");
                        newEntry.preview_type = previewMedia.tagName.toLowerCase() === "video" ? "video" : "image";
                    }
                }

                const pSelect = element.querySelector('.lora-card-preset-select');
                const stackPresetCheckbox = element.querySelector('.lora-card-preset-stack-checkbox');
                if (pSelect && stackPresetCheckbox?.checked) {
                    const selectedPresets = Array.from(element.querySelectorAll('.lora-card-preset-check:checked')).map(checkbox => checkbox.value);
                    if (selectedPresets.length > 0) {
                        newEntry.stack_trigger_presets = true;
                        newEntry.selected_presets = selectedPresets;
                        newEntry.selected_preset = selectedPresets.length === 1 ? selectedPresets[0] : "";
                    }
                } else if (pSelect && pSelect.value) {
                    newEntry.selected_preset = pSelect.value;
                }

                return newEntry;
            };

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
                    this.loraData.push(getNewLoraEntryFromElement(element, loraName));
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

                    if (e.ctrlKey) {
                        if (this.selectedCardsForEditing.has(element)) {
                            this.selectedCardsForEditing.delete(element);
                            element.classList.remove("selected-edit");
                        } else {
                            this.selectedCardsForEditing.add(element);
                            element.classList.add("selected-edit");
                        }
                    } else {
                        if (this.selectedCardsForEditing.has(element) && this.selectedCardsForEditing.size === 1) {
                            this.selectedCardsForEditing.clear();
                            element.classList.remove("selected-edit");
                        } else {
                            document.querySelectorAll(`#${uniqueId} .locallora-lora-card.selected-edit`).forEach(c => c.classList.remove("selected-edit"));
                            this.selectedCardsForEditing.clear();

                            this.selectedCardsForEditing.add(element);
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

                    card.innerHTML = buildLoraCardHtml(lora, isSelectedLora, this.selectedCardsForEditing.has(card), getLoraDisplayState().cards_display_mode === "compact", loraIconSvg);
                    
                    setupPresetControls(card, lora);

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

                    if (this.selectedCardsForEditing.has(card)) card.classList.add("selected-edit");

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

            const renderMetadataEditor = () => {
                selectedCountEl.textContent = this.selectedCardsForEditing.size;

                if (this.selectedCardsForEditing.size === 0) {
                    metadataEditor.classList.remove("visible");
                    return;
                }

                tagEditorList.innerHTML = "";
                const allTags = Array.from(this.selectedCardsForEditing).map(card => card.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : []);
                const commonTags = allTags.reduce((a, b) => a.filter(c => b.includes(c)));
                
                commonTags.forEach(tag => {
                    const tagEl = document.createElement("span");
                    tagEl.className = "tag";
                    tagEl.textContent = tag;
                    const removeEl = document.createElement("span");
                    removeEl.className = "remove-tag";
                    removeEl.textContent = "x";
                    removeEl.onclick = async (e) => {
                        e.stopPropagation();
                        const updatePromises = Array.from(this.selectedCardsForEditing).map(async (card) => {
                            const loraName = card.dataset.loraName;
                            const tags = card.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : [];
                            const newTags = tags.filter(t => t !== tag);
                            
                            await UnifiedLoraGalleryNode.updateMetadata(loraName, { tags: newTags });

                            card.dataset.tags = newTags.join(',');
                            const loraInDataSource = this.availableLoras.find(lora => lora.name === loraName);
                            if (loraInDataSource) loraInDataSource.tags = newTags;
                            renderCardTags(card);
                        });
                        await Promise.all(updatePromises);
                        await loadAllTags();
                        renderMetadataEditor();
                    };
                    tagEl.appendChild(removeEl);
                    tagEditorList.appendChild(tagEl);
                });

                if (this.selectedCardsForEditing.size === 1) {
                    const selectedCard = Array.from(this.selectedCardsForEditing)[0];
                    triggerEditorInput.value = selectedCard.dataset.triggerWords || "";
                    triggerEditorRow.style.display = "flex";
                    urlEditorInput.value = selectedCard.dataset.downloadUrl || "";
                    urlEditorRow.style.display = "flex";
                    triggerPresetEditorRow.style.display = "flex";
                    
                    const renderPresetsList = () => {
                        triggerPresetList.innerHTML = "";
                        const loraName = selectedCard.dataset.loraName;
                        const loraInDataSource = this.availableLoras.find(l => l.name === loraName);
                        if (!loraInDataSource) return;
                        const presets = loraInDataSource.trigger_presets || {};
                        for (const [pName, pVal] of Object.entries(presets)) {
                            const row = document.createElement("div");
                            row.style.display = "flex";
                            row.style.gap = "4px";
                            row.style.width = "100%";
                            
                            const nameSpan = document.createElement("span");
                            nameSpan.style.width = "80px";
                            nameSpan.style.fontSize = "10px";
                            nameSpan.style.color = "#ccc";
                            nameSpan.style.overflow = "hidden";
                            nameSpan.style.textOverflow = "ellipsis";
                            nameSpan.textContent = pName;
                            
                            const valSpan = document.createElement("span");
                            valSpan.style.flexGrow = "1";
                            valSpan.style.fontSize = "10px";
                            valSpan.style.color = "#aaa";
                            valSpan.style.overflow = "hidden";
                            valSpan.style.textOverflow = "ellipsis";
                            valSpan.textContent = pVal;
                            
                            const editBtn = document.createElement("button");
                            editBtn.textContent = "Edit";
                            editBtn.title = "Edit Preset";
                            editBtn.style.padding = "0 4px";
                            editBtn.style.background = "none";
                            editBtn.style.border = "none";
                            editBtn.style.cursor = "pointer";
                            editBtn.onclick = (e) => {
                                e.stopPropagation();
                                triggerPresetNameInput.value = pName;
                                triggerPresetValueInput.value = pVal;
                                addTriggerPresetBtn.textContent = "Update";
                            };
                            
                            const rmBtn = document.createElement("button");
                            rmBtn.textContent = "x";
                            rmBtn.title = "Remove Preset";
                            rmBtn.style.padding = "0 4px";
                            rmBtn.style.background = "none";
                            rmBtn.style.border = "none";
                            rmBtn.style.color = "#f55";
                            rmBtn.style.cursor = "pointer";
                            rmBtn.onclick = async (e) => {
                                e.stopPropagation();
                                const newPresets = { ...loraInDataSource.trigger_presets };
                                delete newPresets[pName];
                                await UnifiedLoraGalleryNode.updateMetadata(loraName, { trigger_presets: newPresets });
                                loraInDataSource.trigger_presets = newPresets;
                                renderPresetsList();
                                renderCurrentView();
                                renderSelectedList();
                            };
                            
                            row.appendChild(nameSpan);
                            row.appendChild(valSpan);
                            row.appendChild(editBtn);
                            row.appendChild(rmBtn);
                            triggerPresetList.appendChild(row);
                        }
                    };
                    renderPresetsList();
                } else {
                    triggerEditorRow.style.display = "none";
                    urlEditorRow.style.display = "none";
                    triggerPresetEditorRow.style.display = "none";
                }

                metadataEditor.classList.add("visible");
            };
            
            const renderCardTags = (card) => {
                const tagContainer = card.querySelector(".lora-card-tags");
                tagContainer.innerHTML = "";
                const tags = card.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : [];
                tags.forEach(tag => {
                    const tagEl = document.createElement("span");
                    tagEl.className = "tag";
                    tagEl.textContent = tag;
                    tagEl.addEventListener("click", (e) => {
                        e.stopPropagation();
                        tagFilterInput.value = tag;
                        fetchAndRender();
                    });
                    tagContainer.appendChild(tagEl);
                });
            };
            
            this.initializeNode = async () => {
                let initialState = { 
                    is_collapsed: false, 
                    filter_tag: "",
                    filter_mode: "OR",
                    filter_folder: "",
                    view_mode: "gallery",
                    active_display_mode: "thumbnails",
                    cards_display_mode: "thumbnails",
                    card_contrast_mode: "off",
                    sort_mode: "az",
                    active_thumbnail_size_px: 96,
                    thumbnail_size_px: 168,
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
                setViewMode(initialState.view_mode, false, false);
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
                document.addEventListener("keydown", (e) => {
                    if (e.key === "Escape") {
                        if (this.selectedCardsForEditing.size > 0) {
                            document.querySelectorAll(`#${uniqueId} .locallora-lora-card.selected-edit`).forEach(c => c.classList.remove("selected-edit"));
                            this.selectedCardsForEditing.clear();
                            renderMetadataEditor();
                        }
                    }
                });

                addTriggerPresetBtn.addEventListener("click", async (e) => {
                    e.preventDefault();
                    if (this.selectedCardsForEditing.size !== 1) return;
                    const name = triggerPresetNameInput.value.trim();
                    const val = triggerPresetValueInput.value.trim();
                    if (!name || !val) return;
                    
                    const selectedCard = Array.from(this.selectedCardsForEditing)[0];
                    const loraName = selectedCard.dataset.loraName;
                    const loraInDataSource = this.availableLoras.find(l => l.name === loraName);
                    if (!loraInDataSource) return;
                    
                    const newPresets = { ...(loraInDataSource.trigger_presets || {}) };
                    newPresets[name] = val;
                    await UnifiedLoraGalleryNode.updateMetadata(loraName, { trigger_presets: newPresets });
                    loraInDataSource.trigger_presets = newPresets;
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
                        if (this.selectedCardsForEditing.size !== 1) return;

                        const selectedCard = Array.from(this.selectedCardsForEditing)[0];
                        const loraName = selectedCard.dataset.loraName;
                        const newUrl = urlEditorInput.value.trim();

                        await UnifiedLoraGalleryNode.updateMetadata(loraName, { download_url: newUrl });

                        selectedCard.dataset.downloadUrl = newUrl;
                        const loraInDataSource = this.availableLoras.find(l => l.name === loraName);
                        if (loraInDataSource) loraInDataSource.download_url = newUrl;
                        
                        let linkBtn = selectedCard.querySelector('.lora-card-link-btn');
                        if (newUrl) {
                            if (!linkBtn) {
                                linkBtn = document.createElement('a');
                                linkBtn.className = 'card-btn lora-card-link-btn';
                                linkBtn.title = 'Open download page';
                                linkBtn.setAttribute('aria-label', 'Open download page');
                                linkBtn.innerHTML = loraIconSvg.link;
                                linkBtn.target = '_blank';
                                linkBtn.addEventListener("click", (e) => e.stopPropagation());
                                selectedCard.prepend(linkBtn);
                            }
                            linkBtn.href = newUrl;
                        } else if (linkBtn) {
                            linkBtn.remove();
                        }

                        const originalColor = urlEditorInput.style.backgroundColor;
                        urlEditorInput.style.backgroundColor = "#2a5";
                        setTimeout(() => { urlEditorInput.style.backgroundColor = ""; }, 500);
                    }
                });

                triggerEditorInput.addEventListener("keydown", async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (this.selectedCardsForEditing.size !== 1) return;

                        const selectedCard = Array.from(this.selectedCardsForEditing)[0];
                        const loraName = selectedCard.dataset.loraName;
                        const newTriggers = triggerEditorInput.value.trim();

                        await UnifiedLoraGalleryNode.updateMetadata(loraName, { trigger_words: newTriggers });

                        selectedCard.dataset.triggerWords = newTriggers;
                        const loraInDataSource = this.availableLoras.find(l => l.name === loraName);
                        if (loraInDataSource) loraInDataSource.trigger_words = newTriggers;
                        
                        const triggerDisplayEl = selectedCard.querySelector('.lora-card-triggers');
                        if(triggerDisplayEl) {
                            triggerDisplayEl.textContent = newTriggers || 'No triggers';
                            triggerDisplayEl.title = newTriggers;
                        }
                        
                        const originalColor = triggerEditorInput.style.backgroundColor;
                        triggerEditorInput.style.backgroundColor = "#2a5";
                        setTimeout(() => { triggerEditorInput.style.backgroundColor = ""; }, 500);
                    }
                });
                
                tagEditorInput.addEventListener("keydown", async (e) => {
                    if (e.key === 'Enter' && tagEditorInput.value.trim()) {
                        e.preventDefault();
                        const newTag = tagEditorInput.value.trim();
                        if (newTag) {
                            const updatePromises = Array.from(this.selectedCardsForEditing).map(async (card) => {
                                const loraName = card.dataset.loraName;
                                const tags = card.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : [];
                                
                                if (!tags.includes(newTag)) {
                                    tags.push(newTag);
                                    await UnifiedLoraGalleryNode.updateMetadata(loraName, { tags: tags });
                                    card.dataset.tags = tags.join(',');
                                    const loraInDataSource = this.availableLoras.find(lora => lora.name === loraName);
                                    if (loraInDataSource) loraInDataSource.tags = [...tags];
                                    renderCardTags(card);
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
                    folderOverflowOpen = false;
                    renderFolderPills();
                    saveStateAndFetch();
                });
                folderPullTab?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    folderOverflowOpen = !folderOverflowOpen;
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
                    this.loraUiState.active_display_mode = normalizeChoice(event.target.value, LORA_DISPLAY_MODES, "thumbnails");
                    applyLoraDisplayState();
                    renderSelectedList();
                    queueLoraDisplayStateSave();
                    this.setDirtyCanvas(true, true);
                });

                widgetContainer.querySelector(".lora-cards-display-mode")?.addEventListener("change", (event) => {
                    this.loraUiState.cards_display_mode = normalizeChoice(event.target.value, LORA_DISPLAY_MODES, "thumbnails");
                    applyLoraDisplayState();
                    renderCurrentView(false);
                    queueLoraDisplayStateSave();
                    this.setDirtyCanvas(true, true);
                });

                widgetContainer.querySelector(".lora-card-contrast-select")?.addEventListener("change", (event) => {
                    this.loraUiState.card_contrast_mode = normalizeChoice(event.target.value, LORA_CONTRAST_MODES, "off");
                    applyLoraDisplayState();
                    queueLoraDisplayStateSave();
                });

                widgetContainer.querySelector(".lora-active-thumbnail-size-slider")?.addEventListener("input", (event) => {
                    if (event.target.disabled) return;
                    this.loraUiState.active_thumbnail_size_px = clampNumber(event.target.value, LORA_ACTIVE_THUMBNAIL_MIN, LORA_ACTIVE_THUMBNAIL_MAX, 96);
                    applyLoraDisplayState();
                    queueLoraDisplayStateSave();
                    this.setDirtyCanvas(true, true);
                });

                widgetContainer.querySelector(".lora-thumbnail-size-slider")?.addEventListener("input", (event) => {
                    if (event.target.disabled) return;
                    this.loraUiState.thumbnail_size_px = clampNumber(event.target.value, LORA_CARD_THUMBNAIL_MIN, LORA_CARD_THUMBNAIL_MAX, 168);
                    applyLoraDisplayState();
                    queueLoraDisplayStateSave();
                });

                widgetContainer.querySelector(".lora-sort-select")?.addEventListener("change", async (event) => {
                    this.loraUiState.sort_mode = normalizeChoice(event.target.value, LORA_SORT_MODES, "az");
                    syncDisplayOptionControls();
                    await persistLoraUiState({ sort_mode: this.loraUiState.sort_mode });
                    await fetchAndRender(false);
                });

                widgetContainer.querySelector(".lora-visible-folders-slider")?.addEventListener("input", (event) => {
                    const count = parseInt(event.target.value, 10);
                    const oldCount = getVisiblePinnedFolderCount();
                    this.loraUiState.visible_pinned_folder_count = Number.isInteger(count) ? Math.max(1, Math.min(25, count)) : 8;
                    
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

                searchInput.addEventListener("input", () => renderCurrentView(false));
                tagFilterInput.addEventListener("keydown", (e) => { if(e.key === 'Enter') saveStateAndFetch(); });
                
                const arrow = multiSelectTagContainer.querySelector('.locallora-multiselect-arrow');
                multiSelectTagDisplay.addEventListener('click', () => {
                    const isVisible = multiSelectTagDropdown.style.display === 'block';
                    multiSelectTagDropdown.style.display = isVisible ? 'none' : 'block';
                    arrow.classList.toggle('open', !isVisible);
                });

                document.addEventListener('click', (e) => {
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
                    if (!e.target.closest?.(`#${uniqueId} .lora-active-stack-btn, #${uniqueId} .locallora-selected-list`)) {
                        closeActiveStack();
                    }
                    if (!e.target.closest?.(`#${uniqueId} .lora-folder-nav`)) {
                        folderOverflowOpen = false;
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
                    if (activeLoraFolderContextMenu && !activeLoraFolderContextMenu.contains(event.target)) {
                        closeLoraFolderContextMenu();
                    }
                };
                const globalLoraKeydownHandler = (event) => {
                    if (event.key === "Escape") {
                        closeLoraFolderContextMenu();
                        if (folderDragState) {
                            folderDragState.pill.classList.remove("pinned-dragging");
                            folderDragState.pill.releasePointerCapture?.(folderDragState.pointerId);
                            folderDragState = null;
                            clearLoraFolderDragTargets();
                        }
                    }
                };
                const globalLoraResizeHandler = () => {
                    closeLoraFolderContextMenu();
                };

                document.addEventListener("pointerdown", globalLoraPointerDownHandler, { capture: true });
                document.addEventListener("keydown", globalLoraKeydownHandler);
                window.addEventListener("resize", globalLoraResizeHandler);
                window.addEventListener("pointermove", onLoraFolderPointerMove);
                window.addEventListener("pointerup", onLoraFolderPointerUp);
                window.addEventListener("pointercancel", onLoraFolderPointerCancel);

                // Clean up on node removal
                const originalOnRemoved = this.onRemoved;
                this.onRemoved = function () {
                    document.removeEventListener("pointerdown", globalLoraPointerDownHandler, { capture: true });
                    document.removeEventListener("keydown", globalLoraKeydownHandler);
                    window.removeEventListener("resize", globalLoraResizeHandler);
                    window.removeEventListener("pointermove", onLoraFolderPointerMove);
                    window.removeEventListener("pointerup", onLoraFolderPointerUp);
                    window.removeEventListener("pointercancel", onLoraFolderPointerCancel);
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

app.registerExtension({
    name: "LocalGalleryPromptLora.LoraUI",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "LocalGalleryPromptLora") {
            UnifiedLoraGalleryNode.setup(nodeType, nodeData);
        }
    },
});
}

