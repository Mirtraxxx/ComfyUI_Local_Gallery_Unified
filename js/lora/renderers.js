import { escapeHtml } from "../shared/dom.js";

export function buildLoraPresetControlsHtml(lora, compact = false) {
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

    return `<select class="lora-card-preset-select" style="width: 100%; max-width: 100%; background: #222; color: #ccc; border: 1px solid #555; border-radius: 4px; font-size: 10px; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis;">
        <option value="">Default Triggers</option>
        ${optionsHtml}
    </select>
    <div class="lora-card-preset-checklist">
        ${checklistHtml}
    </div>
    <label class="lora-card-preset-stack-label" title="Allow multiple trigger presets to be appended to this LoRA's prompt output">
        <input type="checkbox" class="lora-card-preset-stack-checkbox">
        ${compact ? "Stack" : "Stack trigger presets"}
    </label>`;
}

export function buildCompactHeaderHtml(isModelOnly) {
    return `
        <span class="compact-toggle-all">Toggle All</span>
        <span class="compact-header-actions">
            <span>${isModelOnly ? "Strength" : "Model / CLIP"}</span>
        </span>
    `;
}

export function buildCompactRowHtml({ item, lora, isModelOnly }) {
    const modelStrength = item.strength ?? 1.0;
    const clipStrength = item.strength_clip ?? item.strength ?? 1.0;
    const linkBtnHtml = lora.download_url
        ? `<a href="${escapeHtml(lora.download_url)}" target="_blank" class="row-action-btn lora-card-link-btn" title="Open download page">L</a>`
        : "";
    const modelStrengthHtml = `
        <div class="compact-strength compact-strength-stepper">
            <button class="compact-strength-dec" title="Decrease model strength">&lt;</button>
            <input class="compact-strength-model" type="number" value="${escapeHtml(String(modelStrength))}" min="-10.0" max="10.0" step="0.05">
            <button class="compact-strength-inc" title="Increase model strength">&gt;</button>
        </div>`;
    const clipStrengthHtml = isModelOnly ? "" : `
        <div class="compact-strength compact-strength-stepper">
            <button class="compact-strength-dec" title="Decrease CLIP strength">&lt;</button>
            <input class="compact-strength-clip" type="number" value="${escapeHtml(String(clipStrength))}" min="-2.0" max="2.0" step="0.05">
            <button class="compact-strength-inc" title="Increase CLIP strength">&gt;</button>
        </div>`;

    return `
        <input class="compact-selected-toggle" type="checkbox" title="Enable LoRA" ${item.on ? "checked" : ""}>
        <div class="compact-lora-name" title="${escapeHtml(item.lora)}">${escapeHtml(item.lora)}</div>
        ${modelStrengthHtml}
        ${clipStrengthHtml}
        <div class="compact-preset-area">${buildLoraPresetControlsHtml(lora, true)}</div>
        <div class="lora-card-triggers compact-trigger-preview" title="${escapeHtml(lora.trigger_words || "")}">${escapeHtml(lora.trigger_words || "No triggers")}</div>
        <div class="compact-actions">
            ${linkBtnHtml}
            <button class="row-action-btn sync-civitai-btn" title="Sync with Civitai">S</button>
            <button class="row-action-btn edit-tags-btn" title="Edit metadata">E</button>
            <button class="row-action-btn compact-remove-btn" title="Remove LoRA">x</button>
        </div>
        <div class="lora-card-tags" style="display:none;"></div>
    `;
}
