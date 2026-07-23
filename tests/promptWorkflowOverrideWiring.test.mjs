import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const activeSidebarUrl = new URL("../js/prompt/activeSidebar.js", import.meta.url);
const helpersUrl = new URL("../js/prompt/helpers.js", import.meta.url);
const presetUrl = new URL("../js/prompt/presets.js", import.meta.url);
const selectionJsonUrl = new URL("../js/shared/json.js", import.meta.url);
const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);

test("Active Stack uses a compact accessible thumbnail editor action and removes overrides on revert", async () => {
    const [source, helpers, styles] = await Promise.all([
        readFile(activeSidebarUrl, "utf8"),
        readFile(helpersUrl, "utf8"),
        readFile(stylesUrl, "utf8"),
    ]);

    assert.match(source, /Edit for this workflow/);
    assert.match(source, /isThumbnail = displayMode === "thumbnails"/);
    assert.match(source, /icon: "edit"/);
    assert.match(source, /className: "localprompt-workflow-edit-button localprompt-inline-btn"/);
    assert.match(source, /editButton\.textContent = "Edit"/);
    assert.doesNotMatch(source, /editButton\.textContent = "Edit for this workflow"/);
    assert.match(source, /editButton\.setAttribute\("aria-label", editLabel\)/);
    assert.match(source, /if \(!isThumbnail\) \{\s*editedBadge = document\.createElement/);
    assert.match(helpers, /if \(name === "edit"\)/);
    assert.match(styles, /\.localprompt-chip-thumb\.pinned-managed \.localprompt-workflow-edit-button\.is-edited::after/);
    assert.match(styles, /\.localprompt-chip-thumb\.pinned-managed > \.localprompt-workflow-editor \{[\s\S]*?overflow: hidden;/);
    assert.doesNotMatch(styles, /> \.localprompt-workflow-edited-badge/);
    assert.match(source, /prompt_text_override/);
    assert.match(source, /Revert to card text/);
    assert.match(source, /delete selectedEntry\.prompt_text_override/);
    assert.match(source, /editedBadge\.textContent = "Edited"/);
});

test("selection envelopes and presets preserve unknown workflow-local fields", async () => {
    const [jsonSource, presetSource] = await Promise.all([
        readFile(selectionJsonUrl, "utf8"),
        readFile(presetUrl, "utf8"),
    ]);

    assert.match(jsonSource, /items: Array\.isArray\(items\) \? items : \[\]/);
    assert.match(presetSource, /return \{\s*\.\.\.presetPrompt,/);
    assert.match(presetSource, /mergedPrompts\[index\] = \{ \.\.\.mergedPrompts\[index\], \.\.\.normalizedPrompt \};/);
});
