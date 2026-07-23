import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activeSidebarUrl = new URL("../js/prompt/activeSidebar.js", import.meta.url);
const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);

test("Active Stack thumbnail mode uses a dedicated responsive grid", async () => {
    const [activeSidebar, styles] = await Promise.all([
        readFile(activeSidebarUrl, "utf8"),
        readFile(stylesUrl, "utf8"),
    ]);

    assert.match(activeSidebar, /container\.classList\.toggle\("localprompt-active-thumbnail-grid", displayMode === "thumbnails"\);/);
    const activeGridRule = styles.match(/\.localprompt-active-sidebar \.localprompt-chip-container\.localprompt-active-thumbnail-grid \{[\s\S]*?\n\s*\}/)?.[0];
    assert.ok(activeGridRule, "missing Active Stack thumbnail grid rule");
    assert.match(activeGridRule, /display: grid;/);
    assert.match(activeGridRule, /grid-template-columns: repeat\(auto-fit, minmax\(min\(var\(--localprompt-thumb-width\), 100%\), min\(var\(--localprompt-thumb-width\), 100%\)\)\);/);
    assert.match(activeGridRule, /justify-content: center;/);
    assert.doesNotMatch(activeGridRule, /1fr/);
    assert.match(styles, /\.localprompt-active-sidebar \.localprompt-chip-container\.localprompt-active-thumbnail-grid \.localprompt-chip-thumb\.pinned-managed \{[\s\S]*?width: 100%;[\s\S]*?height: auto;[\s\S]*?aspect-ratio: 100 \/ 146;/);
});

test("Hidden Prompt textareas retain a centered one-line control height", async () => {
    const styles = await readFile(stylesUrl, "utf8");

    assert.match(styles, /\.localprompt-meta-text \{[\s\S]*?height: 24px;[\s\S]*?line-height: 16px;[\s\S]*?padding: 3px 8px;[\s\S]*?box-sizing: border-box;[\s\S]*?align-self: center;[\s\S]*?min-height: 24px;[\s\S]*?max-height: 110px;/);
});
