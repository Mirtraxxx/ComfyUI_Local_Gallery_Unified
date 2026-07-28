import { escapeHtml, sanitizeHttpUrl } from "../shared/dom.js?v=url-safety-20260712";
import { getSelectedTriggerPresetNames } from "./selectionState.js?v=lora-trigger-preset-feedback-20260726-1";
import { formatLoraWeight } from "./weights.js";

function getSelectedPresetNames(selectionItem) {
    return getSelectedTriggerPresetNames(selectionItem);
}

export function buildLoraPresetControlsHtml(lora, selectionItem = null) {
    const triggerPresets = lora?.trigger_presets || {};
    const presetNames = Object.keys(triggerPresets);
    if (!presetNames.length) return "";

    const selectedPresetNames = getSelectedPresetNames(selectionItem);
    const isStacking = Boolean(selectionItem?.stack_trigger_presets || selectedPresetNames.length > 1);
    const selectedPresetName = !isStacking && selectedPresetNames.length ? selectedPresetNames[0] : "";
    const selectedLabel = isStacking
        ? (selectedPresetNames.length ? `${selectedPresetNames.length} presets` : "Stack presets")
        : (selectedPresetName || "Default Triggers");

    const optionsHtml = presetNames
        .map((presetName) => `<option value="${escapeHtml(presetName)}"${presetName === selectedPresetName ? " selected" : ""}>${escapeHtml(presetName)}</option>`)
        .join("");
    const checklistHtml = presetNames
        .map((presetName) => `<label>
            <input type="checkbox" class="lora-card-preset-check" value="${escapeHtml(presetName)}"${isStacking && selectedPresetNames.includes(presetName) ? " checked" : ""}>
            ${escapeHtml(presetName)}
        </label>`)
        .join("");
    const optionButtonsHtml = presetNames
        .map((presetName) => `<button type="button" class="lora-trigger-preset-option${selectedPresetNames.includes(presetName) ? " selected" : ""}" data-preset-name="${escapeHtml(presetName)}" title="${escapeHtml(triggerPresets[presetName] || "")}" aria-pressed="${selectedPresetNames.includes(presetName) ? "true" : "false"}">
            <span class="lora-trigger-preset-option-name">${escapeHtml(presetName)}</span>
            <span class="lora-trigger-preset-option-preview">${escapeHtml(triggerPresets[presetName] || "")}</span>
        </button>`)
        .join("");
    const showSearch = presetNames.length > 6;
    const tagSvg = `<svg class="lora-preset-tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><path d="M7 7h.01"></path></svg>`;

    return `<div class="lora-trigger-preset-picker${isStacking ? " stacking" : ""}${selectedPresetNames.length ? " has-selection" : ""}">
    <select class="lora-card-preset-select" aria-hidden="true" tabindex="-1">
        <option value=""${selectedPresetName ? "" : " selected"}>Default Triggers</option>
        ${optionsHtml}
    </select>
    <div class="lora-card-preset-checklist">
        ${checklistHtml}
    </div>
    <button type="button" class="lora-trigger-preset-button${selectedPresetNames.length ? " has-selection" : ""}" title="${selectedPresetNames.length ? `Trigger preset: ${escapeHtml(selectedLabel)}` : "Choose trigger preset"}" aria-label="${selectedPresetNames.length ? `Trigger preset: ${escapeHtml(selectedLabel)}` : "Choose trigger preset"}" aria-pressed="${selectedPresetNames.length ? "true" : "false"}">
        ${tagSvg}
        <span class="lora-trigger-preset-label">${escapeHtml(selectedLabel)}</span>
        <span class="lora-trigger-preset-count">${selectedPresetNames.length ? (isStacking ? selectedPresetNames.length : 1) : ""}</span>
        <span class="lora-trigger-preset-arrow">v</span>
    </button>
    <div class="lora-trigger-preset-popover">
        ${showSearch ? '<input type="text" class="lora-trigger-preset-search" placeholder="Find preset...">' : ""}
        <div class="lora-trigger-preset-options">
            <button type="button" class="lora-trigger-preset-option${selectedPresetNames.length ? "" : " selected"}" data-preset-name="" aria-pressed="${selectedPresetNames.length ? "false" : "true"}">
                <span class="lora-trigger-preset-option-name">Default Triggers</span>
                <span class="lora-trigger-preset-option-preview">${escapeHtml(lora?.trigger_words || "")}</span>
            </button>
            ${optionButtonsHtml}
        </div>
        <label class="lora-card-preset-stack-label" title="Allow multiple trigger presets to be appended to this LoRA's prompt output">
            <input type="checkbox" class="lora-card-preset-stack-checkbox"${isStacking ? " checked" : ""}>
            Stack presets
        </label>
    </div>
</div>`;
}

export function buildSelectedPreviewHtml(lora) {
    const emptyLoraImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const previewUrl = lora.preview_url || emptyLoraImage;
    if (lora.preview_type === "video" && lora.preview_url) {
        return `<video muted loop playsinline preload="metadata" src="${escapeHtml(previewUrl)}"></video>`;
    }
    return `<img src="${escapeHtml(previewUrl)}" loading="eager" decoding="async">`;
}

export function buildSelectedLoraItemHtml(item, index, lora, isModelOnly, isCompact, showClipWeights = true) {
    const formattedModelWeight = formatLoraWeight(item.strength ?? 1.0);
    const showClipStrength = !isModelOnly && showClipWeights;
    const modelLabelHtml = showClipWeights ? `<span class="lora-strength-label">M</span>` : "";
    
    const clipStrengthHtml = showClipStrength ? `
        <div class="lora-strength-chip" title="CLIP strength (Scroll to adjust)">
            <span class="lora-strength-label">C</span>
            <span class="managed-weight-val selected-strength-clip" tabindex="0" title="Scroll to adjust CLIP strength">${formatLoraWeight(item.strength_clip ?? item.strength ?? 1.0)}</span>
        </div>
    ` : "";

    const presetControlsHtml = buildLoraPresetControlsHtml(lora, item);
    const cleanName = escapeHtml(item.lora.split(/[\\/]/).pop().replace(/\.safetensors$/i, ""));

    if (isCompact) {
        return `
            <div class="locallora-selected-main">
                <div class="locallora-selected-name" title="${escapeHtml(item.lora)}"><span>${cleanName}</span></div>
                <div class="locallora-selected-controls">
                    <button type="button" class="lora-selected-toggle-pill ${item.on ? "on" : "off"}">${item.on ? "ON" : "OFF"}</button>
                    <div class="lora-strength-chip${showClipWeights ? "" : " label-hidden"}" title="Model strength (Scroll to adjust)">
                        ${modelLabelHtml}
                        <span class="managed-weight-val selected-strength-model" tabindex="0" title="Scroll to adjust Model strength">${formattedModelWeight}</span>
                    </div>
                    ${clipStrengthHtml}
                    <button type="button" class="remove-lora-btn" title="Remove LoRA">x</button>
                </div>
                <div class="locallora-selected-preset">${presetControlsHtml}</div>
            </div>
        `;
    } else {
        const eyeSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const previewHtml = `
            <div class="locallora-selected-thumb" title="Click to remove from active. Drag to reorder.">
                ${buildSelectedPreviewHtml(lora)}
            </div>
            <button type="button" class="lora-active-preview-btn" title="Open preview / details" aria-label="Open preview and details">${eyeSvg}</button>
        `;
        return `
            ${previewHtml}
            <div class="locallora-selected-preset">${presetControlsHtml}</div>
            <div class="locallora-active-overlay-capsule">
                <button type="button" class="lora-selected-toggle-pill ${item.on ? "on" : "off"}">${item.on ? "ON" : "OFF"}</button>
                <div class="lora-strength-chips-row">
                    <div class="lora-strength-chip${showClipWeights ? "" : " label-hidden"}" title="Model strength (Scroll to adjust)">
                        ${modelLabelHtml}
                        <span class="managed-weight-val selected-strength-model" tabindex="0" title="Scroll to adjust Model strength">${formattedModelWeight}</span>
                    </div>
                    ${clipStrengthHtml}
                </div>
            </div>
            <div class="locallora-selected-name" title="${escapeHtml(item.lora)}"><span>${cleanName}</span></div>
        `;
    }
}

export function buildLoraCardHtml(lora, isSelected, isSelectedEdit, isCompact, svgs = {}) {
    let mediaHTML = '';
    const empty_lora_image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const previewUrl = escapeHtml(lora.preview_url || "");

    if (lora.preview_type === 'video' && previewUrl) {
        mediaHTML = `<video muted loop playsinline preload="metadata" src="${previewUrl}"></video>`;
    } else {
        mediaHTML = `<img src="${previewUrl || empty_lora_image}" loading="lazy">`;
    }
    
    const safeDownloadUrl = sanitizeHttpUrl(lora.download_url);
    const linkBtnHTML = safeDownloadUrl ? `<a href="${escapeHtml(safeDownloadUrl)}" target="_blank" rel="noopener noreferrer" class="card-btn lora-card-link-btn" title="Open download page" aria-label="Open download page">${svgs.link || ""}</a>` : '';

    return `
        <button type="button" class="card-btn sync-civitai-btn" title="Sync with Civitai" aria-label="Sync with Civitai">${svgs.sync || ""}</button>
        ${linkBtnHTML}
        <div class="locallora-media-container">${mediaHTML}</div>
        <div class="locallora-lora-card-info">
            <p>${escapeHtml(lora.name)}</p>
            <div class="lora-card-triggers" title="${escapeHtml(lora.trigger_words)}">${escapeHtml(lora.trigger_words || 'No triggers')}</div>
            <div class="lora-card-tags"></div>
        </div>
        <button type="button" class="card-btn edit-tags-btn" title="Edit LoRA metadata" aria-label="Edit LoRA metadata">${svgs.edit || ""}</button>
    `;
}
