import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const { readSelectionArray, writeSelectionArray } = await importModuleSource(
    new URL("../js/shared/json.js", import.meta.url),
);

test("selection reader accepts legacy arrays and versioned envelopes", () => {
    assert.deepEqual(readSelectionArray('[{"id":1}]'), [{ id: 1 }]);
    assert.deepEqual(readSelectionArray('{"version":1,"items":[{"id":2}]}'), [{ id: 2 }]);
});

test("selection writer emits a versioned envelope", () => {
    assert.deepEqual(JSON.parse(writeSelectionArray([{ id: 3 }])), {
        version: 1,
        items: [{ id: 3 }],
    });
    assert.deepEqual(JSON.parse(writeSelectionArray("invalid")), {
        version: 1,
        items: [],
    });
});
