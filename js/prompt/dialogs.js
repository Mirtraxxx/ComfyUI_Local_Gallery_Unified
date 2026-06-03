import { escapeHtml } from "../shared/dom.js";

function createCenteredOverlay() {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    return overlay;
}

function createDialog(width = 500) {
    const dialog = document.createElement("div");
    dialog.style.cssText = `
        background: #2a2a2a;
        border: 1px solid #555;
        border-radius: 8px;
        padding: 20px;
        width: ${width}px;
        max-width: 90%;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    return dialog;
}

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

export async function showAddPromptDialog({
    galleryNode,
    nodeInstance,
    loadCategories,
    loadPromptsForGallery,
}) {
    try {
        const overlay = createCenteredOverlay();
        const dialog = createDialog(500);

        dialog.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #ddd;">Add New Prompt</h3>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Name:</label>
                <input type="text" id="new-prompt-name" placeholder="Prompt Name" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Prompt Text:</label>
                <textarea id="new-prompt-text" rows="4" placeholder="The actual prompt text..." style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box; resize: vertical;"></textarea>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Category:</label>
                <input type="text" id="new-prompt-category" placeholder="e.g., Hair, Clothing, Poses" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;" list="category-datalist">
                <datalist id="category-datalist"></datalist>
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
                <button id="add-cancel-btn" style="padding: 8px 16px; background: #3a3a3a; color: #ddd; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button id="add-save-btn" style="padding: 8px 16px; background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; border-radius: 4px; cursor: pointer;">Create</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        await populateCategoryDatalist(galleryNode, dialog.querySelector("#category-datalist"));

        const nameInput = dialog.querySelector("#new-prompt-name");
        const textInput = dialog.querySelector("#new-prompt-text");
        const categoryInput = dialog.querySelector("#new-prompt-category");
        const cancelBtn = dialog.querySelector("#add-cancel-btn");
        const saveBtn = dialog.querySelector("#add-save-btn");

        if (nodeInstance.uiPrefs?.last_created_category) {
            categoryInput.value = nodeInstance.uiPrefs.last_created_category;
        }

        cancelBtn.addEventListener("click", () => overlay.remove());

        saveBtn.addEventListener("click", async () => {
            try {
                const name = nameInput.value.trim();
                const promptText = textInput.value.trim();
                const category = categoryInput.value.trim();

                if (!name) {
                    alert("Please enter a name for the prompt");
                    return;
                }

                const result = await galleryNode.createPrompt(name, promptText, category);

                if (result.status === "ok") {
                    nodeInstance.uiPrefs.last_created_category = category;
                    await galleryNode.saveUiPrefs(nodeInstance.uiPrefs);

                    overlay.remove();
                    await loadCategories();
                    await loadPromptsForGallery(1);
                } else {
                    alert("Failed to create prompt: " + (result.message || "Unknown error"));
                }
            } catch (error) {
                console.error("Error creating prompt:", error);
                alert("Error creating prompt: " + error.message);
            }
        });
    } catch (error) {
        console.error("Error showing add prompt dialog:", error);
        alert("Error opening dialog: " + error.message);
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
}) {
    const promptId = prompt?.id ?? prompt?.prompt_id;
    if (!promptId) {
        alert("This prompt has no saved prompt id, so it cannot be edited.");
        return;
    }

    const overlay = createCenteredOverlay();
    const dialog = createDialog(500);

    dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #ddd;">Edit Prompt</h3>
        <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Name:</label>
            <input type="text" id="edit-prompt-name" value="${escapeHtml(prompt.name)}" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Prompt Text:</label>
            <textarea id="edit-prompt-text" rows="4" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box; resize: vertical;">${escapeHtml(prompt.prompt_text || "")}</textarea>
        </div>
        <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Category:</label>
            <input type="text" id="edit-prompt-category" value="${escapeHtml(prompt.category || "")}" placeholder="e.g., Hair, Clothing, Poses" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px; box-sizing: border-box;" list="edit-category-datalist">
            <datalist id="edit-category-datalist"></datalist>
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
            <button id="edit-cancel-btn" style="padding: 8px 16px; background: #3a3a3a; color: #ddd; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button id="edit-save-btn" style="padding: 8px 16px; background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; border-radius: 4px; cursor: pointer;">Save</button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    await populateCategoryDatalist(galleryNode, dialog.querySelector("#edit-category-datalist"));

    const nameInput = dialog.querySelector("#edit-prompt-name");
    const textInput = dialog.querySelector("#edit-prompt-text");
    const categoryInput = dialog.querySelector("#edit-prompt-category");
    const cancelBtn = dialog.querySelector("#edit-cancel-btn");
    const saveBtn = dialog.querySelector("#edit-save-btn");

    cancelBtn.addEventListener("click", () => overlay.remove());

    saveBtn.addEventListener("click", async () => {
        const nextData = {
            name: nameInput.value.trim(),
            prompt_text: textInput.value.trim(),
            category: categoryInput.value.trim()
        };
        const result = await galleryNode.updateMetadata(promptId, nextData);
        updateLocalPromptAfterMetadataSave(promptId, result?.prompt || nextData);

        overlay.remove();
        await loadCategories();
        if (onRefresh) {
            await onRefresh();
        } else {
            await loadPromptsForGallery(galleryNode.currentPage);
            await refreshAllSections();
        }
    });
}

export function showUploadThumbnailDialog({
    prompt,
    galleryNode,
    loadPromptsForGallery,
    onRefresh = null,
}) {
    const promptId = prompt?.id ?? prompt?.prompt_id;
    if (!promptId) {
        alert("This prompt has no saved prompt id, so its thumbnail cannot be updated.");
        return;
    }

    const overlay = createCenteredOverlay();
    const dialog = createDialog(400);

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
            alert("Please select a file");
            return;
        }

        const result = await galleryNode.uploadThumbnail(promptId, file);

        if (result.status === "ok") {
            overlay.remove();
            if (onRefresh) {
                await onRefresh();
            } else {
                await loadPromptsForGallery(galleryNode.currentPage);
            }
        } else {
            alert("Failed to upload thumbnail: " + (result.message || "Unknown error"));
        }
    });
}

export async function showImportDialog({
    galleryNode,
    loadCategories,
    loadPromptsForGallery,
}) {
    const overlay = createCenteredOverlay();
    const dialog = createDialog(450);

    dialog.innerHTML = `
         <h3 style="margin: 0 0 16px 0; color: #ddd;">Import Wildcard File (Batch Import)</h3>
         <p style="font-size: 11px; color: #aaa; margin-bottom: 12px;">
             Select a .txt file. Each line will be converted into a separate prompt card.
         </p>
         
         <div style="margin-bottom: 12px;">
             <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Select File:</label>
             <input type="file" id="import-file-input" accept=".txt" style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px;">
         </div>
         
         <div style="margin-bottom: 12px;">
             <label style="display: block; margin-bottom: 4px; font-weight: bold; color: #ddd;">Category Name:</label>
             <input type="text" id="import-category-input" placeholder="e.g. Wildcards, Styles, etc." style="width: 100%; padding: 8px; background: #1a1a1a; color: #ddd; border: 1px solid #555; border-radius: 4px;" list="import-category-datalist">
             <datalist id="import-category-datalist"></datalist>
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
         
         <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;">
             <button id="import-cancel-btn" style="padding: 8px 16px; background: #3a3a3a; color: #ddd; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Cancel</button>
             <button id="import-save-btn" style="padding: 8px 16px; background: #4a7c4a; color: #fff; border: 1px solid #5a9c5a; border-radius: 4px; cursor: pointer;">Upload & Import</button>
         </div>
     `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

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

    cancelBtn.addEventListener("click", () => overlay.remove());

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
            const uploadResult = await galleryNode.uploadWildcardFile(file);

            if (uploadResult.status !== "ok") {
                throw new Error(uploadResult.message || "Upload failed");
            }

            updateStatus("File uploaded. Importing prompts...");
            const importResult = await galleryNode.importWildcardFile(uploadResult.filename, category);

            if (importResult.status !== "ok") {
                throw new Error(importResult.message || "Import failed");
            }

            updateStatus(importResult.message + "\nClosing dialog in 2 seconds...");

            await loadCategories();
            await loadPromptsForGallery(1);

            setTimeout(() => {
                overlay.remove();
            }, 2000);
        } catch (error) {
            updateStatus("Error: " + error.message, true);
            saveBtn.disabled = false;
            saveBtn.style.opacity = "1";
        }
    });
}
