import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activeSidebarUrl = new URL("../js/prompt/activeSidebar.js", import.meta.url);
const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);
const controllerUrl = new URL("../js/prompt/displayPreferencesController.js", import.meta.url);
const helpersUrl = new URL("../js/prompt/helpers.js", import.meta.url);
const referenceUxUrl = new URL("../js/prompt/referenceUx.js", import.meta.url);

test("Active Stack thumbnail mode uses Prompt Builder's fractional responsive grid", async () => {
    const [activeSidebar, styles, controller, referenceUx] = await Promise.all([
        readFile(activeSidebarUrl, "utf8"),
        readFile(stylesUrl, "utf8"),
        readFile(controllerUrl, "utf8"),
        readFile(referenceUxUrl, "utf8"),
    ]);

    assert.match(activeSidebar, /container\.classList\.toggle\("localprompt-active-thumbnail-grid", displayMode === "thumbnails"\);/);
    const activeGridRule = styles.match(/\.localprompt-active-sidebar \.localprompt-chip-container\.localprompt-active-thumbnail-grid \{[\s\S]*?\n\s*\}/)?.[0];
    assert.ok(activeGridRule, "missing Active Stack thumbnail grid rule");
    assert.match(activeGridRule, /display: grid;/);
    assert.match(activeGridRule, /grid-template-columns: repeat\(auto-fill, minmax\(min\(var\(--localprompt-thumb-width\), 100%\), 1fr\)\);/);
    assert.match(controller, /function getActiveThumbnailBounds\(\)/);
    assert.match(controller, /return getResponsiveThumbnailSizeBounds\(/);
    assert.match(controller, /activeSlider\.max = String\(activeBounds\.max\);/);
    assert.match(referenceUx, /\.localprompt-library-drawer \.localprompt-prompt-builder-grid \{[\s\S]*?grid-template-columns: repeat\(auto-fill, minmax\(min\(var\(--localprompt-thumb-width\), 100%\), 1fr\)\);/);
    assert.match(styles, /\.localprompt-active-sidebar \.localprompt-chip-container\.localprompt-active-thumbnail-grid \.localprompt-chip-thumb\.pinned-managed \{[\s\S]*?width: 100%;[\s\S]*?height: auto;[\s\S]*?aspect-ratio: 100 \/ 146;/);
});

test("shared responsive thumbnail bounds enable dense Active Stack rows and remove dead slider range", async () => {
    const { getResponsiveThumbnailSizeBounds, PROMPT_LAYOUT_NODE_WIDTH_FACTOR } = await import(helpersUrl);

    const activeBounds = getResponsiveThumbnailSizeBounds({
        availableWidth: 298,
        minSize: 40,
        maxSize: 320,
    });
    const activeColumnsAtMinimum = Math.floor((298 + 8) / (activeBounds.min + 8));
    assert.ok(activeColumnsAtMinimum > 2, "a 298px Active Stack content area should pack more than two minimum cards");
    assert.equal(activeBounds.max, 298);

    const tightBounds = getResponsiveThumbnailSizeBounds({
        availableWidth: 112,
        minSize: 40,
        maxSize: 320,
    });
    assert.deepEqual(tightBounds, { min: 40, max: 112 });

    const nodeFallbackBounds = getResponsiveThumbnailSizeBounds({
        nodeWidth: 160,
        minSize: 40,
        maxSize: 320,
    });
    assert.equal(PROMPT_LAYOUT_NODE_WIDTH_FACTOR, 1.25);
    assert.deepEqual(nodeFallbackBounds, { min: 40, max: 200 });
});

test("Hidden Prompt textareas retain a centered one-line control height", async () => {
    const styles = await readFile(stylesUrl, "utf8");

    assert.match(styles, /\.localprompt-meta-text \{[\s\S]*?height: 24px;[\s\S]*?line-height: 16px;[\s\S]*?padding: 3px 8px;[\s\S]*?box-sizing: border-box;[\s\S]*?align-self: center;[\s\S]*?min-height: 24px;[\s\S]*?max-height: 110px;/);
});
