const LORA_FOLDER_COLORS = ["#ef4444", "#f97316", "#22c55e", "#14b8a6", "#3b82f6", "#06b6d4", "#ec4899", "#8b5cf6", "#94a3b8"];

/** Owns LoRA folder navigation, pinning, coloring, and pointer-based reorder state. */
export function createLoraFolderController({
    nodeInstance,
    widgetContainer,
    folderFilterSelect,
    folderStrip,
    folderOverflow,
    folderOverflowChips,
    folderPullTab,
    getVisiblePinnedFolderCount,
    saveStateAndFetch,
}) {
    let folderOverflowOpen = false;
    let folderDragState = null;
    let suppressFolderClickUntil = 0;
    const getFolderLabel = (folder) => {
        if (!folder) return "All Folders";
        return folder === "." ? "Root" : String(folder).replaceAll('\\', '/');
    };
     const getFolderColor = (folder, index) => {
        if (nodeInstance.loraUiState.folder_colors && nodeInstance.loraUiState.folder_colors[folder]) {
            return nodeInstance.loraUiState.folder_colors[folder];
        }
        if (!folder) return "#8fb6d9";
        let hash = 0;
        String(folder).split("").forEach(char => {
            hash = ((hash << 5) - hash) + char.charCodeAt(0);
            hash |= 0;
        });
        return LORA_FOLDER_COLORS[Math.abs(hash || index) % LORA_FOLDER_COLORS.length];
    };
     const buildFolderButton = (folder, index, isOverflow = false) => {
        const label = getFolderLabel(folder);
        const isActive = folderFilterSelect.value === folder;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `lora-folder-pill${isActive ? " active" : ""}`;
        button.textContent = label;
        button.title = label;
        button.dataset.folder = folder;
        const isPinned = (nodeInstance.loraUiState.pinned_folders || []).includes(folder);
        button.dataset.pinned = String(isPinned);
        const color = getFolderColor(folder, index);
        button.style.setProperty("--folder-color", color);
        button.style.setProperty("--folder-glow", `${color}55`);
        button.addEventListener("click", (e) => {
            if (Date.now() < suppressFolderClickUntil) {
                e.stopImmediatePropagation();
                return;
            }
            folderFilterSelect.value = folder;
            folderOverflowOpen = false;
            renderFolderPills();
            saveStateAndFetch();
        });
         // Context Menu
        button.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            showLoraFolderContextMenu(event, folder, isPinned);
        });
         // Pointer Long Press & Drag setup
        let longPressTimer = null;
        let startX = 0;
        let startY = 0;
         button.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            if (event.target.closest("button:not(.lora-folder-pill), input, select, textarea")) return;

            startX = event.clientX;
            startY = event.clientY;
            if (longPressTimer) clearTimeout(longPressTimer);

            longPressTimer = setTimeout(() => {
                suppressFolderClickUntil = Date.now() + 250;
                showLoraFolderContextMenu(event, folder, isPinned);
            }, 500);
             folderDragState = {
                pill: button,
                folder,
                isPinned,
                startX: event.clientX,
                startY: event.clientY,
                active: false,
                pointerId: event.pointerId,
            };
            button.setPointerCapture?.(event.pointerId);
        });
         button.addEventListener("pointermove", (event) => {
            if (longPressTimer && Math.hypot(event.clientX - startX, event.clientY - startY) > 5) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
         button.addEventListener("pointerup", (event) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
         button.addEventListener("pointercancel", () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
         if (isOverflow) button.dataset.overflow = "true";
        return button;
    };
     const getFolderOptions = () => Array.from(folderFilterSelect.options).map(option => option.value);
     const getFoldersInCurrentOrder = (discoveredFolders) => {
        const folderSet = new Set(discoveredFolders);
        const ordered = (nodeInstance.loraUiState.folder_order || []).filter(f => folderSet.has(f));
        const orderedSet = new Set(ordered);
        return [...ordered, ...discoveredFolders.filter(f => !orderedSet.has(f))];
    };
     const renderFolderPills = () => {
        if (!folderStrip || !folderOverflow || !folderOverflowChips) return;
        const discovered = getFolderOptions();
        const pinned = nodeInstance.loraUiState.pinned_folders || [];
        const maxVisible = getVisiblePinnedFolderCount();

        const visiblePinned = pinned.slice(0, maxVisible);
        const visiblePinnedSet = new Set(visiblePinned);

        const orderedAll = getFoldersInCurrentOrder(discovered);
        const overflowFolders = orderedAll.filter(f => !visiblePinnedSet.has(f));
         folderStrip.innerHTML = "";
        visiblePinned.forEach((folder, index) => {
            folderStrip.appendChild(buildFolderButton(folder, index));
        });
         folderOverflowChips.innerHTML = "";
        overflowFolders.forEach((folder, index) => {
            folderOverflowChips.appendChild(buildFolderButton(folder, index + visiblePinned.length, true));
        });
         const hasOverflow = overflowFolders.length > 0;
        folderOverflow.classList.toggle("open", hasOverflow && folderOverflowOpen);
        if (folderPullTab) {
            folderPullTab.style.display = hasOverflow ? "flex" : "none";
            folderPullTab.classList.toggle("open", hasOverflow && folderOverflowOpen);
            folderPullTab.setAttribute("aria-expanded", String(hasOverflow && folderOverflowOpen));
        }
    };
     let activeLoraFolderContextMenu = null;
    const closeLoraFolderContextMenu = () => {
        if (activeLoraFolderContextMenu) {
            activeLoraFolderContextMenu.remove();
            activeLoraFolderContextMenu = null;
        }
    };
     function showLoraFolderContextMenu(e, folder, isCurrentlyPinned) {
        closeLoraFolderContextMenu();

        const menu = document.createElement("div");
        menu.className = "lora-folder-ctx-menu";

        const presetColors = ["#ef4444", "#f97316", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8"];
        const activeColor = nodeInstance.loraUiState.folder_colors?.[folder] || "";

        let colorsHtml = presetColors.map(color => `
            <button class="color-dot${activeColor === color ? ' active' : ''}" style="background-color: ${color};" data-color="${color}"></button>
        `).join("");

        menu.innerHTML = `
            <div class="menu-item pin-toggle-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>${isCurrentlyPinned ? "Unpin Folder" : "Pin Folder"}</span>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-header">Folder Color</div>
            <div class="color-presets-grid">
                ${colorsHtml}
            </div>
            <div class="color-picker-row">
                <label class="custom-color-picker-label">
                    <input type="color" class="custom-color-input" value="${activeColor || "#f97316"}">
                    <span>Custom Color...</span>
                </label>
                <button class="reset-color-btn" style="${activeColor ? "" : "display: none;"}">Reset</button>
            </div>
        `;

        menu.style.position = "fixed";
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        document.body.appendChild(menu);
        activeLoraFolderContextMenu = menu;

        const rect = menu.getBoundingClientRect();
        if (e.clientX + rect.width > window.innerWidth) {
            menu.style.left = `${window.innerWidth - rect.width - 8}px`;
        }
        if (e.clientY + rect.height > window.innerHeight) {
            menu.style.top = `${window.innerHeight - rect.height - 8}px`;
        }

        menu.querySelector(".pin-toggle-btn").addEventListener("click", async () => {
            const discovered = getFolderOptions();
            let pinned = [...(nodeInstance.loraUiState.pinned_folders || [])];
            if (isCurrentlyPinned) {
                pinned = pinned.filter(f => f !== folder);
            } else {
                pinned = [...pinned, folder];
            }
            nodeInstance.loraUiState.pinned_folders = pinned;
            await saveStateAndFetch();
            renderFolderPills();
            closeLoraFolderContextMenu();
        });

        menu.querySelectorAll(".color-dot").forEach(dot => {
            dot.addEventListener("click", async () => {
                const color = dot.dataset.color;
                if (!nodeInstance.loraUiState.folder_colors) {
                    nodeInstance.loraUiState.folder_colors = {};
                }
                nodeInstance.loraUiState.folder_colors[folder] = color;
                await saveStateAndFetch();
                renderFolderPills();
                closeLoraFolderContextMenu();
            });
        });

        const customPicker = menu.querySelector(".custom-color-input");
        customPicker.addEventListener("input", (event) => {
            menu.querySelector(".reset-color-btn").style.display = "";
        });
        customPicker.addEventListener("change", async (event) => {
            const color = event.target.value;
            if (!nodeInstance.loraUiState.folder_colors) {
                nodeInstance.loraUiState.folder_colors = {};
            }
            nodeInstance.loraUiState.folder_colors[folder] = color;
            await saveStateAndFetch();
            renderFolderPills();
            closeLoraFolderContextMenu();
        });

        menu.querySelector(".reset-color-btn").addEventListener("click", async () => {
            if (nodeInstance.loraUiState.folder_colors) {
                delete nodeInstance.loraUiState.folder_colors[folder];
                await saveStateAndFetch();
                renderFolderPills();
            }
            closeLoraFolderContextMenu();
        });
    }
     let lastLoraFolderDragTarget = null;
    function getLoraFolderPillAtPoint(x, y) {
        const el = document.elementFromPoint(x, y);
        return el?.closest(".lora-folder-pill");
    }
    function setLoraFolderDragTarget(element) {
        if (lastLoraFolderDragTarget === element) return;
        clearLoraFolderDragTargets();
        if (element) {
            element.classList.add("drag-over");
            lastLoraFolderDragTarget = element;
        }
    }
    function clearLoraFolderDragTargets() {
        widgetContainer.querySelectorAll(".lora-folder-pill.drag-over").forEach(el => {
            el.classList.remove("drag-over");
        });
        lastLoraFolderDragTarget = null;
    }
     const onLoraFolderPointerMove = async (event) => {
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

        const targetPill = getLoraFolderPillAtPoint(event.clientX, event.clientY);
        if (targetPill && targetPill !== folderDragState.pill) {
            setLoraFolderDragTarget(targetPill);
        } else {
            setLoraFolderDragTarget(null);
        }
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
         const targetPill = getLoraFolderPillAtPoint(event.clientX, event.clientY) || lastLoraFolderDragTarget;
        clearLoraFolderDragTargets();
         if (!targetPill || targetPill === dragState.pill) {
            return;
        }
         const targetFolder = targetPill.dataset.folder;
        const draggedFolder = dragState.folder;
        if (targetFolder === undefined || draggedFolder === undefined) return;
         // Determine if target is pinned or unpinned
        const isTargetPinned = targetPill.dataset.pinned === "true" || targetPill.closest(".lora-folder-strip") !== null;
        const discovered = getFolderOptions();

        let pinned = [...(nodeInstance.loraUiState.pinned_folders || [])];
        const swapItems = (items, first, second) => {
            const firstIndex = items.indexOf(first);
            const secondIndex = items.indexOf(second);
            if (firstIndex < 0 || secondIndex < 0 || firstIndex === secondIndex) return false;
            [items[firstIndex], items[secondIndex]] = [items[secondIndex], items[firstIndex]];
            return true;
        };
         if (isTargetPinned) {
            // Pinned zone drop
            if (!swapItems(pinned, draggedFolder, targetFolder)) {
                pinned = pinned.filter(f => f !== draggedFolder);
                const targetIndex = pinned.indexOf(targetFolder);
                if (targetIndex >= 0) {
                    pinned.splice(targetIndex, 0, draggedFolder);
                } else {
                    pinned.push(draggedFolder);
                }
            }
            if (!pinned.includes(draggedFolder)) {
                pinned.push(draggedFolder);
            }
            nodeInstance.loraUiState.pinned_folders = pinned;
            await saveStateAndFetch();
        } else {
            // Unpinned zone drop
            pinned = pinned.filter(f => f !== draggedFolder);
            const currentFolders = getFoldersInCurrentOrder(discovered);
            const unpinnedOrder = currentFolders.filter(f => !pinned.includes(f));
            if (!swapItems(unpinnedOrder, draggedFolder, targetFolder)) {
                const nextUnpinned = unpinnedOrder.filter(f => f !== draggedFolder);
                const targetIndex = nextUnpinned.indexOf(targetFolder);
                if (targetIndex >= 0) {
                    nextUnpinned.splice(targetIndex, 0, draggedFolder);
                } else {
                    nextUnpinned.push(draggedFolder);
                }
                nodeInstance.loraUiState.folder_order = nextUnpinned;
            } else {
                nodeInstance.loraUiState.folder_order = unpinnedOrder;
            }
            nodeInstance.loraUiState.pinned_folders = pinned;
            await saveStateAndFetch();
        }
        renderFolderPills();
    };
     const onLoraFolderPointerCancel = () => {
        if (folderDragState) {
            folderDragState.pill.classList.remove("pinned-dragging");
            folderDragState.pill.releasePointerCapture?.(folderDragState.pointerId);
            folderDragState = null;
        }
        clearLoraFolderDragTargets();
    };


    return {
        getFolderOptions,
        getFoldersInCurrentOrder,
        renderFolderPills,
        closeLoraFolderContextMenu,
        isContextMenuTarget: target => Boolean(activeLoraFolderContextMenu?.contains(target)),
        onLoraFolderPointerMove,
        onLoraFolderPointerUp,
        onLoraFolderPointerCancel,
        cancelDrag: onLoraFolderPointerCancel,
        toggleOverflow: () => { folderOverflowOpen = !folderOverflowOpen; },
        get overflowOpen() { return folderOverflowOpen; },
        set overflowOpen(value) { folderOverflowOpen = Boolean(value); },
    };
}
