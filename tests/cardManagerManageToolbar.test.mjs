import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browseUrl = new URL("../js/prompt/browse.js", import.meta.url);
const insightsUrl = new URL("../js/prompt/wildcardStats.js", import.meta.url);
const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);
const referenceUxUrl = new URL("../js/prompt/referenceUx.js", import.meta.url);
const promptApiUrl = new URL("../js/api/promptApi.js", import.meta.url);
const backendUrl = new URL("../backend/Local_Prompt_Gallery.py", import.meta.url);

test("Card Manager owns same-window card selection while Stats stays separate", async () => {
    const [browseSource, insightsSource] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(insightsUrl, "utf8"),
    ]);

    assert.match(browseSource, /id="browse-manage-toggle"/);
    assert.match(browseSource, /id="browse-manage-toggle"[\s\S]*?>Manage<\/span>[\s\S]*?id="browse-stats"/);
    assert.match(browseSource, /id="browse-manage-done"/);
    assert.match(browseSource, /id="browse-bulk-toolbar"[\s\S]*?hidden/);
    assert.match(browseSource, /manageToggleBtn\?\.addEventListener\("click", \(\) => setBrowseManageMode\(!browseManageMode\)\)/);
    assert.match(browseSource, /manageDoneBtn\?\.addEventListener\("click", \(\) => setBrowseManageMode\(false\)\)/);
    assert.doesNotMatch(browseSource, /managementHost|isEmbeddedManagement|renderManagePanel/);
    assert.match(insightsSource, /<h3 id="card-insights-title">Card Stats<\/h3>/);
    assert.doesNotMatch(insightsSource, /data-insights-tab|data-insights-panel="manage"|renderManagePanel/);
});

test("selection remains thumbnail-first and exposes visible mouse controls", async () => {
    const [source, styles, referenceUx] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(stylesUrl, "utf8"),
        readFile(referenceUxUrl, "utf8"),
    ]);

    assert.match(source, /localprompt-card-select-indicator/);
    assert.match(source, /buildPromptCardHtml\(prompt, hasPreview, \{ management: browseManageMode \}\)/);
    assert.doesNotMatch(source, /if \(management\) \{[\s\S]*?item-prompt-text/);
    assert.match(source, /id="browse-select-visible"[\s\S]*?>Select page</);
    assert.match(source, /id="browse-select-all-results"[\s\S]*?>Select all matching</);
    assert.match(source, /id="browse-clear-selected"[\s\S]*?>Clear</);
    assert.match(styles, /\.localprompt-card-select-indicator/);
    assert.match(styles, /\.localprompt-gallery-item\.manage-mode\.bulk-selected \.localprompt-card-select-indicator::after/);
    assert.match(referenceUx, /\.localprompt-bulk-toolbar\[hidden\]/);
});

test("Card Manager controls use one compact row and inline status", async () => {
    const [source, referenceUx] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(referenceUxUrl, "utf8"),
    ]);

    assert.doesNotMatch(source, /localprompt-browse-toolbar-row-actions/);
    assert.match(source, /id="browse-filter"[\s\S]*?id="browse-category"[\s\S]*?id="browse-sort"[\s\S]*?id="browse-manage-toggle"/);
    assert.match(source, /id="browse-bulk-summary"[\s\S]*?id="browse-bulk-status"[\s\S]*?localprompt-bulk-selection-actions/);
    assert.match(referenceUx, /localprompt-browse-search \{[\s\S]*?flex: 0 0 48px/);
    assert.match(referenceUx, /localprompt-browse-search:focus-within,[\s\S]*?flex-basis: 220px/);
    assert.match(referenceUx, /localprompt-browse-toolbar-row-primary \{[\s\S]*?min-height: 48px;[\s\S]*?flex-wrap: nowrap/);
    assert.match(referenceUx, /localprompt-browse-toolbar \.localprompt-browse-input,[\s\S]*?height: 48px !important/);
    assert.match(referenceUx, /localprompt-browse-toolbar-row \.localprompt-browse-toolbar-btn \{[\s\S]*?height: 48px !important/);
    assert.match(referenceUx, /localprompt-bulk-toolbar \{[\s\S]*?top: 60px/);
    assert.match(referenceUx, /localprompt-browse-select \{[\s\S]*?width: 190px/);
    assert.match(referenceUx, /localprompt-browse-sort-select \{[\s\S]*?width: 130px/);
    assert.match(referenceUx, /localprompt-bulk-status:not\(:empty\) \{[\s\S]*?flex: 0 1 auto/);
});

test("bulk selection retains explicit and query-wide backend descriptors", async () => {
    const [browseSource, apiSource, backendSource] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(promptApiUrl, "utf8"),
        readFile(backendUrl, "utf8"),
    ]);

    assert.match(browseSource, /return \{ type: "ids", ids: Array\.from\(bulkSelectedPromptIds\) \}/);
    assert.match(browseSource, /type: "query"/);
    assert.match(browseSource, /filter_name: bulkQuerySelection\.filter_name/);
    assert.match(browseSource, /exclusions: Array\.from\(bulkQuerySelection\.exclusions\)/);
    assert.match(apiSource, /url \+= `&categories=/);
    assert.match(backendSource, /request\.query\.getall\('categories', \[\]\)/);
    assert.doesNotMatch(apiSource, /categories\.slice\(0, 3\)/);
});

test("bulk delete uses one visual thumbnail confirmation", async () => {
    const [source, styles] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(stylesUrl, "utf8"),
    ]);

    assert.match(source, /function openBulkDeleteDialog/);
    assert.match(source, /localprompt-bulk-delete-grid/);
    assert.match(source, /prompts: idsToDelete\.map\(id => bulkSelectedPromptDetails\.get\(id\)\)/);
    assert.match(source, /await openBulkDeleteDialog/);
    assert.doesNotMatch(source, /Final confirmation: delete all/);
    assert.match(styles, /\.localprompt-bulk-delete-dialog/);
    assert.match(styles, /\.localprompt-bulk-delete-thumb img,/);
});

test("Card Stats keeps prompt-term statistics searchable and category scoped", async () => {
    const source = await readFile(insightsUrl, "utf8");
    assert.doesNotMatch(source, /MAX_CATEGORIES|up to three|up to 3/);
    assert.match(source, /categories: selectedCategories/);
    assert.match(source, /card_insights_categories/);
    assert.doesNotMatch(source, /Track|Tracked|trackedTags|tracked_entries|card_insights_tracked_tags/);
});
