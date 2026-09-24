import { showAlert } from "../shared/nativeDialogs.js";
import { escapeHtml } from "../shared/dom.js";
import {
    createCenteredOverlay,
    createDialogPanel,
    createWorkspaceDialogSurface,
} from "../shared/modalSurfaces.js";
import {
    buildLastOutputPreviewUrl,
    extractPromptTextFromSourceNode,
    normalizePromptText,
} from "./helpers.js";

async function populateCategoryDatalist(galleryNode, datalist) {
    if (!datalist) return;
    try {
        const categories = await galleryNode.getCategories();
        if (Array.isArray(categories)) {
            categories.forEach(category => {
                const option = document.createElement("option");
                option.value = category;
                datalist.appendChild(option);
            });
        }
    } catch (error) {
        console.error("LocalPromptGallery: Failed to load categories:", error);
    }
}

const FROM_LAST_OUTPUT_NEW_CATEGORY = "__new_category__";

export async function showFromLastOutputDialog({
    galleryNode,
    nodeInstance,
    getPromptSourceNode = null,
    insertPromptIntoCurrentGallery = null,
    loadPromptsForGallery = null,
    loadCategories = null,
    refreshAllSections = null,
    onRefresh = null,
    operationFeedback = null,
    workspaceContainer = null,
    onClose = null,
}) {
    return await showAddPromptDialog({
        galleryNode,
        nodeInstance,
        getPromptSourceNode,
        insertPromptIntoCurrentGallery,
        loadPromptsForGallery,
        loadCategories,
        refreshAllSections,
        onRefresh,
        operationFeedback,
        workspaceContainer,
        onClose,
        initialTab: "from_last_output",
    });
}

export async function showAddPromptDialog({
    galleryNode,
    nodeInstance,
    getPromptSourceNode = null,
    insertPromptIntoCurrentGallery = null,
    loadPromptsForGallery = null,
    loadCategories = null,
    refreshAllSections = null,
    onRefresh = null,
    operationFeedback = null,
    workspaceContainer = null,
    onClose = null,
    initialTab = "direct",
}) {
    try {
        const categories = (await galleryNode?.getCategories?.()) || [];
        const sourceNode = typeof getPromptSourceNode === "function" ? getPromptSourceNode() : null;
        const capturedPromptText = sourceNode ? normalizePromptText(extractPromptTextFromSourceNode(sourceNode)) : "";
        const hasLastOutput = Boolean(galleryNode?.lastOutput?.filename);
        const defaultNameMode = nodeInstance?.uiPrefs?.from_last_output_name_default === "blank" ? "blank" : "time";
        const timeCardName = `Last Output ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
        const defaultOutputCardName = defaultNameMode === "blank" ? "" : timeCardName;
        const previewUrl = hasLastOutput ? buildLastOutputPreviewUrl(galleryNode.lastOutput) : "";
        const activeTab = initialTab === "from_last_output" ? "from_last_output" : "direct";

        const { dialog, close, isWorkspace } = createWorkspaceDialogSurface({
            workspaceContainer,
            onClose,
            width: 560,
        });

        if (isWorkspace) {
            dialog.classList.add("localprompt-from-output-page", "localprompt-add-prompt-page");
        } else {
            dialog.classList.add("localprompt-add-prompt-dialog");
            dialog.style.padding = "16px";
        }

        const categoryOptions = ['<option value="">Uncategorized</option>']
            .concat(categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`))
            .concat([`<option value="${FROM_LAST_OUTPUT_NEW_CATEGORY}">+ New category…</option>`])
            .join("");

        dialog.innerHTML = `
            <div class="${isWorkspace ? "localprompt-workspace-header" : "localprompt-modal-header"}" style="${isWorkspace ? "" : "margin: -16px -16px 12px;"}">
                <div class="localprompt-workspace-title">
                    <h3>Add New Prompt</h3>
                    ${isWorkspace ? "<p>Add a new prompt card directly or capture from the latest generated output.</p>" : ""}
                </div>
                ${isWorkspace ? "" : '<button class="localprompt-modal-close" title="Close">x</button>'}
            </div>
            <nav class="localprompt-library-subnav localprompt-add-prompt-tabs" aria-label="Add prompt sections" style="margin-bottom: 12px; padding: 0;">
                <button class="localprompt-library-subnav-item${activeTab === "direct" ? " active" : ""}" data-add-tab="direct" type="button">New Prompt</button>
                <button class="localprompt-library-subnav-item${activeTab === "from_last_output" ? " active" : ""}" data-add-tab="from_last_output" type="button">From Last Output</button>
            </nav>
            <div id="add-prompt-direct-panel" class="${isWorkspace ? "localprompt-workspace-body" : ""}" style="${activeTab === "direct" ? "" : "display: none;"}">
                <div class="${isWorkspace ? "localprompt-workspace-section" : ""}" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div style="min-width: 0;">
                        <label style="display: block; margin-bottom: 4px; color: #ddd; font-size: 12px;">Card Name</label>
                        <input type="text" id="new-prompt-name" placeholder="e.g. Cinematic Lighting" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;">
                    </div>
                    <div style="min-width: 0;">
                        <label style="display: block; margin-bottom: 4px; color: #ddd; font-size: 12px;">Category</label>
                        <select id="new-prompt-category" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;">
                            ${categoryOptions}
                        </select>
                    </div>
                </div>
                <div id="new-prompt-new-category-row" hidden style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 4px; color: #ddd; font-size: 12px;" for="new-prompt-new-category">New category name</label>
                    <input type="text" id="new-prompt-new-category" maxlength="80" placeholder="e.g. Lighting" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;">
                </div>
                <div class="${isWorkspace ? "localprompt-workspace-section" : ""}" style="margin-bottom: 8px;">
                    <label style="display: block; margin-bottom: 4px; color: #ddd; font-size: 12px;">Prompt Text</label>
                    <textarea id="new-prompt-text" rows="8" placeholder="The actual prompt text..." style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box; resize: vertical;"></textarea>
                </div>
                <div class="${isWorkspace ? "localprompt-workspace-footer" : ""}" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: ${isWorkspace ? "0" : "16px"};">
                    <button id="new-prompt-cancel" style="padding: 8px 16px; background: #3a3a3a; color: #ddd; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="new-prompt-save" style="padding: 8px 16px; background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; border-radius: 4px; cursor: pointer;">Create Prompt</button>
                </div>
            </div>
            <div id="add-prompt-output-panel" class="${isWorkspace ? "localprompt-workspace-body" : ""}" style="${activeTab === "from_last_output" ? "" : "display: none;"}">
                ${!hasLastOutput ? `
                    <div class="${isWorkspace ? "localprompt-workspace-section" : ""}" style="padding: 20px; background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 6px; text-align: center; color: #aaa; font-size: 12px; margin-bottom: 12px;">
                        <p style="margin: 0 0 6px; font-weight: bold; color: #ddd; font-size: 13px;">No Previous Output Found</p>
                        <p style="margin: 0;">Run a generation in ComfyUI first to capture the generated image thumbnail and prompt text, or use the <strong>New Prompt</strong> tab above to write a prompt directly.</p>
                    </div>
                ` : !sourceNode ? `
                    <div class="${isWorkspace ? "localprompt-workspace-section" : ""}" style="padding: 20px; background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 6px; text-align: center; color: #aaa; font-size: 12px; margin-bottom: 12px;">
                        <p style="margin: 0 0 6px; font-weight: bold; color: #ddd; font-size: 13px;">No Prompt Source Selected</p>
                        <p style="margin: 0;">Select your Show Text node first in ComfyUI and click Pick Prompt Source, or use the <strong>New Prompt</strong> tab above.</p>
                    </div>
                ` : `
                <div class="${isWorkspace ? "localprompt-workspace-section localprompt-from-output-details" : ""}" style="display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 14px; align-items: flex-start; margin-bottom: 12px;">
                    <div class="localprompt-from-output-preview-wrap" style="width: 104px;">
                        <div class="localprompt-from-output-preview" style="width: 104px; height: 104px; border-radius: 6px; overflow: hidden; border: 1px solid #555; background: #1a1a1a;">
                            <img src="${escapeHtml(previewUrl)}" alt="Last output preview" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                        </div>
                    </div>
                    <div class="localprompt-from-output-fields" style="min-width: 0;">
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; margin-bottom: 4px; color: #ddd; font-size: 12px;">Card Name</label>
                            <input type="text" id="from-last-output-name" value="${escapeHtml(defaultOutputCardName)}" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end;">
                            <div style="min-width: 0;">
                                <label style="display: block; margin-bottom: 4px; color: #ddd; font-size: 12px;">Name Default</label>
                                <select id="from-last-output-name-default" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;">
                                    <option value="time" ${defaultNameMode === "time" ? "selected" : ""}>Time</option>
                                    <option value="blank" ${defaultNameMode === "blank" ? "selected" : ""}>Blank</option>
                                </select>
                            </div>
                            <div style="min-width: 0;">
                                <label style="display: block; margin-bottom: 4px; color: #ddd; font-size: 12px;">Category</label>
                                <select id="from-last-output-category" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;">
                                    ${categoryOptions}
                                </select>
                            </div>
                        </div>
                        <div id="from-last-output-new-category-row" hidden style="margin-top: 10px;">
                            <label style="display: block; margin-bottom: 4px; color: #ddd; font-size: 12px;" for="from-last-output-new-category">New category name</label>
                            <input type="text" id="from-last-output-new-category" maxlength="80" placeholder="e.g. Lighting" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;">
                        </div>
                    </div>
                </div>
                <div class="${isWorkspace ? "localprompt-workspace-section localprompt-from-output-prompt-section" : ""}" style="margin-bottom: 8px;">
                    <label style="display: block; margin-bottom: 4px; color: #ddd; font-size: 12px;">Prompt Text</label>
                    <textarea id="from-last-output-prompt" rows="8" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box; resize: vertical;"></textarea>
                    <div class="localprompt-from-output-source" style="min-height: 16px; color: #999; font-size: 11px; margin-top: 8px;">
                        Using prompt source: ${escapeHtml(sourceNode?.title || sourceNode?.type || `Node ${sourceNode?.id || ""}`)}
                    </div>
                </div>
                `}
                <div class="${isWorkspace ? "localprompt-workspace-footer" : ""}" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: ${isWorkspace ? "0" : "16px"};">
                    <button id="from-last-output-cancel" style="padding: 8px 16px; background: #3a3a3a; color: #ddd; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Cancel</button>
                    ${hasLastOutput && sourceNode ? `<button id="from-last-output-save" style="padding: 8px 16px; background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; border-radius: 4px; cursor: pointer;">Save</button>` : ""}
                </div>
            </div>
        `;

        // Direct tab elements
        const directNameInput = dialog.querySelector("#new-prompt-name");
        const directCategorySelect = dialog.querySelector("#new-prompt-category");
        const directNewCategoryRow = dialog.querySelector("#new-prompt-new-category-row");
        const directNewCategoryInput = dialog.querySelector("#new-prompt-new-category");
        const directTextInput = dialog.querySelector("#new-prompt-text");
        const directCancelBtn = dialog.querySelector("#new-prompt-cancel");
        const directSaveBtn = dialog.querySelector("#new-prompt-save");

        function isDirectNewCategory() {
            return directCategorySelect?.value === FROM_LAST_OUTPUT_NEW_CATEGORY;
        }

        function getDirectCategory() {
            if (isDirectNewCategory()) return directNewCategoryInput?.value.trim() || "";
            return directCategorySelect?.value || "";
        }

        function updateDirectNewCategoryRow() {
            const isNew = isDirectNewCategory();
            if (directNewCategoryRow) directNewCategoryRow.hidden = !isNew;
            if (isNew) directNewCategoryInput?.focus();
        }

        const lastCreated = nodeInstance?.uiPrefs?.last_created_category;
        if (lastCreated && categories.includes(lastCreated)) {
            if (directCategorySelect) directCategorySelect.value = lastCreated;
        }
        updateDirectNewCategoryRow();
        directCategorySelect?.addEventListener("change", updateDirectNewCategoryRow);

        // Output tab elements
        const outputNameInput = dialog.querySelector("#from-last-output-name");
        const outputNameDefaultSelect = dialog.querySelector("#from-last-output-name-default");
        const outputCategorySelect = dialog.querySelector("#from-last-output-category");
        const outputNewCategoryRow = dialog.querySelector("#from-last-output-new-category-row");
        const outputNewCategoryInput = dialog.querySelector("#from-last-output-new-category");
        const outputPromptTextarea = dialog.querySelector("#from-last-output-prompt");
        const outputCancelBtn = dialog.querySelector("#from-last-output-cancel");
        const outputSaveBtn = dialog.querySelector("#from-last-output-save");

        if (outputPromptTextarea) {
            outputPromptTextarea.value = capturedPromptText;
        }

        function isCreatingNewCategory() {
            return outputCategorySelect?.value === FROM_LAST_OUTPUT_NEW_CATEGORY;
        }

        function getSelectedCategory() {
            if (isCreatingNewCategory()) return outputNewCategoryInput?.value.trim() || "";
            return outputCategorySelect?.value || "";
        }

        function updateNewCategoryRow() {
            const isNew = isCreatingNewCategory();
            if (outputNewCategoryRow) outputNewCategoryRow.hidden = !isNew;
            if (isNew) outputNewCategoryInput?.focus();
        }

        if (lastCreated && categories.includes(lastCreated)) {
            if (outputCategorySelect) outputCategorySelect.value = lastCreated;
        }
        updateNewCategoryRow();
        outputCategorySelect?.addEventListener("change", updateNewCategoryRow);

        // Tab switching
        const tabBtns = dialog.querySelectorAll("[data-add-tab]");
        const directPanel = dialog.querySelector("#add-prompt-direct-panel");
        const outputPanel = dialog.querySelector("#add-prompt-output-panel");

        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.dataset.addTab;
                tabBtns.forEach(b => b.classList.toggle("active", b === btn));
                if (directPanel) directPanel.style.display = targetTab === "direct" ? "" : "none";
                if (outputPanel) outputPanel.style.display = targetTab === "from_last_output" ? "" : "none";
            });
        });

        // Close bindings
        dialog.querySelector(isWorkspace ? ".localprompt-workspace-back" : ".localprompt-modal-close")?.addEventListener("click", close);
        directCancelBtn?.addEventListener("click", close);
        outputCancelBtn?.addEventListener("click", close);

        // Name Default Change
        outputNameDefaultSelect?.addEventListener("change", () => {
            const mode = outputNameDefaultSelect.value === "blank" ? "blank" : "time";
            if (nodeInstance?.uiPrefs) {
                nodeInstance.uiPrefs.from_last_output_name_default = mode;
                if (outputNameInput) outputNameInput.value = mode === "blank" ? "" : timeCardName;
                galleryNode?.saveUiPrefs?.(nodeInstance.uiPrefs, nodeInstance).catch(error => {
                    console.warn("LocalPromptGallery: Failed to save from last output name default", error);
                });
            }
        });

        // Direct Save
        directSaveBtn?.addEventListener("click", async () => {
            const promptText = directTextInput?.value.trim() || "";
            const name = directNameInput?.value.trim() || promptText;
            const creatingNew = isDirectNewCategory();
            const category = getDirectCategory();

            if (!promptText && !name) {
                showAlert("Please enter a name or prompt text.");
                directTextInput?.focus();
                return;
            }
            if (creatingNew && !category) {
                showAlert("Enter a name for the new category.");
                directNewCategoryInput?.focus();
                return;
            }

            directSaveBtn.disabled = true;
            directSaveBtn.textContent = "Creating...";
            operationFeedback?.pending("Creating prompt...");

            try {
                const result = await galleryNode.createPrompt(name || promptText, promptText, category);
                if (!result || result.status !== "ok") {
                    throw new Error(result?.message || "Could not create prompt");
                }

                if (nodeInstance?.uiPrefs) {
                    nodeInstance.uiPrefs.last_created_category = category;
                    const prefsResult = await galleryNode.saveUiPrefs(nodeInstance.uiPrefs, nodeInstance);
                    if (prefsResult?.status === "error") {
                        operationFeedback?.warning("Prompt created. Category preference was not saved.");
                    } else {
                        operationFeedback?.success("Prompt saved to gallery");
                    }
                } else {
                    operationFeedback?.success("Prompt saved to gallery");
                }

                close();
                try {
                    await loadCategories?.();
                } catch (catError) {
                    console.warn("LocalPromptGallery: Failed to refresh categories after prompt create", catError);
                }
                try {
                    if (onRefresh) {
                        await onRefresh();
                    } else {
                        if (insertPromptIntoCurrentGallery && result.prompt) {
                            insertPromptIntoCurrentGallery(result.prompt);
                        } else {
                            await loadPromptsForGallery?.(1);
                        }
                        await refreshAllSections?.();
                    }
                } catch (refreshError) {
                    operationFeedback?.warning("Prompt created. View refresh failed.", {
                        details: refreshError?.message,
                    });
                }
            } catch (error) {
                console.error("Error creating prompt:", error);
                operationFeedback?.error(error.message || "Could not create prompt");
                showAlert("Could not create prompt: " + error.message);
                directSaveBtn.disabled = false;
                directSaveBtn.textContent = "Create Prompt";
            }
        });

        // Output Save
        outputSaveBtn?.addEventListener("click", async () => {
            const promptText = outputPromptTextarea?.value.trim() || "";
            const name = outputNameInput?.value.trim() || promptText;
            const creatingNewCategory = isCreatingNewCategory();
            const category = getSelectedCategory();

            if (!promptText) {
                showAlert("Prompt text is empty.");
                return;
            }
            if (creatingNewCategory && !category) {
                showAlert("Enter a name for the new category.");
                outputNewCategoryInput?.focus();
                return;
            }

            outputSaveBtn.disabled = true;
            outputSaveBtn.style.opacity = "0.6";
            outputSaveBtn.textContent = "Saving...";
            operationFeedback?.pending("Creating prompt from last output...");

            try {
                const createResult = await galleryNode.createPromptFromOutput(
                    name,
                    promptText,
                    category,
                    galleryNode.lastOutput
                );
                if (createResult?.status !== "ok") {
                    throw new Error(createResult?.message || "Failed to create prompt");
                }

                if (nodeInstance?.uiPrefs) {
                    nodeInstance.uiPrefs.last_created_category = category;
                    nodeInstance.uiPrefs.from_last_output_name_default = outputNameDefaultSelect?.value === "blank" ? "blank" : "time";
                    try {
                        const prefsResult = await galleryNode.saveUiPrefs(nodeInstance.uiPrefs, nodeInstance);
                        if (prefsResult?.status === "error") {
                            operationFeedback?.warning("Prompt created. Category preference was not saved.");
                        } else {
                            operationFeedback?.success("Prompt and thumbnail saved to gallery");
                        }
                    } catch (preferenceError) {
                        console.warn("LocalPromptGallery: Failed to save last created category", preferenceError);
                        operationFeedback?.warning("Prompt created. Category preference was not saved.");
                    }
                } else {
                    operationFeedback?.success("Prompt and thumbnail saved to gallery");
                }

                close();
                try {
                    await loadCategories?.();
                } catch (error) {
                    console.warn("LocalPromptGallery: Failed to refresh categories after from-last-output create", error);
                    operationFeedback?.warning("Prompt created. Category refresh failed.", {
                        details: error?.message,
                    });
                }
                try {
                    if (onRefresh) {
                        await onRefresh();
                    } else {
                        if (!insertPromptIntoCurrentGallery || !insertPromptIntoCurrentGallery(createResult.prompt)) {
                            await loadPromptsForGallery?.(1);
                        }
                        await refreshAllSections?.();
                    }
                } catch (refreshError) {
                    console.warn("LocalPromptGallery: Failed to refresh gallery after from-last-output create", refreshError);
                    operationFeedback?.warning("Prompt created. View refresh failed.", {
                        details: refreshError?.message,
                    });
                }
            } catch (error) {
                console.error("Error creating prompt from last output:", error);
                operationFeedback?.error(error?.message || "Could not create prompt from last output");
                showAlert(`Error: ${error.message}`);
                outputSaveBtn.disabled = false;
                outputSaveBtn.style.opacity = "1";
                outputSaveBtn.textContent = "Save";
            }
        });
    } catch (error) {
        console.error("Error showing add prompt dialog:", error);
        showAlert("Error opening dialog: " + error.message);
    }
}

export async function showEditPromptDialog({
    prompt,
    galleryNode,
    updateLocalPromptAfterMetadataSave,
    loadCategories,
    loadPromptsForGallery,
    refreshAllSections,
    onRefresh = null,
    operationFeedback = null,
}) {
    const promptId = prompt?.id ?? prompt?.prompt_id;
    if (!promptId) {
        showAlert("This prompt has no saved prompt id, so it cannot be edited.");
        return;
    }

    const overlay = createCenteredOverlay();
    overlay.classList.add("localprompt-edit-prompt-overlay");
    const dialog = document.createElement("div");
    dialog.className = "localprompt-edit-prompt-dialog";

    dialog.innerHTML = `
        <div class="localprompt-edit-prompt-header">
            <div class="localprompt-edit-prompt-title">
                <span class="localprompt-edit-prompt-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                    </svg>
                </span>
                <div>
                    <h3>Edit Prompt</h3>
                    <p>Update card details and prompt text</p>
                </div>
            </div>
            <button id="edit-close-btn" class="localprompt-edit-prompt-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="localprompt-edit-prompt-body">
            <label class="localprompt-edit-prompt-field">
                <span>Name</span>
                <input type="text" id="edit-prompt-name" value="${escapeHtml(prompt.name)}">
            </label>
            <label class="localprompt-edit-prompt-field">
                <span>Category</span>
                <input type="text" id="edit-prompt-category" value="${escapeHtml(prompt.category || "")}" placeholder="e.g., Hair, Clothing, Poses" list="edit-category-datalist">
            </label>
            <datalist id="edit-category-datalist"></datalist>
            <label class="localprompt-edit-prompt-field localprompt-edit-prompt-text-field">
                <span>Prompt Text</span>
                <textarea id="edit-prompt-text" spellcheck="false">${escapeHtml(prompt.prompt_text || "")}</textarea>
            </label>
        </div>
        <div class="localprompt-edit-prompt-footer">
            <div class="localprompt-edit-prompt-status">
                <span class="localprompt-edit-prompt-dot" id="edit-status-dot"></span>
                <span id="edit-status-label">Changes not saved</span>
                <span class="localprompt-edit-prompt-divider"></span>
                <span id="edit-character-count">0 characters</span>
            </div>
            <div class="localprompt-edit-prompt-actions">
                <button id="edit-cancel-btn" class="localprompt-edit-prompt-secondary" type="button">Cancel</button>
                <button id="edit-save-btn" class="localprompt-edit-prompt-primary" type="button">Save</button>
            </div>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    await populateCategoryDatalist(galleryNode, dialog.querySelector("#edit-category-datalist"));

    const nameInput = dialog.querySelector("#edit-prompt-name");
    const textInput = dialog.querySelector("#edit-prompt-text");
    const categoryInput = dialog.querySelector("#edit-prompt-category");
    const closeBtn = dialog.querySelector("#edit-close-btn");
    const cancelBtn = dialog.querySelector("#edit-cancel-btn");
    const saveBtn = dialog.querySelector("#edit-save-btn");
    const statusLabel = dialog.querySelector("#edit-status-label");
    const statusDot = dialog.querySelector("#edit-status-dot");
    const characterCount = dialog.querySelector("#edit-character-count");

    const updateEditStatus = (isDirty = true, message = null) => {
        if (statusLabel) statusLabel.textContent = message || (isDirty ? "Changes not saved" : "Saved to gallery");
        if (statusDot) statusDot.classList.toggle("saved", !isDirty);
        if (characterCount) {
            const count = textInput.value.length;
            characterCount.textContent = `${count} ${count === 1 ? "character" : "characters"}`;
        }
    };
    [nameInput, textInput, categoryInput].forEach(input => {
        input.addEventListener("input", () => updateEditStatus(true));
    });
    updateEditStatus(true);

    closeBtn.addEventListener("click", () => overlay.remove());
    cancelBtn.addEventListener("click", () => overlay.remove());

    saveBtn.addEventListener("click", async () => {
        const nextData = {
            name: nameInput.value.trim(),
            prompt_text: textInput.value.trim(),
            category: categoryInput.value.trim()
        };
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        updateEditStatus(true, "Saving to gallery...");
        operationFeedback?.pending("Saving prompt...");
        try {
            const result = await galleryNode.updateMetadata(promptId, nextData);
            if (result?.status && result.status !== "ok") {
                throw new Error(result.message || "Could not save prompt");
            }
            updateLocalPromptAfterMetadataSave(promptId, result?.prompt || nextData);
            updateEditStatus(false);
            operationFeedback?.success("Prompt saved to gallery");
            overlay.remove();
            try {
                await loadCategories();
                if (onRefresh) {
                    await onRefresh();
                } else {
                    await loadPromptsForGallery(galleryNode.currentPage);
                    await refreshAllSections();
                }
            } catch (refreshError) {
                operationFeedback?.warning("Prompt saved. View refresh failed.", {
                    details: refreshError?.message,
                });
            }
        } catch (error) {
            console.error("LocalPromptGallery: Failed to save prompt", error);
            updateEditStatus(true, error?.message || "Could not save changes");
            operationFeedback?.error(error?.message || "Could not save prompt");
            saveBtn.disabled = false;
            saveBtn.textContent = "Save";
        }
    });
}

export function showUploadThumbnailDialog({
    prompt,
    galleryNode,
    loadPromptsForGallery,
    onRefresh = null,
    operationFeedback = null,
}) {
    const promptId = prompt?.id ?? prompt?.prompt_id;
    if (!promptId) {
        showAlert("This prompt has no saved prompt id, so its thumbnail cannot be updated.");
        return;
    }

    const overlay = createCenteredOverlay();
    const dialog = createDialogPanel(400);

    dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #ddd;">Upload Thumbnail for "${escapeHtml(prompt.name)}"</h3>
        <div style="margin-bottom: 16px;">
            <input type="file" id="thumbnail-file-input" accept="image/*,video/*" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px;">
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="upload-cancel-btn" style="padding: 8px 16px; background: #3a3a3a; color: #ddd; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button id="upload-save-btn" style="padding: 8px 16px; background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; border-radius: 4px; cursor: pointer;">Upload</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const fileInput = dialog.querySelector("#thumbnail-file-input");
    const cancelBtn = dialog.querySelector("#upload-cancel-btn");
    const uploadBtn = dialog.querySelector("#upload-save-btn");

    cancelBtn.addEventListener("click", () => overlay.remove());

    uploadBtn.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) {
            showAlert("Please select a file");
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Uploading...";
        operationFeedback?.pending("Uploading thumbnail...");
        try {
            const result = await galleryNode.uploadThumbnail(promptId, file);
            if (!result || result.status !== "ok") {
                throw new Error(result?.message || "Could not upload thumbnail");
            }
            operationFeedback?.success("Thumbnail saved to gallery");
            overlay.remove();
            try {
                if (onRefresh) {
                    await onRefresh();
                } else {
                    await loadPromptsForGallery(galleryNode.currentPage);
                }
            } catch (refreshError) {
                operationFeedback?.warning("Thumbnail saved. View refresh failed.", {
                    details: refreshError?.message,
                });
            }
        } catch (error) {
            operationFeedback?.error(error?.message || "Could not upload thumbnail");
            showAlert("Could not upload thumbnail: " + (error?.message || "Unknown error"));
            uploadBtn.disabled = false;
            uploadBtn.textContent = "Upload";
        }
    });
}

function sanitizeWildcardFilename(value) {
    return String(value || "")
        .trim()
        .replace(/[<>:"|?*\\]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^\.+|\.+$/g, "");
}

function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    // The download starts asynchronously; revoking in the same turn can
    // abort it. Give the browser a beat before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function updateWildcardTokenPreview(dialog, filenameValue) {
    const preview = dialog.querySelector("#export-wildcard-token");
    if (!preview) return;
    const relPath = sanitizeWildcardFilename(filenameValue);
    preview.textContent = relPath ? `__${relPath}__` : "__filename__";
}

export async function showExportDialog({
    galleryNode,
    initialCategory = "",
    operationFeedback = null,
    workspaceContainer = null,
    surfaceHost = null,
    onClose = null,
    librarySubnavHtml = "",
}) {
    const { dialog, close, isWorkspace } = createWorkspaceDialogSurface({
        workspaceContainer,
        surfaceHost,
        onClose,
        width: 450,
    });

    dialog.innerHTML = `
         ${isWorkspace ? "" : `<div class="localprompt-modal-header" style="margin: -20px -20px 16px;">
             <div class="localprompt-workspace-title">
                 <h3><span class="localprompt-workspace-heading-icon localprompt-workspace-heading-icon--export" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 16V3M8 7l4-4 4 4"></path><path d="M5 12v9h14v-9"></path></svg></span>Export TXT</h3>
             </div>
             <button class="localprompt-modal-close" title="Close">x</button>
         </div>`}
         ${isWorkspace ? librarySubnavHtml : ""}
         <div class="${isWorkspace ? "localprompt-workspace-body" : ""}">
             <div class="${isWorkspace ? "localprompt-workspace-section " : ""}localprompt-export-form" style="margin-bottom: 12px;">
                 <p style="font-size: 11px; color: #aaa; margin: 0 0 12px;">
                     Export one category as a wildcard-style .txt file with one prompt per line.
                 </p>
                 <div style="margin-bottom: 12px;">
                     <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Category</label>
                     <select id="export-category-select" style="width: 100%; padding: 10px; background: #111820; color: #ddd; border: 1px solid #3b4652; border-radius: 7px;"></select>
                 </div>
                 <div style="margin-bottom: 12px;">
                     <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Wildcard Filename</label>
                     <input type="text" id="export-filename-input" placeholder="e.g. MyCategory or Folder/MyCategory" style="width: 100%; padding: 10px; background: #111820; color: #ddd; border: 1px solid #3b4652; border-radius: 7px;">
                     <div style="font-size: 10px; color: #888; margin-top: 4px;">Saved as <code>.txt</code>. Subfolders are supported.</div>
                 </div>
                 <div style="margin-bottom: 12px;">
                     <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Destination</label>
                     <select id="export-destination-select" style="width: 100%; padding: 10px; background: #111820; color: #ddd; border: 1px solid #3b4652; border-radius: 7px;">
                         <option value="comfy">Save to ComfyUI wildcards folder</option>
                         <option value="download">Download .txt file</option>
                     </select>
                 </div>
                 <div class="localprompt-form-note" style="font-size: 11px; color: #999; padding: 10px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 7px;">
                     Wildcard token: <code id="export-wildcard-token">__filename__</code>
                 </div>
             </div>
             <div id="export-status" style="
                 margin: 12px 0;
                 padding: 8px;
                 background: #151515;
                 border: 1px solid #444;
                 border-radius: 4px;
                 min-height: 40px;
                 font-size: 11px;
                 color: #aaa;
                 white-space: pre-wrap;
                 display: none;
             "></div>
         </div>
         <div class="${isWorkspace ? "localprompt-workspace-footer" : ""}" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: ${isWorkspace ? "0" : "16px"};">
             <button id="export-cancel-btn" style="padding: 8px 16px; background: #3a3a3a; color: #ddd; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Cancel</button>
             <button id="export-save-btn" style="padding: 8px 16px; background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; border-radius: 4px; cursor: pointer;">Export</button>
         </div>
     `;

    const categorySelect = dialog.querySelector("#export-category-select");
    const filenameInput = dialog.querySelector("#export-filename-input");
    const destinationSelect = dialog.querySelector("#export-destination-select");
    const cancelBtn = dialog.querySelector("#export-cancel-btn");
    const saveBtn = dialog.querySelector("#export-save-btn");
    const statusDiv = dialog.querySelector("#export-status");

    const categories = await galleryNode.getCategories();
    if (Array.isArray(categories)) {
        categories.forEach(category => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            categorySelect.appendChild(option);
        });
    }

    if (initialCategory && categories?.includes(initialCategory)) {
        categorySelect.value = initialCategory;
        filenameInput.value = sanitizeWildcardFilename(initialCategory);
    }

    const syncFilenameFromCategory = () => {
        if (!filenameInput.value.trim() && categorySelect.value) {
            filenameInput.value = sanitizeWildcardFilename(categorySelect.value);
        }
        updateWildcardTokenPreview(dialog, filenameInput.value || categorySelect.value);
    };

    categorySelect.addEventListener("change", syncFilenameFromCategory);
    filenameInput.addEventListener("input", () => updateWildcardTokenPreview(dialog, filenameInput.value));
    syncFilenameFromCategory();

    const updateStatus = (message, isError = false) => {
        statusDiv.style.display = "block";
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? "#ff6b6b" : "#aaa";
    };

    dialog.querySelector(isWorkspace ? ".localprompt-workspace-back" : ".localprompt-modal-close")?.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
        const category = categorySelect.value.trim();
        const filename = filenameInput.value.trim() || sanitizeWildcardFilename(category);
        const destination = destinationSelect.value;

        if (!category) {
            updateStatus("Please select a category.", true);
            return;
        }

        saveBtn.disabled = true;
        saveBtn.style.opacity = "0.5";

        try {
            updateStatus("Exporting wildcard file...");
            operationFeedback?.pending("Exporting wildcard file...");
            const result = await galleryNode.exportWildcardCategory(category, filename, destination);
            if (result.status !== "ok") {
                throw new Error(result.message || "Export failed");
            }

            if (destination === "download" && result.content) {
                downloadTextFile(result.content, result.filename || `${sanitizeWildcardFilename(category)}.txt`);
            }

            const tokenLine = result.wildcard_token ? `\nWildcard token: ${result.wildcard_token}` : "";
            const pathLine = result.save_path ? `\nSaved to: ${result.save_path}` : "";
            updateStatus((result.message || `Exported ${result.line_count || 0} lines.`) + tokenLine + pathLine);
            operationFeedback?.success(`Exported ${Number(result.line_count || 0)} prompt lines`);
        } catch (error) {
            updateStatus("Error: " + error.message, true);
            operationFeedback?.error(error?.message || "Could not export wildcard file");
        } finally {
            saveBtn.disabled = false;
            saveBtn.style.opacity = "1";
        }
    });
}

export async function showImportDialog({
    galleryNode,
    loadCategories,
    loadPromptsForGallery,
    refreshAllSections = null,
    onRefresh = null,
    operationFeedback = null,
    workspaceContainer = null,
    onClose = null,
    librarySubnavHtml = "",
}) {
    const { dialog, close, isWorkspace } = createWorkspaceDialogSurface({
        workspaceContainer,
        onClose,
        width: 450,
    });

    dialog.innerHTML = `
         ${isWorkspace ? "" : `<div class="localprompt-modal-header" style="margin: -20px -20px 16px;">
             <div class="localprompt-workspace-title">
                 <h3><span class="localprompt-workspace-heading-icon localprompt-workspace-heading-icon--import" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 2h8l4 4v16H6z"></path><path d="M14 2v5h5M12 11v7M9 15l3 3 3-3"></path></svg></span>Import TXT</h3>
             </div>
             <button class="localprompt-modal-close" title="Close">x</button>
         </div>`}
         ${isWorkspace ? librarySubnavHtml : ""}
         <div class="${isWorkspace ? "localprompt-workspace-body" : ""}">
             <div class="${isWorkspace ? "localprompt-workspace-section " : ""}localprompt-import-form" style="margin-bottom: 12px;">
                 <p style="font-size: 11px; color: #aaa; margin: 0 0 12px;">
                     Import a wildcard-style .txt file. Each line will become one prompt card in a new category.
                 </p>
                 <div style="margin-bottom: 12px;">
                     <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Select File</label>
                     <input type="file" id="import-file-input" accept=".txt" style="width: 100%; padding: 10px; background: #111820; color: #ddd; border: 1px solid #3b4652; border-radius: 7px;">
                 </div>
                 <div style="margin-bottom: 12px;">
                     <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Category Name</label>
                     <input type="text" id="import-category-input" placeholder="e.g. Wildcards, Styles, etc." style="width: 100%; padding: 10px; background: #111820; color: #ddd; border: 1px solid #3b4652; border-radius: 7px;" list="import-category-datalist">
                     <datalist id="import-category-datalist"></datalist>
                 </div>
                 <div class="localprompt-form-note" style="font-size: 11px; color: #999; padding: 10px; background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.08); border-radius: 7px;"><span class="localprompt-section-icon" aria-hidden="true">✧</span><strong>Import behavior:</strong> Create new category</div>
             </div>
             <div id="import-status" style="
                 margin: 12px 0;
                 padding: 8px;
                 background: #151515;
                 border: 1px solid #444;
                 border-radius: 4px;
                 min-height: 40px;
                 font-size: 11px;
                 color: #aaa;
                 white-space: pre-wrap;
                 display: none;
             "></div>
         </div>
         <div class="${isWorkspace ? "localprompt-workspace-footer" : ""}" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: ${isWorkspace ? "0" : "16px"};">
             <button id="import-cancel-btn" style="padding: 8px 16px; background: #3a3a3a; color: #ddd; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Cancel</button>
             <button id="import-save-btn" style="padding: 8px 16px; background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; border-radius: 4px; cursor: pointer;">Import</button>
         </div>
     `;

    await populateCategoryDatalist(galleryNode, dialog.querySelector("#import-category-datalist"));

    const fileInput = dialog.querySelector("#import-file-input");
    const categoryInput = dialog.querySelector("#import-category-input");
    const cancelBtn = dialog.querySelector("#import-cancel-btn");
    const saveBtn = dialog.querySelector("#import-save-btn");
    const statusDiv = dialog.querySelector("#import-status");

    const updateStatus = (message, isError = false) => {
        statusDiv.style.display = "block";
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? "#ff6b6b" : "#aaa";
    };

    dialog.querySelector(isWorkspace ? ".localprompt-workspace-back" : ".localprompt-modal-close")?.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);

    saveBtn.addEventListener("click", async () => {
        const file = fileInput.files[0];
        const category = categoryInput.value.trim();

        if (!file) {
            updateStatus("Please select a file.", true);
            return;
        }
        if (!category) {
            updateStatus("Please enter a category name.", true);
            return;
        }

        saveBtn.disabled = true;
        saveBtn.style.opacity = "0.5";

        try {
            updateStatus("Uploading file...");
            operationFeedback?.pending("Uploading wildcard file...");
            const uploadResult = await galleryNode.uploadWildcardFile(file);

            if (uploadResult.status !== "ok") {
                throw new Error(uploadResult.message || "Upload failed");
            }

            updateStatus("File uploaded. Importing prompts...");
            operationFeedback?.pending("Importing prompt cards...");
            const importResult = await galleryNode.importWildcardFile(uploadResult.filename, category);

            if (importResult.status !== "ok") {
                throw new Error(importResult.message || "Import failed");
            }

            updateStatus(importResult.message + "\nClosing dialog in 2 seconds...");
            operationFeedback?.success(importResult.message || "Prompt cards imported");

            try {
                await loadCategories();
                if (onRefresh) {
                    await onRefresh();
                } else {
                    await loadPromptsForGallery(1);
                    await refreshAllSections?.();
                }
            } catch (refreshError) {
                updateStatus((importResult.message || "Prompt cards imported") + "\nView refresh failed; close and reopen the gallery.", true);
                operationFeedback?.warning("Prompt cards imported. View refresh failed.");
            }

            setTimeout(() => {
                close();
            }, 2000);
        } catch (error) {
            updateStatus("Error: " + error.message, true);
            operationFeedback?.error(error?.message || "Could not import prompt cards");
            saveBtn.disabled = false;
            saveBtn.style.opacity = "1";
        }
    });
}
