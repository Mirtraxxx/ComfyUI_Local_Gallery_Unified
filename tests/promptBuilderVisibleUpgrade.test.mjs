import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);
const referenceUxUrl = new URL("../js/prompt/referenceUx.js", import.meta.url);
const templateUrl = new URL("../js/prompt/template.js", import.meta.url);
const uiUrl = new URL("../js/prompt/ui.js", import.meta.url);

test("Prompt Builder visible upgrade scopes hierarchy and card states away from other prompt surfaces", async () => {
    const styles = await readFile(stylesUrl, "utf8");
    const referenceUx = await readFile(referenceUxUrl, "utf8");
    const template = await readFile(templateUrl, "utf8");
    const ui = await readFile(uiUrl, "utf8");
    const upgradeStart = styles.indexOf("/* Prompt Builder: a compact category rail and tactile card");
    const upgradeEnd = styles.indexOf(".localprompt-active-side-tab-count", upgradeStart);
    const builderUpgrade = styles.slice(upgradeStart, upgradeEnd);

    assert.ok(upgradeStart >= 0 && upgradeEnd > upgradeStart);
    assert.match(builderUpgrade, /\.localprompt-pinned-category-strip \{[\s\S]*?border-radius: 7px;[\s\S]*?background: #171916;/);
    assert.match(builderUpgrade, /\.localprompt-pinned-category-strip \.localprompt-pinned-category-pill \{[\s\S]*?border-radius: 5px;/);
    assert.match(builderUpgrade, /\.localprompt-pinned-category-strip \.localprompt-pinned-category-pill\.active \{[\s\S]*?background: #31382d;[\s\S]*?inset 0 -3px 0 var\(--contact-prompt-bright\)/);
    assert.match(builderUpgrade, /\.localprompt-library-pane \.localprompt-library-drawer\.active \{[\s\S]*?padding: 12px 8px 0 6px;[\s\S]*?border-top: 1px solid var\(--contact-edge-strong\);/);
    assert.match(builderUpgrade, /\.localprompt-library-drawer \.localprompt-chip-container \{[\s\S]*?padding-block: 2px 0;/);
    assert.match(builderUpgrade, /\.localprompt-library-drawer \.localprompt-chip\.selected,[\s\S]*?\.localprompt-library-drawer \.localprompt-chip-thumb\.selected \{[\s\S]*?border-color: var\(--contact-prompt-bright\);/);
    assert.match(builderUpgrade, /\.localprompt-library-drawer \.localprompt-chip-thumb \.thumb-label \{[\s\S]*?font-weight: 650;[\s\S]*?text-align: left;/);
    assert.doesNotMatch(builderUpgrade, /\.localprompt-gallery-item/);
    assert.doesNotMatch(builderUpgrade, /\.localprompt-active-sidebar/);
    assert.match(referenceUx, /\.localprompt-pinned-category-pill\.active,[\s\S]*?background: linear-gradient/);
    assert.ok(template.indexOf("${getPromptStyles(uniqueId)}") < template.indexOf("${getPromptReferenceUxStyles()}"));
    assert.match(template, /\.\/styles\.js\?v=prompt-card-actions-2x-20260724-1/);
    assert.match(ui, /\.\/template\.js\?v=category-overflow-resize-20260723-1/);
});
