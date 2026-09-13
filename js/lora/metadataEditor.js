import { LORA_WEIGHT_LIMITS, formatLoraWeight } from "./weights.js";

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
    strengthMemoryRow,
    strengthMemoryEnableInput,
    strengthMemoryModelInput,
    strengthMemoryClipControl,
    strengthMemoryClipInput,
    getLoraMetadataByName,
    updateCachedLoraMetadata,
    findGalleryCardByLoraName,
    updateMetadata,
    getLastOutput,
    assignThumbnail,
    renderCurrentView,
    renderSelectedList,
    updateSelection,
    operationFeedback = null,
    onClose,
}) {
    let thumbnailAssignmentInProgress = false;
    let thumbnailFeedbackTimer = null;
    let presetEditorLoraName = null;
    const EMPTY_PREVIEW_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    const updateVisibleGalleryPreview = (loraName, previewUrl, previewType) => {
        const card = findGalleryCardByLoraName(loraName);
        const mediaContainer = card?.querySelector(".locallora-media-container");
        if (!mediaContainer) return;

        const hasVideoPreview = previewType === "video" && Boolean(previewUrl);
        const media = document.createElement(hasVideoPreview ? "video" : "img");
        media.src = previewUrl || EMPTY_PREVIEW_IMAGE;
        if (hasVideoPreview) {
            media.muted = true;
            media.loop = true;
            media.playsInline = true;
            media.preload = "metadata";
        } else {
            media.loading = "lazy";
        }
        mediaContainer.replaceChildren(media);
    };

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

    const clampWeight = (value, min, max) => Math.min(max, Math.max(min, value));

    const parseWeightInput = (input, fallback) => {
        const parsed = Number.parseFloat(input.value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const getActiveSelectionItem = (loraName) => (
        nodeInstance.loraData.find(entry => entry.lora === loraName)
    );

    const renderStrengthMemoryRow = (singleLora) => {
        const loraSource = getLoraMetadataByName(singleLora.name);
        const remembered = Boolean(loraSource?.remember_strength);
        const liveItem = remembered ? getActiveSelectionItem(singleLora.name) : null;
        strengthMemoryEnableInput.checked = remembered;
        const modelValue = liveItem
            ? liveItem.strength ?? 1
            : loraSource?.saved_strength ?? 1;
        const clipValue = liveItem
            ? liveItem.strength_clip ?? liveItem.strength ?? 1
            : loraSource?.saved_strength_clip ?? loraSource?.saved_strength ?? 1;
        strengthMemoryModelInput.value = formatLoraWeight(modelValue);
        strengthMemoryClipInput.value = formatLoraWeight(clipValue);
        strengthMemoryModelInput.disabled = !remembered;
        strengthMemoryClipInput.disabled = !remembered;
        strengthMemoryClipControl.hidden = nodeInstance.isModelOnly;
        strengthMemoryRow.style.display = "flex";
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
            renderStrengthMemoryRow(singleLora);

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
                        rmBtn.disabled = true;
                        operationFeedback?.pending(`Removing preset "${pName}"...`);
                        try {
                            await updateMetadata(loraName, { trigger_presets: newPresets });
                            updateCachedLoraMetadata(loraName, { trigger_presets: newPresets });
                            renderPresetsList();
                            renderCurrentView();
                            renderSelectedList();
                            operationFeedback?.success(`Preset "${pName}" removed`);
                        } catch (error) {
                            operationFeedback?.error(error?.message || "Could not remove trigger preset");
                        } finally {
                            rmBtn.disabled = false;
                        }
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
            strengthMemoryRow.style.display = "none";
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

    strengthMemoryEnableInput.addEventListener("change", async () => {
        const editingLoras = getEditingLorasData();
        if (editingLoras.length !== 1) return;
        const singleLora = editingLoras[0];
        const loraName = singleLora.name;
        const enable = strengthMemoryEnableInput.checked;
        const loraSource = getLoraMetadataByName(loraName);
        const activeItem = getActiveSelectionItem(loraName);
        const payload = { remember_strength: enable };
        if (enable) {
            payload.saved_strength = clampWeight(
                activeItem
                    ? activeItem.strength ?? 1
                    : parseWeightInput(strengthMemoryModelInput, loraSource?.saved_strength ?? 1),
                LORA_WEIGHT_LIMITS.modelMin,
                LORA_WEIGHT_LIMITS.modelMax,
            );
            payload.saved_strength_clip = clampWeight(
                activeItem
                    ? activeItem.strength_clip ?? activeItem.strength ?? 1
                    : parseWeightInput(strengthMemoryClipInput, loraSource?.saved_strength_clip ?? loraSource?.saved_strength ?? 1),
                LORA_WEIGHT_LIMITS.clipMin,
                LORA_WEIGHT_LIMITS.clipMax,
            );
        }
        strengthMemoryEnableInput.disabled = true;
        try {
            await updateMetadata(loraName, payload);
            updateCachedLoraMetadata(loraName, payload);
            operationFeedback?.success(enable
                ? "Remembering strengths for this LoRA"
                : "Stopped remembering strengths for this LoRA");
        } catch (error) {
            strengthMemoryEnableInput.checked = !enable;
            operationFeedback?.error(error?.message || "Could not update strength memory");
        } finally {
            strengthMemoryEnableInput.disabled = false;
            renderStrengthMemoryRow(singleLora);
        }
    });

    const commitStrengthMemoryEdits = async () => {
        const editingLoras = getEditingLorasData();
        if (editingLoras.length !== 1) return;
        const singleLora = editingLoras[0];
        const loraName = singleLora.name;
        const loraSource = getLoraMetadataByName(loraName);
        const savedModel = loraSource?.saved_strength ?? 1;
        const savedClip = loraSource?.saved_strength_clip ?? savedModel;
        const model = clampWeight(
            parseWeightInput(strengthMemoryModelInput, savedModel),
            LORA_WEIGHT_LIMITS.modelMin,
            LORA_WEIGHT_LIMITS.modelMax,
        );
        const clip = clampWeight(
            parseWeightInput(strengthMemoryClipInput, savedClip),
            LORA_WEIGHT_LIMITS.clipMin,
            LORA_WEIGHT_LIMITS.clipMax,
        );
        const payload = { saved_strength: model, saved_strength_clip: clip };
        const activeItem = getActiveSelectionItem(loraName);
        if (strengthMemoryEnableInput.checked && activeItem) {
            activeItem.strength = model;
            if (!nodeInstance.isModelOnly) activeItem.strength_clip = clip;
            renderSelectedList();
            updateSelection();
        }
        try {
            await updateMetadata(loraName, payload);
            updateCachedLoraMetadata(loraName, payload);
        } catch (error) {
            operationFeedback?.error(error?.message || "Could not save remembered strengths");
        } finally {
            renderStrengthMemoryRow(singleLora);
        }
    };

    strengthMemoryModelInput.addEventListener("change", commitStrengthMemoryEdits);
    strengthMemoryClipInput.addEventListener("change", commitStrengthMemoryEdits);

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
        operationFeedback?.pending("Saving LoRA thumbnail...");
        try {
            const loraName = editingLoras[0].name;
            const result = await assignThumbnail(loraName, lastOutput);
            updateCachedLoraMetadata(loraName, {
                preview_url: result.preview_url,
                preview_type: result.preview_type,
            });
            updateVisibleGalleryPreview(loraName, result.preview_url, result.preview_type);
            useLastOutputThumbnailBtn.classList.add("success");
            setThumbnailStatus("Thumbnail updated", { visible: true });
            operationFeedback?.success("LoRA thumbnail saved to gallery");
            clearTimeout(thumbnailFeedbackTimer);
            thumbnailFeedbackTimer = setTimeout(() => {
                useLastOutputThumbnailBtn.classList.remove("success");
                thumbnailActionStatus.classList.remove("is-visible");
            }, 1200);
            renderSelectedList();
        } catch (error) {
            console.error("LocalLoraGallery: Failed to assign thumbnail", error);
            setThumbnailStatus(error?.message || "Could not update thumbnail", { visible: true });
            operationFeedback?.error(error?.message || "Could not update LoRA thumbnail");
        } finally {
            thumbnailAssignmentInProgress = false;
            useLastOutputThumbnailBtn.classList.remove("loading");
            useLastOutputThumbnailBtn.disabled = !getLastOutput()?.filename;
            thumbnailActionLabel.textContent = "Use last result";
        }
    });

    return { getEditingLorasData, renderMetadataEditor };
}
