import {
    loadCategories as loadPromptGalleryCategories,
    promptMatchesCurrentGallery as promptMatchesPromptGallery,
    renderGallery as renderPromptGallery,
} from "./gallery.js";

/**
 * Owns Prompt Builder's legacy gallery data flow.  The coordinator supplies
 * rendering/state callbacks, while this module owns request sequencing and
 * stale-response guards so an out-of-order fetch can never repaint the node.
 */
export function createPromptGalleryController({
    widgetContainer,
    uniqueId,
    nodeInstance,
    galleryNode,
    getCategories,
    invalidateCategoryCache,
    renderCategoryDropdownOptions,
    syncPinnedOrderForFavorite,
    attachInfoPopup,
    showPromptContextMenu,
    saveSelectionData,
    renderPrompts,
    getPromptSortMode,
    setPromptSortMode,
    getPromptSortScope,
    persistPromptManualOrder,
    applyPromptManualOrderLocally,
    getActivePromptModels,
    onPromptsLoaded = null,
    disposed = () => false,
}) {
    let requestToken = 0;
    let categoryRequestToken = 0;

    function renderGallery() {
        if (disposed()) return;
        renderPromptGallery({
            uniqueId,
            nodeInstance,
            galleryNode,
            syncPinnedOrderForFavorite,
            loadPromptsForGallery,
            attachInfoPopup,
            showPromptContextMenu,
            saveSelectionData,
            renderPrompts,
            preservePromptOrder: false,
            sortMode: getPromptSortMode(),
            manualOrderScope: getPromptSortScope(),
            setSortMode: setPromptSortMode,
            persistManualOrder: async (scope, nextOrder) => {
                await setPromptSortMode("manual", { scope: { key: scope }, reload: false });
                await persistPromptManualOrder(scope, nextOrder);
                applyPromptManualOrderLocally(scope);
                renderGallery();
            },
        });
    }

    async function loadCategories() {
        const currentRequest = ++categoryRequestToken;
        invalidateCategoryCache?.();
        const categoryAwareGalleryNode = {
            ...galleryNode,
            getCategories: () => getCategories({ force: true }),
        };
        await loadPromptGalleryCategories({
            widgetContainer,
            uniqueId,
            galleryNode: categoryAwareGalleryNode,
            isCurrent: () => !disposed() && currentRequest === categoryRequestToken,
        });
        if (disposed() || currentRequest !== categoryRequestToken) return;
        await renderCategoryDropdownOptions();
    }

    async function loadPromptsForGallery(page = 1) {
        const currentRequest = ++requestToken;
        const filterInput = widgetContainer.querySelector(`#${uniqueId}-filter-input`);
        const modeSelect = widgetContainer.querySelector(`#${uniqueId}-filter-mode`);
        const categorySelect = widgetContainer.querySelector(`#${uniqueId}-category-select`);

        const filterName = filterInput ? filterInput.value : "";
        const mode = modeSelect ? modeSelect.value : "OR";
        const category = categorySelect ? categorySelect.value : "";
        const selectedPromptIds = nodeInstance.promptData.map(p => p.prompt_id);
        const querySelectedIds = nodeInstance.uiPrefs?.promote_selected_prompts === false ? [] : selectedPromptIds;
        const data = await galleryNode.getPrompts(
            filterName,
            mode,
            page,
            querySelectedIds,
            category,
            nodeInstance.showFavoritesOnly,
            10,
            getPromptSortMode(),
        );
        if (disposed() || currentRequest !== requestToken) return;

        const prompts = data.prompts || [];
        onPromptsLoaded?.(prompts);
        if (nodeInstance.uiPrefs?.promote_selected_prompts === false) {
            nodeInstance.availablePrompts = prompts;
        } else {
            const selectedPrompts = selectedPromptIds.length ? await getActivePromptModels() : [];
            if (disposed() || currentRequest !== requestToken) return;
            const selectedPromptIdSet = new Set(selectedPromptIds.map(id => String(id)));
            const visibleSelectedPrompts = selectedPrompts.filter(prompt => promptMatchesCurrentGallery(prompt));
            const visibleSelectedIdSet = new Set(visibleSelectedPrompts.map(prompt => String(prompt.id)));
            nodeInstance.availablePrompts = [
                ...visibleSelectedPrompts,
                ...prompts.filter(prompt => !visibleSelectedIdSet.has(String(prompt.id))),
            ].filter((prompt, index, allPrompts) => {
                const promptId = String(prompt.id);
                return selectedPromptIdSet.has(promptId)
                    || allPrompts.findIndex(item => String(item.id) === promptId) === index;
            });
        }

        renderGallery();
        renderPrompts();

        const pageInfo = widgetContainer.querySelector(`#${uniqueId}-page-info`);
        const prevBtn = widgetContainer.querySelector(`#${uniqueId}-prev-btn`);
        const nextBtn = widgetContainer.querySelector(`#${uniqueId}-next-btn`);
        if (pageInfo) pageInfo.textContent = `Page ${data.current_page} of ${data.total_pages}`;
        if (prevBtn) prevBtn.disabled = data.current_page <= 1;
        if (nextBtn) nextBtn.disabled = data.current_page >= data.total_pages;
    }

    function promptMatchesCurrentGallery(prompt) {
        return promptMatchesPromptGallery({
            prompt,
            widgetContainer,
            uniqueId,
            nodeInstance,
        });
    }

    function insertPromptIntoCurrentGallery(prompt) {
        if (!prompt || !promptMatchesCurrentGallery(prompt)) return false;
        if (!Array.isArray(nodeInstance.availablePrompts)) nodeInstance.availablePrompts = [];
        const existingIndex = nodeInstance.availablePrompts.findIndex(item => String(item.id) === String(prompt.id));
        if (existingIndex >= 0) nodeInstance.availablePrompts.splice(existingIndex, 1);
        nodeInstance.availablePrompts.unshift(prompt);
        renderGallery();
        renderPrompts();
        return true;
    }

    function dispose() {
        requestToken += 1;
        categoryRequestToken += 1;
    }

    return {
        renderGallery,
        loadCategories,
        loadPromptsForGallery,
        promptMatchesCurrentGallery,
        insertPromptIntoCurrentGallery,
        dispose,
    };
}
