import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getLoraStyles } from "../js/lora/styles.js";
import { getPromptStyles } from "../js/prompt/styles.js";

const LORA_SOURCE = readFileSync(new URL("../js/lora/ui.js", import.meta.url), "utf8");
const PROMPT_SOURCE = readFileSync(new URL("../js/prompt/template.js", import.meta.url), "utf8");

function declarationsFor(css, selector, label) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);
    const matches = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))];
    assert.equal(matches.length, 1, `${label} must be declared exactly once, found ${matches.length}`);
    return Object.fromEntries(
        matches[0][1]
            .split(";")
            .map((declaration) => declaration.trim())
            .filter(Boolean)
            .map((declaration) => {
                const [property, ...rest] = declaration.split(":");
                return [property.trim().toLowerCase(), rest.join(":").trim()];
            }),
    );
}

function assertSameSpine(label, loraSelector, promptSelector, { ignore = [] } = {}) {
    const lora = declarationsFor(getLoraStyles("node-1"), loraSelector, `${label} (lora)`);
    const prompt = declarationsFor(getPromptStyles("node-1"), promptSelector, `${label} (prompt)`);
    for (const property of ignore) {
        delete lora[property];
        delete prompt[property];
    }
    assert.deepEqual(prompt, lora, `the ${label} rule drifted between the LoRA and Prompt galleries`);
}

test("the display options popover shares one spine across both galleries", () => {
    // z-index is owned by each gallery's own stacking context.
    assertSameSpine("popover", ".lora-display-options-popover", ".localprompt-display-options-popover", {
        ignore: ["z-index"],
    });
});

test("the display options panel, sections and titles match across galleries", () => {
    assertSameSpine("panel", ".lora-display-options-panel", ".localprompt-display-options-panel");
    assertSameSpine("section", ".lora-display-section", ".localprompt-display-section");
    assertSameSpine("section title", ".lora-display-section-title", ".localprompt-display-section-title");
});

test("the display options selects are styled identically", () => {
    assertSameSpine("select", ".lora-display-mode-select", ".localprompt-display-mode-select");
    assertSameSpine("select option", ".lora-display-mode-select option", ".localprompt-display-mode-select option");
});

test("the size slider row is laid out identically", () => {
    assertSameSpine(
        "size control",
        ".lora-thumbnail-size-control",
        ".localprompt-thumbnail-size-control",
    );
    // accent-color follows each gallery's brand hue (LoRA orange, Prompt green) on purpose.
    assertSameSpine(
        "size control slider",
        ".lora-thumbnail-size-control input[type=range]",
        '.localprompt-thumbnail-size-control input[type="range"]',
        { ignore: ["accent-color"] },
    );
});

test("the disabled size row is dimmed identically", () => {
    assertSameSpine(
        "disabled size control",
        ".lora-thumbnail-size-control.disabled",
        ".localprompt-thumbnail-size-control.disabled",
    );
    assertSameSpine(
        "disabled size slider",
        ".lora-thumbnail-size-control.disabled input[type=range]",
        '.localprompt-thumbnail-size-control.disabled input[type="range"]',
    );
});

function markupAfter(source, anchor, label) {
    const index = source.indexOf(anchor);
    assert.notEqual(index, -1, `missing anchor ${label}`);
    return source.slice(index + anchor.length);
}

function svgOfDisplayOptionsTrigger(source, anchor, label) {
    const after = markupAfter(source, anchor, label);
    const match = after.match(/<svg[\s\S]*?\/*><\/svg>/);
    assert.ok(match, `missing the display options trigger icon for ${label}`);
    return match[0];
}

test("both galleries open display options from the same icon", () => {
    assert.equal(
        svgOfDisplayOptionsTrigger(PROMPT_SOURCE, 'title="Display options"', "prompt"),
        svgOfDisplayOptionsTrigger(LORA_SOURCE, 'title="Display options"', "lora"),
    );
});

function optionValues(source, anchor, label) {
    const body = markupAfter(source, anchor, label).split("</select>")[0];
    const options = body.match(/<option[^>]*value="([^"]*)"/g);
    assert.ok(options, `missing option entries for ${label}`);
    return options.map((option) => option.match(/value="([^"]*)"/)[1]);
}

test("the display mode selects list their options in the same order", () => {
    const loraActive = optionValues(LORA_SOURCE, 'title="Active display mode">', "lora active");
    const promptActive = optionValues(PROMPT_SOURCE, '-active-display-mode" class="localprompt-display-mode-select" title="Active display mode">', "prompt active");
    assert.deepEqual(promptActive, loraActive);

    const loraCards = optionValues(LORA_SOURCE, 'title="Cards display mode">', "lora cards");
    const promptCards = optionValues(PROMPT_SOURCE, '-cards-display-mode" class="localprompt-display-mode-select" title="Cards display mode">', "prompt cards");
    assert.deepEqual(promptCards, loraCards);
    assert.deepEqual(promptCards, loraActive.slice(0, promptCards.length));
});

test("the sort menus keep the same relative order for shared modes", () => {
    const SHARED = ["az", "za", "newest", "oldest"];
    const relative = (values) => values.filter((value) => SHARED.includes(value));

    const lora = relative(optionValues(LORA_SOURCE, 'title="Sort LoRA cards">', "lora sort"));
    const prompt = relative(optionValues(PROMPT_SOURCE, '-main-sort-select" class="localprompt-display-mode-select" title="Sort cards">', "prompt sort"));

    assert.deepEqual(lora, SHARED);
    assert.deepEqual(prompt, SHARED);
});
