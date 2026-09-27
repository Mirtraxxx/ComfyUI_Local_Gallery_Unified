import { showAlert } from "../shared/nativeDialogs.js";
import { escapeHtml } from "../shared/dom.js";
import { icon } from "../shared/icons.js";
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

export async function showAddPromptDialog({
    galleryNode,
    nodeInstance,
    getPromptSourceNode = null,
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

        const { dialog, close } = createWorkspaceDialogSurface({
            workspaceContainer,
            onClose,
            width: 560,
        });
        dialog.classList.add("localprompt-from-output-page", "localprompt-add-prompt-page");

        const categoryOptions = ['<option value="">Uncategorized</option>']
            .concat(categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`))
            .concat([`<option value="${FROM_LAST_OUTPUT_NEW_CATEGORY}">+ New category…</option>`])
            .join("");

        dialog.innerHTML = `
            <nav class="localprompt-library-subnav localprompt-add-prompt-tabs" aria-label="Add prompt sections">
                <button class="localprompt-library-subnav-item${activeTab === "direct" ? " active" : ""}" data-add-tab="direct" type="button">New Prompt</button>
                <button class="localprompt-library-subnav-item${activeTab === "from_last_output" ? " active" : ""}" data-add-tab="from_last_output" type="button">From Last Output</button>
                <button class="lg-text-btn localprompt-library-shell-close" data-library-close type="button">Back to gallery</button>
            </nav>
            <div id="add-prompt-direct-panel" class="localprompt-workspace-body"${activeTab === "direct" ? "" : ' style="display: none;"'}>
                <div class="localprompt-workspace-section lg-form">
                    <div class="lg-grid-2">
                        <label class="lg-field">Card name
                            <input class="lg-input" type="text" id="new-prompt-name" placeholder="e.g. Cinematic Lighting">
                        </label>
                        <label class="lg-field">Category
                            <select class="lg-select" id="new-prompt-category">${categoryOptions}</select>
                        </label>
                    </div>
                    <label class="lg-field" id="new-prompt-new-category-row" hidden>New category name
                        <input class="lg-input" type="text" id="new-prompt-new-category" maxlength="80" placeholder="e.g. Lighting">
                    </label>
                    <label class="lg-field">Prompt text
                        <textarea class="lg-input" id="new-prompt-text" rows="8" placeholder="The actual prompt text..."></textarea>
                    </label>
                </div>
                <div class="localprompt-workspace-footer lg-actions">
                    <button class="lg-text-btn" id="new-prompt-cancel" type="button">Cancel</button>
                    <button class="lg-text-btn primary" id="new-prompt-save" type="button">Create Prompt</button>
                </div>
            </div>
            <div id="add-prompt-output-panel" class="localprompt-workspace-body"${activeTab === "from_last_output" ? "" : ' style="display: none;"'}>
                ${!hasLastOutput ? `
                    <div class="localprompt-workspace-section">
                        <p class="lg-callout"><strong>No previous output found</strong>Run a generation in ComfyUI first to capture its thumbnail and prompt text, or write a prompt in the New Prompt tab.</p>
                    </div>
                ` : !sourceNode ? `
                    <div class="localprompt-workspace-section">
                        <p class="lg-callout"><strong>No prompt source selected</strong>Select your Show Text node in ComfyUI and click Pick Prompt Source, or write a prompt in the New Prompt tab.</p>
                    </div>
                ` : `
                <div class="localprompt-workspace-section localprompt-from-output-details">
                    <div class="localprompt-from-output-preview">
                        <img src="${escapeHtml(previewUrl)}" alt="Last output preview">
                    </div>
                    <div class="lg-form">
                        <label class="lg-field">Card name
                            <input class="lg-input" type="text" id="from-last-output-name" value="${escapeHtml(defaultOutputCardName)}">
                        </label>
                        <div class="lg-grid-2">
                            <label class="lg-field">Name default
                                <select class="lg-select" id="from-last-output-name-default">
                                    <option value="time" ${defaultNameMode === "time" ? "selected" : ""}>Time</option>
                                    <option value="blank" ${defaultNameMode === "blank" ? "selected" : ""}>Blank</option>
                                </select>
                            </label>
                            <label class="lg-field">Category
                                <select class="lg-select" id="from-last-output-category">${categoryOptions}</select>
                            </label>
                        </div>
                        <label class="lg-field" id="from-last-output-new-category-row" hidden>New category name
                            <input class="lg-input" type="text" id="from-last-output-new-category" maxlength="80" placeholder="e.g. Lighting">
                        </label>
                    </div>
                </div>
                <div class="localprompt-workspace-section lg-form">
                    <label class="lg-field">Prompt text
                        <textarea class="lg-input" id="from-last-output-prompt" rows="8"></textarea>
                    </label>
                    <p class="lg-note">Using prompt source: ${escapeHtml(sourceNode?.title || sourceNode?.type || `Node ${sourceNode?.id || ""}`)}</p>
                </div>
                `}
                <div class="localprompt-workspace-footer lg-actions">
                    <button class="lg-text-btn" id="from-last-output-cancel" type="button">Cancel</button>
                    ${hasLastOutput && sourceNode ? '<button class="lg-text-btn primary" id="from-last-output-save" type="button">Save</button>' : ""}
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

        dialog.querySelector("[data-library-close]").addEventListener("click", close);
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
    const dialog = createDialogPanel(720);
    dialog.classList.add("localprompt-edit-prompt-dialog");

    dialog.innerHTML = `
        <div class="lg-row">
            <h3 class="lg-dialog-title">Edit prompt</h3>
            <span class="lg-spacer"></span>
            <button class="lg-icon-btn" id="edit-close-btn" type="button" aria-label="Close">${icon("close")}</button>
        </div>
        <div class="lg-grid-2">
            <label class="lg-field">Name
                <input class="lg-input" type="text" id="edit-prompt-name" value="${escapeHtml(prompt.name)}">
            </label>
            <label class="lg-field">Category
                <input class="lg-input" type="text" id="edit-prompt-category" value="${escapeHtml(prompt.category || "")}" placeholder="e.g. Hair, Clothing, Poses" list="edit-category-datalist">
            </label>
        </div>
        <datalist id="edit-category-datalist"></datalist>
        <label class="lg-field">Prompt text
            <textarea class="lg-input localprompt-edit-prompt-text" id="edit-prompt-text" rows="12" spellcheck="false">${escapeHtml(prompt.prompt_text || "")}</textarea>
        </label>
        <div class="lg-row">
            <span class="lg-note localprompt-edit-prompt-status">
                <span class="localprompt-edit-prompt-dot" id="edit-status-dot"></span>
                <span id="edit-status-label">Changes not saved</span> ·
                <span id="edit-character-count">0 characters</span>
            </span>
            <span class="lg-spacer"></span>
            <button class="lg-text-btn" id="edit-cancel-btn" type="button">Cancel</button>
            <button class="lg-text-btn primary" id="edit-save-btn" type="button">Save</button>
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
    refreshAllSections = null,
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
        <h3 class="lg-dialog-title">Upload thumbnail for "${escapeHtml(prompt.name)}"</h3>
        <input class="lg-input" type="file" id="thumbnail-file-input" accept="image/*,video/*">
        <div class="lg-actions">
            <button class="lg-text-btn" id="upload-cancel-btn" type="button">Cancel</button>
            <button class="lg-text-btn primary" id="upload-save-btn" type="button">Upload</button>
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
                    await refreshAllSections?.();
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
        ${isWorkspace ? librarySubnavHtml : '<h3 class="lg-dialog-title">Export TXT</h3>'}
        <div class="${isWorkspace ? "localprompt-workspace-body" : "lg-form"}">
            <div class="${isWorkspace ? "localprompt-workspace-section " : ""}lg-form">
                <p class="lg-note">Export one category as a wildcard-style .txt file with one prompt per line.</p>
                <label class="lg-field">Category
                    <select class="lg-select" id="export-category-select"></select>
                </label>
                <label class="lg-field">Wildcard filename
                    <input class="lg-input" type="text" id="export-filename-input" placeholder="e.g. MyCategory or Folder/MyCategory">
                    <span>Saved as .txt. Subfolders are supported.</span>
                </label>
                <label class="lg-field">Destination
                    <select class="lg-select" id="export-destination-select">
                        <option value="comfy">Save to ComfyUI wildcards folder</option>
                        <option value="download">Download .txt file</option>
                    </select>
                </label>
                <p class="lg-note">Wildcard token: <code id="export-wildcard-token">__filename__</code></p>
            </div>
            <div class="lg-status" id="export-status" hidden></div>
        </div>
        <div class="${isWorkspace ? "localprompt-workspace-footer " : ""}lg-actions">
            <button class="lg-text-btn" id="export-cancel-btn" type="button">Cancel</button>
            <button class="lg-text-btn primary" id="export-save-btn" type="button">Export</button>
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
        statusDiv.hidden = false;
        statusDiv.textContent = message;
        statusDiv.classList.toggle("error", isError);
    };

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
        }
    });
}

export async function showImportDialog({
    galleryNode,
    loadCategories,
    refreshAllSections = null,
    onRefresh = null,
    operationFeedback = null,
    workspaceContainer = null,
    onClose = null,
    librarySubnavHtml = "",
}) {
    const { dialog, close } = createWorkspaceDialogSurface({
        workspaceContainer,
        onClose,
        width: 450,
    });

    dialog.innerHTML = `
        ${librarySubnavHtml}
        <div class="localprompt-workspace-body">
            <div class="localprompt-workspace-section lg-form">
                <p class="lg-note">Import a wildcard-style .txt file. Each line becomes one prompt card in a new category.</p>
                <label class="lg-field">File
                    <input class="lg-input" type="file" id="import-file-input" accept=".txt">
                </label>
                <label class="lg-field">Category name
                    <input class="lg-input" type="text" id="import-category-input" placeholder="e.g. Wildcards, Styles, etc." list="import-category-datalist">
                    <datalist id="import-category-datalist"></datalist>
                </label>
            </div>
            <div class="lg-status" id="import-status" hidden></div>
        </div>
        <div class="localprompt-workspace-footer lg-actions">
            <button class="lg-text-btn" id="import-cancel-btn" type="button">Cancel</button>
            <button class="lg-text-btn primary" id="import-save-btn" type="button">Import</button>
        </div>
    `;

    await populateCategoryDatalist(galleryNode, dialog.querySelector("#import-category-datalist"));

    const fileInput = dialog.querySelector("#import-file-input");
    const categoryInput = dialog.querySelector("#import-category-input");
    const cancelBtn = dialog.querySelector("#import-cancel-btn");
    const saveBtn = dialog.querySelector("#import-save-btn");
    const statusDiv = dialog.querySelector("#import-status");

    const updateStatus = (message, isError = false) => {
        statusDiv.hidden = false;
        statusDiv.textContent = message;
        statusDiv.classList.toggle("error", isError);
    };

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
        }
    });
}
