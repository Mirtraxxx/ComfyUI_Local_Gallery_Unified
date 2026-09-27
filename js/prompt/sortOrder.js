import {
    normalizePromptIdList,
    promotePromptsById,
    sortPromptsByPinnedOrder,
    syncPinnedOrderWithPromptIds,
} from "./helpers.js";

// Sort modes and manual card orders, both stored per scope ("all", "favorites"
// or "category:<name>") in the Prompt ui prefs.
export function createPromptSortOrder({
    widgetContainer,
    uniqueId,
    nodeInstance,
    getActiveLibraryTab,
    getPinnedOrder,
    getSelectedPromptIdsInOrder,
    renderLibraryDrawer,
    saveUiPrefs,
}) {
    const PROMPT_SORT_MODES = new Set(["manual", "newest", "oldest", "az", "za"]);
    function getPromptSortScope(scope = null) {
        if (scope && typeof scope === "object") {
            if (scope.key) return String(scope.key);
            if (scope.tabName) return getPromptSortScope(scope.tabName);
            if (scope.category != null) {
                const category = String(scope.category).trim();
                return category ? `category:${category}` : "all";
            }
        }
        if (typeof scope === "string") {
            if (scope === "pinned") return "favorites";
            if (scope.trim()) return `category:${scope.trim()}`;
        }

        if (getActiveLibraryTab() === "pinned") return "favorites";
        if (getActiveLibraryTab()) return `category:${getActiveLibraryTab()}`;
        return "all";
    }

    function normalizePromptSortMode(mode) {
        const normalized = String(mode || "manual");
        return PROMPT_SORT_MODES.has(normalized) ? normalized : "manual";
    }

    function getPromptSortMode(scope = null) {
        const key = getPromptSortScope(scope);
        const scopedModes = nodeInstance.uiPrefs?.prompt_sort_modes;
        const mode = scopedModes && typeof scopedModes === "object"
            ? scopedModes[key]
            : null;
        if (mode) return normalizePromptSortMode(mode);
        const fallbackMode = key === "all"
            ? nodeInstance.uiPrefs?.prompt_sort_mode
            : nodeInstance.uiPrefs?.prompt_sort_modes?.all || nodeInstance.uiPrefs?.prompt_sort_mode;
        return normalizePromptSortMode(fallbackMode);
    }

    function syncPromptSortControls() {
        const mainSortSelect = widgetContainer.querySelector(`#${uniqueId}-main-sort-select`);
        if (mainSortSelect) {
            mainSortSelect.value = getPromptSortMode(getActiveLibraryTab());
        }
        widgetContainer.querySelectorAll(".localprompt-browse-sort-select").forEach(select => {
            const browseRoot = select.closest(".localprompt-browse-page");
            const browseCategory = browseRoot?.querySelector("#browse-category")?.value || "";
            select.value = getPromptSortMode({ category: browseCategory });
        });
    }

    function bindMainSortSelect() {
        const select = widgetContainer.querySelector(`#${uniqueId}-main-sort-select`);
        if (!select) return;
        select.value = getPromptSortMode(getActiveLibraryTab());
        if (select.dataset.sortBound === "1") return;
        const handleSortChange = async (event) => {
            event.stopPropagation();
            await setPromptSortMode(event.target.value);
        };
        select.addEventListener("change", handleSortChange);
        select.dataset.sortBound = "1";
    }

    async function setPromptSortMode(mode, options = {}) {
        const scopeKey = getPromptSortScope(options.scope ?? null);
        const sortMode = normalizePromptSortMode(mode);
        const scopedModes = nodeInstance.uiPrefs.prompt_sort_modes && typeof nodeInstance.uiPrefs.prompt_sort_modes === "object"
            ? { ...nodeInstance.uiPrefs.prompt_sort_modes }
            : {};
        scopedModes[scopeKey] = sortMode;
        nodeInstance.uiPrefs.prompt_sort_modes = scopedModes;
        if (scopeKey === "all") {
            nodeInstance.uiPrefs.prompt_sort_mode = sortMode;
        }
        syncPromptSortControls();
        const refreshTasks = [];
        if (getActiveLibraryTab()) {
            refreshTasks.push(renderLibraryDrawer(getActiveLibraryTab()));
        }
        await Promise.all(refreshTasks);
        saveUiPrefs().catch(error => {
            console.warn("LocalPromptGallery: Failed to save prompt sort mode", error);
        });
    }

    async function persistPinnedOrder(nextOrder) {
        nodeInstance.uiPrefs.pinned_order = normalizePromptIdList(nextOrder);
        await saveUiPrefs();
    }

    function getPromptManualOrder(scope = null) {
        const scopeKey = getPromptSortScope(scope);
        const manualOrders = nodeInstance.uiPrefs?.prompt_manual_orders;
        return normalizePromptIdList(
            manualOrders && typeof manualOrders === "object" ? manualOrders[scopeKey] : []
        );
    }

    async function persistPromptManualOrder(scope, nextOrder) {
        const scopeKey = getPromptSortScope(scope);
        const manualOrders = nodeInstance.uiPrefs.prompt_manual_orders && typeof nodeInstance.uiPrefs.prompt_manual_orders === "object"
            ? { ...nodeInstance.uiPrefs.prompt_manual_orders }
            : {};
        const nextIds = normalizePromptIdList(nextOrder);
        const currentIds = normalizePromptIdList(manualOrders[scopeKey]);
        if (currentIds.length) {
            const nextSet = new Set(nextIds);
            const existingIndexes = currentIds
                .map((id, index) => nextSet.has(id) ? index : -1)
                .filter(index => index >= 0);
            const insertIndex = existingIndexes.length ? Math.min(...existingIndexes) : 0;
            const mergedIds = currentIds.filter(id => !nextSet.has(id));
            mergedIds.splice(insertIndex, 0, ...nextIds);
            manualOrders[scopeKey] = normalizePromptIdList(mergedIds);
        } else {
            manualOrders[scopeKey] = nextIds;
        }
        nodeInstance.uiPrefs.prompt_manual_orders = manualOrders;
        await saveUiPrefs();
    }

    function sortPromptsByManualOrder(prompts, order) {
        const orderMap = new Map(normalizePromptIdList(order).map((id, index) => [id, index]));
        return [...prompts].sort((a, b) => {
            const aIndex = orderMap.has(String(a.id)) ? orderMap.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
            const bIndex = orderMap.has(String(b.id)) ? orderMap.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
            if (aIndex !== bIndex) return aIndex - bIndex;
            return 0;
        });
    }

    function syncPinnedOrderWithPrompts(prompts) {
        const nextOrder = syncPinnedOrderWithPromptIds(
            getPinnedOrder(),
            prompts.map(prompt => prompt.id)
        );
        nodeInstance.uiPrefs.pinned_order = nextOrder;
        return nextOrder;
    }

    function sortPinnedPrompts(prompts) {
        const orderedIds = syncPinnedOrderWithPrompts(prompts);
        if (nodeInstance.uiPrefs?.promote_selected_prompts === false) {
            const promptMap = new Map(prompts.map(prompt => [String(prompt.id), prompt]));
            return normalizePromptIdList(orderedIds)
                .map(id => promptMap.get(id))
                .filter(Boolean);
        }
        return sortPromptsByPinnedOrder(prompts, orderedIds, getSelectedPromptIdsInOrder());
    }

    function promoteSelectedPrompts(prompts) {
        if (nodeInstance.uiPrefs?.promote_selected_prompts === false) {
            return prompts;
        }
        return promotePromptsById(prompts, getSelectedPromptIdsInOrder());
    }

    return {
        getPromptSortScope,
        getPromptSortMode,
        syncPromptSortControls,
        bindMainSortSelect,
        setPromptSortMode,
        persistPinnedOrder,
        getPromptManualOrder,
        persistPromptManualOrder,
        sortPinnedPrompts,
        promoteSelectedPrompts,
    };
}
