/** Small lifecycle-safe debounce primitive for graph-persisted prompt state. */
export function createDebouncedCommitter(commit, delayMs = 220) {
    let timer = null;
    let pending = false;

    function flush() {
        if (!pending && !timer) return false;
        if (timer) clearTimeout(timer);
        timer = null;
        pending = false;
        commit();
        return true;
    }

    function schedule() {
        pending = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, delayMs);
    }

    function dispose({ flushPending = true } = {}) {
        if (flushPending) flush();
        else if (timer) clearTimeout(timer);
        timer = null;
        pending = false;
    }

    return { schedule, flush, dispose, get pending() { return pending; } };
}
