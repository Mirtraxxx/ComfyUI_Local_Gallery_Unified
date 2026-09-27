import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activeSidebarUrl = new URL("../js/prompt/activeSidebar.js", import.meta.url);
const controllerUrl = new URL("../js/prompt/displayPreferencesController.js", import.meta.url);
const helpersUrl = new URL("../js/prompt/helpers.js", import.meta.url);

test("Active Stack thumbnail mode uses Prompt Builder's fractional responsive grid", async () => {
    const [activeSidebar, controller] = await Promise.all([
        readFile(activeSidebarUrl, "utf8"),
        readFile(controllerUrl, "utf8"),
    ]);

    assert.match(activeSidebar, /container\.classList\.toggle\("localprompt-active-thumbnail-grid", displayMode === "thumbnails"\);/);
    assert.match(controller, /function getActiveThumbnailBounds\(\)/);
    assert.match(controller, /return getResponsiveThumbnailSizeBounds\(/);
    assert.match(controller, /activeSlider\.max = String\(activeBounds\.max\);/);
});

test("shared responsive thumbnail bounds enable dense Active Stack rows and remove dead slider range", async () => {
    const { getResponsiveThumbnailSizeBounds } = await import(helpersUrl);

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
    assert.deepEqual(nodeFallbackBounds, { min: 40, max: 160 });
});
