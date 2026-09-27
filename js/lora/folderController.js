import { showPillMenu } from "../shared/pillMenu.js";
import { fitPillStrip, makePill, observePillStrip, renderPillOverflow } from "../shared/pillStrip.js";

const INITIAL_PINNED_FOLDER_COUNT = 8;

export function getFolderLabel(folder) {
    if (!folder) return "All Folders";
    return folder === "." ? "Root" : String(folder).replaceAll("\\", "/");
}

/** Owns LoRA folder navigation, pinning, coloring, and pointer-based reorder state. */
export function createLoraFolderController({
    nodeInstance,
    widgetContainer,
    folderFilterSelect,
    folderStrip,
    folderOverflow,
    folderMoreBtn,
    closeOverflow,
    persistState,
    saveStateAndFetch,
}) {
    const searchState = { query: "" };
    const longPressTimers = new Set();
    const stripObserver = observePillStrip(folderStrip);
    let folderDragState = null;
    let suppressFolderClickUntil = 0;

    const getFolderOptions = () => Array.from(folderFilterSelect.options).map(option => option.value);
    const getFoldersInCurrentOrder = (discoveredFolders) => {
        const folderSet = new Set(discoveredFolders);
        const ordered = (nodeInstance.loraUiState.folder_order || []).filter(f => folderSet.has(f));
        const orderedSet = new Set(ordered);
        return [...ordered, ...discoveredFolders.filter(f => !orderedSet.has(f))];
    };

    /** Drop pins and order entries for folders that no longer exist; seed pins on first use. */
    const syncFolders = (folders) => {
        const valid = new Set(["", ...folders]);
        const state = nodeInstance.loraUiState;
        state.folder_order = Array.isArray(state.folder_order) ? state.folder_order.filter(f => valid.has(f)) : [];
        state.pinned_folders = Array.isArray(state.pinned_folders)
            ? state.pinned_folders.filter(f => valid.has(f))
            : ["", ...getFoldersInCurrentOrder(folders)].slice(0, INITIAL_PINNED_FOLDER_COUNT);
    };

    const clearLongPressTimers = () => {
        longPressTimers.forEach(timer => clearTimeout(timer));
        longPressTimers.clear();
    };

    const selectFolder = (folder) => {
        folderFilterSelect.value = folderFilterSelect.value === folder ? "" : folder;
        closeOverflow();
        renderFolderPills();
        saveStateAndFetch();
    };

    const buildFolderPill = (folder, isPinned) => {
        const pill = makePill({
            label: getFolderLabel(folder),
            color: nodeInstance.loraUiState.folder_colors?.[folder],
            active: folderFilterSelect.value === folder,
            pinned: isPinned,
        });
        pill.classList.add("lora-folder-pill");
        pill.dataset.folder = folder;

        let longPressTimer = null;
        let startX = 0;
        let startY = 0;
        const clearLongPress = () => {
            if (!longPressTimer) return;
            clearTimeout(longPressTimer);
            longPressTimers.delete(longPressTimer);
            longPressTimer = null;
        };

        pill.addEventListener("click", (event) => {
            if (Date.now() < suppressFolderClickUntil) {
                event.stopImmediatePropagation();
                return;
            }
            selectFolder(folder);
        });
        pill.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            showFolderMenu(event, folder, isPinned);
        });
        pill.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            startX = event.clientX;
            startY = event.clientY;
            clearLongPress();
            longPressTimer = setTimeout(() => {
                longPressTimers.delete(longPressTimer);
                longPressTimer = null;
                suppressFolderClickUntil = Date.now() + 250;
                showFolderMenu(event, folder, isPinned);
            }, 500);
            longPressTimers.add(longPressTimer);
            folderDragState = {
                pill,
                folder,
                startX: event.clientX,
                startY: event.clientY,
                active: false,
                pointerId: event.pointerId,
            };
            pill.setPointerCapture?.(event.pointerId);
        });
        pill.addEventListener("pointermove", (event) => {
            if (longPressTimer && Math.hypot(event.clientX - startX, event.clientY - startY) > 5) clearLongPress();
        });
        pill.addEventListener("pointerup", clearLongPress);
        pill.addEventListener("pointercancel", clearLongPress);
        return pill;
    };

    const renderFolderPills = () => {
        clearLongPressTimers();
        const folders = getFolderOptions();
        const pinned = (nodeInstance.loraUiState.pinned_folders || []).filter(f => folders.includes(f));
        const pinnedSet = new Set(pinned);
        folderStrip.replaceChildren(...pinned.map(folder => buildFolderPill(folder, true)));
        fitPillStrip(folderStrip);

        const ordered = [...pinned, ...getFoldersInCurrentOrder(folders).filter(f => !pinnedSet.has(f))];
        folderMoreBtn.hidden = ordered.length === 0;
        renderPillOverflow(folderOverflow, ordered.map(folder => buildFolderPill(folder, pinnedSet.has(folder))), {
            state: searchState,
            placeholder: "Search folders",
            emptyText: "No folders match your search.",
            onPick: pill => selectFolder(pill.dataset.folder),
            onClose: () => {
                closeOverflow();
                folderMoreBtn.focus();
            },
        });
    };

    function showFolderMenu(event, folder, isPinned) {
        showPillMenu(event, {
            pinned: isPinned,
            color: nodeInstance.loraUiState.folder_colors?.[folder] || "",
            onTogglePin: async () => {
                const pinned = nodeInstance.loraUiState.pinned_folders || [];
                nodeInstance.loraUiState.pinned_folders = isPinned ? pinned.filter(f => f !== folder) : [...pinned, folder];
                renderFolderPills();
                await persistState();
            },
            onColor: async color => {
                const colors = { ...(nodeInstance.loraUiState.folder_colors || {}) };
                if (color) colors[folder] = color;
                else delete colors[folder];
                nodeInstance.loraUiState.folder_colors = colors;
                renderFolderPills();
                await persistState();
            },
        });
    }

    let lastDragTarget = null;
    const getFolderPillAtPoint = (x, y) => document.elementFromPoint(x, y)?.closest(".lora-folder-pill");
    const clearDragTargets = () => {
        widgetContainer.querySelectorAll(".lora-folder-pill.drag-over").forEach(el => el.classList.remove("drag-over"));
        lastDragTarget = null;
    };
    const setDragTarget = (element) => {
        if (lastDragTarget === element) return;
        clearDragTargets();
        if (element) {
            element.classList.add("drag-over");
            lastDragTarget = element;
        }
    };

    const onLoraFolderPointerMove = (event) => {
        if (!folderDragState) return;
        const distance = Math.hypot(event.clientX - folderDragState.startX, event.clientY - folderDragState.startY);
        if (!folderDragState.active && distance < 8) return;
        if (!folderDragState.active) {
            folderDragState.active = true;
            folderDragState.pill.classList.add("pinned-dragging");
            suppressFolderClickUntil = Date.now() + 200;
        }
        event.preventDefault();
        event.stopPropagation();
        const targetPill = getFolderPillAtPoint(event.clientX, event.clientY);
        setDragTarget(targetPill && targetPill !== folderDragState.pill ? targetPill : null);
    };

    const swapItems = (items, first, second) => {
        const firstIndex = items.indexOf(first);
        const secondIndex = items.indexOf(second);
        if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return false;
        [items[firstIndex], items[secondIndex]] = [items[secondIndex], items[firstIndex]];
        return true;
    };
    const moveBefore = (items, item, target) => {
        const next = items.filter(entry => entry !== item);
        const targetIndex = next.indexOf(target);
        next.splice(targetIndex >= 0 ? targetIndex : next.length, 0, item);
        return next;
    };

    const onLoraFolderPointerUp = async (event) => {
        if (!folderDragState) return;
        const dragState = folderDragState;
        folderDragState = null;
        dragState.pill.classList.remove("pinned-dragging");
        dragState.pill.releasePointerCapture?.(dragState.pointerId);
        if (!dragState.active) return;
        event.preventDefault();
        event.stopPropagation();
        suppressFolderClickUntil = Date.now() + 250;

        const targetPill = getFolderPillAtPoint(event.clientX, event.clientY) || lastDragTarget;
        clearDragTargets();
        if (!targetPill || targetPill === dragState.pill) return;
        const targetFolder = targetPill.dataset.folder;
        const draggedFolder = dragState.folder;

        let pinned = [...(nodeInstance.loraUiState.pinned_folders || [])];
        if (targetPill.dataset.pinned === "true") {
            if (!swapItems(pinned, draggedFolder, targetFolder)) pinned = moveBefore(pinned, draggedFolder, targetFolder);
        } else {
            pinned = pinned.filter(f => f !== draggedFolder);
            const unpinnedOrder = getFoldersInCurrentOrder(getFolderOptions()).filter(f => !pinned.includes(f));
            nodeInstance.loraUiState.folder_order = swapItems(unpinnedOrder, draggedFolder, targetFolder)
                ? unpinnedOrder
                : moveBefore(unpinnedOrder, draggedFolder, targetFolder);
        }
        nodeInstance.loraUiState.pinned_folders = pinned;
        renderFolderPills();
        await persistState();
    };

    const cancelDrag = () => {
        if (folderDragState) {
            folderDragState.pill.classList.remove("pinned-dragging");
            folderDragState.pill.releasePointerCapture?.(folderDragState.pointerId);
            folderDragState = null;
        }
        clearDragTargets();
    };

    return {
        getFoldersInCurrentOrder,
        syncFolders,
        renderFolderPills,
        onLoraFolderPointerMove,
        onLoraFolderPointerUp,
        onLoraFolderPointerCancel: cancelDrag,
        cancelDrag,
        dispose() {
            clearLongPressTimers();
            cancelDrag();
            stripObserver.disconnect();
        },
    };
}
