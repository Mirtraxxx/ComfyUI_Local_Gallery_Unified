const RUNTIME_ONLY_SELECTION_FIELDS = Object.freeze([
    "element",
    "preview_url",
    "preview_type",
    "tags",
    "trigger_words",
    "trigger_presets",
    "download_url",
    "remember_strength",
    "saved_strength",
    "saved_strength_clip",
]);

/** Resolve selected trigger preset names from a selection item (stack or single). */
export function getSelectedTriggerPresetNames(item) {
    if (!item || typeof item !== "object") return [];
    if (Array.isArray(item.selected_presets) && item.selected_presets.length > 0) {
        return item.selected_presets.filter(name => typeof name === "string" && name);
    }
    if (typeof item.selected_preset === "string" && item.selected_preset) {
        return [item.selected_preset];
    }
    return [];
}

export function toSerializableLoraSelection(items) {
    return items.map(item => {
        const selectionFields = { ...item };
        RUNTIME_ONLY_SELECTION_FIELDS.forEach(field => delete selectionFields[field]);
        return selectionFields;
    });
}
