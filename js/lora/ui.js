import * as loraApi from "../api/loraApi.js";
import { escapeHtml } from "../shared/dom.js";
import { cloneJsonOr, readSelectionArray, writeSelectionArray } from "../shared/json.js";
import { collapseWidget } from "../shared/widgets.js";
import { moveSelectedLora } from "./helpers.js";

export function registerLoraGalleryUi(app) {
const UnifiedLoraGalleryNode = {
    name: "LocalLoraGallery",
    isLoading: false,
    currentPage: 1,
    totalPages: 1,
    
    async getLoras(filter_tag = "", mode = "OR", folder = "", page = 1, selected_loras = [], per_page = 50) {
        this.isLoading = true;
        try {
            const data = await loraApi.getLoras(filter_tag, mode, folder, page, selected_loras, per_page);
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

            if (!this.properties || !this.properties.lora_gallery_unique_id) {
                if (!this.properties) { this.properties = {}; }
                this.properties.lora_gallery_unique_id = "lora-gallery-" + Math.random().toString(36).substring(2, 11);
            }

            const galleryIdWidget = this.addWidget(
                "text",
                "lora_gallery_unique_id_widget",
                this.properties.lora_gallery_unique_id,
                () => {},
                {}
            );

            galleryIdWidget.serializeValue = () => {
                return this.properties.lora_gallery_unique_id;
            };

            collapseWidget(galleryIdWidget);
            
            const HEADER_HEIGHT = 90;
            const MIN_NODE_WIDTH = 600;
            const COMPACT_NODE_WIDTH = 480;

            this.size = [700, 600];
            this.loraData = [];
            this.availableLoras = [];
            this.isModelOnly = nodeData.name.includes("ModelOnly");
            this.selectedCardsForEditing = new Set();

            const node_instance = this;
            const selectionWidget = this.addWidget(
                "text",
                "lora_selection_data",
                this.properties.lora_selection_data || "[]",
                () => {},
                { multiline: true }
            );
            selectionWidget.serializeValue = () => {
                return node_instance.properties["lora_selection_data"] || "[]";
            };
            collapseWidget(selectionWidget);

            const widgetContainer = document.createElement("div");
            widgetContainer.className = "locallora-container-wrapper";
            this.addDOMWidget("lora_gallery", "div", widgetContainer, {});

            const uniqueId = `locallora-gallery-${this.id}`;
            widgetContainer.innerHTML = `
                <style>
                    /* --- General Styles --- */
                    #${uniqueId} .locallora-container { display: flex; flex-direction: column; height: 100%; font-family: sans-serif; }
                    #${uniqueId} .locallora-selected-list { flex-shrink: 0; padding: 5px; background-color: #22222200; max-height: 100%; }
                    #${uniqueId} .locallora-controls { display: flex; flex-direction: column; padding: 5px; gap: 5px; flex-shrink: 0; }
                    #${uniqueId} .locallora-controls-row { display: flex; gap: 10px; align-items: center; }
                    #${uniqueId} .locallora-gallery { flex-grow: 1; overflow-y: auto; background-color: #1a1a1a; padding: 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; align-content: start; }
                    #${uniqueId} .locallora-gallery.compact-view { display: flex; flex-direction: column; gap: 5px; background-color: transparent; padding: 4px 5px 5px; overflow-y: visible; flex-grow: 0; }
                    
                    /* --- Lora Card --- */
                    #${uniqueId} .locallora-lora-card { cursor: pointer; border: 3px solid transparent; border-radius: 8px; background-color: var(--comfy-input-bg); transition: border-color 0.2s; display: flex; flex-direction: column; position: relative; }
                    #${uniqueId} .locallora-lora-card.selected-edit { border-color: #FFD700; box-shadow: 0 0 10px #FFD700; }
                    #${uniqueId} .locallora-lora-card.selected-flow { border-color: #00FFC9; }
                    #${uniqueId} .locallora-media-container { width: 100%; height: 150px; background-color: #111; border-top-left-radius: 5px; border-top-right-radius: 5px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
                    #${uniqueId} .locallora-media-container img, #${uniqueId} .locallora-media-container video { width: 100%; height: 100%; object-fit: cover; }
                    #${uniqueId} .locallora-lora-card-info { padding: 4px; flex-grow: 1; display: flex; flex-direction: column; }
                    #${uniqueId} .locallora-lora-card p { font-size: 11px; margin: 0; word-break: break-all; text-align: center; color: var(--node-text-color); }
                    #${uniqueId} .lora-card-triggers { font-size: 10px; color: #a5a5a5; padding: 2px 4px; margin-top: 2px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 14px; }
                    #${uniqueId} .lora-card-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: auto; padding-top: 4px; }
                    #${uniqueId} .lora-card-tags .tag { background-color: #006699; color: #fff; padding: 1px 4px; font-size: 10px; border-radius: 3px; cursor: pointer; }
                    #${uniqueId} .lora-card-tags .tag:hover { background-color: #0088CC; }

                    /* --- Card Buttons (Edit, Link, Sync) --- */
                    #${uniqueId} .card-btn {
                        position: absolute; width: 22px; height: 22px; background-color: rgba(0,0,0,0.5);
                        color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                        font-size: 14px; cursor: pointer; transition: all 0.2s; opacity: 0; text-decoration: none;
                        z-index: 10;
                    }
                    #${uniqueId} .locallora-lora-card:hover .card-btn { opacity: 1; }
                    #${uniqueId} .card-btn:hover { background-color: rgba(0,0,0,0.8); }

                    #${uniqueId} .lora-card-link-btn { top: 4px; right: 4px; }
                    #${uniqueId} .edit-tags-btn { bottom: 4px; right: 4px; font-size: 12px; }
                    #${uniqueId} .sync-civitai-btn { top: 4px; left: 4px; font-size: 12px; }
                    #${uniqueId} .sync-civitai-btn.loading { animation: spin 1s linear infinite; pointer-events: none; background-color: #4a90e2; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

                    /* --- Compact Rows --- */
                    #${uniqueId} .compact-header-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 6px; padding: 0 8px; color: #999; font-size: 11px; }
                    #${uniqueId} .compact-header-actions { display: flex; gap: 18px; align-items: center; }
                    #${uniqueId} .locallora-lora-row { display: grid; grid-template-columns: 20px minmax(90px, 1fr) 76px 76px minmax(80px, 120px) minmax(70px, 0.8fr) auto; align-items: center; gap: 4px; min-height: 24px; padding: 2px 4px; border: 1px solid #5b5b5b; border-radius: 12px; background-color: #2b2b2b; cursor: default; }
                    #${uniqueId} .locallora-lora-row.model-only { grid-template-columns: 20px minmax(110px, 1fr) 76px minmax(80px, 120px) minmax(70px, 0.8fr) auto; }
                    #${uniqueId} .locallora-lora-row.disabled { opacity: 0.45; }
                    #${uniqueId} .locallora-lora-row.selected-edit { border-color: #FFD700; box-shadow: 0 0 6px #FFD700; }
                    #${uniqueId} .compact-lora-name, #${uniqueId} .compact-trigger-preview { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--node-text-color); font-size: 11px; }
                    #${uniqueId} .compact-lora-name { cursor: grab; }
                    #${uniqueId} .compact-lora-name:active { cursor: grabbing; }
                    #${uniqueId} .compact-trigger-preview { color: #a5a5a5; }
                    #${uniqueId} .compact-strength { display: flex; align-items: center; gap: 3px; }
                    #${uniqueId} .compact-strength label { color: var(--node-text-color); font-size: 9px; }
                    #${uniqueId} .compact-strength input { width: 48px; background-color: #333; border: 1px solid #555; border-radius: 4px; color: #ccc; font-size: 10px; }
                    #${uniqueId} .compact-strength-stepper { display: grid; grid-template-columns: 16px 42px 16px; align-items: center; border: 1px solid #444; border-radius: 10px; overflow: hidden; background: #1f1f1f; }
                    #${uniqueId} .compact-strength-stepper button { height: 20px; border: none; background: transparent; color: #ddd; cursor: pointer; font-size: 10px; }
                    #${uniqueId} .compact-strength-stepper input { width: 42px; border: none; border-left: 1px solid #444; border-right: 1px solid #444; border-radius: 0; text-align: center; }
                    #${uniqueId} .compact-preset-area { min-width: 0; }
                    #${uniqueId} .compact-preset-area .lora-card-preset-select { margin-bottom: 0 !important; }
                    #${uniqueId} .compact-preset-area .lora-card-preset-stack-label { margin-bottom: 0; display: none; }
                    #${uniqueId} .compact-actions { display: flex; gap: 4px; align-items: center; justify-content: flex-end; }
                    #${uniqueId} .compact-actions .row-action-btn { width: 20px; height: 20px; border: 1px solid #555; border-radius: 4px; background: #333; color: #ddd; display: flex; align-items: center; justify-content: center; text-decoration: none; font-size: 11px; cursor: pointer; }
                    #${uniqueId} .compact-actions .row-action-btn:hover { background: #444; }
                    #${uniqueId} .compact-actions .sync-civitai-btn.loading { animation: spin 1s linear infinite; pointer-events: none; background-color: #4a90e2; }
                    #${uniqueId} .compact-add-lora-btn { border: 1px solid #5b5b5b; border-radius: 4px; background: #2b2b2b; color: #ddd; height: 24px; cursor: pointer; font-size: 12px; }
                    #${uniqueId} .compact-add-lora-btn:hover { background: #383838; }
                    #${uniqueId} .locallora-container.compact-mode .search-input,
                    #${uniqueId} .locallora-container.compact-mode .toggle-all-btn,
                    #${uniqueId} .locallora-container.compact-mode .tag-filter-mode-btn,
                    #${uniqueId} .locallora-container.compact-mode .tag-filter-input-wrapper,
                    #${uniqueId} .locallora-container.compact-mode .locallora-multiselect-tag,
                    #${uniqueId} .locallora-container.compact-mode .folder-filter-select { display: none; }
                    #${uniqueId} .locallora-container.compact-mode .locallora-controls-row { gap: 5px; }

                    /* --- Scrollbar --- */
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar { width: 8px; }
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar-track { background: #2a2a2a; border-radius: 4px; }
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar-thumb { background-color: #555; border-radius: 4px; }
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar-thumb:hover { background-color: #777; }
                    
                    /* --- Metadata Editor --- */
                    #${uniqueId} .locallora-metadata-editor { display: none; flex-direction: column; gap: 5px; }
                    #${uniqueId} .locallora-metadata-editor.visible { display: flex; }
                    #${uniqueId} .tag-editor-list .tag .remove-tag { margin-left: 4px; color: #fdd; cursor: pointer; font-weight: bold; }
                    
                    /* --- Selected List Item --- */
                    #${uniqueId} .locallora-lora-item { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; user-select: none; position: relative; }
                    #${uniqueId} .locallora-lora-item .lora-name { flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; cursor: grab; }
                    #${uniqueId} .locallora-lora-item .lora-name:active { cursor: grabbing; }
                    #${uniqueId} .locallora-lora-item input[type=number] { width: 60px; background-color: #333; border: 1px solid #555; border-radius: 4px; color: #ccc; }
                    #${uniqueId} .locallora-lora-item .lora-label { font-size: 10px; color: var(--node-text-color); }
                    #${uniqueId} .locallora-lora-item .remove-lora-btn { background: #555; color: #fff; border: none; border-radius: 10%; text-align: center; cursor: pointer; margin-left: auto; flex-shrink: 0; }
                    #${uniqueId} .locallora-lora-item .remove-lora-btn:hover { background: #ff4444; }
                    #${uniqueId} .locallora-lora-item.dragging,
                    #${uniqueId} .locallora-lora-row.dragging { opacity: 0.45; background: #555; }
                    #${uniqueId} .locallora-lora-item.drag-over-before,
                    #${uniqueId} .locallora-lora-row.drag-over-before { box-shadow: inset 0 2px 0 #4A90E2; }
                    #${uniqueId} .locallora-lora-item.drag-over-after,
                    #${uniqueId} .locallora-lora-row.drag-over-after { box-shadow: inset 0 -2px 0 #4A90E2; }
                    
                    /* --- Controls & Inputs --- */
                    #${uniqueId} .locallora-controls-row input[type=text], #${uniqueId} .locallora-controls-row select { background: #222; color: #ccc; border: 1px solid #555; padding: 4px; border-radius: 4px; }
                    #${uniqueId} .tag-filter-mode-btn { padding: 4px 8px; background-color: #555; color: #fff; border: 1px solid #666; border-radius: 4px; cursor: pointer; flex-shrink: 0; }
                    #${uniqueId} .tag-filter-mode-btn:hover { background-color: #666; }
                    #${uniqueId} .view-mode-btn { padding: 4px 8px; background-color: #333; color: #fff; border: 1px solid #666; border-radius: 4px; cursor: pointer; flex-shrink: 0; }
                    #${uniqueId} .view-mode-btn.compact { background-color: #4A90E2; border-color: #6aa6ee; }
                    #${uniqueId} .tag-filter-input-wrapper { display: flex; flex-grow: 1; position: relative; align-items: center; }
                    #${uniqueId} .tag-filter-input-wrapper input { flex-grow: 1; }
                    #${uniqueId} .clear-tag-filter-btn { background: none; border: none; color: #ccc; cursor: pointer; position: absolute; right: 4px; top: 50%; transform: translateY(-50%); display: none; }
                    #${uniqueId} .tag-filter-input-wrapper input:not(:placeholder-shown) + .clear-tag-filter-btn { display: block; }
                    
                    /* --- Multi-Select Dropdown --- */
                    #${uniqueId} .locallora-multiselect-tag { position: relative; flex-grow: 1; }
                    #${uniqueId} .locallora-multiselect-tag-display { background-color: #333; color: #ccc; border: 1px solid #555; border-radius: 4px; padding: 4px; font-size: 10px; height: 23px; cursor: pointer; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
                    #${uniqueId} .locallora-multiselect-arrow { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); transition: transform 0.2s ease-in-out; font-size: 10px; pointer-events: none; }
                    #${uniqueId} .locallora-multiselect-arrow.open { transform: translateY(-50%) rotate(180deg); }
                    #${uniqueId} .locallora-multiselect-tag-dropdown { display: none; position: absolute; top: 100%; left: 0; right: 0; background-color: #222; border: 1px solid #555; border-top: none; max-height: 200px; overflow-y: auto; z-index: 10; }
                    #${uniqueId} .locallora-multiselect-tag-dropdown label { display: block; padding: 0px 0px; cursor: pointer; font-size: 12px; color: #ccc; }
                    #${uniqueId} .locallora-multiselect-tag-dropdown label:hover { background-color: #444; }

                    /* --- Presets --- */
                    #${uniqueId} .locallora-preset-container { position: relative; display: inline-block; margin-bottom: 3px; }
                    #${uniqueId} .preset-dropdown { display: none; position: absolute; background-color: #222; min-width: 160px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2); z-index: 10; border: 1px solid #555; right: 0; }
                    #${uniqueId} .preset-dropdown a { color: #ccc; padding: 8px 12px; text-decoration: none; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
                    #${uniqueId} .preset-dropdown a:hover { background-color: #444; }
                    #${uniqueId} .delete-preset-btn { color: #ff6666; cursor: pointer; font-weight: bold; padding-left: 10px; }
                    #${uniqueId} .delete-preset-btn:hover { color: #ff0000; }
                    #${uniqueId} .lora-card-preset-stack-label { display: flex; align-items: center; gap: 4px; color: #ccc; font-size: 10px; margin-bottom: 4px; cursor: pointer; }
                    #${uniqueId} .lora-card-preset-stack-checkbox { margin: 0; }
                    #${uniqueId} .lora-card-preset-checklist { display: none; max-height: 96px; overflow-y: auto; margin-bottom: 4px; border: 1px solid #555; border-radius: 4px; background: #222; }
                    #${uniqueId} .lora-card-preset-checklist.visible { display: block; }
                    #${uniqueId} .lora-card-preset-checklist label { display: flex; align-items: center; gap: 4px; color: #ccc; font-size: 10px; padding: 2px 4px; cursor: pointer; }
                    #${uniqueId} .lora-card-preset-checklist label:hover { background: #333; }
                    #${uniqueId} .lora-card-preset-checklist input { margin: 0; }
                    
                    /* Misc */
                    #${uniqueId} .locallora-container.gallery-collapsed .locallora-gallery { display: none; }
                </style>
                <div id="${uniqueId}" style="height: 100%;">
                    <div class="locallora-container">
                        <div class="locallora-selected-list"></div>
                        <div class="locallora-controls">
                            <div class="locallora-controls-row">
                                <button class="toggle-all-btn">Toggle All</button>
                                <input type="text" class="search-input" placeholder="Filter by Name..." style="flex-grow: 1;">
                                <button class="save-preset-btn" title="Save current stack as preset">Save Preset</button>
                                <div class="locallora-preset-container">
                                    <button class="load-preset-btn">Load Preset v</button>
                                    <div class="preset-dropdown"></div>
                                </div>
                                <button class="clear-all-btn" title="Clear all selected LoRAs">Clear All</button>
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

                            <div class="locallora-controls-row">
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
                                <select class="folder-filter-select" style="max-width: 150px;">
                                    <option value="">All Folders</option>
                                </select>
                                <button class="view-mode-btn" title="Switch between thumbnail gallery and compact list">Gallery</button>
                                <button class="toggle-gallery-btn" title="Toggle Gallery" style="margin-left: auto; flex-shrink: 0;">Hide Gallery</button>
                            </div>
                        </div>
                        <div class="locallora-gallery"><p>Loading LoRAs...</p></div>
                    </div>
                </div>
            `;
            
            const mainContainer = widgetContainer.querySelector(".locallora-container");
            const selectedListEl = widgetContainer.querySelector(".locallora-selected-list");
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
            const selectedCountEl = widgetContainer.querySelector(".selected-count");
            const clearTagFilterBtn = widgetContainer.querySelector(".clear-tag-filter-btn");
            const folderFilterSelect = widgetContainer.querySelector(".folder-filter-select");
            const viewModeBtn = widgetContainer.querySelector(".view-mode-btn");
            const savePresetBtn = widgetContainer.querySelector(".save-preset-btn");
            const loadPresetBtn = widgetContainer.querySelector(".load-preset-btn");
            const presetDropdown = widgetContainer.querySelector(".preset-dropdown");
            let currentViewMode = "gallery";

            const saveStateAndFetch = async () => {
                const stateToSave = {
                    filter_tag: tagFilterInput.value,
                    filter_mode: tagFilterModeBtn.textContent,
                    filter_folder: folderFilterSelect.value,
                    view_mode: currentViewMode
                };
                await UnifiedLoraGalleryNode.setUiState(this.id, this.properties.lora_gallery_unique_id, stateToSave);
                await fetchAndRender(false);
            };

            const saveViewModeState = async () => {
                await UnifiedLoraGalleryNode.setUiState(this.id, this.properties.lora_gallery_unique_id, {
                    view_mode: currentViewMode
                });
            };

            const setViewMode = (viewMode, shouldRender = true, shouldPersist = true) => {
                currentViewMode = viewMode === "compact" ? "compact" : "gallery";
                galleryEl.classList.toggle("compact-view", currentViewMode === "compact");
                mainContainer.classList.toggle("compact-mode", currentViewMode === "compact");
                selectedListEl.style.display = currentViewMode === "compact" ? "none" : "";
                if (currentViewMode === "compact") {
                    this.expandedWidth = this.size[0];
                    this.size[0] = Math.min(this.size[0], COMPACT_NODE_WIDTH);
                } else if (this.expandedWidth) {
                    this.size[0] = Math.max(this.size[0], this.expandedWidth);
                }
                viewModeBtn.textContent = currentViewMode === "compact" ? "Compact" : "Gallery";
                viewModeBtn.classList.toggle("compact", currentViewMode === "compact");
                viewModeBtn.title = currentViewMode === "compact" ? "Switch to thumbnail gallery view" : "Switch to compact list view";
                if (shouldRender) renderCurrentView(false);
                if (shouldPersist) saveViewModeState();
            };

            // Keep selection local to the serialized workflow node.
            // Shared backend UI state is only for transient view controls.
            const persistSelectionData = () => {
                const serializableData = this.loraData.map(({ element, ...rest }) => rest);
                const selectionJson = writeSelectionArray(serializableData);
                this.setProperty("lora_selection_data", selectionJson);
                const widget = this.widgets.find(w => w.name === "lora_selection_data");
                if (widget) widget.value = selectionJson;
                return serializableData;
            };

            const updatePresetButtonText = (presetName = null) => {
                loadPresetBtn.textContent = presetName ? `Preset: ${presetName} v` : "Load Preset v";
                loadPresetBtn.title = presetName ? `Current Preset: ${presetName}` : "Load a saved preset";
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
                syncSelectedCardStyles();
                this.setDirtyCanvas(true, true);
            };

            const syncSelectedCardStyles = () => {
                const selectedLoras = new Set(this.loraData.map(item => item.lora));
                galleryEl.querySelectorAll(".locallora-lora-card, .locallora-lora-row").forEach(card => {
                    card.classList.toggle("selected-flow", selectedLoras.has(card.dataset.loraName));
                });
            };
            
            let draggedIndex = -1;
            let cleanupMouseReorder = null;

            const clearDragMarkers = (root = widgetContainer) => {
                root.querySelectorAll(".drag-over-before, .drag-over-after").forEach(row => {
                    row.classList.remove("drag-over-before", "drag-over-after");
                });
            };

            const bindMouseReorderHandle = (row, handle, rowSelector, root, onMoved) => {
                if (!handle) return;

                handle.addEventListener("pointerdown", (event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();

                    cleanupMouseReorder?.();
                    draggedIndex = parseInt(row.dataset.index);
                    row.classList.add("dragging");
                    document.body.style.userSelect = "none";
                    const pointerId = event.pointerId;
                    handle.setPointerCapture?.(event.pointerId);
                    let lastDropMarker = null;

                    const getTargetRow = (moveEvent) => {
                        const rows = Array.from(root.querySelectorAll(rowSelector)).filter(candidate => candidate !== row);
                        if (!rows.length) return null;

                        const rowUnderPointer = rows.find(candidate => {
                            const rect = candidate.getBoundingClientRect();
                            return moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom;
                        });
                        if (rowUnderPointer) return rowUnderPointer;

                        return rows.reduce((nearestRow, candidate) => {
                            const rect = candidate.getBoundingClientRect();
                            const distance = Math.min(
                                Math.abs(moveEvent.clientY - rect.top),
                                Math.abs(moveEvent.clientY - rect.bottom)
                            );
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
                        const rect = targetRow.getBoundingClientRect();
                        const insertAfter = moveEvent.clientY > rect.top + rect.height / 2;
                        targetRow.classList.add(insertAfter ? "drag-over-after" : "drag-over-before");
                        lastDropMarker = { targetRow, insertAfter };
                        return lastDropMarker;
                    };

                    const onPointerMove = (moveEvent) => {
                        if (moveEvent.pointerId !== pointerId) return;
                        moveEvent.preventDefault();
                        moveEvent.stopPropagation();
                        updateMarker(moveEvent);
                    };

                    const onPointerUp = (upEvent) => {
                        if (upEvent.pointerId !== pointerId) return;
                        upEvent.preventDefault();
                        upEvent.stopPropagation();
                        const marker = updateMarker(upEvent) || lastDropMarker;
                        const fromIndex = draggedIndex;
                        const targetIndex = marker ? parseInt(marker.targetRow.dataset.index) : -1;
                        const insertAfter = marker?.insertAfter;
                        cleanupMouseReorder?.();
                        if (marker && fromIndex >= 0) {
                            onMoved(fromIndex, targetIndex, insertAfter);
                        }
                    };

                    cleanupMouseReorder = () => {
                        row.classList.remove("dragging");
                        clearDragMarkers(root);
                        draggedIndex = -1;
                        document.body.style.userSelect = "";
                        if (handle.hasPointerCapture?.(pointerId)) {
                            handle.releasePointerCapture?.(pointerId);
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

            const renderSelectedList = () => {
                selectedListEl.innerHTML = "";
                this.loraData.forEach((item, index) => {
                    const el = document.createElement("div");
                    el.className = "locallora-lora-item";
                    el.dataset.index = index;
                    
                    const toggle = document.createElement("input");
                    toggle.type = "checkbox";
                    toggle.checked = item.on;
                    toggle.addEventListener("change", (e) => { this.loraData[index].on = e.target.checked; updateSelection(); });
                    
                    const nameLabel = document.createElement("span");
                    nameLabel.className = "lora-name";
                    nameLabel.textContent = item.lora;
                    nameLabel.title = `${item.lora}\nDrag to change LoRA load order`;
                    
                    const strengthModelLabel = document.createElement("span");
                    strengthModelLabel.className = "lora-label";
                    strengthModelLabel.textContent = "Model";
                    
                    const strengthModelInput = document.createElement("input");
                    strengthModelInput.type = "number";
                    strengthModelInput.value = item.strength;
                    strengthModelInput.min = -10.0; strengthModelInput.max = 10.0; strengthModelInput.step = 0.05;
                    strengthModelInput.addEventListener("change", (e) => { this.loraData[index].strength = parseFloat(e.target.value); updateSelection(); });
                    
                    el.appendChild(toggle);
                    el.appendChild(nameLabel);
                    el.appendChild(strengthModelLabel);
                    el.appendChild(strengthModelInput);

                    if (!this.isModelOnly) {
                        const strengthClipLabel = document.createElement("span");
                        strengthClipLabel.className = "lora-label";
                        strengthClipLabel.textContent = "CLIP";
                        const strengthClipInput = document.createElement("input");
                        strengthClipInput.type = "number";
                        strengthClipInput.value = item.strength_clip;
                        strengthClipInput.draggable = false;
                        strengthClipInput.min = -2.0; strengthClipInput.max = 2.0; strengthClipInput.step = 0.05;
                        strengthClipInput.addEventListener("change", (e) => { this.loraData[index].strength_clip = parseFloat(e.target.value); updateSelection(); });
                        el.appendChild(strengthClipLabel);
                        el.appendChild(strengthClipInput);
                    }

                    const removeBtn = document.createElement("button");
                    removeBtn.className = "remove-lora-btn";
                    removeBtn.textContent = "x";
                    removeBtn.title = "Remove LoRA";
                    removeBtn.addEventListener("click", (e) => {
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
                                const controlsEl = widgetContainer.querySelector(".locallora-controls");
                                const contentHeight = selectedListEl.scrollHeight + controlsEl.offsetHeight;
                                this.size[1] = contentHeight + HEADER_HEIGHT;
                                this.setDirtyCanvas(true, true);
                            }, 0);
                        }
                        fetchAndRender(false);
                        updatePresetButtonText(null);
                    });
                    el.appendChild(removeBtn);

                    bindMouseReorderHandle(el, nameLabel, ".locallora-lora-item", selectedListEl, (fromIndex, targetIndex, insertAfter) => {
                        if (moveSelectedLora(this.loraData, fromIndex, targetIndex, insertAfter)) {
                            repaintLoraOrder();
                            updateSelection();
                        }
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

            const promoteSelectedLorasInAvailableList = () => {
                if (!Array.isArray(this.availableLoras) || this.availableLoras.length === 0) return;
                const selectedOrder = this.loraData.map(item => item.lora);
                const loraByName = new Map(this.availableLoras.map(lora => [lora.name, lora]));
                const promoted = selectedOrder
                    .map(name => loraByName.get(name))
                    .filter(Boolean);
                const selectedNames = new Set(selectedOrder);
                const remaining = this.availableLoras
                    .filter(lora => !selectedNames.has(lora.name))
                    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
                this.availableLoras = [...promoted, ...remaining];
            };
            
            const syncWithCivitai = async (loraName, card) => {
                const syncBtn = card.querySelector('.sync-civitai-btn');
                const isRow = card.classList.contains("locallora-lora-row");
                const defaultText = isRow ? 'S' : '☁️';
                const errorText = isRow ? 'ERR' : '❌';

                syncBtn.textContent = '🔄';
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
                            linkBtn.className = card.classList.contains("locallora-lora-row") ? 'row-action-btn lora-card-link-btn' : 'card-btn lora-card-link-btn';
                            linkBtn.title = 'Open download page';
                            linkBtn.innerHTML = isRow ? 'L' : '🔗';
                            linkBtn.addEventListener('click', e => e.stopPropagation());
                            const compactActions = card.querySelector('.compact-actions');
                            if (compactActions) compactActions.prepend(linkBtn);
                            else card.prepend(linkBtn);
                        }
                        
                        renderCardTags(card);
                        await loadAllTags();
                    } else {
                       throw new Error(result.message || 'Sync failed');
                    }
            
                } catch (error) {
                    console.error("LocalLoraGallery: Failed to sync with Civitai:", error);
                    syncBtn.textContent = errorText;
                    setTimeout(() => syncBtn.textContent = defaultText, 2000);
                } finally {
                    syncBtn.classList.remove('loading');
                    if(syncBtn.textContent !== errorText) syncBtn.textContent = defaultText;
                }
            };

            const buildPresetControlsHTML = (lora, compact = false) => {
                if (!lora.trigger_presets || Object.keys(lora.trigger_presets).length === 0) return '';

                let presetDropdownHTML = `<select class="lora-card-preset-select" style="width: 100%; max-width: 100%; background: #222; color: #ccc; border: 1px solid #555; border-radius: 4px; font-size: 10px; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis;">
                    <option value="">Default Triggers</option>`;
                for (const presetName of Object.keys(lora.trigger_presets)) {
                    presetDropdownHTML += `<option value="${presetName}">${presetName}</option>`;
                }
                presetDropdownHTML += `</select>
                    <div class="lora-card-preset-checklist">`;
                for (const presetName of Object.keys(lora.trigger_presets)) {
                    presetDropdownHTML += `<label>
                        <input type="checkbox" class="lora-card-preset-check" value="${presetName}">
                        ${presetName}
                    </label>`;
                }
                presetDropdownHTML += `</div>
                    <label class="lora-card-preset-stack-label" title="Allow multiple trigger presets to be appended to this LoRA's prompt output">
                        <input type="checkbox" class="lora-card-preset-stack-checkbox">
                        ${compact ? "Stack" : "Stack trigger presets"}
                    </label>`;
                return presetDropdownHTML;
            };

            const setupPresetControls = (element, lora) => {
                const presetSelect = element.querySelector('.lora-card-preset-select');
                if (!presetSelect) return;

                const presetStackCheckbox = element.querySelector('.lora-card-preset-stack-checkbox');
                const presetChecklist = element.querySelector('.lora-card-preset-checklist');
                const presetChecks = Array.from(element.querySelectorAll('.lora-card-preset-check'));
                const existingItem = this.loraData.find(item => item.lora === lora.name);
                const existingPresetNames = existingItem && Array.isArray(existingItem.selected_presets)
                    ? existingItem.selected_presets
                    : (existingItem && existingItem.selected_preset ? [existingItem.selected_preset] : []);
                const useStackedTriggerPresets = Boolean(existingItem?.stack_trigger_presets || existingPresetNames.length > 1);

                const syncPresetSelectMode = () => {
                    const stacking = presetStackCheckbox.checked;
                    presetSelect.style.display = stacking ? "none" : "";
                    presetChecklist.classList.toggle("visible", stacking);
                };

                presetStackCheckbox.checked = useStackedTriggerPresets;
                syncPresetSelectMode();
                if (useStackedTriggerPresets) {
                    presetChecks.forEach(checkbox => {
                        checkbox.checked = existingPresetNames.includes(checkbox.value);
                    });
                } else if (existingPresetNames.length > 0) {
                    presetSelect.value = existingPresetNames[0];
                }

                const applyPresetSelection = () => {
                    const item = this.loraData.find(item => item.lora === lora.name);
                    if (!item) return;

                    if (presetStackCheckbox.checked) {
                        const selectedPresets = presetChecks.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
                        item.stack_trigger_presets = true;
                        item.selected_presets = selectedPresets;
                        item.selected_preset = selectedPresets.length === 1 ? selectedPresets[0] : "";
                    } else {
                        item.selected_preset = presetSelect.value;
                        delete item.selected_presets;
                        delete item.stack_trigger_presets;
                    }
                    updateSelection();
                };

                presetSelect.addEventListener('click', (e) => e.stopPropagation());
                presetSelect.addEventListener('mousedown', (e) => e.stopPropagation());
                presetSelect.addEventListener('change', applyPresetSelection);
                presetChecklist.addEventListener('click', (e) => e.stopPropagation());
                presetChecks.forEach(checkbox => {
                    checkbox.addEventListener('change', applyPresetSelection);
                });
                presetStackCheckbox.addEventListener('click', (e) => e.stopPropagation());
                presetStackCheckbox.addEventListener('change', () => {
                    if (presetStackCheckbox.checked && presetSelect.value) {
                        presetChecks.forEach(checkbox => {
                            checkbox.checked = checkbox.value === presetSelect.value;
                        });
                    }
                    syncPresetSelectMode();
                    if (!presetStackCheckbox.checked) {
                        const firstSelected = presetChecks.find(checkbox => checkbox.checked);
                        presetSelect.value = firstSelected ? firstSelected.value : "";
                    }
                    applyPresetSelection();
                });
            };

            const getNewLoraEntryFromElement = (element, loraName) => {
                const newEntry = { on: true, lora: loraName, strength: 1.0, strength_clip: 1.0 };
                const modelStrengthInput = element.querySelector('.compact-strength-model');
                const clipStrengthInput = element.querySelector('.compact-strength-clip');
                if (modelStrengthInput) newEntry.strength = parseFloat(modelStrengthInput.value) || 1.0;
                if (clipStrengthInput) newEntry.strength_clip = parseFloat(clipStrengthInput.value) || newEntry.strength;

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

            const toggleLoraSelectionFromElement = (element, loraName) => {
                const existingIndex = this.loraData.findIndex(item => item.lora === loraName);
                let isSelectedNow = false;
                if (existingIndex > -1) {
                    this.loraData.splice(existingIndex, 1);
                } else {
                    this.loraData.push(getNewLoraEntryFromElement(element, loraName));
                    isSelectedNow = true;
                }
                element.classList.toggle("selected-flow", isSelectedNow);
                const selectedToggle = element.querySelector(".compact-selected-toggle");
                if (selectedToggle) selectedToggle.checked = isSelectedNow;
                promoteSelectedLorasInAvailableList();
                renderSelectedList();
                if (currentViewMode === "gallery") {
                    renderGallery(false);
                }
                updateSelection();
                updatePresetButtonText(null);
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
                            document.querySelectorAll(`#${uniqueId} .locallora-lora-card.selected-edit, #${uniqueId} .locallora-lora-row.selected-edit`).forEach(c => c.classList.remove("selected-edit"));
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
                    
                    const card = document.createElement("div");
                    card.className = "locallora-lora-card";
                    card.dataset.loraName = lora.name;
                    card.dataset.tags = lora.tags.join(',');
                    card.dataset.triggerWords = lora.trigger_words;
                    card.dataset.downloadUrl = lora.download_url;
                    card.title = lora.name;

                    let mediaHTML = '';
                    const empty_lora_image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    const previewUrl = lora.preview_url;

                    if (lora.preview_type === 'video' && previewUrl) {
                        mediaHTML = `<video muted loop playsinline src="${previewUrl}"></video>`;
                    } else {
                        mediaHTML = `<img src="${previewUrl || empty_lora_image}" loading="lazy">`;
                    }
                    
                    const linkBtnHTML = lora.download_url ? `<a href="${lora.download_url}" target="_blank" class="card-btn lora-card-link-btn" title="Open download page">🔗</a>` : '';

                    const presetDropdownHTML = buildPresetControlsHTML(lora);

                    card.innerHTML = `
                        <div class="card-btn sync-civitai-btn" title="Sync with Civitai">☁️</div>
                        ${linkBtnHTML}
                        <div class="locallora-media-container">${mediaHTML}</div>
                        <div class="locallora-lora-card-info">
                            <p>${escapeHtml(lora.name)}</p>
                            <div class="lora-card-triggers" title="${escapeHtml(lora.trigger_words)}">${escapeHtml(lora.trigger_words || 'No triggers')}</div>
                            ${presetDropdownHTML}
                            <div class="lora-card-tags"></div>
                        </div>
                        <div class="card-btn edit-tags-btn">✏️</div>
                    `;

                    setupPresetControls(card, lora);

                    if (lora.preview_type !== 'video') {
                        card.querySelector("img").onerror = (e) => { e.target.src = empty_lora_image; };
                    }
                    galleryEl.appendChild(card);
                    
                    card.querySelector(".lora-card-link-btn")?.addEventListener("click", e => e.stopPropagation());
                    card.querySelector(".sync-civitai-btn").addEventListener("click", e => {
                        e.stopPropagation();
                        syncWithCivitai(lora.name, card);
                    });

                    if (this.loraData.some(item => item.lora === lora.name)) card.classList.add("selected-flow");
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
            };

            const fetchCompactChooserLoras = async () => {
                const data = await loraApi.getLoras(
                    tagFilterInput.value,
                    tagFilterModeBtn.textContent,
                    folderFilterSelect.value,
                    1,
                    this.loraData.map(item => item.lora),
                    100000
                );
                const nameFilter = searchInput.value.toLowerCase();
                return (data.loras || []).filter(lora => lora.name.toLowerCase().includes(nameFilter));
            };

            const showCompactLoraChooser = async (event) => {
                try {
                    const loras = await fetchCompactChooserLoras();
                    const selectedNames = new Set(this.loraData.map(item => item.lora));
                    const menuItems = loras
                        .filter(lora => !selectedNames.has(lora.name))
                        .map(lora => lora.name);
                    if (!menuItems.length) return;

                    new LiteGraph.ContextMenu(menuItems, {
                        event,
                        title: "Choose a lora",
                        className: "dark",
                        callback: (value) => {
                            if (typeof value !== "string") return;
                            const lora = loras.find(item => item.name === value);
                            if (lora && !this.availableLoras.some(item => item.name === lora.name)) {
                                this.availableLoras.unshift(lora);
                            }
                            this.loraData.push({ on: true, lora: value, strength: 1.0, strength_clip: 1.0 });
                            promoteSelectedLorasInAvailableList();
                            renderSelectedList();
                            renderCompact();
                            updateSelection();
                            updatePresetButtonText(null);
                        }
                    });
                } catch (e) {
                    console.error("LocalLoraGallery: Failed to open compact LoRA chooser", e);
                }
            };

            const renderCompact = (append = false) => {
                if (append) return;
                galleryEl.innerHTML = "";

                const header = document.createElement("div");
                header.className = "compact-header-row";
                header.innerHTML = `
                    <span class="compact-toggle-all">Toggle All</span>
                    <span class="compact-header-actions">
                        <span>${this.isModelOnly ? "Strength" : "Model / CLIP"}</span>
                    </span>
                `;
                header.querySelector(".compact-toggle-all").addEventListener("click", () => {
                    const allOn = this.loraData.length > 0 && this.loraData.every(item => item.on);
                    this.loraData.forEach(item => item.on = !allOn);
                    renderSelectedList();
                    renderCompact();
                    updateSelection();
                });
                galleryEl.appendChild(header);

                const resolveLoraInfo = (loraName) => this.availableLoras.find(lora => lora.name === loraName) || {
                    name: loraName,
                    tags: [],
                    trigger_words: "",
                    trigger_presets: {},
                    download_url: "",
                    preview_url: "",
                    preview_type: "none"
                };

                const stepStrength = (input, delta) => {
                    const step = parseFloat(input.step || "0.05");
                    const nextValue = (parseFloat(input.value) || 0) + (delta * step);
                    input.value = Number(nextValue.toFixed(3));
                    input.dispatchEvent(new Event("change"));
                };

                this.loraData.forEach((item, index) => {
                    const lora = resolveLoraInfo(item.lora);
                    const row = document.createElement("div");
                    row.className = `locallora-lora-row${this.isModelOnly ? " model-only" : ""}`;
                    row.classList.toggle("disabled", !item.on);
                    row.dataset.loraName = item.lora;
                    row.dataset.tags = (lora.tags || []).join(',');
                    row.dataset.triggerWords = lora.trigger_words || "";
                    row.dataset.downloadUrl = lora.download_url || "";
                    row.title = `${item.lora}\nDrag the name to change LoRA load order`;
                    row.dataset.index = index;

                    const modelStrength = item.strength ?? 1.0;
                    const clipStrength = item.strength_clip ?? item.strength ?? 1.0;
                    const presetControlsHTML = buildPresetControlsHTML(lora, true);
                    const linkBtnHTML = lora.download_url ? `<a href="${lora.download_url}" target="_blank" class="row-action-btn lora-card-link-btn" title="Open download page">L</a>` : '';
                    const modelStrengthHTML = `
                        <div class="compact-strength compact-strength-stepper">
                            <button class="compact-strength-dec" title="Decrease model strength">&lt;</button>
                            <input class="compact-strength-model" type="number" value="${modelStrength}" min="-10.0" max="10.0" step="0.05">
                            <button class="compact-strength-inc" title="Increase model strength">&gt;</button>
                        </div>`;
                    const clipStrengthHTML = this.isModelOnly ? "" : `
                        <div class="compact-strength compact-strength-stepper">
                            <button class="compact-strength-dec" title="Decrease CLIP strength">&lt;</button>
                            <input class="compact-strength-clip" type="number" value="${clipStrength}" min="-2.0" max="2.0" step="0.05">
                            <button class="compact-strength-inc" title="Increase CLIP strength">&gt;</button>
                        </div>`;

                    row.innerHTML = `
                        <input class="compact-selected-toggle" type="checkbox" title="Enable LoRA" ${item.on ? "checked" : ""}>
                        <div class="compact-lora-name" title="${item.lora}">${item.lora}</div>
                        ${modelStrengthHTML}
                        ${this.isModelOnly ? "" : clipStrengthHTML}
                        <div class="compact-preset-area">${presetControlsHTML}</div>
                        <div class="lora-card-triggers compact-trigger-preview" title="${lora.trigger_words || ""}">${lora.trigger_words || 'No triggers'}</div>
                        <div class="compact-actions">
                            ${linkBtnHTML}
                            <button class="row-action-btn sync-civitai-btn" title="Sync with Civitai">S</button>
                            <button class="row-action-btn edit-tags-btn" title="Edit metadata">E</button>
                            <button class="row-action-btn compact-remove-btn" title="Remove LoRA">x</button>
                        </div>
                        <div class="lora-card-tags" style="display:none;"></div>
                    `;

                    setupPresetControls(row, lora);
                    galleryEl.appendChild(row);
                    if (this.selectedCardsForEditing.has(row)) row.classList.add("selected-edit");
                    renderCardTags(row);

                    row.querySelector(".compact-selected-toggle").addEventListener("change", (e) => {
                        item.on = e.target.checked;
                        row.classList.toggle("disabled", !item.on);
                        renderSelectedList();
                        updateSelection();
                    });

                    const modelStrengthInput = row.querySelector(".compact-strength-model");
                    modelStrengthInput.addEventListener("change", (e) => {
                        item.strength = parseFloat(e.target.value);
                        renderSelectedList();
                        updateSelection();
                    });
                    modelStrengthInput.parentElement.querySelector(".compact-strength-dec").addEventListener("click", (e) => {
                        e.stopPropagation();
                        stepStrength(modelStrengthInput, -1);
                    });
                    modelStrengthInput.parentElement.querySelector(".compact-strength-inc").addEventListener("click", (e) => {
                        e.stopPropagation();
                        stepStrength(modelStrengthInput, 1);
                    });

                    const clipStrengthInput = row.querySelector(".compact-strength-clip");
                    if (clipStrengthInput) {
                        clipStrengthInput.addEventListener("change", (e) => {
                            item.strength_clip = parseFloat(e.target.value);
                            renderSelectedList();
                            updateSelection();
                        });
                        clipStrengthInput.parentElement.querySelector(".compact-strength-dec").addEventListener("click", (e) => {
                            e.stopPropagation();
                            stepStrength(clipStrengthInput, -1);
                        });
                        clipStrengthInput.parentElement.querySelector(".compact-strength-inc").addEventListener("click", (e) => {
                            e.stopPropagation();
                            stepStrength(clipStrengthInput, 1);
                        });
                    }

                    row.querySelectorAll("input, select, button, a").forEach(control => {
                        control.addEventListener("click", e => e.stopPropagation());
                    });
                    bindMouseReorderHandle(row, row.querySelector(".compact-lora-name"), ".locallora-lora-row", galleryEl, (fromIndex, targetIndex, insertAfter) => {
                        if (moveSelectedLora(this.loraData, fromIndex, targetIndex, insertAfter)) {
                            repaintLoraOrder();
                            updateSelection();
                            updatePresetButtonText(null);
                        }
                    });
                    row.querySelector(".lora-card-link-btn")?.addEventListener("click", e => e.stopPropagation());
                    row.querySelector(".sync-civitai-btn").addEventListener("click", e => {
                        e.stopPropagation();
                        syncWithCivitai(item.lora, row);
                    });
                    row.querySelector(".compact-remove-btn").addEventListener("click", e => {
                        e.stopPropagation();
                        this.loraData.splice(index, 1);
                        renderSelectedList();
                        renderCompact();
                        updateSelection();
                        updatePresetButtonText(null);
                    });
                    bindMetadataEditButton(row, row.querySelector(".edit-tags-btn"));
                });

                const addBtn = document.createElement("button");
                addBtn.className = "compact-add-lora-btn";
                addBtn.textContent = "+ Add Lora";
                addBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    showCompactLoraChooser(event);
                });
                galleryEl.appendChild(addBtn);

                setTimeout(() => {
                    if (currentViewMode !== "compact" || mainContainer.classList.contains("gallery-collapsed")) return;
                    const controlsEl = widgetContainer.querySelector(".locallora-controls");
                    const contentHeight = (controlsEl?.offsetHeight || 0) + galleryEl.scrollHeight;
                    this.size[1] = contentHeight + HEADER_HEIGHT;
                    this.setDirtyCanvas(true, true);
                }, 0);
            };

            const renderCurrentView = (append = false) => {
                if (currentViewMode === "compact") renderCompact(append);
                else renderGallery(append);
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
                    const { loras, folders } = await UnifiedLoraGalleryNode.getLoras.call(this, tagFilterInput.value, tagFilterModeBtn.textContent, folderFilterSelect.value, pageToFetch, this.loraData.map(item => item.lora)); 
                    if (fetchSequence !== loraFetchSequence) return;

                    if (append) {
                        const existingNames = new Set(this.availableLoras.map(l => l.name));
                        this.availableLoras.push(...(loras || []).filter(l => !existingNames.has(l.name)));
                    } else {
                        this.availableLoras = loras || [];
                        if (!foldersRendered && folders && folders.length > 0) renderFolders(folders);
                        galleryEl.scrollTop = 0;
                    }
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
                const currentVal = folderFilterSelect.value;
                folderFilterSelect.innerHTML = `<option value="">All Folders</option>`;
                folders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder;
                    option.textContent = folder === "." ? "Root" : folder.replaceAll('\\', '/');
                    folderFilterSelect.appendChild(option);
                });
                folderFilterSelect.value = currentVal;
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

                        promoteSelectedLorasInAvailableList();
                        renderSelectedList();
                        renderCurrentView(false);

                        setTimeout(() => {
                            const HEADER_HEIGHT = 90;
                            const controlsEl = widgetContainer.querySelector(".locallora-controls");
                            const requiredTopHeight = selectedListEl.scrollHeight + controlsEl.offsetHeight;

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
                        fetchAndRender(false);
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
                    view_mode: "gallery"
                };

                try {
                    this.loraData = readSelectionArray(this.properties.lora_selection_data, []);
                } catch (e) {
                    console.warn("LocalLoraGallery: Failed to parse lora_selection_data, resetting.", e);
                }

                try {
                    const loadedState = await loraApi.getUiState(this.id, this.properties.lora_gallery_unique_id);
                    initialState = { ...initialState, ...loadedState };
                } catch(e) { 
                    console.error("LocalLoraGallery: Failed to get initial UI state.", e); 
                }

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
                        const controlsEl = widgetContainer.querySelector(".locallora-controls");
                        if (!controlsEl) return;
                        const contentHeight = selectedListEl.scrollHeight + controlsEl.offsetHeight;
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
                            document.querySelectorAll(`#${uniqueId} .locallora-lora-card.selected-edit, #${uniqueId} .locallora-lora-row.selected-edit`).forEach(c => c.classList.remove("selected-edit"));
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
                                linkBtn.className = selectedCard.classList.contains("locallora-lora-row") ? 'row-action-btn lora-card-link-btn' : 'card-btn lora-card-link-btn';
                                linkBtn.title = 'Open download page';
                                linkBtn.innerHTML = selectedCard.classList.contains("locallora-lora-row") ? 'L' : '🔗';
                                linkBtn.target = '_blank';
                                linkBtn.addEventListener("click", (e) => e.stopPropagation());
                                const compactActions = selectedCard.querySelector('.compact-actions');
                                if (compactActions) compactActions.prepend(linkBtn);
                                else selectedCard.prepend(linkBtn);
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

                widgetContainer.querySelector(".clear-all-btn").addEventListener("click", () => {
                    this.loraData = [];
                    if (mainContainer.classList.contains("gallery-collapsed")) {
                        setTimeout(() => {
                            const controlsEl = widgetContainer.querySelector(".locallora-controls");
                            if (!controlsEl) return;
                            const contentHeight = selectedListEl.scrollHeight + controlsEl.offsetHeight;
                            this.size[1] = contentHeight + HEADER_HEIGHT;
                            this.setDirtyCanvas(true, true);
                        }, 0);
                    }
                    fetchAndRender(false);
                    renderSelectedList();
                    updateSelection();
                    updatePresetButtonText(null);
                });
                
                folderFilterSelect.addEventListener("change", saveStateAndFetch);
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
                });

                viewModeBtn.addEventListener("click", () => {
                    setViewMode(currentViewMode === "compact" ? "gallery" : "compact");
                });

                toggleGalleryBtn.addEventListener("click", () => {
                    const isCollapsing = !mainContainer.classList.contains("gallery-collapsed");
                    
                    if (isCollapsing) {
                        this.expandedHeight = this.size[1];
                        const controlsEl = widgetContainer.querySelector(".locallora-controls");
                        const contentHeight = selectedListEl.scrollHeight + controlsEl.offsetHeight;
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
                });
            };

            this.onResize = function(size) {
                const controlsEl = widgetContainer.querySelector(".locallora-controls");
                const dynamicMinHeight = selectedListEl.scrollHeight + (controlsEl?.offsetHeight || 0) + HEADER_HEIGHT;
                if (!mainContainer.classList.contains("gallery-collapsed")) {
                    this.expandedHeight = size[1];
                }
                if (size[1] < dynamicMinHeight) size[1] = dynamicMinHeight;
                const minWidth = currentViewMode === "compact" ? COMPACT_NODE_WIDTH : MIN_NODE_WIDTH;
                if (size[0] < minWidth) size[0] = minWidth;
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

