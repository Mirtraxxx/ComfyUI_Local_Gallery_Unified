export function parseJsonOr(value, fallback) {
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

export function stringifyJsonOr(value, fallback = "[]") {
    try {
        return JSON.stringify(value);
    } catch {
        return fallback;
    }
}

export function cloneJsonOr(value, fallback) {
    return parseJsonOr(stringifyJsonOr(value), fallback);
}
