import { escapeHtml } from "../shared/dom.js";

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

// The Prompt UI deliberately lays out at 125% and is scaled back to 80% so
// controls remain usable inside a ComfyUI node. DOM client widths are already
// in that unscaled layout space; this factor is only for the node-size fallback
// used before a surface has been measured.
export const PROMPT_LAYOUT_NODE_WIDTH_FACTOR = 1.25;

export function getResponsiveThumbnailSizeBounds({
    availableWidth,
    nodeWidth,
    minSize,
    maxSize,
    horizontalPadding = 0,
} = {}) {
    const measuredWidth = Number(availableWidth);
    const fallbackNodeWidth = Number(nodeWidth);
    const layoutWidth = Number.isFinite(measuredWidth) && measuredWidth > 0
        ? measuredWidth
        : (Number.isFinite(fallbackNodeWidth) && fallbackNodeWidth > 0
            ? fallbackNodeWidth * PROMPT_LAYOUT_NODE_WIDTH_FACTOR
            : 0);
    const safeMin = Math.max(1, Math.round(Number(minSize) || 1));
    const safeMax = Math.max(safeMin, Math.round(Number(maxSize) || safeMin));

    // A zero width means the drawer/sidebar is hidden. Keep the global range
    // until it can be measured instead of collapsing its slider prematurely.
    if (layoutWidth <= 0) return { min: safeMin, max: safeMax };

    const usableWidth = Math.max(0, Math.floor(layoutWidth - Math.max(0, Number(horizontalPadding) || 0)));
    return {
        min: safeMin,
        max: Math.max(safeMin, Math.min(safeMax, usableWidth)),
    };
}

export function getThumbnailSizePx(uiPrefs, { legacyPresets, defaultSize, minSize, maxSize }) {
    const legacySize = uiPrefs?.thumbnail_size;
    const fallbackSize = legacyPresets[legacySize] || defaultSize;
    const rawSize = Number(uiPrefs?.thumbnail_size_px ?? fallbackSize);
    return clampThumbnailSize(rawSize, fallbackSize, minSize, maxSize);
}

export function getActiveThumbnailSizePx(uiPrefs, thumbnailSizePx, { minSize, maxSize }) {
    const activeDisplay = uiPrefs?.active_display_mode || uiPrefs?.display_mode || "compact";
    const isLarge = uiPrefs?.active_card_size_mode === "large" && activeDisplay === "thumbnails";
    const defaultBaseline = isLarge ? 143 : thumbnailSizePx;
    const rawSize = Number(uiPrefs?.active_thumbnail_size_px ?? defaultBaseline);
    let resolvedSize = rawSize;
    if (isLarge && resolvedSize < 143) {
        resolvedSize = 143;
    }
    return clampThumbnailSize(resolvedSize, defaultBaseline, minSize, maxSize);
}

export function getThumbnailVariables(sizePx) {
    return {
        height: Math.round(sizePx * 1.46),
        width: sizePx,
        label: Math.max(8, Math.min(13, Math.round(sizePx / 11))),
    };
}

export function getActiveSidebarWidth(properties, uiPrefs, fallbackWidth = 300) {
    const activeDisplay = uiPrefs?.active_display_mode || uiPrefs?.display_mode || "compact";
    const isLarge = uiPrefs?.active_card_size_mode === "large" && activeDisplay === "thumbnails";
    const defaultFallback = isLarge ? 660 : fallbackWidth;
    const rawWidth = Number(properties?.active_sidebar_width ?? uiPrefs?.active_sidebar_width);
    let resolvedWidth = Number.isFinite(rawWidth) ? rawWidth : defaultFallback;
    if (isLarge && resolvedWidth < 640) {
        resolvedWidth = 640;
    }
    return resolvedWidth;
}

export function getActiveSidebarWidthBounds(shellWidth, nodeWidth, options = {}, uiPrefs = null) {
    const activeDisplay = uiPrefs?.active_display_mode || uiPrefs?.display_mode || "compact";
    const isLarge = uiPrefs?.active_card_size_mode === "large" && activeDisplay === "thumbnails";
    
    const defaultMin = isLarge ? 640 : 300;
    const defaultFallback = isLarge ? 660 : 500;
    
    const minWidth = options?.minWidth ?? defaultMin;
    const fallbackWidth = options?.fallbackWidth ?? defaultFallback;
    const reservedWidth = options?.reservedWidth ?? 180;
    
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

export function formatWeight(weight) {
    const rounded = Math.round(weight * 100) / 100;
    const tenth = Math.round(rounded * 10) / 10;
    if (Math.abs(rounded - tenth) < 1e-9) {
        return tenth.toFixed(1);
    } else {
        return rounded.toFixed(2);
    }
}

export function getManagedPromptState(selectedEntry) {
    const numericWeight = Number(selectedEntry?.weight);
    const weight = Number.isFinite(numericWeight) ? numericWeight : 1.0;
    const isOn = selectedEntry?.on !== false;
    return { weight, isOn };
}

export function stepManagedPromptWeight(weight, delta, { min = -10.0, max = 10.0, step = 0.1 } = {}) {
    const numericWeight = Number(weight);
    const currentWeight = Number.isFinite(numericWeight) ? numericWeight : 1.0;
    const nextWeight = Math.round((currentWeight + (delta * step)) * 100) / 100;
    const clamped = Math.max(min, Math.min(max, nextWeight));
    return Math.round(clamped * 100) / 100;
}

export function createPinnedManagedControlsHtml(selectedEntry) {
    const { weight, isOn } = getManagedPromptState(selectedEntry);
    const formattedWeight = formatWeight(weight);
    return `
                    <div class="managed-card-overlay">
                        <div class="managed-card-controls">
                        <button class="managed-state-pill ${isOn ? "on" : "off"}" data-managed-action="toggle-on">${isOn ? "ON" : "OFF"}</button>
                        <span class="managed-weight-val" title="Scroll to adjust weight" aria-label="Scroll to adjust weight" tabindex="0">${formattedWeight}</span>
                        </div>
                    </div>
                `;
}

export function createManagedTextControlsHtml(selectedEntry) {
    const { weight, isOn } = getManagedPromptState(selectedEntry);
    const formattedWeight = formatWeight(weight);
    return `
                    <div class="managed-card-controls">
                        <button class="managed-state-pill ${isOn ? "on" : "off"}" data-managed-action="toggle-on" style="position: static;">${isOn ? "ON" : "OFF"}</button>
                        <span class="managed-weight-val" title="Scroll to adjust weight" aria-label="Scroll to adjust weight" tabindex="0">${formattedWeight}</span>
                    </div>
                `;
}

export function createPromptActionIcon(name) {
    if (name === "eye") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
    if (name === "trash") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>`;
    }
    if (name === "star") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.19L12 17.18l-5.56 2.93 1.06-6.19L3 9.53l6.22-.9L12 3z"></path></svg>`;
    }
    if (name === "edit") {
        return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"></path></svg>`;
    }
    return "";
}

export function createPromptActionButton({
    icon,
    className,
    title,
    extraAttrs = "",
    pressed = false,
}) {
    const pressedAttr = pressed ? ` aria-pressed="true"` : "";
    return `<button class="${className}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"${pressedAttr}${extraAttrs ? ` ${extraAttrs}` : ""}>${createPromptActionIcon(icon)}</button>`;
}

export function buildPromptPreviewMediaHtml(prompt, { wrapperClass = "", noPreviewText = "", autoplay = false } = {}) {
    if (prompt?.preview_type === "image" && prompt.preview_url) {
        const imageHtml = `<img src="${escapeHtml(prompt.preview_url)}" alt="${escapeHtml(prompt.name || "")}" loading="lazy" decoding="async">`;
        return wrapperClass ? `<div class="${wrapperClass}">${imageHtml}</div>` : imageHtml;
    }

    if (prompt?.preview_type === "video" && prompt.preview_url) {
        const autoplayAttrs = autoplay ? " autoplay" : "";
        const videoHtml = `<video src="${escapeHtml(prompt.preview_url)}" loop muted playsinline preload="metadata"${autoplayAttrs} aria-label="${escapeHtml(prompt.name || "")}"></video>`;
        return wrapperClass ? `<div class="${wrapperClass}">${videoHtml}</div>` : videoHtml;
    }

    return wrapperClass ? `<div class="${wrapperClass} no-preview">${noPreviewText}</div>` : "";
}

export function bindPromptPreviewVideo(element) {
    const video = element?.querySelector?.("video");
    if (!video) return;

    const play = () => {
        const playResult = video.play();
        playResult?.catch?.(() => {});
    };
    const reset = () => {
        video.pause();
        try {
            video.currentTime = 0;
        } catch {
            // Some browsers reject seeking until video metadata is available.
        }
    };

    element.addEventListener("mouseenter", play);
    element.addEventListener("mouseleave", reset);
    element.addEventListener("focusin", play);
    element.addEventListener("focusout", reset);
}

export function buildPromptHoverPreviewHtml(prompt, roleColor = null) {
    const mediaHtml = prompt?.preview_url && prompt?.preview_type
        ? `<button class="preview-media-button${prompt.preview_type === "image" ? " image-preview" : ""}" type="button" data-preview-action="expand-image" title="Expand ${prompt.preview_type === "video" ? "video" : "image"}">${buildPromptPreviewMediaHtml(prompt, { autoplay: true })}</button>`
        : "";
    const previewPills = [];
    if (prompt.category) {
        const categoryStyle = roleColor ? ` style="--role-color: ${escapeHtml(roleColor)};"` : "";
        previewPills.push(`<span class="preview-pill category-pill"${categoryStyle}><span class="category-color-dot"></span>${escapeHtml(prompt.category)}</span>`);
    }
    if (prompt.favorite) {
        previewPills.push("<span class=\"preview-pill\">Pinned</span>");
    }
    if (prompt.usage_count > 0) {
        previewPills.push(`<span class="preview-pill">${prompt.usage_count} uses</span>`);
    }

    const roleStyle = roleColor ? ` style="--role-color: ${escapeHtml(roleColor)};"` : "";
    return `${mediaHtml}
                    <div class="preview-meta"${roleStyle}>
                        <div class="preview-name">${escapeHtml(prompt.name)}</div>
                        ${previewPills.length ? `<div class="preview-pill-row">${previewPills.join("")}</div>` : ""}
                        <div class="preview-actions">
                            ${prompt.prompt_text ? `<button type="button" data-preview-action="toggle-prompt">Show Prompt</button>` : ""}
                            ${prompt.prompt_text ? `<button type="button" data-preview-action="copy-prompt">Copy Prompt</button>` : ""}
                        </div>
                        ${prompt.prompt_text ? `<div class="preview-text" hidden>${escapeHtml(prompt.prompt_text)}</div>` : ""}
                    </div>
                `;
}

export function getFloatingPreviewPosition({ event, previewRect, anchorRect = null, viewportWidth, viewportHeight, gap = 12, margin = 10 }) {
    let x = event.clientX + gap;
    let y = event.clientY + gap;

    if (anchorRect) {
        x = anchorRect.right + gap;
        y = anchorRect.top;
        if (y + previewRect.height > viewportHeight - margin) {
            y = Math.max(margin, viewportHeight - previewRect.height - margin);
        }
    }
    if (x + previewRect.width > viewportWidth - margin) {
        x = viewportWidth - previewRect.width - margin;
    }
    if (y + previewRect.height > viewportHeight - margin) {
        y = viewportHeight - previewRect.height - margin;
    }
    if (x < margin) {
        x = margin;
    }
    if (y < margin) {
        y = margin;
    }
    return { x, y };
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
