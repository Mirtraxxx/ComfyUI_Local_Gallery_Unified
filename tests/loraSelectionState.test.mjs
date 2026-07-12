import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const { toSerializableLoraSelection } = await importModuleSource(
    new URL("../js/lora/selectionState.js", import.meta.url),
);

test("LoRA selection persistence strips browser-only fields", () => {
    const source = [{
        on: true,
        lora: "characters/example.safetensors",
        strength: 0.8,
        strength_clip: 0.7,
        selected_preset: "portrait",
        selected_presets: ["portrait", "lighting"],
        stack_trigger_presets: true,
        preview_url: "/preview/example",
        preview_type: "image",
        tags: ["character"],
        trigger_words: "example trigger",
        trigger_presets: { portrait: "portrait trigger" },
        download_url: "https://example.invalid/model",
        element: { runtimeOnly: true },
    }];

    assert.deepEqual(toSerializableLoraSelection(source), [{
        on: true,
        lora: "characters/example.safetensors",
        strength: 0.8,
        strength_clip: 0.7,
        selected_preset: "portrait",
        selected_presets: ["portrait", "lighting"],
        stack_trigger_presets: true,
    }]);
});

test("unknown compatibility fields are preserved without mutating runtime state", () => {
    const source = [{
        on: false,
        lora: "example.safetensors",
        strength: 1,
        future_workflow_field: { enabled: true },
        tags: ["runtime"],
    }];

    const serialized = toSerializableLoraSelection(source);
    assert.deepEqual(serialized[0].future_workflow_field, { enabled: true });
    assert.deepEqual(source[0].tags, ["runtime"]);
    assert.equal("tags" in serialized[0], false);
});
