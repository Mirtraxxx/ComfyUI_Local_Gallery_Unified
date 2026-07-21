import { confirmAction } from "../shared/nativeDialogs.js";
import { showCardManagerModal as openCardManager } from "./browse.js?v=modal-surfaces-20260721-1";
import {
    showAddPromptDialog as openAddPromptDialog,
    showEditPromptDialog as openEditPromptDialog,
    showFromLastOutputDialog as openFromLastOutputDialog,
    showImportDialog as openImportDialog,
    showExportDialog as openExportDialog,
    showUploadThumbnailDialog as openUploadThumbnailDialog,
} from "./dialogs.js?v=modal-surfaces-20260721-2";
import { showPresetsModal as openPresetsModal } from "./presets.js?v=modal-surfaces-20260721-1";

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
        });
    }

    async function showFromLastOutputDialog() {
        await openFromLastOutputDialog({
            galleryNode,
            nodeInstance,
            getPromptSourceNode,
            insertPromptIntoCurrentGallery,
            loadPromptsForGallery,
        });
    }

    async function showFromLastOutputWorkspace() {
        const host = setWorkspaceMode("from_last_output");
        await openFromLastOutputDialog({
            galleryNode,
            nodeInstance,
            getPromptSourceNode,
            insertPromptIntoCurrentGallery,
            loadPromptsForGallery,
            workspaceContainer: host,
            onClose: returnToGallery,
        });
        if (host && !host.hasChildNodes()) returnToGallery();
    }

    async function showAddPromptDialog() {
        await openAddPromptDialog({ galleryNode, nodeInstance, loadCategories, loadPromptsForGallery });
    }

    async function showImportDialog() {
        await openImportDialog({ galleryNode, loadCategories, loadPromptsForGallery });
    }

    async function showImportWorkspace(onClose = returnToGallery) {
        const host = renderLibraryShell("import");
        if (!host) return;
        await openImportDialog({
            galleryNode,
            loadCategories,
            loadPromptsForGallery,
            workspaceContainer: host,
            onClose,
            librarySubnavHtml: getLibrarySubnavHtml("import"),
        });
    }

    async function showExportDialog(initialCategory = "") {
        await openExportDialog({ galleryNode, initialCategory });
    }

    async function showExportWorkspace(onClose = returnToGallery) {
        const host = renderLibraryShell("export");
        if (!host) return;
        await openExportDialog({
            galleryNode,
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
        openUploadThumbnailDialog({ prompt, galleryNode, loadPromptsForGallery, onRefresh });
    }

    async function deletePromptWithConfirm(prompt) {
        if (!confirmAction(`Are you sure you want to delete "${prompt.name}"?`)) return;
        await galleryNode.deletePrompt(prompt.id);
        await loadCategories();
        await loadPromptsForGallery(galleryNode.currentPage);
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
