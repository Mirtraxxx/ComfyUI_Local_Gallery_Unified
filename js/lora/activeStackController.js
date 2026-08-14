import { buildSelectedLoraItemHtml } from "./renderers.js";
import { setupLoraPresetControls } from "./presetControls.js";
import { hydrateSelectedLoraInfo, swapSelectedLoras } from "./activeStackState.js";
import { formatLoraWeight, LORA_WEIGHT_LIMITS, stepLoraWeight } from "./weights.js";

const EMPTY_PREVIEW_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function createLoraActiveStackController({
    nodeInstance,
    widgetContainer,
    selectedListEl,
    activeStackBtn,
    activeStackCount,
    mainContainer,
    metadataEditor,
    uniqueId,
    headerHeight,
    getLoraDisplayState,
    getLoraChromeHeight,
    closeActiveStack,
    clearMetadataEditing,
    findGalleryCardByLoraName,
    renderMetadataEditor,
    updateSelection,
    syncGallerySelection,
    updatePresetButtonText,
}) {
    let draggedIndex = -1;
    let cleanupMouseReorder = null;
    let renderSelectedList = () => {};

    const clearDragMarkers = (root = widgetContainer) => {
        root.querySelectorAll(
            ".locallora-lora-item.drag-over-before, .locallora-lora-item.drag-over-after, .locallora-lora-item.drag-over",
        ).forEach(row => {
            row.classList.remove("drag-over-before", "drag-over-after", "drag-over");
        });
    };

    const bindMouseReorderHandle = (
        row,
        handle,
        rowSelector,
        root,
        onMoved,
        onSimpleClick = null,
    ) => {
        if (!row || !handle) return;

        const shouldStartReorder = event => {
            if (event.target.closest?.(".locallora-selected-thumb")) return true;
            return !event.target.closest?.(
                "button, input, select, textarea, a, .managed-weight-val, .lora-trigger-preset-picker",
            );
        };

        const containsPoint = (rect, x, y) => (
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        );

        handle.addEventListener("pointerdown", event => {
            if (event.button !== 0 || !shouldStartReorder(event)) return;

            const startedFromDragSurface = Boolean(event.target.closest?.(".locallora-selected-thumb"));
            if (startedFromDragSurface) {
                event.preventDefault();
                event.stopPropagation();
            }

            cleanupMouseReorder?.();
            draggedIndex = Number.parseInt(row.dataset.index, 10);
            const pointerId = event.pointerId;
            const startX = event.clientX;
            const startY = event.clientY;
            const startRect = row.getBoundingClientRect();
            const pointerOffsetX = startX - (startRect.left + startRect.width / 2);
            const pointerOffsetY = startY - (startRect.top + startRect.height / 2);
            let hasDragged = false;
            let lastDropMarker = null;
            let pendingMoveEvent = null;
            let geometryFrame = null;
            let rootRect = null;
            let rowRects = [];
            const refreshGeometry = () => {
                rootRect = root.getBoundingClientRect();
                rowRects = Array.from(root.querySelectorAll(rowSelector))
                    .filter(candidate => candidate !== row)
                    .map(candidate => ({ row: candidate, rect: candidate.getBoundingClientRect() }));
            };
            refreshGeometry();
            row.setPointerCapture?.(pointerId);

            const getTargetRow = moveEvent => {
                if (!rowRects.length) return null;
                const dragCenterX = moveEvent.clientX - pointerOffsetX;
                const dragCenterY = moveEvent.clientY - pointerOffsetY;

                if (containsPoint(row.getBoundingClientRect(), dragCenterX, dragCenterY)) return null;
                if (!containsPoint(rootRect, dragCenterX, dragCenterY)) return null;

                const rowUnderPointer = rowRects.find(candidate => containsPoint(candidate.rect, dragCenterX, dragCenterY));
                if (rowUnderPointer) return rowUnderPointer.row;

                return rowRects.reduce((nearestRow, candidate) => {
                    const rect = candidate.rect;
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const distance = Math.hypot(dragCenterX - centerX, dragCenterY - centerY);
                    if (!nearestRow || distance < nearestRow.distance) {
                        return { row: candidate, distance };
                    }
                    return nearestRow;
                }, null)?.row || null;
            };

            const updateMarker = moveEvent => {
                clearDragMarkers(root);
                const targetRow = getTargetRow(moveEvent);
                if (!targetRow) return null;
                targetRow.classList.add("drag-over");
                lastDropMarker = { targetRow };
                return lastDropMarker;
            };

            const onPointerMove = moveEvent => {
                if (moveEvent.pointerId !== pointerId) return;
                if (!hasDragged) {
                    const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
                    if (distance < 4) return;
                    hasDragged = true;
                    row.classList.add("dragging");
                    document.body.style.userSelect = "none";
                }
                moveEvent.preventDefault();
                moveEvent.stopPropagation();
                pendingMoveEvent = moveEvent;
                if (geometryFrame !== null) return;
                geometryFrame = requestAnimationFrame(() => {
                    geometryFrame = null;
                    if (!pendingMoveEvent) return;
                    refreshGeometry();
                    updateMarker(pendingMoveEvent);
                    pendingMoveEvent = null;
                });
            };

            const suppressClickAfterDrag = clickEvent => {
                clickEvent.preventDefault();
                clickEvent.stopPropagation();
                row.removeEventListener("click", suppressClickAfterDrag, true);
            };

            const onPointerUp = upEvent => {
                if (upEvent.pointerId !== pointerId) return;
                if (!hasDragged) {
                    cleanupMouseReorder?.();
                    onSimpleClick?.();
                    return;
                }
                upEvent.preventDefault();
                upEvent.stopPropagation();
                if (geometryFrame !== null) {
                    cancelAnimationFrame(geometryFrame);
                    geometryFrame = null;
                }
                refreshGeometry();
                const marker = updateMarker(upEvent) || lastDropMarker;
                const fromIndex = draggedIndex;
                const targetIndex = marker ? Number.parseInt(marker.targetRow.dataset.index, 10) : -1;
                cleanupMouseReorder?.();
                row.addEventListener("click", suppressClickAfterDrag, true);
                window.setTimeout(() => row.removeEventListener("click", suppressClickAfterDrag, true), 0);
                if (marker && fromIndex >= 0 && targetIndex >= 0 && fromIndex !== targetIndex) {
                    onMoved(fromIndex, targetIndex);
                }
            };

            cleanupMouseReorder = () => {
                row.classList.remove("dragging");
                if (geometryFrame !== null) cancelAnimationFrame(geometryFrame);
                geometryFrame = null;
                pendingMoveEvent = null;
                clearDragMarkers(root);
                draggedIndex = -1;
                document.body.style.userSelect = "";
                if (row.hasPointerCapture?.(pointerId)) row.releasePointerCapture?.(pointerId);
                document.removeEventListener("pointermove", onPointerMove, true);
                document.removeEventListener("pointerup", onPointerUp, true);
                document.removeEventListener("pointercancel", cleanupMouseReorder, true);
                window.removeEventListener("blur", cleanupMouseReorder);
                cleanupMouseReorder = null;
            };

            document.addEventListener("pointermove", onPointerMove, true);
            document.addEventListener("pointerup", onPointerUp, true);
            document.addEventListener("pointercancel", cleanupMouseReorder, true);
            window.addEventListener("blur", cleanupMouseReorder);
        });
    };

    const resolveLoraInfo = (loraName, item = null) => (
        nodeInstance.availableLoras.find(lora => lora.name === loraName) || {
            name: loraName,
            tags: item?.tags || [],
            trigger_words: item?.trigger_words || "",
            trigger_presets: item?.trigger_presets || {},
            download_url: item?.download_url || "",
            preview_url: item?.preview_url || "",
            preview_type: item?.preview_type || "none",
        }
    );

    const repaintLoraOrder = () => {
        renderSelectedList();
        syncGallerySelection();
        nodeInstance.setDirtyCanvas(true, true);
    };

    renderSelectedList = () => {
        document.querySelectorAll(".lora-trigger-preset-popover-portal").forEach(popover => {
            if (popover.dataset.loraPortalOwner !== uniqueId) return;
            if (typeof popover._restoreLoraPresetPopover === "function") {
                popover._restoreLoraPresetPopover();
            } else {
                popover.remove();
            }
        });
        selectedListEl.innerHTML = "";
        activeStackBtn.classList.toggle("has-active", nodeInstance.loraData.length > 0);
        activeStackBtn.classList.toggle("empty", nodeInstance.loraData.length === 0);
        activeStackBtn.disabled = nodeInstance.loraData.length === 0;
        activeStackBtn.title = nodeInstance.loraData.length ? "Show selected LoRAs" : "No selected LoRAs";
        activeStackBtn.setAttribute("aria-pressed", String(mainContainer.classList.contains("active-stack-open")));

        const activeCountEl = widgetContainer.querySelector(`#${uniqueId}-active-count`);
        if (activeCountEl) activeCountEl.textContent = `${nodeInstance.loraData.length} selected`;
        if (activeStackCount) activeStackCount.textContent = nodeInstance.loraData.length;

        if (!nodeInstance.loraData.length) {
            closeActiveStack();
            return;
        }

        const displayState = getLoraDisplayState();
        const isCompact = displayState.active_display_mode === "compact";

        nodeInstance.loraData.forEach((item, index) => {
            const lora = resolveLoraInfo(item.lora, item);
            const element = document.createElement("div");
            element.className = "locallora-lora-item";
            element.dataset.index = index;
            element.dataset.loraName = item.lora;
            element.classList.toggle("disabled", !item.on);
            element.title = `${item.lora}\nClick thumbnail to remove • Drag to reorder`;
            element.innerHTML = buildSelectedLoraItemHtml(
                item,
                index,
                lora,
                nodeInstance.isModelOnly,
                isCompact,
                displayState.show_clip_weights,
            );

            setupLoraPresetControls(element, lora, {
                nodeInstance,
                widgetContainer,
                uniqueId,
                updateSelection,
                onPresetApplied: ({ stacking }) => {
                    // Rebuild the active item after a single-preset pick so the
                    // tag button shows the selected state from source data.
                    if (!stacking) {
                        renderSelectedList();
                    }
                },
            });

            if (!isCompact) {
                const previewImage = element.querySelector(".locallora-selected-thumb img");
                if (previewImage) {
                    previewImage.onerror = event => {
                        event.target.src = EMPTY_PREVIEW_IMAGE;
                    };
                    previewImage.draggable = false;
                }
                const previewVideo = element.querySelector(".locallora-selected-thumb video");
                if (previewVideo) {
                    previewVideo.draggable = false;
                    element.addEventListener("mouseenter", () => previewVideo.play().catch(() => {}));
                    element.addEventListener("mouseleave", () => {
                        previewVideo.pause();
                        previewVideo.currentTime = 0;
                    });
                }

                element.querySelector(".lora-active-preview-btn")?.addEventListener("click", event => {
                    event.stopPropagation();
                    const loraName = item.lora;
                    const isEditingThisLora = nodeInstance.activeEditingLoraName === loraName
                        || (
                            nodeInstance.selectedLoraNamesForEditing.size === 1
                            && nodeInstance.selectedLoraNamesForEditing.has(loraName)
                        );
                    if (isEditingThisLora && metadataEditor.classList.contains("visible")) {
                        clearMetadataEditing();
                        return;
                    }
                    const card = findGalleryCardByLoraName(loraName);
                    document.querySelectorAll(`#${uniqueId} .locallora-lora-card.selected-edit`).forEach(
                        candidate => candidate.classList.remove("selected-edit"),
                    );
                    nodeInstance.selectedLoraNamesForEditing.clear();
                    if (card) {
                        nodeInstance.activeEditingLoraName = null;
                        nodeInstance.selectedLoraNamesForEditing.add(loraName);
                        card.classList.add("selected-edit");
                    } else {
                        nodeInstance.activeEditingLoraName = loraName;
                    }
                    renderMetadataEditor();
                });
            }

            element.querySelector(".lora-selected-toggle-pill")?.addEventListener("click", event => {
                event.stopPropagation();
                nodeInstance.loraData[index].on = !nodeInstance.loraData[index].on;
                const enabled = nodeInstance.loraData[index].on;
                element.classList.toggle("disabled", !enabled);
                const toggle = event.currentTarget;
                toggle.classList.toggle("on", enabled);
                toggle.classList.toggle("off", !enabled);
                toggle.textContent = enabled ? "ON" : "OFF";
                updateSelection();
            });

            const bindWeightWheel = (selector, field, min, max, getCurrentValue) => {
                const valueElement = element.querySelector(selector);
                valueElement?.addEventListener("wheel", event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const nextValue = stepLoraWeight(
                        getCurrentValue(),
                        event.deltaY < 0 ? 1 : -1,
                        min,
                        max,
                    );
                    nodeInstance.loraData[index][field] = nextValue;
                    valueElement.textContent = formatLoraWeight(nextValue);
                    updateSelection();
                }, { passive: false });
            };
            bindWeightWheel(
                ".selected-strength-model",
                "strength",
                LORA_WEIGHT_LIMITS.modelMin,
                LORA_WEIGHT_LIMITS.modelMax,
                () => nodeInstance.loraData[index].strength ?? 1,
            );
            bindWeightWheel(
                ".selected-strength-clip",
                "strength_clip",
                LORA_WEIGHT_LIMITS.clipMin,
                LORA_WEIGHT_LIMITS.clipMax,
                () => nodeInstance.loraData[index].strength_clip ?? nodeInstance.loraData[index].strength ?? 1,
            );

            const removeActiveLora = event => {
                event?.stopPropagation?.();
                const loraNameToRemove = item.lora;
                const removeIndex = nodeInstance.loraData.findIndex(entry => entry.lora === loraNameToRemove);
                if (removeIndex > -1) nodeInstance.loraData.splice(removeIndex, 1);
                renderSelectedList();
                updateSelection();
                syncGallerySelection();
                if (mainContainer.classList.contains("gallery-collapsed")) {
                    setTimeout(() => {
                        nodeInstance.size[1] = getLoraChromeHeight() + headerHeight;
                        nodeInstance.setDirtyCanvas(true, true);
                    }, 0);
                }
                updatePresetButtonText(null);
            };

            element.querySelectorAll(".remove-lora-btn").forEach(removeTarget => {
                removeTarget.addEventListener("pointerdown", event => event.stopPropagation());
                removeTarget.addEventListener("click", removeActiveLora);
            });

            const dragHandle = element.querySelector(".locallora-selected-thumb") || element;
            const onThumbClickRemove = dragHandle.classList.contains("locallora-selected-thumb")
                ? () => removeActiveLora()
                : null;
            bindMouseReorderHandle(
                element,
                dragHandle,
                ".locallora-lora-item",
                selectedListEl,
                (fromIndex, targetIndex) => {
                    const reordered = swapSelectedLoras(nodeInstance.loraData, fromIndex, targetIndex);
                    if (reordered === nodeInstance.loraData) return;
                    nodeInstance.loraData = reordered;
                    repaintLoraOrder();
                    updateSelection();
                },
                onThumbClickRemove,
            );

            selectedListEl.appendChild(element);
        });
    };

    return {
        hydrateSelectedLoraInfo: (availableLoras = nodeInstance.availableLoras) => hydrateSelectedLoraInfo(
            nodeInstance.loraData,
            availableLoras,
        ),
        renderSelectedList,
        repaintLoraOrder,
        dispose() {
            cleanupMouseReorder?.();
        },
    };
}
