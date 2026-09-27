import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dialogsUrl = new URL("../js/prompt/dialogs.js", import.meta.url);
const workspaceActionsUrl = new URL("../js/prompt/workspaceActions.js", import.meta.url);
const templateUrl = new URL("../js/prompt/template.js", import.meta.url);
const uiUrl = new URL("../js/prompt/ui.js", import.meta.url);

test("template bottom bar has Add New Prompt button", async () => {
    const template = await readFile(templateUrl, "utf8");

    assert.match(template, /id="\$\{uniqueId\}-add-prompt-btn"/);
    assert.match(template, /title="New prompt"/);
    assert.match(template, /aria-label="New prompt"/);
});

test("ui.js binds Add New Prompt button to showAddPromptWorkspace", async () => {
    const ui = await readFile(uiUrl, "utf8");

    assert.match(ui, /#\$\{uniqueId\}-add-prompt-btn/);
    assert.match(ui, /toggleWorkspaceMode\("add_prompt",\s*showAddPromptWorkspace\)/);
});

test("showAddPromptDialog has tabbed navigation for New Prompt and From Last Output", async () => {
    const dialogs = await readFile(dialogsUrl, "utf8");

    assert.match(dialogs, /data-add-tab="direct"/);
    assert.match(dialogs, /data-add-tab="from_last_output"/);
    assert.match(dialogs, /id="add-prompt-direct-panel"/);
    assert.match(dialogs, /id="add-prompt-output-panel"/);
    assert.match(dialogs, /id="new-prompt-name"/);
    assert.match(dialogs, /id="new-prompt-category"/);
    assert.match(dialogs, /id="new-prompt-new-category-row"/);
    assert.match(dialogs, /id="new-prompt-new-category"/);
    assert.match(dialogs, /id="new-prompt-text"/);
    assert.match(dialogs, /id="new-prompt-save"/);
    assert.match(dialogs, /galleryNode\.createPrompt\(/);
    assert.match(dialogs, /galleryNode\.createPromptFromOutput\(/);
});

test("workspaceActions exposes showAddPromptWorkspace and showAddPromptDialog", async () => {
    const workspaceActions = await readFile(workspaceActionsUrl, "utf8");

    assert.match(workspaceActions, /showAddPromptWorkspace/);
    assert.match(workspaceActions, /setWorkspaceMode\("add_prompt"\)/);
    assert.match(workspaceActions, /initialTab:\s*"direct"/);
});

test("add prompt page opens on the requested tab", async () => {
    const dialogs = await readFile(dialogsUrl, "utf8");

    assert.match(dialogs, /const activeTab = initialTab === "from_last_output" \? "from_last_output" : "direct";/);
});
