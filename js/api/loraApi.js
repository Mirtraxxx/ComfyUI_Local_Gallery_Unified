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

function appendQueryParam(params, name, value) {
    if (value !== undefined && value !== null && value !== "") {
        params.append(name, String(value));
    }
}

export async function getLoras(filterTag = "", mode = "OR", folder = "", page = 1, selectedLoras = [], perPage = 50, sortMode = "az") {
    const params = new URLSearchParams();
    appendQueryParam(params, "filter_tag", filterTag);
    appendQueryParam(params, "mode", mode);
    appendQueryParam(params, "folder", folder);
    appendQueryParam(params, "page", page);
    appendQueryParam(params, "per_page", perPage);
    appendQueryParam(params, "sort", sortMode);
    selectedLoras.forEach((lora) => {
        appendQueryParam(params, "selected_loras", lora);
    });
    return await fetchJson(`/localgalleryunified/lora/get_loras?${params.toString()}`);
}

export async function updateMetadata(loraName, data) {
    const body = { lora_name: loraName, ...data };
    return await fetchJson("/localgalleryunified/lora/update_metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

export async function assignThumbnail(loraName, lastOutput) {
    return await fetchJson("/localgalleryunified/lora/assign_thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            lora_name: loraName,
            filename: lastOutput?.filename,
            subfolder: lastOutput?.subfolder || "",
            type: lastOutput?.type || "output",
        }),
    });
}

export async function setUiState(nodeId, galleryId, state) {
    return await fetchJson("/localgalleryunified/lora/set_ui_state", {
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
    return await fetchJson("/localgalleryunified/lora/sync_civitai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lora_name: loraName }),
    });
}

export async function getPresets() {
    return await fetchJson("/localgalleryunified/lora/get_presets");
}

export async function deletePreset(name) {
    return await fetchJson("/localgalleryunified/lora/delete_preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
}

export async function getUiState(nodeId, galleryId) {
    const params = new URLSearchParams();
    appendQueryParam(params, "node_id", nodeId);
    appendQueryParam(params, "gallery_id", galleryId);
    return await fetchJson(`/localgalleryunified/lora/get_ui_state?${params.toString()}`);
}

export async function savePreset(name, data) {
    return await fetchJson("/localgalleryunified/lora/save_preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data }),
    });
}
