import { api } from "../../../scripts/api.js";

export async function getPrompts(filterName = "", mode = "OR", page = 1, selectedPrompts = [], filterCategory = "", favoritesOnly = false, perPage = 10, sortMode = "manual") {
    const category = filterCategory === "All Categories" ? "" : (filterCategory || "");
    let url = `/localgalleryunified/prompt/get_prompts?filter_name=${encodeURIComponent(filterName)}&mode=${encodeURIComponent(mode)}&page=${page}&per_page=${perPage}&favorites_only=${favoritesOnly ? 1 : 0}&category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sortMode || "manual")}`;
    selectedPrompts.forEach((prompt) => {
        url += `&selected_prompts=${encodeURIComponent(prompt)}`;
    });
    const response = await api.fetchApi(url);
    return await response.json();
}

export async function getPrompt(promptId) {
    const response = await api.fetchApi(`/localgalleryunified/prompt/get_prompt?prompt_id=${encodeURIComponent(promptId)}`);
    const data = await response.json();
    return data.prompt || null;
}

export async function getPromptsByIds(promptIds = []) {
    if (!Array.isArray(promptIds) || promptIds.length === 0) {
        return [];
    }
    const response = await api.fetchApi("/localgalleryunified/prompt/get_prompts_by_ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_ids: promptIds }),
    });
    const data = await response.json();
    return data.prompts || [];
}

export async function getCategories() {
    const response = await api.fetchApi("/localgalleryunified/prompt/get_categories");
    const data = await response.json();
    return data.categories || [];
}

export async function getCategorySummary() {
    const response = await api.fetchApi("/localgalleryunified/prompt/get_categories");
    const data = await response.json();
    return {
        categories: Array.isArray(data.categories) ? data.categories : [],
        counts: data.category_counts && typeof data.category_counts === "object"
            ? data.category_counts
            : {},
        totalCount: Number.isFinite(data.total_count) ? data.total_count : null,
    };
}

export async function updateMetadata(promptId, data) {
    const body = { prompt_id: promptId, ...data };
    const response = await api.fetchApi("/localgalleryunified/prompt/update_metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || "Failed to update metadata");
    }
    return result;
}

export async function createPrompt(name, promptText, category = "") {
    const response = await api.fetchApi("/localgalleryunified/prompt/create_prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt_text: promptText, category }),
    });
    return await response.json();
}

export async function createPromptFromOutput(name, promptText, category = "", lastOutput = null) {
    const response = await api.fetchApi("/localgalleryunified/prompt/create_prompt_from_output", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name,
            prompt_text: promptText,
            category,
            last_output: lastOutput,
        }),
    });
    return await response.json();
}

export async function deletePrompt(promptId) {
    const response = await api.fetchApi("/localgalleryunified/prompt/delete_prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId }),
    });
    return await response.json();
}

export async function deletePromptsBulk(promptIds) {
    const response = await api.fetchApi("/localgalleryunified/prompt/delete_prompts_bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_ids: promptIds }),
    });
    return await response.json();
}

export async function movePromptsBulk(promptIds, category = "") {
    const response = await api.fetchApi("/localgalleryunified/prompt/move_prompts_bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_ids: promptIds, category }),
    });
    const result = await response.json();
    if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || "Failed to move prompts");
    }
    return result;
}

export async function bulkEdit(selection, operations, {
    preview = true,
    baseRevision = null,
    sampleLimit = 10,
    activePromptIds = [],
} = {}) {
    const response = await api.fetchApi("/localgalleryunified/prompt/bulk_edit", {
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
    });
    const result = await response.json();
    if (!response.ok || result?.status === "error" || result?.status === "conflict") {
        const error = new Error(result?.message || "Bulk edit failed");
        error.status = response.status;
        error.result = result;
        throw error;
    }
    return result;
}

export async function uploadThumbnail(promptId, file) {
    const formData = new FormData();
    formData.append("prompt_id", promptId);
    formData.append("file", file);
    const response = await api.fetchApi("/localgalleryunified/prompt/upload_thumbnail", {
        method: "POST",
        body: formData,
    });
    return await response.json();
}

export async function toggleFavorite(promptId, category = null) {
    const body = { prompt_id: promptId };
    if (category) body.category = category;
    const response = await api.fetchApi("/localgalleryunified/prompt/toggle_favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return await response.json();
}

export async function setFavoriteColor(promptId, color) {
    const response = await api.fetchApi("/localgalleryunified/prompt/set_favorite_color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId, color }),
    });
    return await response.json();
}

export async function uploadWildcardFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.fetchApi("/localgalleryunified/prompt/upload_wildcard_file", {
        method: "POST",
        body: formData,
    });
    return await response.json();
}

export async function importWildcardFile(filename, category) {
    const response = await api.fetchApi("/localgalleryunified/prompt/import_wildcard_file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, category }),
    });
    return await response.json();
}

export async function exportWildcardCategory(category, filename = "", destination = "comfy") {
    const response = await api.fetchApi("/localgalleryunified/prompt/export_wildcard_category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, filename, destination }),
    });
    return await response.json();
}

export async function deleteCategory(category) {
    const response = await api.fetchApi("/localgalleryunified/prompt/delete_category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
    });
    return await response.json();
}

export async function renameCategory(oldCategory, newCategory) {
    const response = await api.fetchApi("/localgalleryunified/prompt/rename_category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_category: oldCategory, new_category: newCategory }),
    });
    return await response.json();
}

export async function getMostUsed(count = 10) {
    const response = await api.fetchApi(`/localgalleryunified/prompt/get_most_used?count=${count}`);
    const data = await response.json();
    return data.prompts || [];
}

export async function getUiPrefs() {
    const response = await api.fetchApi("/localgalleryunified/prompt/get_ui_prefs");
    return await response.json();
}

export async function saveUiPrefs(prefs) {
    const response = await api.fetchApi("/localgalleryunified/prompt/save_ui_prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
    });
    return await response.json();
}

export async function getPresets() {
    const response = await api.fetchApi("/localgalleryunified/prompt/get_presets");
    const data = await response.json();
    return data.presets || [];
}

export async function savePreset(name, selection, wildcardMode, wildcardCategories, wildcardAutoAttachThumbnail = "off") {
    const response = await api.fetchApi("/localgalleryunified/prompt/save_preset", {
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
    return await response.json();
}

export async function getOrCreatePrompts(prompts) {
    const response = await api.fetchApi("/localgalleryunified/prompt/get_or_create_prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompts }),
    });
    return await response.json();
}

export async function loadPreset(name) {
    const response = await api.fetchApi("/localgalleryunified/prompt/load_preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    return await response.json();
}

export async function deletePreset(name) {
    const response = await api.fetchApi("/localgalleryunified/prompt/delete_preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    return await response.json();
}

export async function resetUsageCount(promptId) {
    const response = await api.fetchApi("/localgalleryunified/prompt/reset_usage_count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_id: promptId }),
    });
    return await response.json();
}

export async function assignThumbnail(promptId, lastOutput) {
    const response = await api.fetchApi("/localgalleryunified/prompt/assign_thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt_id: promptId,
            filename: lastOutput.filename,
            subfolder: lastOutput.subfolder,
            type: lastOutput.type,
        }),
    });
    return await response.json();
}
