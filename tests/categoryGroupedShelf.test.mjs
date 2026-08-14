import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const controllerUrl = new URL("../js/prompt/categoryStripController.js", import.meta.url);
const referenceUxUrl = new URL("../js/prompt/referenceUx.js", import.meta.url);

const {
    getCategoryColorFamily,
    groupCategoryEntriesByColor,
} = await importModuleSource(controllerUrl);

test("category colors resolve into readable shelf families", () => {
    assert.equal(getCategoryColorFamily("#e03131").label, "Red");
    assert.equal(getCategoryColorFamily("#f76707").label, "Orange");
    assert.equal(getCategoryColorFamily("#e9c46a").label, "Gold");
    assert.equal(getCategoryColorFamily("#74b816").label, "Green");
    assert.equal(getCategoryColorFamily("#12b886").label, "Teal");
    assert.equal(getCategoryColorFamily("#1c7ed6").label, "Blue");
    assert.equal(getCategoryColorFamily("#862e9c").label, "Violet");
    assert.equal(getCategoryColorFamily("#c2255c").label, "Rose");
    assert.equal(getCategoryColorFamily("#6c757d").label, "Neutral");
    assert.equal(getCategoryColorFamily("").label, "Other");
});

test("category shelf groups by color family while preserving first-seen order", () => {
    const entries = [
        { category: "Angle", color: "#f08c00" },
        { category: "Artists", color: "#e03131" },
        { category: "Camera", color: "#f76707" },
        { category: "Expressions", color: "#15aabf" },
        { category: "Unassigned", color: "" },
    ];

    const groups = groupCategoryEntriesByColor(entries);

    assert.deepEqual(groups.map(group => group.label), ["Orange", "Red", "Teal", "Other"]);
    assert.deepEqual(groups[0].entries.map(entry => entry.category), ["Angle", "Camera"]);
    assert.equal(groups[0].color, "#f08c00");
});

test("category overflow renders search and bar-scale-aware group rows", async () => {
    const [controller, styles] = await Promise.all([
        readFile(controllerUrl, "utf8"),
        readFile(referenceUxUrl, "utf8"),
    ]);

    assert.match(controller, /type = "search"/);
    assert.match(controller, /placeholder = "Search categories"/);
    assert.match(controller, /groupCategoryEntriesByColor\(categoryEntries\)/);
    assert.match(controller, /title\.textContent = group\.label/);
    assert.match(controller, /No categories match your search\./);
    assert.match(styles, /\.localprompt-category-groups \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;[\s\S]*?var\(--localprompt-bar-scale, 1\)/);
    assert.doesNotMatch(styles, /columns: 220px 3/);
    assert.match(styles, /\.localprompt-category-group \{[\s\S]*?border-top: max\(2px, calc\(3px \* var\(--localprompt-bar-scale, 1\)\)\) solid var\(--category-group-color\)/);
    assert.match(styles, /\.localprompt-category-group-items \{[\s\S]*?repeat\([\s\S]*?auto-fill,[\s\S]*?minmax\(calc\(138px \* var\(--localprompt-bar-scale, 1\)\), 1fr\)/);
    assert.match(styles, /\.localprompt-category-group-items \.localprompt-pinned-category-pill\.has-role-color \{[\s\S]*?var\(--category-group-color\) 13%[\s\S]*?border-left-color: var\(--category-group-color\) !important;/);
});
