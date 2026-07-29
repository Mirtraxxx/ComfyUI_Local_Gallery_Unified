import { confirmAction, showAlert } from "../shared/nativeDialogs.js";
import { escapeHtml } from "../shared/dom.js";
import { parseJsonOr, stringifyJsonOr } from "../shared/json.js";
import { bindBackdropClose, createModalSurface } from "../shared/modalSurfaces.js";

function createPresetSurface({ workspaceContainer, onClose }) {
    return createModalSurface({ workspaceContainer, onWorkspaceClose: onClose });
}

function normalizePresetPrompt(presetPrompt) {
    const promptId = presetPrompt.prompt_id || presetPrompt.id;
    return {
        ...presetPrompt,
        id: presetPrompt.id || promptId,
        prompt_id: promptId,
        name: presetPrompt.name || presetPrompt.prompt_text || String(promptId),
        prompt_text: presetPrompt.prompt_text || presetPrompt.name || String(promptId),
        on: presetPrompt.on !== false,
        weight: Number.isFinite(Number(presetPrompt.weight)) ? Number(presetPrompt.weight) : 1
    };
}

async function resolvePresetSelection(galleryNode, presetName, presetData) {
    let presetSelection = Array.isArray(presetData.selection) ? presetData.selection : [];
    const promptNamesToResolve = presetSelection
        .map(prompt => String(prompt.prompt_text || prompt.name || "").trim())
        .filter(Boolean);

    if (!promptNamesToResolve.length) {
        return presetSelection;
    }

    const resolved = await galleryNode.getOrCreatePrompts(promptNamesToResolve);
    if (resolved?.status !== "ok" || !Array.isArray(resolved.prompts)) {
        return presetSelection;
    }

    const resolvedByName = new Map(
        resolved.prompts.map(prompt => [String(prompt.name || prompt.prompt_text || "").trim().toLowerCase(), prompt])
    );
    let repairedPreset = false;

    presetSelection = presetSelection.map(presetPrompt => {
        const lookupName = String(presetPrompt.prompt_text || presetPrompt.name || "").trim().toLowerCase();
        const resolvedPrompt = resolvedByName.get(lookupName);
        if (!resolvedPrompt) {
            return presetPrompt;
        }

        const resolvedId = resolvedPrompt.prompt_id || resolvedPrompt.id;
        if (String(presetPrompt.prompt_id) !== String(resolvedId)) {
            repairedPreset = true;
        }
        return {
            ...presetPrompt,
            id: resolvedId,
            prompt_id: resolvedId,
            name: resolvedPrompt.name || presetPrompt.name || lookupName,
            prompt_text: resolvedPrompt.prompt_text || presetPrompt.prompt_text || presetPrompt.name || lookupName,
            category: resolvedPrompt.category || presetPrompt.category || "Combo"
        };
    });

    if (repairedPreset) {
        galleryNode.savePreset(
            presetName,
            presetSelection,
            presetData.wildcard_mode || "off",
            presetData.wildcard_categories || [],
            presetData.wildcard_auto_attach_thumbnail || "off"
        ).catch(error => console.warn("LocalPromptGallery: Failed to save repaired preset", error));
    }

    return presetSelection;
}

function mergePresetSelection(existingPromptData, presetSelection) {
    const mergedPrompts = Array.isArray(existingPromptData) ? [...existingPromptData] : [];
    const existingById = new Map(
        mergedPrompts.map((prompt, index) => [String(prompt.prompt_id), index])
    );

    for (const presetPrompt of presetSelection) {
        const normalizedPrompt = normalizePresetPrompt(presetPrompt);
        const promptId = String(normalizedPrompt.prompt_id);
        if (existingById.has(promptId)) {
            const index = existingById.get(promptId);
            mergedPrompts[index] = { ...mergedPrompts[index], ...normalizedPrompt };
        } else {
            existingById.set(promptId, mergedPrompts.length);
            mergedPrompts.push(normalizedPrompt);
        }
    }

    return mergedPrompts;
}

async function refreshPromptSurfaces({
    renderPrompts,
    getActiveLibraryTab,
    renderLibraryDrawer,
    app,
}) {
    renderPrompts();
    const activeLibraryTab = getActiveLibraryTab();
    if (activeLibraryTab) {
        await renderLibraryDrawer(activeLibraryTab);
    }
    if (app.graph) {
        app.graph.change();
    }
}

function renderPresetRow({
    preset,
    overlay,
    presetNameInput,
    renderPresetsList,
    loadPreset,
    deletePreset,
}) {
    const row = document.createElement("div");
    row.className = "localprompt-preset-row";

    const selectionCount = preset.selection?.length || 0;
    const categoryCount = preset.wildcard_categories?.length || 0;
    const modeLabel = preset.wildcard_mode === "on" ? "Wildcard" : "Manual";

    row.innerHTML = `
        <div class="localprompt-preset-icon">P</div>
        <div style="flex: 1; min-width: 0;">
            <div style="font-size: 13px; color: #f2f2f2; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(preset.name)}</div>
            <div style="font-size: 10px; color: #8f98a3;">${modeLabel} ${selectionCount} prompts, ${categoryCount} categories</div>
        </div>
        <button class="load-preset-btn localprompt-btn localprompt-preset-load" style="padding: 6px 12px; font-size: 11px;">Load</button>
        <button class="edit-preset-btn localprompt-btn localprompt-preset-edit" style="padding: 6px 12px; font-size: 11px;">Edit</button>
        <button class="delete-preset-btn localprompt-btn localprompt-preset-delete" style="padding: 6px 12px; font-size: 11px;">Delete</button>
    `;

    row.querySelector(".load-preset-btn").addEventListener("click", () => loadPreset(preset, overlay));

    row.querySelector(".edit-preset-btn").addEventListener("click", () => {
        presetNameInput.value = preset.name;
        const promptNames = (preset.selection || []).map(prompt => prompt.name).join(", ");
        const comboPromptsInput = overlay.querySelector("#combo-prompts-input");
        if (comboPromptsInput) {
            comboPromptsInput.value = promptNames;
            comboPromptsInput.focus();
        }

        const comboHeader = overlay.querySelector("#combo-header");
        if (comboHeader) {
            comboHeader.textContent = "Edit Preset Combo";
            comboHeader.style.color = "#aaddff";
        }
        const comboBtn = overlay.querySelector("#create-combo-btn");
        if (comboBtn) comboBtn.textContent = "Update & Load Combo";
    });

    row.querySelector(".delete-preset-btn").addEventListener("click", async () => {
        if (confirmAction(`Delete preset "${preset.name}"?`)) {
            const result = await deletePreset(preset.name);
            if (result.status === "ok") {
                await renderPresetsList();
            } else {
                showAlert("Error: " + result.message);
            }
        }
    });

    return row;
}

export async function showPresetsModal({
    app,
    nodeInstance,
    galleryNode,
    categoriesWidget,
    getCurrentWildcardMode,
    setCurrentWildcardMode,
    saveSelectionData,
    saveWildcardState,
    getWildcardAutoAttachThumbnail,
    saveWildcardAutoAttachState,
    updateWildcardControlsUI,
    renderPrompts,
    getActiveLibraryTab,
    renderLibraryDrawer,
    workspaceContainer = null,
    onClose = null,
    librarySubnavHtml = "",
}) {
    const surface = createPresetSurface({ workspaceContainer, onClose });
    const { root, close, isWorkspace } = surface;
    root.innerHTML = `
        <div class="localprompt-modal${isWorkspace ? " localprompt-workspace-page" : ""}" style="width: 450px;">
            ${isWorkspace ? "" : `<div class="localprompt-modal-header">
                <div class="localprompt-workspace-title">
                    <h3><span class="localprompt-workspace-heading-icon localprompt-workspace-heading-icon--preset" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"></path></svg></span>Presets <span class="localprompt-title-status" aria-hidden="true"></span></h3>
                </div>
                <button class="localprompt-modal-close" title="Close">x</button>
            </div>`}
            ${isWorkspace ? librarySubnavHtml : ""}
            <div class="${isWorkspace ? "localprompt-workspace-body" : "localprompt-modal-content"}">
                <div class="${isWorkspace ? "localprompt-workspace-section " : ""}localprompt-preset-management" style="margin-bottom: 16px; border-bottom: 1px solid #444; padding-bottom: 12px;">
                    <h4 style="margin: 0 0 8px 0; color: #ddd; font-size: 12px;"><span class="localprompt-section-icon" aria-hidden="true">⌑</span>Preset Management</h4>
                    <div class="localprompt-preset-save-row" style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <input type="text" id="preset-name-input" placeholder="Preset name..." style="flex: 1; padding: 10px 12px; background: #111820; border: 1px solid #3b4652; color: #ddd; border-radius: 7px;">
                        <button id="save-preset-btn" class="localprompt-btn active" style="padding: 10px 16px;">Save Current</button>
                    </div>
                </div>
                <div class="${isWorkspace ? "localprompt-workspace-section " : ""}localprompt-combo-preset" style="margin-bottom: 16px; border-bottom: 1px solid #444; padding-bottom: 12px;">
                    <h4 id="combo-header" style="margin: 0 0 8px 0; color: #ddd; font-size: 12px;"><span class="localprompt-section-icon" aria-hidden="true">✧</span>Combo Preset</h4>
                    <p style="font-size: 10px; color: #aaa; margin: 0 0 8px 0;">Paste comma-separated prompts to automatically create cards and a preset for them.</p>
                    <textarea id="combo-prompts-input" placeholder="e.g. parted bangs, elf, very long hair" style="width: 100%; height: 74px; padding: 10px 12px; background: #111820; border: 1px solid #3b4652; color: #ddd; border-radius: 7px; resize: vertical; margin-bottom: 10px;"></textarea>
                    <button id="create-combo-btn" class="localprompt-btn active" style="width: 100%; padding: 10px;">Create & Load Combo</button>
                </div>
                <div class="${isWorkspace ? "localprompt-workspace-section " : ""}localprompt-saved-presets" style="margin-bottom: 0;">
                    <div class="localprompt-saved-presets-title" style="margin-bottom: 10px; font-size: 13px; color: #e8e8e8; font-weight: 600;"><span class="localprompt-section-icon" aria-hidden="true">▱</span>Saved Presets</div>
                    <div id="presets-list" class="localprompt-presets-list">
                        <div style="color: #666; font-size: 11px; text-align: center; padding: 20px;">Loading...</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const closeBtn = root.querySelector(isWorkspace ? ".localprompt-workspace-back" : ".localprompt-modal-close");
    closeBtn?.addEventListener("click", close);
    if (!isWorkspace) bindBackdropClose(root, close);

    const presetsList = root.querySelector("#presets-list");
    const presetNameInput = root.querySelector("#preset-name-input");
    const savePresetBtn = root.querySelector("#save-preset-btn");
    const comboPromptsInput = root.querySelector("#combo-prompts-input");
    const createComboBtn = root.querySelector("#create-combo-btn");

    const loadPreset = async (preset) => {
        const result = await galleryNode.loadPreset(preset.name);
        if (result.status !== "ok") {
            showAlert("Error loading preset: " + result.message);
            return;
        }

        const presetData = result.preset;
        const presetSelection = await resolvePresetSelection(galleryNode, preset.name, presetData);
        nodeInstance.promptData = mergePresetSelection(nodeInstance.promptData, presetSelection);
        saveSelectionData();

        const nextWildcardMode = presetData.wildcard_mode || "off";
        setCurrentWildcardMode(nextWildcardMode);
        const presetCategoriesValue = stringifyJsonOr(presetData.wildcard_categories || []);
        saveWildcardState(nextWildcardMode, presetCategoriesValue);
        saveWildcardAutoAttachState(presetData.wildcard_auto_attach_thumbnail === "on");
        updateWildcardControlsUI();

        if (categoriesWidget) {
            categoriesWidget.value = presetCategoriesValue;
        }

        await refreshPromptSurfaces({
            renderPrompts,
            getActiveLibraryTab,
            renderLibraryDrawer,
            app,
        });
        close();
    };

    async function renderPresetsList() {
        const presets = await galleryNode.getPresets();

        if (presets.length === 0) {
            presetsList.innerHTML = '<div style="color: #666; font-size: 11px; text-align: center; padding: 20px;">No presets saved yet</div>';
            return;
        }

        presetsList.innerHTML = "";
        presets.forEach(preset => {
            presetsList.appendChild(renderPresetRow({
                preset,
                overlay: root,
                presetNameInput,
                renderPresetsList,
                loadPreset,
                deletePreset: name => galleryNode.deletePreset(name),
            }));
        });
    }

    savePresetBtn.addEventListener("click", async () => {
        const name = presetNameInput.value.trim();
        if (!name) {
            showAlert("Please enter a preset name");
            return;
        }

        const selection = nodeInstance.promptData || [];
        const wildcardMode = getCurrentWildcardMode() || "off";
        const wildcardCategories = parseJsonOr(categoriesWidget?.value || "[]", []);
        const wildcardAutoAttachThumbnail = getWildcardAutoAttachThumbnail?.() ? "on" : "off";

        const result = await galleryNode.savePreset(name, selection, wildcardMode, wildcardCategories, wildcardAutoAttachThumbnail);
        if (result.status === "ok") {
            presetNameInput.value = "";
            await renderPresetsList();
            showAlert(`Preset "${name}" saved!`);
        } else {
            showAlert("Error: " + result.message);
        }
    });

    createComboBtn.addEventListener("click", async () => {
        const name = presetNameInput.value.trim();
        if (!name) {
            showAlert("Please enter a preset name in the field above.");
            return;
        }

        const promptsText = comboPromptsInput.value;
        if (!promptsText.trim()) {
            showAlert("Please paste some comma-separated prompts.");
            return;
        }

        const prompts = promptsText.split(",").map(text => text.trim()).filter(Boolean);
        if (prompts.length === 0) return;

        createComboBtn.textContent = "Generating...";
        createComboBtn.disabled = true;

        try {
            const result = await galleryNode.getOrCreatePrompts(prompts);
            if (result.status !== "ok" || !result.prompts) {
                showAlert("Error processing prompts: " + result.message);
                return;
            }

            const newSelectionParams = result.prompts.map(prompt => ({
                id: prompt.id || prompt.prompt_id,
                prompt_id: prompt.prompt_id || prompt.id,
                name: prompt.name,
                prompt_text: prompt.prompt_text || prompt.name,
                category: prompt.category || "Combo",
                on: true,
                weight: 1.0
            }));

            const existingIds = new Set(nodeInstance.promptData.map(prompt => String(prompt.prompt_id)));
            const filteredNewPrompts = newSelectionParams.filter(prompt => !existingIds.has(String(prompt.prompt_id)));

            nodeInstance.promptData = [...nodeInstance.promptData, ...filteredNewPrompts];
            saveSelectionData();

            const saveResult = await galleryNode.savePreset(name, newSelectionParams, "off", []);
            if (saveResult.status === "ok") {
                showAlert(`Combo Preset created and loaded: ${prompts.length} prompts`);
                presetNameInput.value = "";
                comboPromptsInput.value = "";

                const comboHeader = root.querySelector("#combo-header");
                if (comboHeader) {
                    comboHeader.textContent = "Combo Preset";
                    comboHeader.style.color = "#ddd";
                }
                createComboBtn.textContent = "Create & Load Combo";

                await renderPresetsList();
                await refreshPromptSurfaces({
                    renderPrompts,
                    getActiveLibraryTab,
                    renderLibraryDrawer,
                    app,
                });
            } else {
                showAlert("Error saving combo preset: " + saveResult.message);
            }
        } catch (error) {
            showAlert("Error: " + error.message);
        } finally {
            createComboBtn.textContent = "Create & Load Combo";
            createComboBtn.disabled = false;
        }
    });

    await renderPresetsList();
}
