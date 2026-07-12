const RUNTIME_ONLY_SELECTION_FIELDS = Object.freeze([
    "element",
    "preview_url",
    "preview_type",
    "tags",
    "trigger_words",
    "trigger_presets",
    "download_url",
]);

export function toSerializableLoraSelection(items) {
    return items.map(item => {
        const selectionFields = { ...item };
        RUNTIME_ONLY_SELECTION_FIELDS.forEach(field => delete selectionFields[field]);
        return selectionFields;
    });
}
