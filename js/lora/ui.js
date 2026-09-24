import { confirmAction } from "../shared/nativeDialogs.js";
import { api } from "../../../scripts/api.js";
import * as loraApi from "../api/loraApi.js";
import { escapeHtml, sanitizeHttpUrl } from "../shared/dom.js";
import { createOperationFeedback } from "../shared/operationFeedback.js?v=operation-feedback-20260809-3";
import { createEventListenerRegistry } from "../shared/events.js";
import { cloneJsonOr, readSelectionArray, writeSelectionArray } from "../shared/json.js";
import {
    readWorkflowProfileSection,
    writeWorkflowProfileSection,
} from "../shared/workflowProfile.js";
import {
    LORA_DISPLAY_LIMITS,
    LORA_BAR_SIZE_CLASSES,
    clampInteger,
    getLoraActiveCardControlScale,
    normalizeBarsSizeScale,
    normalizeLoraContrastMode,
    normalizeLoraDisplayMode,
    normalizeLoraDisplayState,
    normalizeLoraSortMode,
    normalizeVisiblePinnedFolderCount,
} from "./displayState.js";
import { buildLoraCardHtml } from "./renderers.js";
import { getResponsiveLoraBrowserCardLayout } from "./browserCardLayout.js";
import { createLoraActiveStackController } from "./activeStackController.js";
import { createLoraMetadataController } from "./metadataEditor.js";
import { createLoraFolderController } from "./folderController.js";
import { syncLoraWithCivitai } from "./civitaiSync.js";
import { buildLoraSelectionEntry } from "./selectionEntry.js";
import { normalizeLoraLotteryConfig, readLoraLotteryConfig } from "./lotteryState.js";
import { setupLoraPresetControls } from "./presetControls.js";
import { toSerializableLoraSelection } from "./selectionState.js";
import { setupLoraStateWidgets } from "./stateWidgets.js";
import { getLoraStyles } from "./styles.js";
import { getLoraReferenceUxStyles } from "./referenceUx.js";

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
                                        <button class="lora-folder-pill lora-folder-more-btn" type="button" hidden
                                            aria-expanded="false" aria-controls="${uniqueId}-folder-overflow"
                                            title="Show all LoRA folders" aria-label="Show all LoRA folders">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                        </button>
                                    </div>
                                    <div class="lora-folder-overflow-wrapper">
                                        <div class="lora-folder-overflow" id="${uniqueId}-folder-overflow">
                                            <div class="lora-folder-overflow-chips"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="locallora-controls-row locallora-hidden-filters" aria-hidden="true">
                                <button class="toggle-all-btn">Toggle All</button>
                                <button class="clear-all-btn" title="Clear all selected LoRAs">Clear All</button>
                                <button class="toggle-gallery-btn" title="Toggle Gallery">Hide Gallery</button>
                            </div>
                            
                            <div class="locallora-metadata-editor" aria-label="LoRA details editor">
                                <div class="lora-metadata-editor-header">
                                    <div class="lora-metadata-editor-heading">
                                        <strong class="lora-metadata-editor-title">Selected LoRA</strong>
                                        <span class="lora-metadata-editor-selection"><span class="selected-count">0</span><span class="lora-metadata-editor-selection-label"> selected</span></span>
                                    </div>
                                    <div class="lora-metadata-editor-actions">
                                        <div class="lora-thumbnail-editor-action">
                                            <button class="use-last-output-thumbnail-btn" type="button" disabled>
                                                <span class="lora-thumbnail-action-icon" aria-hidden="true">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16"></path><path d="M14 14l1.6-1.6a2 2 0 0 1 2.8 0L21 15"></path><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle></svg>
                                                </span>
                                                <span class="lora-thumbnail-action-label">Use last result</span>
                                            </button>
                                            <span class="lora-thumbnail-action-status" aria-live="polite"></span>
                                        </div>
                                        <button class="lora-metadata-editor-close" type="button" aria-label="Close LoRA details" title="Close">×</button>
                                    </div>
                                </div>
                                <div class="lora-metadata-editor-grid">
                                    <label class="lora-metadata-field trigger-editor-row" style="display:none;">
                                        <span>Trigger words</span>
                                        <input type="text" class="trigger-editor-input" placeholder="Words added when this LoRA is used">
                                    </label>
                                    <label class="lora-metadata-field url-editor-row" style="display:none;">
                                        <span>Source URL</span>
                                        <input type="text" class="url-editor-input" placeholder="Civitai or download page">
                                    </label>
                                </div>
                                <div class="lora-metadata-field strength-memory-editor-row" style="display:none;">
                                    <label class="strength-memory-enable-label">
                                        <input type="checkbox" class="strength-memory-enable-input">
                                        <span>Remember strengths</span>
                                    </label>
                                    <small>Re-select this LoRA with these strengths.</small>
                                    <div class="strength-memory-controls">
                                        <label class="strength-memory-control">
                                            <span>Model</span>
                                            <input type="number" class="strength-memory-model-input" step="0.05" min="-10" max="10" value="1">
                                        </label>
                                        <label class="strength-memory-control strength-memory-clip-control">
                                            <span>CLIP</span>
                                            <input type="number" class="strength-memory-clip-input" step="0.05" min="-2" max="2" value="1">
                                        </label>
                                    </div>
                                </div>
                                <div class="lora-metadata-field trigger-preset-editor-row" style="display:none;">
                                    <button class="lora-trigger-preset-editor-toggle" type="button" aria-expanded="false">
                                        <span class="lora-metadata-field-label">
                                            <span>Trigger presets <span class="lora-trigger-preset-count"></span></span>
                                            <small>Alternate trigger word sets</small>
                                        </span>
                                        <span class="lora-trigger-preset-toggle-icon" aria-hidden="true">⌄</span>
                                    </button>
                                    <div class="lora-trigger-preset-content" hidden>
                                        <div class="trigger-preset-list"></div>
                                        <div class="lora-trigger-preset-form">
                                            <input type="text" class="trigger-preset-name-input" placeholder="Preset name">
                                            <input type="text" class="trigger-preset-value-input" placeholder="Trigger words">
                                            <button class="add-trigger-preset-btn" type="button">Add preset</button>
                                        </div>
                                    </div>
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
                            <div class="lora-execution-controls">
                                <button class="lora-execution-mode-btn" type="button" data-mode="stack" title="Stack enabled LoRAs onto one model">
                                    <span class="lora-execution-mode-icon" aria-hidden="true">
                                        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="3" y="4" width="7" height="16" rx="1.5"></rect>
                                            <rect x="14" y="4" width="7" height="16" rx="1.5"></rect>
                                            <path d="M10 9h4M10 15h4"></path>
                                        </svg>
                                    </span>
                                    <span class="lora-execution-mode-label">Stack</span>
                                </button>
                                <label class="lora-compare-strengths-control" title="Comma-separated strengths used for every selected LoRA" hidden>
                                    <span>Strengths</span>
                                    <input class="lora-compare-strengths-input" type="text" value="1.0" placeholder="0.8, 1.0" spellcheck="false">
                                </label>
                            </div>
                            <div class="lora-lottery-anchor">
                                <button class="lora-action-btn lora-lottery-btn" type="button" title="Configure a random LoRA for every run" aria-label="Configure LoRA lottery" aria-expanded="false">
                                    <span aria-hidden="true">RND</span>
                                </button>
                                <div class="lora-lottery-popover" style="display: none;">
                                    <div class="lora-lottery-heading">
                                        <strong>Run lottery</strong>
                                        <span>Draw one LoRA on every queue.</span>
                                    </div>
                                    <label class="lora-lottery-enabled">
                                        <input class="lora-lottery-enabled-input" type="checkbox">
                                        <span>Enable lottery</span>
                                    </label>
                                    <label class="lora-lottery-field">
                                        <span>Category</span>
                                        <select class="lora-lottery-folder-select">
                                            <option value="">All folders</option>
                                        </select>
                                    </label>
                                    <div class="lora-lottery-strengths">
                                        <label class="lora-lottery-field">
                                            <span>Model</span>
                                            <input class="lora-lottery-strength-input" type="number" value="1" step="0.05">
                                        </label>
                                        <label class="lora-lottery-field">
                                            <span>CLIP</span>
                                            <input class="lora-lottery-clip-strength-input" type="number" value="1" step="0.05">
                                        </label>
                                    </div>
                                    <p class="lora-lottery-status" aria-live="polite">Off. Your Active Stack is unchanged.</p>
                                </div>
                            </div>
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
                                            <label class="lora-checkbox-option-label" title="Move selected LoRAs to the beginning of the loaded cards">
                                                <input type="checkbox" class="lora-move-active-to-top-checkbox">
                                                Move active LoRAs to top
                                            </label>
                                        </section>
                                        <section class="lora-display-section">
                                            <div class="lora-display-section-title">BAR SIZE</div>
                                            <select class="lora-display-mode-select lora-bars-size-select" title="Top and bottom bar size">
                                                <option value="75">Compact</option>
                                                <option value="100">Normal</option>
                                                <option value="125">Large</option>
                                                <option value="150">XL</option>
                                            </select>
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
                                                <input class="lora-visible-folders-slider" type="range" min="1" max="20" step="1">
                                                <span>20</span>
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
            const strengthMemoryClipControl = widgetContainer.querySelector(".strength-memory-clip-control");
            const strengthMemoryClipInput = widgetContainer.querySelector(".strength-memory-clip-input");
            const toggleGalleryBtn = widgetContainer.querySelector(".toggle-gallery-btn");
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
            const folderOverflowChips = widgetContainer.querySelector(".lora-folder-overflow-chips");
            const folderMoreBtn = widgetContainer.querySelector(".lora-folder-more-btn");
            const savePresetBtn = widgetContainer.querySelector(".save-preset-btn");
            const loadPresetBtn = widgetContainer.querySelector(".load-preset-btn");
            const presetDropdown = widgetContainer.querySelector(".preset-dropdown");
            const operationFeedback = createOperationFeedback({
                host: widgetContainer.querySelector(".locallora-bottom-bar"),
                before: widgetContainer.querySelector(".lora-execution-controls"),
                readyMessage: "Ready",
            });
            this.operationFeedback = operationFeedback;
            const displayOptionsBtn = widgetContainer.querySelector(".lora-display-options-btn");
            const displayOptionsPopover = widgetContainer.querySelector(".lora-display-options-popover");
            const searchAnchor = widgetContainer.querySelector(".lora-search-anchor");
            const searchBtn = widgetContainer.querySelector(".lora-search-btn");
            const searchPopover = widgetContainer.querySelector(".lora-search-popover");
            const clearNameSearchBtn = widgetContainer.querySelector(".lora-search-clear-btn");
            const executionModeBtn = widgetContainer.querySelector(".lora-execution-mode-btn");
            const executionModeLabel = widgetContainer.querySelector(".lora-execution-mode-label");
            const compareStrengthsControl = widgetContainer.querySelector(".lora-compare-strengths-control");
            const compareStrengthsInput = widgetContainer.querySelector(".lora-compare-strengths-input");
            const lotteryAnchor = widgetContainer.querySelector(".lora-lottery-anchor");
            const lotteryBtn = widgetContainer.querySelector(".lora-lottery-btn");
            const lotteryPopover = widgetContainer.querySelector(".lora-lottery-popover");
            const lotteryEnabledInput = widgetContainer.querySelector(".lora-lottery-enabled-input");
            const lotteryFolderSelect = widgetContainer.querySelector(".lora-lottery-folder-select");
            const lotteryStrengthInput = widgetContainer.querySelector(".lora-lottery-strength-input");
            const lotteryClipStrengthInput = widgetContainer.querySelector(".lora-lottery-clip-strength-input");
            const lotteryStatus = widgetContainer.querySelector(".lora-lottery-status");
            let lotteryFolderValue = "";
            const getLoraChromeHeight = () => {
                const controlsEl = widgetContainer.querySelector(".locallora-controls");
                const bottomBarEl = widgetContainer.querySelector(".locallora-bottom-bar");
                return (controlsEl?.offsetHeight || 0) + (bottomBarEl?.offsetHeight || 0);
            };
            const getVisiblePinnedFolderCount = () => normalizeVisiblePinnedFolderCount(
                this.loraUiState?.visible_pinned_folder_count,
            );
            const getLoraDisplayState = () => normalizeLoraDisplayState(this.loraUiState);
            const syncExecutionControls = () => {
                const mode = this.properties?.lora_execution_mode === "compare" ? "compare" : "stack";
                const strengths = String(this.properties?.lora_compare_strengths || "1.0");
                executionModeBtn.dataset.mode = mode;
                executionModeBtn.classList.toggle("compare", mode === "compare");
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
                lotteryBtn.classList.toggle("has-preset", config.enabled);
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
                    visible_pinned_folder_count: this.loraUiState.visible_pinned_folder_count,
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
                const activeThumbnailSlider = widgetContainer.querySelector(".lora-active-thumbnail-size-slider");
                const cardThumbnailSlider = widgetContainer.querySelector(".lora-thumbnail-size-slider");
                const barsSizeSelect = widgetContainer.querySelector(".lora-bars-size-select");
                if (activeModeSelect) activeModeSelect.value = state.active_display_mode;
                if (cardsModeSelect) cardsModeSelect.value = state.cards_display_mode;
                if (contrastSelect) contrastSelect.value = state.card_contrast_mode;
                if (sortSelect) sortSelect.value = state.sort_mode;
                if (foldersSlider) foldersSlider.value = getVisiblePinnedFolderCount();
                if (activeThumbnailSlider) activeThumbnailSlider.value = state.active_thumbnail_size_px;
                if (cardThumbnailSlider) cardThumbnailSlider.value = state.thumbnail_size_px;
                if (barsSizeSelect) barsSizeSelect.value = String(state.bars_size_scale);
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
                const moveActiveToTopCheckbox = widgetContainer.querySelector(".lora-move-active-to-top-checkbox");
                if (moveActiveToTopCheckbox) {
                    moveActiveToTopCheckbox.checked = state.move_active_loras_to_top;
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
                const activeCardControlScale = getLoraActiveCardControlScale(state.active_thumbnail_size_px)
                    * (state.active_card_size_mode === "large" ? 1.32 : 1);
                mainContainer.style.setProperty("--lora-active-card-control-scale", activeCardControlScale.toFixed(3));
                mainContainer.style.setProperty("--locallora-active-sidebar-width", `${state.active_sidebar_width}px`);
                const barsSizeClass = LORA_BAR_SIZE_CLASSES[state.bars_size_scale] || "";
                mainContainer.classList.remove("bars-compact", "bars-large", "bars-xl");
                if (barsSizeClass) mainContainer.classList.add(barsSizeClass);
                const sidebarEl = widgetContainer.querySelector(".locallora-active-sidebar");
                if (sidebarEl) {
                    sidebarEl.classList.toggle("large-mode", state.active_card_size_mode === "large");
                }
                scheduleBrowserCardLayout();
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
                    filter_folder: folderFilterSelect.value,
                    folder_colors: this.loraUiState.folder_colors,
                    pinned_folders: this.loraUiState.pinned_folders,
                    folder_order: this.loraUiState.folder_order,
                    visible_pinned_folder_count: this.loraUiState.visible_pinned_folder_count,
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
                folderOverflowChips,
                folderMoreBtn,
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
                headerHeight: HEADER_HEIGHT,
                getLoraDisplayState,
                getLoraChromeHeight,
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
                lotteryFolderSelect.innerHTML = `<option value="">All folders</option>`;
                
                const orderedFolders = getFoldersInCurrentOrder(folders);
                orderedFolders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder;
                    option.textContent = folder === "." ? "Root" : folder.replaceAll('\\', '/');
                    folderFilterSelect.appendChild(option);
                    lotteryFolderSelect.appendChild(option.cloneNode(true));
                });
                folderFilterSelect.value = currentVal;
                lotteryFolderValue = validOptions.has(lotteryFolderValue) ? lotteryFolderValue : "";
                lotteryFolderSelect.value = validOptions.has(lotteryFolderValue)
                    ? lotteryFolderValue
                    : "";
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
                        if (confirmAction(`Are you sure you want to delete preset "${name}"?`)) {
                            deleteBtn.style.pointerEvents = "none";
                            operationFeedback.pending(`Deleting preset "${name}"...`);
                            try {
                                const data = await loraApi.deletePreset(name);
                                renderPresets(data.presets);
                                operationFeedback.success(`Preset "${name}" deleted`);
                            } catch (error) {
                                operationFeedback.error(error?.message || "Could not delete LoRA preset");
                            } finally {
                                deleteBtn.style.pointerEvents = "";
                            }
                        }
                    };
                    presetLink.appendChild(deleteBtn);
                    
                    presetLink.onclick = async (e) => {
                        e.preventDefault();
                        operationFeedback.pending(`Applying preset "${name}"...`);
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
                        const refreshed = await fetchAndRender(false);
                        renderSelectedList();
                        presetDropdown.style.display = 'none';

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
                    presetDropdown.appendChild(presetLink);
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
                strengthMemoryClipControl,
                strengthMemoryClipInput,
                getLoraMetadataByName,
                updateCachedLoraMetadata,
                findGalleryCardByLoraName,
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
                    is_collapsed: false, 
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
                    pinned_folders: [],
                    folder_order: [],
                    visible_pinned_folder_count: 8,
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
                        if (loadedState.pinned_folders && !Array.isArray(loadedState.pinned_folders)) {
                            loadedState.pinned_folders = [];
                        }
                        if (loadedState.folder_order && !Array.isArray(loadedState.folder_order)) {
                            loadedState.folder_order = [];
                        }
                        if (loadedState.visible_pinned_folder_count !== undefined) {
                            // Route through the shared normalizer so the slider bounds,
                            // the load path, and the save path can never drift apart.
                            loadedState.visible_pinned_folder_count = normalizeVisiblePinnedFolderCount(loadedState.visible_pinned_folder_count);
                        }
                    }
                    initialState = { ...initialState, ...loadedState };
                } catch(e) { 
                    console.error("LocalLoraGallery: Failed to get initial UI state.", e); 
                }
                initialState.is_collapsed = false;
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

                const setLotteryOpen = (isOpen) => {
                    lotteryPopover.style.display = isOpen ? "flex" : "none";
                    lotteryBtn.setAttribute("aria-expanded", String(isOpen));
                    lotteryBtn.classList.toggle("active", isOpen);
                };
                lotteryBtn?.addEventListener("click", (event) => {
                    event.stopPropagation();
                    const shouldOpen = lotteryPopover.style.display !== "flex";
                    presetDropdown.style.display = "none";
                    displayOptionsPopover.style.display = "none";
                    displayOptionsBtn.classList.remove("active");
                    setLotteryOpen(shouldOpen);
                });
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
                    addTriggerPresetBtn.disabled = true;
                    operationFeedback.pending(`Saving trigger preset "${name}"...`);
                    try {
                        await UnifiedLoraGalleryNode.updateMetadata(loraName, { trigger_presets: newPresets });
                        updateCachedLoraMetadata(loraName, { trigger_presets: newPresets });
                        triggerPresetNameInput.value = "";
                        triggerPresetValueInput.value = "";
                        addTriggerPresetBtn.textContent = "Add preset";
                        renderMetadataEditor();
                        renderCurrentView();
                        renderSelectedList();
                        operationFeedback.success(`Trigger preset "${name}" saved to gallery`);
                    } catch (error) {
                        operationFeedback.error(error?.message || "Could not save trigger preset");
                    } finally {
                        addTriggerPresetBtn.disabled = false;
                    }
                });

                urlEditorInput.addEventListener("keydown", async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const editingLoras = getEditingLorasData();
                        if (editingLoras.length !== 1) return;

                        const singleLora = editingLoras[0];
                        const loraName = singleLora.name;
                        const newUrl = urlEditorInput.value.trim();
                        urlEditorInput.disabled = true;
                        operationFeedback.pending("Saving LoRA download URL...");
                        try {
                            await UnifiedLoraGalleryNode.updateMetadata(loraName, { download_url: newUrl });
                            updateCachedLoraMetadata(loraName, { download_url: newUrl });

                            const card = findGalleryCardByLoraName(loraName);
                            if (card) {
                                card.dataset.downloadUrl = newUrl;
                                const safeUrl = sanitizeHttpUrl(newUrl);
                                let linkBtn = card.querySelector('.lora-card-link-btn');
                                if (safeUrl) {
                                    if (!linkBtn) {
                                        linkBtn = document.createElement('a');
                                        linkBtn.className = 'card-btn lora-card-link-btn';
                                        linkBtn.title = 'Open download page';
                                        linkBtn.setAttribute('aria-label', 'Open download page');
                                        linkBtn.innerHTML = loraIconSvg.link;
                                        linkBtn.target = '_blank';
                                        linkBtn.rel = 'noopener noreferrer';
                                        linkBtn.addEventListener("click", (event) => event.stopPropagation());
                                        card.prepend(linkBtn);
                                    }
                                    linkBtn.href = safeUrl;
                                } else if (linkBtn) {
                                    linkBtn.remove();
                                }
                            }

                            urlEditorInput.style.backgroundColor = "#2a5";
                            setTimeout(() => { urlEditorInput.style.backgroundColor = ""; }, 500);
                            operationFeedback.success("LoRA download URL saved to gallery");
                        } catch (error) {
                            operationFeedback.error(error?.message || "Could not save LoRA download URL");
                        } finally {
                            urlEditorInput.disabled = false;
                        }
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
                        triggerEditorInput.disabled = true;
                        operationFeedback.pending("Saving LoRA trigger words...");
                        try {
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
                            operationFeedback.success("LoRA trigger words saved to gallery");
                        } catch (error) {
                            operationFeedback.error(error?.message || "Could not save LoRA trigger words");
                        } finally {
                            triggerEditorInput.disabled = false;
                        }
                    }
                });
                
                widgetContainer.querySelector(".clear-all-btn").addEventListener("click", clearAllLoras);
                
                folderFilterSelect.addEventListener("change", () => {
                    folderController.overflowOpen = false;
                    renderFolderPills();
                    saveStateAndFetch();
                });
                folderMoreBtn?.addEventListener("click", (e) => {
                    e.stopPropagation();
                    folderController.toggleOverflow();
                    renderFolderPills();
                });
                savePresetBtn.addEventListener("click", async () => {
                    const presetName = prompt("Enter a name for this preset:", "");
                    if (presetName && this.loraData.length > 0) {
                        savePresetBtn.disabled = true;
                        operationFeedback.pending(`Saving preset "${presetName}"...`);
                        try {
                            const data = await loraApi.savePreset(presetName, this.loraData);
                            renderPresets(data.presets);
                            operationFeedback.success(`Preset "${presetName}" saved to gallery`);
                        } catch (error) {
                            operationFeedback.error(error?.message || "Could not save LoRA preset");
                        } finally {
                            savePresetBtn.disabled = false;
                        }
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

                widgetContainer.querySelector(".lora-move-active-to-top-checkbox")?.addEventListener("change", async (event) => {
                    this.loraUiState.move_active_loras_to_top = Boolean(event.target.checked);
                    syncGallerySelectionSoon();
                    await persistLoraUiState({
                        move_active_loras_to_top: this.loraUiState.move_active_loras_to_top,
                    });
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

                widgetContainer.querySelector(".lora-bars-size-select")?.addEventListener("change", async (event) => {
                    this.loraUiState.bars_size_scale = normalizeBarsSizeScale(event.target.value);
                    applyLoraDisplayState();
                    await flushLoraDisplayStateSave();
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
                    
                    persistLoraUiState({ is_collapsed: isCollapsing });
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
                    queueNameSearchReconciliation();
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
                    queueNameSearchReconciliation(true);
                    searchInput.focus();
                });
                globalListeners.listen(document, 'click', (e) => {
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
                    if (lotteryPopover && !lotteryAnchor.contains(e.target)) {
                        setLotteryOpen(false);
                    }
                    const hitPortaledPresetMenu = Boolean(
                        e.target.closest?.(".lora-trigger-preset-popover-portal"),
                    );
                    if (
                        !hitPortaledPresetMenu
                        && !e.target.closest?.(`#${uniqueId} .lora-active-stack-btn, #${uniqueId}-active-sidebar`)
                    ) {
                        closeActiveStack();
                    }
                    if (!e.target.closest?.(`#${uniqueId} .lora-folder-nav`)) {
                        folderController.overflowOpen = false;
                        renderFolderPills();
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
                    folderController.cancelDrag();
                    activeStackController.dispose();
                    flushRememberedStrengthTimers();
                    operationFeedback.dispose();
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

