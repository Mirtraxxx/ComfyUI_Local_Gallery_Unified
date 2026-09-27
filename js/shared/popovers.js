// One open panel at a time per gallery. Panels toggle the `hidden` attribute and
// their trigger button mirrors the state in aria-expanded.
export function createPopoverGroup(root, { onChange } = {}) {
    const triggers = new Map();

    function setOpen(panel, open) {
        panel.hidden = !open;
        triggers.get(panel)?.setAttribute("aria-expanded", String(open));
    }

    function openPanel() {
        for (const panel of triggers.keys()) if (!panel.hidden) return panel;
        return null;
    }

    // Keep the panel inside the node: DOM widgets are scaled with the canvas,
    // so measure in screen pixels and convert back to CSS pixels.
    function fit(panel) {
        panel.style.maxHeight = "";
        panel.style.translate = "";
        const box = root.getBoundingClientRect();
        const rect = panel.getBoundingClientRect();
        const scale = box.width / (root.offsetWidth || box.width) || 1;
        const room = panel.matches(".lg-drop, .lg-overflow") ? box.bottom - rect.top : rect.bottom - box.top;
        panel.style.maxHeight = `${Math.max(120, Math.floor((room - 8 * scale) / scale))}px`;
        const shift = Math.min(0, box.right - 8 * scale - rect.right) || Math.max(0, box.left + 8 * scale - rect.left);
        if (shift) panel.style.translate = `${Math.round(shift / scale)}px 0`;
    }

    function close(except = null) {
        let changed = false;
        for (const panel of triggers.keys()) {
            if (panel === except || panel.hidden) continue;
            setOpen(panel, false);
            changed = true;
        }
        if (changed) onChange?.(null);
    }

    function open(panel) {
        close(panel);
        setOpen(panel, true);
        fit(panel);
        onChange?.(panel);
    }

    function register(button, panel, onOpen = null) {
        triggers.set(panel, button);
        button.setAttribute("aria-controls", panel.id || "");
        button.setAttribute("aria-expanded", "false");
        panel.hidden = true;
        button.addEventListener("click", async event => {
            event.preventDefault();
            if (!panel.hidden) {
                close();
                return;
            }
            await onOpen?.();
            open(panel);
        });
    }

    const onPointerDown = event => {
        const current = openPanel();
        if (!current) return;
        const path = event.composedPath();
        if (path.includes(current) || path.includes(triggers.get(current))) return;
        if (path.some(el => el.classList?.contains("lg-menu"))) return;
        close();
    };
    const onKeyDown = event => {
        if (event.key === "Escape" && openPanel()) close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    root.addEventListener("keydown", onKeyDown);

    return {
        register,
        open,
        close,
        fit,
        isOpen: () => Boolean(openPanel()),
        dispose() {
            document.removeEventListener("pointerdown", onPointerDown, true);
            root.removeEventListener("keydown", onKeyDown);
        },
    };
}
