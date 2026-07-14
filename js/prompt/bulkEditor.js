import { escapeHtml } from "../shared/dom.js";

function createOperationEditorHtml(selectedCount) {
    return `
        <div class="localprompt-modal-overlay localprompt-bulk-edit-overlay">
            <div class="localprompt-modal localprompt-bulk-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-edit-title">
                <div class="localprompt-modal-header">
                    <div>
                        <h3 id="bulk-edit-title">Bulk edit ${selectedCount} card${selectedCount === 1 ? "" : "s"}</h3>
                        <p class="localprompt-bulk-edit-subtitle">Preview the server-side changes before applying them.</p>
                    </div>
                    <button type="button" class="localprompt-modal-close" data-bulk-edit-cancel title="Cancel">×</button>
                </div>
                <div class="localprompt-modal-content localprompt-bulk-edit-content">
                    <section class="localprompt-bulk-edit-section">
                        <h4>Category</h4>
                        <label><input type="radio" name="bulk-edit-category-mode" value="leave" checked> Leave unchanged</label>
                        <label class="localprompt-bulk-edit-inline"><input type="radio" name="bulk-edit-category-mode" value="set"> Move to:
                            <select id="bulk-edit-category" disabled></select>
                        </label>
                    </section>

                    <section class="localprompt-bulk-edit-section">
                        <h4>Prompt text</h4>
                        <label><input type="radio" name="bulk-edit-prompt-mode" value="leave" checked> Leave unchanged</label>
                        <label><input type="radio" name="bulk-edit-prompt-mode" value="find_replace"> Find and replace</label>
                        <div class="localprompt-bulk-edit-fields" data-prompt-fields hidden>
                            <input id="bulk-edit-prompt-find" type="text" placeholder="Find">
                            <input id="bulk-edit-prompt-replace" type="text" placeholder="Replace">
                        </div>
                        <label><input type="radio" name="bulk-edit-prompt-mode" value="prepend"> Add before</label>
                        <label><input type="radio" name="bulk-edit-prompt-mode" value="append"> Add after</label>
                        <div class="localprompt-bulk-edit-fields" data-prompt-value hidden>
                            <input id="bulk-edit-prompt-value" type="text" placeholder="Text to add">
                        </div>
                    </section>

                    <section class="localprompt-bulk-edit-section">
                        <h4>Card names</h4>
                        <label><input type="radio" name="bulk-edit-name-mode" value="leave" checked> Leave unchanged</label>
                        <label><input type="radio" name="bulk-edit-name-mode" value="find_replace"> Find and replace</label>
                        <div class="localprompt-bulk-edit-fields" data-name-fields hidden>
                            <input id="bulk-edit-name-find" type="text" placeholder="Find">
                            <input id="bulk-edit-name-replace" type="text" placeholder="Replace">
                        </div>
                    </section>

                    <section class="localprompt-bulk-edit-section">
                        <h4>Pinning and usage</h4>
                        <label><input type="radio" name="bulk-edit-favorite-mode" value="leave" checked> Leave pin state unchanged</label>
                        <label><input type="radio" name="bulk-edit-favorite-mode" value="set" data-favorite-value="true"> Pin all</label>
                        <label><input type="radio" name="bulk-edit-favorite-mode" value="set" data-favorite-value="false"> Unpin all</label>
                        <label><input id="bulk-edit-reset-usage" type="checkbox"> Reset usage count</label>
                    </section>

                    <section class="localprompt-bulk-edit-preview" aria-live="polite">
                        <div class="localprompt-bulk-edit-preview-heading">
                            <h4>Preview</h4>
                            <span id="bulk-edit-preview-status">Choose an operation to preview.</span>
                        </div>
                        <div id="bulk-edit-preview-samples" class="localprompt-bulk-edit-samples"></div>
                    </section>
                </div>
                <div class="localprompt-modal-footer localprompt-bulk-edit-footer">
                    <span id="bulk-edit-error" class="localprompt-bulk-edit-error" role="status"></span>
                    <button type="button" class="localprompt-btn" data-bulk-edit-cancel>Cancel</button>
                    <button type="button" class="localprompt-btn primary" data-bulk-edit-apply disabled>Apply changes</button>
                </div>
            </div>
        </div>
    `;
}
function getRadioValue(root, name) {
    return root.querySelector(`input[name="${name}"]:checked`)?.value || "leave";
}

function buildOperations(root) {
    const operations = {};
    const categoryMode = getRadioValue(root, "bulk-edit-category-mode");
    if (categoryMode === "set") {
        operations.category = { mode: "set", value: root.querySelector("#bulk-edit-category").value };
    }

    const promptMode = getRadioValue(root, "bulk-edit-prompt-mode");
    if (promptMode !== "leave") {
        if (promptMode === "find_replace") {
            operations.prompt_text = {
                mode: promptMode,
                find: root.querySelector("#bulk-edit-prompt-find").value,
                replace: root.querySelector("#bulk-edit-prompt-replace").value,
            };
        } else {
            operations.prompt_text = {
                mode: promptMode,
                value: root.querySelector("#bulk-edit-prompt-value").value,
            };
        }
    }

    const nameMode = getRadioValue(root, "bulk-edit-name-mode");
    if (nameMode !== "leave") {
        operations.name = {
            mode: nameMode,
            find: root.querySelector("#bulk-edit-name-find").value,
            replace: root.querySelector("#bulk-edit-name-replace").value,
        };
    }

    if (getRadioValue(root, "bulk-edit-favorite-mode") === "set") {
        operations.favorite = {
            mode: "set",
            value: root.querySelector("input[name=bulk-edit-favorite-mode]:checked").dataset.favoriteValue === "true",
        };
    }
    if (root.querySelector("#bulk-edit-reset-usage").checked) {
        operations.reset_usage = true;
    }
    return operations;
}

function renderPreview(root, result) {
    const status = root.querySelector("#bulk-edit-preview-status");
    const samples = root.querySelector("#bulk-edit-preview-samples");
    const changed = Number(result?.changed_count || 0);
    const unchanged = Number(result?.unchanged_count || 0);
    const missing = Number(result?.missing_count || 0);
    status.textContent = `${changed} changed · ${unchanged} unchanged · ${missing} missing`;
    root.querySelector("[data-bulk-edit-apply]").textContent = changed
        ? `Apply ${changed} change${changed === 1 ? "" : "s"}`
        : "Apply changes";
    samples.innerHTML = (result?.samples || []).map((sample) => {
        const name = escapeHtml(sample.name || sample.id || "Card");
        const details = Object.entries(sample)
            .filter(([field]) => ["name", "category", "prompt_text", "favorite", "usage_count"].includes(field))
            .map(([field, values]) => {
                if (!values || typeof values !== "object") return "";
                return `<div><strong>${escapeHtml(field.replace("_", " "))}</strong>: “${escapeHtml(String(values.before))}” → “${escapeHtml(String(values.after))}”</div>`;
            })
            .join("");
        return `<div class="localprompt-bulk-edit-sample"><strong>${name}</strong>${details}</div>`;
    }).join("");
    if (changed && (result?.samples || []).length < changed) {
        samples.insertAdjacentHTML("beforeend", `<div class="localprompt-bulk-edit-more">Showing ${(result.samples || []).length} sample${(result.samples || []).length === 1 ? "" : "s"}.</div>`);
    }
}

export async function showBulkEditDrawer({
    galleryNode,
    selectedCount,
    categories = [],
    selection,
    activePromptIds = [],
    onApplied,
}) {
    const overlay = document.createElement("div");
    overlay.innerHTML = createOperationEditorHtml(selectedCount);
    const root = overlay.firstElementChild;
    document.body.appendChild(root);
    const categorySelect = root.querySelector("#bulk-edit-category");
    const applyButton = root.querySelector("[data-bulk-edit-apply]");
    const errorElement = root.querySelector("#bulk-edit-error");
    let previewResult = null;
    let previewKey = "";
    let previewSequence = 0;
    let previewTimer = null;

    const uncategorized = document.createElement("option");
    uncategorized.value = "";
    uncategorized.textContent = "Uncategorized";
    categorySelect.appendChild(uncategorized);
    categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });

    function close() {
        clearTimeout(previewTimer);
        previewSequence += 1;
        document.removeEventListener("keydown", onKeydown);
        root.remove();
    }

    function onKeydown(event) {
        if (event.key === "Escape") close();
    }

    function updateControlState() {
        const promptMode = getRadioValue(root, "bulk-edit-prompt-mode");
        const setVisible = (selector, visible) => {
            const element = root.querySelector(selector);
            if (!element) return;
            element.hidden = !visible;
            element.style.display = visible ? "grid" : "none";
        };
        setVisible("[data-prompt-fields]", promptMode === "find_replace");
        setVisible("[data-prompt-value]", ["prepend", "append"].includes(promptMode));
        setVisible("[data-name-fields]", getRadioValue(root, "bulk-edit-name-mode") === "find_replace");
        categorySelect.disabled = getRadioValue(root, "bulk-edit-category-mode") !== "set";
    }

    async function runPreview() {
        const sequence = ++previewSequence;
        previewResult = null;
        applyButton.disabled = true;
        errorElement.textContent = "";
        let operations;
        try {
            operations = buildOperations(root);
            if (!Object.keys(operations).length) {
                root.querySelector("#bulk-edit-preview-status").textContent = "Choose an operation to preview.";
                root.querySelector("#bulk-edit-preview-samples").innerHTML = "";
                return;
            }
            root.querySelector("#bulk-edit-preview-status").textContent = "Previewing…";
            const result = await galleryNode.bulkEdit(selection, operations, {
                preview: true,
                sampleLimit: 10,
                activePromptIds,
            });
            if (sequence !== previewSequence) return;
            previewResult = result;
            previewKey = JSON.stringify(operations);
            renderPreview(root, result);
            applyButton.disabled = Number(result?.changed_count || 0) === 0;
        } catch (error) {
            if (sequence !== previewSequence) return;
            errorElement.textContent = error.message || "Preview failed.";
            root.querySelector("#bulk-edit-preview-status").textContent = "Preview failed.";
        }
    }

    function schedulePreview() {
        updateControlState();
        previewResult = null;
        applyButton.disabled = true;
        applyButton.textContent = "Apply changes";
        clearTimeout(previewTimer);
        previewTimer = setTimeout(runPreview, 250);
    }

    root.querySelectorAll("input, select").forEach((control) => control.addEventListener("input", schedulePreview));
    root.querySelectorAll("input[type=radio], input[type=checkbox], select").forEach((control) => control.addEventListener("change", schedulePreview));
    root.addEventListener("change", updateControlState);
    root.querySelectorAll("[data-bulk-edit-cancel]").forEach((button) => button.addEventListener("click", close));
    root.addEventListener("click", (event) => {
        if (event.target === root) close();
    });
    applyButton.addEventListener("click", async () => {
        if (!previewResult?.revision) return;
        const operations = buildOperations(root);
        if (JSON.stringify(operations) !== previewKey) {
            schedulePreview();
            return;
        }
        applyButton.disabled = true;
        errorElement.textContent = "Applying…";
        try {
            const result = await galleryNode.bulkEdit(selection, operations, {
                preview: false,
                baseRevision: previewResult.revision,
                sampleLimit: 10,
                activePromptIds,
            });
            await onApplied?.(result);
            close();
        } catch (error) {
            const message = error?.result?.status === "conflict"
                ? "The library changed while this dialog was open. Preview again before applying."
                : (error.message || "Bulk edit failed.");
            errorElement.textContent = message;
            applyButton.disabled = false;
        }
    });
    document.addEventListener("keydown", onKeydown);
    updateControlState();
    runPreview();
}
