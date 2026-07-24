import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const uiUrl = new URL("../js/prompt/ui.js", import.meta.url);
const activeSidebarUrl = new URL("../js/prompt/activeSidebar.js", import.meta.url);

test("removing an Active Stack card does not become an outside click after rerender", async () => {
    const [uiSource, activeSidebarSource] = await Promise.all([
        readFile(uiUrl, "utf8"),
        readFile(activeSidebarUrl, "utf8"),
    ]);
    const countUpdaterStart = uiSource.indexOf("function updateActiveSideTabCount()");
    const countUpdaterEnd = uiSource.indexOf("function syncActivePromptCounts()", countUpdaterStart);
    const countUpdater = uiSource.slice(countUpdaterStart, countUpdaterEnd);
    const focusHandlerStart = uiSource.indexOf("// Close active sidebar on");
    const focusHandlerEnd = uiSource.indexOf("widgetContainer.querySelector(`#${uniqueId}-active-clear-btn`)", focusHandlerStart);
    const focusHandler = uiSource.slice(focusHandlerStart, focusHandlerEnd);

    assert.ok(countUpdaterStart >= 0 && countUpdaterEnd > countUpdaterStart);
    assert.ok(focusHandlerStart >= 0 && focusHandlerEnd > focusHandlerStart);
    assert.match(focusHandler, /e\.composedPath\(\)/);
    assert.match(focusHandler, /eventPath\.includes\(activeSidebarEl\)/);
    assert.match(focusHandler, /eventPath\.includes\(activeSideTab\)/);
    assert.match(countUpdater, /count === 0 && isActiveSidebarOpen\(\)/);
    assert.match(countUpdater, /setActiveSidebarHoverOpen\(false\)/);
    assert.match(activeSidebarSource, /addPromptToSelection\(prompt\);/);
});
