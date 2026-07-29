import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceSource = await readFile(new URL("../js/prompt/workspace.js", import.meta.url), "utf8");
const uiSource = await readFile(new URL("../js/prompt/ui.js", import.meta.url), "utf8");
const dialogsSource = await readFile(new URL("../js/prompt/dialogs.js", import.meta.url), "utf8");
const presetsSource = await readFile(new URL("../js/prompt/presets.js", import.meta.url), "utf8");
const referenceUxSource = await readFile(new URL("../js/prompt/referenceUx.js", import.meta.url), "utf8");

test("Prompt Library opens directly into Cards without a duplicate overview menu", () => {
    assert.doesNotMatch(workspaceSource, /\{ key: "overview", label: "Overview" \}/);
    assert.doesNotMatch(workspaceSource, /localprompt-library-landing|localprompt-library-choice/);
    assert.match(workspaceSource, /function renderLibraryWorkspace\(\) \{[\s\S]*?return showBrowseWorkspace\(\);/);
    assert.match(uiSource, /toggleWorkspaceMode\("library_cards", renderLibraryWorkspace\)/);
});

test("Prompt Library uses one compact persistent shell header", () => {
    assert.match(workspaceSource, /class="localprompt-library-shell-header"/);
    assert.match(workspaceSource, /class="localprompt-library-shell-close" data-library-close/);
    assert.match(workspaceSource, /if \(closeButton && host\.contains\(closeButton\)\) \{[\s\S]*?returnToGallery\(\);/);
    assert.match(dialogsSource, /showExportDialog\([\s\S]*?dialog\.innerHTML = `\s*\$\{isWorkspace \? "" : `<div class="localprompt-modal-header"/);
    assert.match(dialogsSource, /showImportDialog\([\s\S]*?dialog\.innerHTML = `\s*\$\{isWorkspace \? "" : `<div class="localprompt-modal-header"/);
    assert.match(presetsSource, /root\.innerHTML = `[\s\S]*?\$\{isWorkspace \? "" : `<div class="localprompt-modal-header"/);
    assert.match(referenceUxSource, /\.localprompt-library-shell-header \{[\s\S]*?min-height: 48px;/);
    assert.match(referenceUxSource, /\.localprompt-library-shell-close:focus-visible \{/);
});
