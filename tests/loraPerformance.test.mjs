import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const uiSource = await readFile(new URL("../js/lora/ui.js", import.meta.url), "utf8");
const activeStackControllerSource = await readFile(new URL("../js/lora/activeStackController.js", import.meta.url), "utf8");
const rendererSource = await readFile(new URL("../js/lora/renderers.js", import.meta.url), "utf8");
const backendSource = await readFile(new URL("../backend/Local_Lora_Gallery.py", import.meta.url), "utf8");

test("display slider release persists without requesting another gallery fetch", () => {
    for (const slider of ["lora-active-thumbnail-size-slider", "lora-thumbnail-size-slider", "lora-bars-size-slider"]) {
        const marker = `widgetContainer.querySelector(".${slider}")?.addEventListener("change"`;
        const start = uiSource.indexOf(marker);
        assert.ok(start >= 0, `missing ${slider} change handler`);
        const end = uiSource.indexOf("});", start) + 3;
        const handler = uiSource.slice(start, end);
        assert.match(handler, /flushLoraDisplayStateSave\(\)/);
        assert.doesNotMatch(handler, /saveStateAndFetch\(/);
        assert.doesNotMatch(handler, /fetchAndRender\(/);
    }
});

test("selection and name search reconcile existing cards instead of rebuilding on every interaction", () => {
    assert.match(uiSource, /let selectionSyncFrame = null/);
    assert.match(uiSource, /if \(selectionSyncFrame !== null\) return/);
    assert.match(uiSource, /galleryEl\.insertBefore\(card, galleryEl\.children\[targetIndex\] \|\| null\)/);
    assert.match(uiSource, /let nameSearchTimer = null/);
    assert.match(uiSource, /setTimeout\(apply, 120\)/);
    assert.match(uiSource, /card\.hidden = Boolean\(query/);
    assert.doesNotMatch(uiSource.slice(uiSource.indexOf('searchInput.addEventListener("input"'), uiSource.indexOf('searchInput.addEventListener("keydown"')), /renderCurrentView/);
});

test("initial data requests are parallel and preset cleanup uses the close hook", () => {
    assert.match(uiSource, /Promise\.all\(\[loadPresets\(\), fetchAndRender\(\)\]\)/);
    assert.doesNotMatch(uiSource, /loadAllTags|getAllTags|tagFilterInput|tagFilterModeBtn/);
    assert.match(uiSource, /openPicker\._closeLoraPresetPopover\?\.\(\)/);
});

test("workflow reload hydrates missing Active Stack metadata without changing browser pagination", () => {
    assert.match(uiSource, /const activeLoraInfoHydratedNames = new Set\(\);/);
    assert.match(uiSource, /markHydratedActiveLoraNames\(this\.availableLoras\);/);
    assert.match(uiSource, /loraApi\.getLoras\(\s*"",\s*"OR",\s*"",\s*1,\s*names,\s*names\.length,/);
    assert.match(uiSource, /for \(let index = 0; index < loraNames\.length; index \+= 200\)/);
    assert.match(uiSource, /hydrateSelectedLoraInfo\(loras\);/);
    assert.match(uiSource, /const returnedNames = new Set\(loras\.map\(lora => lora\.name\)\);/);
    assert.match(uiSource, /if \(returnedNames\.has\(name\)\) activeLoraInfoHydratedNames\.add\(name\);/);
    assert.match(uiSource, /getLoras\.call\(this, "", "OR", folderFilterSelect\.value, pageToFetch, \[\], 50, getLoraDisplayState\(\)\.sort_mode\)/);
    assert.match(activeStackControllerSource, /hydrateSelectedLoraInfo: \(availableLoras = nodeInstance\.availableLoras\) => hydrateSelectedLoraInfo\(/);
    assert.match(uiSource, /Failed to hydrate Active Stack metadata/);
});

test("browser video previews render their source immediately and inventory has explicit invalidation", () => {
    assert.match(rendererSource, /preload="metadata" src="\$\{previewUrl\}"/);
    assert.doesNotMatch(rendererSource, /data-src=/);
    assert.doesNotMatch(uiSource, /video\.dataset\.src/);
    assert.match(backendSource, /def invalidate_lora_inventory\(\)/);
    assert.match(backendSource, /def get_lora_inventory\(\)/);
    assert.match(backendSource, /def load_execution_metadata\(\)/);
});
