import { confirmAction } from "../shared/nativeDialogs.js";
import { createDebouncedCommitter } from "./performance.js?v=prompt-performance-20260721-1";
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
    let activePointerCleanup = null;
    let autoGrowFrame = null;
    let pendingMetaSaveOptions = {};
    const META_SAVE_DEBOUNCE_MS = 220;
    const metaCommitter = createDebouncedCommitter(
        () => commitMetaTags({ ...pendingMetaSaveOptions, skipStatus: true }),
        META_SAVE_DEBOUNCE_MS
    );
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

    function commitMetaTags(options = {}) {
        pendingMetaSaveOptions = {};
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

    /**
     * Persist Hidden Prompts once a short burst of edits settles.  Text input
     * used to stringify, dirty the graph, and rebuild state on every key;
     * keeping state local until this commit preserves execution data while
     * avoiding that hot path.
     */
    function saveMetaTags(options = {}) {
        const immediate = options.immediate === true;
        if (immediate) {
            metaCommitter.dispose({ flushPending: false });
            commitMetaTags(options);
            return;
        }
        pendingMetaSaveOptions = options;
        if (!options.skipStatus) showMetaSaveFeedback();
        updateMetaTagsButtonState();
        metaCommitter.schedule();
    }

    function flushMetaTags(options = {}) {
        if (!metaCommitter.pending) return;
        pendingMetaSaveOptions = { ...pendingMetaSaveOptions, ...options };
        // The committer invokes the canonical quiet commit. Status feedback
        // is already shown at the time the edit was made.
        metaCommitter.flush();
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
                <span class="localprompt-meta-drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                </span>
                <button class="localprompt-meta-toggle ${tag.enabled ? "on" : "off"}" type="button" title="Toggle hidden prompt">${tag.enabled ? "ON" : "OFF"}</button>
                <textarea class="localprompt-meta-text" rows="1" placeholder="Hidden prompt" title="Hidden prompt text">${escapeHtml(tag.prompt_text)}</textarea>
                <button class="localprompt-btn localprompt-meta-action localprompt-clear-btn" data-meta-action="delete" title="Delete hidden prompt">x</button>
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

            promptTextArea?.addEventListener("input", (event) => {
                nodeInstance.metaTags[index].prompt_text = event.target.value;
                if (!autoGrowFrame) {
                    autoGrowFrame = requestAnimationFrame(() => {
                        autoGrowFrame = null;
                        autoGrowPromptText();
                    });
                }
                saveMetaTags({ redrawCanvas: false, skipRender: true });
            });
            promptTextArea?.addEventListener("blur", () => {
                flushMetaTags({ redrawCanvas: false, skipRender: true });
            });
            row.querySelector('[data-meta-action="delete"]')?.addEventListener("click", () => {
                if (!confirmAction(`Delete hidden prompt "${tag.name || "Untitled"}"?`)) return;
                flushMetaTags({ redrawCanvas: false, skipRender: true });
                nodeInstance.metaTags.splice(index, 1);
                saveMetaTags({ immediate: true });
            });

            list.appendChild(row);
        });

        // Setup pointer drag-and-drop reordering
        let pointerDrag = null;

        const clearDropTargets = () => {
            list.querySelectorAll(".localprompt-meta-row.pinned-drop-target").forEach(r => {
                r.classList.remove("pinned-drop-target");
            });
        };

        const getMetaRowAtPoint = (clientX, clientY) => {
            const element = document.elementFromPoint(clientX, clientY);
            const r = element?.closest?.(".localprompt-meta-row[data-meta-id]");
            return r && list.contains(r) ? r : null;
        };

        list.querySelectorAll(".localprompt-meta-row[data-meta-id]").forEach(row => {
            const handle = row.querySelector(".localprompt-meta-drag-handle");
            if (!handle) return;

            handle.addEventListener("pointerdown", event => {
                if (event.button !== 0) return;
                event.preventDefault();
                pointerDrag = {
                    row,
                    metaId: row.dataset.metaId,
                    startX: event.clientX,
                    startY: event.clientY,
                    active: false,
                };

                const onPointerMove = moveEvent => {
                    if (!pointerDrag) return;
                    const distance = Math.hypot(moveEvent.clientX - pointerDrag.startX, moveEvent.clientY - pointerDrag.startY);
                    if (!pointerDrag.active && distance < 4) return;

                    if (!pointerDrag.active) {
                        pointerDrag.active = true;
                        pointerDrag.row.classList.add("pinned-dragging");
                    }

                    moveEvent.preventDefault();
                    clearDropTargets();
                    const targetRow = getMetaRowAtPoint(moveEvent.clientX, moveEvent.clientY);
                    if (targetRow && targetRow !== pointerDrag.row) {
                        targetRow.classList.add("pinned-drop-target");
                    }
                };

                const onPointerUp = async upEvent => {
                    if (!pointerDrag) return;
                    const dragState = pointerDrag;
                    pointerDrag = null;

                    const cleanup = activePointerCleanup;
                    activePointerCleanup = null;
                    cleanup?.();

                    dragState.row.classList.remove("pinned-dragging");
                    const targetRow = getMetaRowAtPoint(upEvent.clientX, upEvent.clientY)
                        || list.querySelector(".localprompt-meta-row.pinned-drop-target");
                    clearDropTargets();

                    if (!dragState.active) return;
                    upEvent.preventDefault();

                    if (!targetRow || targetRow === dragState.row) return;

                    const targetRect = targetRow.getBoundingClientRect();
                    const placeAfter = upEvent.clientY > targetRect.top + targetRect.height / 2;
                    if (placeAfter) {
                        targetRow.after(dragState.row);
                    } else {
                        targetRow.before(dragState.row);
                    }

                    // Save new order
                    const nextOrderIds = Array.from(list.querySelectorAll(".localprompt-meta-row[data-meta-id]"))
                        .map(r => r.dataset.metaId)
                        .filter(Boolean);

                    const tagsMap = new Map(nodeInstance.metaTags.map(tag => [tag.id, tag]));
                    nodeInstance.metaTags = nextOrderIds.map((id, index) => {
                        const tag = tagsMap.get(id);
                        return { ...tag, order: index };
                    });

                    // Save and re-render
                    saveMetaTags({ immediate: true });
                };

                const onPointerCancel = () => {
                    if (pointerDrag) {
                        pointerDrag.row.classList.remove("pinned-dragging");
                        pointerDrag = null;
                    }
                    clearDropTargets();
                    const cleanup = activePointerCleanup;
                    activePointerCleanup = null;
                    cleanup?.();
                };

                activePointerCleanup = () => {
                    window.removeEventListener("pointermove", onPointerMove);
                    window.removeEventListener("pointerup", onPointerUp);
                    window.removeEventListener("pointercancel", onPointerCancel);
                    pointerDrag?.row.classList.remove("pinned-dragging");
                    pointerDrag = null;
                    clearDropTargets();
                };
                window.addEventListener("pointermove", onPointerMove);
                window.addEventListener("pointerup", onPointerUp);
                window.addEventListener("pointercancel", onPointerCancel);
            });
        });

        if (typeof onRender === "function") {
            onRender();
        }
    }

    function loadMetaTagsFromProperties() {
        nodeInstance.metaTags = normalizeMetaTags(readSelectionArray(nodeInstance.properties?.prompt_meta_tags || "[]", []));
        saveMetaTags({ immediate: true, redrawCanvas: false, skipStatus: true });
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
            flushMetaTags({ redrawCanvas: false, skipRender: true });
            saveMetaTags({ immediate: true });
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
        flushMetaTags,
        renderMetaTags,
        updateMetaTagsButtonState,
        bindAddMetaTagButton,
        dispose() {
            flushMetaTags({ redrawCanvas: false, skipRender: true });
            activePointerCleanup?.();
            activePointerCleanup = null;
            if (metaSaveStatusTimer) {
                clearTimeout(metaSaveStatusTimer);
                metaSaveStatusTimer = null;
            }
            if (autoGrowFrame) {
                cancelAnimationFrame(autoGrowFrame);
                autoGrowFrame = null;
            }
        },
    };
}
