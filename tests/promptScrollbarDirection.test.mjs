import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);
const referenceUxUrl = new URL("../js/prompt/referenceUx.js", import.meta.url);

test("Prompt Builder and Card Manager keep compact, left-side scrollbars with LTR content", async () => {
    const [styles, referenceUx] = await Promise.all([
        readFile(stylesUrl, "utf8"),
        readFile(referenceUxUrl, "utf8"),
    ]);

    assert.match(
        styles,
        /\.localprompt-library-drawer \.localprompt-chip-container \{[\s\S]*?padding-left: 4px;[\s\S]*?overflow-y: auto;[\s\S]*?direction: rtl;[\s\S]*?flex-direction: row-reverse;/,
    );
    assert.match(
        styles,
        /\.localprompt-library-drawer \.localprompt-chip-container > \* \{\s*direction: ltr;/,
    );
    assert.match(
        styles,
        /\.localprompt-browse-page \.localprompt-workspace-body,[\s\S]*?\.localprompt-browse-page \.localprompt-modal-content \{[\s\S]*?padding-left: 4px;[\s\S]*?direction: rtl;/,
    );
    assert.match(
        styles,
        /\.localprompt-browse-page \.localprompt-workspace-body > \*,[\s\S]*?\.localprompt-browse-page \.localprompt-modal-content > \* \{\s*direction: ltr;/,
    );
    assert.match(
        referenceUx,
        /\.localprompt-library-drawer \{[\s\S]*?padding: 14px 10px 18px 4px;/,
    );
    assert.match(
        referenceUx,
        /\.localprompt-library-shell \.localprompt-browse-page \.localprompt-workspace-body \{[\s\S]*?padding: 8px 10px 0 4px;/,
    );
});
