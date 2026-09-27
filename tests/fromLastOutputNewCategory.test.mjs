import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dialogsUrl = new URL("../js/prompt/dialogs.js", import.meta.url);
const workspaceActionsUrl = new URL("../js/prompt/workspaceActions.js", import.meta.url);

test("From Last Output category select supports creating a new category", async () => {
    const dialogs = await readFile(dialogsUrl, "utf8");

    assert.match(dialogs, /FROM_LAST_OUTPUT_NEW_CATEGORY\s*=\s*"__new_category__"/);
    assert.match(dialogs, /\+ New category…/);
    assert.match(dialogs, /from-last-output-new-category-row/);
    assert.match(dialogs, /id="from-last-output-new-category"/);
    assert.match(dialogs, /function isCreatingNewCategory\(\)/);
    assert.match(dialogs, /function getSelectedCategory\(\)/);
    assert.match(dialogs, /Enter a name for the new category\./);
    assert.match(dialogs, /await loadCategories\?\.\(\)/);
});

test("workspace actions pass loadCategories and refreshAllSections into dialogs", async () => {
    const workspaceActions = await readFile(workspaceActionsUrl, "utf8");

    assert.match(workspaceActions, /from "\.\/dialogs\.js"/);
    assert.match(
        workspaceActions,
        /openAddPromptDialog\(\{[\s\S]*?loadCategories,[\s\S]*?refreshAllSections,/,
    );
    assert.match(
        workspaceActions,
        /openImportDialog\(\{[\s\S]*?loadCategories,[\s\S]*?refreshAllSections,/,
    );
});

test("dialogs invoke loadCategories and refreshAllSections on creation", async () => {
    const dialogs = await readFile(dialogsUrl, "utf8");

    assert.match(
        dialogs,
        /showAddPromptDialog\(\{[\s\S]*?refreshAllSections[\s\S]*?await refreshAllSections\?\.\(\)/,
    );
    assert.match(
        dialogs,
        /showImportDialog\(\{[\s\S]*?refreshAllSections[\s\S]*?await refreshAllSections\?\.\(\)/,
    );
});
