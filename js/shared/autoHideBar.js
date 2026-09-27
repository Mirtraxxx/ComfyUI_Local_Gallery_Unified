// Optional auto-hide for a gallery's bottom bar: it slides away until hovered,
// and stays out while a popover inside it is open or one of its fields has focus.
export function createAutoHideBar(root, bar, isEnabled) {
    let hovered = false;
    let pressing = false;
    let hideTimer = null;

    function hasFocusedField() {
        const active = document.activeElement;
        return Boolean(active && bar.contains(active) && active.closest("input, select, textarea"));
    }

    function sync() {
        const enabled = isEnabled();
        root.classList.toggle("auto-hide-toolbars", enabled);
        const reveal = enabled && (hovered || pressing || hasFocusedField() || Boolean(bar.querySelector(".lg-popover:not([hidden])")));
        bar.classList.toggle("toolbar-revealed", reveal);
    }

    const onEnter = () => {
        clearTimeout(hideTimer);
        hovered = true;
        sync();
    };
    const onLeave = () => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            hovered = false;
            sync();
        }, 750);
    };
    const onRelease = () => {
        pressing = false;
        window.removeEventListener("pointerup", onRelease);
        window.removeEventListener("pointercancel", onRelease);
        sync();
    };
    const onPress = () => {
        pressing = true;
        window.addEventListener("pointerup", onRelease);
        window.addEventListener("pointercancel", onRelease);
    };
    const onFocusOut = () => setTimeout(sync, 0);

    bar.addEventListener("mouseenter", onEnter);
    bar.addEventListener("mouseleave", onLeave);
    bar.addEventListener("pointerdown", onPress);
    bar.addEventListener("focusin", sync);
    bar.addEventListener("focusout", onFocusOut);
    sync();

    return {
        sync,
        dispose() {
            clearTimeout(hideTimer);
            onRelease();
        },
    };
}
