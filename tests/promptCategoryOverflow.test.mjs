import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { importModuleSource } from "./importModuleSource.mjs";

const preferencesUrl = new URL("../js/prompt/preferences.js", import.meta.url);
const backendUrl = new URL("../backend/Local_Prompt_Gallery.py", import.meta.url);
const stylesUrl = new URL("../js/prompt/styles.js", import.meta.url);
const referenceUxUrl = new URL("../js/prompt/referenceUx.js", import.meta.url);
const controllerUrl = new URL("../js/prompt/categoryStripController.js", import.meta.url);
const uiUrl = new URL("../js/prompt/ui.js", import.meta.url);

test("backend and preferences define category_overflow_grouping preference", async () => {
    const [preferencesSource, backendSource] = await Promise.all([
        readFile(preferencesUrl, "utf8"),
        readFile(backendUrl, "utf8"),
    ]);

    assert.match(preferencesSource, /category_overflow_grouping:\s*"alpha"/);
    assert.match(backendSource, /"category_overflow_grouping":\s*"alpha"/);
    assert.match(backendSource, /"category_overflow_grouping":\s*lambda\s+value,\s*prefs:\s*_normalize_choice\(value,\s*\{"alpha",\s*"color"\},\s*UI_PREF_DEFAULTS\["category_overflow_grouping"\]\)/);
});

test("styles and referenceUx provide structured category overflow rules and taller max-height", async () => {
    const [stylesSource, referenceUxSource] = await Promise.all([
        readFile(stylesUrl, "utf8"),
        readFile(referenceUxUrl, "utf8"),
    ]);

    // max-height expansion
    assert.match(stylesSource, /\.localprompt-category-overflow\.open\s*\{[\s\S]*?max-height:\s*min\(420px,\s*65vh\)/);
    assert.match(stylesSource, /scroll-behavior:\s*smooth/);

    // sticky header & mode toggle
    assert.match(stylesSource, /\.localprompt-category-overflow-header\s*\{[\s\S]*?position:\s*sticky/);
    assert.match(stylesSource, /\.localprompt-category-mode-toggle/);
    assert.match(stylesSource, /\.localprompt-category-mode-btn\.active/);

    // jump strip
    assert.match(stylesSource, /\.localprompt-category-jump-strip/);
    assert.match(stylesSource, /\.localprompt-category-jump-item\.disabled/);
    assert.match(stylesSource, /\.localprompt-category-jump-item\.color-swatch/);

    // section headers & scroll margin
    assert.match(stylesSource, /\.localprompt-category-section\s*\{[\s\S]*?scroll-margin-top:/);
    assert.match(stylesSource, /\.localprompt-category-section-header/);
    assert.match(stylesSource, /\.localprompt-category-section-count/);

    // reference UX scaled rules
    assert.match(referenceUxSource, /\.localprompt-category-overflow-header/);
    assert.match(referenceUxSource, /\.localprompt-category-mode-toggle/);
    assert.match(referenceUxSource, /\.localprompt-category-jump-strip/);
    assert.match(referenceUxSource, /\.localprompt-category-section-header/);
});

test("ui.js passes category overflow grouping and role color helpers to controller", async () => {
    const uiSource = await readFile(uiUrl, "utf8");
    assert.match(uiSource, /getCategoryOverflowGrouping:\s*\(\)\s*=>\s*node_instance\.uiPrefs\?\.category_overflow_grouping\s*\|\|\s*"alpha"/);
    assert.match(uiSource, /setCategoryOverflowGrouping:\s*async\s*\(mode\)\s*=>/);
    assert.match(uiSource, /getCategoryRoleColor,/);
});

function createMockElement(tagName = "div") {
    const listeners = new Map();
    const children = [];
    const classListSet = new Set();
    const attributes = new Map();
    const styleObj = {
        setProperty(prop, val) { this[prop] = val; },
        removeProperty(prop) { delete this[prop]; },
    };

    const element = {
        tagName: tagName.toUpperCase(),
        dataset: {},
        style: styleObj,
        hidden: false,
        type: "button",
        value: "",
        textContent: "",
        title: "",
        id: "",
        get className() {
            return Array.from(classListSet).join(" ");
        },
        set className(val) {
            classListSet.clear();
            if (val) {
                val.split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
            }
        },
        classList: {
            add(...names) { names.forEach(n => classListSet.add(n)); },
            remove(...names) { names.forEach(n => classListSet.delete(n)); },
            toggle(name, force) {
                if (force === undefined) {
                    if (classListSet.has(name)) classListSet.delete(name);
                    else classListSet.add(name);
                } else if (force) {
                    classListSet.add(name);
                } else {
                    classListSet.delete(name);
                }
            },
            contains(name) { return classListSet.has(name); },
        },
        get children() { return children; },
        appendChild(child) {
            children.push(child);
            return child;
        },
        append(...items) {
            items.forEach(item => {
                if (typeof item === "string") {
                    const textNode = createMockElement("span");
                    textNode.textContent = item;
                    children.push(textNode);
                } else {
                    children.push(item);
                }
            });
        },
        setAttribute(name, val) { attributes.set(name, String(val)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        removeAttribute(name) { attributes.delete(name); },
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
        },
        dispatchEvent(event) {
            const handlers = listeners.get(event.type) || [];
            handlers.forEach(h => h(event));
        },
        scrollToCalls: [],
        scrollTo(options) {
            element.scrollToCalls.push(options);
        },
        querySelector(selector) {
            return element.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            const results = [];
            function traverse(node) {
                for (const child of node.children) {
                    if (matchesSelector(child, selector)) {
                        results.push(child);
                    }
                    traverse(child);
                }
            }
            traverse(element);
            return results;
        },
    };

    return element;
}

function matchesSelector(el, selector) {
    if (selector.startsWith("#")) {
        return el.id === selector.slice(1);
    }
    if (selector.includes(":not([hidden])")) {
        const base = selector.replace(":not([hidden])", "");
        return !el.hidden && matchesSelector(el, base);
    }
    if (selector.includes("[data-section-key=")) {
        const key = selector.match(/data-section-key="([^"]+)"/)?.[1];
        if (el.dataset.sectionKey !== key) return false;
        selector = selector.replace(/\[data-section-key="[^"]+"\]/, "");
        if (!selector) return true;
    }
    if (selector.includes("[data-jump-key=")) {
        const key = selector.match(/data-jump-key="([^"]+)"/)?.[1];
        if (el.dataset.jumpKey !== key) return false;
        selector = selector.replace(/\[data-jump-key="[^"]+"\]/, "");
        if (!selector) return true;
    }
    if (selector.includes("[data-mode=")) {
        const mode = selector.match(/data-mode="([^"]+)"/)?.[1];
        if (el.dataset.mode !== mode) return false;
        selector = selector.replace(/\[data-mode="[^"]+"\]/, "");
        if (!selector) return true;
    }
    if (selector.includes("[hidden]")) {
        if (!el.hidden) return false;
        selector = selector.replace(/\[hidden\]/, "");
        if (!selector) return true;
    }
    if (selector.startsWith("button")) {
        if (el.tagName !== "BUTTON") return false;
        selector = selector.slice(6);
        if (!selector) return true;
    }
    if (selector.startsWith(".")) {
        const classes = selector.split(".").filter(Boolean);
        return classes.every(cls => el.classList.contains(cls));
    }
    return false;
}

test("createPromptCategoryStripController renders Alphabetical sections and jump bar", async () => {
    const { createPromptCategoryStripController } = await importModuleSource(controllerUrl);

    // Setup global document mock for createElement
    const origDocument = globalThis.document;
    globalThis.document = {
        createElement: (tag) => createMockElement(tag),
        createTextNode: (text) => {
            const node = createMockElement("span");
            node.textContent = text;
            return node;
        },
    };

    try {
        const uniqueId = "test-node-1";
        const widgetContainer = createMockElement("div");

        const overflowContainer = createMockElement("div");
        overflowContainer.id = `${uniqueId}-category-overflow`;
        const chipsContainer = createMockElement("div");
        chipsContainer.id = `${uniqueId}-category-overflow-chips`;
        const moreBtn = createMockElement("button");
        moreBtn.id = `${uniqueId}-category-more-btn`;

        widgetContainer.appendChild(overflowContainer);
        widgetContainer.appendChild(chipsContainer);
        widgetContainer.appendChild(moreBtn);

        const allCategories = [
            "Angle", "Background", "Camera", "Default", "Effects", "Feet", "Hair", "Misc", "Poses", "123Numeric"
        ];
        // Visible pinned categories are Angle and Background
        const pinnedCategories = ["Angle", "Background"];

        let currentGrouping = "alpha";
        let savedGrouping = null;
        let selectedCategory = null;

        const controller = createPromptCategoryStripController({
            widgetContainer,
            uniqueId,
            getCachedCategories: async () => allCategories,
            ensurePinnedCategoriesInitialized: async () => pinnedCategories,
            getVisiblePinnedCategoryCount: () => 2,
            getCategoriesInCurrentOrder: (cats) => cats,
            getActiveLibraryTab: () => null,
            setActiveLibraryTab: (val) => { selectedCategory = val; },
            getCategoryOverflowOpen: () => true,
            setCategoryOverflowOpen: () => {},
            getSuppressCategoryClickUntil: () => 0,
            setSuppressCategoryClickUntil: () => {},
            setCategoryDragState: () => {},
            applyLibraryTabRoleStyling: () => {},
            showCategoryPillContextMenu: () => {},
            setWorkspaceMode: () => {},
            getWorkspaceMode: () => "gallery",
            renderLibraryDrawer: async () => {},
            clearLibraryNavActiveState: () => {},
            syncPromptSortControls: () => {},
            syncSelectedSectionVisibility: () => {},
            closeToolbarPanels: () => {},
            getCategoryOverflowGrouping: () => currentGrouping,
            setCategoryOverflowGrouping: async (mode) => {
                savedGrouping = mode;
                currentGrouping = mode;
            },
            getCategoryRoleColor: (cat) => (cat === "Camera" ? "#3b82f6" : null),
        });

        await controller.renderCategoryOverflowCategories();

        // Check header controls exist
        const searchInput = chipsContainer.querySelector(`#${uniqueId}-category-search`);
        assert.ok(searchInput, "search input should exist");

        const modeToggle = chipsContainer.querySelector(".localprompt-category-mode-toggle");
        assert.ok(modeToggle, "mode toggle should exist");

        // Sections: overflow excludes Angle and Background (the 2 visible pinned).
        // Overflow categories: Camera (C), Default (D), Effects (E), Feet (F), Hair (H), Misc (M), Poses (P), 123Numeric (#).
        const sections = chipsContainer.querySelectorAll(".localprompt-category-section");
        const sectionKeys = sections.map(s => s.dataset.sectionKey);
        assert.deepEqual(sectionKeys, ["C", "D", "E", "F", "H", "M", "P", "#"]);

        // Jump strip letters
        const jumpItems = chipsContainer.querySelectorAll(".localprompt-category-jump-item");
        assert.equal(jumpItems.length, 27); // A-Z (26) + # (1)
        const enabledLetters = jumpItems.filter(j => !j.classList.contains("disabled")).map(j => j.dataset.jumpKey);
        assert.deepEqual(enabledLetters, ["C", "D", "E", "F", "H", "M", "P", "#"]);

        // Clicking a jump item scrolls the overflow container toward the section
        const cSection = chipsContainer.querySelector(`.localprompt-category-section[data-section-key="C"]`);
        const cJump = jumpItems.find(j => j.dataset.jumpKey === "C");
        cJump.dispatchEvent({ type: "click" });
        assert.equal(overflowContainer.scrollToCalls.length, 1);
        assert.equal(typeof overflowContainer.scrollToCalls[0].top, "number");

        // Search filtering test:
        searchInput.value = "pose";
        searchInput.dispatchEvent({ type: "input" });

        // Poses section should be visible, others hidden
        const pSection = chipsContainer.querySelector(`.localprompt-category-section[data-section-key="P"]`);
        assert.equal(pSection.hidden, false);
        assert.equal(cSection.hidden, true);

        // Enter key selection test:
        let openedCategory = null;
        controller.openCategoryFromMenu = (cat) => { openedCategory = cat; };
        // The controller closure bound openCategoryFromMenu, which calls setActiveLibraryTab
        searchInput.dispatchEvent({ type: "keydown", key: "Enter", preventDefault: () => {} });
        assert.equal(selectedCategory, "Poses");

        // Mode switch test:
        const colorBtn = chipsContainer.querySelector(`button[data-mode="color"]`);
        assert.ok(colorBtn, "color mode button should exist");
        await colorBtn.dispatchEvent({ type: "click" });
        assert.equal(savedGrouping, "color");

        controller.dispose();
    } finally {
        globalThis.document = origDocument;
    }
});

test("createPromptCategoryStripController renders Color mode sections and swatches", async () => {
    const { createPromptCategoryStripController } = await importModuleSource(controllerUrl);

    const origDocument = globalThis.document;
    globalThis.document = {
        createElement: (tag) => createMockElement(tag),
        createTextNode: (text) => {
            const node = createMockElement("span");
            node.textContent = text;
            return node;
        },
    };

    try {
        const uniqueId = "test-node-2";
        const widgetContainer = createMockElement("div");

        const overflowContainer = createMockElement("div");
        overflowContainer.id = `${uniqueId}-category-overflow`;
        const chipsContainer = createMockElement("div");
        chipsContainer.id = `${uniqueId}-category-overflow-chips`;
        const moreBtn = createMockElement("button");
        moreBtn.id = `${uniqueId}-category-more-btn`;

        widgetContainer.appendChild(overflowContainer);
        widgetContainer.appendChild(chipsContainer);
        widgetContainer.appendChild(moreBtn);

        const allCategories = ["Camera", "Poses", "Hair", "Feet"];
        const colors = {
            "Camera": "#3b82f6",
            "Poses": "#ef4444",
            "Hair": "#3b82f6",
            // Feet has no color -> unassigned
        };

        const controller = createPromptCategoryStripController({
            widgetContainer,
            uniqueId,
            getCachedCategories: async () => allCategories,
            ensurePinnedCategoriesInitialized: async () => [],
            getVisiblePinnedCategoryCount: () => 0,
            getCategoriesInCurrentOrder: (cats) => cats,
            getActiveLibraryTab: () => null,
            setActiveLibraryTab: () => {},
            getCategoryOverflowOpen: () => true,
            setCategoryOverflowOpen: () => {},
            getSuppressCategoryClickUntil: () => 0,
            setSuppressCategoryClickUntil: () => {},
            setCategoryDragState: () => {},
            applyLibraryTabRoleStyling: () => {},
            showCategoryPillContextMenu: () => {},
            setWorkspaceMode: () => {},
            getWorkspaceMode: () => "gallery",
            renderLibraryDrawer: async () => {},
            clearLibraryNavActiveState: () => {},
            syncPromptSortControls: () => {},
            syncSelectedSectionVisibility: () => {},
            closeToolbarPanels: () => {},
            getCategoryOverflowGrouping: () => "color",
            setCategoryOverflowGrouping: async () => {},
            getCategoryRoleColor: (cat) => colors[cat] || null,
        });

        await controller.renderCategoryOverflowCategories();

        const sections = chipsContainer.querySelectorAll(".localprompt-category-section");
        const sectionKeys = sections.map(s => s.dataset.sectionKey);
        // #ef4444 (Red, 1st preset), #3b82f6 (Blue, 5th preset), then unassigned
        assert.deepEqual(sectionKeys, ["#ef4444", "#3b82f6", "unassigned"]);

        // Check swatches on jump strip
        const swatches = chipsContainer.querySelectorAll(".localprompt-category-jump-item.color-swatch");
        assert.equal(swatches.length, 3);

        controller.dispose();
    } finally {
        globalThis.document = origDocument;
    }
});
