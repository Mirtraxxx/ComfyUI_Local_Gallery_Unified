/** Owns Prompt Builder's auto-hide bottom-toolbar hover/timer lifecycle. */
export function createBottomToolbarController({ widgetContainer, uniqueId, isAutoHideEnabled }) {
    let hovered = false;
    let interacting = false;
    let hideTimer = null;
    let releaseCleanup = null;
    const deferredSyncTimers = new Set();
    let disposed = false;

    function ensureConnectedLifecycle() {
        if (!disposed) return true;
        if (!widgetContainer.isConnected) return false;
        disposed = false;
        return true;
    }

    function toolbarHasFocusedElement(toolbar) {
        if (!toolbar || !document.activeElement || !toolbar.contains(document.activeElement)) return false;
        return !!document.activeElement.closest("input, select, textarea, [contenteditable='true']");
    }

    function hasOpenBottomToolbarPanel() {
        const sizeControls = widgetContainer.querySelector(`#${uniqueId}-size-controls`);
        const wildcardControls = widgetContainer.querySelector(`#${uniqueId}-wildcard-controls`);
        return !!(
            (sizeControls && sizeControls.style.display !== 'none')
            || (wildcardControls && wildcardControls.style.display !== 'none')
        );
    }

    function sync() {
        if (!ensureConnectedLifecycle()) return;
        const bottomBar = widgetContainer.querySelector(".localprompt-bottom-bar");
        const enabled = isAutoHideEnabled();
        widgetContainer.classList.toggle("auto-hide-toolbars", enabled);
        if (!enabled) {
            bottomBar?.classList.remove("toolbar-revealed", "toolbar-pinned");
            return;
        }
        if (bottomBar) {
            const pinned = hasOpenBottomToolbarPanel() || toolbarHasFocusedElement(bottomBar) || interacting;
            bottomBar.classList.toggle("toolbar-pinned", pinned);
            bottomBar.classList.toggle("toolbar-revealed", pinned || hovered);
        }
    }

    function scheduleHide() {
        if (!ensureConnectedLifecycle()) return;
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            hideTimer = null;
            if (disposed) return;
            hovered = false;
            sync();
        }, 750);
    }

    function setup() {
        if (!ensureConnectedLifecycle()) return;
        const bottomBar = widgetContainer.querySelector(".localprompt-bottom-bar");
        if (!bottomBar) return;
        bottomBar.addEventListener("mouseenter", () => {
            hovered = true;
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = null;
            sync();
        });
        bottomBar.addEventListener("mouseleave", scheduleHide);
        bottomBar.addEventListener("focusin", sync);
        bottomBar.addEventListener("focusout", () => {
            const timer = setTimeout(() => {
                deferredSyncTimers.delete(timer);
                sync();
            }, 0);
            deferredSyncTimers.add(timer);
        });
        bottomBar.addEventListener("pointerdown", () => {
            interacting = true;
            sync();
            releaseCleanup?.();
            const releaseInteraction = () => {
                interacting = false;
                sync();
                window.removeEventListener("pointerup", releaseInteraction);
                window.removeEventListener("pointercancel", releaseInteraction);
                if (releaseCleanup === releaseInteraction) releaseCleanup = null;
            };
            releaseCleanup = releaseInteraction;
            window.addEventListener("pointerup", releaseInteraction);
            window.addEventListener("pointercancel", releaseInteraction);
        });
        sync();
    }

    function dispose() {
        disposed = true;
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = null;
        deferredSyncTimers.forEach(timer => clearTimeout(timer));
        deferredSyncTimers.clear();
        releaseCleanup?.();
        releaseCleanup = null;
    }

    return { setup, sync, scheduleHide, dispose };
}
