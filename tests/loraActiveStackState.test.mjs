import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const { hydrateSelectedLoraInfo, swapSelectedLoras } = await importModuleSource(
    new URL("../js/lora/activeStackState.js", import.meta.url),
);

test("active stack hydration copies browser metadata without replacing selection state", () => {
    const selected = [{ lora: "example.safetensors", on: false, strength: 0.7 }];
    const hydrated = hydrateSelectedLoraInfo(selected, [{
        name: "example.safetensors",
        preview_url: "/preview/example",
        preview_type: "image",
        tags: ["style"],
        trigger_words: "example trigger",
        trigger_presets: { portrait: "portrait trigger" },
        download_url: "https://example.invalid/model",
    }]);

    assert.equal(hydrated, selected);
    assert.deepEqual(hydrated[0], {
        lora: "example.safetensors",
        on: false,
        strength: 0.7,
        preview_url: "/preview/example",
        preview_type: "image",
        tags: ["style"],
        trigger_words: "example trigger",
        trigger_presets: { portrait: "portrait trigger" },
        download_url: "https://example.invalid/model",
    });
});

test("active stack reorder swaps valid positions without mutating the source array", () => {
    const selected = [{ lora: "one" }, { lora: "two" }, { lora: "three" }];
    const reordered = swapSelectedLoras(selected, 0, 2);

    assert.deepEqual(reordered.map(item => item.lora), ["three", "two", "one"]);
    assert.deepEqual(selected.map(item => item.lora), ["one", "two", "three"]);
    assert.equal(swapSelectedLoras(selected, -1, 2), selected);
    assert.equal(swapSelectedLoras(selected, 1, 1), selected);
});
