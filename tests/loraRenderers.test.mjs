import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function importLoraRenderers() {
    const domSource = await readFile(new URL("../js/shared/dom.js", import.meta.url), "utf8");
    const domUrl = `data:text/javascript;base64,${Buffer.from(domSource).toString("base64")}`;
    const weightSource = await readFile(new URL("../js/lora/weights.js", import.meta.url), "utf8");
    const weightUrl = `data:text/javascript;base64,${Buffer.from(weightSource).toString("base64")}`;
    const selectionStateSource = await readFile(new URL("../js/lora/selectionState.js", import.meta.url), "utf8");
    const selectionStateUrl = `data:text/javascript;base64,${Buffer.from(selectionStateSource).toString("base64")}`;
    const rendererSource = await readFile(new URL("../js/lora/renderers.js", import.meta.url), "utf8");
    const selfContainedSource = rendererSource
        .replace("../shared/dom.js", domUrl)
        .replace("./selectionState.js", selectionStateUrl)
        .replace("./weights.js", weightUrl);
    return import(`data:text/javascript;base64,${Buffer.from(selfContainedSource).toString("base64")}`);
}

const { buildLoraCardHtml } = await importLoraRenderers();

test("LoRA card renderer escapes media and download URLs", () => {
    const html = buildLoraCardHtml({
        name: "example",
        preview_type: "image",
        preview_url: 'preview.png" onerror="alert(1)',
        download_url: 'https://example.invalid/model" onclick="alert(1)',
        trigger_words: "trigger",
    }, false, false, false);

    assert.match(html, /src="preview\.png&quot; onerror=&quot;alert\(1\)"/);
    assert.match(html, /href="https:\/\/example\.invalid\/model&quot; onclick=&quot;alert\(1\)"/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.doesNotMatch(html, /src="preview\.png" onerror=/);
    assert.doesNotMatch(html, /href="https:\/\/example\.invalid\/model" onclick=/);
});

test("LoRA card renderer rejects non-HTTP download links", () => {
    const html = buildLoraCardHtml({
        name: "example",
        preview_type: "none",
        preview_url: "",
        download_url: "javascript:alert(1)",
        trigger_words: "",
    }, false, false, false);

    assert.doesNotMatch(html, /lora-card-link-btn/);
    assert.doesNotMatch(html, /javascript:/);
});
