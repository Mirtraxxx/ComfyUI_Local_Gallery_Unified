import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const { buildLoraSelectionEntry } = await importModuleSource(
    new URL("../js/lora/selectionEntry.js", import.meta.url),
);
const { toSerializableLoraSelection } = await importModuleSource(
    new URL("../js/lora/selectionState.js", import.meta.url),
);
const { hydrateSelectedLoraInfo } = await importModuleSource(
    new URL("../js/lora/activeStackState.js", import.meta.url),
);

const uiSource = await readFile(new URL("../js/lora/ui.js", import.meta.url), "utf8");
const metadataEditorSource = await readFile(new URL("../js/lora/metadataEditor.js", import.meta.url), "utf8");
const activeStackControllerSource = await readFile(new URL("../js/lora/activeStackController.js", import.meta.url), "utf8");
const backendSource = await readFile(new URL("../backend/Local_Lora_Gallery.py", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../js/lora/styles.js", import.meta.url), "utf8");

const elementStub = {
    querySelector: () => null,
    querySelectorAll: () => [],
};

test("selecting a remembered LoRA restores its saved strengths", () => {
    const entry = buildLoraSelectionEntry({
        element: elementStub,
        loraName: "characters/example.safetensors",
        lora: {
            remember_strength: true,
            saved_strength: 0.75,
            saved_strength_clip: 0.65,
        },
    });

    assert.equal(entry.strength, 0.75);
    assert.equal(entry.strength_clip, 0.65);
});

test("saved CLIP strength falls back to the saved model strength", () => {
    const entry = buildLoraSelectionEntry({
        element: elementStub,
        loraName: "example.safetensors",
        lora: { remember_strength: true, saved_strength: 0.8 },
    });

    assert.equal(entry.strength, 0.8);
    assert.equal(entry.strength_clip, 0.8);
});

test("selection defaults stay neutral without remembered strengths", () => {
    const entry = buildLoraSelectionEntry({
        element: elementStub,
        loraName: "example.safetensors",
        lora: { saved_strength: 0.5, saved_strength_clip: 0.4 },
    });

    assert.equal(entry.strength, 1);
    assert.equal(entry.strength_clip, 1);
});

test("remembered strength fields stay out of the persisted selection", () => {
    const serialized = toSerializableLoraSelection([{
        on: true,
        lora: "example.safetensors",
        strength: 0.75,
        strength_clip: 0.65,
        remember_strength: true,
        saved_strength: 0.75,
        saved_strength_clip: 0.65,
    }]);

    assert.deepEqual(serialized[0], {
        on: true,
        lora: "example.safetensors",
        strength: 0.75,
        strength_clip: 0.65,
    });
});

test("active stack hydration carries remembered strength metadata", () => {
    const selected = [{ lora: "example.safetensors", on: true, strength: 1 }];
    hydrateSelectedLoraInfo(selected, [{
        name: "example.safetensors",
        remember_strength: true,
        saved_strength: 0.72,
        saved_strength_clip: 0.64,
    }]);

    assert.equal(selected[0].remember_strength, true);
    assert.equal(selected[0].saved_strength, 0.72);
    assert.equal(selected[0].saved_strength_clip, 0.64);
});

test("strength memory panel is wired through the metadata controller", () => {
    assert.match(uiSource, /class="lora-metadata-field strength-memory-editor-row"/);
    assert.match(uiSource, /const strengthMemoryClipControl = widgetContainer\.querySelector\("\.strength-memory-clip-control"\)/);
    for (const name of ["strengthMemoryRow", "strengthMemoryEnableInput", "strengthMemoryModelInput", "strengthMemoryClipControl", "strengthMemoryClipInput"]) {
        assert.match(uiSource, new RegExp(`${name},`));
    }
    assert.match(metadataEditorSource, /strengthMemoryEnableInput\.addEventListener\("change"/);
    assert.match(metadataEditorSource, /strengthMemoryModelInput\.addEventListener\("change", commitStrengthMemoryEdits\)/);
    assert.match(metadataEditorSource, /renderStrengthMemoryRow\(singleLora\)/);
});

test("active stack wheel weights persist into remembered LoRA strengths", () => {
    assert.match(activeStackControllerSource, /persistRememberedWeight\?\.\(item\)/);
    assert.match(uiSource, /const persistRememberedWeight = \(item\) =>/);
    assert.match(uiSource, /saved_strength: item\.strength \?\? 1/);
});

test("backend stores and serves remembered strength metadata", () => {
    assert.match(backendSource, /lora_meta\['remember_strength'\] = bool\(remember_strength\)/);
    assert.match(backendSource, /lora_meta\['saved_strength'\] = float\(saved_strength\)/);
    assert.match(backendSource, /lora_meta\['saved_strength_clip'\] = float\(saved_strength_clip\)/);
    assert.match(backendSource, /"remember_strength": bool\(lora_meta\.get\("remember_strength", False\)/);
    assert.match(backendSource, /"remember_strength": entry\["remember_strength"\]/);
});

test("strength memory row has dedicated styling inside the details editor", () => {
    assert.match(stylesSource, /\.strength-memory-editor-row \{/);
    assert.match(stylesSource, /\.strength-memory-controls input\[type="number"\]:disabled/);
});
