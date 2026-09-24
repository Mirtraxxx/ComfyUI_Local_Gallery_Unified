import assert from "node:assert/strict";
import test from "node:test";

import {
    ACTIVE_SIDEBAR_WIDTH_LARGE_DEFAULT,
    ACTIVE_SIDEBAR_WIDTH_LARGE_MAX,
    ACTIVE_SIDEBAR_WIDTH_LARGE_MIN,
    ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT,
    ACTIVE_SIDEBAR_WIDTH_NORMAL_MAX,
    ACTIVE_SIDEBAR_WIDTH_NORMAL_MIN,
} from "../js/prompt/constants.js";
import { clampActiveSidebarWidth, getActiveSidebarWidth, getActiveSidebarWidthBounds } from "../js/prompt/helpers.js";
import { getPromptStyles } from "../js/prompt/styles.js";

const CLAMP_PATTERN =
    /clamp\(\s*(\d+)px\s*,\s*var\(--localprompt-active-sidebar-width\s*,\s*(\d+)px\s*\)\s*,\s*(\d+)px\s*\)/g;

function readSidebarClamps() {
    const css = getPromptStyles("node-1");
    const matches = [...css.matchAll(CLAMP_PATTERN)].map((match) => ({
        min: Number(match[1]),
        fallback: Number(match[2]),
        max: Number(match[3]),
    }));
    assert.equal(matches.length, 2, "expected one clamp for the normal sidebar and one for large-mode");
    return matches;
}

test("the active sidebar clamp is driven by the shared width constants", () => {
    const [normal, large] = readSidebarClamps();

    assert.deepEqual(normal, {
        min: ACTIVE_SIDEBAR_WIDTH_NORMAL_MIN,
        fallback: ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT,
        max: ACTIVE_SIDEBAR_WIDTH_NORMAL_MAX,
    });
    assert.deepEqual(large, {
        min: ACTIVE_SIDEBAR_WIDTH_LARGE_MIN,
        fallback: ACTIVE_SIDEBAR_WIDTH_LARGE_DEFAULT,
        max: ACTIVE_SIDEBAR_WIDTH_LARGE_MAX,
    });
});

test("drag bounds never exceed the width CSS is able to paint", () => {
    const normal = getActiveSidebarWidthBounds(1400, 1400, {}, {
        active_display_mode: "compact",
        active_card_size_mode: "default",
    });
    assert.equal(normal.minWidth, ACTIVE_SIDEBAR_WIDTH_NORMAL_MIN);
    assert.equal(normal.maxWidth, ACTIVE_SIDEBAR_WIDTH_NORMAL_MAX);

    const large = getActiveSidebarWidthBounds(1400, 1400, {}, {
        active_display_mode: "thumbnails",
        active_card_size_mode: "large",
    });
    assert.equal(large.minWidth, ACTIVE_SIDEBAR_WIDTH_LARGE_MIN);
    assert.equal(large.maxWidth, ACTIVE_SIDEBAR_WIDTH_LARGE_MAX);
});

test("a stored sidebar width survives mode switches and clamps only when painted", () => {
    const compactPrefs = {
        active_display_mode: "compact",
        active_card_size_mode: "default",
    };
    const largePrefs = {
        active_display_mode: "thumbnails",
        active_card_size_mode: "large",
    };

    // The getter returns the raw stored width so a large-mode width survives a
    // compact-mode load; painting clamps it into the current mode's range.
    assert.equal(getActiveSidebarWidth({ active_sidebar_width: 900 }, compactPrefs), 900);
    assert.equal(getActiveSidebarWidth({ active_sidebar_width: 120 }, compactPrefs), 120);
    assert.equal(
        clampActiveSidebarWidth(900, getActiveSidebarWidthBounds(1400, 1400, {}, compactPrefs)),
        ACTIVE_SIDEBAR_WIDTH_NORMAL_MAX,
    );
    assert.equal(
        clampActiveSidebarWidth(120, getActiveSidebarWidthBounds(1400, 1400, {}, compactPrefs)),
        ACTIVE_SIDEBAR_WIDTH_NORMAL_MIN,
    );
    assert.equal(
        clampActiveSidebarWidth(400, getActiveSidebarWidthBounds(1400, 1400, {}, largePrefs)),
        ACTIVE_SIDEBAR_WIDTH_LARGE_MIN,
    );
});

test("an unset sidebar width falls back to the mode default", () => {
    assert.equal(
        getActiveSidebarWidth({}, { active_display_mode: "compact", active_card_size_mode: "default" }),
        ACTIVE_SIDEBAR_WIDTH_NORMAL_DEFAULT,
    );
    assert.equal(
        getActiveSidebarWidth({}, { active_display_mode: "thumbnails", active_card_size_mode: "large" }),
        ACTIVE_SIDEBAR_WIDTH_LARGE_DEFAULT,
    );
});
