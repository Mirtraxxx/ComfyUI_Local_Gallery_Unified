import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browseUrl = new URL("../js/prompt/browse.js", import.meta.url);
const insightsUrl = new URL("../js/prompt/wildcardStats.js", import.meta.url);
const promptApiUrl = new URL("../js/api/promptApi.js", import.meta.url);
const backendUrl = new URL("../backend/Local_Prompt_Gallery.py", import.meta.url);

test("Card Insights owns management while the normal Card Manager toolbar stays calm", async () => {
    const [browseSource, insightsSource] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(insightsUrl, "utf8"),
    ]);

    assert.doesNotMatch(browseSource, /id="browse-manage-toggle"/);
    assert.match(browseSource, /isEmbeddedManagement \? `<div id="browse-category-actions"/);
    assert.match(browseSource, /isEmbeddedManagement \? `<div id="browse-bulk-toolbar"/);
    assert.match(browseSource, /localprompt-bulk-selection-actions[\s\S]*?localprompt-bulk-edit-actions[\s\S]*?localprompt-bulk-cleanup-actions/);
    assert.doesNotMatch(browseSource, /enterInsightsManagement|exitInsightsManagement|card-insights-child|browse-done-insights/);
    assert.match(browseSource, /managementHost: host/);
    assert.match(browseSource, /buildPromptCardHtml\(prompt, hasPreview, \{ management: isEmbeddedManagement \}\)/);
    assert.match(insightsSource, /data-insights-panel="manage"/);
    assert.match(insightsSource, /renderManagePanel\(root\.querySelector\("\[data-insights-manage-host\]"\), \{/);
    assert.match(insightsSource, /managePanelCleanup\?\.\(\)/);
    assert.match(insightsSource, /data-stats-pagination hidden/);
    assert.match(insightsSource, /statsPagination\.hidden = panelName !== "stats"/);
    assert.equal((insightsSource.match(/<button[^>]+data-insights-tab=/g) || []).length, 2);
    assert.match(insightsSource, /data-insights-tab="stats"/);
    assert.match(insightsSource, /data-insights-tab="manage"/);
    assert.doesNotMatch(insightsSource, /Tag Explorer|data-insights-tab="overview"/);
});

test("Card Insights keeps prompt-term statistics searchable and category scoped", async () => {
    const source = await readFile(insightsUrl, "utf8");
    assert.doesNotMatch(source, /MAX_CATEGORIES|up to three|up to 3/);
    assert.match(source, /categories: selectedCategories/);
    assert.match(source, /card_insights_categories/);
    assert.doesNotMatch(source, /Track|Tracked|trackedTags|tracked_entries|card_insights_tracked_tags/);
});

test("normal Card Manager cannot render management controls without an injected Insights host", async () => {
    const source = await readFile(browseUrl, "utf8");
    assert.match(source, /const isEmbeddedManagement = !!managementHost;/);
    assert.match(source, /overlay\.dataset\.cardManagementPanel === "true"/);
    assert.match(source, /\$\{isEmbeddedManagement \? `<div id="browse-bulk-toolbar"/);
});

test("Insights management reuses the selected category union for browsing and bulk queries", async () => {
    const [browseSource, insightsSource, apiSource, backendSource] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(insightsUrl, "utf8"),
        readFile(promptApiUrl, "utf8"),
        readFile(backendUrl, "utf8"),
    ]);

    assert.match(insightsSource, /categories: \[\.\.\.selectedCategories\]/);
    assert.match(browseSource, /managementCategories = \[\]/);
    assert.match(browseSource, /data-management-category-options/);
    assert.match(browseSource, />All Categories</);
    assert.match(browseSource, /onManagementCategoriesChange/);
    assert.match(browseSource, /categories: bulkQuerySelection\.categories \|\| \[\]/);
    assert.match(browseSource, /categories: isEmbeddedManagement && !categorySelect\.value/);
    assert.match(apiSource, /url \+= `&categories=/);
    assert.match(backendSource, /request\.query\.getall\('categories', \[\]\)/);
    assert.match(backendSource, /category_scope = set\(categories\)/);
    assert.doesNotMatch(apiSource, /categories\.slice\(0, 3\)/);
    assert.doesNotMatch(backendSource, /Choose up to three categories/);
});

test("Insights management uses a thumbnail-free prompt list", async () => {
    const [source, styles] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(new URL("../js/prompt/styles.js", import.meta.url), "utf8"),
    ]);
    assert.match(source, /if \(management\) \{[\s\S]*?item-prompt-text/);
    assert.match(source, /if \(management\) \{[\s\S]*?return `[\s\S]*?`;/);
    assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(styles, /localprompt-card-management-panel \.localprompt-gallery-grid \{ grid-template-columns: 1fr; \}/);
});

test("management child dialogs mount above Card Insights", async () => {
    const [source, styles] = await Promise.all([
        readFile(browseUrl, "utf8"),
        readFile(new URL("../js/prompt/styles.js", import.meta.url), "utf8"),
    ]);
    assert.match(source, /root\.closest\("\.localprompt-card-insights-overlay"\) \|\| managementHost/);
    assert.match(styles, /localprompt-card-insights-overlay > \.localprompt-bulk-edit-overlay[\s\S]*?z-index: 100/);
});
