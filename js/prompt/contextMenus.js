import { showAlert } from "../shared/nativeDialogs.js";
export function showPromptActionContextMenu({
    prompt,
    x,
    y,
    hasLastOutput,
    actions,
}) {
    const promptId = prompt?.id ?? prompt?.prompt_id;
    if (!promptId) {
        showAlert("This prompt has no saved prompt id, so it cannot be edited.");
        return;
    }
    const normalizedPrompt = { ...prompt, id: promptId };

    const existingMenu = document.querySelector(".localprompt-context-menu");
    if (existingMenu) existingMenu.remove();
    const existingSub = document.querySelector(".localprompt-submenu");
    if (existingSub) existingSub.remove();

    const menu = document.createElement("div");
    menu.className = "localprompt-context-menu";
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: #2a2a2a;
        border: 1px solid #555;
        border-radius: 6px;
        padding: 4px 0;
        z-index: 110000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        min-width: 150px;
    `;

    const menuItems = [
        { label: "Edit Prompt", action: "edit" },
        { label: "Upload Thumbnail", action: "thumbnail" },
        {
            label: "Use Last Result as Thumbnail",
            action: "use_last_output",
            disabled: !hasLastOutput,
        },
        { label: "Toggle Favorite", action: "favorite" },
        { label: "Reset Usage Count", action: "reset_usage" },
        { label: "Delete Prompt", action: "delete" },
    ];

    menuItems.forEach(({ label, action, disabled }) => {
        const item = document.createElement("div");
        item.textContent = label;
        item.style.cssText = `
            padding: 8px 16px;
            cursor: ${disabled ? "default" : "pointer"};
            font-size: 12px;
            color: ${disabled ? "#555" : "#ddd"};
        `;
        item.addEventListener("mouseenter", () => {
            if (!disabled) {
                item.style.background = "#3a3a3a";
            }
        });
        item.addEventListener("mouseleave", () => item.style.background = "transparent");
        item.addEventListener("click", async () => {
            if (disabled) return;
            menu.remove();
            await actions[action]?.(normalizedPrompt);
        });
        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    if (x + menuRect.width > window.innerWidth) {
        menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
    }
    if (y + menuRect.height > window.innerHeight) {
        menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
    }

    const closeMenu = (event) => {
        const sub = document.querySelector(".localprompt-submenu");
        if (!menu.contains(event.target) && (!sub || !sub.contains(event.target))) {
            menu.remove();
            if (sub) sub.remove();
            document.removeEventListener("click", closeMenu);
        }
    };
    setTimeout(() => document.addEventListener("click", closeMenu), 10);
}

export function showPromptContextMenu({
    event,
    prompt,
    showEditPromptDialog,
    showUploadThumbnailDialog,
    deletePromptWithConfirm,
}) {
    const existingMenu = document.querySelector(".localprompt-context-menu");
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement("div");
    menu.className = "localprompt-context-menu";
    menu.style.cssText = `
        position: fixed;
        left: ${event.clientX}px;
        top: ${event.clientY}px;
        background: #2a2a2a;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 4px 0;
        z-index: 110000;
        min-width: 150px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;

    const options = [
        { label: "Edit", action: () => showEditPromptDialog(prompt) },
        { label: "Upload Thumbnail", action: () => showUploadThumbnailDialog(prompt) },
        { label: "Delete", action: () => deletePromptWithConfirm(prompt) },
    ];

    options.forEach(option => {
        const item = document.createElement("div");
        item.textContent = option.label;
        item.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            font-size: 12px;
            color: #ddd;
        `;
        item.addEventListener("mouseenter", () => item.style.background = "#3a3a3a");
        item.addEventListener("mouseleave", () => item.style.background = "transparent");
        item.addEventListener("click", () => {
            option.action();
            menu.remove();
        });
        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    const closeMenu = (closeEvent) => {
        if (!menu.contains(closeEvent.target)) {
            menu.remove();
            document.removeEventListener("click", closeMenu);
        }
    };

    setTimeout(() => document.addEventListener("click", closeMenu), 0);
}
