const DEFAULT_STRENGTH = 1;

function finiteNumber(value, fallback = DEFAULT_STRENGTH) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

export function normalizeLoraLotteryConfig(value = {}) {
    const strength = finiteNumber(value.strength);
    return {
        enabled: value.enabled === true,
        folder: typeof value.folder === "string" ? value.folder : "",
        strength,
        strength_clip: finiteNumber(value.strength_clip, strength),
    };
}

export function readLoraLotteryConfig(selectionData) {
    try {
        const parsed = typeof selectionData === "string"
            ? JSON.parse(selectionData || "[]")
            : selectionData;
        return normalizeLoraLotteryConfig(
            parsed && !Array.isArray(parsed) ? parsed.lottery : {},
        );
    } catch {
        return normalizeLoraLotteryConfig();
    }
}

