import { confirmAction } from "../shared/nativeDialogs.js";
import { showCardManagerModal as openCardManager } from "./browse.js";
import {
    showAddPromptDialog as openAddPromptDialog,
    showEditPromptDialog as openEditPromptDialog,
    showImportDialog as openImportDialog,
    showExportDialog as openExportDialog,
    showUploadThumbnailDialog as openUploadThumbnailDialog,
} from "./dialogs.js";
import { showPresetsModal as openPresetsModal } from "./presets.js";

// Prompt Library Workspace actions live here so ui.js remains the coordinator
// for state and lifecycle, while dialogs/Card Manager own their own rendering.
export function createPromptWorkspaceActions({
    app,
    nodeInstance,
    galleryNode,
    uniqueId,
    categoriesWidget,
    getCurrentWildcardMode,
    setCurrentWildcardMode,
    getWildcardAutoAttachThumbnail,
    saveSelectionData,
    saveWildcardState,
    saveWildcardAutoAttachState,
    updateWildcardControlsUI,
    renderPrompts,
    getActiveLibraryTab,
    renderLibraryDrawer,
    loadCategories,
    getPromptSourceNode,
    updateLocalPromptAfterMetadataSave,
    refreshAllSections,
    addPromptToSelection,
    syncPinnedOrderForFavorite,
    attachInfoPopup,
    showContextMenu,
    renameCategoryWithPrompt,
    getCategoryRoleColor,
    getPromptSortMode,
    setPromptSortMode,
    getPromptManualOrder,
    persistPromptManualOrder,
    setWorkspaceMode,
    returnToGallery,
    renderLibraryShell,
    getLibrarySubnavHtml,
    onPromptsLoaded = null,
    operationFeedback = null,
}) {
    async function showEditPromptDialog(prompt, onRefresh = null) {
        await openEditPromptDialog({
            prompt,
            galleryNode,
            updateLocalPromptAfterMetadataSave,
            loadCategories,
            refreshAllSections,
            onRefresh,
            operationFeedback,
        });
    }

    async function showAddPromptWorkspace(onRefresh = null) {
        const host = setWorkspaceMode("add_prompt");
        await openAddPromptDialog({
            galleryNode,
            nodeInstance,
            getPromptSourceNode,
            loadCategories,
            refreshAllSections,
            onRefresh,
            operationFeedback,
            workspaceContainer: host,
            onClose: returnToGallery,
            initialTab: "direct",
        });
        if (host && !host.hasChildNodes()) returnToGallery();
    }

    async function showImportWorkspace(onClose = returnToGallery) {
        const host = renderLibraryShell("import");
        if (!host) return;
        await openImportDialog({
            galleryNode,
            loadCategories,
            refreshAllSections,
            operationFeedback,
            workspaceContainer: host,
            onClose,
            librarySubnavHtml: getLibrarySubnavHtml("import"),
        });
    }

    async function showExportDialog(initialCategory = "", { surfaceHost = null } = {}) {
        await openExportDialog({ galleryNode, initialCategory, surfaceHost, operationFeedback });
    }

    async function showExportWorkspace(onClose = returnToGallery) {
        const host = renderLibraryShell("export");
        if (!host) return;
        await openExportDialog({
            galleryNode,
            operationFeedback,
            workspaceContainer: host,
            onClose,
            librarySubnavHtml: getLibrarySubnavHtml("export"),
        });
    }

    function buildPresetOptions(workspaceContainer, onClose, page = "presets") {
        return {
            app,
            nodeInstance,
            galleryNode,
            categoriesWidget,
            getCurrentWildcardMode,
            getWildcardAutoAttachThumbnail,
            setCurrentWildcardMode,
            saveSelectionData,
            saveWildcardState,
            saveWildcardAutoAttachState,
            updateWildcardControlsUI,
            renderPrompts,
            getActiveLibraryTab,
            renderLibraryDrawer,
            operationFeedback,
            workspaceContainer,
            onClose,
            librarySubnavHtml: getLibrarySubnavHtml(page),
        };
    }

    async function showPresetsWorkspace(onClose = returnToGallery) {
        const host = renderLibraryShell("presets");
        if (!host) return;
        await openPresetsModal(buildPresetOptions(host, onClose));
    }

    function buildCardManagerOptions(workspaceContainer, onClose, page = "cards") {
        return {
            nodeInstance,
            galleryNode,
            ownerId: uniqueId,
            saveSelectionData,
            loadCategories,
            refreshAllSections,
            addPromptToSelection,
            syncPinnedOrderForFavorite,
            attachInfoPopup,
            showContextMenu,
            renameCategoryWithPrompt,
            onExportCategory: showExportDialog,
            getCategoryRoleColor,
            getSortMode: scope => getPromptSortMode(scope),
            setSortMode: setPromptSortMode,
            getManualOrder: scope => getPromptManualOrder(scope),
            persistManualOrder: persistPromptManualOrder,
            onPromptsLoaded,
            operationFeedback,
            workspaceContainer,
            onClose,
            librarySubnavHtml: getLibrarySubnavHtml(page),
        };
    }

    async function showBrowseWorkspace(onClose = returnToGallery) {
        const host = renderLibraryShell("cards");
        if (!host) return;
        await openCardManager(buildCardManagerOptions(host, onClose));
    }

    function showUploadThumbnailDialog(prompt, onRefresh = null) {
        openUploadThumbnailDialog({ prompt, galleryNode, refreshAllSections, onRefresh, operationFeedback });
    }

    async function deletePromptWithConfirm(prompt) {
        if (!confirmAction(`Are you sure you want to delete "${prompt.name}"?`)) return;
        const removePrompt = async () => {
            const result = await galleryNode.deletePrompt(prompt.id);
            if (!result || result.status !== "ok") {
                throw new Error(result?.message || "Could not delete prompt");
            }
            return result;
        };
        try {
            if (operationFeedback) {
                await operationFeedback.run(removePrompt, {
                    pendingMessage: "Deleting prompt...",
                    successMessage: "Prompt deleted",
                    errorMessage: "Could not delete prompt",
                    retry: true,
                });
            } else {
                await removePrompt();
            }
        } catch {
            return;
        }
        try {
            await loadCategories();
            await refreshAllSections?.();
        } catch (error) {
            operationFeedback?.warning("Prompt deleted. View refresh failed.", {
                action: () => refreshAllSections?.(),
                actionLabel: "Retry",
            });
        }
    }

    return {
        showEditPromptDialog,
        showAddPromptWorkspace,
        showImportWorkspace,
        showExportDialog,
        showExportWorkspace,
        showPresetsWorkspace,
        showBrowseWorkspace,
        showUploadThumbnailDialog,
        deletePromptWithConfirm,
    };
}
