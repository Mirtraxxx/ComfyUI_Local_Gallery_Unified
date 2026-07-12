/** Owns the LoRA metadata editor while delegating persistence and gallery refreshes to the node. */
export function createLoraMetadataController({
    nodeInstance,
    metadataEditor,
    selectedCountEl,
    tagEditorList,
    triggerEditorInput,
    triggerEditorRow,
    urlEditorInput,
    urlEditorRow,
    triggerPresetEditorRow,
    triggerPresetList,
    triggerPresetNameInput,
    triggerPresetValueInput,
    addTriggerPresetBtn,
    tagFilterInput,
    getLoraMetadataByName,
    updateCachedLoraMetadata,
    findGalleryCardByLoraName,
    updateMetadata,
    loadAllTags,
    renderCurrentView,
    renderSelectedList,
    fetchAndRender,
}) {
    const getEditingLorasData = () => {
        if (nodeInstance.activeEditingLoraName) {
            const loraData = getLoraMetadataByName(nodeInstance.activeEditingLoraName);
            if (loraData) {
                return [{
                    name: loraData.name || loraData.lora,
                    tags: loraData.tags || [],
                    trigger_words: loraData.trigger_words || "",
                    download_url: loraData.download_url || "",
                    trigger_presets: loraData.trigger_presets || {}
                }];
            }
        }
        return Array.from(nodeInstance.selectedLoraNamesForEditing).map(loraName => {
            const loraData = getLoraMetadataByName(loraName) || {};
            const card = findGalleryCardByLoraName(loraName);
            return {
                name: loraName,
                tags: card?.dataset.tags ? card.dataset.tags.split(',').filter(Boolean) : (loraData.tags || []),
                trigger_words: card?.dataset.triggerWords || loraData.trigger_words || "",
                download_url: card?.dataset.downloadUrl || loraData.download_url || "",
                trigger_presets: loraData.trigger_presets || {}
            };
        });
    };
     const renderMetadataEditor = () => {
        const editingLoras = getEditingLorasData();
        selectedCountEl.textContent = editingLoras.length;
         if (editingLoras.length === 0) {
            metadataEditor.classList.remove("visible");
            return;
        }
         tagEditorList.innerHTML = "";
        const allTags = editingLoras.map(lora => lora.tags);
        const commonTags = allTags.reduce((a, b) => a.filter(c => b.includes(c)), allTags[0] || []);

        commonTags.forEach(tag => {
            const tagEl = document.createElement("span");
            tagEl.className = "tag";
            tagEl.textContent = tag;
            const removeEl = document.createElement("span");
            removeEl.className = "remove-tag";
            removeEl.textContent = "x";
            removeEl.onclick = async (e) => {
                e.stopPropagation();
                const updatePromises = editingLoras.map(async (lora) => {
                    const loraName = lora.name;
                    const newTags = lora.tags.filter(t => t !== tag);

                    await updateMetadata(loraName, { tags: newTags });
                     updateCachedLoraMetadata(loraName, { tags: newTags });
                     const card = findGalleryCardByLoraName(loraName);
                    if (card) {
                        card.dataset.tags = newTags.join(',');
                        renderCardTags(card);
                    }
                });
                await Promise.all(updatePromises);
                await loadAllTags();
                renderMetadataEditor();
            };
            tagEl.appendChild(removeEl);
            tagEditorList.appendChild(tagEl);
        });
         if (editingLoras.length === 1) {
            const singleLora = editingLoras[0];
            triggerEditorInput.value = singleLora.trigger_words || "";
            triggerEditorRow.style.display = "flex";
            urlEditorInput.value = singleLora.download_url || "";
            urlEditorRow.style.display = "flex";
            triggerPresetEditorRow.style.display = "flex";

            const renderPresetsList = () => {
                triggerPresetList.innerHTML = "";
                const loraName = singleLora.name;
                const loraInDataSource = getLoraMetadataByName(loraName);
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
                        await updateMetadata(loraName, { trigger_presets: newPresets });
                        updateCachedLoraMetadata(loraName, { trigger_presets: newPresets });
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

    return { getEditingLorasData, renderMetadataEditor, renderCardTags };
}
