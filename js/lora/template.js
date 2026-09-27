import { LORA_DISPLAY_LIMITS } from "./displayState.js";
import { icon } from "../shared/icons.js";

const DISPLAY_MODE_OPTIONS = `
    <option value="thumbnails">Thumbnails</option>
    <option value="compact">Compact</option>`;

export function getLoraTemplate(uniqueId) {
    return `
<div id="${uniqueId}" class="locallora-root" style="height: 100%;">
<div class="locallora-container lg-shell">
    <div class="locallora-controls lg-bar lg-top">
        <button class="lg-count empty lora-active-stack-btn" type="button" title="Active LoRAs" aria-label="Active LoRAs" aria-pressed="false">
            ${icon("stack")}<span class="lora-active-stack-count">0</span>
        </button>
        <div class="lg-strip lora-folder-strip"></div>
        <button class="lg-icon-btn lora-folder-more-btn" type="button" hidden title="All folders" aria-label="All folders">${icon("chevronDown")}</button>
        <div class="lg-overflow lora-folder-overflow" id="${uniqueId}-folder-overflow" hidden></div>
        <div class="locallora-metadata-editor" aria-label="LoRA details editor">
            <div class="lora-metadata-editor-header">
                <div class="lora-metadata-editor-heading">
                    <strong class="lora-metadata-editor-title">Selected LoRA</strong>
                    <span class="lora-metadata-editor-selection"><span class="selected-count">0</span><span class="lora-metadata-editor-selection-label"> selected</span></span>
                </div>
                <div class="lora-metadata-editor-actions">
                    <div class="lora-thumbnail-editor-action">
                        <button class="lg-text-btn use-last-output-thumbnail-btn" type="button" disabled>
                            ${icon("image")}
                            <span class="lora-thumbnail-action-label">Use last result</span>
                        </button>
                        <span class="lora-thumbnail-action-status" aria-live="polite"></span>
                    </div>
                    <button class="lg-icon-btn lora-metadata-editor-close" type="button" aria-label="Close LoRA details" title="Close">${icon("close")}</button>
                </div>
            </div>
            <div class="lora-metadata-editor-grid">
                <label class="lora-metadata-field trigger-editor-row" style="display:none;">
                    <span>Trigger words</span>
                    <input type="text" class="lg-input trigger-editor-input" placeholder="Words added when this LoRA is used">
                </label>
                <label class="lora-metadata-field url-editor-row" style="display:none;">
                    <span>Source URL</span>
                    <input type="text" class="lg-input url-editor-input" placeholder="Civitai or download page">
                </label>
            </div>
            <div class="lora-metadata-field strength-memory-editor-row" style="display:none;">
                <label class="lg-check strength-memory-enable-label">
                    <input type="checkbox" class="strength-memory-enable-input">
                    <span>Remember strengths</span>
                </label>
                <small>Re-select this LoRA with these strengths.</small>
                <div class="strength-memory-controls">
                    <label class="strength-memory-control">
                        <span>Model</span>
                        <input type="number" class="lg-input strength-memory-model-input" step="0.05" min="-10" max="10" value="1">
                    </label>
                    <label class="strength-memory-control strength-memory-clip-control">
                        <span>CLIP</span>
                        <input type="number" class="lg-input strength-memory-clip-input" step="0.05" min="-2" max="2" value="1">
                    </label>
                </div>
            </div>
            <div class="lora-metadata-field trigger-preset-editor-row" style="display:none;">
                <button class="lora-trigger-preset-editor-toggle" type="button" aria-expanded="false">
                    <span class="lora-metadata-field-label">
                        <span>Trigger presets <span class="lora-trigger-preset-count"></span></span>
                        <small>Alternate trigger word sets</small>
                    </span>
                    <span class="lora-trigger-preset-toggle-icon" aria-hidden="true">${icon("chevronDown")}</span>
                </button>
                <div class="lora-trigger-preset-content" hidden>
                    <div class="trigger-preset-list"></div>
                    <div class="lora-trigger-preset-form">
                        <input type="text" class="lg-input trigger-preset-name-input" placeholder="Preset name">
                        <input type="text" class="lg-input trigger-preset-value-input" placeholder="Trigger words">
                        <button class="lg-text-btn primary add-trigger-preset-btn" type="button">Add preset</button>
                    </div>
                </div>
            </div>
        </div>
        <select class="folder-filter-select" hidden><option value="">All Folders</option></select>
    </div>
    <div class="locallora-body-shell">
        <aside class="locallora-active-sidebar lg-side" id="${uniqueId}-active-sidebar">
            <div class="lg-side-head">
                <div class="lg-side-title">
                    <span>Active LoRAs</span>
                    <span id="${uniqueId}-active-count">0 selected</span>
                </div>
                <button class="lg-text-btn danger lora-active-clear-btn" type="button">Clear</button>
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
    <div class="locallora-bottom-bar lg-bar lg-bottom">
        <div class="lg-anchor">
            <button class="lg-icon-btn lora-search-btn" type="button" title="Search LoRAs" aria-label="Search LoRAs">${icon("search")}</button>
            <div class="lg-popover lora-search-popover" id="${uniqueId}-search-popover" hidden>
                <div class="lg-row">
                    <input type="search" class="lg-input search-input" placeholder="Search LoRAs by name" aria-label="Search LoRAs by name" autocomplete="off" spellcheck="false">
                    <button class="lg-icon-btn lora-search-clear-btn" type="button" title="Clear search" aria-label="Clear search">${icon("close")}</button>
                </div>
            </div>
        </div>
        <div class="lg-anchor">
            <button class="lg-icon-btn load-preset-btn" type="button" title="Presets" aria-label="Presets">${icon("bookmark")}</button>
            <div class="lg-popover lora-preset-popover" id="${uniqueId}-preset-popover" hidden>
                <div class="lg-popover-head">
                    <span class="lg-popover-title">Presets</span>
                    <p class="lg-note">Save the active stack, or load a saved one in its place.</p>
                </div>
                <div class="lg-row">
                    <input type="text" class="lg-input lora-preset-name-input" placeholder="New preset name" aria-label="New preset name" autocomplete="off" spellcheck="false">
                    <button class="lg-text-btn save-preset-btn" type="button" disabled>${icon("save")}Save</button>
                </div>
                <div class="preset-dropdown"></div>
            </div>
        </div>
        <span class="lg-sep"></span>
        <div class="lg-anchor">
            <button class="lg-icon-btn lora-lottery-btn" type="button" title="Lottery" aria-label="Lottery">${icon("dice")}</button>
            <div class="lg-popover lora-lottery-popover" id="${uniqueId}-lottery-popover" hidden>
                <div class="lg-popover-head">
                    <label class="lg-check"><input class="lora-lottery-enabled-input" type="checkbox"><span class="lg-popover-title">Lottery</span></label>
                    <p class="lg-note lora-lottery-status" aria-live="polite">Off. Your Active Stack is unchanged.</p>
                </div>
                <label class="lg-field">Folder
                    <select class="lg-select lora-lottery-folder-select"><option value="">All folders</option></select>
                </label>
                <div class="lg-row">
                    <label class="lg-field">Model
                        <input class="lg-input lora-lottery-strength-input" type="number" value="1" step="0.05">
                    </label>
                    <label class="lg-field">CLIP
                        <input class="lg-input lora-lottery-clip-strength-input" type="number" value="1" step="0.05">
                    </label>
                </div>
            </div>
        </div>
        <button class="lg-text-btn lora-execution-mode-btn" type="button" data-mode="stack">
            <span class="lora-execution-mode-icon" data-mode="stack">${icon("stack")}</span><span class="lora-execution-mode-icon" data-mode="compare">${icon("compare")}</span><span class="lora-execution-mode-label">Stack</span>
        </button>
        <label class="lora-compare-strengths-control" title="Comma-separated strengths used for every selected LoRA" hidden>
            <input class="lg-input lora-compare-strengths-input" type="text" value="1.0" placeholder="0.8, 1.0" aria-label="Compare strengths" spellcheck="false">
        </label>
        <span class="lg-spacer"></span>
        <div class="lg-anchor">
            <button class="lg-icon-btn lora-display-options-btn" type="button" title="Display" aria-label="Display">${icon("sliders")}</button>
            <div class="lg-popover lg-align-end lora-display-options-popover" id="${uniqueId}-display-popover" hidden>
                <section class="lg-section">
                    <div class="lg-label">Active stack</div>
                    <div class="lg-row">
                        <select class="lg-select lora-active-display-mode" aria-label="Active stack layout">${DISPLAY_MODE_OPTIONS}</select>
                        <input class="lg-range lora-active-thumbnail-size-slider" type="range" min="${LORA_DISPLAY_LIMITS.activeThumbnailMin}" max="${LORA_DISPLAY_LIMITS.activeThumbnailMax}" step="1" aria-label="Active thumbnail size">
                    </div>
                    <label class="lg-check"><input class="lora-active-large-cards-checkbox" type="checkbox"><span>Large cards</span></label>
                    <label class="lg-check"><input class="lora-show-clip-weights-checkbox" type="checkbox"><span>Show CLIP weights</span></label>
                </section>
                <section class="lg-section">
                    <div class="lg-label">Cards</div>
                    <div class="lg-row">
                        <select class="lg-select lora-cards-display-mode" aria-label="Card layout">${DISPLAY_MODE_OPTIONS}</select>
                        <input class="lg-range lora-thumbnail-size-slider" type="range" min="${LORA_DISPLAY_LIMITS.cardThumbnailMin}" max="${LORA_DISPLAY_LIMITS.cardThumbnailMax}" step="1" aria-label="Card thumbnail size">
                    </div>
                    <select class="lg-select lora-sort-select" aria-label="Sort cards">
                        <option value="az">A to Z</option>
                        <option value="za">Z to A</option>
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                    </select>
                </section>
                <section class="lg-section">
                    <label class="lg-check"><input class="lora-move-active-to-top-checkbox" type="checkbox"><span>Selected cards first</span></label>
                    <label class="lg-check"><input class="lora-dim-unselected-checkbox" type="checkbox"><span>Dim unselected cards</span></label>
                    <label class="lg-check"><input class="lora-auto-hide-bar-checkbox" type="checkbox"><span>Auto-hide bottom bar</span></label>
                </section>
            </div>
        </div>
    </div>
</div>
</div>
    `;
}
