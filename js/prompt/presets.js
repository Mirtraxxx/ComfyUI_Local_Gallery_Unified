import { confirmAction, showAlert } from "../shared/nativeDialogs.js";
import { escapeHtml } from "../shared/dom.js";
import { parseJsonOr, stringifyJsonOr } from "../shared/json.js";
import { createModalSurface } from "../shared/modalSurfaces.js";

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

    // Entries with a stored prompt_id are already resolved. Only id-less
    // entries go through get-or-create, looked up by card name (not the
    // full prompt body, which metadata saves leave in prompt_text).
    const hasStoredId = prompt => Boolean(String(prompt.prompt_id || prompt.id || "").trim());
    const missingIds = presetSelection.filter(prompt => !hasStoredId(prompt));
    if (!missingIds.length) {
        return presetSelection;
    }

    const promptNamesToResolve = missingIds
        .map(prompt => String(prompt.name || prompt.prompt_text || "").trim())
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
        if (hasStoredId(presetPrompt)) {
            return presetPrompt;
        }
        const lookupName = String(presetPrompt.name || presetPrompt.prompt_text || "").trim().toLowerCase();
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
    operationFeedback = null,
}) {
    const row = document.createElement("div");
    row.className = "localprompt-preset-row";

    const selectionCount = preset.selection?.length || 0;
    const categoryCount = preset.wildcard_categories?.length || 0;
    const modeLabel = preset.wildcard_mode === "on" ? "Wildcard" : "Manual";

    row.innerHTML = `
        <div class="localprompt-preset-info">
            <div class="localprompt-preset-name">${escapeHtml(preset.name)}</div>
            <div class="lg-note">${modeLabel} · ${selectionCount} prompts · ${categoryCount} categories</div>
        </div>
        <button class="lg-text-btn load-preset-btn" type="button">Load</button>
        <button class="lg-text-btn edit-preset-btn" type="button">Edit</button>
        <button class="lg-text-btn danger delete-preset-btn" type="button">Delete</button>
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
        if (comboHeader) comboHeader.textContent = "Edit preset from prompt list";
        const comboBtn = overlay.querySelector("#create-combo-btn");
        if (comboBtn) comboBtn.textContent = "Update & load";
    });

    row.querySelector(".delete-preset-btn").addEventListener("click", async () => {
        if (confirmAction(`Delete preset "${preset.name}"?`)) {
            operationFeedback?.pending("Deleting Prompt preset...");
            let deleted = false;
            try {
                const result = await deletePreset(preset.name);
                if (!result || result.status !== "ok") {
                    throw new Error(result?.message || "Could not delete preset");
                }
                deleted = true;
                await renderPresetsList();
                operationFeedback?.success(`Preset "${preset.name}" deleted`);
            } catch (error) {
                if (deleted) {
                    operationFeedback?.warning(`Preset "${preset.name}" deleted. Preset list refresh failed.`);
                } else {
                    operationFeedback?.error(error?.message || "Could not delete preset");
                    showAlert("Error: " + (error?.message || "Could not delete preset"));
                }
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
    operationFeedback = null,
    workspaceContainer = null,
    onClose = null,
    librarySubnavHtml = "",
}) {
    const { root, close } = createPresetSurface({ workspaceContainer, onClose });
    root.innerHTML = `
        <div class="localprompt-modal localprompt-workspace-page">
            ${librarySubnavHtml}
            <div class="localprompt-workspace-body">
                <section class="localprompt-workspace-section lg-form">
                    <h4>New preset</h4>
                    <label class="lg-field">Preset name
                        <input class="lg-input" type="text" id="preset-name-input" placeholder="e.g. Portrait base">
                    </label>
                    <div class="lg-actions">
                        <button class="lg-text-btn primary" id="save-preset-btn" type="button">Save current stack</button>
                    </div>
                </section>
                <section class="localprompt-workspace-section lg-form">
                    <h4 id="combo-header">From a prompt list</h4>
                    <p class="lg-note">Paste comma-separated prompts. Missing cards are created, then the list is saved under the name above and loaded.</p>
                    <textarea class="lg-input" id="combo-prompts-input" rows="3" placeholder="e.g. parted bangs, elf, very long hair"></textarea>
                    <div class="lg-actions">
                        <button class="lg-text-btn" id="create-combo-btn" type="button">Create & load</button>
                    </div>
                </section>
                <section class="localprompt-workspace-section lg-form">
                    <h4>Saved presets</h4>
                    <div id="presets-list" class="localprompt-presets-list">
                        <p class="lg-empty">Loading...</p>
                    </div>
                </section>
            </div>
        </div>
    `;

    const presetsList = root.querySelector("#presets-list");
    const presetNameInput = root.querySelector("#preset-name-input");
    const savePresetBtn = root.querySelector("#save-preset-btn");
    const comboPromptsInput = root.querySelector("#combo-prompts-input");
    const createComboBtn = root.querySelector("#create-combo-btn");

    const loadPreset = async (preset) => {
        operationFeedback?.pending(`Loading preset "${preset.name}"...`);
        let presetData;
        let presetSelection;
        try {
            const result = await galleryNode.loadPreset(preset.name);
            if (!result || result.status !== "ok") {
                throw new Error(result?.message || "Could not load preset");
            }
            presetData = result.preset;
            presetSelection = await resolvePresetSelection(galleryNode, preset.name, presetData);
        } catch (error) {
            const message = error?.message || "Could not load preset";
            operationFeedback?.error(message);
            showAlert("Error loading preset: " + message);
            return;
        }

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

        try {
            await refreshPromptSurfaces({
                renderPrompts,
                getActiveLibraryTab,
                renderLibraryDrawer,
                app,
            });
            operationFeedback?.success(`Preset "${preset.name}" applied to workflow`);
        } catch (error) {
            operationFeedback?.warning(`Preset "${preset.name}" applied. View refresh failed.`);
        }
        close();
    };

    async function renderPresetsList() {
        const presets = await galleryNode.getPresets();

        if (presets.length === 0) {
            presetsList.innerHTML = '<p class="lg-empty">No presets saved yet.</p>';
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
                operationFeedback,
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

        operationFeedback?.pending(`Saving preset "${name}"...`);
        try {
            const result = await galleryNode.savePreset(name, selection, wildcardMode, wildcardCategories, wildcardAutoAttachThumbnail);
            if (result.status !== "ok") {
                throw new Error(result?.message || "Could not save preset");
            }
            presetNameInput.value = "";
            operationFeedback?.success(`Preset "${name}" saved to gallery`);
            try {
                await renderPresetsList();
            } catch (error) {
                operationFeedback?.warning(`Preset "${name}" saved. Preset list refresh failed.`);
            }
        } catch (error) {
            operationFeedback?.error(error?.message || "Could not save preset");
            showAlert("Error: " + (error?.message || "Could not save preset"));
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
        operationFeedback?.pending("Creating Prompt combo preset...");

        let comboApplied = false;
        let comboSaved = false;
        try {
            const result = await galleryNode.getOrCreatePrompts(prompts);
            if (result.status !== "ok" || !result.prompts) {
                operationFeedback?.error(result?.message || "Could not prepare combo preset");
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
            comboApplied = true;

            const saveResult = await galleryNode.savePreset(name, newSelectionParams, "off", []);
            if (saveResult.status === "ok") {
                comboSaved = true;
                operationFeedback?.success(`Combo preset applied with ${prompts.length} prompts`);
                presetNameInput.value = "";
                comboPromptsInput.value = "";

                const comboHeader = root.querySelector("#combo-header");
                if (comboHeader) comboHeader.textContent = "From a prompt list";

                try {
                    await renderPresetsList();
                    await refreshPromptSurfaces({
                        renderPrompts,
                        getActiveLibraryTab,
                        renderLibraryDrawer,
                        app,
                    });
                } catch (refreshError) {
                    operationFeedback?.warning("Combo preset saved and applied. View refresh failed.");
                }
            } else {
                operationFeedback?.warning("Combo prompts applied, but the preset was not saved.");
                showAlert("Preset was not saved: " + (saveResult?.message || "Unknown error"));
            }
        } catch (error) {
            if (comboSaved) {
                operationFeedback?.warning("Combo preset saved and applied. View refresh failed.");
            } else if (comboApplied) {
                operationFeedback?.warning("Combo prompts applied, but the preset was not saved.");
                showAlert("Preset was not saved: " + error.message);
            } else {
                operationFeedback?.error(error?.message || "Could not create combo preset");
                showAlert("Error: " + error.message);
            }
        } finally {
            createComboBtn.textContent = "Create & load";
            createComboBtn.disabled = false;
        }
    });

    try {
        await renderPresetsList();
    } catch (error) {
        operationFeedback?.error(error?.message || "Could not load Prompt presets");
    }
}
