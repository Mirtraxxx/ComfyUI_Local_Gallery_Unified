export function moveSelectedLora(items, fromIndex, targetIndex, insertAfter) {
    if (!Array.isArray(items) || fromIndex < 0 || fromIndex === targetIndex) {
        return false;
    }
    if (fromIndex >= items.length || targetIndex < 0 || targetIndex >= items.length) {
        return false;
    }

    const [movedItem] = items.splice(fromIndex, 1);
    let insertIndex = targetIndex + (insertAfter ? 1 : 0);
    if (fromIndex < targetIndex) insertIndex -= 1;
    items.splice(Math.max(0, insertIndex), 0, movedItem);
    return true;
}
