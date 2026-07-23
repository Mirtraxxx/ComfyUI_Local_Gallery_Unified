import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const referenceUxUrl = new URL("../js/lora/referenceUx.js", import.meta.url);

test("LoRA Browser keeps its right-side scrollbar with a compact adjacent gutter", async () => {
    const referenceUx = await readFile(referenceUxUrl, "utf8");
    const galleryRule = referenceUx.match(/#\$\{uniqueId\} \.locallora-gallery \{([\s\S]*?)\n            \}/);

    assert.ok(galleryRule, "LoRA Browser gallery rule should exist");
    assert.match(galleryRule[1], /padding: 14px 4px 18px 16px;/);
    assert.doesNotMatch(galleryRule[1], /direction:\s*rtl|flex-direction:\s*row-reverse/);
});
