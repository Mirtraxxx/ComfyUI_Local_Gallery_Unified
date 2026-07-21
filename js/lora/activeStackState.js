export function hydrateSelectedLoraInfo(selectedItems = [], availableLoras = []) {
    const loraInfoByName = new Map(availableLoras.map(lora => [lora.name, lora]));
    selectedItems.forEach(item => {
        const lora = loraInfoByName.get(item.lora);
        if (!lora) return;
        item.preview_url = lora.preview_url || "";
        item.preview_type = lora.preview_type || "none";
        item.tags = lora.tags || [];
        item.trigger_words = lora.trigger_words || "";
        item.trigger_presets = lora.trigger_presets || {};
        item.download_url = lora.download_url || "";
    });
    return selectedItems;
}

export function swapSelectedLoras(selectedItems = [], fromIndex, targetIndex) {
    if (
        fromIndex === targetIndex
        || fromIndex < 0
        || targetIndex < 0
        || fromIndex >= selectedItems.length
        || targetIndex >= selectedItems.length
    ) {
        return selectedItems;
    }

    const reorderedItems = [...selectedItems];
    [reorderedItems[fromIndex], reorderedItems[targetIndex]] = [
        reorderedItems[targetIndex],
        reorderedItems[fromIndex],
    ];
    return reorderedItems;
}
