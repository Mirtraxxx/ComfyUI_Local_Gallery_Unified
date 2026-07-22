import {
    applyActiveSidebarPreference as applyPromptActiveSidebarPreference,
    renderActiveSidebar as renderPromptActiveSidebar,
} from "./activeSidebar.js?v=prompt-performance-20260721-1";

/** Coordinates the Prompt Active Stack sidebar state, timers, and renders. */
export function createActiveStackController({
    widgetContainer,
    uniqueId,
    nodeInstance,
    activeSidebarWidthWidget,
    saveUiPrefs,
    disposed = () => false,
    hideHoverPreview,
    getActivePromptModels,
    getSelectedPromptEntry,
    applyCategoryRoleStyling,
    bindPinnedManagedControls,
    saveSelectionData,
    renderPrompts,
    getActiveLibraryTab,
    renderLibraryDrawer,
    addPromptToSelection,
    attachInfoPopup,
    attachContextMenu,
    getDisplayMode,
}) {
    let open = false;
    let openTimer = null;
    let closeTimer = null;
    let renderToken = 0;
    let isDisposed = false;

    function isOpen() { return open; }

    function applyPreference() {
        applyPromptActiveSidebarPreference({
            widgetContainer,
            uniqueId,
            nodeInstance,
            activeSidebarWidthWidget,
        });
        const sidebar = widgetContainer.querySelector(`#${uniqueId}-active-sidebar`);
        const toggleBtn = widgetContainer.querySelector(`#${uniqueId}-active-toggle`);
        widgetContainer.classList.toggle("active-sidebar-expanded", open);
        sidebar?.classList.toggle("active", open);
        if (toggleBtn) {
            toggleBtn.classList.toggle("active", open);
            toggleBtn.classList.remove("pinned");
            toggleBtn.setAttribute("aria-pressed", open ? "true" : "false");
        }
    }

    async function render() {
        if (isDisposed || disposed()) return;
        const token = ++renderToken;
        await renderPromptActiveSidebar({
            widgetContainer,
            uniqueId,
            nodeInstance,
            applyActiveSidebarPreference: applyPreference,
            isActiveSidebarOpen: isOpen,
            hideHoverPreview,
            getActivePromptModels,
            getSelectedPromptEntry,
            applyCategoryRoleStyling,
            bindPinnedManagedControls,
            saveSelectionData,
            renderPrompts,
            getActiveLibraryTab,
            renderLibraryDrawer,
            addPromptToSelection,
            attachInfoPopup,
            attachContextMenu,
            getDisplayMode,
            isRenderCurrent: () => !isDisposed && !disposed() && token === renderToken,
        });
    }

    function clearCloseTimer() {
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = null;
    }
    function clearOpenTimer() {
        if (openTimer) clearTimeout(openTimer);
        openTimer = null;
    }
    function clearTimers() {
        clearOpenTimer();
        clearCloseTimer();
    }

    async function togglePeek() {
        clearTimers();
        nodeInstance.uiPrefs.active_sidebar_open = false;
        open = !open;
        applyPreference();
        saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save active sidebar state", error));
        if (open) await render();
    }

    function closeForWorkspaceMode() {
        if (!isOpen()) return;
        clearOpenTimer();
        open = false;
        nodeInstance.uiPrefs.active_sidebar_open = false;
        applyPreference();
        saveUiPrefs().catch(error => console.warn("LocalPromptGallery: Failed to save active sidebar state", error));
    }

    async function setHoverOpen(nextOpen) {
        open = !!nextOpen && nodeInstance.promptData.length > 0;
        applyPreference();
        if (open) await render();
    }

    function hoverBehaviorEnabled() {
        return nodeInstance.uiPrefs?.active_sidebar_hover_open !== false;
    }
    function scheduleHoverOpen() {
        if (!hoverBehaviorEnabled()) return;
        clearTimers();
        if (nodeInstance.promptData.length === 0) return;
        openTimer = setTimeout(() => {
            openTimer = null;
            setHoverOpen(true).catch(error => console.error('LocalPromptGallery: Failed to hover-open active sidebar', error));
        }, 150);
    }
    function scheduleHoverClose() {
        if (!hoverBehaviorEnabled()) return;
        clearTimers();
        closeTimer = setTimeout(() => {
            closeTimer = null;
            open = false;
            applyPreference();
        }, 450);
    }

    function syncSelectionCount() {
        const count = nodeInstance.promptData.length;
        if (count === 0 && open) {
            clearOpenTimer();
            open = false;
            applyPreference();
        }
    }

    function dispose() {
        isDisposed = true;
        renderToken += 1;
        clearTimers();
    }

    return {
        isOpen,
        applyPreference,
        render,
        togglePeek,
        closeForWorkspaceMode,
        setHoverOpen,
        clearOpenTimer,
        clearCloseTimer,
        scheduleHoverOpen,
        scheduleHoverClose,
        syncSelectionCount,
        dispose,
    };
}
