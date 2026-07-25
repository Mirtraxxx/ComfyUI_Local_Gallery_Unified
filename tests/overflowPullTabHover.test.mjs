import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loraStylesUrl = new URL("../js/lora/styles.js", import.meta.url);
const promptStylesUrl = new URL("../js/prompt/styles.js", import.meta.url);
const loraReferenceUrl = new URL("../js/lora/referenceUx.js", import.meta.url);

test("LoRA folder pull-tab is hidden until the folder strip is hovered or overflow is open", async () => {
    const styles = await readFile(loraStylesUrl, "utf8");
    const referenceUx = await readFile(loraReferenceUrl, "utf8");

    assert.match(styles, /\.lora-folder-pull-tab \{[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;/);
    assert.match(
        styles,
        /\.lora-folder-nav:hover \.lora-folder-pull-tab,[\s\S]*?\.lora-folder-nav:focus-within \.lora-folder-pull-tab,[\s\S]*?\.lora-folder-pull-tab\.open,[\s\S]*?\.lora-folder-pull-tab\[aria-expanded="true"\]/,
    );
    assert.match(styles, /\.lora-folder-nav::after \{[\s\S]*?height: 22px;[\s\S]*?pointer-events: none;/);
    // Theme layer must not pin transform to idle-only translateX.
    assert.match(
        referenceUx,
        /\.lora-folder-nav:hover \.lora-folder-pull-tab,[\s\S]*?transform: translateX\(-50%\) translateY\(0\);/,
    );
});

test("Prompt category pull-tab is hidden until the category strip is hovered or overflow is open", async () => {
    const styles = await readFile(promptStylesUrl, "utf8");

    assert.match(styles, /\.localprompt-category-pull-tab \{[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;/);
    assert.match(
        styles,
        /\.localprompt-pinned-categories:hover \.localprompt-category-pull-tab,[\s\S]*?\.localprompt-pinned-categories:focus-within \.localprompt-category-pull-tab,[\s\S]*?\.localprompt-category-pull-tab\[aria-expanded="true"\]/,
    );
    assert.match(
        styles,
        /\.localprompt-pinned-categories::after \{[\s\S]*?height: 22px;[\s\S]*?pointer-events: none;/,
    );
});
