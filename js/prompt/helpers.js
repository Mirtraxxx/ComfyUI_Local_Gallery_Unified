export function isShowTextNode(node) {
    const comfyClass = String(node?.comfyClass || node?.type || "").toLowerCase();
    const title = String(node?.title || "").toLowerCase();
    return comfyClass.includes("showtext") || title.includes("show text");
}

export function extractPromptTextFromSourceNode(node) {
    if (!node) return "";

    const widgetValues = Array.isArray(node.widgets_values) ? node.widgets_values : [];
    for (const value of widgetValues) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    const widgets = Array.isArray(node.widgets) ? node.widgets : [];
    for (const widget of widgets) {
        if (typeof widget?.value === "string" && widget.value.trim()) {
            return widget.value.trim();
        }
    }

    return "";
}

export function normalizePromptText(rawText) {
    if (!rawText) return "";

    const parts = String(rawText)
        .split(/[\n,]+/)
        .map(part => part.trim())
        .filter(Boolean);

    const seen = new Set();
    const cleaned = [];

    for (const part of parts) {
        if (/^embedding\s*:/i.test(part)) {
            continue;
        }

        const key = part.toLowerCase();
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        cleaned.push(part);
    }

    return cleaned.join(", ");
}

export function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== "string") return `rgba(255,255,255,${alpha})`;
    let normalized = hex.trim().replace("#", "");
    if (normalized.length === 3) {
        normalized = normalized.split("").map(char => char + char).join("");
    }
    if (normalized.length !== 6) return `rgba(255,255,255,${alpha})`;
    const intValue = Number.parseInt(normalized, 16);
    if (Number.isNaN(intValue)) return `rgba(255,255,255,${alpha})`;
    const r = (intValue >> 16) & 255;
    const g = (intValue >> 8) & 255;
    const b = intValue & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function parseHexColor(hex) {
    if (!hex || typeof hex !== "string") return null;
    let normalized = hex.trim().replace("#", "");
    if (normalized.length === 3) {
        normalized = normalized.split("").map(char => char + char).join("");
    }
    if (normalized.length !== 6) return null;
    const intValue = Number.parseInt(normalized, 16);
    if (Number.isNaN(intValue)) return null;
    return {
        r: (intValue >> 16) & 255,
        g: (intValue >> 8) & 255,
        b: intValue & 255,
    };
}

export function getNearestPaletteColor(color, palette, fallback = "#6c757d") {
    const source = parseHexColor(color);
    if (!source || !palette?.length) return palette?.[0] || fallback;

    let bestColor = palette[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    palette.forEach(candidate => {
        const parsed = parseHexColor(candidate);
        if (!parsed) return;
        const distance =
            ((parsed.r - source.r) ** 2) +
            ((parsed.g - source.g) ** 2) +
            ((parsed.b - source.b) ** 2);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestColor = candidate;
        }
    });
    return bestColor;
}

export function clampThumbnailSize(rawSize, fallbackSize, minSize, maxSize) {
    const normalizedSize = Math.round(Number.isFinite(rawSize) ? rawSize : fallbackSize);
    return Math.max(minSize, Math.min(maxSize, normalizedSize));
}

export function getThumbnailSizePx(uiPrefs, { legacyPresets, defaultSize, minSize, maxSize }) {
    const legacySize = uiPrefs?.thumbnail_size;
    const fallbackSize = legacyPresets[legacySize] || defaultSize;
    const rawSize = Number(uiPrefs?.thumbnail_size_px ?? fallbackSize);
    return clampThumbnailSize(rawSize, fallbackSize, minSize, maxSize);
}

export function getActiveThumbnailSizePx(uiPrefs, thumbnailSizePx, { minSize, maxSize }) {
    const rawSize = Number(uiPrefs?.active_thumbnail_size_px ?? thumbnailSizePx);
    return clampThumbnailSize(rawSize, thumbnailSizePx, minSize, maxSize);
}

export function getThumbnailVariables(sizePx) {
    return {
        height: Math.round(sizePx * 1.46),
        width: sizePx,
        label: Math.max(8, Math.min(13, Math.round(sizePx / 11))),
    };
}

export function getActiveSidebarWidth(properties, uiPrefs, fallbackWidth = 392) {
    const rawWidth = Number(properties?.active_sidebar_width ?? uiPrefs?.active_sidebar_width);
    return Number.isFinite(rawWidth) ? rawWidth : fallbackWidth;
}

export function getActiveSidebarWidthBounds(shellWidth, nodeWidth, { minWidth = 220, fallbackWidth = 500, reservedWidth = 180 } = {}) {
    const availableWidth = shellWidth || nodeWidth || fallbackWidth;
    const maxWidth = Math.max(minWidth + 20, availableWidth - reservedWidth);
    return { minWidth, maxWidth };
}

export function clampActiveSidebarWidth(width, bounds) {
    return Math.max(bounds.minWidth, Math.min(bounds.maxWidth, Math.round(width)));
}

export function getCategoryColorMap(uiPrefs) {
    const colorMap = uiPrefs?.category_colors;
    return colorMap && typeof colorMap === "object" ? colorMap : {};
}

export function getCategoryRoleColor(promptOrCategory, colorMap) {
    const category = typeof promptOrCategory === "string"
        ? promptOrCategory
        : promptOrCategory?.category;
    if (!category) return null;
    return colorMap?.[category] || null;
}

export function normalizePromptIdList(ids) {
    if (!Array.isArray(ids)) {
        return [];
    }
    return [...new Set(ids.map(id => String(id)).filter(Boolean))];
}

export function getLibraryTabsFromPrefs(uiPrefs, utilityTabs = ["most_used", "pinned"]) {
    const storedTabs = Array.isArray(uiPrefs?.library_tabs) ? uiPrefs.library_tabs : [];
    return storedTabs.filter(tab => tab && tab !== "active" && !utilityTabs.includes(tab));
}

export function syncPinnedOrderWithPromptIds(pinnedOrder, promptIds) {
    const normalizedPromptIds = normalizePromptIdList(promptIds);
    const promptIdSet = new Set(normalizedPromptIds);
    const orderedPinned = normalizePromptIdList(pinnedOrder).filter(id => promptIdSet.has(id));
    const missingIds = normalizedPromptIds.filter(id => !orderedPinned.includes(id));
    return [...orderedPinned, ...missingIds];
}

export function promotePromptsById(prompts, selectedIds) {
    const promptMap = new Map(prompts.map(prompt => [String(prompt.id), prompt]));
    const selectedPrompts = normalizePromptIdList(selectedIds)
        .map(id => promptMap.get(id))
        .filter(Boolean);
    const selectedSet = new Set(selectedPrompts.map(prompt => String(prompt.id)));
    const unselectedPrompts = prompts.filter(prompt => !selectedSet.has(String(prompt.id)));
    return [...selectedPrompts, ...unselectedPrompts];
}

export function sortPromptsByPinnedOrder(prompts, pinnedOrder, selectedIds = []) {
    const promptMap = new Map(prompts.map(prompt => [String(prompt.id), prompt]));
    const selectedPrompts = normalizePromptIdList(selectedIds)
        .map(id => promptMap.get(id))
        .filter(Boolean);
    const selectedSet = new Set(selectedPrompts.map(prompt => String(prompt.id)));
    const unselectedPrompts = normalizePromptIdList(pinnedOrder)
        .filter(id => !selectedSet.has(id))
        .map(id => promptMap.get(id))
        .filter(Boolean);
    return [...selectedPrompts, ...unselectedPrompts];
}

export function getManagedPromptState(selectedEntry) {
    const weight = selectedEntry?.weight || 1.0;
    const isOn = selectedEntry?.on !== false;
    return { weight, isOn };
}

export function stepManagedPromptWeight(weight, delta, { min = 0.1, max = 2.0, step = 0.1 } = {}) {
    const currentWeight = weight || 1.0;
    const nextWeight = Math.round((currentWeight + (delta * step)) * 10) / 10;
    return Math.max(min, Math.min(max, nextWeight));
}

export function createPinnedManagedControlsHtml(selectedEntry) {
    const { weight, isOn } = getManagedPromptState(selectedEntry);
    return `
                    <button class="managed-state-pill ${isOn ? "on" : "off"}" data-managed-action="toggle-on">${isOn ? "ON" : "OFF"}</button>
                    <div class="managed-card-overlay">
                        <div class="managed-card-controls">
                        <button class="localprompt-inline-btn" data-managed-action="weight-down">-</button>
                        <span class="managed-weight-val">${weight.toFixed(1)}</span>
                        <button class="localprompt-inline-btn" data-managed-action="weight-up">+</button>
                        </div>
                    </div>
                `;
}

export function createManagedTextControlsHtml(selectedEntry) {
    const { weight, isOn } = getManagedPromptState(selectedEntry);
    return `
                    <div class="managed-card-controls">
                        <button class="managed-state-pill ${isOn ? "on" : "off"}" data-managed-action="toggle-on" style="position: static;">${isOn ? "ON" : "OFF"}</button>
                        <button class="localprompt-inline-btn" data-managed-action="weight-down">-</button>
                        <span class="managed-weight-val">${weight.toFixed(1)}</span>
                        <button class="localprompt-inline-btn" data-managed-action="weight-up">+</button>
                    </div>
                `;
}

export function buildLastOutputPreviewUrl(lastOutput) {
    if (!lastOutput?.filename) {
        return "";
    }

    let url = `/view?filename=${encodeURIComponent(lastOutput.filename)}&type=${encodeURIComponent(lastOutput.type || "output")}`;
    if (lastOutput.subfolder) {
        url += `&subfolder=${encodeURIComponent(lastOutput.subfolder)}`;
    }
    return url;
}
