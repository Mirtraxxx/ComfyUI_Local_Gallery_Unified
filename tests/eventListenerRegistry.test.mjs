import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const { createEventListenerRegistry } = await importModuleSource(
    new URL("../js/shared/events.js", import.meta.url),
);

test("registered listeners are removed together", () => {
    const target = new EventTarget();
    const registry = createEventListenerRegistry();
    let calls = 0;

    registry.listen(target, "change", () => calls++);
    target.dispatchEvent(new Event("change"));
    assert.equal(calls, 1);
    assert.equal(registry.size, 1);

    registry.cleanup();
    target.dispatchEvent(new Event("change"));
    assert.equal(calls, 1);
    assert.equal(registry.size, 0);
});

test("individual unsubscribe and repeated cleanup are safe", () => {
    const target = new EventTarget();
    const registry = createEventListenerRegistry();
    let calls = 0;
    const unsubscribe = registry.listen(target, "change", () => calls++);

    unsubscribe();
    unsubscribe();
    registry.cleanup();
    registry.cleanup();
    target.dispatchEvent(new Event("change"));

    assert.equal(calls, 0);
    assert.equal(registry.size, 0);
});

test("a disposed registry rejects new listeners", () => {
    const registry = createEventListenerRegistry();
    registry.cleanup();
    assert.throws(
        () => registry.listen(new EventTarget(), "change", () => {}),
        /after cleanup/,
    );
});
