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

test("targeted metadata hydrates an active LoRA absent from the current browser page", () => {
    const selected = [{ lora: "off-page.safetensors", on: true, strength: 1 }];
    const currentBrowserPage = [{
        name: "visible.safetensors",
        preview_url: "/preview/visible",
        preview_type: "image",
    }];
    const targetedMetadata = [{
        name: "off-page.safetensors",
        preview_url: "/preview/off-page",
        preview_type: "image",
        tags: ["style"],
        trigger_words: "off page trigger",
        trigger_presets: {},
        download_url: "",
    }];

    hydrateSelectedLoraInfo(selected, currentBrowserPage);
    assert.equal(selected[0].preview_url, undefined);

    hydrateSelectedLoraInfo(selected, targetedMetadata);
    assert.equal(selected[0].preview_url, "/preview/off-page");
    assert.equal(selected[0].preview_type, "image");
    assert.deepEqual(selected[0].tags, ["style"]);
});

test("active stack reorder swaps valid positions without mutating the source array", () => {
    const selected = [{ lora: "one" }, { lora: "two" }, { lora: "three" }];
    const reordered = swapSelectedLoras(selected, 0, 2);

    assert.deepEqual(reordered.map(item => item.lora), ["three", "two", "one"]);
    assert.deepEqual(selected.map(item => item.lora), ["one", "two", "three"]);
    assert.equal(swapSelectedLoras(selected, -1, 2), selected);
    assert.equal(swapSelectedLoras(selected, 1, 1), selected);
});
