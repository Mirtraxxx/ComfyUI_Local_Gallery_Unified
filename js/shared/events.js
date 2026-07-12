export function createEventListenerRegistry() {
    const subscriptions = new Set();
    let disposed = false;

    const listen = (target, type, listener, options) => {
        if (disposed) {
            throw new Error("Cannot register an event listener after cleanup");
        }
        if (!target?.addEventListener || !target?.removeEventListener) {
            throw new TypeError("Event listener target must implement addEventListener and removeEventListener");
        }

        target.addEventListener(type, listener, options);
        let active = true;
        const unsubscribe = () => {
            if (!active) return;
            active = false;
            target.removeEventListener(type, listener, options);
            subscriptions.delete(unsubscribe);
        };
        subscriptions.add(unsubscribe);
        return unsubscribe;
    };

    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        [...subscriptions].reverse().forEach(unsubscribe => unsubscribe());
    };

    return {
        listen,
        cleanup,
        get size() {
            return subscriptions.size;
        },
    };
}
