import test from "node:test";
import assert from "node:assert/strict";

class FakeElement {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.dataset = {};
        this.hidden = false;
        this.value = "";
        this.className = "";
        this.textContent = "";
        this.listeners = {};
        this.style = { setProperty() {} };
        this.classList = {
            add: name => { this.className = `${this.className} ${name}`.trim(); },
            toggle() {},
        };
    }
    setAttribute() {}
    addEventListener(type, handler) {
        (this.listeners[type] ||= []).push(handler);
    }
    dispatch(type, event = {}) {
        (this.listeners[type] || []).forEach(handler => handler({ preventDefault() {}, stopPropagation() {}, ...event }));
    }
    appendChild(child) {
        this.children.push(child);
    }
    replaceChildren(...children) {
        this.children = children;
    }
    focus() {}
}

globalThis.document = { createElement: tag => new FakeElement(tag) };

const { createPromptCategoryStripController } = await import(new URL("../js/prompt/categoryStripController.js", import.meta.url));

function setup({ categories = ["Style", "Pose", "Light", "Camera"], pinned = ["Pose", "Camera"] } = {}) {
    const overflow = new FakeElement("div");
    const pullTab = new FakeElement("button");
    const elements = { "-category-overflow": overflow, "-category-pull-tab": pullTab };
    const opened = [];
    let activeTab = null;
    const controller = createPromptCategoryStripController({
        widgetContainer: { querySelector: selector => elements[selector.replace("#node", "")] || null },
        uniqueId: "node",
        getCachedCategories: async () => categories,
        ensurePinnedCategoriesInitialized: async () => pinned,
        getCategoriesInCurrentOrder: list => [...list].sort(),
        getActiveLibraryTab: () => activeTab,
        setActiveLibraryTab: category => { activeTab = category; opened.push(category); },
        setCategoryOverflowOpen() {},
        getSuppressCategoryClickUntil: () => 0,
        setSuppressCategoryClickUntil() {},
        setCategoryDragState() {},
        showCategoryPillContextMenu() {},
        setWorkspaceMode() {},
        getWorkspaceMode: () => "gallery",
        renderLibraryDrawer: async () => {},
        clearLibraryNavActiveState() {},
        syncPromptSortControls() {},
        syncSelectedSectionVisibility() {},
        closeToolbarPanels() {},
        getCategoryRoleColor: () => "#123456",
    });
    const parts = () => {
        const [search, grid, empty] = overflow.children;
        return { search, grid, empty, pills: grid.children };
    };
    return { controller, pullTab, opened, parts };
}

test("overflow lists pinned categories first, then the rest in current order", async () => {
    const { controller, parts } = setup();
    await controller.renderCategoryOverflowCategories();
    const { pills } = parts();
    assert.deepEqual(pills.map(pill => pill.dataset.category), ["Pose", "Camera", "Light", "Style"]);
    assert.deepEqual(pills.map(pill => pill.dataset.pinned), ["true", "true", "false", "false"]);
});

test("overflow search filters pills and shows the empty note when nothing matches", async () => {
    const { controller, parts } = setup();
    await controller.renderCategoryOverflowCategories();
    const { search, pills, empty } = parts();

    search.value = "po";
    search.dispatch("input");
    assert.deepEqual(pills.filter(pill => !pill.hidden).map(pill => pill.dataset.category), ["Pose"]);
    assert.equal(empty.hidden, true);

    search.value = "zzz";
    search.dispatch("input");
    assert.equal(pills.every(pill => pill.hidden), true);
    assert.equal(empty.hidden, false);

    search.dispatch("keydown", { key: "Escape" });
    assert.equal(search.value, "");
    assert.equal(pills.some(pill => pill.hidden), false);
});

test("Enter opens the first visible match and the query survives re-render", async () => {
    const { controller, opened, parts } = setup();
    await controller.renderCategoryOverflowCategories();
    const { search } = parts();
    search.value = "li";
    search.dispatch("input");
    search.dispatch("keydown", { key: "Enter" });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(opened, ["Light"]);

    await controller.renderCategoryOverflowCategories();
    assert.equal(parts().search.value, "li");
});

test("pull tab hides when there are no categories", async () => {
    const empty = setup({ categories: [], pinned: [] });
    await empty.controller.renderCategoryOverflowCategories();
    assert.equal(empty.pullTab.hidden, true);

    const filled = setup();
    await filled.controller.renderCategoryOverflowCategories();
    assert.equal(filled.pullTab.hidden, false);
});
