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
