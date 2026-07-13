import { escapeHtml } from "../shared/dom.js";

function optionMarkup(categories = []) {
    return [
        `<option value="" selected>Uncategorized</option>`,
        ...categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
    ].join("");
}

function renderSample(sample) {
    const fields = ["name", "category", "prompt_text", "favorite", "usage_count"];
    const field = fields.find(key => sample?.[key]);
    if (!field) return "No visible field changes";
    const change = sample[field];
    const before = escapeHtml(String(change?.before ?? ""));
    const after = escapeHtml(String(change?.after ?? ""));
    return `<div class="localprompt-bulk-diff-row">
        <div class="localprompt-bulk-diff-label">${escapeHtml(field.replace("_", " "))}</div>
        <div class="localprompt-bulk-diff-before">${before || "(empty)"}</div>
        <span class="localprompt-bulk-diff-arrow" aria-hidden="true">→</span>
        <div class="localprompt-bulk-diff-after">${after || "(empty)"}</div>
    </div>`;
}

export async function showBulkEditDrawer({
    galleryNode,
    selectedCount = 0,
    categories = [],
    selection,
    onApplied = null,
}) {
    const overlay = document.createElement("div");
    overlay.className = "localprompt-modal-overlay localprompt-bulk-edit-overlay";
    overlay.innerHTML = `
        <section class="localprompt-bulk-edit-drawer" role="dialog" aria-modal="true" aria-labelledby="bulk-edit-title">
            <header class="localprompt-bulk-edit-header">
                <div>
                    <div class="localprompt-eyebrow">CARD MANAGER</div>
                    <h3 id="bulk-edit-title">Bulk edit ${selectedCount} cards</h3>
                    <p>Preview the changes before writing them to your library.</p>
                </div>
                <button type="button" class="localprompt-modal-close" data-bulk-edit-cancel aria-label="Close">×</button>
            </header>
            <div class="localprompt-bulk-edit-body">
                <section class="localprompt-bulk-edit-section">
                    <div class="localprompt-bulk-edit-section-title">Category</div>
                    <label class="localprompt-bulk-choice"><input type="radio" name="bulk-category-mode" value="none" checked> <span>Leave unchanged</span></label>
                    <label class="localprompt-bulk-choice"><input type="radio" name="bulk-category-mode" value="set"> <span>Move to</span>
                        <select id="bulk-edit-category" disabled>${optionMarkup(categories)}</select>
                    </label>
                </section>

                <section class="localprompt-bulk-edit-section">
                    <div class="localprompt-bulk-edit-section-title">Prompt text</div>
                    <select id="bulk-edit-prompt-mode" class="localprompt-bulk-edit-select">
                        <option value="none">Leave unchanged</option>
                        <option value="find_replace">Find and replace</option>
                        <option value="prepend">Add before</option>
                        <option value="append">Add after</option>
                    </select>
                    <div class="localprompt-bulk-edit-fields" id="bulk-edit-prompt-fields"></div>
                </section>

                <section class="localprompt-bulk-edit-section">
                    <div class="localprompt-bulk-edit-section-title">Card names</div>
                    <select id="bulk-edit-name-mode" class="localprompt-bulk-edit-select">
                        <option value="none">Leave unchanged</option>
                        <option value="find_replace">Find and replace</option>
                        <option value="prepend">Add before</option>
                        <option value="append">Add after</option>
                    </select>
                    <div class="localprompt-bulk-edit-fields" id="bulk-edit-name-fields"></div>
                </section>

                <section class="localprompt-bulk-edit-section localprompt-bulk-edit-inline-section">
                    <label class="localprompt-bulk-edit-field"><span>Pin state</span>
                        <select id="bulk-edit-favorite-mode" class="localprompt-bulk-edit-select">
                            <option value="none">Leave unchanged</option>
                            <option value="set_true">Pin all</option>
                            <option value="set_false">Unpin all</option>
                        </select>
                    </label>
                    <label class="localprompt-bulk-choice"><input id="bulk-edit-reset-usage" type="checkbox"> <span>Reset usage count</span></label>
                </section>

                <section class="localprompt-bulk-preview-section">
                    <div class="localprompt-bulk-preview-heading">
                        <div>
                            <div class="localprompt-bulk-edit-section-title">Preview</div>
                            <div id="bulk-edit-summary" class="localprompt-bulk-summary-copy">Choose an operation to preview.</div>
                        </div>
                        <span id="bulk-edit-status" class="localprompt-bulk-status" role="status" aria-live="polite"></span>
                    </div>
                    <div id="bulk-edit-samples" class="localprompt-bulk-diff-list"></div>
                </section>
            </div>
            <footer class="localprompt-bulk-edit-footer">
                <button type="button" class="localprompt-btn" data-bulk-edit-cancel>Cancel</button>
                <button type="button" class="localprompt-btn" id="bulk-edit-preview-button">Preview changes</button>
                <button type="button" class="localprompt-btn primary" id="bulk-edit-apply-button" disabled>Apply changes</button>
            </footer>
        </section>
    `;
    document.body.appendChild(overlay);

    const categoryMode = [...overlay.querySelectorAll('input[name="bulk-category-mode"]')];
    const categorySelect = overlay.querySelector("#bulk-edit-category");
    const promptMode = overlay.querySelector("#bulk-edit-prompt-mode");
    const promptFields = overlay.querySelector("#bulk-edit-prompt-fields");
    const nameMode = overlay.querySelector("#bulk-edit-name-mode");
    const nameFields = overlay.querySelector("#bulk-edit-name-fields");
    const favoriteMode = overlay.querySelector("#bulk-edit-favorite-mode");
    const resetUsage = overlay.querySelector("#bulk-edit-reset-usage");
    const summary = overlay.querySelector("#bulk-edit-summary");
    const status = overlay.querySelector("#bulk-edit-status");
    const samples = overlay.querySelector("#bulk-edit-samples");
    const previewButton = overlay.querySelector("#bulk-edit-preview-button");
    const applyButton = overlay.querySelector("#bulk-edit-apply-button");
    let previewResult = null;
    let previewOperations = null;
    let editRevision = 0;

    function renderTextFields(container, mode) {
        if (mode === "none") {
            container.innerHTML = "";
            return;
        }
        if (mode === "find_replace") {
            container.innerHTML = `
                <label class="localprompt-bulk-edit-field"><span>Find</span><input data-bulk-find type="text" placeholder="Text to find"></label>
                <label class="localprompt-bulk-edit-field"><span>Replace</span><input data-bulk-replace type="text" placeholder="Replacement text"></label>
                <label class="localprompt-bulk-choice"><input data-bulk-case-sensitive type="checkbox"> <span>Case sensitive</span></label>`;
            return;
        }
        container.innerHTML = `<label class="localprompt-bulk-edit-field"><span>${mode === "prepend" ? "Add before" : "Add after"}</span><textarea data-bulk-value rows="3" placeholder="Text to add"></textarea></label>`;
    }

    function buildTextOperation(mode, container) {
        if (mode === "none") return null;
        if (mode === "find_replace") {
            return {
                mode,
                find: container.querySelector("[data-bulk-find]")?.value || "",
                replace: container.querySelector("[data-bulk-replace]")?.value || "",
                case_sensitive: !!container.querySelector("[data-bulk-case-sensitive]")?.checked,
            };
        }
        return { mode, value: container.querySelector("[data-bulk-value]")?.value || "" };
    }

    function buildOperations() {
        const operations = {};
        if (categoryMode.find(input => input.checked)?.value === "set") {
            operations.category = { mode: "set", value: categorySelect.value };
        }
        const promptOperation = buildTextOperation(promptMode.value, promptFields);
        const nameOperation = buildTextOperation(nameMode.value, nameFields);
        if (promptOperation) operations.prompt_text = promptOperation;
        if (nameOperation) operations.name = nameOperation;
        if (favoriteMode.value !== "none") operations.favorite = { mode: "set", value: favoriteMode.value === "set_true" };
        if (resetUsage.checked) operations.reset_usage = true;
        return operations;
    }

    function clearPreview() {
        editRevision += 1;
        previewResult = null;
        previewOperations = null;
        applyButton.disabled = true;
        summary.textContent = "Choose an operation to preview.";
        samples.innerHTML = "";
        status.textContent = "";
    }

    function close() {
        overlay.remove();
        document.removeEventListener("keydown", onKeydown);
    }

    function onKeydown(event) {
        if (event.key === "Escape") close();
    }

    categoryMode.forEach(input => input.addEventListener("change", () => {
        categorySelect.disabled = input.value !== "set" || !input.checked;
        clearPreview();
    }));
    promptMode.addEventListener("change", () => { renderTextFields(promptFields, promptMode.value); clearPreview(); });
    nameMode.addEventListener("change", () => { renderTextFields(nameFields, nameMode.value); clearPreview(); });
    [promptFields, nameFields].forEach(container => {
        container.addEventListener("input", clearPreview);
        container.addEventListener("change", clearPreview);
    });
    [categorySelect, favoriteMode, resetUsage].forEach(input => input.addEventListener("change", clearPreview));
    overlay.querySelectorAll("[data-bulk-edit-cancel]").forEach(button => button.addEventListener("click", close));
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });

    previewButton.addEventListener("click", async () => {
        const operations = buildOperations();
        if (!Object.keys(operations).length) {
            status.textContent = "Choose at least one operation.";
            return;
        }
        previewButton.disabled = true;
        applyButton.disabled = true;
        status.textContent = "Previewing…";
        const previewEditRevision = editRevision;
        try {
            const result = await galleryNode.bulkEdit(selection, operations, { preview: true, sampleLimit: 20 });
            if (previewEditRevision !== editRevision) return;
            previewResult = result;
            previewOperations = operations;
            const missing = Number(previewResult.missing_ids?.length || 0);
            summary.textContent = `${previewResult.changed_count || 0} changed · ${previewResult.unchanged_count || 0} unchanged · ${missing} missing`;
            samples.innerHTML = (previewResult.samples || []).map(renderSample).join("");
            applyButton.textContent = `Apply ${previewResult.changed_count || 0} changes`;
            applyButton.disabled = Number(previewResult.changed_count || 0) === 0;
            status.textContent = "Preview ready";
        } catch (error) {
            if (previewEditRevision !== editRevision) return;
            previewResult = null;
            status.textContent = error.message || "Preview failed.";
        } finally {
            previewButton.disabled = false;
        }
    });

    applyButton.addEventListener("click", async () => {
        if (!previewResult || !previewOperations) return;
        previewButton.disabled = true;
        applyButton.disabled = true;
        status.textContent = "Applying…";
        try {
            const result = await galleryNode.bulkEdit(selection, previewOperations, {
                preview: false,
                baseRevision: previewResult.revision,
                sampleLimit: 20,
            });
            await onApplied?.(result);
            close();
        } catch (error) {
            status.textContent = error.message || "Apply failed. Refresh the preview and try again.";
            previewButton.disabled = false;
            applyButton.disabled = false;
        }
    });

    renderTextFields(promptFields, promptMode.value);
    renderTextFields(nameFields, nameMode.value);
    document.addEventListener("keydown", onKeydown);
    overlay.querySelector("[data-bulk-edit-cancel]")?.focus();
}
