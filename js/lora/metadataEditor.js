/** Owns the LoRA metadata editor while delegating persistence and gallery refreshes to the node. */
export function createLoraMetadataController({
    nodeInstance,
    metadataEditor,
    selectedCountEl,
    metadataEditorSelectionLabel,
    metadataEditorTitle,
    metadataEditorCloseBtn,
    useLastOutputThumbnailBtn,
    thumbnailActionLabel,
    thumbnailActionStatus,
    triggerEditorInput,
    triggerEditorRow,
    urlEditorInput,
    urlEditorRow,
    triggerPresetEditorRow,
    triggerPresetToggleBtn,
    triggerPresetContent,
    triggerPresetCount,
    triggerPresetList,
    triggerPresetNameInput,
    triggerPresetValueInput,
    addTriggerPresetBtn,
    getLoraMetadataByName,
    updateCachedLoraMetadata,
    findGalleryCardByLoraName,
    updateMetadata,
    getLastOutput,
    assignThumbnail,
    renderCurrentView,
    renderSelectedList,
    fetchAndRender,
    onClose,
}) {
    let thumbnailAssignmentInProgress = false;
    let thumbnailFeedbackTimer = null;
    let presetEditorLoraName = null;

    const setThumbnailStatus = (message, { visible = false } = {}) => {
        thumbnailActionStatus.textContent = message;
        thumbnailActionStatus.classList.toggle("is-visible", visible);
        useLastOutputThumbnailBtn.title = message;
    };

    const setPresetEditorExpanded = (expanded) => {
        triggerPresetToggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
        triggerPresetContent.hidden = !expanded;
    };

    const getEditingLorasData = () => {
        if (nodeInstance.activeEditingLoraName) {
            const loraData = getLoraMetadataByName(nodeInstance.activeEditingLoraName);
            if (loraData) {
                return [{
                    name: loraData.name || loraData.lora,
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
                trigger_words: card?.dataset.triggerWords || loraData.trigger_words || "",
                download_url: card?.dataset.downloadUrl || loraData.download_url || "",
                trigger_presets: loraData.trigger_presets || {}
            };
        });
    };
     const renderMetadataEditor = () => {
        const editingLoras = getEditingLorasData();
        selectedCountEl.textContent = editingLoras.length;
        selectedCountEl.hidden = editingLoras.length === 1;
        metadataEditorSelectionLabel.textContent = editingLoras.length === 1 ? "LoRA details" : " selected";
        metadataEditorTitle.textContent = editingLoras.length === 1
            ? editingLoras[0].name.split(/[\\/]/).pop().replace(/\.safetensors$/i, "")
            : `${editingLoras.length} LoRAs selected`;
        const thumbnailEligible = editingLoras.length === 1;
        useLastOutputThumbnailBtn.dataset.selectionEligible = thumbnailEligible ? "true" : "false";
        useLastOutputThumbnailBtn.disabled = (
            !thumbnailEligible
            || !getLastOutput()?.filename
            || thumbnailAssignmentInProgress
        );
        setThumbnailStatus(!thumbnailEligible
            ? "Select one LoRA to change its thumbnail"
            : (getLastOutput()?.filename ? "Use the latest generated image" : "Generate an image first"));
         if (editingLoras.length === 0) {
            metadataEditor.classList.remove("visible");
            return;
        }
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
                const presetEntries = Object.entries(presets);
                triggerPresetCount.textContent = presetEntries.length ? `(${presetEntries.length})` : "";
                if (presetEditorLoraName !== loraName) {
                    presetEditorLoraName = loraName;
                    setPresetEditorExpanded(presetEntries.length > 0);
                }
                for (const [pName, pVal] of presetEntries) {
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

    metadataEditorCloseBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
    });

    triggerPresetToggleBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setPresetEditorExpanded(triggerPresetToggleBtn.getAttribute("aria-expanded") !== "true");
    });

    useLastOutputThumbnailBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const editingLoras = getEditingLorasData();
        const lastOutput = getLastOutput();
        if (editingLoras.length !== 1 || !lastOutput?.filename || thumbnailAssignmentInProgress) return;

        thumbnailAssignmentInProgress = true;
        useLastOutputThumbnailBtn.disabled = true;
        useLastOutputThumbnailBtn.classList.add("loading");
        thumbnailActionLabel.textContent = "Saving";
        setThumbnailStatus("Saving thumbnail...", { visible: true });
        try {
            const loraName = editingLoras[0].name;
            const result = await assignThumbnail(loraName, lastOutput);
            updateCachedLoraMetadata(loraName, {
                preview_url: result.preview_url,
                preview_type: result.preview_type,
            });
            useLastOutputThumbnailBtn.classList.add("success");
            setThumbnailStatus("Thumbnail updated", { visible: true });
            clearTimeout(thumbnailFeedbackTimer);
            thumbnailFeedbackTimer = setTimeout(() => {
                useLastOutputThumbnailBtn.classList.remove("success");
                thumbnailActionStatus.classList.remove("is-visible");
            }, 1200);
            await fetchAndRender();
            renderSelectedList();
        } catch (error) {
            console.error("LocalLoraGallery: Failed to assign thumbnail", error);
            setThumbnailStatus(error?.message || "Could not update thumbnail", { visible: true });
        } finally {
            thumbnailAssignmentInProgress = false;
            useLastOutputThumbnailBtn.classList.remove("loading");
            useLastOutputThumbnailBtn.disabled = !getLastOutput()?.filename;
            thumbnailActionLabel.textContent = "Use last result";
        }
    });

    return { getEditingLorasData, renderMetadataEditor };
}
