/** Builds the enriched browser-side selection object before persistence strips runtime fields. */
export function buildLoraSelectionEntry({ element, loraName, lora = null }) {
    const entry = { on: true, lora: loraName, strength: 1.0, strength_clip: 1.0 };
    if (lora) {
        entry.preview_url = lora.preview_url || "";
        entry.preview_type = lora.preview_type || "none";
        entry.tags = lora.tags || [];
        entry.trigger_words = lora.trigger_words || "";
        entry.trigger_presets = lora.trigger_presets || {};
        entry.download_url = lora.download_url || "";
    } else {
        const previewMedia = element.querySelector(".locallora-media-container img, .locallora-media-container video");
        if (previewMedia?.getAttribute("src")) {
            entry.preview_url = previewMedia.getAttribute("src");
            entry.preview_type = previewMedia.tagName.toLowerCase() === "video" ? "video" : "image";
        }
    }

    const presetSelect = element.querySelector('.lora-card-preset-select');
    const stackPresetCheckbox = element.querySelector('.lora-card-preset-stack-checkbox');
    if (presetSelect && stackPresetCheckbox?.checked) {
        const selectedPresets = Array.from(element.querySelectorAll('.lora-card-preset-check:checked'))
            .map(checkbox => checkbox.value);
        if (selectedPresets.length > 0) {
            entry.stack_trigger_presets = true;
            entry.selected_presets = selectedPresets;
            entry.selected_preset = selectedPresets.length === 1 ? selectedPresets[0] : "";
        }
    } else if (presetSelect && presetSelect.value) {
        entry.selected_preset = presetSelect.value;
    }

    return entry;
}
