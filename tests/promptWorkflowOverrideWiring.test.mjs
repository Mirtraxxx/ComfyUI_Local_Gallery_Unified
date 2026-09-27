import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildPromptTextDiff } from "../js/prompt/activeSidebar.js";

const activeSidebarUrl = new URL("../js/prompt/activeSidebar.js", import.meta.url);
const helpersUrl = new URL("../js/prompt/helpers.js", import.meta.url);
const presetUrl = new URL("../js/prompt/presets.js", import.meta.url);
const selectionJsonUrl = new URL("../js/shared/json.js", import.meta.url);

test("Active Stack opens a full-screen confirmable workflow prompt editor", async () => {
    const [source, helpers] = await Promise.all([
        readFile(activeSidebarUrl, "utf8"),
        readFile(helpersUrl, "utf8"),
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
    assert.match(source, /prompt_text_override/);
    assert.match(source, /Confirm changes/);
    assert.match(source, /Use card text/);
    assert.match(source, /localprompt-workflow-editor-highlight/);
    assert.match(source, /Changed text highlighted/);
    assert.match(source, /Original card text/);
    assert.match(source, /data-workflow-original-text/);
    assert.doesNotMatch(source, /Changes from card/);
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /event\.ctrlKey \|\| event\.metaKey/);
    assert.match(source, /saveOverride\(textArea\.value\)/);
    assert.doesNotMatch(source, /textArea\.addEventListener\("input", event => \{\s*saveOverride/);
    assert.match(source, /delete selectedEntry\.prompt_text_override/);
    assert.match(source, /editedBadge\.textContent = "Edited"/);
});

test("workflow prompt diff preserves text and identifies additions and removals", () => {
    const segments = buildPromptTextDiff(
        "portrait, blue eyes, soft light",
        "portrait, green eyes, soft light, detailed",
    );

    assert.equal(
        segments.filter(segment => segment.type !== "added").map(segment => segment.text).join(""),
        "portrait, blue eyes, soft light",
    );
    assert.equal(
        segments.filter(segment => segment.type !== "removed").map(segment => segment.text).join(""),
        "portrait, green eyes, soft light, detailed",
    );
    assert.match(
        segments.filter(segment => segment.type === "removed").map(segment => segment.text).join(""),
        /blue/,
    );
    assert.match(
        segments.filter(segment => segment.type === "added").map(segment => segment.text).join(""),
        /green|detailed/,
    );
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
