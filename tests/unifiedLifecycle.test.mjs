import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entryUrl = new URL("../js/Local_Gallery_Unified.js", import.meta.url);
const loraUiUrl = new URL("../js/lora/ui.js", import.meta.url);
const promptUiUrl = new URL("../js/prompt/ui.js", import.meta.url);

test("frontend registers one composed extension lifecycle", async () => {
    const [entrySource, loraSource, promptSource] = await Promise.all([
        readFile(entryUrl, "utf8"),
        readFile(loraUiUrl, "utf8"),
        readFile(promptUiUrl, "utf8"),
    ]);

    const combinedSource = `${entrySource}\n${loraSource}\n${promptSource}`;
    assert.equal((combinedSource.match(/app\.registerExtension\s*\(/g) || []).length, 1);
    assert.match(loraSource, /export function createLoraGalleryLifecycle\s*\(/);
    assert.match(promptSource, /export function createPromptGalleryLifecycle\s*\(/);
});

test("node setup preserves tabs, LoRA, Prompt ordering", async () => {
    const entrySource = await readFile(entryUrl, "utf8");
    const tabsIndex = entrySource.indexOf("setupUnifiedGalleryTabs(nodeType, app)");
    const loraIndex = entrySource.indexOf("loraLifecycle.beforeRegisterNodeDef");
    const promptIndex = entrySource.indexOf("promptLifecycle.beforeRegisterNodeDef");

    assert.ok(tabsIndex >= 0);
    assert.ok(loraIndex > tabsIndex);
    assert.ok(promptIndex > loraIndex);
});
