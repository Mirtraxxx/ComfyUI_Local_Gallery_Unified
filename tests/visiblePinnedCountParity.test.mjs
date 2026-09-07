import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    LORA_DISPLAY_LIMITS,
    normalizeVisiblePinnedFolderCount,
} from "../js/lora/displayState.js";
import {
    VISIBLE_PINNED_CATEGORY_COUNT_DEFAULT,
    VISIBLE_PINNED_CATEGORY_COUNT_MAX,
    VISIBLE_PINNED_CATEGORY_COUNT_MIN,
} from "../js/prompt/constants.js";

const LORA_SOURCE = readFileSync(new URL("../js/lora/ui.js", import.meta.url), "utf8");
const PROMPT_TEMPLATE = readFileSync(new URL("../js/prompt/template.js", import.meta.url), "utf8");
const PROMPT_UI = readFileSync(new URL("../js/prompt/ui.js", import.meta.url), "utf8");
const PROMPT_SETTINGS = readFileSync(new URL("../js/prompt/settings.js", import.meta.url), "utf8");
const PROMPT_BACKEND = readFileSync(new URL("../backend/Local_Prompt_Gallery.py", import.meta.url), "utf8");

// A Display Options knob row: "<WORD>: <live count>" title, then a range input
// bracketed by the min/max gutter labels.
function boundsOfKnob(source, titleText, labelTitle, label) {
    const titleIndex = source.indexOf(`${titleText}: <span`);
    assert.notEqual(titleIndex, -1, `missing the "${titleText}" live count title in ${label}`);
    const after = source.slice(titleIndex);
    const labelIndex = after.indexOf(labelTitle);
    assert.notEqual(labelIndex, -1, `missing the "${labelTitle}" control in ${label}`);

    const input = after.slice(labelIndex).match(/<input[^>]*type="range"[^>]*>/);
    assert.ok(input, `missing the "${titleText}" range input in ${label}`);
    const attribute = (name) => {
        const match = input[0].match(new RegExp(`${name}="(\\d+)"`));
        assert.ok(match, `the "${titleText}" knob is missing ${name} in ${label}`);
        return Number(match[1]);
    };

    const gutters = (after.slice(labelIndex, labelIndex + 800).match(/<span>(\d+)<\/span>/g) || [])
        .map((span) => Number(span.match(/(\d+)/)[0]));

    return {
        min: attribute("min"),
        max: attribute("max"),
        step: attribute("step"),
        gutters,
    };
}

test("both galleries expose the visible pinned count knob from the display popover", () => {
    // LoRA calls them folders, Prompt calls them categories; the row itself is
    // the same control, in the same place, with the live count in the title.
    assert.ok(/FOLDERS: <span class="lora-visible-folders-count-val"/.test(LORA_SOURCE));
    assert.ok(/CATEGORIES: <span class="localprompt-visible-categories-count-val"/.test(PROMPT_TEMPLATE));
    assert.ok(LORA_SOURCE.includes('title="Visible pinned folders count"'));
    assert.ok(PROMPT_TEMPLATE.includes('title="Visible pinned categories count"'));
});

test("the visible pinned count knob offers the same reach in both galleries", () => {
    const lora = boundsOfKnob(LORA_SOURCE, "FOLDERS", 'title="Visible pinned folders count"', "lora");
    const prompt = boundsOfKnob(PROMPT_TEMPLATE, "CATEGORIES", 'title="Visible pinned categories count"', "prompt");
    const shared = { min: 1, max: 20, step: 1, gutters: [1, 20] };

    assert.deepEqual(lora, shared, "the LoRA folders knob drifted from the shared window");
    assert.deepEqual(prompt, shared, "the Prompt categories knob drifted from the shared window");
});

test("the shared window is the single source of truth in both galleries", () => {
    assert.equal(LORA_DISPLAY_LIMITS.visibleFolderMin, VISIBLE_PINNED_CATEGORY_COUNT_MIN);
    assert.equal(LORA_DISPLAY_LIMITS.visibleFolderMax, VISIBLE_PINNED_CATEGORY_COUNT_MAX);
    assert.equal(normalizeVisiblePinnedFolderCount(99), VISIBLE_PINNED_CATEGORY_COUNT_MAX);
    assert.equal(normalizeVisiblePinnedFolderCount(0), VISIBLE_PINNED_CATEGORY_COUNT_MIN);
    assert.equal(normalizeVisiblePinnedFolderCount("12.6"), 13);
    // Each domain seeds its own default: a folder shelf fits more than a category row.
    assert.equal(normalizeVisiblePinnedFolderCount(undefined), 8);
    assert.equal(VISIBLE_PINNED_CATEGORY_COUNT_DEFAULT, 5);
});

test("the prompt normalizer reads the shared constants instead of literals", () => {
    const normalizer = PROMPT_UI.match(/function normalizeVisiblePinnedCategoryCount\([\s\S]*?\n            \}/);
    assert.ok(normalizer, "missing the prompt visible category normalizer");
    assert.ok(normalizer[0].includes("VISIBLE_PINNED_CATEGORY_COUNT_MIN"));
    assert.ok(normalizer[0].includes("VISIBLE_PINNED_CATEGORY_COUNT_MAX"));
    assert.ok(normalizer[0].includes("VISIBLE_PINNED_CATEGORY_COUNT_DEFAULT"));

    const getter = PROMPT_UI.match(/function getVisiblePinnedCategoryCount\([\s\S]*?\n            \}/);
    assert.ok(getter, "missing the prompt visible category getter");
    assert.ok(getter[0].includes("normalizeVisiblePinnedCategoryCount(node_instance.uiPrefs"));
    assert.ok(
        !/Math\.max\(1, Math\.min\(20, Math\.round\(count\)\)/.test(PROMPT_UI),
        "a stray hand-written 1..20 clamp is still clamping the count",
    );
});

test("the gear dialog no longer duplicates the visible pinned count knob", () => {
    assert.ok(
        !PROMPT_SETTINGS.includes("settings-visible-pinned-category-count"),
        "the gear dialog re-added the category count field",
    );
    assert.ok(
        !PROMPT_SETTINGS.includes("visible_pinned_category_count:"),
        "the gear dialog must not overwrite the popover-owned count",
    );
});

test("the prompt backend clamps the count to the window the popover exposes", () => {
    const clamp = PROMPT_BACKEND.match(/^[^\n]*"visible_pinned_category_count"[^\n]*_normalize_int[^\n]*$/m);
    assert.ok(clamp, "missing the backend normalizer window for visible_pinned_category_count");
    const numbers = [...clamp[0].matchAll(/\b\d+\b/g)].map((match) => Number(match[0]));
    assert.ok(numbers.length >= 2, "the backend normalizer must state its numeric window");
    const [min, max] = numbers.slice(-2);
    assert.deepEqual([min, max], [VISIBLE_PINNED_CATEGORY_COUNT_MIN, VISIBLE_PINNED_CATEGORY_COUNT_MAX]);
});
