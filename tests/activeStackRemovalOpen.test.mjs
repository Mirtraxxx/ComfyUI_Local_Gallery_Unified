import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const uiUrl = new URL("../js/prompt/ui.js", import.meta.url);
const activeSidebarUrl = new URL("../js/prompt/activeSidebar.js", import.meta.url);

test("removing the final Active Stack card leaves the panel open for its empty state", async () => {
    const [uiSource, activeSidebarSource] = await Promise.all([
        readFile(uiUrl, "utf8"),
        readFile(activeSidebarUrl, "utf8"),
    ]);
    const countUpdaterStart = uiSource.indexOf("function updateActiveSideTabCount()");
    const countUpdaterEnd = uiSource.indexOf("function syncActivePromptCounts()", countUpdaterStart);
    const countUpdater = uiSource.slice(countUpdaterStart, countUpdaterEnd);

    assert.ok(countUpdaterStart >= 0 && countUpdaterEnd > countUpdaterStart);
    assert.doesNotMatch(countUpdater, /setActiveSidebarHoverOpen\(false\)/);
    assert.doesNotMatch(countUpdater, /count === 0 && isActiveSidebarOpen\(\)/);
    assert.match(activeSidebarSource, /addPromptToSelection\(prompt\);/);
    assert.match(activeSidebarSource, /emptyState\.textContent = "No active prompts selected\."/);
});
