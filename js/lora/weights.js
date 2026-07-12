export const LORA_WEIGHT_LIMITS = Object.freeze({
    modelMin: -10,
    modelMax: 10,
    clipMin: -2,
    clipMax: 2,
    step: 0.05,
});

export function formatLoraWeight(value, fallback = 1) {
    const numericValue = Number(value);
    const weight = Number.isFinite(numericValue) ? numericValue : fallback;
    const rounded = Math.round(weight * 100) / 100;
    const roundedToTenth = Math.round(rounded * 10) / 10;
    return Math.abs(rounded - roundedToTenth) < 1e-9
        ? roundedToTenth.toFixed(1)
        : rounded.toFixed(2);
}

export function stepLoraWeight(value, direction, min, max, fallback = 1) {
    const numericValue = Number(value);
    const current = Number.isFinite(numericValue) ? numericValue : fallback;
    const delta = Math.sign(Number(direction) || 0) * LORA_WEIGHT_LIMITS.step;
    const next = Math.round((current + delta) * 100) / 100;
    return Math.max(min, Math.min(max, next));
}
