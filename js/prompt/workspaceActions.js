import { confirmAction } from "../shared/nativeDialogs.js";
import { showCardManagerModal as openCardManager } from "./browse.js";
import {
    showAddPromptDialog as openAddPromptDialog,
    showEditPromptDialog as openEditPromptDialog,
    showFromLastOutputDialog as openFromLastOutputDialog,
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
    wildcardAutoAttachThumbnailWidget,
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
    loadPromptsForGallery,
    getPromptSourceNode,
    insertPromptIntoCurrentGallery,
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
            loadPromptsForGallery,
            refreshAllSections,
            onRefresh,
            operationFeedback,
        });
    }

    async function showFromLastOutputDialog(onRefresh = null) {
        await openFromLastOutputDialog({
            galleryNode,
            nodeInstance,
            getPromptSourceNode,
            insertPromptIntoCurrentGallery,
            loadPromptsForGallery,
            loadCategories,
            refreshAllSections,
            onRefresh,
            operationFeedback,
        });
    }

    async function showFromLastOutputWorkspace(onRefresh = null) {
        const host = setWorkspaceMode("from_last_output");
        await openFromLastOutputDialog({
            galleryNode,
            nodeInstance,
            getPromptSourceNode,
            insertPromptIntoCurrentGallery,
            loadPromptsForGallery,
            loadCategories,
            refreshAllSections,
            onRefresh,
            operationFeedback,
            workspaceContainer: host,
            onClose: returnToGallery,
        });
        if (host && !host.hasChildNodes()) returnToGallery();
    }

    async function showAddPromptDialog(onRefresh = null) {
        await openAddPromptDialog({
            galleryNode,
            nodeInstance,
            loadCategories,
            loadPromptsForGallery,
            refreshAllSections,
            onRefresh,
            operationFeedback,
        });
    }

    async function showImportDialog(onRefresh = null) {
        await openImportDialog({
            galleryNode,
            loadCategories,
            loadPromptsForGallery,
            refreshAllSections,
            onRefresh,
            operationFeedback,
        });
    }

    async function showImportWorkspace(onClose = returnToGallery) {
        const host = renderLibraryShell("import");
        if (!host) return;
        await openImportDialog({
            galleryNode,
            loadCategories,
            loadPromptsForGallery,
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
            ...(workspaceContainer ? {
                workspaceContainer,
                onClose,
                librarySubnavHtml: getLibrarySubnavHtml(page),
            } : {}),
        };
    }

    async function showPresetsWorkspace(onClose = returnToGallery) {
        const host = renderLibraryShell("presets");
        if (!host) return;
        await openPresetsModal(buildPresetOptions(host, onClose));
    }

    async function showPresetsModal() {
        await openPresetsModal(buildPresetOptions(null, null));
    }

    function buildCardManagerOptions(workspaceContainer, onClose, page = "cards") {
        return {
            app,
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
            ...(workspaceContainer ? {
                workspaceContainer,
                onClose,
                librarySubnavHtml: getLibrarySubnavHtml(page),
            } : {}),
        };
    }

    async function showBrowseWorkspace(onClose = returnToGallery) {
        const host = renderLibraryShell("cards");
        if (!host) return;
        await openCardManager(buildCardManagerOptions(host, onClose));
    }

    async function showCardManagerModal() {
        await openCardManager(buildCardManagerOptions(null, null));
    }

    function showUploadThumbnailDialog(prompt, onRefresh = null) {
        openUploadThumbnailDialog({ prompt, galleryNode, loadPromptsForGallery, onRefresh, operationFeedback });
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
            await loadPromptsForGallery(galleryNode.currentPage);
            await refreshAllSections?.();
        } catch (error) {
            operationFeedback?.warning("Prompt deleted. View refresh failed.", {
                action: () => loadPromptsForGallery(galleryNode.currentPage),
                actionLabel: "Retry",
            });
        }
    }

    return {
        showEditPromptDialog,
        showFromLastOutputDialog,
        showFromLastOutputWorkspace,
        showAddPromptDialog,
        showImportDialog,
        showImportWorkspace,
        showExportDialog,
        showExportWorkspace,
        showPresetsWorkspace,
        showPresetsModal,
        showBrowseWorkspace,
        showCardManagerModal,
        showUploadThumbnailDialog,
        deletePromptWithConfirm,
    };
}
