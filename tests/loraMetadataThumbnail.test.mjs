import { readBackendSource } from "./backendSource.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const uiSource = [
    await readFile(new URL("../js/lora/ui.js", import.meta.url), "utf8"),
    await readFile(new URL("../js/lora/template.js", import.meta.url), "utf8"),
].join("\n");
const metadataEditorSource = await readFile(new URL("../js/lora/metadataEditor.js", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../js/api/loraApi.js", import.meta.url), "utf8");
const backendSource = await readBackendSource("lora");

test("LoRA details editor exposes latest-result thumbnail assignment", () => {
    assert.match(uiSource, /class="lg-text-btn use-last-output-thumbnail-btn"/);
    assert.match(uiSource, /api\.addEventListener\("executed"/);
    assert.match(apiSource, /\/localgalleryunified\/lora\/assign_thumbnail/);
    assert.match(backendSource, /routes\.post\("\/localgalleryunified\/lora\/assign_thumbnail"\)/);
    assert.match(backendSource, /PREVIEW_BACKUP_DIR/);
});

test("LoRA tag controls are removed while backend metadata compatibility remains", () => {
    assert.doesNotMatch(uiSource, /tag-editor|tag-filter|Select Tags|Custom tags/);
    assert.doesNotMatch(apiSource, /getAllTags/);
    assert.match(backendSource, /data\.get\("tags"\)/);
    assert.match(backendSource, /\/localgalleryunified\/lora\/get_all_tags/);
});

test("LoRA details editor has responsive grouped layout and disabled thumbnail state", () => {
});

test("LoRA details editor has explicit close and compact optional presets", () => {
    assert.match(uiSource, /class="lg-icon-btn lora-metadata-editor-close"[\s\S]*?aria-label="Close LoRA details"/);
    assert.match(metadataEditorSource, /metadataEditorCloseBtn\.addEventListener\("click"[\s\S]*?onClose\(\)/);
    assert.match(uiSource, /class="lora-trigger-preset-editor-toggle"[\s\S]*?aria-expanded="false"/);
    assert.match(uiSource, /class="lora-trigger-preset-content" hidden/);
    assert.match(metadataEditorSource, /setPresetEditorExpanded\(presetEntries\.length > 0\)/);
});

test("latest-result thumbnail assignment updates the visible card without refreshing the gallery", () => {
    assert.match(metadataEditorSource, /findGalleryCardByLoraName\(loraName\)/);
    assert.match(metadataEditorSource, /mediaContainer\.replaceChildren\(media\)/);

    const handlerStart = metadataEditorSource.indexOf("useLastOutputThumbnailBtn.addEventListener");
    const handlerEnd = metadataEditorSource.indexOf("    });", handlerStart) + 7;
    const handler = metadataEditorSource.slice(handlerStart, handlerEnd);
    assert.doesNotMatch(handler, /fetchAndRender\(/);
});
