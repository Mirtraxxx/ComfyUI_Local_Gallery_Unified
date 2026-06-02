import { api } from "../../../scripts/api.js";

export async function getLoras(filterTag = "", mode = "OR", folder = "", page = 1, selectedLoras = [], perPage = 50) {
    let url = `/localloragallery/get_loras?filter_tag=${encodeURIComponent(filterTag)}&mode=${mode}&folder=${encodeURIComponent(folder)}&page=${page}&per_page=${perPage}`;
    selectedLoras.forEach((lora) => {
        url += `&selected_loras=${encodeURIComponent(lora)}`;
    });
    const response = await api.fetchApi(url);
    return await response.json();
}

export async function updateMetadata(loraName, data) {
    const body = { lora_name: loraName, ...data };
    await api.fetchApi("/localloragallery/update_metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function setUiState(nodeId, galleryId, state) {
    await api.fetchApi("/localloragallery/set_ui_state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            node_id: nodeId,
            gallery_id: galleryId,
            state,
        }),
    });
}

export async function syncCivitai(loraName) {
    const response = await api.fetchApi("/localloragallery/sync_civitai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lora_name: loraName }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

export async function getAllTags() {
    const response = await api.fetchApi("/localloragallery/get_all_tags");
    return await response.json();
}

export async function getPresets() {
    const response = await api.fetchApi("/localloragallery/get_presets");
    return await response.json();
}

export async function deletePreset(name) {
    const response = await api.fetchApi("/localloragallery/delete_preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    return await response.json();
}

export async function getUiState(nodeId, galleryId) {
    const response = await api.fetchApi(`/localloragallery/get_ui_state?node_id=${nodeId}&gallery_id=${galleryId}`);
    return await response.json();
}

export async function savePreset(name, data) {
    const response = await api.fetchApi("/localloragallery/save_preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data }),
    });
    return await response.json();
}
