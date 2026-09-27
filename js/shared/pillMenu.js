import { icon } from "./icons.js";

const PRESET_COLORS = ["#ef4444", "#f97316", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8"];

let currentMenu = null;

const onPointerDown = event => {
    if (currentMenu && !currentMenu.contains(event.target)) closePillMenu();
};
const onKeyDown = event => {
    if (event.key === "Escape") closePillMenu();
};

export function closePillMenu() {
    if (!currentMenu) return;
    currentMenu.remove();
    currentMenu = null;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("resize", closePillMenu);
}

// Right-click / long-press menu for category and folder pills. `onColor` gets a
// hex color, or null to go back to the automatic color.
export function showPillMenu(event, { pinned, color, onTogglePin, onColor }) {
    closePillMenu();
    const menu = document.createElement("div");
    menu.className = "lg-menu";
    menu.style.position = "fixed";
    menu.innerHTML = `
        <div class="menu-item" data-pin>${icon("pin")}<span>${pinned ? "Unpin from top bar" : "Pin to top bar"}</span></div>
        <div class="menu-divider"></div>
        <div class="menu-header">Color</div>
        <div class="color-presets-grid">
            ${PRESET_COLORS.map(preset => `<button class="color-dot${preset === color ? " active" : ""}" type="button" style="background-color: ${preset};" data-color="${preset}" aria-label="${preset}"></button>`).join("")}
        </div>
        <div class="color-picker-row">
            <label class="custom-color-picker-label">
                <input type="color" class="custom-color-input" value="${color || "#3b82f6"}">
                <span>Custom...</span>
            </label>
            ${color ? `<button class="reset-color-btn" type="button">Reset</button>` : ""}
        </div>`;
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8))}px`;
    currentMenu = menu;

    const choose = action => {
        closePillMenu();
        return action();
    };
    menu.querySelector("[data-pin]").addEventListener("click", () => choose(onTogglePin));
    menu.querySelectorAll("[data-color]").forEach(dot => {
        dot.addEventListener("click", () => choose(() => onColor(dot.dataset.color)));
    });
    const picker = menu.querySelector(".custom-color-input");
    picker.addEventListener("change", () => choose(() => onColor(picker.value)));
    menu.querySelector(".reset-color-btn")?.addEventListener("click", () => choose(() => onColor(null)));

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", closePillMenu);
}
