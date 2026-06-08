export function createMetaTagsController({
    app,
    nodeInstance,
    widgetContainer,
    uniqueId,
    metaTagsWidget,
    writeSelectionArray,
    readSelectionArray,
    escapeHtml,
    onRender = null,
}) {
    function normalizeMetaTags(rawTags) {
        const tags = Array.isArray(rawTags) ? rawTags : [];
        return tags.map((tag, index) => ({
            id: String(tag?.id || `meta-${Date.now()}-${index}`),
            name: String(tag?.name ?? ""),
            prompt_text: String(tag?.prompt_text || tag?.prompt || ""),
            enabled: tag?.enabled === true,
            order: Number.isFinite(Number(tag?.order ?? tag?.index))
                ? Number(tag?.order ?? tag?.index)
                : index,
        })).sort((a, b) => (a.order - b.order) || String(a.id).localeCompare(String(b.id)));
    }

    let metaSaveStatusTimer = null;
    function setMetaSaveStatus(text, statusClass = "") {
        const statusEl = widgetContainer.querySelector(`#${uniqueId}-meta-save-status`);
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.classList.remove("saving", "saved");
        if (statusClass) statusEl.classList.add(statusClass);
    }

    function showMetaSaveFeedback() {
        setMetaSaveStatus("Saving...", "saving");
        if (metaSaveStatusTimer) {
            clearTimeout(metaSaveStatusTimer);
        }
        metaSaveStatusTimer = setTimeout(() => {
            setMetaSaveStatus("Saved", "saved");
            metaSaveStatusTimer = null;
        }, 220);
    }

    function saveMetaTags(options = {}) {
        if (!options.skipStatus) {
            showMetaSaveFeedback();
        }
        nodeInstance.metaTags = normalizeMetaTags(nodeInstance.metaTags).map((tag, index) => ({
            ...tag,
            order: index,
        }));
        const data = writeSelectionArray(nodeInstance.metaTags);
        nodeInstance.properties["prompt_meta_tags"] = data;
        metaTagsWidget.value = data;
        if (!options.skipRender) {
            renderMetaTags();
        } else {
            updateMetaTagsButtonState();
        }
        nodeInstance.setDirtyCanvas?.(true, options.redrawCanvas !== false);
        if (app.graph) app.graph.change();
    }

    function updateMetaTagsButtonState() {
        const btn = widgetContainer.querySelector(`#${uniqueId}-meta-tags-btn`);
        const enabledCount = nodeInstance.metaTags.filter(tag => tag.enabled && tag.prompt_text.trim()).length;
        if (btn) {
            btn.classList.toggle("has-enabled", enabledCount > 0);
            btn.title = enabledCount > 0
                ? `${enabledCount} hidden prompt${enabledCount === 1 ? "" : "s"} enabled`
                : "Meta Tags";
        }
    }

    function renderMetaTags() {
        const list = widgetContainer.querySelector(`#${uniqueId}-meta-tags-list`);
        if (!list) return;
        updateMetaTagsButtonState();
        list.innerHTML = "";

        if (!nodeInstance.metaTags.length) {
            const empty = document.createElement("div");
            empty.className = "localprompt-meta-empty";
            empty.textContent = "No hidden prompts yet.";
            list.appendChild(empty);
            return;
        }

        nodeInstance.metaTags.forEach((tag, index) => {
            const row = document.createElement("div");
            row.className = "localprompt-meta-row";
            row.dataset.metaId = tag.id;
            row.innerHTML = `
                <button class="localprompt-meta-toggle ${tag.enabled ? "on" : "off"}" type="button" title="Toggle hidden prompt">${tag.enabled ? "ON" : "OFF"}</button>
                <input class="localprompt-meta-name" type="text" value="${escapeHtml(tag.name)}" placeholder="Label" title="Optional label">
                <textarea class="localprompt-meta-text" rows="1" placeholder="Hidden prompt" title="Hidden prompt text">${escapeHtml(tag.prompt_text)}</textarea>
                <button class="localprompt-btn localprompt-meta-action localprompt-clear-btn" data-meta-action="delete" title="Delete hidden prompt" style="background: #4a2a2a; border-color: #6a3a3a;">x</button>
            `;

            const toggleBtn = row.querySelector(".localprompt-meta-toggle");
            const promptTextArea = row.querySelector(".localprompt-meta-text");
            const autoGrowPromptText = () => {
                if (!promptTextArea) return;
                promptTextArea.style.height = "24px";
                promptTextArea.style.height = `${Math.min(promptTextArea.scrollHeight, 110)}px`;
            };
            autoGrowPromptText();

            toggleBtn?.addEventListener("click", () => {
                nodeInstance.metaTags[index].enabled = !nodeInstance.metaTags[index].enabled;
                const isEnabled = nodeInstance.metaTags[index].enabled;
                toggleBtn.textContent = isEnabled ? "ON" : "OFF";
                toggleBtn.classList.toggle("on", isEnabled);
                toggleBtn.classList.toggle("off", !isEnabled);
                saveMetaTags({ redrawCanvas: false, skipRender: true });
            });
            row.querySelector(".localprompt-meta-name")?.addEventListener("input", (event) => {
                nodeInstance.metaTags[index].name = event.target.value;
                saveMetaTags({ redrawCanvas: false, skipRender: true });
            });
            promptTextArea?.addEventListener("input", (event) => {
                nodeInstance.metaTags[index].prompt_text = event.target.value;
                autoGrowPromptText();
                saveMetaTags({ redrawCanvas: false, skipRender: true });
            });
            row.querySelector('[data-meta-action="delete"]')?.addEventListener("click", () => {
                if (!confirm(`Delete hidden prompt "${tag.name || "Untitled"}"?`)) return;
                nodeInstance.metaTags.splice(index, 1);
                saveMetaTags();
            });

            list.appendChild(row);
        });

        if (typeof onRender === "function") {
            onRender();
        }
    }

    function loadMetaTagsFromProperties() {
        nodeInstance.metaTags = normalizeMetaTags(readSelectionArray(nodeInstance.properties?.prompt_meta_tags || "[]", []));
        saveMetaTags({ redrawCanvas: false, skipStatus: true });
    }

    function bindAddMetaTagButton() {
        widgetContainer.querySelector(`#${uniqueId}-add-meta-tag-btn`)?.addEventListener("click", () => {
            nodeInstance.metaTags.push({
                id: `meta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name: "",
                prompt_text: "",
                enabled: true,
                order: nodeInstance.metaTags.length,
            });
            saveMetaTags();
            requestAnimationFrame(() => {
                const rows = widgetContainer.querySelectorAll(`#${uniqueId}-meta-tags-list .localprompt-meta-row`);
                const lastRow = rows[rows.length - 1];
                lastRow?.querySelector(".localprompt-meta-text")?.focus();
            });
        });
    }

    return {
        normalizeMetaTags,
        loadMetaTagsFromProperties,
        saveMetaTags,
        renderMetaTags,
        updateMetaTagsButtonState,
        bindAddMetaTagButton,
    };
}
