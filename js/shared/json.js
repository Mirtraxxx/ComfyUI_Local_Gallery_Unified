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

export function readSelectionArray(rawValue, fallback = []) {
    const parsed = parseJsonOr(rawValue || "[]", fallback);
    if (Array.isArray(parsed)) {
        return parsed;
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
        return parsed.items;
    }
    return fallback;
}

export function writeSelectionArray(items, fallback = "[]") {
    return stringifyJsonOr(Array.isArray(items) ? items : [], fallback);
}
