import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const controllerUrl = new URL("../js/prompt/categoryStripController.js", import.meta.url);
const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);
const templateUrl = new URL("../js/prompt/template.js", import.meta.url);

const {
    CATEGORY_OVERFLOW_MIN_HEIGHT,
    clampCategoryOverflowHeight,
    setupCategoryOverflowResize,
} = await importModuleSource(controllerUrl);

test("category overflow resize stays within its minimum and the visible viewport", () => {
    assert.equal(CATEGORY_OVERFLOW_MIN_HEIGHT, 120);
    assert.equal(clampCategoryOverflowHeight(80, 100, 900), 120);
    assert.equal(clampCategoryOverflowHeight(420, 100, 900), 420);
    assert.equal(clampCategoryOverflowHeight(900, 100, 900), 776);
    assert.equal(clampCategoryOverflowHeight(900, 100, 900, 120, 24, 0.5), 900);
});

test("category overflow exposes the pull tab as a resize grip while open", async () => {
    const [controller, styles, template] = await Promise.all([
        readFile(controllerUrl, "utf8"),
        readFile(stylesUrl, "utf8"),
        readFile(templateUrl, "utf8"),
    ]);

    assert.match(controller, /setPointerCapture\?\.\(event\.pointerId\)/);
    assert.match(controller, /--localprompt-category-overflow-height/);
    assert.match(controller, /suppressNextClick = true/);
    assert.match(styles, /max-height: var\(--localprompt-category-overflow-height, 250px\)/);
    assert.match(styles, /\.localprompt-category-pull-tab\[aria-expanded="true"\],[\s\S]*?cursor: ns-resize/);
    assert.match(template, /Drag when open to resize/);
});

test("dragging a scaled ComfyUI node tracks pointer distance and suppresses the trailing click", () => {
    class FakeElement {
        constructor() {
            this.attributes = new Map();
            this.classes = new Set();
            this.listeners = new Map();
            this.classList = {
                add: value => this.classes.add(value),
                remove: value => this.classes.delete(value),
            };
            this.style = {
                values: new Map(),
                setProperty: (name, value) => this.style.values.set(name, value),
            };
        }

        addEventListener(type, listener, capture = false) {
            const listeners = this.listeners.get(type) || [];
            listeners.push({ listener, capture });
            this.listeners.set(type, listeners);
        }

        removeEventListener(type, listener, capture = false) {
            const listeners = this.listeners.get(type) || [];
            this.listeners.set(type, listeners.filter(entry => (
                entry.listener !== listener || entry.capture !== capture
            )));
        }

        dispatch(type, values = {}) {
            const event = {
                button: 0,
                pointerId: 7,
                clientY: 0,
                defaultPrevented: false,
                immediatePropagationStopped: false,
                preventDefault() {
                    this.defaultPrevented = true;
                },
                stopImmediatePropagation() {
                    this.immediatePropagationStopped = true;
                },
                ...values,
            };
            const listeners = [...(this.listeners.get(type) || [])]
                .sort((left, right) => Number(right.capture) - Number(left.capture));
            for (const entry of listeners) {
                entry.listener(event);
                if (event.immediatePropagationStopped) break;
            }
            return event;
        }

        getAttribute(name) {
            return this.attributes.get(name) ?? null;
        }

        setAttribute(name, value) {
            this.attributes.set(name, String(value));
        }

        setPointerCapture(pointerId) {
            this.capturedPointerId = pointerId;
        }
    }

    const panel = new FakeElement();
    panel.offsetHeight = 250;
    panel.getBoundingClientRect = () => ({ top: 100, height: 125 });

    const pullTab = new FakeElement();
    pullTab.setAttribute("aria-expanded", "true");

    const widgetContainer = {
        querySelector(selector) {
            if (selector.endsWith("-category-overflow")) return panel;
            if (selector.endsWith("-category-pull-tab")) return pullTab;
            return null;
        },
    };

    const previousWindow = globalThis.window;
    const fakeWindow = new FakeElement();
    fakeWindow.innerHeight = 900;
    globalThis.window = fakeWindow;
    const committedHeights = [];
    let storedHeight = 320;

    try {
        const dispose = setupCategoryOverflowResize(widgetContainer, "test", {
            getStoredHeight: () => storedHeight,
            onHeightCommit: height => committedHeights.push(height),
        });
        assert.equal(panel.style.values.get("--localprompt-category-overflow-height"), "320px");
        storedHeight = 360;
        dispose.applyStoredHeight();
        assert.equal(panel.style.values.get("--localprompt-category-overflow-height"), "360px");
        pullTab.dispatch("pointerdown", { clientY: 400 });
        pullTab.dispatch("pointermove", { clientY: 500 });
        pullTab.dispatch("pointerup", { clientY: 500 });
        const trailingClick = pullTab.dispatch("click");

        assert.equal(pullTab.capturedPointerId, 7);
        assert.equal(panel.style.values.get("--localprompt-category-overflow-height"), "450px");
        assert.deepEqual(committedHeights, [450]);
        assert.equal(trailingClick.defaultPrevented, true);
        assert.equal(trailingClick.immediatePropagationStopped, true);
        assert.equal(panel.classes.has("is-resizing"), false);
        dispose();
    } finally {
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    }
});

test("category overflow height is stored in prompt UI prefs for F5 restore", async () => {
    const [controller, preferences, backend] = await Promise.all([
        readFile(controllerUrl, "utf8"),
        readFile(new URL("../js/prompt/preferences.js", import.meta.url), "utf8"),
        readFile(new URL("../backend/Local_Prompt_Gallery.py", import.meta.url), "utf8"),
    ]);

    assert.match(preferences, /category_overflow_height:\s*250/);
    assert.match(preferences, /normalizeCategoryOverflowHeight/);
    assert.match(controller, /getStoredHeight/);
    assert.match(controller, /onHeightCommit/);
    assert.match(controller, /persistCategoryOverflowHeight/);
    assert.match(controller, /disposeOverflowResize\.applyStoredHeight\?\.\(\)/);
    assert.match(backend, /"category_overflow_height":\s*250/);
    assert.match(backend, /"category_overflow_height":\s*lambda value, prefs: _normalize_int\(value, UI_PREF_DEFAULTS\["category_overflow_height"\], 120, 900\)/);
});
