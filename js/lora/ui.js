import * as loraApi from "../api/loraApi.js";
import { escapeHtml } from "../shared/dom.js";
import { cloneJsonOr, readSelectionArray, writeSelectionArray } from "../shared/json.js";
import { moveSelectedLora } from "./helpers.js";
import { buildLoraPresetControlsHtml } from "./renderers.js";
import { setupLoraStateWidgets } from "./stateWidgets.js";

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

            setupLoraStateWidgets({ nodeInstance: this });
            
            const HEADER_HEIGHT = 90;
            const MIN_NODE_WIDTH = 600;

            this.size = [700, 600];
            this.loraData = [];
            this.availableLoras = [];
            this.isModelOnly = nodeData.name.includes("ModelOnly");
            this.selectedCardsForEditing = new Set();

            const widgetContainer = document.createElement("div");
            widgetContainer.className = "locallora-container-wrapper";
            this.addDOMWidget("lora_gallery", "div", widgetContainer, {});

            const uniqueId = `locallora-gallery-${this.id}`;
            widgetContainer.innerHTML = `
                <style>
                    /* --- General Styles --- */
                    #${uniqueId} .locallora-container { display: flex; flex-direction: column; height: 100%; font-family: sans-serif; background: #171717; border-radius: 8px; overflow: hidden; position: relative; }
                    #${uniqueId} .locallora-selected-list { position: absolute; top: 42px; left: 8px; right: 8px; z-index: 4000; display: none; gap: 10px; align-items: stretch; min-height: 0; max-height: min(302px, calc(100% - 56px)); padding: 0; overflow-x: auto; overflow-y: auto; }
                    #${uniqueId} .locallora-container.active-stack-open .locallora-selected-list:not(:empty) { display: flex; }
                    #${uniqueId} .locallora-selected-list:not(:empty) { padding: 36px 12px 10px; border: 1px solid rgba(178, 224, 255, 0.36); border-radius: 13px; background: radial-gradient(circle at 5% 10%, rgba(163, 239, 255, 0.14), transparent 36%), radial-gradient(circle at 100% 0%, rgba(255, 158, 217, 0.16), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03) 48%, rgba(255,255,255,0.07)), rgba(22, 24, 30, 0.94); box-shadow: 0 18px 46px rgba(0,0,0,0.52), inset 0 0 0 1px rgba(255,255,255,0.06); backdrop-filter: blur(14px) saturate(1.08); -webkit-backdrop-filter: blur(14px) saturate(1.08); }
                    #${uniqueId} .locallora-selected-list:not(:empty)::before { content: "ACTIVE"; position: absolute; top: 13px; left: 18px; color: #f4f8fb; font-size: 13px; font-weight: 800; letter-spacing: 0; }
                    #${uniqueId} .locallora-selected-list:not(:empty)::after { content: attr(data-count) " selected"; position: absolute; top: 14px; left: 78px; color: rgba(230, 239, 245, 0.66); font-size: 11px; font-weight: 650; }
                    #${uniqueId} .locallora-controls { display: flex; flex-direction: column; padding: 6px 8px; gap: 6px; flex-shrink: 0; }
                    #${uniqueId} .locallora-controls-row { display: flex; gap: 8px; align-items: center; }
                    #${uniqueId} .locallora-primary-controls { position: relative; z-index: 4100; }
                    #${uniqueId} .locallora-hidden-filters { display: none; }
                    #${uniqueId} .lora-active-stack-btn { height: 28px; min-width: 74px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; border: 1px solid rgba(174, 226, 255, 0.24); border-radius: 8px; background: #2b3239; color: #edf5f8; font-size: 11px; font-weight: 750; cursor: pointer; }
                    #${uniqueId} .lora-active-stack-btn.has-active { border-color: rgba(255, 145, 40, 0.62); box-shadow: inset 0 0 0 1px rgba(255,145,40,0.12); }
                    #${uniqueId} .lora-active-stack-btn.open { background: #344a34; border-color: #5a9c5a; }
                    #${uniqueId} .lora-active-stack-count { min-width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; border-radius: 999px; background: rgba(255,255,255,0.11); color: #fff; font-size: 10px; font-weight: 800; }
                    #${uniqueId} .lora-active-clear-btn { position: absolute; top: 10px; right: 12px; height: 22px; padding: 0 9px; border: 1px solid rgba(255,255,255,0.18); border-radius: 999px; background: rgba(255,255,255,0.08); color: #fff; font-size: 10px; font-weight: 700; cursor: pointer; }
                    #${uniqueId} .lora-active-clear-btn:hover { background: rgba(142, 47, 56, 0.72); border-color: rgba(200, 90, 100, 0.72); }
                    #${uniqueId} .locallora-gallery { flex-grow: 1; overflow-y: auto; background-color: #101010; padding: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 7px; align-content: start; }
                    
                    /* --- Lora Card --- */
                    #${uniqueId} .locallora-lora-card { cursor: pointer; border: 2px solid rgba(255, 122, 0, 0.72); border-radius: 7px; background: #111; transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease; display: flex; flex-direction: column; position: relative; overflow: hidden; min-height: 174px; box-shadow: 0 8px 18px rgba(0,0,0,0.22); }
                    #${uniqueId} .locallora-lora-card.preset-open { overflow: visible; z-index: 60; }
                    #${uniqueId} .locallora-lora-card:hover { transform: translateY(-1px); border-color: rgba(255, 145, 40, 0.96); box-shadow: 0 12px 24px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,145,40,0.25); }
                    #${uniqueId} .locallora-lora-card.selected-edit { border-color: #FFD15C; box-shadow: 0 0 0 1px rgba(255,209,92,0.5), 0 0 18px rgba(255, 209, 92, 0.35); }
                    #${uniqueId} .locallora-lora-card.selected-flow { border-color: #ff7a00; box-shadow: 0 0 0 1px rgba(255,122,0,0.35), 0 0 18px rgba(255,122,0,0.24); }
                    #${uniqueId} .locallora-lora-card.selected-flow::after { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: 5px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }
                    #${uniqueId} .locallora-media-container { width: 100%; height: 168px; background: radial-gradient(circle at 50% 35%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 44%, transparent 70%), #0d1116; overflow: hidden; display: flex; align-items: center; justify-content: center; }
                    #${uniqueId} .locallora-media-container img, #${uniqueId} .locallora-media-container video { width: 100%; height: 100%; object-fit: cover; }
                    #${uniqueId} .locallora-lora-card-info { position: absolute; left: 0; right: 0; bottom: 0; z-index: 8; box-sizing: border-box; padding: 34px 7px 7px; display: flex; flex-direction: column; gap: 4px; background: linear-gradient(180deg, rgba(0,0,0,0), rgba(6,10,14,0.82)); opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity 0.16s ease, transform 0.16s ease; }
                    #${uniqueId} .locallora-lora-card:hover .locallora-lora-card-info,
                    #${uniqueId} .locallora-lora-card:focus-within .locallora-lora-card-info,
                    #${uniqueId} .locallora-lora-card.selected-flow .locallora-lora-card-info { opacity: 1; transform: translateY(0); pointer-events: auto; }
                    #${uniqueId} .locallora-lora-card p { font-size: 11px; font-weight: 700; line-height: 1.15; margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #f4f8fb; text-shadow: 0 1px 8px rgba(0,0,0,0.82); }
                    #${uniqueId} .lora-card-triggers { font-size: 10px; color: rgba(230, 238, 245, 0.72); padding: 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 13px; }
                    #${uniqueId} .lora-card-tags { display: flex; flex-wrap: wrap; gap: 3px; padding-top: 2px; }
                    #${uniqueId} .lora-card-tags .tag { background: rgba(22, 114, 161, 0.72); color: #fff; padding: 1px 5px; font-size: 10px; border-radius: 999px; cursor: pointer; }
                    #${uniqueId} .lora-card-tags .tag:hover { background: rgba(38, 151, 211, 0.88); }

                    /* --- Card Buttons (Edit, Link, Sync) --- */
                    #${uniqueId} .card-btn {
                        position: absolute; width: 24px; height: 24px; background: rgba(10, 12, 15, 0.62);
                        color: white; border: 1px solid rgba(255,255,255,0.22); border-radius: 7px; display: flex; align-items: center; justify-content: center;
                        font-size: 12px; cursor: pointer; transition: all 0.16s ease; opacity: 0.82; text-decoration: none;
                        z-index: 10;
                    }
                    #${uniqueId} .locallora-lora-card:hover .card-btn { opacity: 1; }
                    #${uniqueId} .card-btn:hover { background: rgba(10, 12, 15, 0.86); border-color: rgba(255,255,255,0.38); }

                    #${uniqueId} .lora-card-link-btn { top: 4px; right: 4px; }
                    #${uniqueId} .edit-tags-btn { bottom: 4px; right: 4px; font-size: 12px; }
                    #${uniqueId} .sync-civitai-btn { top: 4px; left: 4px; font-size: 12px; }
                    #${uniqueId} .sync-civitai-btn.loading { animation: spin 1s linear infinite; pointer-events: none; background-color: #4a90e2; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

                    /* --- Scrollbar --- */
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar { width: 8px; }
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar-track { background: #2a2a2a; border-radius: 4px; }
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar-thumb { background-color: #555; border-radius: 4px; }
                    #${uniqueId} .locallora-gallery::-webkit-scrollbar-thumb:hover { background-color: #777; }
                    
                    /* --- Metadata Editor --- */
                    #${uniqueId} .locallora-metadata-editor { display: none; flex-direction: column; gap: 5px; }
                    #${uniqueId} .locallora-metadata-editor.visible { display: flex; }
                    #${uniqueId} .tag-editor-list .tag .remove-tag { margin-left: 4px; color: #fdd; cursor: pointer; font-weight: bold; }
                    
                    /* --- Active LoRA Drawer --- */
                    #${uniqueId} .locallora-lora-item { flex: 0 0 142px; display: grid; grid-template-columns: 10px minmax(0, 1fr); grid-template-rows: 96px auto; gap: 6px; user-select: none; position: relative; padding: 6px; border: 2px solid rgba(255, 122, 0, 0.68); border-radius: 8px; background: rgba(12, 14, 18, 0.56); box-shadow: 0 8px 18px rgba(0,0,0,0.28); }
                    #${uniqueId} .locallora-lora-item.disabled { opacity: 0.58; filter: grayscale(30%); }
                    #${uniqueId} .lora-active-drag-handle { grid-row: 1 / 3; display: grid; grid-template-columns: repeat(2, 2px); grid-auto-rows: 2px; gap: 3px 2px; justify-content: center; align-content: center; width: 10px; cursor: grab; opacity: 0.75; }
                    #${uniqueId} .lora-active-drag-handle:active { cursor: grabbing; }
                    #${uniqueId} .lora-active-drag-handle span { width: 2px; height: 2px; border-radius: 50%; background: rgba(216, 232, 240, 0.68); }
                    #${uniqueId} .locallora-selected-thumb { grid-column: 2; width: 100%; height: 96px; border-radius: 7px; overflow: hidden; background: #0d1116; border: 1px solid rgba(255, 145, 40, 0.46); }
                    #${uniqueId} .locallora-selected-thumb img,
                    #${uniqueId} .locallora-selected-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
                    #${uniqueId} .locallora-selected-main { grid-column: 2; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
                    #${uniqueId} .locallora-selected-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #f5fbff; font-size: 10px; font-weight: 750; text-align: center; }
                    #${uniqueId} .locallora-selected-controls { display: flex; align-items: center; justify-content: center; gap: 5px; min-width: 0; flex-wrap: wrap; }
                    #${uniqueId} .lora-selected-toggle-pill { height: 27px; min-width: 40px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14); color: #fff; font-size: 9px; font-weight: 800; cursor: pointer; }
                    #${uniqueId} .lora-selected-toggle-pill.on { background: linear-gradient(180deg, #10c791, #07835f); border-color: #3ce7b6; }
                    #${uniqueId} .lora-selected-toggle-pill.off { background: linear-gradient(180deg, #4a4a4a, #303030); border-color: #5a5a5a; color: #d8d8d8; }
                    #${uniqueId} .lora-strength-chip { height: 27px; display: inline-flex; align-items: center; gap: 3px; padding: 0 4px; border-radius: 999px; background: rgba(8, 10, 14, 0.54); border: 1px solid rgba(255,255,255,0.12); color: #dfe7ec; font-size: 9px; font-weight: 750; }
                    #${uniqueId} .lora-strength-chip input { width: 31px; min-width: 0; padding: 0; border: none; background: transparent; color: #f4f8fb; font-size: 11px; font-weight: 800; text-align: center; outline: none; }
                    #${uniqueId} .locallora-lora-item .remove-lora-btn { width: 27px; height: 27px; border: 1px solid rgba(255,255,255,0.13); border-radius: 999px; background: rgba(20, 24, 30, 0.64); color: #fff; cursor: pointer; flex-shrink: 0; }
                    #${uniqueId} .locallora-lora-item .remove-lora-btn:hover { background: #8e2f38; border-color: #c85a64; }
                    #${uniqueId} .locallora-selected-preset { min-width: 0; }
                    #${uniqueId} .locallora-lora-item.dragging { opacity: 0.45; background: #333; }
                    #${uniqueId} .locallora-lora-item.drag-over-before { box-shadow: inset 3px 0 0 #88c0ff, 0 8px 18px rgba(0,0,0,0.28); }
                    #${uniqueId} .locallora-lora-item.drag-over-after { box-shadow: inset -3px 0 0 #88c0ff, 0 8px 18px rgba(0,0,0,0.28); }
                    
                    /* --- Controls & Inputs --- */
                    #${uniqueId} .locallora-controls-row input[type=text], #${uniqueId} .locallora-controls-row select { background: #222; color: #ccc; border: 1px solid #555; padding: 4px; border-radius: 4px; }
                    #${uniqueId} .tag-filter-mode-btn { padding: 4px 8px; background-color: #555; color: #fff; border: 1px solid #666; border-radius: 4px; cursor: pointer; flex-shrink: 0; }
                    #${uniqueId} .tag-filter-mode-btn:hover { background-color: #666; }
                    #${uniqueId} .view-mode-btn { padding: 4px 8px; background-color: #333; color: #fff; border: 1px solid #666; border-radius: 4px; cursor: pointer; flex-shrink: 0; }
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
                    #${uniqueId} .lora-trigger-preset-picker { position: relative; width: 100%; min-width: 0; }
                    #${uniqueId} .lora-card-preset-select,
                    #${uniqueId} .lora-card-preset-checklist { position: absolute; opacity: 0; pointer-events: none; width: 1px; height: 1px; overflow: hidden; }
                    #${uniqueId} .lora-trigger-preset-button { width: 100%; min-width: 0; height: 24px; display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 7px; border: 1px solid rgba(255,255,255,0.16); border-radius: 999px; background: rgba(8, 10, 14, 0.58); color: #f0f4f7; font-size: 10px; font-weight: 700; cursor: pointer; }
                    #${uniqueId} .lora-trigger-preset-button:hover,
                    #${uniqueId} .lora-trigger-preset-picker.open .lora-trigger-preset-button { border-color: rgba(255, 145, 40, 0.62); background: rgba(26, 23, 20, 0.86); }
                    #${uniqueId} .lora-trigger-preset-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    #${uniqueId} .lora-trigger-preset-count { min-width: 0; color: #95e8ca; }
                    #${uniqueId} .lora-trigger-preset-arrow { color: rgba(230,238,245,0.62); font-size: 9px; }
                    #${uniqueId} .lora-trigger-preset-popover { position: absolute; left: 0; bottom: calc(100% + 6px); display: none; z-index: 5000; width: min(260px, 76vw); max-height: 240px; overflow: hidden; padding: 8px; border: 1px solid rgba(174, 226, 255, 0.28); border-radius: 12px; background: radial-gradient(circle at 8% 8%, rgba(146, 238, 255, 0.10), transparent 40%), linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025) 45%, rgba(255,255,255,0.05)), rgba(16, 20, 26, 0.94); box-shadow: 0 16px 42px rgba(0,0,0,0.46), inset 0 0 0 1px rgba(255,255,255,0.05); }
                    #${uniqueId} .locallora-lora-card .lora-trigger-preset-popover { bottom: auto; top: calc(100% + 6px); }
                    #${uniqueId} .lora-trigger-preset-picker.open .lora-trigger-preset-popover { display: block; }
                    #${uniqueId} .lora-trigger-preset-search { width: 100%; box-sizing: border-box; margin-bottom: 6px; background: #1d2229; border: 1px solid rgba(255,255,255,0.14); border-radius: 7px; color: #eaf1f5; font-size: 11px; padding: 5px 7px; outline: none; }
                    #${uniqueId} .lora-trigger-preset-options { display: flex; flex-direction: column; gap: 3px; max-height: 172px; overflow-y: auto; }
                    #${uniqueId} .lora-trigger-preset-option { width: 100%; min-width: 0; display: grid; grid-template-columns: minmax(72px, 0.65fr) minmax(0, 1fr); gap: 8px; align-items: center; padding: 6px 7px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: #dce6eb; text-align: left; cursor: pointer; }
                    #${uniqueId} .lora-trigger-preset-option:hover { background: rgba(255,255,255,0.07); }
                    #${uniqueId} .lora-trigger-preset-option.selected { background: rgba(16, 199, 145, 0.18); border-color: rgba(67, 231, 182, 0.42); color: #fff; }
                    #${uniqueId} .lora-trigger-preset-option-name,
                    #${uniqueId} .lora-trigger-preset-option-preview { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    #${uniqueId} .lora-trigger-preset-option-name { font-size: 11px; font-weight: 750; }
                    #${uniqueId} .lora-trigger-preset-option-preview { color: rgba(226, 238, 245, 0.62); font-size: 10px; }
                    #${uniqueId} .lora-card-preset-stack-label { display: flex; align-items: center; gap: 6px; color: #dbe6eb; font-size: 10px; margin-top: 7px; padding: 6px 7px 2px; border-top: 1px solid rgba(255,255,255,0.1); cursor: pointer; }
                    #${uniqueId} .lora-card-preset-stack-checkbox { margin: 0; }
                    
                    /* Misc */
                    #${uniqueId} .locallora-container.gallery-collapsed .locallora-gallery { display: none; }
                </style>
                <div id="${uniqueId}" style="height: 100%;">
                    <div class="locallora-container">
                        <div class="locallora-controls">
                            <div class="locallora-controls-row locallora-primary-controls">
                                <button class="lora-active-stack-btn" title="Show selected LoRAs">Active <span class="lora-active-stack-count">0</span></button>
                                <select class="folder-filter-select" style="max-width: 180px;">
                                    <option value="">All Folders</option>
                                </select>
                                <button class="save-preset-btn" title="Save current stack as preset">Save Preset</button>
                                <div class="locallora-preset-container">
                                    <button class="load-preset-btn">Load Preset v</button>
                                    <div class="preset-dropdown"></div>
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
                        </div>
                        <div class="locallora-selected-list"></div>
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
            const activeStackBtn = widgetContainer.querySelector(".lora-active-stack-btn");
            const activeStackCount = widgetContainer.querySelector(".lora-active-stack-count");
            const selectedCountEl = widgetContainer.querySelector(".selected-count");
            const clearTagFilterBtn = widgetContainer.querySelector(".clear-tag-filter-btn");
            const folderFilterSelect = widgetContainer.querySelector(".folder-filter-select");
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
                currentViewMode = "gallery";
                selectedListEl.style.display = "";
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

            const closeActiveStack = () => {
                mainContainer.classList.remove("active-stack-open");
                activeStackBtn.classList.remove("open");
            };

            const clearAllLoras = () => {
                this.loraData = [];
                closeActiveStack();
                if (mainContainer.classList.contains("gallery-collapsed")) {
                    setTimeout(() => {
                        const controlsEl = widgetContainer.querySelector(".locallora-controls");
                        if (!controlsEl) return;
                        this.size[1] = controlsEl.offsetHeight + HEADER_HEIGHT;
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
                syncSelectedCardStyles();
                this.setDirtyCanvas(true, true);
            };

            const syncSelectedCardStyles = () => {
                const selectedLoras = new Set(this.loraData.map(item => item.lora));
                galleryEl.querySelectorAll(".locallora-lora-card").forEach(card => {
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

            const resolveLoraInfo = (loraName) => this.availableLoras.find(lora => lora.name === loraName) || {
                name: loraName,
                tags: [],
                trigger_words: "",
                trigger_presets: {},
                download_url: "",
                preview_url: "",
                preview_type: "none"
            };

            const buildSelectedPreviewHtml = (lora) => {
                const emptyLoraImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                const previewUrl = lora.preview_url || emptyLoraImage;
                if (lora.preview_type === "video" && lora.preview_url) {
                    return `<video muted loop playsinline src="${escapeHtml(previewUrl)}"></video>`;
                }
                return `<img src="${escapeHtml(previewUrl)}" loading="lazy">`;
            };

            const renderSelectedList = () => {
                selectedListEl.innerHTML = "";
                selectedListEl.dataset.count = String(this.loraData.length);
                activeStackCount.textContent = String(this.loraData.length);
                activeStackBtn.classList.toggle("has-active", this.loraData.length > 0);
                activeStackBtn.disabled = this.loraData.length === 0;
                activeStackBtn.title = this.loraData.length ? "Show selected LoRAs" : "No selected LoRAs";
                if (!this.loraData.length) {
                    closeActiveStack();
                    return;
                }
                const clearActiveBtn = document.createElement("button");
                clearActiveBtn.className = "lora-active-clear-btn";
                clearActiveBtn.type = "button";
                clearActiveBtn.textContent = "Clear All";
                clearActiveBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    clearAllLoras();
                });
                selectedListEl.appendChild(clearActiveBtn);
                this.loraData.forEach((item, index) => {
                    const lora = resolveLoraInfo(item.lora);
                    const el = document.createElement("div");
                    el.className = "locallora-lora-item";
                    el.dataset.index = index;
                    el.dataset.loraName = item.lora;
                    el.classList.toggle("disabled", !item.on);
                    el.title = `${item.lora}\nDrag to change LoRA load order`;

                    const clipStrengthHtml = this.isModelOnly ? "" : `
                        <label class="lora-strength-chip" title="CLIP strength">
                            <span>C</span>
                            <input class="selected-strength-clip" type="number" value="${escapeHtml(String(item.strength_clip ?? item.strength ?? 1.0))}" min="-2.0" max="2.0" step="0.05">
                        </label>`;

                    el.innerHTML = `
                        <div class="lora-active-drag-handle" title="Drag to reorder" aria-hidden="true">
                            <span></span><span></span><span></span><span></span><span></span><span></span>
                        </div>
                        <div class="locallora-selected-thumb">${buildSelectedPreviewHtml(lora)}</div>
                        <div class="locallora-selected-main">
                            <div class="locallora-selected-name" title="${escapeHtml(item.lora)}">${escapeHtml(item.lora)}</div>
                            <div class="locallora-selected-controls">
                                <button type="button" class="lora-selected-toggle-pill ${item.on ? "on" : "off"}">${item.on ? "ON" : "OFF"}</button>
                                <label class="lora-strength-chip" title="Model strength">
                                    <span>M</span>
                                    <input class="selected-strength-model" type="number" value="${escapeHtml(String(item.strength ?? 1.0))}" min="-10.0" max="10.0" step="0.05">
                                </label>
                                ${clipStrengthHtml}
                                <button type="button" class="remove-lora-btn" title="Remove LoRA">x</button>
                            </div>
                            <div class="locallora-selected-preset">${buildPresetControlsHTML(lora)}</div>
                        </div>
                    `;

                    setupPresetControls(el, lora);

                    const previewImage = el.querySelector(".locallora-selected-thumb img");
                    if (previewImage) {
                        previewImage.onerror = (e) => {
                            e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        };
                    }
                    const previewVideo = el.querySelector(".locallora-selected-thumb video");
                    if (previewVideo) {
                        el.addEventListener("mouseenter", () => previewVideo.play().catch(() => {}));
                        el.addEventListener("mouseleave", () => { previewVideo.pause(); previewVideo.currentTime = 0; });
                    }

                    const toggleBtn = el.querySelector(".lora-selected-toggle-pill");
                    toggleBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        this.loraData[index].on = !this.loraData[index].on;
                        renderSelectedList();
                        updateSelection();
                    });

                    const strengthModelInput = el.querySelector(".selected-strength-model");
                    strengthModelInput.addEventListener("change", (e) => {
                        this.loraData[index].strength = parseFloat(e.target.value) || 1.0;
                        updateSelection();
                    });

                    const strengthClipInput = el.querySelector(".selected-strength-clip");
                    if (strengthClipInput) {
                        strengthClipInput.addEventListener("change", (e) => {
                            this.loraData[index].strength_clip = parseFloat(e.target.value) || this.loraData[index].strength || 1.0;
                            updateSelection();
                        });
                    }

                    const removeBtn = el.querySelector(".remove-lora-btn");
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
                                const contentHeight = controlsEl.offsetHeight;
                                this.size[1] = contentHeight + HEADER_HEIGHT;
                                this.setDirtyCanvas(true, true);
                            }, 0);
                        }
                        fetchAndRender(false);
                        updatePresetButtonText(null);
                    });

                    bindMouseReorderHandle(el, el.querySelector(".lora-active-drag-handle"), ".locallora-lora-item", selectedListEl, (fromIndex, targetIndex, insertAfter) => {
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
                const defaultText = 'S';
                const errorText = 'ERR';

                syncBtn.textContent = '...';
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
                            linkBtn.innerHTML = 'L';
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
                    syncBtn.textContent = errorText;
                    setTimeout(() => syncBtn.textContent = defaultText, 2000);
                } finally {
                    syncBtn.classList.remove('loading');
                    if(syncBtn.textContent !== errorText) syncBtn.textContent = defaultText;
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
                const existingItem = this.loraData.find(item => item.lora === lora.name);
                const existingPresetNames = existingItem && Array.isArray(existingItem.selected_presets)
                    ? existingItem.selected_presets
                    : (existingItem && existingItem.selected_preset ? [existingItem.selected_preset] : []);
                const useStackedTriggerPresets = Boolean(existingItem?.stack_trigger_presets || existingPresetNames.length > 1);

                const getSelectedPresetNames = () => {
                    if (presetStackCheckbox.checked) {
                        return presetChecks.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
                    }
                    return presetSelect.value ? [presetSelect.value] : [];
                };

                const syncPresetPickerUi = () => {
                    const stacking = presetStackCheckbox.checked;
                    picker?.classList.toggle("stacking", stacking);
                    presetChecklist.classList.toggle("visible", false);
                    const selectedPresetNames = getSelectedPresetNames();
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

                const applyPresetSelection = () => {
                    const item = this.loraData.find(item => item.lora === lora.name);
                    if (item) {
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
                    }
                    syncPresetPickerUi();
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
                        openPicker.closest(".locallora-lora-card")?.classList.remove("preset-open");
                    });
                    picker?.classList.toggle("open", shouldOpen);
                    element.closest(".locallora-lora-card")?.classList.toggle("preset-open", shouldOpen);
                    if (shouldOpen) presetSearch?.focus();
                });

                pickerPopover?.addEventListener("click", (e) => e.stopPropagation());

                presetOptions.forEach(option => {
                    option.addEventListener("click", (e) => {
                        e.stopPropagation();
                        const presetName = option.dataset.presetName || "";
                        if (presetStackCheckbox.checked) {
                            if (!presetName) {
                                presetChecks.forEach(checkbox => checkbox.checked = false);
                            } else {
                                const matchingCheck = presetChecks.find(checkbox => checkbox.value === presetName);
                                if (matchingCheck) matchingCheck.checked = !matchingCheck.checked;
                            }
                        } else {
                            presetSelect.value = presetName;
                            picker?.classList.remove("open");
                            element.closest(".locallora-lora-card")?.classList.remove("preset-open");
                        }
                        applyPresetSelection();
                    });
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
                promoteSelectedLorasInAvailableList();
                renderSelectedList();
                renderGallery(false);
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
                    
                    const linkBtnHTML = lora.download_url ? `<a href="${lora.download_url}" target="_blank" class="card-btn lora-card-link-btn" title="Open download page">L</a>` : '';

                    const presetDropdownHTML = buildPresetControlsHTML(lora);

                    card.innerHTML = `
                        <div class="card-btn sync-civitai-btn" title="Sync with Civitai">S</div>
                        ${linkBtnHTML}
                        <div class="locallora-media-container">${mediaHTML}</div>
                        <div class="locallora-lora-card-info">
                            <p>${escapeHtml(lora.name)}</p>
                            <div class="lora-card-triggers" title="${escapeHtml(lora.trigger_words)}">${escapeHtml(lora.trigger_words || 'No triggers')}</div>
                            ${presetDropdownHTML}
                            <div class="lora-card-tags"></div>
                        </div>
                        <div class="card-btn edit-tags-btn">E</div>
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
                            const requiredTopHeight = controlsEl.offsetHeight;

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
                initialState.is_collapsed = false;

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
                        const contentHeight = controlsEl.offsetHeight;
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
                                linkBtn.innerHTML = 'L';
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

                activeStackBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (!this.loraData.length) return;
                    const shouldOpen = !mainContainer.classList.contains("active-stack-open");
                    mainContainer.classList.toggle("active-stack-open", shouldOpen);
                    activeStackBtn.classList.toggle("open", shouldOpen);
                });

                toggleGalleryBtn.addEventListener("click", () => {
                    const isCollapsing = !mainContainer.classList.contains("gallery-collapsed");
                    
                    if (isCollapsing) {
                        this.expandedHeight = this.size[1];
                        const controlsEl = widgetContainer.querySelector(".locallora-controls");
                        const contentHeight = controlsEl.offsetHeight;
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
                    if (!e.target.closest?.(`#${uniqueId} .lora-active-stack-btn, #${uniqueId} .locallora-selected-list`)) {
                        closeActiveStack();
                    }
                    if (!e.target.closest?.(`#${uniqueId} .lora-trigger-preset-picker`)) {
                        widgetContainer.querySelectorAll(".lora-trigger-preset-picker.open").forEach(openPicker => {
                            openPicker.classList.remove("open");
                            openPicker.closest(".locallora-lora-card")?.classList.remove("preset-open");
                        });
                    }
                });
            };

            this.onResize = function(size) {
                const controlsEl = widgetContainer.querySelector(".locallora-controls");
                const dynamicMinHeight = (controlsEl?.offsetHeight || 0) + HEADER_HEIGHT;
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

