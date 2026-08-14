import { api } from "../../../scripts/api.js";

async function readJsonResponse(response) {
    try {
        return await response.json();
    } catch (error) {
        if (error?.name === "AbortError") {
            throw error;
        }
        if (response.ok) {
            return {};
        }
        return {
            status: "error",
            message: response.statusText || `HTTP error ${response.status}`,
        };
    }
}

function getErrorMessage(data, response, fallbackMessage = "Request failed") {
    const candidates = [
        data?.message,
        data?.error,
        data?.error?.message,
        data?.detail,
        response.statusText,
    ];
    return candidates.find(value => typeof value === "string" && value.trim())
        || (!response.ok && response.status ? `HTTP error ${response.status}` : fallbackMessage);
}

async function fetchJson(url, options, { fallbackMessage = "Request failed", rejectStatuses = ["error"] } = {}) {
    const response = await api.fetchApi(url, options);
    const data = await readJsonResponse(response);
    const payloadStatus = typeof data?.status === "string" ? data.status.toLowerCase() : "";
    if (!response.ok || rejectStatuses.includes(payloadStatus)) {
        const error = new Error(getErrorMessage(data, response, fallbackMessage));
        error.status = response.status;
        error.result = data;
        throw error;
    }
    return data;
}

export async function getPrompts(filterName = "", mode = "OR", page = 1, selectedPrompts = [], filterCategory = "", favoritesOnly = false, perPage = 10, sortMode = "manual", requestOptions = {}) {
    const category = filterCategory === "All Categories" ? "" : (filterCategory || "");
    let url = `/localgalleryunified/prompt/get_prompts?filter_name=${encodeURIComponent(filterName)}&mode=${encodeURIComponent(mode)}&page=${page}&per_page=${perPage}&favorites_only=${favoritesOnly ? 1 : 0}&category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sortMode || "manual")}`;
    const scopedCategories = Array.isArray(requestOptions?.categories)
        ? [...new Set(requestOptions.categories.map(value => String(value || "").trim()).filter(Boolean))]
        : [];
    scopedCategories.forEach(value => {
        url += `&categories=${encodeURIComponent(value)}`;
    });
    selectedPrompts.forEach((prompt) => {
        url += `&selected_prompts=${encodeURIComponent(prompt)}`;
    });
    const fetchOptions = { ...requestOptions };
    delete fetchOptions.categories;
    return await fetchJson(url, fetchOptions);
}

export async function getPrompt(promptId) {
    const data = await fetchJson(`/localgalleryunified/prompt/get_prompt?prompt_id=${encodeURIComponent(promptId)}`);
    return data.prompt || null;
}

export async function getPromptsByIds(promptIds = []) {
    if (!Array.isArray(promptIds) || promptIds.length === 0) {
        return [];
    }
    const data = await fetchJson("/localgalleryunified/prompt/get_prompts_by_ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_ids: promptIds }),
    });
    return data.prompts || [];
}

export async function getCategories() {
    const data = await fetchJson("/localgalleryunified/prompt/get_categories");
    return data.categories || [];
}

export async function getCategorySummary() {
    const data = await fetchJson("/localgalleryunified/prompt/get_categories");
    return {
        categories: Array.isArray(data.categories) ? data.categories : [],
        counts: data.category_counts && typeof data.category_counts === "object"
            ? data.category_counts
            : {},
        totalCount: Number.isFinite(data.total_count) ? data.total_count : null,
    };
}

export async function getPromptStats({ category, categories = [], group = "all", search = "", sort = "count", page = 1, perPage = 100 } = {}) {
    const params = new URLSearchParams({ group, search, sort, page: String(page), per_page: String(perPage) });
    if (category !== null && category !== undefined) params.set("category", category);
    if (Array.isArray(categories)) {
        [...new Set(categories)].filter(Boolean).forEach(value => params.append("categories", value));
    }
    return await fetchJson(`/localgalleryunified/prompt/get_prompt_stats?${params.toString()}`, undefined, {
        fallbackMessage: "Failed to load prompt stats",
    });
}

export async function updateMetadata(promptId, data) {
    const body = { prompt_id: promptId, ...data };
    return await fetchJson("/localgalleryunified/prompt/update_metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }, { fallbackMessage: "Failed to update metadata" });
}

export async function createPrompt(name, promptText, category = "") {
    return await fetchJson("/localgalleryunified/prompt/create_prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt_text: promptText, category }),
    });
}

export async function createPromptFromOutput(name, promptText, category = "", lastOutput = null) {
    return await fetchJson("/localgalleryunified/prompt/create_prompt_from_output", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name,
            prompt_text: promptText,
            category,
            last_output: lastOutput,
        }),
    });
}

export async function deletePrompt(promptId) {
    return await fetchJson("/localgalleryunified/prompt/delete_prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId }),
    });
}

export async function deletePromptsBulk(promptIds) {
    return await fetchJson("/localgalleryunified/prompt/delete_prompts_bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_ids: promptIds }),
    });
}

export async function movePromptsBulk(promptIds, category = "") {
    return await fetchJson("/localgalleryunified/prompt/move_prompts_bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_ids: promptIds, category }),
    }, { fallbackMessage: "Failed to move prompts" });
}

export async function renamePromptsSequential(selection, {
    preview = true,
    baseRevision = null,
    activePromptIds = [],
} = {}) {
    const body = Array.isArray(selection) || selection?.type === "ids"
        ? { prompt_ids: Array.isArray(selection) ? selection : selection.ids }
        : { selection };
    return await fetchJson("/localgalleryunified/prompt/rename_prompts_sequential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...body,
            preview,
            base_revision: baseRevision,
            active_prompt_ids: activePromptIds,
        }),
    }, {
        fallbackMessage: "Failed to rename cards sequentially",
        rejectStatuses: ["error", "conflict"],
    });
}

export async function bulkEdit(selection, operations, {
    preview = true,
    baseRevision = null,
    sampleLimit = 10,
    activePromptIds = [],
} = {}) {
    return await fetchJson("/localgalleryunified/prompt/bulk_edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            selection,
            operations,
            preview,
            base_revision: baseRevision,
            sample_limit: sampleLimit,
            active_prompt_ids: activePromptIds,
        }),
    }, {
        fallbackMessage: "Bulk edit failed",
        rejectStatuses: ["error", "conflict"],
    });
}

export async function uploadThumbnail(promptId, file) {
    const formData = new FormData();
    formData.append("prompt_id", promptId);
    formData.append("file", file);
    return await fetchJson("/localgalleryunified/prompt/upload_thumbnail", {
        method: "POST",
        body: formData,
    });
}

export async function toggleFavorite(promptId, category = null) {
    const body = { prompt_id: promptId };
    if (category) body.category = category;
    return await fetchJson("/localgalleryunified/prompt/toggle_favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function setFavoriteColor(promptId, color) {
    return await fetchJson("/localgalleryunified/prompt/set_favorite_color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId, color }),
    });
}

export async function uploadWildcardFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    return await fetchJson("/localgalleryunified/prompt/upload_wildcard_file", {
        method: "POST",
        body: formData,
    });
}

export async function importWildcardFile(filename, category) {
    return await fetchJson("/localgalleryunified/prompt/import_wildcard_file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, category }),
    });
}

export async function exportWildcardCategory(category, filename = "", destination = "comfy") {
    return await fetchJson("/localgalleryunified/prompt/export_wildcard_category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, filename, destination }),
    });
}

export async function deleteCategory(category) {
    return await fetchJson("/localgalleryunified/prompt/delete_category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
    });
}

export async function renameCategory(oldCategory, newCategory) {
    return await fetchJson("/localgalleryunified/prompt/rename_category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_category: oldCategory, new_category: newCategory }),
    });
}

export async function getUiPrefs() {
    return await fetchJson("/localgalleryunified/prompt/get_ui_prefs");
}

export async function saveUiPrefs(prefs) {
    return await fetchJson("/localgalleryunified/prompt/save_ui_prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
    });
}

export async function getPresets() {
    const data = await fetchJson("/localgalleryunified/prompt/get_presets");
    return data.presets || [];
}

export async function savePreset(name, selection, wildcardMode, wildcardCategories, wildcardAutoAttachThumbnail = "off") {
    return await fetchJson("/localgalleryunified/prompt/save_preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name,
            selection,
            wildcard_mode: wildcardMode,
            wildcard_categories: wildcardCategories,
            wildcard_auto_attach_thumbnail: wildcardAutoAttachThumbnail,
        }),
    });
}

export async function getOrCreatePrompts(prompts) {
    return await fetchJson("/localgalleryunified/prompt/get_or_create_prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
    });
}

export async function loadPreset(name) {
    return await fetchJson("/localgalleryunified/prompt/load_preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
}

export async function deletePreset(name) {
    return await fetchJson("/localgalleryunified/prompt/delete_preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
}

export async function assignThumbnail(promptId, lastOutput) {
    return await fetchJson("/localgalleryunified/prompt/assign_thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt_id: promptId,
            filename: lastOutput.filename,
            subfolder: lastOutput.subfolder,
            type: lastOutput.type,
        }),
    });
}

/**
 * Assign many card thumbnails in one backend metadata write.
 * @param {Array<{prompt_id: string, filename: string, subfolder?: string, type?: string}>} assignments
 */
export async function assignThumbnailsBatch(assignments = []) {
    return await fetchJson("/localgalleryunified/prompt/assign_thumbnails_batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
    });
}
