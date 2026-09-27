import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const libraryUrl = new URL("../js/prompt/library.js", import.meta.url);

test("Prompt Builder renders chip labels and the responsive builder grid", async () => {
    const library = await readFile(libraryUrl, "utf8");

    assert.match(library, /<span class="localprompt-chip-label">\$\{safeName\}<\/span>/);
    assert.match(library, /promptBuilderGrid\.className = "localprompt-prompt-builder-grid";/);
});
