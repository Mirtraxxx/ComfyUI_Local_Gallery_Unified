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
