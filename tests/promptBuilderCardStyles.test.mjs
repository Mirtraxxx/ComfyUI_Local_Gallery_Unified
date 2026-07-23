import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);
const libraryUrl = new URL("../js/prompt/library.js", import.meta.url);

test("Prompt Builder card titles reveal only for hover, focus, and selection", async () => {
    const styles = await readFile(stylesUrl, "utf8");
    const library = await readFile(libraryUrl, "utf8");

    assert.match(library, /<span class="localprompt-chip-label">\$\{safeName\}<\/span>/);
    assert.match(styles, /\.localprompt-chip-thumb:hover \.thumb-label,[\s\S]*?\.localprompt-chip-thumb:focus-within \.thumb-label,[\s\S]*?\.localprompt-chip-thumb\.selected \.thumb-label/);
    assert.match(styles, /\.localprompt-library-drawer \.localprompt-chip-label \{[\s\S]*?opacity: 0;/);
    assert.match(styles, /\.localprompt-library-drawer \.localprompt-chip:hover \.localprompt-chip-label,[\s\S]*?\.localprompt-library-drawer \.localprompt-chip:focus-within \.localprompt-chip-label,[\s\S]*?\.localprompt-library-drawer \.localprompt-chip\.selected \.localprompt-chip-label/);
    assert.doesNotMatch(styles, /\.localprompt-gallery-item \.item-info,[\s\S]*?\.localprompt-chip-thumb \.thumb-label \{[\s\S]*?opacity: 1;/);
});

test("Prompt Builder thumbnail captions stay compact without an opaque label bar", async () => {
    const styles = await readFile(stylesUrl, "utf8");
    const captionRule = styles.match(/\.localprompt-library-drawer \.localprompt-chip-thumb \.thumb-label \{[\s\S]*?\n\s*\}/)?.[0];

    assert.ok(captionRule, "missing Prompt Builder thumbnail caption rule");
    assert.match(captionRule, /padding: 8px 8px 4px;/);
    assert.match(captionRule, /background: linear-gradient\(180deg, rgba\(15, 20, 15, 0\) 0%, rgba\(15, 20, 15, 0\.32\) 42%, rgba\(15, 20, 15, 0\.62\) 100%\);/);
    assert.doesNotMatch(captionRule, /0\.92|backdrop-filter|border:|box-shadow/);
    assert.match(styles, /\.localprompt-chip-thumb \.thumb-label \{[\s\S]*?white-space: nowrap;[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis;/);
});

test("Prompt Builder contrast modes dim only builder cards at half their former opacity", async () => {
    const styles = await readFile(stylesUrl, "utf8");

    assert.match(styles, /\.contrast-dim-inactive \.localprompt-library-drawer \.localprompt-chip-container:has\(\.localprompt-chip\.selected\) \.localprompt-chip:not\(\.selected\) \{[\s\S]*?opacity: 0\.325;[\s\S]*?filter: grayscale\(70%\);/);
    assert.match(styles, /\.contrast-dim-by-default \.localprompt-library-drawer \.localprompt-chip \{[\s\S]*?opacity: 0\.375;[\s\S]*?filter: grayscale\(70%\);/);
    assert.doesNotMatch(styles, /\.contrast-dim-by-default \.localprompt-chip \{[\s\S]*?opacity:/);
});

test("Prompt Builder thumbnail cards use responsive fractional grid tracks without changing Card Manager", async () => {
    const [referenceUx, library] = await Promise.all([
        readFile(new URL("../js/prompt/referenceUx.js", import.meta.url), "utf8"),
        readFile(libraryUrl, "utf8"),
    ]);

    assert.match(library, /promptBuilderGrid\.className = "localprompt-prompt-builder-grid";/);
    assert.match(referenceUx, /\.localprompt-library-drawer \.localprompt-prompt-builder-grid \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(auto-fill, minmax\(min\(var\(--localprompt-thumb-width\), 100%\), 1fr\)\);/);
    assert.match(referenceUx, /\.localprompt-library-drawer \.localprompt-prompt-builder-grid \.localprompt-chip-thumb \{[\s\S]*?width: 100%;[\s\S]*?aspect-ratio: 100 \/ 146;/);
    assert.doesNotMatch(referenceUx, /\.localprompt-gallery-grid \{[\s\S]*?--localprompt-thumb-width/);
});
