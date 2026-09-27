import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const helpersUrl = new URL("../js/prompt/helpers.js", import.meta.url);
const libraryUrl = new URL("../js/prompt/library.js", import.meta.url);
const activeSidebarUrl = new URL("../js/prompt/activeSidebar.js", import.meta.url);
const browseUrl = new URL("../js/prompt/browse.js", import.meta.url);

test("prompt preview renderer emits browser-safe video thumbnails", async () => {
    const { buildPromptPreviewMediaHtml } = await import(helpersUrl);
    const html = buildPromptPreviewMediaHtml({
        name: "Motion study",
        preview_type: "video",
        preview_url: '/localgalleryunified/prompt/thumbnail/example?v=1" data-test="escaped',
    });

    assert.match(html, /^<video /);
    assert.match(html, /loop muted playsinline preload="metadata"/);
    assert.match(html, /aria-label="Motion study"/);
    assert.match(html, /&quot; data-test=&quot;escaped/);
});

test("all current prompt card surfaces bind video preview playback", async () => {
    const [library, activeSidebar, browse] = await Promise.all([
        readFile(libraryUrl, "utf8"),
        readFile(activeSidebarUrl, "utf8"),
        readFile(browseUrl, "utf8"),
    ]);

    for (const source of [library, activeSidebar, browse]) {
        assert.match(source, /bindPromptPreviewVideo/);
    }
    assert.match(library, /buildPromptPreviewMediaHtml\(prompt\)/);
    assert.match(activeSidebar, /buildPromptPreviewMediaHtml\(prompt\)/);
});
