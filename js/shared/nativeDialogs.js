function getDialogHost() {
    return globalThis.window || globalThis;
}

export function showAlert(message) {
    return getDialogHost().alert(message);
}

export function confirmAction(message) {
    return getDialogHost().confirm(message);
}
