import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const { confirmAction, showAlert } = await importModuleSource(
    new URL("../js/shared/nativeDialogs.js", import.meta.url),
);

test("shared alert helper preserves the message and return value", () => {
    const previousWindow = globalThis.window;
    const calls = [];
    globalThis.window = {
        alert(message) {
            calls.push(message);
            return "dismissed";
        },
    };
    try {
        assert.equal(showAlert("Saved"), "dismissed");
        assert.deepEqual(calls, ["Saved"]);
    } finally {
        globalThis.window = previousWindow;
    }
});

test("shared confirmation helper remains synchronous and returns the native choice", () => {
    const previousWindow = globalThis.window;
    const calls = [];
    globalThis.window = {
        confirm(message) {
            calls.push(message);
            return false;
        },
    };
    try {
        assert.equal(confirmAction("Delete?"), false);
        assert.deepEqual(calls, ["Delete?"]);
    } finally {
        globalThis.window = previousWindow;
    }
});
