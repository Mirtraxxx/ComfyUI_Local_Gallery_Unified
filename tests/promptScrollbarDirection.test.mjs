import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);
const referenceUxUrl = new URL("../js/prompt/referenceUx.js", import.meta.url);

test("Prompt Builder and Card Manager keep right-side scrollbars in LTR order", async () => {
    const [styles, referenceUx] = await Promise.all([
        readFile(stylesUrl, "utf8"),
        readFile(referenceUxUrl, "utf8"),
    ]);

    const drawerRule = styles.match(/\.localprompt-library-drawer \.localprompt-chip-container \{[\s\S]*?\}/)[0];
    assert.match(drawerRule, /padding-right: 4px;[\s\S]*?padding-left: 0;/);
    assert.doesNotMatch(drawerRule, /direction: rtl|row-reverse/);

    const browseRule = styles.match(/\.localprompt-browse-page \.localprompt-workspace-body,[\s\S]*?\.localprompt-browse-page \.localprompt-modal-content \{[\s\S]*?\}/)[0];
    assert.match(browseRule, /padding-right: 4px;/);
    assert.doesNotMatch(browseRule, /direction: rtl/);

    assert.match(referenceUx, /\.localprompt-library-drawer \{[\s\S]*?padding: 14px 4px 18px 10px;/);
    assert.match(referenceUx, /\.localprompt-library-shell \.localprompt-browse-page \.localprompt-workspace-body \{[\s\S]*?padding: 8px 4px 0 10px;/);
});
