import assert from "node:assert/strict";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const {
    LORA_WEIGHT_LIMITS,
    formatLoraWeight,
    stepLoraWeight,
} = await importModuleSource(new URL("../js/lora/weights.js", import.meta.url));

test("LoRA weights use compact but stable display precision", () => {
    assert.equal(formatLoraWeight(1), "1.0");
    assert.equal(formatLoraWeight(0.05), "0.05");
    assert.equal(formatLoraWeight(1.234), "1.23");
    assert.equal(formatLoraWeight("invalid"), "1.0");
});

test("LoRA weight stepping preserves zero and clamps each weight type", () => {
    assert.equal(stepLoraWeight(0, 1, LORA_WEIGHT_LIMITS.modelMin, LORA_WEIGHT_LIMITS.modelMax), 0.05);
    assert.equal(stepLoraWeight(0, -1, LORA_WEIGHT_LIMITS.modelMin, LORA_WEIGHT_LIMITS.modelMax), -0.05);
    assert.equal(stepLoraWeight(10, 1, LORA_WEIGHT_LIMITS.modelMin, LORA_WEIGHT_LIMITS.modelMax), 10);
    assert.equal(stepLoraWeight(-2, -1, LORA_WEIGHT_LIMITS.clipMin, LORA_WEIGHT_LIMITS.clipMax), -2);
    assert.equal(stepLoraWeight("invalid", 1, LORA_WEIGHT_LIMITS.modelMin, LORA_WEIGHT_LIMITS.modelMax), 1.05);
});
