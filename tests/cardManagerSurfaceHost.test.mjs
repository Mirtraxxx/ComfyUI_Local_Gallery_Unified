import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browseUrl = new URL("../js/prompt/browse.js", import.meta.url);
const previewsUrl = new URL("../js/prompt/previews.js", import.meta.url);
const contextMenusUrl = new URL("../js/prompt/contextMenus.js", import.meta.url);

test("Card Manager fullscreen mounts prompt portals under its surface host", async () => {
    const [browseSource, previewsSource, contextMenusSource] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(previewsUrl, "utf8"),
        readFile(contextMenusUrl, "utf8"),
    ]);

    assert.match(browseSource, /localprompt-card-manager-surface-host/);
    assert.match(browseSource, /attachInfoPopup\(item, prompt, \{ getSurfaceHost \}\)/);
    assert.match(browseSource, /surfaceHost: getSurfaceHost\(\)/);
    assert.match(previewsSource, /surfaceHost\?\.isConnected \? surfaceHost : document\.body/);
    assert.match(contextMenusSource, /surfaceHost\?\.isConnected \? surfaceHost : document\.body/);
});
