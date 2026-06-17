import { escapeHtml } from "../shared/dom.js";

export function buildLoraPresetControlsHtml(lora) {
    const triggerPresets = lora?.trigger_presets || {};
    const presetNames = Object.keys(triggerPresets);
    if (!presetNames.length) return "";

    const optionsHtml = presetNames
        .map((presetName) => `<option value="${escapeHtml(presetName)}">${escapeHtml(presetName)}</option>`)
        .join("");
    const checklistHtml = presetNames
        .map((presetName) => `<label>
            <input type="checkbox" class="lora-card-preset-check" value="${escapeHtml(presetName)}">
            ${escapeHtml(presetName)}
        </label>`)
        .join("");
    const optionButtonsHtml = presetNames
        .map((presetName) => `<button type="button" class="lora-trigger-preset-option" data-preset-name="${escapeHtml(presetName)}" title="${escapeHtml(triggerPresets[presetName] || "")}">
            <span class="lora-trigger-preset-option-name">${escapeHtml(presetName)}</span>
            <span class="lora-trigger-preset-option-preview">${escapeHtml(triggerPresets[presetName] || "")}</span>
        </button>`)
        .join("");
    const showSearch = presetNames.length > 6;

    return `<div class="lora-trigger-preset-picker">
    <select class="lora-card-preset-select" aria-hidden="true" tabindex="-1">
        <option value="">Default Triggers</option>
        ${optionsHtml}
    </select>
    <div class="lora-card-preset-checklist">
        ${checklistHtml}
    </div>
    <button type="button" class="lora-trigger-preset-button" title="Choose trigger preset">
        <span class="lora-trigger-preset-label">Default Triggers</span>
        <span class="lora-trigger-preset-count"></span>
        <span class="lora-trigger-preset-arrow">v</span>
    </button>
    <div class="lora-trigger-preset-popover">
        ${showSearch ? '<input type="text" class="lora-trigger-preset-search" placeholder="Find preset...">' : ""}
        <div class="lora-trigger-preset-options">
            <button type="button" class="lora-trigger-preset-option" data-preset-name="">
                <span class="lora-trigger-preset-option-name">Default Triggers</span>
                <span class="lora-trigger-preset-option-preview">${escapeHtml(lora?.trigger_words || "")}</span>
            </button>
            ${optionButtonsHtml}
        </div>
        <label class="lora-card-preset-stack-label" title="Allow multiple trigger presets to be appended to this LoRA's prompt output">
            <input type="checkbox" class="lora-card-preset-stack-checkbox">
            Stack presets
        </label>
    </div>
</div>`;
}

export function buildSelectedPreviewHtml(lora) {
    const emptyLoraImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const previewUrl = lora.preview_url || emptyLoraImage;
    if (lora.preview_type === "video" && lora.preview_url) {
        return `<video muted loop playsinline src="${escapeHtml(previewUrl)}"></video>`;
    }
    return `<img src="${escapeHtml(previewUrl)}" loading="lazy">`;
}

export function buildSelectedLoraItemHtml(item, index, lora, isModelOnly, isCompact) {
    const previewHtml = isCompact ? "" : `
        <div class="locallora-selected-thumb">
            ${buildSelectedPreviewHtml(lora)}
        </div>
    `;
    
    const formatWeight = (weight) => {
        const rounded = Math.round(weight * 100) / 100;
        const tenth = Math.round(rounded * 10) / 10;
        if (Math.abs(rounded - tenth) < 1e-9) {
            return tenth.toFixed(1);
        } else {
            return rounded.toFixed(2);
        }
    };
    
    const formattedModelWeight = formatWeight(Number(item.strength ?? 1.0));
    
    const clipStrengthHtml = isModelOnly ? "" : `
        <div class="lora-strength-chip" title="CLIP strength (Scroll to adjust)">
            <span>C</span>
            <span class="managed-weight-val selected-strength-clip" tabindex="0" title="Scroll to adjust CLIP strength">${formatWeight(Number(item.strength_clip ?? item.strength ?? 1.0))}</span>
        </div>
    `;
    
    return `
        <span class="locallora-active-drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
            <span></span><span></span><span></span><span></span><span></span><span></span>
        </span>
        ${previewHtml}
        <div class="locallora-selected-main">
            <div class="locallora-selected-name" title="${escapeHtml(item.lora)}">${escapeHtml(item.lora)}</div>
            <div class="locallora-selected-controls">
                <button type="button" class="lora-selected-toggle-pill ${item.on ? "on" : "off"}">${item.on ? "ON" : "OFF"}</button>
                <div class="lora-strength-chip" title="Model strength (Scroll to adjust)">
                    <span>M</span>
                    <span class="managed-weight-val selected-strength-model" tabindex="0" title="Scroll to adjust Model strength">${formattedModelWeight}</span>
                </div>
                ${clipStrengthHtml}
                <button type="button" class="remove-lora-btn" title="Remove LoRA">x</button>
            </div>
            <div class="locallora-selected-preset">${buildLoraPresetControlsHtml(lora)}</div>
        </div>
    `;
}

export function buildLoraCardHtml(lora, isSelected, isSelectedEdit, isCompact, svgs = {}) {
    let mediaHTML = '';
    const empty_lora_image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const previewUrl = lora.preview_url;

    if (lora.preview_type === 'video' && previewUrl) {
        mediaHTML = `<video muted loop playsinline src="${previewUrl}"></video>`;
    } else {
        mediaHTML = `<img src="${previewUrl || empty_lora_image}" loading="lazy">`;
    }
    
    const linkBtnHTML = lora.download_url ? `<a href="${escapeHtml(lora.download_url)}" target="_blank" class="card-btn lora-card-link-btn" title="Open download page" aria-label="Open download page">${svgs.link || ""}</a>` : '';

    const presetDropdownHTML = buildLoraPresetControlsHtml(lora);

    return `
        <button type="button" class="card-btn sync-civitai-btn" title="Sync with Civitai" aria-label="Sync with Civitai">${svgs.sync || ""}</button>
        ${linkBtnHTML}
        <div class="locallora-media-container">${mediaHTML}</div>
        <div class="locallora-lora-card-info">
            <p>${escapeHtml(lora.name)}</p>
            <div class="lora-card-triggers" title="${escapeHtml(lora.trigger_words)}">${escapeHtml(lora.trigger_words || 'No triggers')}</div>
            ${presetDropdownHTML}
            <div class="lora-card-tags"></div>
        </div>
        <button type="button" class="card-btn edit-tags-btn" title="Edit LoRA metadata" aria-label="Edit LoRA metadata">${svgs.edit || ""}</button>
    `;
}
