import { showAlert } from "../shared/nativeDialogs.js";

let disposeActiveContextMenu = null;

export function closePromptContextMenus() {
    disposeActiveContextMenu?.();
    disposeActiveContextMenu = null;
    document.querySelectorAll(".localprompt-context-menu, .localprompt-submenu").forEach(menu => menu.remove());
}

function installOutsideClickDismiss(menu, { includeSubmenu = false, delay = 0 } = {}) {
    let timer = null;
    const closeMenu = event => {
        const submenu = includeSubmenu ? document.querySelector(".localprompt-submenu") : null;
        if (menu.contains(event.target) || submenu?.contains(event.target)) return;
        closePromptContextMenus();
    };
    disposeActiveContextMenu = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        document.removeEventListener("click", closeMenu);
        menu.remove();
        if (includeSubmenu) document.querySelector(".localprompt-submenu")?.remove();
    };
    timer = setTimeout(() => {
        timer = null;
        document.addEventListener("click", closeMenu);
    }, delay);
}

// Menus mount on document.body (or a fullscreen surface), so they carry
// lg-root for the shared tokens and use the chrome lg-menu look.
function openMenu(items, x, y, host = document.body) {
    closePromptContextMenus();
    const menu = document.createElement("div");
    menu.className = "lg-root lg-menu localprompt-context-menu";
    menu.style.position = "fixed";
    menu.style.zIndex = "110000";
    for (const { label, disabled, danger, run } of items) {
        const item = document.createElement("div");
        item.className = `menu-item${disabled ? " disabled" : ""}${danger ? " danger" : ""}`;
        item.textContent = label;
        item.addEventListener("click", async () => {
            if (disabled) return;
            closePromptContextMenus();
            await run();
        });
        menu.appendChild(item);
    }
    host.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    return menu;
}

export function showPromptActionContextMenu({
    prompt,
    x,
    y,
    hasLastOutput,
    actions,
    surfaceHost = null,
}) {
    const promptId = prompt?.id ?? prompt?.prompt_id;
    if (!promptId) {
        showAlert("This prompt has no saved prompt id, so it cannot be edited.");
        return;
    }
    const normalizedPrompt = { ...prompt, id: promptId };
    const run = action => () => actions[action]?.(normalizedPrompt);
    const menu = openMenu([
        { label: "Edit prompt", run: run("edit") },
        { label: "Upload thumbnail", run: run("thumbnail") },
        { label: "Use last result as thumbnail", disabled: !hasLastOutput, run: run("use_last_output") },
        { label: "Toggle favorite", run: run("favorite") },
        { label: "Delete prompt", danger: true, run: run("delete") },
    ], x, y, surfaceHost?.isConnected ? surfaceHost : document.body);
    installOutsideClickDismiss(menu, { includeSubmenu: true, delay: 10 });
}

export function showPromptContextMenu({
    event,
    prompt,
    showEditPromptDialog,
    showUploadThumbnailDialog,
    deletePromptWithConfirm,
}) {
    const menu = openMenu([
        { label: "Edit", run: () => showEditPromptDialog(prompt) },
        { label: "Upload thumbnail", run: () => showUploadThumbnailDialog(prompt) },
        { label: "Delete", danger: true, run: () => deletePromptWithConfirm(prompt) },
    ], event.clientX, event.clientY);
    installOutsideClickDismiss(menu);
}
